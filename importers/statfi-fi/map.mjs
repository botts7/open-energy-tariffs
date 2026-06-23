// Pure mapping: a Statistics Finland (Tilastokeskus) household electricity record
// -> canonical v1 entry. One flat entry per household consumption band, all-in
// c/kWh -> €/kWh, with the energy / distribution / tax breakdown in meta.notes.
//
// Licence: CC-BY 4.0 (Statistics Finland). Side-effect-free.

import { slug, money, round } from '../_lib/canonical.mjs';

export { slug, money };

const SOURCE_URL = 'https://stat.fi/en/statistics/ehi';

/** "2026M03" -> "2026-03-01". */
export function periodToDate(p) {
  const m = /^(\d{4})M(\d{2})/.exec(String(p || ''));
  return m ? `${m[1]}-${m[2]}-01` : undefined;
}

const tidyRange = (label) => String(label || '')
  .replace(/^Household customer,\s*annual consumption\s*/i, '')
  .replace(/(\d)\s(?=\d{3}\b)/g, '$1,')   // "2 500" -> "2,500"
  .replace(/\s*-\s*/g, '–')
  .replace(/kW\b/g, 'kWh')                // fix the "< 1 000 kW" label typo
  .trim();

/**
 * @param {object} rec { code, label, period, energy, distribution, taxes, total }  (c/kWh)
 * @param {object} [opts] { updated:'YYYY-MM-DD' }
 */
export function mapFinland(rec, opts = {}) {
  const range = tidyRange(rec.label);
  const provider = 'Household average';
  const plan = `Household — ${range}`;

  const tariff = { kind: 'flat', import: { flatRate: round((money(rec.total) ?? 0) / 100) } };
  const vf = periodToDate(rec.period);
  if (vf) tariff.validFrom = vf;

  const id = ['fi', provider, range].map(slug).filter(Boolean).join('-');
  const c = (v) => (money(v) ?? 0).toFixed(2);

  const notes =
    `Finnish household electricity — average for "${range}" annual consumption, from `
    + `Statistics Finland (Tilastokeskus), StatFin table 13rb. All-in ${c(rec.total)} c/kWh = `
    + `electric energy ${c(rec.energy)} + distribution ${c(rec.distribution)} + taxes `
    + `(electricity tax + VAT) ${c(rec.taxes)}. Licensed CC BY 4.0 — attribute Statistics Finland. `
    + `A statistical average, not a shoppable plan. Period ${rec.period}.`;

  const meta = {
    id,
    schemaVersion: '1',
    country: 'FI',
    provider,
    plan,
    currency: 'EUR',
    unit: 'kWh',
    timezone: 'Europe/Helsinki',
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
