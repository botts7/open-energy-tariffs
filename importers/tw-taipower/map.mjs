// Pure mapping: Taiwan Taipower residential simplified TIME-OF-USE tariff ->
// canonical v1. Generic over N bands (two-section: peak/off-peak; three-section:
// peak/half-peak/off-peak) with a fill band (off-peak) covering the unpainted
// weekday hours + all weekends. Side-effect-free.
//
// Taipower's standard residential tariff is block/tiered (not v1 yet — needs v1.1
// tiers). This maps the optional TIME-OF-USE tariff, which is real per-kWh by time
// band + season and maps cleanly to canonical `tou` with band.seasonRates.
//
// Licence: Open Government Data License, Taiwan (OGDL, CC-BY-4.0-compatible) ->
// license:"other" + attribution to Taipower / data.gov.tw.

import { slug, money, round, hoursToIntervals, assignRoles } from '../_lib/canonical.mjs';

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

/**
 * Build a weekday schedule from a bands array. Each band may carry `windows`
 * ([{from,to}]); the one without `windows` is the fill band (off-peak) that
 * covers the rest of the weekday and all weekends.
 */
export function scheduleFromBands(bands) {
  const fill = bands.find((b) => !b.windows) || bands[bands.length - 1];
  const hours = Array(24).fill(fill.id);
  for (const b of bands) {
    if (!b.windows) continue;
    for (const w of b.windows) paintWindow(hours, w.from, w.to, b.id);
  }
  const weekday = hoursToIntervals(hours).map((iv) => ({ days: 'weekday', ...iv }));
  return [...weekday, { days: 'weekend', from: '00:00', to: '24:00', band: fill.id }];
}

/** Legacy two-section schedule helper (kept for back-compat + tests). */
export function touSchedule(peakWindows) {
  return scheduleFromBands([{ id: 'peak', windows: peakWindows }, { id: 'offpeak' }]);
}

// Legacy two-section record { summer:{peakRate,offpeakRate}, nonSummer:{...},
// peakWindows } -> generic bands. New records already carry rec.bands.
function toBands(rec) {
  if (rec.bands) return rec.bands;
  const s = rec.summer || {}; const ns = rec.nonSummer || {};
  return [
    { id: 'peak', name: 'Peak', rate: ns.peakRate, summerRate: s.peakRate, windows: rec.peakWindows || [{ from: '16:00', to: '22:00' }] },
    { id: 'offpeak', name: 'Off-peak', rate: ns.offpeakRate, summerRate: s.offpeakRate },
  ];
}

/**
 * Map a Taipower residential ToU record into a canonical v1 entry.
 * @param {object} rec  { scheme, bands?, summer?, nonSummer?, peakWindows?,
 *                        basicMonthly, effectiveFrom?, summerPeakWindow?, noteSuffix? }
 * @param {object} [opts] { updated:'YYYY-MM-DD' }
 */
export function mapTaipowerTou(rec, opts = {}) {
  const provider = 'Taipower';
  const planName = `Residential Time-of-Use (${rec.scheme || 'two-section'})`;
  const bands = toBands(rec);

  const importBands = bands.map((b) => {
    const band = { id: b.id, name: b.name, rate: money(b.rate) ?? 0 };
    const sr = money(b.summerRate);
    if (sr != null) band.seasonRates = { summer: sr };
    return band;
  });

  const tariff = {
    kind: 'tou',
    import: { bands: assignRoles(importBands), schedule: scheduleFromBands(bands) },
    seasons: [SUMMER],
  };

  const basic = money(rec.basicMonthly);
  if (basic != null) tariff.supply = { daily: round((basic * 12) / 365) };

  if (rec.effectiveFrom) tariff.validFrom = rec.effectiveFrom;

  const suffix = rec.noteSuffix || (rec.summerPeakWindow
    ? `Summer (Jun–Sep) weekday peak window differs (${rec.summerPeakWindow}); v1 uses one schedule, so the non-summer windows are applied year-round while summer/non-summer RATES are correct via band.seasonRates.`
    : '');
  const notes = NOTES + (suffix ? ` ${suffix}` : '');

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
