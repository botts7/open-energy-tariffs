# Next-release data plan

Consolidated from a license-audited research sweep (open-bulk sources · EMEA ·
APAC+Americas). Today: **52 countries, but only AU (5,226) & US (314) are deep** —
the rest are single illustrative plans. Goal: more countries + more real plans,
under a clean license. Rule unchanged: **bulk-store only CC-BY / CC0 / public
domain / open-gov; hand-curate regulator rates as facts (+ attribution).**

## ⚠️ Compliance items to resolve FIRST

1. ~~**AER (our AU source) redistribution**~~ — **RESOLVED (2026-06).** The AER's
   "barred from broadly sharing / no file-based delivery" statement is about its
   *access method* (it won't publish bulk file dumps), **not** a ban on use. AU
   plan data is obtained via the AER's **public, sanctioned Consumer Data Right
   (CDR) Product Reference Data API** — public, non-personal product data we may
   store + display. The only correction needed (done): it is **not CC BY 4.0** (that
   covers the AER website, not the plan data) → recorded as `license: "other"` with
   AER/CDR attribution. See `LICENSING.md` §7 + commit on `fix/aer-licensing`.
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

## G. Second sweep (NEW license-audited sources, 2026-06)

A second research pass (EU/EFTA · Americas · APAC/Africa/ME · CDR-style landscape).
**Headline:** AU's free no-auth *plan-level* CDR feed is still nearly unique; the only
true open equivalent found is 🇮🇹 **ARERA "Portale Offerte"** (daily full-market
per-plan F1/F2/F3 ToU + standing charges — needs one browser step to capture the
exact licence wording; WAF blocks automation). Track 🇳🇿 **"Open Electricity" CDR**
(plan API planned ~2027) as the next AER-equivalent.

### ✅ Bulk-store OK (open licence verified) — importer-ready

| Source | Region | Licence | Gives | Effort |
|--------|--------|---------|-------|--------|
| **CRE Regulated Tariffs (TRV)** data.gouv.fr CSV | 🇫🇷 FR | Etalab 2.0 (→`other`) | Base / **HP-HC** / Tempo per-kWh + fixed supply | Low — **building now** |
| **Energi Data Service `DatahubPricelist`** REST | 🇩🇰 DK | CC-BY 4.0 (Energinet) | DSO/TSO network charges, **full hourly ToU** (Price1–24) | Low — **building now** |
| **Taipower rate tables** data.gov.tw 17060/17052 CSV | 🇹🇼 TW | OGDL TW (→`other`) | residential tiers + **summer/ToU** bands | Low-Med — **building now** (ToU variant) |
| **VREG V-test** XLSX | 🇧🇪 BE-VL | Modellicentie Gratis Hergebruik (CC-BY-compat) | per-supplier/product per-kWh, fixed vs dynamic | Low |
| **ElCom Strompreis** CSV/SPARQL | 🇨🇭 CH | opendata.swiss OPEN | ~600 operators, energy+grid+tax per-kWh | Med |
| **OEDI ZIP-rate look-up 2024** CSV | 🇺🇸 US | CC-BY 4.0 | per-utility avg ¢/kWh by ZIP (URDB does ToU) | Low |
| **ANEEL Componentes + Bandeiras** CKAN | 🇧🇷 BR | **ODbL (share-alike ⚠)** | TE/TUSD components + flag adders | Low |
| **datos.gov.co Socrata** SODA | 🇨🇴 CO | Ley 1712 (**CC BY-SA ⚠**) | per-distributor COP/kWh by category | Low |
| **CRE Tarifas Suministro Básico** CSV | 🇲🇽 MX | Libre Uso MX | real retail ¢/kWh (domestic 1–1F/DAC + GDMTH) | Med (browser session) |
| **Alberta UCA / Ontario data.ontario.ca** | 🇨🇦 CA | OGL-prov | regulated/default + micro-gen export | Med |

⚠️ **Two copyleft flags:** Brazil ANEEL (ODbL) + Colombia (CC BY-SA) are share-alike —
confirm outbound compatibility with our CC0/CC-BY model before merging.

### Aggregate baselines (open — anchor the "vs ref" layer, not plan-level)
CBS-NL (incl. dynamic split, CC-BY) · SCB-SE (CC0) · Tilastokeskus-FI (CC-BY) ·
ČSÚ-CZ (CC-BY) · SMARD-DE (CC-BY) · Ofgem price-cap + DESNZ (OGL) · EMI-NZ/QSDEP
(CC-BY) · GODL-IN · KOGL-KR (parse-required) · EIA v2 (US public domain).

### 🟡 Display-only / live-fetch (no redistribution grant — on-device only)
Chile CNE energiaabierta.cl (real Junar API, non-commercial) · DK Strømligning ·
NL enever.nl / ACM · BE CREG/BRUGEL/CWaPE comparison tools · NZ ahiko.nz · NZ
Powerswitch · UK EDF/electricitycosts · TX Power-to-Choose (export exists, no
explicit grant — see below) · ES ESIOS PVPC · QC Hydro-Québec.

### ❓ Needs one first-hand/browser licence check, then likely bulk-store
🇵🇪 Peru OSINERGMIN pliegos · 🇺🇸 TX Power-to-Choose · 🇺🇸 CT PURA Rate Board ·
🇺🇸 OH "Apples to Apples" · 🇵🇹 Portugal ERSE XLSX (no licence stated → hand-curate
meanwhile) · 🇳🇴 Norway Forbrukerrådet (richest in Europe, no documented open API).

### ❌ Confirmed dead-ends (don't invest)
Germany retail per-kWh plans (none open) · CDR/Open-Energy *frameworks* (UK Open
Energy, Midata, EU Energy Data Space — metadata/blueprints, no live tariff API) ·
geoimpact GitHub (no LICENSE → use ElCom directly) · Sweden Elpriskollen / FI
sahkonhinta / DK elpris.dk (canonical but no open export) · HEPI/VaasaETT
(proprietary) · TH/ID/MY portals (consumption stats only, no rate tables).
</content>
