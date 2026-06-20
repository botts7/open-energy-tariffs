# Licensing register

The single place that tracks **every** licence we rely on — data sources, runtime
libraries, map tiles, boundary data, and our own outputs — with the obligation it
imposes and our compliance status. Update this whenever a source or dependency is
added. Display rules + the per-entry model live in [ATTRIBUTION.md](ATTRIBUTION.md);
source research in [SOURCES.md](SOURCES.md).

## 1. Our own outputs

| Artefact | Licence | Notes |
|---|---|---|
| Code / scripts / map | **MIT** | `LICENSE` |
| Community-submitted tariff data | **CC0-1.0** | facts; per-entry `meta.license` |
| Imported tariff data | source's licence | tracked per entry in `meta.license` |

## 2. Tariff data sources

| Source | `meta.source` | Licence | May we redistribute? | Obligation | Status |
|---|---|---|---|---|---|
| AER CDR (AU generic plans) | `cdr` | **CC BY 4.0** | ✅ yes (store + display) | **Attribution** "© AER, CC BY 4.0, not endorsed by AER" wherever shown | ✅ importer + map show it |
| OpenEI URDB / IURDB (US/intl) | `urdb` | **CC0-1.0** | ✅ yes | none (cite OpenEI/NREL as courtesy) | ✅ |
| Octopus Energy (UK) | `octopus` | **No open licence** (ToS forbids distributing content) | ❌ **never** store/redistribute | display only via **on-device runtime fetch**; fixtures/sample use **illustrative** rates | ✅ no real rates committed |
| Community / your own plan | `manual` | **CC0-1.0** | ✅ yes | none | ✅ |

Dynamic providers (Amber, Tibber, Nord Pool, aWATTar, Octopus Agile) are **not
stored** — consumed live from the user's HA price entity (not a licence question).

## 3. Map runtime dependencies (loaded by `map/`)

| Dependency | Licence | How used | Obligation | Status |
|---|---|---|---|---|
| Leaflet (CDN, pinned 1.9.4 + SRI) | **BSD-2-Clause** | map library | keep notice | ✅ |
| d3-delaunay (CDN, pinned 6.0.4 + SRI) | **ISC** | Voronoi polygons | keep notice | ✅ |
| AU postcode centroids (`map/au-postcodes.js`) | **G-NAF Open EULA** (data) / MIT (the [joelkoen/postcodes-au](https://github.com/joelkoen/postcodes-au) tooling) | resolve `coverage.postcodes` → points | **attribution**: "Incorporates G-NAF © Geoscape Australia, licensed by the Commonwealth" (shown in map control) | ✅ attributed |
| World country polygons (`map/world-countries.js`) | **Natural Earth — public domain** | shade `coverage.national` plans by country | none required (credited as courtesy) | ✅ credited |
| OpenStreetMap **tiles** (`tile.openstreetmap.org`) | tiles served under OSM's [tile usage policy](https://operations.osmfoundation.org/policies/tiles/); map **data** ODbL | base map | **attribution** "© OpenStreetMap contributors" (shown); policy = no heavy/commercial use | ✅ attributed · ⚠️ see §6 |

## 4. Boundary data (optional, for exact region polygons — `map/boundaries/`)

Only applies once `scripts/build-boundaries.mjs` is run. **Adding a source adds an
attribution obligation** — record it here and surface it in `render.js`.

| Coverage | Source | Licence | Obligation | Status |
|---|---|---|---|---|
| `gsp` (UK DNO) | NESO "GB DNO Licence Areas" | NESO open data | attribute NESO | ⬜ not yet bundled |
| `utility` (US) | EIA / HIFLD service territories | US Gov public domain | cite EIA/HIFLD | ⬜ not yet bundled |
| `postcode` (AU) | ABS POA 2021 | **CC BY 4.0** | attribute ABS | ⬜ not yet bundled |

## 5. Build / dev dependencies

| Package | Licence | Use |
|---|---|---|
| ajv, ajv-formats | **MIT** | schema validation (CI) |
| proj4 | **MIT** | reproject boundary GeoJSON (optional, CI) |

(Dev only: a one-off Nominatim query was used to *check* polygon availability —
not shipped, not redistributed, within usage limits.)

## 6. Known follow-ups / watch-items

- **OSM tiles at scale:** the public tile server is fine for a demo but its usage
  policy discourages heavy/commercial traffic. For a popular deployed map, switch
  to a proper tile provider (MapTiler/Stadia/Carto/self-host) — attribution stays.
- **Boundary attributions:** when §4 sources are bundled, add their attribution to
  the map control and tick the status here.
- **AER attribution must travel with the data:** any consumer (not just our map)
  that displays `cdr` entries must show the AER CC-BY notice — `meta.notes` carries
  it and `dist` can emit it.

## How we stay within the licences (checklist)

- [x] Per-entry `meta.license`; CI rejects `source: octopus` (never stored) and
      `cdr` without `CC-BY-4.0`.
- [x] No real Octopus rates committed (fixtures/sample use illustrative values).
- [x] AER CC-BY attribution shown in the map; recorded in `meta.notes`.
- [x] CDN libs pinned + SRI; OSM attribution shown.
- [ ] Add boundary-source attributions when bundled (§4).
- [ ] Swap tile provider before high-traffic production (§6).
