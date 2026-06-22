# TW-Taipower importer (Taiwan — residential time-of-use)

Maps Taipower's **optional residential time-of-use** tariff (時間電價) into a
canonical v1 entry with summer/non-summer rates (`band.seasonRates`), a `summer`
season (Jun–Sep), and a weekday/weekend schedule.

- **Scope:** the **ToU** residential tariff only. Taipower's *standard* residential
  tariff is block/tiered, which v1's `flat|tou` kinds can't model yet (needs v1.1
  `tiers`) — so it's intentionally out of scope here.
- **Licence:** **Open Government Data License, Taiwan (OGDL)** — CC-BY-4.0-compatible.
  Recorded as `meta.license: "other"` + Taipower / data.gov.tw attribution in `notes`.
- **Source:** data.gov.tw datasets **17052 / 17060** — <https://data.gov.tw/dataset/17052>

## Run

```
node importers/tw-taipower/run.mjs --record importers/tw-taipower/fixtures/residential-tou-two-section.sample.json --updated 2026-06-20
```

Writes to `tariffs/TW/national/taipower/<plan>.json`.

## Why a record file (not a column-mapped CSV)

The data.gov.tw resources are **flat rate tables with Chinese headers**, not a
per-plan feed. The ToU tariff is just a handful of stable numbers (summer +
non-summer peak/off-peak per-kWh, the peak time windows, and the monthly basic
charge), so the honest, low-risk path is to **read those off the current rate sheet
into a small normalised record** (the shape in `fixtures/*.sample.json`) and let
`map.mjs` do the canonical/schedule/season work. `fetch.mjs` can pull the raw CSV
to read the current numbers.

Record shape:

```json
{
  "scheme": "two-section",
  "summer":    { "peakRate": 5.01, "offpeakRate": 1.96 },
  "nonSummer": { "peakRate": 4.78, "offpeakRate": 1.89 },
  "peakWindows": [{ "from": "16:00", "to": "22:00" }],
  "basicMonthly": 75.0
}
```

⚠️ The sample numbers are **illustrative** — replace with the current published
Taipower ToU rates + peak windows before committing, then `npm run validate`.
