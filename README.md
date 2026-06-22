# open-energy-tariffs

A community, geography-organised database of **electricity tariff structures**
(time-of-use bands, flat rates, EV/night windows, seasonal rates) that apps can
pull in to auto-fill a user's plan instead of making everyone hand-enter it.

Built first for the Wallbox BLE Gateway HA Add-on / Integration, but the data is
**app-agnostic** — any energy/EV/home-automation project can consume it.

**5,281 plans across 52 countries** and growing.

## Coverage map (web app)

`map/` is a zero-build, static **coverage map + plan comparison tool** (Leaflet +
plain JS, deployed to GitHub Pages by the `pages` workflow):

- **Browse & filter** every plan by country → distributor → provider → plan, plus
  flat-vs-time-of-use type and **sort cheapest-first** for your usage.
- **Compare against your real usage** — paste annual kWh, enter per-band
  peak/shoulder/off-peak averages, or **upload your distributor's interval CSV**
  (pluggable parsers — see [docs/USAGE_CSV_PARSERS.md](docs/USAGE_CSV_PARSERS.md)).
- **Detailed per-plan breakdown** — per-band kWh + cost, daily supply, solar
  feed-in credit, and a **side-by-side rate comparison vs your current plan**
  (green = cheaper, red = dearer).
- **Real coverage boundaries** fetched on demand (ABS postcode areas), address
  autocomplete, light / dark / mobile.

Everything runs client-side off the published `dist/` + `index.json` — no server,
no account, no personal data leaves the browser.

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
schema/v1/tariff.schema.json      # canonical entry shape (interval-based, JSON Schema)
schema/adapters/wallbox.schema.json  # shape the wallbox adapter EMITS (not the source)
tariffs/<COUNTRY>/<REGION>/<provider>/<plan>.json
dist/canonical/tariffs.json       # CI-compiled canonical bundle (generated, gitignored)
dist/canonical/tariffs.<CC>.json  # per-country chunks (generated)
index.json                        # country -> region -> provider -> [{id,plan,verified}] (generated)
scripts/validate.mjs              # ajv-validate tariffs/** + unique id + compliance
scripts/build.mjs                 # compiles tariffs/** -> dist/ + index.json
importers/_lib/                   # shared pure helpers (slug, money, intervals)
importers/cdr/                    # AU-CDR (AER) -> canonical (CDR Product Reference Data, bulk-store)
importers/urdb/                   # US OpenEI URDB -> canonical (CC0, bulk-store)
importers/octopus/                # UK Octopus -> canonical (ON-DEVICE only, never stored)
packages/sdk-js/                  # thin JS client (fetch+cache, getPlan, apply adapter)
map/                              # static coverage map + comparison web app (GitHub Pages)
docs/USAGE_CSV_PARSERS.md         # how to add a distributor usage-CSV parser via PR
ATTRIBUTION.md                    # per-source licence + attribution obligations
SOURCES.md                        # researched data sources + licences
```

The stored model is **neutral and interval-based** (lossless `from`/`to` times).
App-specific shapes — like the Wallbox add-on's 24-hour band arrays — are produced
by **build-time adapters** into `dist/<app>/`, never authored by hand.

## How a consumer uses it

1. Fetch `dist/canonical/tariffs.<CC>.json` (per-country chunk) or the combined
   bundle — cache it (ETag); ship a bundled snapshot as an offline fallback.
2. Show pick-lists from `index.json` (country → region → provider → plan; each
   carries a stable `id` for pinning).
3. Apply the chosen entry's `.tariff`. Wallbox add-on consumers use the
   `dist/wallbox/` adapter output (24-hour arrays); others read canonical directly.

## Licence

- **Code / scaffold:** MIT.
- **Community-submitted data:** CC0 (public-domain dedication) — tariff structures
  are facts.
- **Imported data:** retains its source's licence, tracked per entry in
  `meta.license` / `meta.sourceUrl`. AER plan data is public **CDR Product Reference Data** (attribution
  required); URDB is **CC0**; **Octopus is on-device-import only — never
  bulk-stored**.
- **Full licence register** (every data source + library + map tile + boundary
  set, with obligations and status): [LICENSING.md](LICENSING.md). See also
  [ATTRIBUTION.md](ATTRIBUTION.md) + [SOURCES.md](SOURCES.md).

> Rates here are community-maintained and **may be out of date or wrong** — always
> verify against your own bill. Entries carry `meta.updated` + `meta.source`.
