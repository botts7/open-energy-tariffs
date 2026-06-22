# DK-Energinet importer (Denmark — network tariffs, hourly ToU)

Maps Danish **DatahubPricelist** rows from **Energinet / Energi Data Service** into
canonical v1 entries. The dataset's `Price1..Price24` hourly columns become a
full time-of-use schedule via the shared `hoursToIntervals` RLE helper.

- **What it is:** the **DSO/TSO network tariff** — the per-kWh grid charge applied
  by hour that every consumer pays. This is the **network charge component, not a
  full retail plan** (notes say so on every entry).
- **Licence:** **CC-BY 4.0** (Energinet / Energi Data Service) → `meta.license: "CC-BY-4.0"`,
  attribute Energinet in `meta.notes`.
- **Source / API:** <https://www.energidataservice.dk/tso-electricity/DatahubPricelist>
  (`https://api.energidataservice.dk/dataset/DatahubPricelist`, no auth).

## Run

```
node importers/dk-energinet/run.mjs --chargeType D03 --updated 2026-06-20
```

Writes to `tariffs/DK/national/<owner>/<tariff>.json`.

Run against the live API (no input needed) — currently yields **~24 DSOs'
residential tariffs**.

## How it selects the right rows

The dataset holds one row per (DSO, tariff, validity-period) — heavily historical
**and** future-dated — so `fetch.mjs` does the work:

- `end=<today>` + `sort=ValidFrom desc`, paged in small batches with retry, so the
  first row seen per tariff is the **current** one (latest `ValidFrom ≤ today`,
  `ValidTo` null/future). Stops at a `cutoff` once rows get too old.
- **Consumer filter** (`isConsumerLvHourly`, on by default): keeps only the
  residential low-voltage **"Nettarif C"** (0,4 kV household) tariff — using the
  `Note` field as the authoritative class. Drops commercial **B**/transmission
  **A**, demand charges (`effekt`), self-producer/feed-in, temporary reductions,
  discounts and upstream/HV rows. Pass `consumerOnly:false` to keep everything.
- 24 hourly prices → `tou` bands (Low/High/Peak); a single `Price1` (flat C
  tariff) → a `flat` plan. Plan names come from `Note` (e.g. *"Nettarif C
  (hourly meter)"*).

## Notes / caveats

- This is the **DSO network charge component, not a full retail plan** (every
  entry's `notes` say so). Pairing with the retail energy/elspot supply price is a
  future step.
- The consumer filter is a heuristic over Danish text — eyeball a `--dry` run and
  `npm run validate` before committing a refresh.
