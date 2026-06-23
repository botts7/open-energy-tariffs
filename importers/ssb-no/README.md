# SSB-NO importer (Norway — household average)

Maps the Norwegian household electricity price from **Statistics Norway (SSB)**
StatBank table **09387** (PxWeb JSON-stat2) into one canonical national-average entry.

- **What it is:** the all-in **NET** price households actually pay (after the
  government electricity support / strømstøtte), øre/kWh → NOK/kWh. Gross price,
  electricity, grid rent and the support amount are in `meta.notes`. Falls back to
  the gross price if the support series is empty.
- **Licence:** **NLOD** (Norwegian Licence for Open Government Data) → `meta.license: "other"`, attribute SSB.
- **Source:** <https://www.ssb.no/en/statbank/table/09387>

## Run (live, reproducible)
```
node importers/ssb-no/run.mjs --updated 2026-06-23
```
Writes `tariffs/NO/national/national-average/household-average-ssb.json`. Defaults to the latest quarter.
