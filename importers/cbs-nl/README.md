# CBS-NL importer (Netherlands — household average)

Maps the Dutch household electricity price from **CBS (Statistics Netherlands)**
StatLine **85592NED** into a canonical v1 entry — one **national average** (incl. VAT),
standard (non-dynamic) contract.

- **What it is:** a national-average reference (CBS publishes country-level, not
  per-supplier). All-in per-kWh = energy contract + renewable surcharge (ODE) +
  energy tax; the large annual energy-tax rebate (heffingskorting) offsets the fixed
  transport/supply charges (often net-negative → no `supply` emitted). Component
  breakdown is in `meta.notes`.
- **Licence:** **CC-BY 4.0** (CBS) → `meta.license: "CC-BY-4.0"`, attribute CBS.
- **Source:** <https://opendata.cbs.nl/statline/#/CBS/nl/dataset/85592NED> (OData).

## Run — CI ONLY

CBS is **reachable from GitHub runners but blocked from the dev sandbox**, so this
runs via the `import-data` workflow (`sources: netherlands`), not locally:

```
node importers/cbs-nl/run.mjs --updated 2026-06-23     # works on a CI runner
```

Writes `tariffs/NL/national/national-average/<plan>.json`. The map logic is unit-
tested locally (`map.test.mjs`); only the fetch needs CI.
