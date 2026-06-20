# Next-session handoff — open-energy-tariffs

Foundation built 2026-06-20 in a session focused on the Wallbox add-on cost
features. Start a fresh session and point it here to continue **without** dragging
in the unrelated Wallbox context.

## What this is
A standalone, community, geography-organised **electricity tariff database** apps
pull in to auto-fill a user's plan (instead of everyone hand-entering bands).
Born from the Wallbox add-on's tariff editor; the `tariff` object in each entry
**matches that editor's shape** so it applies directly. See `README.md`.

## DONE (this foundation)
- `README.md` — purpose, layout, consumer flow, licence model.
- `schema/tariff.schema.json` — canonical entry shape (`meta` + `tariff`), draft-07.
- Seed entries: `tariffs/AU/NSW/agl/night-saver-ev.json` (the user's real plan,
  rates illustrative/unverified), plus `GB/octopus/economy-7` + `US/_example/flat`
  as structure examples.
- `SOURCES.md` — researched sources, the **STATIC vs DYNAMIC** split, licences.
- `CONTRIBUTING.md` + (todo) PR template.
- `scripts/build.mjs` — compiles `tariffs/**` → `dist/tariffs.json` + `index.json`.
- `index.json` — hand-seeded manifest (build.mjs regenerates it).

## ⚠️ The work is mostly ARCHITECTURE & PLANNING — not code

> The user's explicit steer: **"planning the architecture and everything else
> will be the bulk of the work before any code."** Do NOT jump to importers /
> consumers. The seed code here is a sketch to make the shape concrete; the real
> deliverable of the next session(s) is a thought-through architecture.

### Phase 0 — Architecture & planning ✅ DECISIONS RECORDED (2026-06-20)
`ARCHITECTURE.md` is now filled out as 11 ADRs (Decision/Options/Rationale/
Consequences) + **Appendix A** (the target interval-based canonical schema). Read
it before doing anything else. Headline decisions:
- **§1 Neutral interval-based canonical model** + build-time **adapters** →
  `dist/<app>/`. The Wallbox 24-hour-array shape is an *output*, not storage
  (it's lossy: can't do half-hour boundaries, supply charge, feed-in, etc.).
- **§2** v1 = AU (AU-CDR) end-to-end; GB/US example-only. STATIC presets only.
- **§3** identity key `country/region/distributor/provider/planSlug` = `meta.id`;
  time via top-level current tariff + optional `history[]`.
- **§4** SemVer schema in `schema/v1/`; supply charge + solar feed-in are v1;
  tiers/demand = v1.1 (pre-shaped).
- **§5** GitHub Releases (pinnable) + Pages `latest`; per-country chunks; ETag;
  bundled offline snapshot; snapshot-at-build.
