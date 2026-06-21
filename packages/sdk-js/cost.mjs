// Cost engine (canonical): estimate a plan's annual cost for a usage profile, so
// any consumer (map, HA add-on, CLI) can answer "which plan is cheapest for me".
// Pure functions over the canonical tariff. map/cost.js mirrors this for the
// browser (classic script); keep them in sync.
//
// Usage profile = average kWh per hour-of-day, split weekday/weekend:
//   { weekday: [24], weekend: [24] }   (kWh consumed in that hour on an average day)
// Cost is in the tariff's currency major units — only compare same-currency plans.

const WEEKDAY_DAYS = 261, WEEKEND_DAYS = 104; // ~per year

const WD = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WE = ['sat', 'sun'];

/** Canonical tariff -> { weekday:[24 rates], weekend:[24 rates], supplyDaily }. */
export function hourlyRates(tariff) {
  const imp = (tariff && tariff.import) || {};
  const supplyDaily = tariff && tariff.supply ? tariff.supply.daily || 0 : 0;
  if (!tariff || tariff.kind === 'flat' || !imp.bands || !imp.schedule || !imp.schedule.length) {
    const r = imp.flatRate || 0;
    return { weekday: Array(24).fill(r), weekend: Array(24).fill(r), supplyDaily };
  }
  const rateById = {};
  for (const b of imp.bands) rateById[b.id] = b.rate;
  const fallback = imp.bands.length ? imp.bands[0].rate : 0;
  const wd = Array(24).fill(null), we = Array(24).fill(null);
  const hourOf = (t) => { const p = String(t).split(':'); return Number(p[0]) + Number(p[1] || 0) / 60; };
  for (const s of imp.schedule) {
    const d = s.days;
    const isList = Array.isArray(d);
    const applyWd = d === 'all' || d === 'weekday' || (isList && d.some((x) => WD.indexOf(x) !== -1));
    const applyWe = d === 'all' || d === 'weekend' || (isList && d.some((x) => WE.indexOf(x) !== -1));
    let from = hourOf(s.from), to = hourOf(s.to);
    if (to === 0) to = 24;
    const paint = (arr) => {
      for (let h = 0; h < 24; h++) {
        const inRange = from < to ? (h >= from && h < to) : (h >= from || h < to);
        if (inRange) arr[h] = s.band;
      }
    };
    if (applyWd) paint(wd);
    if (applyWe) paint(we);
  }
  const toRate = (arr) => arr.map((b) => (b != null && rateById[b] != null ? rateById[b] : fallback));
  return { weekday: toRate(wd), weekend: toRate(we), supplyDaily };
}

/** Estimate annual cost (currency major units). usage may include exportKwh. */
export function estimateAnnualCost(tariff, usage) {
  if (!tariff || !usage) return null;
  const r = hourlyRates(tariff);
  let energy = 0;
  for (let h = 0; h < 24; h++) {
    energy += (usage.weekday[h] || 0) * r.weekday[h] * WEEKDAY_DAYS
      + (usage.weekend[h] || 0) * r.weekend[h] * WEEKEND_DAYS;
  }
  const supply = (r.supplyDaily || 0) * 365;
  let credit = 0;
  if (usage.exportKwh && tariff.export && typeof tariff.export.flatRate === 'number') credit = usage.exportKwh * tariff.export.flatRate;
  return energy + supply - credit;
}

/** Per-day relative load shapes (24h), scaled to an annual total. */
export const SHAPES = {
  flat: Array(24).fill(1),
  daytime: [.4, .3, .3, .3, .3, .4, .7, 1, 1.2, 1.2, 1.1, 1, 1, 1, 1, 1.1, 1.2, 1.3, 1.2, 1, .8, .6, .5, .4],
  evening: [.5, .4, .3, .3, .3, .4, .6, .8, .8, .7, .7, .7, .7, .7, .8, .9, 1.1, 1.4, 1.6, 1.6, 1.4, 1.1, .8, .6],
  night_ev: [1.4, 1.4, 1.4, 1.4, 1.4, 1.2, .8, .6, .5, .5, .5, .5, .5, .5, .5, .6, .7, .9, .9, .8, .7, .9, 1.1, 1.3],
};

/** Typical AU time-of-use windows (hours) for turning per-band daily kWh into an
 * hourly profile. Default placement only — each plan's own bands do the costing. */
