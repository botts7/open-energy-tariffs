# CRE-FR importer (France — regulated Tarif Bleu)

Maps the French **Tarif réglementé de vente** (EDF *Tarif Bleu*) — published by the
**CRE** as open data on **data.gouv.fr** — into canonical v1 entries.

- **Coverage:** national (Enedis network). One entry per *option × subscribed power*
  (kVA): **Base** (flat) and **HP/HC** (two-band Heures Pleines / Heures Creuses).
- **Licence:** **Licence Ouverte / Etalab 2.0** — commercial reuse + redistribution
  with attribution. Etalab 2.0 is CC-BY-compatible but not literally CC BY 4.0, so
  entries are written with `meta.license: "other"` + CRE attribution in `meta.notes`.
- **Source:** <https://www.data.gouv.fr/fr/datasets/historique-des-tarifs-reglementes-de-vente-delectricite/>

## Run

```
node importers/cre-fr/run.mjs --base <CSV resource URL> --option HPHC --updated 2026-06-20
node importers/cre-fr/run.mjs --base <CSV resource URL> --option BASE --updated 2026-06-20
```

Writes to `tariffs/FR/national/edf/<plan>.json`.

## ⚠️ Verify before trusting output

`map.mjs` is authored from the documented French grid; `fetch.mjs`'s column map is
a best-effort guess. Before committing real data:

1. **Confirm CSV headers** — `P_SOUSCRITE`, `PART_FIXE[_TTC]`, `PART_VARIABLE[_HP|_HC]`,
   `DATE_DEBUT` (names drift between yearly releases).
2. **Confirm units** — CRE price columns are commonly **c€/kWh** and the fixed part
   **€/year incl. taxes (TTC)**. If a file is in c€/kWh, set `UNIT_DIVISOR.price = 100`
   in `fetch.mjs` so `import.*` is **€/kWh** and `supply.daily` is **€/day**.
3. **Heures Creuses windows** aren't in the price file (Enedis sets them per
   connection); the national default `22:00–06:00` is used. Pass real windows via
   `normaliseRows(rows, 'HPHC', { 6: [{from,to}] })` if known.
4. **Tempo** (day-colour Bleu/Blanc/Rouge × HP/HC) is **skipped** — a day-type
   scheme v1 can't model yet (needs v1.1 day-type seasons).

Then `npm run validate`.
