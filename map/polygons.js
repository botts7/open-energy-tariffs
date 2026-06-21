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

// AGGREGATION: collapse a plan's many postcode centroids into ONE outline so the
// map draws 1 ring/plan instead of 1/postcode (a plan covering 200 postcodes was
// 200 rings → at 1000+ plans that's 200k+ rings and the canvas chokes). Andrew's
// monotone-chain convex hull over [lng,lat]; returned as a single [lat,lng] ring.
// Slightly buffered outward (discPolygon-style) so tight/collinear clusters still
// have area. Returns null if < 3 distinct points (caller falls back to circles).
OET.convexHull = function (latlngs, padDeg) {
  if (!latlngs || latlngs.length < 3) return null;
  // dedupe + to [lng,lat]
  const seen = new Set();
  const pts = [];
  for (const p of latlngs) {
    const x = p[1], y = p[0], k = x.toFixed(4) + ',' + y.toFixed(4);
    if (!seen.has(k)) { seen.add(k); pts.push([x, y]); }
  }
  if (pts.length < 3) return null;
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  let hull = lower.slice(0, -1).concat(upper.slice(0, -1)); // [lng,lat] CCW
  if (hull.length < 3) return null;
  // optional outward buffer around centroid so thin hulls keep some area
  const pad = padDeg == null ? 0.04 : padDeg;
  if (pad > 0) {
    let cx = 0, cy = 0; for (const h of hull) { cx += h[0]; cy += h[1]; }
    cx /= hull.length; cy /= hull.length;
    hull = hull.map(([x, y]) => {
      const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1e-9;
      return [x + (dx / len) * pad, y + (dy / len) * pad];
    });
  }
  return hull.map(([x, y]) => [y, x]); // -> [lat,lng]
};

// ONE postcode's area polygon: its Voronoi cell among nearby postcode centroids
// (clipped to a disc so a rural postcode with distant neighbours stays bounded).
// `center`=[lat,lng] of the searched postcode; `neighbors`=[[lat,lng],...] around
// it. Returns a single ring [[lat,lng],...] or null.
OET.postcodePolygon = function (center, neighbors, radiusDeg) {
  if (!window.d3 || !d3.Delaunay || !center) return null;
  radiusDeg = radiusDeg == null ? 0.28 : radiusDeg;
  const pts = [[center[1], center[0]]].concat((neighbors || []).map((p) => [p[1], p[0]])); // [lng,lat], center = index 0
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]); const m = radiusDeg + 0.05;
  const bbox = [Math.min.apply(null, xs) - m, Math.min.apply(null, ys) - m, Math.max.apply(null, xs) + m, Math.max.apply(null, ys) + m];
  try {
    const cell = d3.Delaunay.from(pts).voronoi(bbox).cellPolygon(0); // the searched postcode's cell
    if (!cell) return null;
    const clipped = clipPolygon(cell.map((c) => [c[0], c[1]]), discPolygon(pts[0], radiusDeg, 32));
    if (clipped.length < 3) return null;
    return clipped.map((c) => [c[1], c[0]]); // -> [lat,lng]
  } catch (_) { return null; }
};

// CONCAVE hull (alpha shape) — hugs the postcodes instead of the convex blob a
// `convexHull` draws (which fills bays/ocean). Build the Delaunay triangulation,
// drop triangles with an over-long edge (longer than `factor`× the median edge,
// so it adapts to local density), then the outline of the surviving triangles is
// the concave boundary. Returns an array of rings ([[lat,lng],...]); a sparse set
// can yield several disjoint rings. Falls back to convexHull on failure.
OET.concaveHull = function (latlngs, factor) {
  if (!window.d3 || !d3.Delaunay || !latlngs || latlngs.length < 3) return null;
  factor = factor == null ? 2.4 : factor;
  // dedupe -> [lng,lat]
  const seen = new Set(); const pts = [];
  for (const p of latlngs) { const x = p[1], y = p[0], k = x.toFixed(4) + ',' + y.toFixed(4); if (!seen.has(k)) { seen.add(k); pts.push([x, y]); } }
  if (pts.length < 3) return null;
  let tris;
  try { tris = d3.Delaunay.from(pts).triangles; } catch (_) { return null; }
  const elen = (i, j) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
  // median edge length over all triangle edges
  const lens = [];
  for (let t = 0; t < tris.length; t += 3) { lens.push(elen(tris[t], tris[t + 1]), elen(tris[t + 1], tris[t + 2]), elen(tris[t + 2], tris[t])); }
  if (!lens.length) return null;
  lens.sort((a, b) => a - b);
  const median = lens[lens.length >> 1] || 0.0001;
  const maxEdge = median * factor;
  // boundary = undirected edges used by exactly one KEPT triangle
  const edges = new Map(); // "a,b" (a<b) -> count
  const key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t], b = tris[t + 1], c = tris[t + 2];
    if (elen(a, b) > maxEdge || elen(b, c) > maxEdge || elen(c, a) > maxEdge) continue; // drop long tri
    for (const [u, v] of [[a, b], [b, c], [c, a]]) { const k = key(u, v); edges.set(k, (edges.get(k) || 0) + 1); }
  }
  // adjacency of boundary edges
  const adj = new Map();
  for (const [k, n] of edges) { if (n !== 1) continue; const [u, v] = k.split(',').map(Number); (adj.get(u) || adj.set(u, []).get(u)).push(v); (adj.get(v) || adj.set(v, []).get(v)).push(u); }
  if (!adj.size) return null;
  // stitch into rings
  const used = new Set(); const rings = [];
  for (const start of adj.keys()) {
    if (used.has(start) && (adj.get(start) || []).every((n) => used.has(key(start, n) + 'e'))) continue;
    let cur = start, prev = -1; const ring = []; let guard = 0;
    while (cur != null && guard++ < pts.length * 4) {
      ring.push(pts[cur]);
      const nbrs = adj.get(cur) || [];
      let next = null;
      for (const n of nbrs) { if (n !== prev && !used.has(key(cur, n) + 'e')) { next = n; break; } }
      if (next == null) { for (const n of nbrs) { if (!used.has(key(cur, n) + 'e')) { next = n; break; } } }
      if (next == null) break;
      used.add(key(cur, next) + 'e');
      prev = cur; cur = next;
      if (cur === start) break;
    }
    if (ring.length >= 3) rings.push(ring.map(([x, y]) => [y, x])); // -> [lat,lng]
  }
  return rings.length ? rings : null;
};

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
