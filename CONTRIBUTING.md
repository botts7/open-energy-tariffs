# Contributing a tariff

Plans are public information — but **never include personal data** (account
number, NMI/MPAN/meter id, address, name). Only the plan *structure*.

## Add a plan

1. Copy an existing entry under `tariffs/<COUNTRY>/<REGION>/<provider>/<plan>.json`.
2. Fill `meta`: `id` (kebab `country-region-distributor-provider-planslug`,
   unique), `schemaVersion` `"1"`, country ISO-2, provider, plan, currency ISO-4217,
   `source`, `license`, `timezone` (IANA), `updated` YYYY-MM-DD.
3. Fill `tariff` (interval-based — see `schema/v1/tariff.schema.json`):
   - `kind`: `flat` (then `import.flatRate`) or `tou` (then `import.bands` +
     `import.schedule`).
   - `import.schedule[]` paints bands by **time intervals**:
     `{ "days": "all"|"weekday"|"weekend"|["mon",…], "from": "HH:MM", "to": "HH:MM",
     "band": "<band id>" }`. Times are local to `meta.timezone`; `from > to` wraps
     midnight. This is lossless — use real boundaries (e.g. `15:30`), not rounded.
   - Optional: `supply.daily` (daily charge), `export` (solar feed-in),
     `controlledLoad[]`, `seasons[]`.
4. Validate + build: `npm install` then `npm run check`
   (`validate` = ajv + unique-id + compliance; `build` regenerates `index.json`).
   CI runs this on every PR.
5. Set `meta.verified: true` only if you confirmed the rates against an
   authoritative source/bill, and add `meta.verifiedAgainst`; otherwise leave `false`.

## Rules

- One plan per file. `meta.id` is unique across the repo; file path mirrors
  country/region/provider/plan.
- Every band `id` must be referenced by the schedule; leave no time unpainted.
- Dynamic/wholesale plans (Amber, Tibber, Nord Pool, Octopus Agile) are **not**
  accepted as presets — they're live-price (see `SOURCES.md`).
- Keep rates in the plan's native currency (`meta.currency`); the display symbol
  is the consuming app's concern.
- **Licensing:** `manual`/`urdb` entries are `CC0-1.0`; `cdr` (AER) entries must be
  `CC-BY-4.0`. **Never** paste Octopus (or other non-redistributable) data into a
  stored entry — `source: "octopus"` is rejected by the schema; real Octopus rates
  are imported on-device only. See `ATTRIBUTION.md`.

## Keeping a plan private

Don't want to share it? Don't PR it — your app stores your own tariff locally.
This repo is only for plans you choose to contribute.
