# CH-ElCom importer (Switzerland — household electricity prices)

Maps the Swiss **Federal Electricity Commission (ElCom)** electricity-price data
into canonical v1 entries — one flat household tariff per **network operator**.

- **What it is:** the **standard supply** (Grundversorgung) all-in price for the
  ElCom reference household profile **H4** (~4,500 kWh/yr — a 5-room flat with
  electric stove). `import.flatRate` is the all-in Rp→CHF/kWh (energy + grid +
  federal surcharge + cantonal/community taxes); `supply.daily` is the annual fixed
  cost ÷ 365. The component breakdown is in `meta.notes`.
- **Coverage:** Switzerland has ~550 operators; each entry's `notes` says how many
  municipalities it serves. (No per-municipality polygons mapped — operators are
  the unit, like the Danish DSOs.)
- **Licence:** opendata.swiss **"Open use" (`terms_open`)** — free reuse incl.
  commercial, no conditions. `meta.license: "other"`; ElCom attributed as courtesy.
- **Source:** ElCom "electricityprice" RDF cube on **LINDAS** (SPARQL,
  `lindas.admin.ch/query`, graph `…/elcom/electricityprice`); browse at
  <https://www.strompreis.elcom.admin.ch/>. data.gov dataset
  `strompreis-per-stromnetzbetreiber`.

## Run (live, reproducible)

```
node importers/ch-elcom/run.mjs --updated 2026-06-22        # latest period
node importers/ch-elcom/run.mjs --period 2026 --updated 2026-06-22
```

Writes `tariffs/CH/national/<operator>/standard-supply-household-h4.json`. Defaults
to the **latest** period, so re-running each year refreshes prices to stable ids.
Then `npm run validate && npm run build`.

## Notes

- The SPARQL query groups by operator (price is constant across an operator's
  municipalities) and takes category **H4** + product **standard**. Change via
  `fetchElcom({ category, product, period })` for other profiles (H1–H8) or the
  "cheapest" product.
- ToU isn't modelled here — standard household supply is a flat all-in price in the
  ElCom data; the per-kWh figure already folds in grid + taxes.
