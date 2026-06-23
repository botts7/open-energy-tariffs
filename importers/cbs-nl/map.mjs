// Pure mapping: a CBS (Statistics Netherlands) electricity-price record -> canonical
// v1 entry. ONE national-average household entry (CBS publishes country-level, incl.
// VAT), standard (non-dynamic) contract.
//
// Source: CBS StatLine 85592NED. All-in per-kWh = energy contract + renewable
// surcharge (ODE) + energy tax. The big annual energy-tax rebate (heffingskorting)
// offsets the fixed transport/supply charges. Side-effect-free.
//
// Licence: CC-BY 4.0 (CBS / Statistics Netherlands).

import { slug, money, round } from '../_lib/canonical.mjs';

export { slug, money };

const SOURCE_URL = 'https://opendata.cbs.nl/statline/#/CBS/nl/dataset/85592NED';

/** "2026MM03" -> "2026-03-01"; "2026JJ00" -> "2026-01-01". */
export function periodToDate(p) {
  const m = /^(\d{4})(?:MM(\d{2})|KW(\d{2})|JJ\d{2})?/.exec(String(p || ''));
  if (!m) return undefined;
  const month = m[2] ? m[2] : (m[3] ? String((Number(m[3]) - 1) * 3 + 1).padStart(2, '0') : '01');
  return `${m[1]}-${month}-01`;
}

/**
 * @param {object} rec { period, energy, ode, energyTax, transport, fixedSupply, taxRebate }
 *                      (energy/ode/energyTax in €/kWh; transport/fixedSupply/taxRebate in €/year)
 * @param {object} [opts] { updated:'YYYY-MM-DD' }
 */
export function mapCbsNl(rec, opts = {}) {
  const provider = 'National average';
  const plan = 'Household standard contract (CBS)';

  const allIn = round((money(rec.energy) ?? 0) + (money(rec.ode) ?? 0) + (money(rec.energyTax) ?? 0));
  const tariff = { kind: 'flat', import: { flatRate: allIn } };

  // Net annual fixed = transport + fixed supply + energy-tax rebate (rebate is
  // negative). Only emit supply if it's net-positive (the rebate often exceeds it).
  const netFixed = (money(rec.transport) ?? 0) + (money(rec.fixedSupply) ?? 0) + (money(rec.taxRebate) ?? 0);
  if (netFixed > 0) tariff.supply = { daily: round(netFixed / 365) };

  const vf = periodToDate(rec.period);
  if (vf) tariff.validFrom = vf;

  const id = ['nl', provider, plan].map(slug).filter(Boolean).join('-');
  const e2 = (v) => (money(v) ?? 0).toFixed(4);

  const notes =
    `Dutch household electricity — NATIONAL AVERAGE from CBS (Statistics Netherlands), `
    + `StatLine 85592NED, incl. VAT. All-in variable ${allIn.toFixed(4)} €/kWh = energy contract `
    + `${e2(rec.energy)} + renewable surcharge (ODE) ${e2(rec.ode)} + energy tax ${e2(rec.energyTax)}. `
    + `Annual fixed: transport €${(money(rec.transport) ?? 0).toFixed(0)} + supply €${(money(rec.fixedSupply) ?? 0).toFixed(0)}, `
    + `offset by the energy-tax rebate €${(money(rec.taxRebate) ?? 0).toFixed(0)}/yr (heffingskorting). Standard (non-dynamic) `
    + `contract. Licensed CC BY 4.0 — attribute CBS. A national average, not a shoppable plan. Period ${rec.period}.`;

  const meta = {
    id,
    schemaVersion: '1',
    country: 'NL',
    provider,
    plan,
    currency: 'EUR',
    unit: 'kWh',
    timezone: 'Europe/Amsterdam',
    source: 'provider',
    sourceUrl: SOURCE_URL,
    license: 'CC-BY-4.0',
    updated: opts.updated || vf || '1970-01-01',
    verified: false,
    notes,
    coverage: { national: true },
  };

  return { meta, tariff };
}
