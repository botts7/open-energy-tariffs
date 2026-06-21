# Test plan

How we check the coverage map + data before a release, so the bugs that bit us
once don't come back. Two layers: an **automated harness** (run it, read the
table) and a **manual/visual checklist** (things a script can't see).

## 1. Automated — CI (data + logic)

Runs on every PR via `.github/workflows/validate.yml` (`npm run check`):

| Gate | Catches |
|------|---------|
| `npm test` (node --test) | importer/adapter mapping + SDK cost engine + schema conformance |
| `npm run pii` | account/meter/identity data, secrets, mis-flagged URLs (`scripts/pii-scan.mjs`) |
| `npm run validate` | schema (ajv) + unique `meta.id` + licence-compliance rules |
| `npm run build` | bundle compiles; `index.json` not stale |

**When you add a parser or cost function, add a `*.test.mjs` case** so it's covered here.

## 2. Automated — browser self-test (app behaviour)

`map/selftest.js` encodes the runtime invariants. Run either way:

- Open **`map/?selftest=1`** → it auto-runs ~1.5s after load and prints a table to the console.
- Or in the console: **`await OET.selfTest()`** → `{passed, failed, total, results}`. Pass `{online:false}` to skip the geocoder (network) tests.

It asserts:

- **Data integrity (per country):** every plan has a finite rate > 0, a currency/source/licence, **locates on the map**, and every `coverage.national` plan resolves a country geometry. *(This catches the GB/US/HK "no map area" class.)*
- **Cost engine (per currency):** `usageFromAnnual`/`usageFromBands` shape; **one plan per distinct currency** estimates without NaN and `estimateAnnualCost` agrees with `costBreakdown`; TOU has ≥2 bands, flat has 1.
- **CSV parsers:** long (timestamp,kWh) and wide 48-column both detect + parse; wide **dedupes** duplicate rows.
- **UI/theme:** dark mode adds/removes the dark map tiles; the guide opens and Esc-closes; help/theme/nav buttons exist.
- **Geocoding (online):** `"london"`→GB, `"sydney"`→AU, country-scoped `manchester` stays GB, **worldwide `"sunset strip"` ranks US first (no AU bias)**, and results carry an ISO-2 country code. *(This is the class that kept biting — "only AUS works".)*

A green run is the gate; investigate any ✗ before release.

## 3. Manual / visual checklist

Things the harness can't judge — do these in the browser (desktop + a ~390px mobile width), light **and** dark:

**Search & location**
- [ ] Type a place in several countries (`london`, `berlin`, `new york`, an AU suburb, a US ZIP-area) → suggestions show the **right country first**; picking one **switches the country filter** and zooms the map.
- [ ] Address with no country selected does **not** silently resolve to an AU postcode.
- [ ] `📍 Find address` (Enter) pins the exact spot.

**Browse / filter / sort**
- [ ] Country → distributor → provider combos filter hierarchically (no DEWA under an AU baseline).
- [ ] Flat-vs-ToU filter; sort cheapest-for-usage reorders sensibly.
- [ ] Reset clears everything; the URL hash round-trips (copy link → reopen).

**Compare**
- [ ] Enter annual kWh / per-band / upload an interval **CSV** / a **bill PDF** → usage feeds the estimates.
- [ ] Set a current plan (or actual $) → savings show green/red vs candidates.
- [ ] A plan modal shows bands, schedule, per-band breakdown, side-by-side vs current; **+ Compare** stacks columns.

**Map**
- [ ] Pick a country/postcode → coverage areas draw; the "N areas hidden" hint appears at the full-data view.
- [ ] Real ABS boundary loads on the "Exact boundary" button (AU); base-layer switch (street/satellite) works.

**Chrome / theme / mobile**
- [ ] Light/dark toggle persists across reload; map tiles + popups + modal all themed.
- [ ] ≤760px: hamburger opens the sidebar slide-over; tapping the map closes it.
- [ ] First visit auto-opens the guide once; the `?` button reopens it.

**Console**
- [ ] Zero errors across all of the above (DevTools console).

## 4. Cross-country matrix

Don't test AU only — pick at least one from each: **AU** (postcode depth), **US** (state-level, USD), **GB** (ToU), a **Eurozone** country (EUR), and a **non-Latin / RTL-ish currency** (JPY/HKD). For each: it locates on the map, the modal renders, and a cost estimate is sane in its own currency.

## 5. Regression log (now covered by §2)

| Bug | Now asserted by |
|-----|-----------------|
| "Only AUS works" — geocoder hardcoded to `countrycodes=au` | geo: london→GB, sydney→AU |
| `"sunset strip"` showed AU (map-centre bias + no country switch) | geo: worldwide sunset strip ranks US first |
| GB/US/HK "no map area" (missing `coverage`/centroid) | data: every plan locates |
| TOU plan showed only one band (importer keyed on `type`) | cost: TOU has ≥2 bands (+ importer unit test) |
| CSV usage 3× too high (duplicate merged rows) | parser: wide dedupes |
| PII scanner false-positives (street acronym, URL blob) | `npm run pii` (CI) + URL-aware rules |
| index.json stale (escaped vs raw UTF-8) | `npm run build` stale check (CI) |

When a new bug is found: fix it, **add an assertion** (here or a `*.test.mjs`), then add a row above.

## 6. Pre-release gate

1. CI green on `main` (validate + pages).
2. `OET.selfTest()` → 0 failures (online).
3. Manual checklist §3 done on desktop + mobile, light + dark, ≥3 countries.
4. Console clean; licence/attribution still shown in-map.
