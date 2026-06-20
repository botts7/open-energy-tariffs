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
| `geo.js` | resolve `meta.coverage` → map points + type (built-in centroid tables) |
| `boundaries.js` | optional: load real boundary GeoJSON → exact coverage polygons |
| `polygons.js` | derive coverage polygons **from postcode points** via Voronoi (no boundary files) |
| `render.js` | draw **areas** (exact polygon if bundled, else Voronoi-from-postcodes, else circle) coloured by rate; canvas renderer; exposes `PLANS`/`focusPlan`/`applyPlanFilter` |
| `sidebar.js` | browse + filter plans (country / source / provider / price / text); list drives the map; click a plan to zoom to its coverage |
| `sample.js` | embedded fallback data (the 3 real captures) |

## How coverage is plotted

Each plan is drawn as an **area**, coloured by rate:

1. **Exact polygon** — if boundary GeoJSON is bundled under `map/boundaries/`
   (`boundaries.js` + a `manifest.json`), the plan's true coverage area is shaded
   (a real choropleth). Sources to populate it:
   - AU `coverage.postcodes` → ABS POA 2021 boundaries
   - UK `coverage.gsp` → DNO licence-area GeoJSON (14 regions)
   - US `coverage.utilityId` (`eiaid`) → EIA/HIFLD service territories
2. **Derived polygon (Voronoi)** — with no boundary bundled, postcodes are turned
   into real polygons by a Voronoi tessellation (`polygons.js`): each postcode
   point claims the area nearest to it, and the plan's coverage is the union of
   those cells. No boundary files needed — just the postcode→lat/lng points. It's
   an approximation (bounding-box-clipped here) that sharpens as you feed more
   points; feed a whole country's postcodes for near-real cells.
3. **Area circle** — GSP/utility coverage (a single region centroid) is drawn as a
   circle sized to the region.

Unknown coverage keys are skipped and counted (never silently dropped — see the
info bar). Adding real boundaries changes only `boundaries/`; the rest is unchanged.

## Hosting on GitHub Pages

`.github/workflows/pages.yml` does this: it `npm run build`s the bundle (because
`dist/` is git-ignored) and publishes `map/` + `dist/` + `index.json` to Pages, so
the **deployed map shows every imported plan** (live `dist/`), not the bundled
sample. Enable it once in **Settings → Pages → Source: GitHub Actions**.

> The deployed map only shows plans that are committed to `tariffs/` **and** carry
> `meta.coverage`. Run the importers (e.g. across the AER retailer base URIs) to
> populate it. See `ARCHITECTURE.md` §5.

## Notes

- Markers are coloured by a representative rate (ToU peak, else flat) in the
  plan's **local currency** — cross-currency colours aren't directly comparable.
- Popups HTML-escape all plan/provider text (community data is untrusted).
