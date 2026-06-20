# CSV importer — bulk-add (flat) plans from a spreadsheet

For contributors who have plans in a spreadsheet. Maps a CSV to canonical entries.
(Time-of-use plans are richer than a flat row — author those directly as JSON.)

## Columns

| Column | | |
|---|---|---|
| `country` `provider` `plan` `currency` | **required** | ISO-2 country, ISO-4217 currency |
| `flatRate` | flat per-kWh rate | `supplyDaily` = daily supply charge |
| `region` `timezone` `source` `license` `updated` `sourceUrl` | optional | sensible defaults (`manual` / `CC0-1.0` / per-country TZ) |
| `national` | `yes` → `coverage.national` | `postcodes` = `;`-separated list |
| `notes` | free text | |

See `sample.csv`.

## Run

```sh
node importers/csv/run.mjs path/to/plans.csv --updated 2026-06-21   # add --dry to preview
npm run validate && npm run build
```

## Licence

CSV-sourced entries default to `source: manual`, `license: CC0-1.0` (community
facts). If you set `source: cdr` the licence is forced to `CC-BY-4.0`. Never
import non-redistributable data (e.g. Octopus) — see `../../ATTRIBUTION.md`.
