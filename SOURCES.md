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
| **AU Consumer Data Right — Energy** | **Australia, all NECF retailers + VIC** (incl. AGL) | **none** (public, no accreditation) | "Get Generic Plans" / "…Detail" → singleRate / timeOfUseRates / demand / controlledLoad / solarFiT | **CC BY 4.0** (AER) → **bulk-store OK with attribution**. AER + Vic DEECA are the designated data holders. **Best fit for AU** (your own plan). |
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

## DYNAMIC sources — consume live, do NOT store as presets

| Source | Coverage | Consume via |
|---|---|---|
| **Amber Electric** | AU real-time wholesale | HA `Amber` integration → live price entity |
| **Tibber** | Nordics, DE, NL | HA `Tibber` integration |
| **Nord Pool / ENTSO-E** | Europe day-ahead spot | HA `Nordpool` integration / ENTSO-E API (token) |
| **aWATTar** | DE / AT hourly | HA `aWATTar` integration |
| **Octopus Agile** | UK half-hourly | Octopus API (half-hourly) |

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
  licence → on-device import only. **AU-CDR:** CC BY 4.0 → bulk-store with
  attribution. (See `ARCHITECTURE.md` §6.)
- ✅ **AU-CDR endpoints pinned:** host `cdr.energymadeeasy.gov.au`,
  `GET /cds-au/v1/energy/plans` + `/{planId}`, `x-v: 1`, no auth (see above).
- ✅ **Schema mapping for extensions decided** (`ARCHITECTURE.md` §4 + Appendix A):
  supply charge + solar feed-in are **v1** (`tariff.supply.daily`,
  `tariff.export`); controlled load v1-optional (`tariff.controlledLoad[]`);
  tiered/block + demand charges are **v1.1** (pre-shaped: `band.tiers[]`,
  `tariff.demand[]`).
