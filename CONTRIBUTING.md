# Contributing a tariff

Plans are public information — but **never include personal data** (account
number, NMI/MPAN/meter id, address, name). Only the plan *structure*.

## Add a plan

1. Copy an existing entry under `tariffs/<COUNTRY>/<REGION>/<provider>/<plan>.json`.
2. Fill `meta` (country ISO-2, provider, plan, currency ISO-4217, `source`,
   `sourceUrl`, `updated` YYYY-MM-DD) and `tariff`.
3. `tariff.weekday` / `weekend` are **24 entries** (local hour 0..23) → a band
   `id`. Times are local hour-of-day in the meter's timezone.
4. Validate against `schema/tariff.schema.json` and run `node scripts/build.mjs`
   (regenerates `dist/` + `index.json`). CI does this on every PR.
5. Set `meta.verified: true` only if you confirmed the rates against an
   authoritative source/bill; otherwise leave `false`.

## Rules

- One plan per file. File path mirrors `meta` (country/region/provider/plan).
- Band `id`s must be referenced by every painted hour; leave none unpainted.
- Dynamic/wholesale plans (Amber, Tibber, Nord Pool, Octopus Agile) are **not**
  accepted as presets — they're live-price (see `SOURCES.md`).
- Keep rates in the plan's native currency; `tariff.currency` is the display
  string the app shows.

## Keeping a plan private

Don't want to share it? Don't PR it — your app stores your own tariff locally.
This repo is only for plans you choose to contribute.