export const TOU_WINDOWS = {
  peak: [15, 16, 17, 18, 19, 20],
  shoulder: [7, 8, 9, 10, 11, 12, 13, 14, 21],
  offpeak: [22, 23, 0, 1, 2, 3, 4, 5, 6],
};

/** Build a usage profile from DAILY kWh per band {peak, shoulder, offpeak}. */
export function usageFromBands(bands) {
  bands = bands || {};
  const per = Array(24).fill(0);
  const place = (kwh, hours) => { kwh = +kwh || 0; if (kwh > 0 && hours.length) for (const h of hours) per[h] += kwh / hours.length; };
  place(bands.peak, TOU_WINDOWS.peak);
  place(bands.shoulder, TOU_WINDOWS.shoulder);
  place(bands.offpeak, TOU_WINDOWS.offpeak);
  return { weekday: per.slice(), weekend: per.slice() };
}

/** Build a usage profile from an annual total + a named load shape. */
export function usageFromAnnual(annualKwh, shape) {
  const s = SHAPES[shape] || SHAPES.flat;
  const sum = s.reduce((a, b) => a + b, 0);
  const daily = (annualKwh || 0) / 365;
  const perHour = s.map((v) => daily * v / sum);
  return { weekday: perHour.slice(), weekend: perHour.slice() };
}

/**
 * Parse interval CSV into the raw series (for an exact historical replay):
 * { intervals: [{ we, hour, kwh }], days, totalKwh }. `days` = distinct dates.
 */
export function parseIntervals(text) {
  const intervals = []; const days = new Set(); let total = 0;
  for (const line of String(text).split(/\r?\n/)) {
    const c = line.split(',');
    if (c.length < 2) continue;
    const d = new Date(c[0].trim()); const k = parseFloat(c[1]);
    if (isNaN(d.getTime()) || isNaN(k)) continue;
    intervals.push({ we: d.getDay() === 0 || d.getDay() === 6, hour: d.getHours(), kwh: k });
    days.add(d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate());
    total += k;
  }
  return { intervals, days: days.size, totalKwh: Math.round(total) };
}

/**
 * HISTORICAL replay: cost the user's ACTUAL intervals against a plan's bands for
 * the period their data covers, then annualise. More faithful than an averaged
 * profile (real magnitudes + real day count). -> { periodCost, annual, days }.
 */
export function estimateFromIntervals(tariff, parsed) {
  if (!tariff || !parsed || !parsed.intervals.length) return null;
  const r = hourlyRates(tariff);
  let energy = 0;
  for (const iv of parsed.intervals) energy += iv.kwh * (iv.we ? r.weekend : r.weekday)[iv.hour];
  const periodCost = energy + (r.supplyDaily || 0) * parsed.days;
  const annual = parsed.days ? periodCost * 365 / parsed.days : periodCost;
  return { periodCost, annual, days: parsed.days };
}

/**
 * Parse interval-usage CSV (rows: <timestamp>,<kWh>; header optional) into a
 * weekday/weekend hourly profile + annual total. Sums readings within the same
 * (date,hour) then averages those hourly totals across days (sub-hourly safe).
 */
export function parseUsageCsv(text) {
  const dailyHour = {}; // dayType|hour -> { dateKey -> kWh }
  for (const line of String(text).split(/\r?\n/)) {
    const c = line.split(',');
    if (c.length < 2) continue;
    const d = new Date(c[0].trim());
    const kwh = parseFloat(c[1]);
    if (isNaN(d.getTime()) || isNaN(kwh)) continue;
    const we = (d.getDay() === 0 || d.getDay() === 6) ? 'we' : 'wd';
    const dk = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    const key = we + '|' + d.getHours();
    (dailyHour[key] = dailyHour[key] || {});
    dailyHour[key][dk] = (dailyHour[key][dk] || 0) + kwh;
  }
  const avgArr = (we) => {
    const out = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      const days = dailyHour[we + '|' + h];
      if (days) { const v = Object.values(days); out[h] = v.reduce((a, b) => a + b, 0) / v.length; }
    }
    return out;
  };
  const profile = { weekday: avgArr('wd'), weekend: avgArr('we') };
  const total = profile.weekday.reduce((a, b) => a + b, 0) * WEEKDAY_DAYS + profile.weekend.reduce((a, b) => a + b, 0) * WEEKEND_DAYS;
  return { profile, annualKwh: Math.round(total) };
}
