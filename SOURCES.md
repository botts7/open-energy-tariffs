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
| **OpenEI URDB** (NREL) | ~50k rates, **US-heavy**, some intl | API key (api.data.gov, free) | `energyratestructure` (periods/tiers) + `energyweekday/weekendschedule` (12×24 month×hour band matrices) + seasonal | NREL/public-leaning but **user-submitted entries + ToU apply** — attribute; verify before bulk redistribution. Prefer importer script over bulk copy. |
| **AU Consumer Data Right — Energy** | **Australia, all retailers** (incl. AGL) | none for generic plans | "Get Generic Plans" / "…Detail" → singleRate / timeOfUseRates / demand / controlledLoad / solarFiT | Published under the CDR regime; generally redistributable. **Best fit for AU** (your own plan). |
| **Octopus Energy API** | UK | none for product/tariff listing | products → standard-unit-rates (incl. Go EV windows, Economy 7) by GSP region | Public API; check ToS — prefer per-region on-device import over bulk copy. |

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

## Open questions for the next session

- Confirm URDB + Octopus ToS for redistribution vs on-device-only import.
- Pin the AU-CDR public base URIs / register endpoint for the generic-plans feed.
- Decide schema mapping for: tiered (block) rates, demand charges, controlled
  load, and solar feed-in (the current schema covers flat + ToU + seasonal; these
  are extensions).
