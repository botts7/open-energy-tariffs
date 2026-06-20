# Attribution & source-licence compliance

Every entry under `tariffs/` carries `meta.license`, `meta.source`, and
`meta.sourceUrl`. Data licences are tracked **per entry**, not repo-wide. This
file records what each source requires and how we comply. See `ARCHITECTURE.md`
§6 for the decisions and `SOURCES.md` for the confirmed terms.

## Per-source obligations

| Source (`meta.source`) | Licence (`meta.license`) | Delivery | Attribution we must carry |
|---|---|---|---|
| `manual` (community / your own plan) | `CC0-1.0` | bulk-store | none (public-domain dedication) |
| `cdr` — Australian Energy Regulator generic plans | `CC-BY-4.0` | bulk-store | **required** — see below |
| `urdb` — NREL / OpenEI Utility Rate Database | `CC0-1.0` | bulk-store | none required (courtesy citation only) |
| `octopus` — Octopus Energy API | — (no open licence) | **on-device import ONLY** | n/a — **never bulk-stored** |
| `provider` / `other` | per `meta.license` | per licence | per licence |

### AER (`source: "cdr"`) — CC BY 4.0, attribution REQUIRED
AER website material (incl. CDR generic-plan data behind
`cdr.energymadeeasy.gov.au`) is licensed **CC BY 4.0**. When the AU-CDR importer
bulk-commits entries, each must set:

```json
"meta": {
  "source": "cdr",
  "license": "CC-BY-4.0",
  "sourceUrl": "https://www.aer.gov.au/energy-product-reference-data"
}
```

and the redistributed dataset must display this notice (the SDK/consumer surfaces
it; the build also emits it into `dist`):

> Contains data © Australian Energy Regulator, used under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Not endorsed by the AER.

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

## CI enforcement (Phase 2)
The validation workflow rejects an entry whose `(source, license)` pair violates
this table — e.g. `source: "octopus"` with real bulk data, or `source: "cdr"`
without `license: "CC-BY-4.0"`.
