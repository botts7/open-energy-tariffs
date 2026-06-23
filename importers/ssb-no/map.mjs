// Pure mapping: a Statistics Norway (SSB) household electricity record -> canonical
// v1 entry. One national-average flat entry, all-in NET price (after the government
// support — what households actually pay), øre/kWh -> NOK/kWh. Side-effect-free.
//
// Licence: NLOD (Norwegian Licence for Open Government Data) -> license:"other".

import { slug, money, round } from '../_lib/canonical.mjs';

export { slug, money };

const SOURCE_URL = 'https://www.ssb.no/en/statbank/table/09387';

/** "2026K1" -> "2026-01-01" (K1..K4 -> Jan/Apr/Jul/Oct). */
export function periodToDate(p) {
  const m = /^(\d{4})K(\d)/.exec(String(p || ''));
  if (!m) return undefined;
  return `${m[1]}-${String((Number(m[2]) - 1) * 3 + 1).padStart(2, '0')}-01`;
}

/**
 * @param {object} rec { period, net, gross, elec, grid, support, tax }  (øre/kWh)
 * @param {object} [opts] { updated:'YYYY-MM-DD' }
 */
export function mapNorway(rec, opts = {}) {
  const provider = 'National average';
  const plan = 'Household average (SSB)';

  // Net = what's paid (gov support deducted); fall back to gross if support absent.
  const netOre = money(rec.net) ?? money(rec.gross) ?? 0;
  const tariff = { kind: 'flat', import: { flatRate: round(netOre / 100) } };

  const vf = periodToDate(rec.period);
  if (vf) tariff.validFrom = vf;

  const id = ['no', provider, plan].map(slug).filter(Boolean).join('-');
  const o = (v) => (money(v) ?? 0).toFixed(1);
  const support = money(rec.support);

  const notes =
    `Norwegian household electricity — NATIONAL AVERAGE from Statistics Norway (SSB), `
    + `StatBank table 09387. All-in ${o(rec.net ?? rec.gross)} øre/kWh PAID `
    + `(= gross ${o(rec.gross)} øre/kWh${support ? `, less ${o(rec.support)} øre/kWh government electricity support` : ''}): `
    + `electricity incl. tax ${o(rec.elec)} + grid rent incl. tax ${o(rec.grid)}. Licensed NLOD `
    + `(Norwegian Licence for Open Government Data) — attribute Statistics Norway. A national average, `
    + `not a shoppable plan. Period ${rec.period}.`;

  const meta = {
    id,
    schemaVersion: '1',
    country: 'NO',
    provider,
    plan,
    currency: 'NOK',
    unit: 'kWh',
    timezone: 'Europe/Oslo',
    source: 'provider',
    sourceUrl: SOURCE_URL,
    license: 'other',
    updated: opts.updated || vf || '1970-01-01',
    verified: false,
    notes,
    coverage: { national: true },
  };

  return { meta, tariff };
}
