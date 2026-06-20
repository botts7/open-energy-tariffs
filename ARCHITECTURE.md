# Architecture & decisions (open-energy-tariffs)

> **This document is the bulk of the project.** Each section is a decision made
> *before* writing importers or consumers, recorded as a lightweight ADR:
> **Decision / Options / Rationale / Consequences**. Status one of:
> `DECIDED` / `DEFERRED` (needs Phase 1 research) / `OPEN`.
>
> Phase 0 status: **decisions made.** Items that depend on external ToS
> confirmation are `DEFERRED` to Phase 1 with the decision's *default* recorded.
> The concrete schema these decisions imply is in **Appendix A** so Phase 2 is
> mechanical.

---

## 1. Canonical model vs app-specific model — `DECIDED`

**Decision.** Store a **neutral, interval-based canonical model**. App shapes
(Wallbox 24-hour band arrays, "generic", raw) are produced by **build-time
adapters** into `dist/<app>/`. The Wallbox shape is an *output*, never the
storage format.

- Options:
  - (a) **Neutral canonical + adapters** — chosen.
  - (b) Wallbox-shaped now, refactor later — rejected.
  - (c) Two layers: canonical store + per-app compiled `dist/` — folded into (a);
    this *is* the adapter pipeline.
- Rationale.
  - The Wallbox 24-entry `weekday`/`weekend` array is **lossy**: it can only switch
    bands on the hour, but real ToU plans routinely switch on the half-hour
    (e.g. AGL peak "3:00pm–9:00pm" is fine, but many US/UK plans use 16:30, 19:30,
    07:30). It also can't carry supply charge, feed-in, controlled load, tiers, or
    demand charges. A canonical store must be the long-lived asset; apps come and
    go and each wants its own shape.
  - The 24-array is **trivially derivable** from intervals (sample each hour's
    start minute → band), so picking the richer model costs the Wallbox consumer
    nothing — the adapter does the lossy projection once, at build, in one place.
  - Keeping the canonical→Wallbox mapping in *this* repo (not in the add-on) means
    every consumer benefits and the mapping is tested against fixtures here.
- Consequences.
  - Schema is rewritten to the interval model (Appendix A). The current
    Wallbox-shaped `schema/tariff.schema.json` becomes the **`dist/wallbox`
    adapter output schema**, not the source schema.
  - Adapters live in `/adapters/` (pure functions, fixture-tested). v1 adapters:
    `wallbox` (24-array + bands), `generic` (canonical passthrough, pretty-printed).
  - The build emits `dist/canonical/` **and** `dist/wallbox/`. Consumers choose.

## 2. Scope & boundaries for v1 — `DECIDED`

**Decision.** v1 ships **one proven vertical end-to-end (AU)** plus
structure-only examples for GB/US. **STATIC presets only.** DYNAMIC providers are
documented as a hand-off, never stored.

