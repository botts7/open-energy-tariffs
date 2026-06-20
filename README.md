# open-energy-tariffs

A community, geography-organised database of **electricity tariff structures**
(time-of-use bands, flat rates, EV/night windows, seasonal rates) that apps can
pull in to auto-fill a user's plan instead of making everyone hand-enter it.

Built first for the Wallbox BLE Gateway HA Add-on / Integration, but the data is
**app-agnostic** — any energy/EV/home-automation project can consume it.

## Why a separate repo

- **Decoupled cadence** — plans and rates change far more often than app code;
  updating a tariff shouldn't require an app release / firmware OTA.
- **Reuse** — add-on, HACS integration, dashboards, other projects share one source.
- **Community** — crowdsourced plans grow over time via PRs.
- **Privacy-clean** — plan *structures* are public information (no account, meter,
  address or personal data). A user's own private tweaks stay local in their app.

## Two-tier model

1. **Public / shared** = this repo. Submit a plan via a PR (see
   [CONTRIBUTING.md](CONTRIBUTING.md)).
2. **Private / local** = the consuming app keeps a user's own plan in local
   storage; it is never uploaded. The manual editor is always the universal
   fallback for any plan not in here.

## Layout

```
schema/tariff.schema.json     # the canonical entry shape (JSON Schema)
tariffs/<COUNTRY>/<REGION>/<provider>/<plan>.json
dist/tariffs.json             # CI-compiled bundle consumers fetch (generated)
index.json                    # country -> provider -> plan manifest (generated)
scripts/build.mjs             # compiles tariffs/** -> dist/ + index.json
importers/                    # normalise external sources -> schema (next phase)
SOURCES.md                    # researched data sources + licences
```

## How a consumer uses it

1. Fetch `dist/tariffs.json` (or a per-country chunk) — cache it; ship a bundled
   snapshot as an offline fallback.
2. Show pick-lists from `index.json` (country → region → provider → plan).
3. Apply the chosen entry's `.tariff` object to the app's tariff editor.

## Licence

- **Code / scaffold:** MIT.
- **Community-submitted data:** CC0 (public-domain dedication) — tariff structures
  are facts.
- **Imported data:** retains its source's licence, tracked per entry in
  `meta.license` / `meta.sourceUrl`. AER data is **CC BY 4.0** (attribution
  required); URDB is **CC0**; **Octopus is on-device-import only — never
  bulk-stored**. See [ATTRIBUTION.md](ATTRIBUTION.md) + [SOURCES.md](SOURCES.md).

> Rates here are community-maintained and **may be out of date or wrong** — always
> verify against your own bill. Entries carry `meta.updated` + `meta.source`.
