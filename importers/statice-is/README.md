# Hagstofa-IS importer (Iceland — household average)

Maps Icelandic household electricity prices from **Statistics Iceland (Hagstofa)**
PxWeb table **IDN02303** — one flat entry per household consumption band, all-taxes-
included, ISK/kWh. CC-BY 4.0, attribute Hagstofa. Hagstofa's English series ends ~2022;
Iceland's hydro/geothermal market is stable, and the period is on every entry.

```
node importers/statice-is/run.mjs --updated 2026-06-23
```