- **§6 DEFERRED** → Phase 1: AU-CDR bulk-store OK; **URDB + Octopus ToS still need
  confirmation** (default = on-device import, don't bulk-republish).
- **§7** community vs verified + 12-month staleness flag. **§8** importers +
  adapters as shared pure fns (one mapping, build-time *or* on-device per licence).
  **§9** CI PII scan + pre-filled-PR export. **§10** thin optional SDK. **§11** keep
  name; set schema `$id`/CODEOWNERS at publish.

Original open-decision list (now all resolved in ARCHITECTURE.md, kept for trace):

1. **Canonical model vs app model.** The seed schema is "Wallbox-shaped". Decide:
   is the stored schema a NEUTRAL canonical model with per-app *adapters*
   (Wallbox / generic / openADR-ish), or app-specific? App-agnostic = more reuse,
   more upfront design.
2. **Scope/boundaries for v1.** Which countries + sources. STATIC only (presets)
   vs also documenting DYNAMIC (live-price) hand-off. What's explicitly out.
3. **Plan identity, dedup & time.** Unique key (country/region/network/provider/
   plan). How rate *changes over time* are modelled (effective-date ranges — ties
   to the add-on's tariff-history feature). Multiple regions per plan.
4. **Schema governance & extensions.** Versioning the schema; how it evolves
   without breaking consumers; the missing structures: tiered/block, demand
   charges, controlled load, **solar feed-in**, daily supply charge, EV-specific.
5. **Distribution architecture.** How consumers pull: GitHub raw / Pages / CDN /
   npm? Single bundle vs per-country chunks? Versioned releases + pinning? Cache /
   ETag / offline-snapshot strategy. Snapshot-at-build vs live-fetch.
6. **Licensing & legal (real research).** Per-source redistribution rights
   (URDB / AU-CDR / Octopus ToS); repo licence; attribution; **bulk-store vs
   on-device-import** decision per source.
7. **Trust / quality model.** verified vs unverified; staleness; who verifies;
   moderation; conflict resolution between submissions.
8. **Importer architecture.** on-device vs build-time; mapping each source model
   → schema; keeping importers in sync as sources change; keys/rate-limits.
9. **Contribution & privacy UX.** PR flow; in-app "submit my plan" → pre-filled
   PR; CI PII checks; templates.
10. **Consumer SDK?** A tiny JS/Python helper (load → pick → apply/map) vs raw
    JSON. Improves adoption; decide if worth it.
11. **Naming / ownership / governance.** Repo name, org, maintainership. (`$id`
    in the schema currently says `OWNER`.)

### Phase 1 — Finish the research ✅ DONE (2026-06-20)
Confirmed against primary sources (see `SOURCES.md` "Resolved" + `ARCHITECTURE.md` §6):
- **URDB = CC0** → bulk-store OK (no attribution; keep `verified:false` until checked).
- **Octopus = no open licence** (ToS forbids distributing content) → **on-device
  import only** + CC0 community examples; never bulk-republish.
- **AU-CDR = CC BY 4.0** (AER) → **bulk-store OK with attribution**. Endpoints pinned:
  host `https://cdr.energymadeeasy.gov.au/`, `GET /cds-au/v1/energy/plans` +
  `/{planId}`, header `x-v: 1`, **no auth**. AER central feed covers AGL + all NECF
  retailers + VIC. Per-retailer base-URI list published by AER; community list at
  `github.com/jxeeno/energy-cdr-prd-endpoints`.

### Phase 2 — code (IN PROGRESS)
DONE (2026-06-20, commit f0fb90d):
- ✅ Canonical interval schema `schema/v1/tariff.schema.json` (Appendix A). Old
  Wallbox schema → `schema/adapters/wallbox.schema.json` (adapter OUTPUT, not source).
- ✅ 3 seed entries migrated to the interval model.
- ✅ CI: `scripts/validate.mjs` (ajv + unique-id + compliance), `package.json`
  (ajv/ajv-formats), `build.mjs` → `dist/canonical/` + per-country chunks + richer
  `index.json`, `.github/workflows/validate.yml`. Compliance baked in: `source`
  enum excludes `octopus`; `source=cdr ⇒ CC-BY-4.0`.
- ✅ Licence compliance pass (commit 9c8ca09) + `ATTRIBUTION.md`.

TODO **in THIS repo / session** (app-agnostic core, roughly in order):
- ✅ **AU-CDR importer** (`importers/cdr/`, commit 2b19265) — `map.mjs` (pure),
  `fetch.mjs` (`x-v:1`), `run.mjs` CLI, synthetic fixture + `map.test.mjs`
  (deep-equal + schema conformance), README. Emits `source:cdr, license:CC-BY-4.0`
  + AER attribution. **⚠️ mapping authored from the CDR OpenAPI, NOT run against
  the live API** — capture a real `…/plans/{planId}` response (with `x-v:1`),
  re-run `npm test`, and confirm time-format / supply-charge shapes before
  bulk-importing (see `importers/cdr/README.md` "Verification gap"). Follow-ups:
  seasonal multi-`tariffPeriod`, time-varying export, stepped/demand.
- ✅ **PII scan** (`scripts/pii-scan.mjs`, ARCH §9, commit ecd6c8c) — rejects
  email/NMI/MPAN/meter/account/phone/address/secret patterns in `tariffs/**`;
  wired into `npm run pii` + `check` + CI. `.github/` PR template + `submit-plan`
  issue form added.
- ✅ **Consumer SDK** (`packages/sdk-js/`, commit 7a776f1) — `createClient`
  (ETag fetch + cache + bundled offline fallback), `fetchIndex`/`fetchCountry`,
  `getPlan(id)`, `apply(idOrEntry, adapter, {at})` with `history[]` effective-date
  resolution, pluggable `registerAdapter` (built-ins generic/raw; wallbox is
  registered by that consumer). Tested with a mock fetch. ← SDK done
- ✅ **Octopus on-device importer** (`importers/octopus/`, commit ff94db6) —
  single-register→flat, dual-register→E7 tou; refuses dynamic; runtime-only,
  source:octopus (stored schema rejects it — tested). Tests + fixtures.
- ✅ **URDB importer** (`importers/urdb/`, commit 04c26df) — flat/tou,
  month×hour matrix → intervals, supply charge; CC0 bulk-storable. Tests + fixtures.
- ✅ **Shared `importers/_lib/`** (commit 43ab131) — slug/money/round/
  hoursToIntervals/dayComplement; CDR refactored onto it.

**Phase 2 (this repo) is now feature-complete + reality-checked.**
- ✅ All three importers now test against **REAL captured responses** (curl):
  CDR = Ergon Tariff 12D, Octopus = Flexible (VAR-22-11-01), URDB = Ohio Power
  TOU+flat. Six real-shape bugs found + fixed: CDR `dailySupplyCharge` singular,
  inclusive end times, detail needs `x-v:3`; Octopus `varying` payment key;
  URDB `rate+adj` sum, epoch `startdate`. (commits e5ad9f9, 7483cef, 13a6e10)
- Still authored-but-unrun by the assistant → **CI is the gate** (`npm test`).

- ✅ **Geographic coverage** captured into `meta.coverage` (CDR postcodes,
  Octopus gsp, URDB eiaid→utilityId) — schema extended (additive); real fixtures
  updated. Join keys for a coverage map (postcodes→POA, gsp→DNO, eiaid→HIFLD).
  (commit 44ed86e)
- ✅ **IURDB**: URDB importer is country-agnostic (item.country→ISO-2, writes
  `tariffs/<country>/`, `--currency`). Live OpenEI API is US-only today;
  international needs the IURDB bulk dump through the same `mapRate()`.

Remaining = publish + a map + the Wallbox-session consumer:
- **Coverage map** (optional new `map/` static viewer, or leave to consumers):
  load `dist/`, join `meta.coverage` to boundary GeoJSON, shade a choropleth.
- Optionally commit one real bulk-store entry per source to `tariffs/` (e.g. run
  `importers/cdr/run.mjs --base https://cdr.energymadeeasy.gov.au/ergon` then
  `npm run validate`) so the DB ships real data, not just examples.
- Wallbox session (separate): write the `wallbox` adapter + the add-on "Browse
  plans" consumer; `client.registerAdapter('wallbox', …)` then `apply(id,'wallbox')`.

TODO **in the WALLBOX session** (NOT here — keep this repo app-agnostic):
- **`adapters/wallbox.mjs`** — canonical → Wallbox 24-hour band arrays (lossy
  projection; `log` sub-hour rounding); wire into `build.mjs` → `dist/wallbox/`.
- **Wallbox add-on consumer**: a "Browse plans" step in the tariff editor
  (`sessions.js`) — fetch the per-country chunk (cached + bundled fallback), pick
  from `index.json`, apply; "Export / Submit" affordance. Manual editor +
  localStorage stay the private fallback (unchanged).
> The canonical model already carries everything the Wallbox shape needs; the
> adapter is a thin projection that belongs with the consumer that uses it.

### Phase 3 — Publish
Only after a privacy scan + review with the user (nothing pushed to GitHub yet).

## Constraints carried over
- **Do NOT run `node`** in the assistant's environment (it kills the session) —
  author scripts, let CI / the user run them.
- **No GitHub push** until the user reviews + approves (scan for anything that
  shouldn't be public — though tariff structures are public by nature).
- Tariff `weekday`/`weekend` are 24 local-hour → band-id arrays; times are local
  to the meter's TZ. The Wallbox consumer already handles charger-TZ + schedule-
  aware billing — this repo only supplies the bands.

## Related (Wallbox side, other repos — context only)
- Add-on tariff engine: `wallbox-gateway-ha-addon/.../app/static/sessions.js`
  (`loadTariff`, `_sessionCost`, `_chargeSegments`, tariff effective-dates).
- See assistant memory `project_addon_schedule_editor` + `project_energy_tariff_repo`.
