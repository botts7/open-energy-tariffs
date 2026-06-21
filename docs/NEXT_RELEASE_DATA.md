# Next-release data plan

Consolidated from a license-audited research sweep (open-bulk sources · EMEA ·
APAC+Americas). Today: **52 countries, but only AU (5,226) & US (314) are deep** —
the rest are single illustrative plans. Goal: more countries + more real plans,
under a clean license. Rule unchanged: **bulk-store only CC-BY / CC0 / public
domain / open-gov; hand-curate regulator rates as facts (+ attribution).**

## ⚠️ Compliance items to resolve FIRST

1. **AER (our AU source) redistribution** — the AER states it is *barred from
   broadly sharing/redistributing* the Energy Made Easy plan data; consuming it
   via the CDR APIs is fine, but **bulk-republishing our 5,226 AU plans may be a
   grey zone**. This is our single largest dataset — re-read the CDR/AER terms and
   decide (republish vs. on-device-only) before the next release.
2. **Stale data to correct now:**
   - **Argentina** — the N1/N2/N3 subsidy tiers were **abolished** → binary "SEF"
     scheme (Decreto 943/2025, eff. Jan 2026). Our AR plan is outdated.
   - **Malaysia** — new **RP4** tariff (eff. 1 Jul 2025, unbundled + optional ToU).
     Our MY plan predates the restructuring.

## A. Build importers — machine-readable + clean license (highest ROI)

| # | Source | Country | License | What it gives | Effort |
|---|--------|---------|---------|---------------|--------|
| 1 | **ANEEL Dados Abertos** (CSV + CKAN API) | 🇧🇷 BR | open-gov (LAI), attribution | B1 residential TE+TUSD all distributors + Tarifa Branca (ToU) + bandeiras adders | Med (portal blocks naïve server-fetch → fetch in CI/browser) |
| 2 | **Ontario OEB Open Data** | 🇨🇦 CA-ON | **OGL-Ontario** (commercial OK) | RPP **ToU + tiered** residential, fixed charge; yearly cadence | Low |
| 3 | **data.gov.sg + SP XLSX** | 🇸🇬 SG | Singapore OGL | regulated tariff (deepen SG + a clean reference) | Low |
| 4 | **ARESEP open data** (API + Excel) | 🇨🇷 CR *(new)* | official open data | block + **ToU (T-REH)** residential | Low-Med |
| 5 | **Sarawak Energy** (XLSX/DOCX) | 🇲🇾 MY-Sarawak | **CC-BY** | Tariff D blocks (open-licensed; complements TNB RP4) | Low |
| 6 | **IURDB international** (extend our URDB importer) | intl (BZ, MX tail) | **CC0** | full structures; near-zero marginal effort | Low (thin coverage) |
| 7 | **Meralco monthly S3 PDFs** (predictable URLs) | 🇵🇭 PH | public | all-in + block distribution + lifeline; deepen PH | Med |

## B. New countries to hand-curate (regulator facts + attribution)

~30 viable additions (store the citizen/primary-residence tier; note variants).

- **EMEA (top):** Iceland (stats-office, best license), Croatia (HEP flat+ToU),
  Lithuania (Ignitis/VERT), Bahrain · Oman · Qatar · Kuwait · Jordan (Gulf/ME
  tiered), Bulgaria · Slovakia (regulator), Ghana (PURC+ECG). *Second tier:*
  Cyprus, Malta, Latvia, Estonia*, Slovenia, Serbia, Morocco (FR), Tanzania,
  Lebanon (USD-pegged), Luxembourg. (*Estonia universal-service scheme expires
  Apr 2026 — verify.)
- **APAC (top):** Mongolia (genuine **ToU**, English HTML), Brunei, Fiji (2026
  tiers), Bhutan (free lifeline), Sri Lanka (optional ToU), Bangladesh, Maldives,
  Cambodia.
- **Americas (top):** Uruguay (real **ToU**, UTE pliego), Costa Rica (see A4),
  Honduras (HTML), El Salvador, Guatemala, Dominican Republic, Panama, Jamaica,
  Trinidad.

## C. Deepen existing thin countries (add regulated default + ~2 real retail)

Authoritative regulator/utility sources confirmed for: **IN** (state DISCOMs/ERCs),
**JP** (TEPCO + regional), **KR** (KEPCO 3-tier), **TW** (Taipower summer/ToU),
**TH** (MEA + ERC FT), **ID** (PLN + Permen ESDM), **PK** (NEPRA SROs), **CN**
(provincial grids), **HK** (CLP/HKE), **CA** beyond Ontario (BC Hydro, Hydro-Québec
Rate D, Alberta RoLR, Manitoba Hydro), **KE** (EPRA), **GR** (RAAEY/PPC), **IE**
(CRU/ESB), **RO** (ANRE), **EG** (EgyptERA slabs).

## D. Reference-price expansion (powers the "vs ref" cross-validation)

Beyond Eurostat (EU) + EIA (US) + World Bank: ARESEP (CR), ANEEL (BR), data.gov.sg
(SG) give clean per-country anchors. Most others: derive the median from curated
plans (already the fallback) until an official benchmark exists.

## E. Dead ends — do NOT invest

NZ Powerswitch / Octopus (restricted, on-device only) · IEA / OECD / GlobalPetrol-
Prices (paywalled/NC) · Spain ESIOS (single regulated tariff, token-gated) · India
& Mexico-CFE *structures* (PDF/image only) · WB "Falling Short" (PDF) · ENTSO-E /
OPSD (wholesale only).

## F. Source-quality flags (for the curator)

- **Bot-blocked to server fetch (use CI/headless browser):** ANEEL portal, CFE
  (SSL), CGE/CNEE/SIE (403), Maldives, Pakistan NEPRA.
- **PDF/image-only (manual transcription):** Cyprus, Tanzania, Bangladesh,
  Cambodia, Myanmar, Jamaica, Guatemala, Argentina (ZIP), Chile, Canada.
- **Broken/unreliable — verify before publishing:** Nepal (endpoints 404),
  Nicaragua (broken SSL cert), Laos (no official online table), PNG (no live page).
- **Not reached — targeted follow-up worth it:** Ecuador (ARCONEL), Bolivia (AE),
  Paraguay (ANDE), Colombia (CREG/SUI), Peru (OSINERGMIN).
- **NREL note:** URDB API dev domain moved to `developer.nlr.gov` (May 2026) —
  update our importer's docs/key URL.

## Suggested release scope

- **v-next (build, ~1 week):** Brazil ANEEL + Ontario OEB importers (real depth
  for 2 big markets), extend URDB→IURDB, refresh Singapore. Fix AR + MY staleness.
  Resolve the AER question.
- **+ hand-curation pass:** the ~15 highest-confidence new countries (Iceland,
  Croatia, Lithuania, Gulf states, Mongolia, Uruguay, Costa Rica, Honduras, Brunei,
  Fiji, Bhutan, Ghana) → ~67 countries, several with real ToU.
- **Later:** the second-tier curations + the not-reached regulators (EC/BO/PY/CO/PE).
</content>
