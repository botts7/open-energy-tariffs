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

### Phase 0 — Architecture & planning (THE BULK; finish before writing code)
Produce `ARCHITECTURE.md` (scaffold already created — fill each section with a
decision + rationale; treat them as ADRs). Open decisions to resolve:

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

### Phase 1 — Finish the research (`SOURCES.md`)
Confirm URDB + Octopus ToS; pin the **AU-CDR** public generic-plans base URIs +
register endpoint (big win — covers AGL and every AU retailer, no auth).

### Phase 2 — Then, and only then, code
- CI: validate `tariffs/**` against the schema (ajv), run `build.mjs`, fail on dupes.
- Importers (`/importers/`): **AU-CDR first**, then Octopus, then URDB.
- Wallbox add-on consumer: a "Browse plans" step in the tariff editor
  (`sessions.js`) — fetch `dist/tariffs.json` (cached + bundled fallback), pick
  from `index.json`, apply `.tariff`; "Export / Submit" affordance. Manual editor +
  localStorage stay the private fallback (unchanged).

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
