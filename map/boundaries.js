// Optional real-boundary layer. When boundary GeoJSON is bundled under
// map/boundaries/, the map shades the EXACT area a plan covers (a true
// choropleth) instead of the approximate area-circles.
//
// Populate it (build-time, from official sources) so each coverage key resolves
// to a polygon:
//   - AU postcodes  -> ABS POA 2021 boundaries (data.gov.au)
//   - UK gsp        -> DNO licence-area GeoJSON (14 regions)
//   - US utilityId  -> EIA/HIFLD "Electric Retail Service Territories"
// Drop a manifest at boundaries/manifest.json:
//   { "gsp": { "_A": "uk-dno/_A.geojson" },
//     "utility": { "14006": "us-utility/14006.geojson" },
//     "postcode": { "4306": "au-poa/4306.geojson" } }
// Files are GeoJSON Feature/FeatureCollection. Nothing bundled = graceful
// fallback to area-circles (the map still works offline / on first deploy).
window.OET = window.OET || {};
OET._boundaries = null; // { kind -> key -> geojson }

OET.loadBoundaries = async function (base) {
  const root = (base || 'boundaries').replace(/\/$/, '');
  try {
    const res = await fetch(`${root}/manifest.json`, { cache: 'no-store' });
    if (!res.ok) return false;
    const manifest = await res.json();
    const store = { gsp: {}, utility: {}, postcode: {} };
    const jobs = [];
    for (const kind of Object.keys(store)) {
      for (const [key, path] of Object.entries(manifest[kind] || {})) {
        jobs.push(fetch(`${root}/${path}`).then((r) => r.ok && r.json()).then((g) => { if (g) store[kind][key] = g; }).catch(() => {}));
      }
    }
    await Promise.all(jobs);
    OET._boundaries = store;
    return true;
  } catch (_) {
    return false; // file:// or not provided — area-circles will be used
  }
};

// Return a GeoJSON polygon for a coverage object, or null if none bundled.
OET.boundaryFor = function (coverage) {
  const b = OET._boundaries;
  if (!b || !coverage) return null;
  const feats = [];
  if (coverage.gsp && b.gsp[coverage.gsp]) feats.push(b.gsp[coverage.gsp]);
  if (coverage.utilityId && b.utility[coverage.utilityId]) feats.push(b.utility[coverage.utilityId]);
  for (const pc of coverage.postcodes || []) if (b.postcode[pc]) feats.push(b.postcode[pc]);
  if (!feats.length) return null;
  return { type: 'FeatureCollection', features: feats.flatMap((f) => (f.type === 'FeatureCollection' ? f.features : [f])) };
};
