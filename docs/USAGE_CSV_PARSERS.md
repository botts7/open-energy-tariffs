# Adding a usage-CSV parser (community)

Every distributor/retailer exports interval usage in a slightly different CSV.
The map's "Compare to my usage" uploader runs a small **registry** of parsers and
uses the first one that recognises the file. Adding support for a new format is a
self-contained PR — no need to touch the rest of the app.

## What a parser is

```js
OET.registerUsageParser({
  id: 'my-distributor',                 // unique slug
  label: 'My Distributor interval export',
  detect(text) { return /* true if this file is your format */; },
  parse(text)  { return /* a result object, or null */; },
});
```

`detect(text)` gets the raw file text and returns `true`/`false` (keep it cheap —
look at the header row). `parse(text)` returns:

```js
{
  profile: { weekday: [24], weekend: [24] },  // REQUIRED: avg kWh per hour-of-day
  annualKwh,                                   // REQUIRED: estimated total kWh/yr
  exportKwh,        // optional: annual solar export kWh (feed-in credit)
  intervals,        // optional: { intervals:[{we,hour,kwh}], days, totalKwh } for exact replay
  duplicates,       // optional: count of duplicate rows you skipped (shown to the user)
  hasExport,        // optional: bool
}
```

The cost engine does the rest — it costs your `profile` against **each plan's own**
time-of-use bands. You only have to turn the file into that profile.

### Helpers you can reuse (`map/cost.js`)
- `OET.parseWideCsv(text)` — distributor 48-column half-hourly export (one row/day,
  `CON/GEN` column). Handles tab/comma, `DD/MM/YYYY`, GEN→export, de-dupes identical rows.
- `OET.parseUsageCsv(text)` / `OET.parseIntervals(text)` — long format (`timestamp,kWh`).
- The `profile` is **average kWh in each hour** (weekday & weekend separately); the
  engine annualises with ~261 weekdays + ~104 weekend days.

## How to contribute

1. Add `map/usage-parsers/<your-format>.js` with a single `OET.registerUsageParser({…})`.
2. Add a `<script src="usage-parsers/<your-format>.js"></script>` line in `map/index.html`
   (after `cost.js`).
3. Include a **small, anonymised** sample file under `map/usage-parsers/samples/`
   (strip NMI / meter serial / address) so reviewers can verify it.
4. Open a PR describing the distributor/retailer and where the export comes from.

The two built-in parsers (`wide-interval`, `long-interval`) in `map/cost.js` are the
reference examples. Keep parsers pure (no network, no DOM) so they stay testable.
