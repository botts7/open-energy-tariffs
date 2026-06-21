# Tariff data sources (research)

There is **no single complete global tariff database**. Coverage is fragmented
by country, and "a plan" comes in two fundamentally different shapes:

- **STATIC** — fixed bands (flat / time-of-use / EV-night / seasonal). These can
  be stored as presets in this repo.
- **DYNAMIC** — wholesale / half-hourly market price. There are *no* fixed bands;
  the price is read **live**. These should be consumed from the user's existing
  Home Assistant price entity, **not** stored here.

## STATIC sources — importable into presets

| Source | Coverage | Auth | Shape | Licence / redistribution |
|---|---|---|---|---|
| **OpenEI URDB** (NREL) | ~50k rates, **US-heavy**, some intl | API key (api.data.gov, free) | `energyratestructure` (periods/tiers) + `energyweekday/weekendschedule` (12×24 month×hour band matrices) + seasonal | **CC0** (OpenEI platform: "Creative Commons Zero unless otherwise noted") → **bulk-store OK**, no attribution required. Caveat: user-submitted entries → keep `verified:false` until checked. |
| **AU Consumer Data Right — Energy** | **Australia, all NECF retailers + VIC** (incl. AGL) | **none** (public, no accreditation) | "Get Generic Plans" / "…Detail" → singleRate / timeOfUseRates / demand / controlledLoad / solarFiT | **Public CDR Product Reference Data** (AER, recorded `other`) → **bulk-store OK with attribution**. AER + Vic DEECA are the designated data holders. **Best fit for AU** (your own plan). |
| **Octopus Energy API** | UK | none for product/tariff listing | products → standard-unit-rates (incl. Go EV windows, Economy 7) by GSP region | **No open licence** — ToS forbids distributing site/app content → **on-device import only** (+ CC0 community examples). Do NOT bulk-republish. |

### AU-CDR — pinned endpoints (Phase 1, confirmed 2026-06-20)

- **Host (AER central generic-plans feed):** `https://cdr.energymadeeasy.gov.au/`
  — same data behind Energy Made Easy + Victoria Energy Compare; covers AGL and
  every retailer in NECF jurisdictions (NSW, QLD, SA, ACT, TAS) + VIC.
- **Get Generic Plans:** `GET /cds-au/v1/energy/plans` (paginated; `type`,
  `fuelType=ELECTRICITY`, `page`, `page-size` query params).
- **Get Generic Plan Detail:** `GET /cds-au/v1/energy/plans/{planId}` — returns the
  full rate structure (`tariffPeriod` → `singleRate` / `timeOfUseRates` /
  `demandCharges` / `controlledLoad` / `solarFeedInTariff`, plus `dailySupplyCharges`).
- **Required header:** `x-v: 1` (CDR API versioning). **No auth.**
- **Per-retailer base URIs** (when querying a retailer as its own data holder, vs
  the AER central feed): AER publishes the list — *"Consumer Data Right - Energy
  Retailer Base URIs and CDR Brands"* (aer.gov.au). Community-maintained endpoint
  list: `github.com/jxeeno/energy-cdr-prd-endpoints`. The importer resolves base
  URIs from the AER list at build time; the AER central feed alone covers v1.

## Geographic coverage (for mapping)

Each source exposes a geo key, captured into `meta.coverage` so a plan can be
plotted on a map (join to published boundary data):

| Source | `meta.coverage` field | Join to |
|---|---|---|
| AU-CDR | `postcodes` / `exclude` (from `geography.includedPostcodes`/`excludedPostcodes`) | ABS POA postcode polygons |
| Octopus | `gsp` (Grid Supply Point group `_A.._P`; postcode→GSP via `/v1/industry/grid-supply-points/?postcode=`) | DNO licence-area GeoJSON (14 regions) |
| URDB | `utilityId` (`eiaid`) | EIA/HIFLD "Electric Retail Service Territories" shapefile |

## International (IURDB)

The URDB importer is **country-agnostic** — it derives `meta.country` from each
item's `country` (name → ISO-2) rather than assuming US, so it ingests IURDB
international items too. **Caveat:** the live OpenEI `utility_rates` API
(`version=latest`) is **US-only in practice today** (a `country=` filter returns
nothing for non-US). International coverage needs the IURDB **bulk dump**
(apps.openei.org/IURDB) fed through the same `mapRate()` — the code is ready; the
data path isn't wired to the live API.

## DYNAMIC sources — consume live, do NOT store as presets

| Source | Coverage | Consume via |
|---|---|---|
| **Amber Electric** | AU real-time wholesale | HA `Amber` integration → live price entity |
| **Tibber** | Nordics, DE, NL | HA `Tibber` integration |
| **Nord Pool / ENTSO-E** | Europe day-ahead spot | HA `Nordpool` integration / ENTSO-E API (token) |
| **aWATTar** | DE / AT hourly | HA `aWATTar` integration |
| **Octopus Agile** | UK half-hourly | Octopus API (half-hourly) |

