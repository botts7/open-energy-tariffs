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
| `rate` + `adj` per tier | summed → effective per-kWh price (URDB splits base rate from riders/adjustments) |
| 1 period | `kind: flat`, `import.flatRate` |
| >1 period | `kind: tou`, `import.bands[]` (one per period; first tier only) |
| month×hour schedule | `import.schedule[]` — January row, run-length-encoded into intervals; weekday/weekend collapse to `days: all` when identical |
| `fixedchargefirstmeter` | `supply.daily` (`$/day` as-is; `$/month` ÷ 30.44) |
| `eiaid` | `meta.coverage.utilityId` (→ EIA/HIFLD service-territory polygons) |
| `country` (name) | `meta.country` (ISO-2) — **country-agnostic**, so IURDB international items map too |

> **IURDB note:** the live OpenEI API (`version=latest`) is US-only in practice;
> international coverage needs the IURDB **bulk dump** through the same `mapRate()`.
> Pass `--currency` for non-US items (US defaults USD). See `../../SOURCES.md`.

Not yet modelled (follow-ups): tiered/block (reserved `band.tiers[]`), demand
charges, and **per-month seasonal** variation (a note is added when month rows
differ; January is used).

## Files

| File | Role |
|---|---|
| `map.mjs` | **Pure** `mapRate(item, {state,timezone,updated})`. |
| `fetch.mjs` | `fetchRates(...)` (needs `URDB_API_KEY`). |
| `run.mjs` | Build-time CLI: fetch → map → write `tariffs/US/`. |
| `fixtures/` + `map.test.mjs` | **real** Ohio Power TOU (seasonal+adj) + flat captures, schema conformance, monthly→daily, weekday/weekend split. |

## Run

```sh
URDB_API_KEY=... node importers/urdb/run.mjs \
  --utility "Pacific Gas & Electric Co" --state CA --timezone America/Los_Angeles \
  --updated 2026-06-20 [--limit 50] [--dry]
npm run validate && npm run build
```

## Verified against real captures (2026-06-20)

Tested against live Ohio Power TOU + flat items (DEMO_KEY). Real-shape fixes:
- tier price is **`rate` + `adj`** (the mapper now sums them; was undercounting).
- `startdate` is a **Unix epoch**, not ISO — `normalizeDate` ignores it, so pass
  `--updated` (the CLI does) rather than relying on the fallback.
- the sampled rate is **seasonal** (month rows differ) and weekday≠weekend — the
  importer uses January + splits day-sets, and adds a note.

Follow-ups: block tiers (reserved `band.tiers[]`), demand charges, and proper
seasonal modelling (→ `seasons[]` + `band.seasonRates`) instead of the Jan note.
