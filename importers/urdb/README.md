# URDB importer (US) — OpenEI / NREL Utility Rate Database

Maps URDB rate items into the canonical schema. **URDB is CC0**, so output is
**bulk-storable** (`source: urdb`, `license: CC0-1.0`) with an OpenEI/NREL
courtesy citation. URDB has user-submitted entries → output is always
`verified: false` until checked.

## Source

- **API:** `https://api.openei.org/utility_rates` — needs a **free**
  `api.data.gov`/OpenEI key in env `URDB_API_KEY` (never commit it; CI secret).
- **Model:** `energyratestructure` (periods → tiers) + `energyweekdayschedule` /
  `energyweekendschedule` (each a 12×24 month×hour matrix of period indices) +
  `fixedchargefirstmeter`/`fixedchargeunits`.

## Mapping

| URDB | canonical |
|---|---|
| 1 period | `kind: flat`, `import.flatRate` |
| >1 period | `kind: tou`, `import.bands[]` (one per period; first tier only) |
| month×hour schedule | `import.schedule[]` — January row, run-length-encoded into intervals; weekday/weekend collapse to `days: all` when identical |
| `fixedchargefirstmeter` | `supply.daily` (`$/day` as-is; `$/month` ÷ 30.44) |

Not yet modelled (follow-ups): tiered/block (reserved `band.tiers[]`), demand
charges, and **per-month seasonal** variation (a note is added when month rows
differ; January is used).

## Files

| File | Role |
|---|---|
| `map.mjs` | **Pure** `mapRate(item, {state,timezone,updated})`. |
| `fetch.mjs` | `fetchRates(...)` (needs `URDB_API_KEY`). |
| `run.mjs` | Build-time CLI: fetch → map → write `tariffs/US/`. |
| `fixtures/` + `map.test.mjs` | TOU + flat deep-equal, schema conformance, monthly→daily, weekday/weekend split. |

## Run

```sh
URDB_API_KEY=... node importers/urdb/run.mjs \
  --utility "Pacific Gas & Electric Co" --state CA --timezone America/Los_Angeles \
  --updated 2026-06-20 [--limit 50] [--dry]
npm run validate && npm run build
```

## ⚠️ Verification gap

Authored from the URDB model, not run against the live API. Verify against a real
`api.openei.org` item — especially `startdate` (epoch vs ISO; the mapper only
reads ISO, else falls back — pass `--updated`), tiered periods, and seasonal
month variation — before bulk-importing.
