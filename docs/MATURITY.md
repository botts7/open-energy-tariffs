# Maturity & honesty policy

We never claim more than we can back up. Every feature and every country's data
carries a tier, surfaced in the UI as a pill (see `map/maturity.js`). This is the
gate for what we promote externally.

## Tiers

| Tier | What it means | Promote externally? |
|------|----------------|---------------------|
| 🧪 **Experimental** | Illustrative; **not cross-checked** against an external source. May be inaccurate; shape may change. | No — share only with the "experimental" label, for feedback |
| 🔬 **Beta** | Real source data, **cross-checked against ≥1 authoritative reference** within tolerance, but coverage is limited and rates aren't bill-verified. | Yes, **with the "Beta" badge** — actively gathering feedback |
| ✅ **Verified** | Checked against an authoritative source **and** community-confirmed. | Yes, unflagged |

## How a country's data tier is decided (`OET.countryMaturity`)

- **Verified** — at least one plan has `meta.verified: true` (checked against a regulator/bill, recorded in `meta.verifiedAgainst`).
- **Beta** — has real bulk-import data (`source: cdr` AER, or `source: urdb`), unverified.
- **Experimental** — only hand-curated illustrative plans (`source: manual`), or no plans.

Today: **AU, US = Beta** (real AER/URDB imports); the ~50 single-plan countries = **Experimental**; nothing is **Verified** yet (honest — no rates have been bill-confirmed).

## Feature tiers (`OET.FEATURE_MATURITY`)

| Feature | Tier | Why |
|---------|------|-----|
| Browse / filter / search, cost-compare, map, geocoding, CSV import | Beta | works end-to-end on real data, young |
| Country price-ranking, PDF bill parsing | Experimental | aggregates thin data × approximate income/FX; fragile parsing |
| Schema · SDK · import + CI pipeline · self-test harness | Stable (plumbing) | tested, but no *consumer data* is Verified yet |

## Promotion gates

**Experimental → Beta** requires:
1. A cross-source sanity check — the country's median is within ~25% of an authoritative reference (Eurostat for EU, EIA for US; OWID/GlobalPetrolPrices for *sanity only*, never stored — see [LICENSING.md](../LICENSING.md)).
2. The self-test (`OET.selfTest()`) green for that data.

**Beta → Verified** requires:
1. Rates checked against an authoritative source/bill → `meta.verified: true` + `meta.verifiedAgainst`.
2. **Community confirmation** — independent "verified against my bill/regulator" reports (via GitHub Issues/Discussions), not our own say-so.

**Do not market on forums/social anything above its tier.** Beta is the ceiling for promotion until cross-validation + community confirmation land.

## Cross-source validation (planned)

The Eurostat + EIA baseline importers double as the truth-check: a CI step compares our per-country median to the reference band and flags divergence, so we never publish a wild number. Until that lands, the ranking stays **Experimental**.
