# Plan: data-rich comparison view (the "decide" layer)

The map answers *"what plans exist near me."* A comparison view answers *"which
plan is cheapest/best for **my** usage, and why."* This plan adds that as a
toggleable alternative layout, informed by reviewing Victorian Energy Compare
(gov, gold standard), Compare the Market, and Canstar.

## The model: two views, one dataset

- **Map view = "browse"** (current) — geographic, what serves an area.
- **Table view = "decide"** (new) — a cheapest-first, sortable comparison table.
- A **view toggle** (Map ⇄ Table) in the header; both read the same filtered plan
  set + the same usage, so switching never loses context.

## Layout: left config · right results (your ask)

```
┌── header: brand · view toggle (Map|Table) · universal search · 🌍 ? ◐ ──┐
├───────────────┬──────────────────────────────────────────────────────┤
│  LEFT (config)│  RIGHT (results)                                       │
│  • location / │   Map view:   the Leaflet map (as today)               │
│    use-my-loc │   Table view: cheapest-first sortable comparison table │
│  • usage      │                                                        │
│    wizard     │   [period: annual | quarterly | monthly]               │
│  • filters    │                                                        │
│  • compare    │                                                        │
└───────────────┴──────────────────────────────────────────────────────┘
```

On mobile the left panel stays the hamburger slide-over; the table stacks to cards.

## What we ALREADY have (reuse, don't rebuild)

| Need | Have |
|------|------|
| Estimated annual cost + cheapest-first sort | `estimateAnnualCost` / `costBreakdown`, `sort=cost` |
| Usage personalisation (kWh / per-band / CSV / bill PDF / use-my-location) | done |
| Decomposed rate data (bands, supply.daily, export feed-in) | in the schema |
| Reference benchmark | `crossCheck`/`crossCheckRegion` (Eurostat/EIA) → "% vs reference" |
| Independence + freshness + maturity signals | attribution, `freshness.js`, maturity pills |
| Side-by-side compare (2–4 plans) | `showCompareModal` + compare set |

## What's NEW to build

1. **Table renderer** (`map/table.js`): a sortable, multi-column table over the
   filtered plans. Columns: provider · plan (+ maturity/ref/freshness badges) ·
   **estimated cost (hero)** · effective rate c/kWh · supply c/day · ToU bands ·
   solar feed-in · **% vs reference** · compare checkbox. Click a header to sort;
   default = estimated cost ascending. Row click → existing plan modal.
2. **View toggle** (header Map ⇄ Table) + the **left/right layout** restructure
   (filters/usage move to a dedicated left config rail; results area swaps map↔table).
3. **Cost-period toggle** (annual / quarterly / monthly) — universal convention;
   trivial (÷4, ÷12) over the annual estimate.
4. **Reference-% column** from `crossCheck` (already computed) — "12% below / 8%
   above reference," the trust anchor every site uses.
5. **Empty/usage nudge**: if no usage entered, the table still works on a typical
   profile (we have `typicalUsage`) but shows a "enter your usage for accurate
   costs" prompt — Canstar's weakness, our chance to do better.

## Phasing

- **Phase 1 (MVP):** `table.js` + view toggle + left/right layout + cost-period
  toggle + reuse cost/sort/compare. Ships the core "decide" view.
- **Phase 2:** reference-% column, freshness/maturity in the table, column
  filters (green%, no-exit-fee, solar, tariff type), card stacking on mobile.
- **Phase 3 (AU-specific, optional):** Default Market Offer / Victorian Default
  Offer benchmark for the regulated "X% vs reference price" anchor (the others
  use our cross-source baseline); guided "find my best plan" wizard flow.

## Universal vs AU-specific (keep it global)

- **Universal:** cost-hero + cheapest sort, sortable table, decomposed columns,
  usage input, period toggle, freshness/independence signals, side-by-side.
- **AU-specific (phase 3):** DMO/VDO reference-price benchmark, NMI smart-meter
  pull, Energy Fact Sheet links. Elsewhere the cross-source baseline (Eurostat/
  EIA/our median) is the benchmark.

## Guardrails (don't regress what makes us credible)

- Keep maturity + freshness + "verify your bill" honesty in the table too.
- No commissions, all plans we have, link to `meta.sourceUrl` — lean into the
  VEC independence model as our differentiator.
- Estimated cost is illustrative until usage is entered; say so.

## Build mechanics

- New work on branch **`feature/comparison-table`**; Phase 1 is self-contained
  (`table.js` + layout CSS + toggle wiring), low risk to the map.
- Self-test gains table assertions (sort order, period math, reference column).
