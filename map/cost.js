// Cost engine: estimate a plan's annual cost for a usage profile, so users can
// compare plans ("which is cheapest for me"). Pure functions on the canonical
// tariff. (Should be ported to the SDK so non-map consumers reuse it.)
//
// Usage profile = average kWh per hour-of-day, split weekday/weekend:
//   { weekday: [24], weekend: [24] }  (kWh consumed in that hour on an average day)
// Cost is in the tariff's currency major units — only compare same-currency plans.
window.OET = window.OET || {};

const WEEKDAY_DAYS = 261, WEEKEND_DAYS = 104; // ~per year

// Canonical tariff -> { weekday:[24 rates], weekend:[24 rates], supplyDaily }.
OET.hourlyRates = function (tariff) {
  const imp = tariff.import || {};
  const supplyDaily = tariff.supply ? tariff.supply.daily || 0 : 0;
  if (tariff.kind === 'flat' || !imp.bands || !imp.schedule || !imp.schedule.length) {
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
    const applyWd = d === 'all' || d === 'weekday' || (isList && d.some((x) => ['mon', 'tue', 'wed', 'thu', 'fri'].indexOf(x) !== -1));
    const applyWe = d === 'all' || d === 'weekend' || (isList && d.some((x) => ['sat', 'sun'].indexOf(x) !== -1));
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
};

// Estimate annual cost (currency major units). usage may include exportKwh.
OET.estimateAnnualCost = function (tariff, usage) {
  if (!tariff || !usage) return null;
  const r = OET.hourlyRates(tariff);
  let energy = 0;
  for (let h = 0; h < 24; h++) {
    energy += (usage.weekday[h] || 0) * r.weekday[h] * WEEKDAY_DAYS
      + (usage.weekend[h] || 0) * r.weekend[h] * WEEKEND_DAYS;
  }
  const supply = (r.supplyDaily || 0) * 365;
  let credit = 0;
  if (usage.exportKwh && tariff.export && typeof tariff.export.flatRate === 'number') credit = usage.exportKwh * tariff.export.flatRate;
  return energy + supply - credit;
};

// Per-day load shapes (relative weights, 24h). Scaled to the user's annual kWh.
OET.SHAPES = {
  flat: Array(24).fill(1),
  daytime: [.4, .3, .3, .3, .3, .4, .7, 1, 1.2, 1.2, 1.1, 1, 1, 1, 1, 1.1, 1.2, 1.3, 1.2, 1, .8, .6, .5, .4],
  evening: [.5, .4, .3, .3, .3, .4, .6, .8, .8, .7, .7, .7, .7, .7, .8, .9, 1.1, 1.4, 1.6, 1.6, 1.4, 1.1, .8, .6],
  night_ev: [1.4, 1.4, 1.4, 1.4, 1.4, 1.2, .8, .6, .5, .5, .5, .5, .5, .5, .5, .6, .7, .9, .9, .8, .7, .9, 1.1, 1.3],
};

// Build a usage profile from an annual total + a named load shape.
OET.usageFromAnnual = function (annualKwh, shape) {
  const s = OET.SHAPES[shape] || OET.SHAPES.flat;
  const sum = s.reduce((a, b) => a + b, 0);
  const daily = (annualKwh || 0) / 365;
  const perHour = s.map((v) => daily * v / sum);
  return { weekday: perHour.slice(), weekend: perHour.slice() };
};

// Parse interval-usage CSV (rows: <timestamp>,<kWh>; header optional) into a
// weekday/weekend hourly profile. Sums readings within the same (date,hour) then
// averages those hourly totals across days — so sub-hourly intervals are handled.
OET.parseUsageCsv = function (text) {
  const sum = {}; const seen = {}; // key dayType|hour -> total ; and per (date|dayType|hour)
  const dailyHour = {}; // dayType|hour -> { dateKey -> kWh }
  for (const line of String(text).split(/\r?\n/)) {
    const c = line.split(',');
    if (c.length < 2) continue;
    const d = new Date(c[0].trim());
    const kwh = parseFloat(c[1]);
    if (isNaN(d.getTime()) || isNaN(kwh)) continue;
    const we = (d.getDay() === 0 || d.getDay() === 6) ? 'we' : 'wd';
    const hour = d.getHours();
    const dk = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    const key = we + '|' + hour;
    (dailyHour[key] = dailyHour[key] || {});
    dailyHour[key][dk] = (dailyHour[key][dk] || 0) + kwh;
  }
  const avgArr = (we) => {
    const out = Array(24).fill(0);
    for (let h = 0; h < 24; h++) {
      const days = dailyHour[we + '|' + h];
      if (!days) continue;
      const vals = Object.values(days);
      out[h] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    return out;
  };
  const profile = { weekday: avgArr('wd'), weekend: avgArr('we') };
  const total = profile.weekday.reduce((a, b) => a + b, 0) * WEEKDAY_DAYS + profile.weekend.reduce((a, b) => a + b, 0) * WEEKEND_DAYS;
  return { profile, annualKwh: Math.round(total) };
};