## Global expansion (researched 2026-06-21)

Openly-licensed **structured** residential-plan data is rare worldwide. Map of the
landscape so we scale on solid ground:

### Tier 1 — open, structured, importable (have/priority)
| Region | Source | Licence | Status |
|---|---|---|---|
| AU | AER CDR (all retailers) | CDR PRD (public, `other`) | ✅ importer — widen via `run-au.mjs` |
| US + intl | OpenEI URDB / IURDB | CC0 | ✅ importer — widen via `run.mjs`; IURDB country-agnostic |

### Tier 2 — regulator-published structures → hand-curate as CC0 facts
These publish the *structure* (no open API), so curate community entries:
- **France** — EDF **Tarif Bleu** (Base flat / HC-HP two-rate) ✅ curated, and
  **Tempo** (blue/white/red days — day-type, see schema gap). ✅ curated.
- **Canada** — **Ontario OEB** TOU / Tiered / ULO (seasonal, published); other
  provinces (BC Hydro, Hydro-Québec) similar.
- **South Africa** — **Eskom** Homelight / Homepower / **Homeflex** (TOU),
  NERSA-regulated, published as Excel/PDF (eskom.co.za/tariffs).
- **Brazil** — **ANEEL** open data portal (dadosabertos.aneel.gov.br) publishes
  distributor tariffs — possibly importable (verify format/licence).
- **Singapore** — SP Group regulated tariff (single). **Spain** — PVPC (dynamic) +
  fixed offers. **India / Japan** — SERC / utility tariff orders (PDF; harder).

### Related structured-tariff projects (evaluate licence before reuse)
- **Switzerland** — [`geoimpact/electricity-tariffs`](https://github.com/geoimpact/electricity-tariffs):
  600+ Swiss providers, AI-extracted from PDFs into structured data. Ready dataset
  if the licence permits → could feed a CH importer.
- **[`LBNL-ETA/elecprice`](https://github.com/LBNL-ETA/elecprice)** — a billing
  calculator over the OpenEI/URDB API (tooling, not a new source; validates our
  URDB direction).

### Tier 3 — restricted per-supplier (on-device import only, never stored)
- **UK Octopus** (have on-device importer). **NZ Powerswitch** (Consumer NZ —
  underpins the EA/EMI tariff reports; proprietary, treat like Octopus).

### Out of scope
- **Commercial aggregators** — tounify (19 EU countries, 3,123 tariffs), Prezio,
  RateAcuity (US/CA), FlatPeak, elecz, zylalabs — paid/licensed; not redistributable.
- **Dynamic/wholesale** — ENTSO-E, EPEX, euenergy.live, Octopus Agile (consume live).
- **Statistics (averages, not structures)** — Eurostat, SingStat, Bruegel, EIA.

**So "scale across the world" =** (1) max out CDR + URDB/IURDB; (2) hand-curate
Tier-2 regulated tariffs per country; (3) on-device for Tier-3; (4) skip Tier-out.

## Not useful for bands

EIA / Eurostat / ABS publish *average* prices (statistics), not plan structures.

## Design decision

The repo holds **two kinds of static data**:

1. **Community-submitted + verified entries** (CC0) — hand-curated, schema-validated.
2. **Importer scripts** (`/importers/`) that normalise the API sources
   (URDB, AU-CDR, Octopus) into the schema. Where a source's licence is unclear
   for bulk redistribution, the consuming app runs the import **on-device** at
   runtime (fetch from the source's API directly) rather than us republishing it.

Dynamic providers are **out of scope for presets** — document them so apps offer
"use my live HA price entity" instead.

## Resolved (Phase 1, 2026-06-20)

- ✅ **URDB ToS:** CC0 → bulk-store OK (no attribution). **Octopus ToS:** no open
  licence → on-device import only. **AU-CDR:** public CDR Product Reference Data → bulk-store with
  attribution. (See `ARCHITECTURE.md` §6.)
- ✅ **AU-CDR endpoints pinned:** host `cdr.energymadeeasy.gov.au`,
  `GET /cds-au/v1/energy/plans` + `/{planId}`, `x-v: 1`, no auth (see above).
- ✅ **Schema mapping for extensions decided** (`ARCHITECTURE.md` §4 + Appendix A):
  supply charge + solar feed-in are **v1** (`tariff.supply.daily`,
  `tariff.export`); controlled load v1-optional (`tariff.controlledLoad[]`);
  tiered/block + demand charges are **v1.1** (pre-shaped: `band.tiers[]`,
  `tariff.demand[]`).
