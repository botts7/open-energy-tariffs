// Render plans onto a Leaflet map as graduated markers coloured by rate, grouped
// by source (toggleable), with popups. Depends on global L (Leaflet), geo.js, data.js.
window.OET = window.OET || {};

// Rate (local currency per kWh) -> colour bucket.
OET.RATE_BUCKETS = [
  [0.12, '#1a9850', '< 0.12'],
  [0.20, '#91cf60', '0.12–0.20'],
  [0.28, '#fee08b', '0.20–0.28'],
  [0.36, '#fc8d59', '0.28–0.36'],
  [Infinity, '#d73027', '≥ 0.36'],
];
OET.rateColor = function (r) {
  if (r == null) return '#999';
  for (const [hi, color] of OET.RATE_BUCKETS) if (r < hi) return color;
  return '#d73027';
};

// Escape dynamic (community/imported) values before putting them in HTML — a
// malicious plan/provider name must not be able to inject markup.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const num = (n) => (typeof n === 'number' && isFinite(n) ? n : null);

function popupHtml(meta, tariff, rate) {
  const cov = meta.coverage || {};
  const where = cov.gsp ? `GSP ${esc(cov.gsp)}`
    : cov.postcodes ? `${cov.postcodes.length} postcode(s)`
    : cov.utilityId ? `utility ${esc(cov.utilityId)}` : '—';
  const supply = tariff.supply && num(tariff.supply.daily) != null ? `, supply ${num(tariff.supply.daily)}/day` : '';
  return `<strong>${esc(meta.provider)}</strong> — ${esc(meta.plan)}<br>`
    + `<span style="color:#555">${esc(meta.country)}${meta.region ? ' / ' + esc(meta.region) : ''} · ${esc(meta.source)}</span><br>`
    + `Rate: <strong>${rate == null ? '—' : rate.toFixed(3)} ${esc(meta.currency)}/kWh</strong> (${esc(tariff.kind)}${supply})<br>`
    + `Coverage: ${where}`;
}

