# TW-Taipower importer (Taiwan — residential time-of-use)

Maps Taipower's **simplified residential time-of-use** tariffs (簡易型時間電價) — both
the **two-section** (peak/off-peak) and **three-section** (peak/half-peak/off-peak)
options — into canonical v1 entries with summer/non-summer rates (`band.seasonRates`),
a `summer` season (Jun–Sep), and a weekday/weekend schedule.

- **Scope:** the **ToU** residential tariffs only. Taipower's *standard* residential
  tariff is block/tiered, which v1's `flat|tou` kinds can't model yet (needs v1.1
  `tiers`) — so it's intentionally out of scope.
- **N-band model:** `map.mjs` is generic over bands (a band with no `windows` is the
  off-peak fill). Three-section's peak band exists only in summer, so the summer
  windows are canonical; see the modelling note below.
- **Licence:** **Open Government Data License, Taiwan (OGDL)** — CC-BY-4.0-compatible.
  Recorded as `meta.license: "other"` + Taipower / data.gov.tw attribution in `notes`.
- **Source:** data.gov.tw dataset **17060** → Taipower's machine-readable rate JSON
  (`service.taipower.com.tw/.../d007008/001.json`, "簡要電價表"). No auth.

## Run (live, reproducible)

```
node importers/tw-taipower/run.mjs --updated 2026-06-22
node importers/tw-taipower/run.mjs --record path/to/record.json   # offline override
```

Fetches the live JSON, extracts `簡易型時間電價(二段式)`, and writes
`tariffs/TW/national/taipower/<plan>.json`. Re-running picks up rate changes, so
the data stays current without hand-editing.

## Modelling note: season-dependent windows

Taipower's peak **windows** differ by season (summer weekday peak 09:00–24:00;
non-summer 06:00–11:00 + 14:00–24:00). v1 supports per-season *rates*
(`band.seasonRates`) but a single *schedule*, so the importer uses the **non-summer
windows** (8 months of the year) as canonical and records the summer window in
`meta.notes`. The summer/non-summer **rates** are both captured correctly. The
`>2,000 kWh/month` surcharge isn't modelled (needs v1.1 tiers).
