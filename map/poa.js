// Real postcode (Postal Area) boundaries from the ABS, fetched ON DEMAND so we
// never bundle the ~50MB national dataset. Source: ABS ASGS 2021 POA layer on the
// ABS ArcGIS server (CORS: Access-Control-Allow-Origin *). Licence: CC BY 4.0
// (© Commonwealth of Australia, ABS). The 2021 edition is the current ASGS Ed. 3
// (valid to 2026); postcode boundaries change very little year to year.
window.OET = window.OET || {};

OET.POA_SERVICE = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/POA/MapServer/0/query';
OET._poaCache = {};    // pc -> GeoJSON FeatureCollection | null
OET._poaCovCache = {}; // sorted-postcode-set -> FeatureCollection | null

// Real coverage for a whole plan: the ABS POA polygons for ALL its postcodes
// (one FeatureCollection). Batched IN-queries (URL length) + server-side
// simplification (maxAllowableOffset) so a 300-postcode network stays light.
// Used on demand when a plan is focused — NOT for every plan at once (that's the
// 228k-polygon wall that froze the map; the overview uses concave hulls).
OET.fetchPoaCoverage = function (postcodes) {
  const codes = (postcodes || []).filter((c) => /^\d{4}$/.test(String(c)));
  if (!codes.length) return Promise.resolve(null);
  const key = codes.slice().sort().join(',');
  if (OET._poaCovCache[key] !== undefined) return Promise.resolve(OET._poaCovCache[key]);
  const batches = [];
  for (let i = 0; i < codes.length; i += 100) batches.push(codes.slice(i, i + 100));
  const reqs = batches.map((b) => {
    const where = encodeURIComponent('poa_code_2021 IN (' + b.map((c) => "'" + c + "'").join(',') + ')');
    const url = OET.POA_SERVICE + '?where=' + where
      + '&outFields=poa_code_2021&returnGeometry=true&outSR=4326&geometryPrecision=4&maxAllowableOffset=0.002&f=geojson';
    return fetch(url, { cache: 'force-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  });
  return Promise.all(reqs).then((parts) => {
    const feats = [];
    for (const p of parts) if (p && p.features) feats.push.apply(feats, p.features);
    const fc = feats.length ? { type: 'FeatureCollection', features: feats } : null;
    OET._poaCovCache[key] = fc;
    return fc;
  });
};

// Returns a Promise of the postcode's GeoJSON (FeatureCollection) or null.
OET.fetchPoaBoundary = function (pc) {
  if (!/^\d{4}$/.test(String(pc))) return Promise.resolve(null);
  if (OET._poaCache[pc] !== undefined) return Promise.resolve(OET._poaCache[pc]);
  const where = encodeURIComponent("poa_code_2021='" + pc + "'");
  const url = OET.POA_SERVICE + '?where=' + where
    + '&outFields=poa_code_2021&returnGeometry=true&outSR=4326&geometryPrecision=5&f=geojson';
  return fetch(url, { cache: 'force-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((g) => {
      const ok = g && g.features && g.features.length ? g : null;
      OET._poaCache[pc] = ok;
      return ok;
    })
    .catch(() => { OET._poaCache[pc] = null; return null; });
};
