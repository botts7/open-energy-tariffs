// Real postcode (Postal Area) boundaries from the ABS, fetched ON DEMAND so we
// never bundle the ~50MB national dataset. Source: ABS ASGS 2021 POA layer on the
// ABS ArcGIS server (CORS: Access-Control-Allow-Origin *). Licence: CC BY 4.0
// (© Commonwealth of Australia, ABS). The 2021 edition is the current ASGS Ed. 3
// (valid to 2026); postcode boundaries change very little year to year.
window.OET = window.OET || {};

OET.POA_SERVICE = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/POA/MapServer/0/query';
OET._poaCache = {}; // pc -> GeoJSON FeatureCollection | null

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
