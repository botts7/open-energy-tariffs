// Build real coverage-boundary polygons for the map: fetch official boundary
// GeoJSON, reproject to WGS84 (lat/lng), simplify, and write per-key files +
// map/boundaries/manifest.json so the map shades EXACT regions (not circles).
//
// ⚠️ Runs in CI / locally (needs network + the proj4 dep) — NOT in the assistant's
// sandbox (no network to the data portals, no reprojection lib). It is OPTIONAL:
// if it fails or is skipped, the map falls back to area-circles. Enable proj4:
//   npm i -D proj4
// then: node scripts/build-boundaries.mjs
//
// CONFIRM before first run (marked TODO): the SOURCE url, the GeoJSON property
// that names each region, and the name→key mapping. Sources:
//   UK DNO/GSP : NESO "GB DNO Licence Areas with GeoJSON" (EPSG:27700)
//                https://www.neso.energy/data-portal/gis-boundaries-gb-dno-license-areas
//   US utility : EIA/HIFLD "Electric Retail Service Territories" (eiaid -> polygon)
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'map', 'boundaries');

// DNO licence area -> GSP group letter (the `coverage.gsp` value, leading _).
// Keyed by a normalised region name; adjust `regionName()` to the source's field.
const DNO_TO_GSP = {
  'east england': '_A', 'eastern': '_A',
  'east midlands': '_B',
  'london': '_C',
  'north wales merseyside': '_D', 'merseyside and north wales': '_D',
  'west midlands': '_E',
  'north east': '_F', 'north east england': '_F',
  'north west': '_G', 'north west england': '_G',
  'southern': '_H', 'southern england': '_H',
  'south east': '_J', 'south east england': '_J',
  'south wales': '_K',
  'south west': '_L', 'south west england': '_L',
  'yorkshire': '_M',
  'south scotland': '_N', 'southern scotland': '_N',
  'north scotland': '_P', 'northern scotland': '_P',
};

const SOURCES = {
  ukGsp: {
    // TODO confirm the direct GeoJSON resource download URL from the NESO portal.
    url: process.env.UK_DNO_GEOJSON_URL || '',
    crs: 'EPSG:27700',
    kind: 'gsp',
    // TODO confirm: which feature property holds the area name.
    nameProp: 'Name',
    keyFor: (name) => DNO_TO_GSP[normalise(name)],
  },
  // usUtility: { url: ..., crs: 'EPSG:4326', kind: 'utility', keyFor: f => String(f.eiaid) }
};

const normalise = (s) => String(s || '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

// Minimal Douglas–Peucker for one ring of [lng,lat].
function simplifyRing(ring, tol) {
  if (ring.length < 4) return ring;
  const sqd = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    return (p[0] - x) ** 2 + (p[1] - y) ** 2;
  };
  const keep = new Array(ring.length).fill(false);
  keep[0] = keep[ring.length - 1] = true;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let idx = -1, max = tol * tol;
    for (let i = a + 1; i < b; i++) { const d = sqd(ring[i], ring[a], ring[b]); if (d > max) { idx = i; max = d; } }
    if (idx > -1) { keep[idx] = true; stack.push([a, idx], [idx, b]); }
  }
  return ring.filter((_, i) => keep[i]);
}

async function buildSource(proj4, name, cfg) {
  if (!cfg.url) { console.warn(`skip ${name}: no URL configured`); return {}; }
  const res = await fetch(cfg.url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const fc = await res.json();
  const reproj = cfg.crs && cfg.crs !== 'EPSG:4326'
    ? (xy) => proj4(cfg.crs, 'EPSG:4326', xy) : (xy) => xy;
  const mapCoords = (g) => {
    const f = (c) => (typeof c[0] === 'number' ? simplify1(reproj(c)) : c.map(f));
    const simplify1 = (xy) => xy; // points pass through; rings simplified below
    if (g.type === 'Polygon') g.coordinates = g.coordinates.map((r) => simplifyRing(r.map(reproj), 0.005));
    else if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map((p) => p.map((r) => simplifyRing(r.map(reproj), 0.005)));
    return g;
  };
  const manifest = {};
  await mkdir(join(outDir, name), { recursive: true });
  for (const feat of fc.features || []) {
    const key = cfg.keyFor(feat.properties?.[cfg.nameProp] ?? feat.properties);
    if (!key) continue;
    const out = { type: 'Feature', properties: { key }, geometry: mapCoords(feat.geometry) };
    const file = `${name}/${key}.geojson`;
    await writeFile(join(outDir, file), JSON.stringify(out));
    manifest[key] = file;
  }
  return { [cfg.kind]: manifest };
}

const { default: proj4 } = await import('proj4').catch(() => ({ default: null }));
if (!proj4) { console.error('proj4 not installed — run `npm i -D proj4`. Skipping (map uses circles).'); process.exit(0); }
proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs');

const manifest = {};
for (const [name, cfg] of Object.entries(SOURCES)) {
  try { Object.assign(manifest, await buildSource(proj4, name, cfg)); }
  catch (e) { console.warn(`skip ${name}: ${e.message}`); }
}
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('wrote map/boundaries/manifest.json', Object.keys(manifest));
