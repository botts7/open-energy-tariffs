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
   (runs tests + `pii` scan + `validate` = ajv + unique-id + compliance, then
   `build` regenerates `index.json`). CI runs all of this on every PR; the **PII
   scan** rejects any account/meter/identity data.
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
- **Licensing:** `manual`/`urdb` entries are `CC0-1.0`; `cdr` (AER) entries are
  `other` (public CDR Product Reference Data — see `LICENSING.md`). **Never** paste
  Octopus (or other non-redistributable) data into a stored entry — `source:
  "octopus"` is rejected by the schema; real Octopus rates are imported on-device
  only. **Copyleft / share-alike data (CC-BY-SA, ODbL) is rejected from core** — it
  belongs in the [extended repo](https://github.com/botts7/open-energy-tariffs-extended).
  See `ATTRIBUTION.md`.

## Keeping a plan private

Don't want to share it? Don't PR it — your app stores your own tariff locally.
This repo is only for plans you choose to contribute.

## Add a whole data source (an endpoint to import)

This is how coverage scales — point us at a regulator / open-data portal / utility
feed and we build a reproducible importer (like the AU/CH/DK/FR/TW/CO ones).
**You describe the source; you don't submit code our build runs.** Either:

1. **Issue form** — *New issue → "Add a data source"* (easiest), or
2. **Manifest PR** — add `sources/<country>-<name>.json` matching
   `schema/source-manifest.schema.json` (see `sources/_example.json`). CI's
   `submission` workflow validates it (`npm run validate:submission`).

### Licence decides routing

| Bucket | Licences | Goes to |
|---|---|---|
| **Permissive** | CC0, CC-BY, Etalab 2.0, OGL, OGDL, opendata.swiss open, public-domain | **core** |
| **Share-alike** | CC-BY-SA, ODbL | **extended** repo (opt-in) |
| **Rejected** | non-commercial, all-rights-reserved, unknown | not accepted |

### What happens next (review pipeline)

1. **Automated gate** — manifest schema + **licence allow-list** + HTTPS; then for
   the importer: `schema/v1` + **PII scan** + **cross-check** vs the Eurostat / EIA /
   World-Bank reference (wild divergence is flagged).
2. **Human review** — a maintainer confirms the licence, attribution, and sanity.
   **Nothing auto-merges.**
3. Data enters **badged `experimental`/`beta` (unverified)** — shown with the data
   warning until corroborated, so it's never presented as gospel.

We never run submitter-authored code in the trusted build; importers are written /
reviewed by maintainers (or a declarative `fieldMap`), fetched over HTTPS with
size/time limits, every gate green before merge.
