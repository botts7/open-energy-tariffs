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
  const cName = OET.countryName ? OET.countryName(meta.country) : meta.country;
  const sName = OET.sourceName ? OET.sourceName(meta.source) : meta.source;
  return `<strong>${esc(meta.provider)}</strong> — ${esc(meta.plan)}<br>`
    + `<span style="color:#555">${esc(cName)}${meta.region ? ' / ' + esc(meta.region) : ''} · ${esc(sName)}</span><br>`
    + `Rate: <strong>${rate == null ? '—' : rate.toFixed(3)} ${esc(meta.currency)}/kWh</strong> (${esc(tariff.kind)}${supply})<br>`
    + `Coverage: ${where}`
    + `<br><button type="button" onclick="OET.openModalById('${esc(meta.id)}')" style="margin-top:7px;padding:4px 10px;border:1px solid #2563eb;background:#2563eb;color:#fff;border-radius:5px;cursor:pointer;font-size:11px">Full details ›</button>`
    + `<button type="button" onclick="OET.addToCompare&&OET.addToCompare('${esc(meta.id)}')" style="margin:7px 0 0 6px;padding:4px 10px;border:1px solid #cbd5e1;background:#f8fafc;color:#1a2233;border-radius:5px;cursor:pointer;font-size:11px">＋ Compare</button>`;
}

// Open the plan-details modal from a map popup button (looks the plan up by id).
OET.openModalById = function (id) {
  const r = (OET.PLANS || []).find((p) => p.id === id);
  if (r && OET.showPlanModal) OET.showPlanModal(r);
};

