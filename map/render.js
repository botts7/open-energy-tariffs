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
  const map = L.map('map', { worldCopyJump: true }).setView([30, 0], 2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '© OpenStreetMap contributors',
  }).addTo(map);

  const groups = {}; // source -> LayerGroup
  const allLatLngs = [];
  const markers = []; // { marker, group, hay } for "what's in my area" filtering
  let mapped = 0, unmapped = 0;

  for (const entry of plans) {
    const { meta: m, tariff } = entry;
    const points = OET.resolveCoverage(m.coverage);
    if (!points.length) { unmapped++; continue; }
    const rate = OET.planRate(tariff);
    const src = m.source || 'other';
    const group = groups[src] || (groups[src] = L.layerGroup().addTo(map));
    const cov = m.coverage || {};
    const hay = [m.country, m.region, m.provider, m.plan, m.source, cov.gsp, cov.utilityId, (cov.postcodes || []).join(' ')]
      .join(' ').toLowerCase();
    for (const p of points) {
      mapped++;
      allLatLngs.push(p.latlng);
      const marker = L.circleMarker(p.latlng, {
        radius: 8, weight: 1, color: '#222',
        fillColor: OET.rateColor(rate), fillOpacity: 0.85,
      }).bindPopup(popupHtml(m, tariff, rate) + `<br><span style="color:#777">${esc(p.label)}</span>`)
        .addTo(group);
      markers.push({ marker, group, hay: hay + ' ' + p.label.toLowerCase() });
    }
  }

  // "What's in my area" — show only markers matching a free-text query
  // (postcode, GSP, region, provider…). Empty query restores all.
  OET._map = map;
  OET.applyFilter = function (q) {
    const query = String(q || '').trim().toLowerCase();
    const shown = [];
    for (const { marker, group, hay } of markers) {
      const match = !query || hay.indexOf(query) !== -1;
      if (match) { group.addLayer(marker); shown.push(marker.getLatLng()); }
      else group.removeLayer(marker);
    }
    if (query && shown.length) map.fitBounds(shown, { padding: [40, 40], maxZoom: 9 });
    const info = document.getElementById('info');
    if (info) info.textContent = `${shown.length}/${markers.length} point(s)${query ? ` matching “${query}”` : ''}`;
  };

  // Fit to the data when it's regional; for globe-spanning data a fit would
  // centre on the antimeridian and push continents off-screen, so show the world.
  if (allLatLngs.length) {
    const lngs = allLatLngs.map((p) => p[1]);
    const span = Math.max.apply(null, lngs) - Math.min.apply(null, lngs);
    if (span <= 150) map.fitBounds(allLatLngs, { padding: [40, 40], maxZoom: 7 });
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
    info.textContent = `${plans.length} plan(s) · ${mapped} point(s) mapped · `
      + `${unmapped} with no resolvable coverage · data: ${meta.source}`;
  }
  return map;
};

OET.main = async function () {
  const { entries, source } = await OET.loadPlans();
  OET.renderMap(entries, { source });
};
