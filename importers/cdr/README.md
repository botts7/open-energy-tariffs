# AU-CDR importer (AER generic plans)

Maps Australian **Consumer Data Right** energy *generic plan* data into the
canonical schema (`schema/v1`). This is the **first importer** and the strongest
data source for AU (no auth, covers AGL + every NECF retailer + VIC).

## Source & licence

- **Host:** per-retailer under the AER, e.g. `https://cdr.energymadeeasy.gov.au/<retailer>`.
  Discover base URIs from the AER *"Energy Retailer Base URIs and CDR Brands"*
  list, or the community list `github.com/jxeeno/energy-cdr-prd-endpoints`.
- **Endpoints:** `GET /cds-au/v1/energy/plans` and
  `GET /cds-au/v1/energy/plans/{planId}`. **No auth.** Required header **`x-v: 1`**.
- **Licence:** AER data is **CC BY 4.0**. Imported entries are written with
  `meta.source: "cdr"`, `meta.license: "CC-BY-4.0"`, and the AER attribution
  notice in `meta.notes`. See `../../ATTRIBUTION.md`.

## Files

| File | Role |
|---|---|
| `map.mjs` | **Pure** `mapPlanDetail(detail, {updated}) -> canonical entry` (+ helpers). No I/O — testable, also reusable by the SDK on-device. |
| `fetch.mjs` | `fetchPlans(baseUri)` / `fetchPlanDetail(baseUri, planId)` — sets `x-v:1`. |
| `run.mjs` | Build-time CLI: fetch → map → write under `tariffs/AU/`. |
| `fixtures/` | A **synthetic** CDR detail + its expected canonical output. |
| `map.test.mjs` | Asserts the mapping **and** that output validates against `schema/v1`. |

## Run

```sh
npm install
node importers/cdr/run.mjs --base https://cdr.energymadeeasy.gov.au/<retailer> \
     --updated 2026-06-20 [--limit 50] [--dry]
npm run validate    # schema + unique-id + compliance
npm run build       # regenerate dist/ + index.json
```

## ⚠️ Verification gap (read before trusting output)

The mapping was authored from the CDR Energy OpenAPI + docs, **not** exercised
against the live API (the assistant can't send the `x-v` header or run node). The
fixture is **synthetic**. Before relying on bulk-imported entries:

1. Capture a real `GET …/plans/{planId}` response (with `x-v:1`) into
   `fixtures/<retailer>-real.detail.json`.
2. Confirm `map.test.mjs` still matches (esp. **time formats** — CDR `startTime`/
   `endTime` may be `HHmm`, `HH:MM`, or `HH:MM:SS`; `toHHMM` normalises digits) and
   `dailySupplyCharges` (string vs `bandedDailySupplyCharges[]`).
3. Known follow-ups: seasonal multi-`tariffPeriod` plans (→ `seasons[]` +
   `band.seasonRates`), time-varying solar export (currently only `singleTariff`),
   stepped/`steppedRate` blocks (→ reserved `band.tiers[]`), demand charges.
