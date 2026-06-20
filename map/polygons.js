// Build coverage polygons FROM POINTS — no boundary files needed.
//
// Given a plan's postcode centroids, a Voronoi tessellation gives each point the
// area nearest to it; the plan's coverage is the union of those cells. This turns
// point data (cheap, freely available — e.g. a postcode→lat/lng list) into real
// shaded areas. It's an approximation of true postal boundaries, sharpening as
// more points are supplied (per-plan here; feed ALL a country's postcodes for
// near-real cells). Uses d3-delaunay (CDN); falls back gracefully if absent.
window.OET = window.OET || {};

// latlngs: [[lat,lng],...] -> array of polygon rings ([[lat,lng],...]) , one per
// point, clipped to the points' bounding box + `pad` degrees.
OET.voronoiPolygons = function (latlngs, pad) {
  if (!window.d3 || !d3.Delaunay || !latlngs || !latlngs.length) return [];
  pad = pad == null ? 0.06 : pad;
  const pts = latlngs.map(function (p) { return [p[1], p[0]]; }); // [lng,lat]
  const xs = pts.map(function (p) { return p[0]; });
  const ys = pts.map(function (p) { return p[1]; });
  const bbox = [Math.min.apply(null, xs) - pad, Math.min.apply(null, ys) - pad,
    Math.max.apply(null, xs) + pad, Math.max.apply(null, ys) + pad];
  try {
    const vor = d3.Delaunay.from(pts).voronoi(bbox);
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const cell = vor.cellPolygon(i);
      if (cell) out.push(cell.map(function (c) { return [c[1], c[0]]; })); // -> [lat,lng]
    }
    return out;
  } catch (_) {
    return [];
  }
};
