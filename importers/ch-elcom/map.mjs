// Pure mapping: a Swiss ElCom per-operator household tariff record -> canonical v1.
//
// Source: the Federal Electricity Commission (ElCom) "electricityprice" RDF cube
// on LINDAS (lindas.admin.ch). We map the standard-supply (Grundversorgung) tariff
// for the ElCom reference household profile H4 (~4,500 kWh/yr), one flat entry per
// network operator. Input is a normalised record from fetch.mjs. Side-effect-free.
//
// Licence: opendata.swiss "Open use" (terms_open) — free reuse incl. commercial,
// no conditions. Recorded as license:"other"; ElCom attributed as a courtesy.

import { slug, money, round } from '../_lib/canonical.mjs';

export { slug, money };

const SOURCE_URL = 'https://www.strompreis.elcom.admin.ch/';

/**
 * Map one ElCom operator record into a canonical v1 entry.
 * @param {object} rec { operator, period, category, totalRp, energyRp, gridRp,
 *                       aidfeeRp, fixCostChf, municipalities }  (prices in Rp/kWh)
 * @param {object} [opts] { updated:'YYYY-MM-DD' }
 */
export function mapElcom(rec, opts = {}) {
  const provider = rec.operator;
  const plan = 'Standard supply (household H4)';

  // ElCom "total" is the all-in price (energy + grid + surcharge + taxes), so it
  // is the household's true marginal per-kWh cost. CHF = Rp / 100.
  const tariff = { kind: 'flat', import: { flatRate: round(money(rec.totalRp) / 100) } };
  const fix = money(rec.fixCostChf);
  if (fix != null && fix > 0) tariff.supply = { daily: round(fix / 365) };
  if (rec.period) tariff.validFrom = `${rec.period}-01-01`;

  const id = ['ch', provider, plan].map(slug).filter(Boolean).join('-');
  const n = money(rec.municipalities) || 0;
  const r2 = (v) => (money(v) ?? 0).toFixed(2);

  const notes =
    `Swiss household electricity tariff — ElCom reference profile H4 (~4,500 kWh/yr), `
    + `basic/standard supply (Grundversorgung) — from the Federal Electricity Commission `
    + `(ElCom) via LINDAS (lindas.admin.ch). opendata.swiss "Open use" (terms_open); `
    + `ElCom attributed as a courtesy. All-in ${r2(rec.totalRp)} Rp/kWh = energy ${r2(rec.energyRp)} `
    + `+ grid ${r2(rec.gridRp)} + federal grid surcharge ${r2(rec.aidfeeRp)} + community/cantonal taxes; `
    + `annual fixed ${(money(rec.fixCostChf) ?? 0).toFixed(0)} CHF. Serves ${n} municipalit${n === 1 ? 'y' : 'ies'}. Period ${rec.period}.`;

  const meta = {
    id,
    schemaVersion: '1',
    country: 'CH',
    distributor: provider,
    provider,
    plan,
    currency: 'CHF',
    unit: 'kWh',
    timezone: 'Europe/Zurich',
    source: 'provider',
    sourceUrl: SOURCE_URL,
    license: 'other',
    updated: opts.updated || (rec.period ? `${rec.period}-01-01` : '1970-01-01'),
    verified: false,
    notes,
  };

  return { meta, tariff };
}
