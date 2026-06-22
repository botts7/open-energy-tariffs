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
node importers/cre-fr/run.mjs --option BASE --updated 2026-06-22
node importers/cre-fr/run.mjs --option HPHC --updated 2026-06-22
```

The CRE CSV URLs are built in, so `--base` is optional (override only if they move).
Writes to `tariffs/FR/national/edf/<plan>.json` — currently **13 plans** (Base 3-15
kVA + HP/HC 6-36 kVA).

## Confirmed against the live files (Feb 2026)

- Columns: `DATE_DEBUT;DATE_FIN;P_SOUSCRITE;PART_FIXE_HT;PART_FIXE_TTC;…` — Base adds
  `PART_VARIABLE_TTC`; HP/HC adds `PART_VARIABLE_HC_TTC` + `PART_VARIABLE_HP_TTC`.
- Dates are **DD/MM/YYYY** (converted to ISO); prices are already **€/kWh** (TTC =
  incl. tax); the fixed part is **€/year**. Only current rows (empty `DATE_FIN`) are
  kept, latest per subscribed power.

## Caveats

- **Heures Creuses windows** aren't in the CRE file (Enedis sets them per
  connection) → the national default `22:00–06:00` is used. Pass real windows via
  `normaliseRows(rows, 'HPHC', { 6: [{from,to}] })` if known.
- **Tempo** (day-colour Bleu/Blanc/Rouge × HP/HC) is **skipped** — a day-type
  scheme v1 can't model yet (needs v1.1 day-type seasons).
