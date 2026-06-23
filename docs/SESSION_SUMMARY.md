# Session summary — real-data buildout + architecture

A snapshot of what the project gained this session, and how to run / extend it.

## What's live

- **45 real-data countries** in the core repo (up from a handful), all schema-valid,
  PII-clean, honestly labelled, under permissive licences (CC-BY / CC0 / open-gov).
  ~6,200 tariffs total.
- A **permissive core + opt-in copyleft overlay** architecture, an enforced
  **licence shield**, a **contribution pipeline**, and **honesty layers**
  (maturity / estimate warnings / semantic band roles).

## Importers (core)

| Importer | Country | Coverage | Source | Lane |
|---|---|---|---|---|
| `cdr` | 🇦🇺 AU | 5,226 plans | AER CDR PRD API | local |
| `urdb` | 🇺🇸 US | 314 | NREL OpenEI URDB | local |
| `ch-elcom` | 🇨🇭 CH | 550 operators | ElCom via LINDAS SPARQL | local |
| `dk-energinet` | 🇩🇰 DK | 24 DSOs | Energi Data Service REST | local |
| `cre-fr` | 🇫🇷 FR | 13 (Tarif Bleu) | CRE CSV (data.gouv.fr) | local |
| `tw-taipower` | 🇹🇼 TW | 2 (ToU 2/3-section) | Taipower rate JSON | local |
| `statfi-fi` | 🇫🇮 FI | 5 bands | Statistics Finland PxWeb | local |
| `ssb-no` | 🇳🇴 NO | 1 (net of subsidy) | Statistics Norway PxWeb | local |
| `statice-is` | 🇮🇸 IS | 5 bands | Statistics Iceland PxWeb | local |
| `cbs-nl` | 🇳🇱 NL | 1 | CBS StatLine OData | **CI** |
| `eurostat` | 🇪🇺 ×35 | 1 each | Eurostat nrg_pc_204 | **CI** |

Extended (copyleft) repo: [`open-energy-tariffs-extended`](https://github.com/botts7/open-energy-tariffs-extended)
— `co-superservicios` 🇨🇴 CO, 36 utilities, **CC-BY-SA**, opt-in only.

## How to run / refresh

**Local importers** (reachable from any dev box):
```
node importers/<name>/run.mjs --updated YYYY-MM-DD
npm run validate && npm run build      # schema + PII + rebuild index.json
```
Importers are **deterministic** + default to the latest period, so re-running just
refreshes the data. Commit `tariffs/**` + `index.json`.

**CI-only importers** (source blocked from a dev box but reachable from runners):
GitHub → Actions → **import-data** → `workflow_dispatch` → pick `sources` (e.g.
`netherlands`, `eurostat`) → it fetches, validates, builds, and **opens a data PR** →
review + merge. (`git add -A`, so estimate replacements/deletions are included.)

## How to add a new country

1. **Probe reachability + find the table/API** (PxWeb, OData, SPARQL, CKAN, Socrata,
   REST/JSON, CSV). Most national stats offices have a clean key-less API.
2. **Build** `importers/<name>/{fetch,map,run}.mjs` + `map.test.mjs` (mirror an
   existing one). Keep `map` pure + unit-tested; `fetch` does the I/O.
3. **Lane:**
   - *Locally reachable* → run + test here, commit (`tariffs/<CC>/…`).
   - *Sandbox-blocked but CI-reachable* → add a step to `.github/workflows/import-data.yml`,
     unit-test the parse with a synthetic fixture, dispatch the workflow, review the PR.
   - *Copyleft (CC-BY-SA / ODbL)* → build it in the **extended repo** instead (the
     core CI rejects copyleft licences).
4. Replace any old "calibrated estimate" placeholder for that country.

## Architecture pieces added this session

- **Opt-in copyleft overlay** — `OET.loadExtended()` fetches the extended repo's
  published feed; a 🌐 header toggle merges it **client-side, on opt-in** (with a
  CC-BY-SA disclosure). The core never ships a merged share-alike artifact.
- **Licence shield** — `scripts/validate.mjs` rejects any copyleft/share-alike
  licence in core `tariffs/` (enforced in CI), so the core stays uniformly permissive.
- **Contribution pipeline** — `schema/source-manifest.schema.json` +
  `scripts/validate-submission.mjs` (licence allow-list + routing core/extended +
  rejects NC/all-rights-reserved) + the **"Add a data source"** issue form +
  `submission` workflow. See `CONTRIBUTING.md`. *(The right tool for the remaining
  registration-walled countries — JP/KR/IN etc. — when a local provides a source/key.)*
- **Honesty layers** — `maturity.js`: `experimental/beta/verified` per country;
  `provider`-sourced importers read **beta/real**; circular cross-check promotion
  of calibrated estimates is skipped. Estimate-only countries show a prominent
  **data-warning** (modal + compare view). Band **`role`** (peak/shoulder/offpeak…)
  is the semantic layer for app logic (colour/sort/compare), kept separate from the
  source-native `name` (for future i18n).

## The walls (remaining ~27 non-EU countries)

- **Geo-blocked**: Brazil ANEEL (blocks foreign/datacenter IPs — sandbox *and* CI).
- **WAF / 403**: Belgium VREG.
- **Registration-gated**: Japan e-Stat (`appId`), Korea data.go.kr (`serviceKey`),
  India data.gov.in (JanParichay needs an Indian mobile). → use the contribution
  pipeline, or supply a key.
