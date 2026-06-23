// Pure mapping: a Statistics Iceland (Hagstofa) household electricity record ->
// canonical v1 entry. One flat entry per household consumption band, all-taxes-
// included, ISK/kWh. Side-effect-free.
//
// Licence: CC-BY 4.0 (Statistics Iceland).

import { slug, money, round } from '../_lib/canonical.mjs';

export { slug, money };

const SOURCE_URL = 'https://px.hagstofa.is/pxen/pxen/Umhverfi/4_orkumal/1_orkuverdogkostnadur/IDN02303.px';

/** "2022H1" -> "2022-01-01" (H1 Jan / H2 Jul). */
export function periodToDate(p) {
  const m = /^(\d{4})H(\d)/.exec(String(p || ''));
  return m ? `${m[1]}-${m[2] === '2' ? '07' : '01'}-01` : undefined;
}

const tidyRange = (label) => String(label || '')
  .replace(/(\d)\s(?=\d{3}\b)/g, '$1,')
  .replace(/\s*-\s*/g, '–')
  .replace(/kWH/g, 'kWh')
  .trim();

/**
 * @param {object} rec { code, label, period, priceIsk }  (ISK/kWh)
 * @param {object} [opts] { updated:'YYYY-MM-DD' }
 */
export function mapIceland(rec, opts = {}) {
  const range = tidyRange(rec.label);
  const provider = 'Household average';
  const plan = `Household — ${range}`;

  const tariff = { kind: 'flat', import: { flatRate: round(money(rec.priceIsk) ?? 0) } };
  const vf = periodToDate(rec.period);
  if (vf) tariff.validFrom = vf;

  const id = ['is', provider, range].map(slug).filter(Boolean).join('-');

  const notes =
    `Icelandic household electricity — average for "${range}" annual consumption, all taxes and `
    + `fees included, from Statistics Iceland (Hagstofa), table IDN02303. ${(money(rec.priceIsk) ?? 0).toFixed(2)} `
    + `ISK/kWh. Licensed CC BY 4.0 — attribute Statistics Iceland. A statistical average, not a shoppable `
    + `plan. Iceland's hydro/geothermal market is stable; this is the latest published period (${rec.period}).`;

  const meta = {
    id,
    schemaVersion: '1',
    country: 'IS',
    provider,
    plan,
    currency: 'ISK',
    unit: 'kWh',
    timezone: 'Atlantic/Reykjavik',
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
