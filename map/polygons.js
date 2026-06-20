// Build coverage polygons FROM POINTS — no boundary files needed.
//
// Given a plan's postcode centroids, a Voronoi tessellation gives each point the
// area nearest to it; each cell is then clipped to a DISC around its point so the
// result is organic (rounded), not a bounding-box rectangle. The plan's coverage
// is the union of those rounded cells. Turns cheap point data (a postcode→lat/lng
// list) into real shaded areas. Approximation that sharpens with more points
// (feed a whole country's postcodes for near-real cells). Uses d3-delaunay (CDN).
window.OET = window.OET || {};

// Sutherland–Hodgman: clip a subject polygon by a convex clip polygon. Points are
// [x,y] = [lng,lat]; clip polygon is CCW.
function clipPolygon(subject, clip) {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const A = clip[i], B = clip[(i + 1) % clip.length];
    const input = out; out = [];
    const inside = (P) => (B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0]) >= 0;
    const isect = (P, Q) => {
      const d = ((B[0] - A[0]) * (P[1] - Q[1]) - (B[1] - A[1]) * (P[0] - Q[0])) || 1e-12;
      const t = ((B[0] - A[0]) * (P[1] - A[1]) - (B[1] - A[1]) * (P[0] - A[0])) / d;
      return [P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])];
    };
    for (let j = 0; j < input.length; j++) {
      const P = input[j], Q = input[(j + 1) % input.length];
      const Pin = inside(P), Qin = inside(Q);
      if (Pin) { out.push(P); if (!Qin) out.push(isect(P, Q)); }
      else if (Qin) { out.push(isect(P, Q)); }
    }
  }
  return out;
}

// A CCW many-sided polygon approximating a disc of `radiusDeg` (lat degrees)
// around [lng,lat], corrected for longitude convergence so it's round on the map.
function discPolygon(site, radiusDeg, sides) {
  const ry = radiusDeg;
  const rx = radiusDeg / Math.max(0.1, Math.cos(site[1] * Math.PI / 180));
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides;
    ring.push([site[0] + rx * Math.cos(a), site[1] + ry * Math.sin(a)]);
  }
  return ring;
}

// latlngs: [[lat,lng],...] -> array of polygon rings ([[lat,lng],...]), one per
// point: its Voronoi cell clipped to a disc of `radiusDeg` (≈ coverage reach).
OET.voronoiPolygons = function (latlngs, radiusDeg) {
  if (!window.d3 || !d3.Delaunay || !latlngs || !latlngs.length) return [];
  radiusDeg = radiusDeg == null ? 0.12 : radiusDeg; // ~13 km
  const pts = latlngs.map((p) => [p[1], p[0]]); // [lng,lat]
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const m = radiusDeg + 0.05;
  const bbox = [Math.min.apply(null, xs) - m, Math.min.apply(null, ys) - m,
    Math.max.apply(null, xs) + m, Math.max.apply(null, ys) + m];
  try {
    const vor = d3.Delaunay.from(pts).voronoi(bbox);
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const cell = vor.cellPolygon(i);
      if (!cell) continue;
      const clipped = clipPolygon(cell.map((c) => [c[0], c[1]]), discPolygon(pts[i], radiusDeg, 28));
      if (clipped.length >= 3) out.push(clipped.map((c) => [c[1], c[0]])); // -> [lat,lng]
    }
    return out;
  } catch (_) {
    return [];
  }
};
