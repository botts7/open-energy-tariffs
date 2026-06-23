// Pure mapping: a Eurostat per-country household price record -> canonical v1 entry.
// One flat national-average entry per EU/EFTA country. Side-effect-free.
//
// Licence: CC-BY 4.0 (Eurostat / European Union).

import { slug, money, round, requireRate } from '../_lib/canonical.mjs';

export { slug, money };

const SOURCE_URL = 'https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_204';

/** "2025-S2" (or "2025S2") -> "2025-07-01" (S1 Jan / S2 Jul). */
export function periodToDate(p) {
  const m = /^(\d{4})-?S(\d)/.exec(String(p || ''));
  return m ? `${m[1]}-${m[2] === '2' ? '07' : '01'}-01` : undefined;
}

/**
 * @param {object} rec { country, price, period }  (price in EUR/kWh)
 * @param {object} [opts] { updated:'YYYY-MM-DD' }
 */
export function mapEurostat(rec, opts = {}) {
  const cc = rec.country;
  const provider = 'National average';
  const plan = 'Household average (Eurostat)';

  const tariff = { kind: 'flat', import: { flatRate: round(requireRate(rec.price, `Eurostat ${cc} EUR/kWh`)) } };
  const vf = periodToDate(rec.period);
  if (vf) tariff.validFrom = vf;

  const id = [cc, provider, plan].map(slug).filter(Boolean).join('-');

  const notes =
    `Household electricity national average from Eurostat (nrg_pc_204), consumption band DC `
    + `(2,500–5,000 kWh/yr), all taxes included: ${(money(rec.price) ?? 0).toFixed(4)} €/kWh. Licensed `
    + `CC BY 4.0 — © European Union / Eurostat. A national average, not a shoppable plan. Period ${rec.period}.`;

  const meta = {
    id,
    schemaVersion: '1',
    country: cc,
    provider,
    plan,
    currency: 'EUR',
    unit: 'kWh',
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