- In scope v1:
  - **Countries/sources:** AU via **AU-CDR** (no auth, all retailers incl. AGL,
    redistributable — the strongest fit and the user's own plan). GB (Octopus) and
    US (URDB) remain **example entries only** until their importers land (Phase 2).
  - **Static structures:** flat, time-of-use, EV/night windows, seasonal, **daily
    supply charge**, **solar feed-in (export)**. Controlled load = v1 optional
    (common in AU). Tiered/block + demand charges = **v1.1** (US/commercial-heavy).
  - **Electricity only.**
- Out of scope (v1 and likely forever):
  - DYNAMIC / wholesale / half-hourly market price (Amber, Tibber, Nord Pool,
    aWATTar, Octopus Agile) — no fixed bands exist; consume the user's live HA
    price entity instead. Documented in `SOURCES.md`.
  - Gas, water, demand-response *events*, real-time signals, billing/invoicing,
    network-tariff cost-reflective trials, any account/meter/personal data.
- Rationale. One vertical proven to the consuming app beats three half-built ones;
  AU-CDR is the lowest-friction (no key, redistributable, covers the reference
  user). DYNAMIC has no preset to store — pretending otherwise pollutes the model.
- Consequences. CI + importers target AU-CDR first. GB/US examples carry
  `verified: false` and exist to exercise the schema and pick-list UX.

## 3. Plan identity, dedup & time-versioning — `DECIDED`

**Decision.**
- **Identity key:** `country / region / distributor / provider / planSlug`,
  surfaced as a single canonical `meta.id`
  (e.g. `au-nsw-ausgrid-agl-night-saver-ev`). File path mirrors it. Dedup is on
  `meta.id`; CI fails on collision.
- **Time-versioning:** a plan file holds the **current** tariff at top level plus
  an optional `history[]` of prior `{ validFrom, validTo, tariff }` snapshots.
  Consumers pick the version effective at the billing date; simple consumers read
  the top-level current tariff and ignore history.
- **Multiple regions:** if rates are identical across regions, list them in
  `meta.regions[]`. If they differ by region/network, **separate files** keyed by
  region. The importer decides per source.

- Options for time:
  - Top-level current + `history[]` — chosen (one file per plan, simple default,
    opt-in history).
  - One file per version — rejected (fragments identity, noisy dedup, bad pick-list).
  - `versions[]` only (no privileged "current") — rejected (breaks the simple
    consumer path; everyone must implement effective-date resolution).
- Rationale.
  - `meta.id` gives a stable join key for dedup, contribution ("update existing"
    vs "new"), and consumer pinning. Distributor (network/DNO) is in the key
    because the *same* retailer plan often differs by network area.
  - Top-level-current mirrors the Wallbox add-on's existing `validFrom`
    tariff-history feature, so the consumer already knows how to apply it.
- Consequences. `meta.id` + `meta.distributor` + `meta.regions[]` added (Appendix
  A). `validFrom` becomes a **date string** (`YYYY-MM-DD`) at the canonical layer;
  the Wallbox adapter converts to the epoch-seconds the add-on expects.

## 4. Schema governance & extensions — `DECIDED`

**Decision.**
- **Versioning:** schema is SemVer'd in its path: `schema/v1/tariff.schema.json`,
  `$id .../schema/v1/...`. Each entry declares `meta.schemaVersion` (`"1"`). The
  `dist` bundle carries `schemaMajor`.
- **Evolution rule:** within a major, only **additive optional** fields (minor).
  Anything breaking → new major directory, new `dist` namespace; the previous
  major keeps building until consumers migrate. Canonical store validates
  **strict** (`additionalProperties:false`) against its exact major; **consumers
  are instructed to tolerate unknown fields** (forward-compat).
- **Extensions and when they land:**

  | Structure | v1 | Modelled as |
  |---|---|---|
  | Daily supply charge | ✅ | `tariff.supply.daily` (native unit/day) |
  | Solar feed-in (export) | ✅ | `tariff.export` (flat or bands+schedule) |
  | Controlled load (separately metered) | ✅ optional | `tariff.controlledLoad[]` (own rate + optional schedule) |
  | Seasonal | ✅ | `seasons[]` + `band.seasonRates` |
  | Geographic coverage (mapping) | ✅ | `meta.coverage` (postcodes / gsp / utilityId → boundary data) |
  | Tiered / block (stepped by kWh) | v1.1 | `band.tiers[]` `{ upTo, rate }` |
  | Demand charges (c/kW peak) | v1.1 | `tariff.demand[]` `{ window, rate }` |

- Rationale. Path-based major versioning lets old and new coexist on a CDN with
  zero ambiguity; strict-in/tolerant-out is the standard contract that lets the
  store stay clean while consumers don't break on a minor bump. Supply charge and
  feed-in are in v1 because every real bill has a supply charge and the reference
  user has solar — omitting them makes cost numbers wrong.
- Consequences. Appendix A is the v1 schema. v1.1 tiers/demand are pre-shaped (the
  fields are reserved/documented) so adding them is additive, not breaking.

## 5. Distribution architecture — `DECIDED`

**Decision.**
- **Primary:** versioned **GitHub Releases** — CI compiles `dist/` and attaches
  immutable assets (`tariffs.<country>.json`, `index.json`, `tariffs.json`). A
  release tag (`data-2026.06`) is the pinnable unit.
- **Latest:** GitHub **Pages** (or raw) serves a moving `latest/` for casual
  consumers; production consumers pin a release.
- **Chunking:** `index.json` (small manifest) + **per-country chunks**
  (`dist/wallbox/tariffs.AU.json`). A consumer fetches the manifest, then only the
  country it needs. A single combined `tariffs.json` is also emitted for small
  consumers.
- **Caching:** HTTP `ETag` / `If-None-Match`; consumers cache and revalidate.
- **Offline:** consumers **bundle a snapshot** at app build/release as the
  offline fallback; the network copy upgrades it.
- **Freshness model:** **snapshot-at-build** (CI bakes `dist/` from `tariffs/**`),
  *not* live-fetch from sources at consume time — except licence-restricted
  on-device importers (§6/§8).

- Options. npm package as primary — deferred (a JS-only mirror is a nice-to-have,
  not the source of truth; added later if demand). Single mega-bundle only —
  rejected (won't scale past a few countries on mobile/embedded consumers).
- Rationale. Releases give immutability + pinning for free, Pages gives a friendly
  `latest`, per-country chunks keep the embedded/HA consumer's payload tiny, and a
  bundled snapshot means the add-on works with no network. ETag keeps revalidation
  cheap.
- Consequences. `build.mjs` extended to emit per-country chunks under
  `dist/<adapter>/` + a top-level `index.json`. A `release.yml` workflow tags and
  uploads assets. README "How a consumer uses it" updated to the pin/latest split.

## 6. Licensing & legal — `DECIDED` (ToS confirmed, Phase 1, 2026-06-20)

**Decision.**
- **Repo code:** MIT. **Community-submitted data:** CC0. Per-entry `meta.license`
  records the actual licence of *that* entry.
- **Per source (bulk-store vs on-device-import) — confirmed against source terms:**

  | Source | Licence (confirmed) | Delivery |
  |---|---|---|
  | **AU-CDR** | **CC BY 4.0** — all AER website material is CC BY 4.0; AER + Vic DEECA are the designated data holders for generic plans | **Bulk-store OK** with attribution ("© AER, CC BY 4.0", `sourceUrl`, `updated`) |
  | **OpenEI URDB** | **CC0** — OpenEI platform content is "Creative Commons Zero unless otherwise noted" (NREL/DOE) | **Bulk-store OK**, no attribution required (cite OpenEI/NREL as courtesy); the "unless otherwise noted" + user-submitted caveat → still mark `verified:false` until checked |
  | **Octopus** | **No open licence** — ToS: *"You must not sell, licence, distribute or otherwise make available the content of our website"* | **On-device import + hand-curated community examples only.** Do NOT bulk-republish Octopus data |

- Rationale. Tariff *structures* are facts, but the **delivery** path is gated by
  each source's actual terms, now confirmed: AER (CC BY 4.0) and URDB (CC0) are
  explicitly open → safe to bulk-store with the appropriate attribution. Octopus
  grants no redistribution right → we only ever import its data **on the user's own
  device at runtime**, and accept hand-entered community examples (a user
  describing their own plan is their fact to share, CC0). Licence is tracked
  **per entry** (`meta.license`), not repo-wide, so a CC0 community entry and a
  CC-BY AER entry coexist correctly.
- Consequences. `meta.license` required-with-default. The **AU-CDR importer
  bulk-commits** to `tariffs/` with `license: "CC-BY-4.0"` + attribution. **URDB
  importer may bulk-commit** with `license: "CC0-1.0"`. **Octopus is on-device
  only** (a mapping the SDK runs, §8/§10) plus optional CC0 community examples —
  nothing Octopus-sourced is committed in bulk.

## 7. Trust / quality model — `DECIDED`

**Decision.**
- **Two tiers:** `community` (PR-submitted, `verified:false`) and `verified`
  (checked against an authoritative source/bill). `verified:true` may only be set
  by a maintainer or with `meta.verifiedAgainst` evidence (source URL / "own bill").
- **Staleness:** the build computes age from `meta.updated`; entries older than
  **12 months** are flagged `stale:true` in `dist` and the SDK surfaces a warning.
  No auto-deletion.
- **Moderation:** PRs reviewed via `CODEOWNERS`; CI gates on schema + PII scan
  (§9). Conflicts: **newest verified wins**; superseded rates move into
  `history[]`; genuine disputes are tracked via an issue, not edit-warred.
- Rationale. A boolean alone is too weak and a full reputation system is overkill
  for v1; "community vs verified + staleness flag + provenance" is the minimum that
  lets a consumer decide how much to trust a number, and it's all derivable from
  fields already near the schema.
- Consequences. Add `meta.verifiedAgainst` (optional) and a build-computed
  `stale` flag (in `dist`, not authored). `verified` setting is enforced by review,
  documented in CONTRIBUTING.

## 8. Importer architecture — `DECIDED`

**Decision.**
- **Two delivery paths, chosen per source by §6 licence:**
  - **Build-time importer** (`/importers/<source>/`): pure function
    `sourceRecord → canonical entry`, run in CI/manually, output committed under
    `tariffs/` (redistributable sources — **AU-CDR**).
  - **On-device importer spec**: for licence-restricted sources (URDB, Octopus) the
    **SDK** ships the same mapping so the *consuming app* fetches+maps at runtime;
    nothing bulk-committed.
- **Mapping discipline:** every importer is fixture-driven — a captured source
  record + the expected canonical entry, asserted in CI. Mapping logic is shared
  between the build-time and on-device paths (one function, two callers).
- **Drift detection:** importers pin the source's expected shape; a **scheduled CI
  job** (cron) re-runs importers against live fixtures and **opens an issue** when
  the source schema changes. No silent breakage.
- **Keys/limits:** URDB needs an `api.data.gov` key → CI **secret**, never in repo;
  CDR + Octopus listing need no auth. Backoff + cache; respect documented rate
  limits; `log` what was skipped (no silent truncation).
- Rationale. Sharing one mapping function across build-time and on-device paths
  avoids the classic two-implementations-drift bug and lets §6's licence decision
  pick the *delivery* without touching the *mapping*. Fixtures + cron drift checks
  are how importers stay correct as upstreams change.
- Consequences. `/importers/` and `/adapters/` are sibling pure-function dirs.
  AU-CDR importer is the Phase 2 first deliverable. SDK (§10) imports the same
  mapping modules for on-device sources.

## 9. Contribution & privacy UX — `DECIDED`

**Decision.**
- **PR flow:** copy a template entry → fill → open PR. CI runs: (1) JSON-schema
  validation (ajv), (2) **PII scan**, (3) `build.mjs` + duplicate-`meta.id` check,
  (4) `CODEOWNERS` review.
- **PII scan patterns** (CI fails on match): AU **NMI** (10–11 digits), UK
  **MPAN** (`S`-profile / 13/21-digit), meter serials, email addresses, street
  addresses, personal names in `notes`, account numbers, API keys/tokens.
- **In-app "submit my plan":** the consuming app **strips private fields locally**,
  then opens a **pre-filled GitHub PR** (new-file URL) or an **issue form** with
  the sanitised `meta` + `tariff` JSON. The app never uploads anything silently.
- Rationale. The whole privacy promise (README two-tier model) hinges on
  structures-only; a CI PII gate makes that enforceable rather than aspirational,
  and a pre-filled-PR export turns "I have a plan" into a one-click contribution
  without the app holding write credentials.
- Consequences. Add `.github/` PR template + issue form + a `scripts/pii-scan.mjs`
  (author now, CI runs it). CONTRIBUTING already states the no-PII rule; link the
  scan.

## 10. Consumer SDK — `DECIDED` (thin, optional)

**Decision.** Ship a **tiny, dependency-free SDK** — JS first
(`packages/sdk-js/`), Python mirror later. Responsibilities, deliberately minimal:
- `fetchIndex()` / `fetchCountry(cc)` with ETag cache + bundled-snapshot fallback,
- `getPlan(id, { at })` → resolves effective version from `history[]`,
- `apply(plan, 'wallbox' | 'generic')` → runs the **adapter** (shared with the
  build, §1),
- on-device importers for licence-restricted sources (§6/§8).
Raw-JSON consumption stays fully supported; the SDK is sugar, not a gate.

- Rationale. The cache/ETag/version-pin/effective-date/adapter logic is identical
  for every consumer; encapsulating it once stops each app reinventing (and
  mis-implementing) it, and it keeps the Wallbox add-on consumer thin. Keeping it
  dependency-free + optional avoids forcing a runtime on anyone.
- Consequences. The Wallbox adapter + on-device importers are imported by **both**
  the build and the SDK → they live in shared, framework-free modules. SDK is
  Phase 2/3, after the schema + AU-CDR importer prove the shape.

## 11. Naming / ownership / governance — `DECIDED`

**Decision.**
- **Repo name:** `open-energy-tariffs` (kept).
- **Ownership:** starts under the user's GitHub account; **target a neutral org**
  (`open-energy-tariffs`) once a second maintainer joins, so community data isn't
  hostage to one account. Schema `$id` is set to the real repo URL on first push
  (replaces `OWNER`).
- **Governance:** BDFL + `CODEOWNERS` for v1 (lightweight: PR + review). Document a
  path to add maintainers; escalate to org governance as contribution volume grows.
- Rationale. Don't over-govern an empty repo, but pick a name/structure that can
  *become* community-owned without a rename or data migration. The `OWNER`
  placeholder is the only hard blocker and it's a one-line fix at publish time.
- Consequences. Before Phase 3 publish: set schema `$id`, add `CODEOWNERS`, decide
  account-vs-org. Tracked in NEXT-STEPS Phase 3.

---

## Cross-cutting consequences (what these decisions change)

1. **Schema rewrite** to the interval-based canonical model — **Appendix A**. The
   existing Wallbox-shaped schema is relabelled as the `dist/wallbox` *adapter
   output* contract.
2. **New top-level dirs:** `adapters/` (canonical→app), `importers/` (source→
   canonical), `packages/sdk-js/`, `schema/v1/`, `.github/`.
3. **`build.mjs` grows:** walk `tariffs/**` → validate → run adapters →
   per-country chunks under `dist/<adapter>/` + `index.json` + duplicate-id check.
4. **Meta additions:** `id`, `distributor`, `regions[]`, `schemaVersion`,
   `verifiedAgainst`; `validFrom` becomes a date at canonical layer.
5. **CI:** ajv validation, PII scan, build, dup-check (Phase 2); release workflow
   + cron drift check (Phase 2/3).
6. **Two licence-confirmation tasks remain** (URDB, Octopus) — §6 `DEFERRED` →
   Phase 1.

---

## Appendix A — Canonical schema v1 (target shape)

Interval-based, app-agnostic. `from`/`to` are `HH:MM` **local to the meter's
timezone**; `days` is a day-set. Lossless; the Wallbox adapter projects it to the
24-hour band arrays. *(Sketch for Phase 2; field names final pending implementation.)*

```jsonc
{
  "meta": {
    "id": "au-nsw-ausgrid-agl-night-saver-ev",   // canonical identity key
    "schemaVersion": "1",
    "country": "AU",                              // ISO 3166-1 alpha-2
    "region": "NSW",                              // state / DNO area
    "regions": ["NSW"],                           // when one plan spans many
    "distributor": "Ausgrid",                     // network — part of identity
    "provider": "AGL",
    "plan": "Night Saver EV",
    "currency": "AUD",                            // ISO 4217
    "unit": "kWh",
    "timezone": "Australia/Sydney",               // meter-local TZ for from/to
    "source": "cdr",                              // manual|cdr|urdb|octopus|provider|other
    "sourceUrl": "https://...",
    "license": "CC0-1.0",
    "verified": false,
    "verifiedAgainst": "",                        // source URL / "own bill"
    "updated": "2026-06-20",                      // YYYY-MM-DD last verified
    "contributor": "",
    "notes": ""
  },

  "tariff": {
    "kind": "tou",                                // flat | tou
    "validFrom": "2026-06-20",                    // date the current rates took effect
    "supply": { "daily": 0.98 },                  // fixed charge, native unit / day

    "import": {                                   // consumption (buy)
      "flatRate": 0,                              // used when kind=flat
      "bands": [
        { "id": "ev",  "name": "Night Saver EV", "rate": 0.08, "color": "#22c55e" },
        { "id": "off", "name": "Off-peak",       "rate": 0.21, "color": "#f59e0b" },
        { "id": "pk",  "name": "Peak",           "rate": 0.40, "color": "#ef4444",
          "seasonRates": { "summer": 0.46 } }
        // v1.1: "tiers": [ { "upTo": 1000, "rate": 0.40 }, { "upTo": null, "rate": 0.36 } ]
      ],
      "schedule": [                               // interval-based, lossless
        { "days": "all", "from": "00:00", "to": "06:00", "band": "ev"  },
        { "days": "all", "from": "06:00", "to": "15:00", "band": "off" },
        { "days": "all", "from": "15:00", "to": "21:00", "band": "pk"  },
        { "days": "all", "from": "21:00", "to": "24:00", "band": "off" }
      ]
    },

    "export": {                                   // solar feed-in (optional)
      "flatRate": 0.05
      // or "bands" + "schedule" for ToU export
    },

    "controlledLoad": [                           // optional, separately metered
      { "id": "cl1", "name": "Controlled Load 1", "rate": 0.15 }
    ],

    "seasons": [                                  // optional
      { "id": "summer", "name": "Summer", "from": 11, "to": 1 }  // 0-indexed months, may wrap
    ]

    // v1.1 reserved: "demand": [ { "window": {...}, "rate": 12.5 } ]
  },

  "history": [                                    // optional prior versions
    { "validFrom": "2025-07-01", "validTo": "2026-06-19", "tariff": { /* ... */ } }
  ]
}
```

**`days` values:** `"all"` | `"weekday"` | `"weekend"` | explicit
`["mon","tue",...]`. **Wraps:** a `from` > `to` interval (e.g. `22:00`→`06:00`)
wraps midnight. **Adapter note:** the Wallbox 24-array adapter samples each hour's
*start* minute; sub-hour boundaries are rounded and the adapter `log`s the loss so
no precision disappears silently.

### Output of Phase 0
Decisions above are `DECIDED` except §6's two ToS confirmations (`DEFERRED` →
Phase 1). The rest is mechanical: finalise the Appendix-A schema, add CI + PII
scan, write the AU-CDR importer, the `wallbox` adapter, then the SDK + add-on
consumer. See `NEXT-STEPS.md`.
