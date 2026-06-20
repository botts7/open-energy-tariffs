# AU-CDR importer (AER generic plans)

Maps Australian **Consumer Data Right** energy *generic plan* data into the
canonical schema (`schema/v1`). This is the **first importer** and the strongest
data source for AU (no auth, covers AGL + every NECF retailer + VIC).

## Source & licence

- **Host:** per-retailer under the AER, e.g. `https://cdr.energymadeeasy.gov.au/<retailer>`.
  Discover base URIs from the AER *"Energy Retailer Base URIs and CDR Brands"*
  list, or the community list `github.com/jxeeno/energy-cdr-prd-endpoints`.
- **Endpoints:** `GET /cds-au/v1/energy/plans` (**`x-v: 1`**) and
  `GET /cds-au/v1/energy/plans/{planId}` (**`x-v: 3`** — a lower version 406s).
  **No auth.** The base URI includes the retailer code, e.g.
  `https://cdr.energymadeeasy.gov.au/ergon`.
- **Licence:** AER data is **CC BY 4.0**. Imported entries are written with
  `meta.source: "cdr"`, `meta.license: "CC-BY-4.0"`, and the AER attribution
  notice in `meta.notes`. See `../../ATTRIBUTION.md`.

## Files

| File | Role |
|---|---|
| `map.mjs` | **Pure** `mapPlanDetail(detail, {updated}) -> canonical entry` (+ helpers). No I/O — testable, also reusable by the SDK on-device. |
| `fetch.mjs` | `fetchPlans(baseUri)` / `fetchPlanDetail(baseUri, planId)` — sets `x-v:1`. |
| `run.mjs` | Build-time CLI: fetch → map → write under `tariffs/AU/`. |
| `fixtures/` | A **real** capture (Ergon Tariff 12D) + its expected canonical output. |
| `map.test.mjs` | Asserts the mapping, the inclusive→exclusive end-time rule, **and** schema/v1 validity. |

## Run

```sh
npm install
node importers/cdr/run.mjs --base https://cdr.energymadeeasy.gov.au/<retailer> \
     --updated 2026-06-20 [--limit 50] [--dry]
npm run validate    # schema + unique-id + compliance
npm run build       # regenerate dist/ + index.json
```

## Verified against a real capture (2026-06-20)

Tested against a live Ergon plan detail. Real-shape fixes already folded in:
- `tariffPeriod[].dailySupplyCharge` is **singular** (not `dailySupplyCharges`).
- `timeOfUse.endTime` is **inclusive** (`"20:59"` ⇒ exclusive `"21:00"`; wraps
  past midnight are kept as `from > to`).
- Detail endpoint requires **`x-v: 3`**; the list uses `x-v: 1`.
- Solar `singleTariff` carries `rates[].unitPrice` (handled).

Remaining follow-ups (not in the sampled plan): seasonal multi-`tariffPeriod`
(→ `seasons[]` + `band.seasonRates`), time-varying solar export, stepped/
`steppedRate` blocks (→ reserved `band.tiers[]`), demand + controlled load. Add a
fixture for each as you encounter them.
