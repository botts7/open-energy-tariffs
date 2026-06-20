# Octopus importer (UK) — ON-DEVICE ONLY

Maps Octopus Energy products into the canonical schema **at runtime, on the
user's own device**. Output is the user's own data and is **never committed** to
`tariffs/`.

## Why on-device only

Octopus's Terms of Use forbid redistributing its content (see `../../SOURCES.md`
+ `../../ATTRIBUTION.md`). So this importer is shipped as code the SDK/consumer
runs locally — we never bulk-store Octopus rates. Output carries
`meta.source: "octopus"`, which the **stored schema deliberately rejects** — that
exclusion is the safety net (a test asserts it).

## Source

- **API:** `https://api.octopus.energy/v1/products/` and
  `…/products/{code}/` — **no auth** for product data.
- **Scope:** STATIC products only — single-register (flat/variable) and
  dual-register (Economy 7). DYNAMIC products (Agile/Flux/Tracker, half-hourly)
  are **refused** — consume the live HA price entity instead (`SOURCES.md`).

## Files

| File | Role |
|---|---|
| `map.mjs` | **Pure** `mapProduct(detail, {gsp,paymentMethod,nightWindow,updated})`. |
| `fetch.mjs` | `fetchProducts()` / `fetchProduct(code)` (no auth). |
| `index.mjs` | `importOctopusProduct(code, opts)` = fetch + map. |
| `fixtures/` + `map.test.mjs` | **real** Flexible Octopus capture (single + dual register), structural validity, dynamic-refusal, custom night window, the stored-schema-rejects-octopus guard. |

Products with both single- and dual-register tariffs (e.g. Flexible) map to flat
by default; pass `register: 'dual'` for the Economy 7 view.

## Use (from a consumer / the SDK)

```js
import { importOctopusProduct } from 'open-energy-tariffs/importers/octopus';
const entry = await importOctopusProduct('VAR-22-11-01', { gsp: '_C' });
client.apply(entry, 'wallbox');   // apply it like any canonical entry — never PR it
```

## Verified against a real capture (2026-06-20)

Tested against a live `GET /v1/products/VAR-22-11-01/`. Real-shape fix folded in:
- the per-GSP tariff is keyed by **payment method** — variable products use
  **`varying`** (not `direct_debit_monthly`); `pickTariff()` resolves by preference
  and `day/night_unit_rate_inc_vat` are present inline.

Still meter-specific / not in the API: the **Economy 7 night window** — the
importer applies a default (00:30–07:30); let users override via `nightWindow`.
Not yet handled: time-of-use export (`four_rate_ev_electricity_tariffs`) and
half-hourly Go/Agile (refused as dynamic).
