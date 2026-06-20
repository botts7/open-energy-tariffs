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
    'AU postcodes: G-NAF © <a href="https://geoscape.com.au/">Geoscape Australia</a>');

  const groups = {}; // source -> LayerGroup
  const centers = [];
  const layers = []; // { layer, group, hay, center } for filtering + fitting
  const voronoiCache = {}; // postcode-set -> rings (plans sharing a set reuse geometry)
  let mapped = 0, unmapped = 0;

  function areaStyle(rate) {
    return { renderer, color: '#333', weight: 1, fillColor: OET.rateColor(rate), fillOpacity: 0.4 };
  }

  for (const entry of plans) {
    const { meta: m, tariff } = entry;
    const points = OET.resolveCoverage(m.coverage);
    const boundary = OET.boundaryFor ? OET.boundaryFor(m.coverage) : null;
    if (!points.length && !boundary) { unmapped++; continue; }
    const rate = OET.planRate(tariff);
    const src = m.source || 'other';
    const group = groups[src] || (groups[src] = L.layerGroup().addTo(map));
    const cov = m.coverage || {};
    const hay = [m.country, m.region, m.provider, m.plan, m.source, cov.gsp, cov.utilityId, (cov.postcodes || []).join(' ')]
      .join(' ').toLowerCase();
    const popup = (extra) => popupHtml(m, tariff, rate) + (extra ? `<br><span style="color:#777">${esc(extra)}</span>` : '');

    if (boundary) {
      // Exact coverage polygon (true choropleth) when boundary data is bundled.
      const layer = L.geoJSON(boundary, { style: areaStyle(rate) }).bindPopup(popup('exact boundary'));
      layer.addTo(group);
      mapped++;
      const c = layer.getBounds().getCenter();
      centers.push([c.lat, c.lng]);
      layers.push({ layer, group, hay, center: [c.lat, c.lng] });
    } else {
      // Postcodes -> Voronoi polygons derived from the points (real areas).
      // Cache by postcode-set so plans with identical coverage reuse the geometry.
      const pcLatLngs = points.filter((p) => p.type === 'postcode').map((p) => p.latlng);
      const ckey = (cov.postcodes || []).join(',');
      let rings = voronoiCache[ckey];
      if (rings === undefined) {
        rings = (OET.voronoiPolygons && pcLatLngs.length) ? OET.voronoiPolygons(pcLatLngs) : [];
        voronoiCache[ckey] = rings;
      }
      if (rings.length) {
        mapped += pcLatLngs.length;
        const layer = L.polygon(rings, areaStyle(rate)).bindPopup(popup(`${pcLatLngs.length} postcode area(s) (Voronoi)`));
        layer.addTo(group);
        const c = layer.getBounds().getCenter();
        centers.push([c.lat, c.lng]);
        layers.push({ layer, group, hay, center: [c.lat, c.lng] });
      } else {
        for (const p of points.filter((p) => p.type === 'postcode')) {
          mapped++;
          const layer = L.circle(p.latlng, Object.assign({ radius: OET.AREA_RADIUS.postcode }, areaStyle(rate))).bindPopup(popup(p.label));
          layer.addTo(group);
          centers.push(p.latlng);
          layers.push({ layer, group, hay: hay + ' ' + p.label.toLowerCase(), center: p.latlng });
        }
      }
      // GSP / utility -> area circle (single region centroid).
      for (const p of points.filter((p) => p.type !== 'postcode')) {
        mapped++;
        const layer = L.circle(p.latlng, Object.assign({ radius: OET.AREA_RADIUS[p.type] || 8000 }, areaStyle(rate)))
          .bindPopup(popup(p.label));
        layer.addTo(group);
        centers.push(p.latlng);
        layers.push({ layer, group, hay: hay + ' ' + p.label.toLowerCase(), center: p.latlng });
      }
    }
  }

  // "What's in my area" — show only areas matching a free-text query
  // (postcode, GSP, region, provider…). Empty query restores all.
  OET._map = map;
  OET.applyFilter = function (q) {
    const query = String(q || '').trim().toLowerCase();
    const shown = [];
    for (const { layer, group, hay, center } of layers) {
      if (!query || hay.indexOf(query) !== -1) { group.addLayer(layer); shown.push(center); }
      else group.removeLayer(layer);
    }
    if (query && shown.length) map.fitBounds(shown, { padding: [40, 40], maxZoom: 9 });
    const info = document.getElementById('info');
    if (info) info.textContent = `${shown.length}/${layers.length} area(s)${query ? ` matching “${query}”` : ''}`;
  };

  // Fit to the data when it's regional; for globe-spanning data a fit would
  // centre on the antimeridian and push continents off-screen, so show the world.
  if (centers.length) {
    const lngs = centers.map((p) => p[1]);
    const span = Math.max.apply(null, lngs) - Math.min.apply(null, lngs);
    if (span <= 150) map.fitBounds(centers, { padding: [40, 40], maxZoom: 7 });
    else map.setView([25, 10], 2);
  }
  if (Object.keys(groups).length > 1) L.control.layers(null, groups, { collapsed: false }).addTo(map);

  // Legend.
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'oet-legend');
    div.innerHTML = '<b>Rate / kWh (local currency)</b><br>'
      + OET.RATE_BUCKETS.map(([, c, label]) =>
        `<span class="sw" style="background:${c}"></span>${label}`).join('<br>');
    return div;
  };
  legend.addTo(map);

  const info = document.getElementById('info');
  if (info) {
    info.textContent = `${plans.length} plan(s) · ${mapped} area(s) mapped · `
      + `${unmapped} with no resolvable coverage · data: ${meta.source}`;
  }
  return map;
};

OET.main = async function () {
  const { entries, source } = await OET.loadPlans();
  if (OET.loadBoundaries) await OET.loadBoundaries(); // exact polygons if bundled
  OET.renderMap(entries, { source });
};