OET.renderMap = function (plans, meta) {
  // preferCanvas + a shared canvas renderer: thousands of polygons draw to ONE
  // canvas instead of thousands of SVG DOM nodes (much faster at scale).
  const map = L.map('map', { worldCopyJump: true, preferCanvas: true }).setView([30, 0], 2);
  const renderer = L.canvas({ padding: 0.5 });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '© OpenStreetMap contributors',
  }).addTo(map);
  // Data attribution (required: AER tariff data is CC BY 4.0). Shown wherever the
  // data is displayed, per the licence. URDB is CC0 (citation as courtesy).
  map.attributionControl.addAttribution(
    'Tariffs: © <a href="https://www.aer.gov.au/">AER</a> ' +
    '<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · OpenEI/NREL URDB (CC0) · ' +
    'AU postcodes: G-NAF © <a href="https://geoscape.com.au/">Geoscape Australia</a> · ' +
    'Country shapes: <a href="https://www.naturalearthdata.com/">Natural Earth</a> (public domain)');

  const groups = {}; // source -> LayerGroup (organisation; visibility via filter)
  const centers = [];
  const planRecs = []; // one per plan: { id, meta, tariff, rate, src, layers, bounds, located, hay }
  const hullCache = {}; // postcode-set -> convex-hull ring (plans sharing a set reuse geometry)
  let mapped = 0, unmapped = 0;

  function areaStyle(cRate) {
    return { renderer, color: '#333', weight: 1, fillColor: OET.rateColor(cRate), fillOpacity: 0.4 };
  }
  function recBounds(ls) {
    let b = null;
    for (const l of ls) { const lb = l.getBounds(); b = b ? b.extend(lb) : L.latLngBounds(lb.getSouthWest(), lb.getNorthEast()); }
    return b;
  }

  for (const entry of plans) {
    const { meta: m, tariff } = entry;
    const points = OET.resolveCoverage(m.coverage);
    const boundary = OET.boundaryFor ? OET.boundaryFor(m.coverage) : null;
    const rate = OET.planRate(tariff);
    const cRate = OET.toUsd ? OET.toUsd(rate, m.currency) : rate; // USD-equiv for colour
    const src = m.source || 'other';
    const cov = m.coverage || {};
    const recLayers = [];

    if (points.length || boundary || cov.national) {
      const group = groups[src] || (groups[src] = L.layerGroup().addTo(map));
      const popup = (extra) => popupHtml(m, tariff, rate) + (extra ? `<br><span style="color:#777">${esc(extra)}</span>` : '');
      const add = (layer) => { layer.addTo(group); recLayers.push(layer); };
      if (boundary) {
        add(L.geoJSON(boundary, { style: areaStyle(cRate) }).bindPopup(popup('exact boundary')));
        mapped++;
      } else if (points.length) {
        // AGGREGATE: one convex-hull polygon per plan (not one Voronoi cell per
        // postcode) so 1000+ plans stay interactive. Cached by postcode-set.
        const pcPts = points.filter((p) => p.type === 'postcode');
        const pcLatLngs = pcPts.map((p) => p.latlng);
        const ckey = (cov.postcodes || []).join(',');
        let hull = hullCache[ckey];
        if (hull === undefined) { hull = (OET.convexHull && pcLatLngs.length >= 3) ? OET.convexHull(pcLatLngs) : null; hullCache[ckey] = hull; }
        if (hull) { add(L.polygon(hull, areaStyle(cRate)).bindPopup(popup(`${pcLatLngs.length} postcode area(s)`))); mapped++; }
        else for (const p of pcPts) { add(L.circle(p.latlng, Object.assign({ radius: OET.AREA_RADIUS.postcode }, areaStyle(cRate))).bindPopup(popup(p.label))); mapped++; }
        for (const p of points.filter((p) => p.type !== 'postcode')) { add(L.circle(p.latlng, Object.assign({ radius: OET.AREA_RADIUS[p.type] || 8000 }, areaStyle(cRate))).bindPopup(popup(p.label))); mapped++; }
      } else if (cov.national && OET.nationalGeometry) {
        // National plan -> shade the whole country (or a centroid if no polygon).
        const ng = OET.nationalGeometry(m.country, m.region);
        const tag = 'national' + (m.region ? ' · ' + m.region : '');
        if (ng && ng.type === 'polygon') { add(L.geoJSON(ng.geojson, { style: areaStyle(cRate) }).bindPopup(popup(tag))); mapped++; }
        else if (ng) { add(L.circle(ng.latlng, Object.assign({ radius: 250000 }, areaStyle(cRate))).bindPopup(popup(tag))); mapped++; }
      }
    } else unmapped++;

    const bounds = recLayers.length ? recBounds(recLayers) : null;
    if (bounds) centers.push([bounds.getCenter().lat, bounds.getCenter().lng]);
    planRecs.push({
      id: m.id, meta: m, tariff, rate, src, group: groups[src], layers: recLayers, bounds, located: !!bounds,
      hay: [m.country, m.region, m.provider, m.plan, m.source, cov.gsp, cov.utilityId, (cov.postcodes || []).join(' ')].join(' ').toLowerCase(),
    });
  }

  OET._map = map;
  OET.PLANS = planRecs;

  // Zoom to a plan + open its popup (called from the sidebar).
  OET.focusPlan = function (id) {
    const r = planRecs.find((p) => p.id === id);
    if (!r || !r.bounds) return;
    map.fitBounds(r.bounds, { padding: [40, 40], maxZoom: 11 });
    if (r.layers[0] && r.layers[0].openPopup) r.layers[0].openPopup();
  };

  // Show only plans matching a predicate (sidebar filters). Returns visible count.
  OET.applyPlanFilter = function (pred) {
    let vis = 0;
    for (const r of planRecs) {
      const on = !pred || pred(r);
      for (const l of r.layers) { if (on) r.group.addLayer(l); else r.group.removeLayer(l); }
      if (on) vis++;
    }
    return vis;
  };

  // Initial fit: regional data fits; globe-spanning data shows the world.
  if (centers.length) {
    const lngs = centers.map((p) => p[1]);
    const span = Math.max.apply(null, lngs) - Math.min.apply(null, lngs);
    if (span <= 150) map.fitBounds(centers, { padding: [40, 40], maxZoom: 7 });
    else map.setView([25, 10], 2);
  }

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'oet-legend');
    div.innerHTML = '<b>Rate / kWh (~USD-equiv.)</b><br>'
      + OET.RATE_BUCKETS.map(([, c, label]) => `<span class="sw" style="background:${c}"></span>${label}`).join('<br>');
    return div;
  };
  legend.addTo(map);

  OET._stats = { plans: plans.length, mapped, unmapped, source: meta.source };
  return map;
};

OET.main = async function () {
  const { entries, source } = await OET.loadPlans();
  if (OET.loadBoundaries) await OET.loadBoundaries(); // exact polygons if bundled
  OET.renderMap(entries, { source });
  if (OET.initSidebar) OET.initSidebar();
  // Defer the big suburb-search bundle off the critical path (idle after paint).
  if (OET.loadScript) setTimeout(() => OET.loadScript('au-suburbs.js'), 250);
};
