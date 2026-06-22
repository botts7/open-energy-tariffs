// Pure mapping: Taiwan Taipower residential TIME-OF-USE tariff record -> canonical
// v1 entry.
//
// Taipower's standard residential tariff is block/tiered (not modelled by v1's
// flat|tou kinds yet — needs v1.1 tiers). This importer maps the OPTIONAL
// residential TIME-OF-USE tariff (時間電價), which is real per-kWh by time band +
// season and maps cleanly to canonical `tou` with band.seasonRates + a summer
// season. Input is a normalised record from fetch.mjs. Side-effect-free.
//
// Licence: Open Government Data License, Taiwan (OGDL, CC-BY-4.0-compatible) ->
// license:"other" + attribution to Taipower / data.gov.tw.

import { slug, money, round, hoursToIntervals } from '../_lib/canonical.mjs';

export { slug, money };

const SOURCE_URL = 'https://data.gov.tw/dataset/17060';
const NOTES =
  'Taiwan residential time-of-use tariff (Taipower), from the open rate tables on data.gov.tw (datasets 17052/17060). Published under the Open Government Data License, Taiwan (OGDL) — CC-BY-4.0-compatible; recorded as license:other, attributing Taipower / data.gov.tw. Summer = Jun–Sep carries higher rates via band.seasonRates. The block/tiered (non-ToU) residential tariff is not mapped (needs v1.1 tiers).';

const SUMMER = { id: 'summer', name: 'Summer', from: 5, to: 8 }; // Jun(5)–Sep(8)

/** Paint a [from,to) whole-hour window (wraps if from>to) onto a 24-hour map. */
function paintWindow(hours, from, to, band) {
  const fh = parseInt(String(from).slice(0, 2), 10);
  const th = to === '24:00' ? 24 : parseInt(String(to).slice(0, 2), 10);
  if (fh < th) for (let h = fh; h < th; h++) hours[h] = band;
  else { for (let h = fh; h < 24; h++) hours[h] = band; for (let h = 0; h < th; h++) hours[h] = band; }
}

/** Weekday peak windows -> full weekday + weekend schedule (weekends off-peak). */
export function touSchedule(peakWindows) {
  const hours = Array(24).fill('offpeak');
  for (const w of peakWindows) paintWindow(hours, w.from, w.to, 'peak');
  const weekday = hoursToIntervals(hours).map((iv) => ({ days: 'weekday', ...iv }));
  return [...weekday, { days: 'weekend', from: '00:00', to: '24:00', band: 'offpeak' }];
}

/**
 * Map one normalised Taipower ToU record into a canonical v1 entry.
 * @param {object} rec { scheme, summer:{peakRate,offpeakRate},
 *                       nonSummer:{peakRate,offpeakRate}, peakWindows:[{from,to}],
 *                       basicMonthly }
 * @param {object} [opts] { updated:'YYYY-MM-DD' }
 */
export function mapTaipowerTou(rec, opts = {}) {
  const s = rec.summer || {};
  const ns = rec.nonSummer || {};
  const provider = 'Taipower';
  const planName = `Residential Time-of-Use (${rec.scheme || 'two-section'})`;

  const band = (id, name, base, summer) => {
    const b = { id, name, rate: money(base) ?? 0 };
    const sr = money(summer);
    if (sr != null) b.seasonRates = { summer: sr };
    return b;
  };

  const tariff = {
    kind: 'tou',
    import: {
      bands: [
        band('peak', 'Peak', ns.peakRate, s.peakRate),
        band('offpeak', 'Off-peak', ns.offpeakRate, s.offpeakRate),
      ],
      schedule: touSchedule(rec.peakWindows || [{ from: '16:00', to: '22:00' }]),
    },
    seasons: [SUMMER],
  };

  const basic = money(rec.basicMonthly);
  if (basic != null) tariff.supply = { daily: round((basic * 12) / 365) };

  if (rec.effectiveFrom) tariff.validFrom = rec.effectiveFrom;

  const notes = NOTES + (rec.summerPeakWindow
    ? ` Summer (Jun–Sep) weekday peak window differs (${rec.summerPeakWindow}); v1 uses one schedule, so the non-summer windows are applied year-round while summer/non-summer RATES are correct via band.seasonRates.`
    : '');

  const id = ['tw', provider, planName].map(slug).filter(Boolean).join('-');

  const meta = {
    id,
    schemaVersion: '1',
    country: 'TW',
    provider,
    plan: planName,
    currency: 'TWD',
    unit: 'kWh',
    timezone: 'Asia/Taipei',
    source: 'provider',
    sourceUrl: SOURCE_URL,
    license: 'other',
    updated: opts.updated || rec.effectiveFrom || '1970-01-01',
    verified: false,
    notes,
    coverage: { national: true },
  };

  return { meta, tariff };
}
