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
| AU postcode centroids + suburb→postcode (`map/au-postcodes.js`, `map/au-suburbs.js`) | **G-NAF Open EULA** (data) / MIT (the [joelkoen/postcodes-au](https://github.com/joelkoen/postcodes-au) tooling) | resolve `coverage.postcodes` → points; suburb search | **attribution**: "Incorporates G-NAF © Geoscape Australia, licensed by the Commonwealth" (shown in map control) | ✅ attributed |
| World country + province polygons (`map/world-countries.js`, `map/provinces.js`) | **Natural Earth — public domain** | shade `coverage.national` plans by country / province | none required (credited as courtesy) | ✅ credited |
| World Bank income/PPP reference (`map/income.js`: PPP factor `PA.NUS.PPP` + GNI/capita PPP `NY.GNP.PCAP.PP.CD`) | **CC BY 4.0** (World Bank Open Data) | PPP-adjusted + affordability lenses in the country ranking | **attribution** "Income/PPP: World Bank (CC BY 4.0)" (shown in the ranking panel) | ✅ attributed |
| Eurostat household electricity prices (`map/baseline.js`: `nrg_pc_204`, band DC, all-taxes-incl, EUR/kWh) | **CC BY 4.0** (Eurostat / European Union) | reference baseline + cross-validation (✓/⚠ ref) in the ranking | **attribution** "Baseline: Eurostat nrg_pc_204 (CC BY 4.0)" (shown in the ranking panel) | ✅ attributed |
| Foreign-exchange snapshot (`map/fx.js`, dated, build-baked) | rates are **facts** (uncopyrightable); source acknowledged | USD-equiv colour buckets + nominal ranking lens | source "exchangerate-api.com" + `FX_AS_OF` date shown | ✅ attributed |
| OpenStreetMap **tiles** (`tile.openstreetmap.org`) | tiles served under OSM's [tile usage policy](https://operations.osmfoundation.org/policies/tiles/); map **data** ODbL | base map (Street) | **attribution** "© OpenStreetMap contributors" (shown); policy = no heavy/commercial use | ✅ attributed · ⚠️ see §6 |
| CARTO **tiles** (`basemaps.cartocdn.com`, light) | CARTO basemaps, free tier; data ODbL/OSM | base map (Light) | **attribution** "© OpenStreetMap, © CARTO" (shown); free-tier limits | ✅ attributed · ⚠️ see §6 |
| Esri World Imagery **tiles** (`server.arcgisonline.com`) | Esri ArcGIS Online basemap, free for non-commercial web maps | base map (Satellite) | **attribution** "Tiles © Esri" (shown); check Esri terms for commercial use | ✅ attributed · ⚠️ see §6 |
| **ABS POA 2021** postcode boundaries (`geo.abs.gov.au` ArcGIS, fetched on demand) | **CC BY 4.0** (© Commonwealth of Australia, ABS) | real postcode polygon + real plan coverage on focus | **attribution** "© ABS POA 2021 (CC BY 4.0)" (shown) | ✅ attributed |
| **Nominatim / OSM** address geocoding (`nominatim.openstreetmap.org`, button/Enter fallback) | data ODbL; Nominatim [usage policy](https://operations.osmfoundation.org/policies/nominatim/) (low volume, identify via Referer, **on-submit only — NO autocomplete**) | resolve a typed street address → postcode + pin | **attribution** "Address search: Nominatim/OSM" (shown) | ✅ attributed · ⚠️ see §6 |
| **Photon (Komoot) / OSM** address autocomplete (`photon.komoot.io`, debounced typeahead) | data ODbL; Photon is free + built for autocomplete (the per-keystroke path Nominatim forbids) | live address suggestions as the user types | data © OpenStreetMap contributors (covered by the OSM attribution shown); free public instance — heavy/commercial use should self-host | ✅ attributed · ⚠️ see §6 |

## 4. Boundary data (optional, for exact region polygons — `map/boundaries/`)

Only applies once `scripts/build-boundaries.mjs` is run. **Adding a source adds an
attribution obligation** — record it here and surface it in `render.js`.

| Coverage | Source | Licence | Obligation | Status |
|---|---|---|---|---|
| `gsp` (UK DNO) | NESO "GB DNO Licence Areas" | NESO open data | attribute NESO | ⬜ not yet bundled |
| `utility` (US) | EIA / HIFLD service territories | US Gov public domain | cite EIA/HIFLD | ⬜ not yet bundled |
| `postcode` (AU) | ABS POA 2021 | **CC BY 4.0** | attribute ABS | ✅ used LIVE on demand (not bundled) — see §3 |

## 5. Build / dev dependencies

| Package | Licence | Use |
|---|---|---|
| ajv, ajv-formats | **MIT** | schema validation (CI) |
| proj4 | **MIT** | reproject boundary GeoJSON (optional, CI) |

(Nominatim is now also a SHIPPED runtime feature — address search — see §3. Used
on explicit submit only, within the usage policy, attributed in the map.)

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
