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

## Notes / verify

- Only rows with all 24 hourly prices are mapped (subscription/abonnement rows are
  a different ChargeType → skipped).
- Bands are ranked cheapest→dearest and named **Low / High / Peak** (≤3 distinct) or
  `Tier N` (more). Uniform prices collapse to a `flat` plan.
- ⚠️ Confirm field names (`ChargeOwner`, `Description`, `ValidFrom`, `Price1..24`)
  and `ChargeType` filter against a live response before committing real data, then
  `npm run validate`.
- Pairing with the retail energy component (e.g. the regulated/elspot supply price)
  is a future step — this importer only covers the regulated grid charge.
