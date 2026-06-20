# map/boundaries/ — exact coverage polygons (optional)

Drop real boundary GeoJSON here and the map shades the **exact** area a plan
covers (a true choropleth) instead of the Voronoi/circle approximation. Absent =
graceful fallback (the map still works).

## Layout

```
boundaries/
  manifest.json              # { "gsp": {"_A":"uk-dno/_A.geojson"}, "utility": {...}, "postcode": {...} }
  uk-dno/_A.geojson          # WGS84 (EPSG:4326) Feature/FeatureCollection
  us-utility/14006.geojson
  au-poa/4306.geojson
```

`boundaries.js` fetches `manifest.json` then each referenced file, and
`OET.boundaryFor(coverage)` returns the matching polygon(s). Files **must be
WGS84 (lat/lng)** — Leaflet can't draw projected coordinates.

## Building them

`scripts/build-boundaries.mjs` fetches official boundary GeoJSON, **reprojects to
WGS84**, simplifies, and writes the files + manifest. It runs in CI (the `pages`
workflow, optional/continue-on-error) or locally:

```sh
npm i -D proj4
UK_DNO_GEOJSON_URL="<NESO DNO GeoJSON resource URL>" node scripts/build-boundaries.mjs
```

Before first run, confirm in `scripts/build-boundaries.mjs` (marked TODO): the
source URL, the GeoJSON property holding the region name, and the name→key map.

## Sources & licences (track in ../../LICENSING.md)

| Coverage | Source | Projection | Licence / attribution |
|---|---|---|---|
| `gsp` (UK DNO) | NESO "GB DNO Licence Areas with GeoJSON" | EPSG:27700 → reproject | NESO open data — attribute NESO |
| `utility` (US) | EIA / HIFLD "Electric Retail Service Territories" | EPSG:4326 | US public domain (cite EIA/HIFLD) |
| `postcode` (AU) | ABS POA 2021 boundaries | EPSG:4326/3857 | CC BY 4.0 — attribute ABS |

Adding a source adds an attribution obligation — record it in `LICENSING.md` and
surface it in the map's attribution control (`render.js`).