OET.renderMap = function (plans, meta) {
  // preferCanvas + a shared canvas renderer: thousands of polygons draw to ONE
  // canvas instead of thousands of SVG DOM nodes (much faster at scale).
  const map = L.map('map', { worldCopyJump: true, preferCanvas: true }).setView([30, 0], 2);
  const renderer = L.canvas({ padding: 0.5 });
  // Switchable base layers + a layers control (top-right), like other web maps.
  const baseLayers = {
    Street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' }),
    Light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OpenStreetMap, © CARTO' }),
    Dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '© OpenStreetMap, © CARTO', className: 'oet-dark-tiles' }),
    Satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri' }),
  };
  baseLayers.Street.addTo(map);
  // Match the base map to the UI light/dark theme — but only flip Street<->Dark,
  // so a manual Light/Satellite choice is left untouched.
  OET.setMapTheme = function (dark) {
    const from = dark ? baseLayers.Street : baseLayers.Dark;
    const to = dark ? baseLayers.Dark : baseLayers.Street;
    if (map.hasLayer(from)) { map.removeLayer(from); to.addTo(map); }
  };
  // coverageLayer holds every provider coverage area (toggleable as one overlay,
  // and auto-hidden in postcode mode). postcodeLayer holds the searched postcode.
  const coverageLayer = L.layerGroup().addTo(map);
  const postcodeLayer = L.layerGroup().addTo(map);
  const highlightLayer = L.layerGroup().addTo(map); // focused plan's REAL coverage
  let addressMarker = null; // exact geocoded address pin
  const overviewByCountry = {}; // per-country overview shading (AU/US etc.)
  // A red dot at a geocoded street address (vs the postcode polygon it sits in).
  OET.setAddressPin = function (latlng, label) {
    if (addressMarker) { map.removeLayer(addressMarker); addressMarker = null; }
    if (!latlng) return;
    addressMarker = L.circleMarker(latlng, { renderer, radius: 7, color: '#b91c1c', weight: 3, fillColor: '#ef4444', fillOpacity: 0.95 }).addTo(map);
    if (label) addressMarker.bindPopup(esc(label)).openPopup();
  };
  L.control.layers(baseLayers, { 'Coverage areas': coverageLayer, 'Searched postcode': postcodeLayer, 'Focused plan (real)': highlightLayer }, { position: 'topright', collapsed: true }).addTo(map);
  // Data attribution. AU plan data comes via the AER's public Consumer Data Right
  // (CDR) Product Reference Data API — public data, attribute the AER (not a formal
  // open licence, so we don't claim CC BY). URDB is CC0 (citation as courtesy).
  map.attributionControl.addAttribution(
    'AU tariffs: © <a href="https://www.aer.gov.au/">AER</a> ' +
    'via <a href="https://www.cdr.gov.au/">CDR</a> Product Reference Data (not endorsed by the AER) · OpenEI/NREL URDB (CC0) · ' +
    'AU postcodes: G-NAF © <a href="https://geoscape.com.au/">Geoscape Australia</a> · ' +
    'Postcode areas: © <a href="https://www.abs.gov.au/">ABS</a> POA 2021 (CC BY 4.0) · ' +
    'Address search: <a href="https://nominatim.openstreetmap.org/">Nominatim</a>/OSM · ' +
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
    let recHeavy = false; // postcode-hull plans (the AU mass) — rendered on demand only

    // Plans with only a state/province region (e.g. US URDB plans: utility-level,
    // no postcodes/boundary/national) shade that province polygon when we have one.
    const provKey = (!points.length && !boundary && !cov.national && m.region) ? (m.country + '-' + m.region) : null;
    const regionGeo = (provKey && OET.PROVINCES && OET.PROVINCES[provKey]) || null;

    if (points.length || boundary || cov.national || regionGeo) {
      const group = groups[src] || (groups[src] = L.layerGroup().addTo(coverageLayer));
      const popup = (extra) => popupHtml(m, tariff, rate) + (extra ? `<br><span style="color:#777">${esc(extra)}</span>` : '');
      // heavy layers are NOT added to the map up front (5000+ would tank the fps);
      // applyPlanFilter draws them only when the filtered set is small enough.
      const add = (layer, heavy) => { recLayers.push(layer); if (heavy) recHeavy = true; else layer.addTo(group); };
      if (boundary) {
        add(L.geoJSON(boundary, { style: areaStyle(cRate) }).bindPopup(popup('exact boundary')));
        mapped++;
      } else if (points.length) {
        // AGGREGATE: one convex-hull polygon per plan (not one Voronoi cell per
        // postcode) so 1000+ plans stay interactive. Cached by postcode-set.
        const pcPts = points.filter((p) => p.type === 'postcode');
        const pcLatLngs = pcPts.map((p) => p.latlng);
        const ckey = (cov.postcodes || []).join(',');
        let hull = hullCache[ckey]; // array of rings (concave, hugs postcodes) or null
        if (hull === undefined) {
          let rings = (pcLatLngs.length >= 3 && OET.concaveHull) ? OET.concaveHull(pcLatLngs) : null;
          if (!rings && pcLatLngs.length >= 3 && OET.convexHull) { const cv = OET.convexHull(pcLatLngs); rings = cv ? [cv] : null; }
          hull = rings; hullCache[ckey] = rings;
        }
        // hull.map(r=>[r]) -> multipolygon (each ring its own filled area, no bridging)
        if (hull) { add(L.polygon(hull.map((r) => [r]), areaStyle(cRate)).bindPopup(popup(`${pcLatLngs.length} postcode area(s)`)), true); mapped++; }
        else for (const p of pcPts) { add(L.circle(p.latlng, Object.assign({ radius: OET.AREA_RADIUS.postcode }, areaStyle(cRate))).bindPopup(popup(p.label)), true); mapped++; }
        for (const p of points.filter((p) => p.type !== 'postcode')) { add(L.circle(p.latlng, Object.assign({ radius: OET.AREA_RADIUS[p.type] || 8000 }, areaStyle(cRate))).bindPopup(popup(p.label))); mapped++; }
      } else if (cov.national && OET.nationalGeometry) {
        // National plan -> shade the whole country (or a centroid if no polygon).
        const ng = OET.nationalGeometry(m.country, m.region);
        const tag = 'national' + (m.region ? ' · ' + m.region : '');
        if (ng && ng.type === 'polygon') { add(L.geoJSON(ng.geojson, { style: areaStyle(cRate) }).bindPopup(popup(tag))); mapped++; }
        else if (ng) { add(L.circle(ng.latlng, Object.assign({ radius: 250000 }, areaStyle(cRate))).bindPopup(popup(tag))); mapped++; }
      } else if (regionGeo) {
        // State/province shading, drawn on demand (heavy) so many US plans in one
        // state don't stack hundreds of polygons on the world view.
        add(L.geoJSON({ type: 'Feature', geometry: regionGeo }, { style: areaStyle(cRate) }).bindPopup(popup('region · ' + m.region)), true);
        mapped++;
      }
    } else unmapped++;

    const bounds = recLayers.length ? recBounds(recLayers) : null;
    if (bounds) centers.push([bounds.getCenter().lat, bounds.getCenter().lng]);
    planRecs.push({
      id: m.id, meta: m, tariff, rate, src, group: groups[src], layers: recLayers, bounds, located: !!bounds, _heavy: recHeavy,
      hay: [m.country, m.region, m.provider, m.plan, m.source, cov.gsp, cov.utilityId, (cov.postcodes || []).join(' ')].join(' ').toLowerCase(),
    });
  }

  OET._map = map;
  OET.PLANS = planRecs;

  // Country overview: countries whose plans are ALL postcode-based (e.g. AU) have
  // no national polygon, so they'd be blank at the world view. Shade each such
  // country by the MEDIAN rate of its plans — a light, always-on layer the detailed
  // hulls draw on top of when you zoom/filter in.
  (function countryOverview() {
    const byCountry = {}, hasNational = {};
    for (const r of planRecs) {
      (byCountry[r.meta.country] = byCountry[r.meta.country] || []).push(r);
      if (r.meta.coverage && r.meta.coverage.national) hasNational[r.meta.country] = true;
    }
    for (const c in byCountry) {
      if (hasNational[c]) continue; // already shaded by its own national plan
      const recs = byCountry[c];
      const rates = recs.map((r) => r.rate).filter((v) => typeof v === 'number').sort((a, b) => a - b);
      if (!rates.length) continue;
      const medLocal = rates[Math.floor(rates.length / 2)];
      const medUsd = OET.toUsd ? OET.toUsd(medLocal, recs[0].meta.currency) : medLocal;
      const ng = OET.nationalGeometry && OET.nationalGeometry(c);
      if (!ng) continue;
      const style = { renderer, color: '#333', weight: 1, fillColor: OET.rateColor(medUsd), fillOpacity: 0.4 };
      const cur = recs[0].meta.currency;
      const pop = `<strong>${esc(OET.countryName ? OET.countryName(c) : c)}</strong><br>`
        + `${recs.length.toLocaleString()} plans · median ~${medLocal.toFixed(3)} ${esc(cur)}/kWh<br>`
        + `<span style="color:#777">filter by postcode / provider for plan detail</span>`;
      const layer = (ng.type === 'polygon') ? L.geoJSON(ng.geojson, { renderer, style }) : L.circle(ng.latlng, Object.assign({ radius: 250000 }, style));
      overviewByCountry[c] = layer.bindPopup(pop).addTo(coverageLayer);
    }
  })();

  // Zoom the map to the bounds of the plans matching a predicate (used when a
  // geographic dropdown — country / distributor / provider — changes).
  OET.fitToFiltered = function (pred) {
    let b = null;
    for (const r of planRecs) {
      if (pred && !pred(r)) continue;
      if (!r.bounds) continue;
      b = b ? b.extend(r.bounds) : L.latLngBounds(r.bounds.getSouthWest(), r.bounds.getNorthEast());
    }
    if (b && b.isValid()) map.fitBounds(b, { padding: [30, 30], maxZoom: 10 });
  };

  // Zoom to a plan + open its popup (called from the sidebar).
  // Fast: just zoom to the plan's (hull) coverage + open its popup. No network.
  OET.focusPlan = function (id) {
    const r = planRecs.find((p) => p.id === id);
    if (!r) return;
    OET._focusedPlan = id;
    highlightLayer.clearLayers(); // drop any prior exact boundary
    if (r.bounds) map.fitBounds(r.bounds, { padding: [40, 40], maxZoom: 11 });
    if (r.layers[0] && r.layers[0].openPopup) r.layers[0].openPopup();
  };

  // Heavy + EXPLICIT (opt-in from the modal): fetch the plan's real ABS POA
  // boundaries and draw them. Separated from focusPlan so jumping between plans
  // stays snappy. Race-guarded so only the latest request renders.
  OET.loadRealCoverage = function (id) {
    const r = planRecs.find((p) => p.id === id);
    if (!r) return Promise.resolve(false);
    const pcs = (r.meta.coverage && r.meta.coverage.postcodes) || [];
    if (!pcs.length || !OET.fetchPoaCoverage) return Promise.resolve(false);
    OET._focusedPlan = id;
    return OET.fetchPoaCoverage(pcs).then(function (gj) {
      if (OET._focusedPlan !== id || !gj) return false;
      highlightLayer.clearLayers();
      const col = planColor(r);
      const layer = L.geoJSON(gj, { renderer, style: { color: col, weight: 1.5, opacity: 0.95, fillColor: col, fillOpacity: 0.3 } });
      layer.bindPopup('<strong>' + esc(r.meta.provider) + '</strong> — ' + esc(r.meta.plan) + '<br>real coverage · ' + pcs.length + ' postcodes (ABS POA 2021)');
      layer.addTo(highlightLayer);
      try { const b = layer.getBounds(); if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 12 }); } catch (_) {}
      return true;
    });
  };

  // Adaptive colouring: a global map must normalise currencies (USD-equiv) or JPY
  // would swamp the scale. But once the view is ONE currency (filtered to a
  // country), USD-equiv compresses the local spread — a dear 0.42 AUD plan and a
  // cheap 0.27 AUD plan look alike. So when all VISIBLE plans share a currency we
  // recolour by the LOCAL rate; otherwise USD-equiv. Recolour only on mode change.
  let colorMode = 'usd';
  if (OET._outline == null) OET._outline = false;
  function planColor(r) {
    const single = colorMode.indexOf('local:') === 0;
    const cur = single ? colorMode.slice(6) : null;
    const useLocal = single && r.meta.currency === cur;
    const cRate = useLocal ? r.rate : (OET.toUsd ? OET.toUsd(r.rate, r.meta.currency) : r.rate);
    return OET.rateColor(cRate);
  }
  // Filled choropleth, OR outline mode: a coloured boundary with near-zero fill so
  // overlapping coverage areas (and the basemap) stay visible.
  function styleFor(r) {
    const c = planColor(r);
    // Outline = ZERO fill (else 100+ overlapping near-identical network shapes
    // stack their fills back to solid). Filled = low opacity so the map shows.
    return OET._outline
      ? { color: c, weight: 1.5, opacity: 0.8, fillColor: c, fillOpacity: 0 }
      : { color: '#555', weight: 1, opacity: 0.9, fillColor: c, fillOpacity: 0.22 };
  }
  function restyleAll() { for (const r of planRecs) for (const l of r.layers) if (l.setStyle) l.setStyle(styleFor(r)); }

  // --- Postcode mode: draw the SEARCHED postcode as its own polygon (its Voronoi
  // cell among neighbours) and HIDE all provider coverage — the plans serving it
  // are listed in the sidebar, so the network hulls are just noise here. ---
  OET.showPostcodeArea = function (pc, center) {
    OET._lastPc = pc;
    OET._focusedPlan = null;
    highlightLayer.clearLayers();
    if (addressMarker) { map.removeLayer(addressMarker); addressMarker = null; } // re-added by the geocode flow if from an address
    postcodeLayer.clearLayers();
    if (map.hasLayer(coverageLayer)) { map.removeLayer(coverageLayer); OET._coverageHiddenByPc = true; }
    const style = { renderer, color: '#0d47a1', weight: 2, fillColor: '#42a5f5', fillOpacity: 0.3 };
    // 1) instant placeholder: Voronoi cell from nearby postcode centroids.
    const DB = OET.AU_POSTCODES_FULL || OET.AU_POSTCODES || {};
    const neigh = [];
    for (const k in DB) { if (k === pc) continue; const ll = DB[k]; const d = Math.hypot(ll[0] - center[0], ll[1] - center[1]); if (d < 0.7) neigh.push([d, ll]); }
    neigh.sort((a, b) => a[0] - b[0]);
    const near = neigh.slice(0, 40).map((x) => x[1]);
    const ring = OET.postcodePolygon ? OET.postcodePolygon(center, near) : null;
    const placeholder = ring ? L.polygon(ring, style) : L.circleMarker(center, Object.assign({ radius: 9 }, style));
    placeholder.bindPopup('Postcode <strong>' + esc(pc) + '</strong>').addTo(postcodeLayer);
    if (placeholder.getBounds) map.fitBounds(placeholder.getBounds(), { padding: [60, 60], maxZoom: 12 });
    else map.setView(center, 12);
    // 2) upgrade to the REAL ABS POA 2021 boundary when it arrives (free ABS open
    //    data, CC BY 4.0); keep the placeholder if the user moved on or it fails.
    if (OET.fetchPoaBoundary) OET.fetchPoaBoundary(pc).then(function (gj) {
      if (!gj || OET._lastPc !== pc) return;
      postcodeLayer.clearLayers();
      const real = L.geoJSON(gj, { renderer, style });
      real.bindPopup('Postcode <strong>' + esc(pc) + '</strong> · ABS POA 2021').addTo(postcodeLayer);
      try { const b = real.getBounds(); if (b.isValid()) map.fitBounds(b, { padding: [50, 50], maxZoom: 13 }); } catch (_) {}
    });
  };
  OET.clearPostcodeArea = function () {
    postcodeLayer.clearLayers();
    if (addressMarker) { map.removeLayer(addressMarker); addressMarker = null; }
    if (OET._coverageHiddenByPc) { map.addLayer(coverageLayer); OET._coverageHiddenByPc = false; }
  };
  function recolor(visibleRecs) {
    const curs = new Set();
    for (const r of visibleRecs) curs.add(r.meta.currency);
    const single = curs.size === 1;
    const cur = single ? [...curs][0] : null;
    const mode = single ? 'local:' + cur : 'usd';
    if (mode === colorMode) return; // colours already correct for this mode
    colorMode = mode; OET._colorMode = mode;
    restyleAll();
    if (OET._updateLegend) OET._updateLegend(cur);
  }
  // Toggle filled <-> outline (sidebar checkbox). Restyles every layer.
  OET.setOutline = function (on) { OET._outline = !!on; restyleAll(); };
  // Colour for a plan under the CURRENT mode, so sidebar swatches match the map.
  OET._rateColorNow = function (rate, currency) {
    const single = colorMode.indexOf('local:') === 0;
    const cur = single ? colorMode.slice(6) : null;
    const cRate = (single && currency === cur) ? rate : (OET.toUsd ? OET.toUsd(rate, currency) : rate);
    return OET.rateColor(cRate);
  };

  // Show only plans matching a predicate (sidebar filters). The heavy postcode
  // hulls (AU mass) render only when the filtered heavy-set is <= RENDER_CAP — so
  // the default/all view stays fast and you "load" coverage by narrowing down
  // (country / postcode / provider). Light national/boundary layers always show.
  const RENDER_CAP = 1200;
  OET.applyPlanFilter = function (pred) {
    const visibleRecs = [];
    let heavyVis = 0;
    for (const r of planRecs) { if (!pred || pred(r)) { visibleRecs.push(r); if (r._heavy) heavyVis++; } }
    const suppressHeavy = heavyVis > RENDER_CAP;
    let shown = 0;
    for (const r of planRecs) {
      const on = (!pred || pred(r)) && !(r._heavy && suppressHeavy);
      for (const l of r.layers) { if (on) r.group.addLayer(l); else r.group.removeLayer(l); }
      if (on) shown++;
    }
    recolor(visibleRecs);
    // Per-country overview shade: show it only when that country has visible plans
    // AND its detailed hulls are suppressed (so it's not blank), and hide it once
    // hulls actually render (they show the detail) — so filtering to one network
    // doesn't leave whole-country shading from other countries on the map.
    const visCountries = new Set();
    for (const r of visibleRecs) visCountries.add(r.meta.country);
    for (const c in overviewByCountry) {
      const show = suppressHeavy && visCountries.has(c);
      if (show) coverageLayer.addLayer(overviewByCountry[c]); else coverageLayer.removeLayer(overviewByCountry[c]);
    }
    OET._suppressedHeavy = suppressHeavy ? heavyVis : 0;
    OET._shownAreas = shown;
    return visibleRecs.length;
  };

  // Initial fit: regional data fits; globe-spanning data shows the world.
  if (centers.length) {
    const lngs = centers.map((p) => p[1]);
    const span = Math.max.apply(null, lngs) - Math.min.apply(null, lngs);
    if (span <= 150) map.fitBounds(centers, { padding: [40, 40], maxZoom: 7 });
    else map.setView([25, 10], 2);
  }

  const legend = L.control({ position: 'bottomright' });
  const legendBuckets = OET.RATE_BUCKETS.map(([, c, label]) => `<span class="sw" style="background:${c}"></span>${label}`).join('<br>');
  const legendHtml = (label) => `<b>Rate / kWh (${label})</b>`
    + (/USD/.test(label) && OET.conversionBadge ? '<br>' + OET.conversionBadge() : '')
    + '<br>' + legendBuckets;
  let legendDiv = null;
  legend.onAdd = function () {
    legendDiv = L.DomUtil.create('div', 'oet-legend');
    legendDiv.innerHTML = legendHtml('~USD-equiv.');
    return legendDiv;
  };
  legend.addTo(map);
  // Switch the legend label when colouring drops to a single local currency.
  OET._updateLegend = function (cur) { if (legendDiv) legendDiv.innerHTML = legendHtml(cur || '~USD-equiv.'); };

  OET._stats = { plans: plans.length, mapped, unmapped, source: meta.source };
  return map;
};

OET.main = async function () {
  const { entries, source } = await OET.loadPlans();
  let all = entries;
  if (OET.extendedEnabled && OET.extendedEnabled() && OET.loadExtended) {
    const ext = await OET.loadExtended();
    if (ext.length) { all = entries.concat(ext); OET._extendedCount = ext.length; }
  }
  if (OET.loadBoundaries) await OET.loadBoundaries(); // exact polygons if bundled
  OET.renderMap(all, { source });
  if (OET.initSidebar) OET.initSidebar();
  // Defer the big suburb-search bundle off the critical path (idle after paint).
  if (OET.loadScript) setTimeout(() => OET.loadScript('au-suburbs.js'), 250);
};
