# Attribution & source-licence compliance

Every entry under `tariffs/` carries `meta.license`, `meta.source`, and
`meta.sourceUrl`. Data licences are tracked **per entry**, not repo-wide. This
file records what each source requires and how we comply. See `ARCHITECTURE.md`
§6 for the decisions and `SOURCES.md` for the confirmed terms.

## Per-source obligations

| Source (`meta.source`) | Licence (`meta.license`) | Delivery | Attribution we must carry |
|---|---|---|---|
| `manual` (community / your own plan) | `CC0-1.0` | bulk-store | none (public-domain dedication) |
| `cdr` — Australian Energy Regulator generic plans | `other` (public CDR Product Reference Data) | bulk-store | **required** — see below |
| `urdb` — NREL / OpenEI Utility Rate Database | `CC0-1.0` | bulk-store | none required (courtesy citation only) |
| `octopus` — Octopus Energy API | — (no open licence) | **on-device import ONLY** | n/a — **never bulk-stored** |
| `provider` / `other` | per `meta.license` | per licence | per licence |

### AER (`source: "cdr"`) — public CDR Product Reference Data, attribution REQUIRED
AU energy plan data comes from the AER's **Consumer Data Right (CDR) Product
Reference Data (PRD) APIs** (`cdr.energymadeeasy.gov.au`) — the public,
unauthenticated channel the AER built to share Energy Made Easy plan data with
developers. It is **public, non-personal** product data, but it is **not** attached
to a formal open licence (it is *not* CC BY 4.0 — that covers the AER website, not
the plan data). We may store + display it; we record `license: "other"` and must
attribute the AER. When the AU-CDR importer bulk-commits entries, each must set:

```json
"meta": {
  "source": "cdr",
  "license": "other",
  "sourceUrl": "https://www.aer.gov.au/energy-product-reference-data"
}
```

and the redistributed dataset must display this notice (the SDK/consumer surfaces
it; the build also emits it into `dist`):

> Australian energy plan data via the AER's public Consumer Data Right (CDR)
> Product Reference Data API. © Australian Energy Regulator / retailers. Not
> endorsed by the AER.

### OpenEI URDB (`source: "urdb"`) — CC0, no attribution required
OpenEI platform content is "Creative Commons Zero unless otherwise noted" (NREL /
US DOE). No attribution is legally required; we cite OpenEI/NREL as a courtesy in
`meta.sourceUrl`. Quality caveat: URDB contains user-submitted entries, so keep
`verified: false` until an entry is checked against an authoritative source.

### Octopus Energy (`source: "octopus"`) — NOT redistributable
Octopus's Terms of Use prohibit selling, licensing, distributing or otherwise
making available its content. We therefore **never bulk-store Octopus data**. The
SDK ships an **on-device importer** that fetches rates from the user's own device
at runtime (`api.octopus.energy/v1/products/...`, no auth). Hand-authored
illustrative examples (invented rates, `source: "manual"`, CC0) are fine and are
**not** Octopus data.

## Displaying data (maps, dashboards, the map/ viewer)

- **CDR / AER (public CDR Product Reference Data):** rates **may be displayed/redistributed** (e.g. on a
  public GitHub Pages map) **with attribution shown where the data appears** —
  "© AER, via CDR Product Reference Data, not endorsed by the AER". The `map/` viewer shows this in its
  attribution control.
- **URDB (CC0):** display freely (cite OpenEI/NREL as courtesy).
- **Octopus (no licence):** do **not** display from stored/redistributed data. A
  consumer may still show a user their Octopus rates by **fetching live on-device**
  at runtime (the user pulling their own data is not us redistributing).

## Test fixtures & sample data

Fixtures and demo/sample data are committed and therefore **redistributed**, so the
same rules apply to them:
- `cdr` (CDR PRD) and `urdb` (CC0) fixtures **may** contain real captured values.
- **`octopus` fixtures/sample must use ILLUSTRATIVE rates, never real captured
  values** — only the data *structure* (field names, the `varying` key) is kept, to
  document the API shape. Real Octopus rates live only in the on-device path.

## CI enforcement (Phase 2)
The validation workflow rejects an entry whose `(source, license)` pair violates
this table — e.g. `source: "octopus"` with real bulk data, or `source: "cdr"`
without `license: "other"` (public CDR Product Reference Data).
