# Coverage map (`map/`)

A static, dependency-free [Leaflet](https://leafletjs.com) viewer that plots each
plan by its `meta.coverage` and colours it by rate. No build step, no framework —
just open it or serve the folder.

![3 demo plans on a world map, coloured by rate](https://example.invalid) <!-- screenshot placeholder -->

## Run

- **Quick look:** open `index.html` directly. Browsers block `fetch()` of a local
  file under `file://`, so it falls back to the **embedded sample** (`sample.js` —
  the three real captured plans). You'll see AU/UK/US markers.
- **Live data:** serve the repo over http so it can fetch the build output:
  ```sh
  npm run build                     # writes dist/canonical/tariffs.json
  python -m http.server 8000        # from the repo root
  # open http://localhost:8000/map/
  ```
  `data.js` tries `../dist/canonical/tariffs.json` first, then the sample.

## Files (modular)

| File | Role |
|---|---|
| `index.html` | shell: Leaflet (CDN), search box, map, legend |
| `data.js` | load the bundle (live `dist/` → embedded sample); pick a representative rate |
| `geo.js` | resolve `meta.coverage` → map points (built-in centroid tables) |
| `render.js` | draw markers (coloured by rate), popups, source toggle, legend, "what's in my area" filter |
| `sample.js` | embedded fallback data (the 3 real captures) |

## How coverage is resolved

`geo.js` ships **demo-grade centroid tables**: all 14 UK GSP groups, a handful of
AU sample postcodes, and one US utility (`eiaid`). Unknown keys are skipped and
counted (never silently dropped — see the info bar).

**Production upgrade:** swap the centroid tables for real boundary GeoJSON and draw
polygons instead of markers (a true choropleth):
- AU `coverage.postcodes` → ABS POA boundaries
- UK `coverage.gsp` → DNO licence-area GeoJSON
- US `coverage.utilityId` (`eiaid`) → EIA/HIFLD "Electric Retail Service Territories"

The plot loop in `render.js` stays the same; only `geo.js` changes.

## Hosting on GitHub Pages

Pages can serve this directly (it's static). Because `dist/` is git-ignored, a
Pages workflow must **build first**, then publish `map/` + `dist/` + `index.json`
together so the live fetch works (otherwise the map quietly uses the bundled
sample). See `ARCHITECTURE.md` §5 (Pages + Releases).

## Notes

- Markers are coloured by a representative rate (ToU peak, else flat) in the
  plan's **local currency** — cross-currency colours aren't directly comparable.
- Popups HTML-escape all plan/provider text (community data is untrusted).
