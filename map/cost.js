// Cost engine: estimate a plan's annual cost for a usage profile, so users can
// compare plans ("which is cheapest for me"). Pure functions on the canonical
// tariff. CANONICAL + tested version is packages/sdk-js/cost.mjs (ESM) — this is
// the browser (classic-script) mirror; keep them in sync.
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

// Band id painted onto each hour (weekday/weekend) + rate/name by band id. Used
// for the detailed per-band cost breakdown.
OET.bandHours = function (tariff) {
  const imp = tariff.import || {};
  if (tariff.kind === 'flat' || !imp.bands || !imp.schedule || !imp.schedule.length) {
    return { weekday: Array(24).fill('flat'), weekend: Array(24).fill('flat'), rateById: { flat: imp.flatRate || 0 }, nameById: { flat: 'Flat rate' } };
  }
  const rateById = {}, nameById = {};
  for (const b of imp.bands) { rateById[b.id] = b.rate; nameById[b.id] = b.name || b.id; }
  const fallback = imp.bands[0].id;
  const wd = Array(24).fill(fallback), we = Array(24).fill(fallback);
  const hourOf = (t) => { const p = String(t).split(':'); return Number(p[0]) + Number(p[1] || 0) / 60; };
  for (const s of imp.schedule) {
    const d = s.days, isList = Array.isArray(d);
    const applyWd = d === 'all' || d === 'weekday' || (isList && d.some((x) => ['mon', 'tue', 'wed', 'thu', 'fri'].indexOf(x) !== -1));
    const applyWe = d === 'all' || d === 'weekend' || (isList && d.some((x) => ['sat', 'sun'].indexOf(x) !== -1));
    let from = hourOf(s.from), to = hourOf(s.to); if (to === 0) to = 24;
    const paint = (arr) => { for (let h = 0; h < 24; h++) { const inR = from < to ? (h >= from && h < to) : (h >= from || h < to); if (inR) arr[h] = s.band; } };
    if (applyWd) paint(wd); if (applyWe) paint(we);
  }
  return { weekday: wd, weekend: we, rateById, nameById };
};

// Detailed annual breakdown for a usage profile: per-band {kWh, cost}, supply,
// export credit, and the net total. -> { total, energy, supply, exportCredit,
// exportKwh, annualKwh, bands:[{name,rate,kwh,cost}] }.
OET.costBreakdown = function (tariff, usage) {
  if (!tariff || !usage) return null;
  const bh = OET.bandHours(tariff);
  const WD = 261, WE = 104;
  const acc = {};
  let energy = 0;
  const addb = (band, kwh) => { const rate = bh.rateById[band] != null ? bh.rateById[band] : 0; (acc[band] = acc[band] || { kwh: 0, cost: 0 }); acc[band].kwh += kwh; acc[band].cost += kwh * rate; energy += kwh * rate; };
  for (let h = 0; h < 24; h++) {
    addb(bh.weekday[h], (usage.weekday[h] || 0) * WD);
    addb(bh.weekend[h], (usage.weekend[h] || 0) * WE);
  }
  const supply = (tariff.supply ? tariff.supply.daily || 0 : 0) * 365;
  let exportCredit = 0;
  if (usage.exportKwh && tariff.export && typeof tariff.export.flatRate === 'number') exportCredit = usage.exportKwh * tariff.export.flatRate;
  const bands = Object.keys(acc).map((id) => ({ name: bh.nameById[id] || id, rate: bh.rateById[id], kwh: acc[id].kwh, cost: acc[id].cost })).sort((a, b) => b.cost - a.cost);
  const annualKwh = bands.reduce((s, b) => s + b.kwh, 0);
  return { total: energy + supply - exportCredit, energy, supply, exportCredit, exportKwh: usage.exportKwh || 0, annualKwh, bands };
};

// Per-day load shapes (relative weights, 24h). Scaled to the user's annual kWh.
OET.SHAPES = {
  flat: Array(24).fill(1),
  daytime: [.4, .3, .3, .3, .3, .4, .7, 1, 1.2, 1.2, 1.1, 1, 1, 1, 1, 1.1, 1.2, 1.3, 1.2, 1, .8, .6, .5, .4],
  evening: [.5, .4, .3, .3, .3, .4, .6, .8, .8, .7, .7, .7, .7, .7, .8, .9, 1.1, 1.4, 1.6, 1.6, 1.4, 1.1, .8, .6],
  night_ev: [1.4, 1.4, 1.4, 1.4, 1.4, 1.2, .8, .6, .5, .5, .5, .5, .5, .5, .5, .6, .7, .9, .9, .8, .7, .9, 1.1, 1.3],
};

// Typical AU time-of-use windows (hours of day) used to turn a user's per-band
// DAILY kWh into an hourly profile. These are a reasonable default; each PLAN's
// own bands still do the actual costing, so this only places the user's energy in
// time — it isn't claiming these are any one plan's windows.
OET.TOU_WINDOWS = {
  peak: [15, 16, 17, 18, 19, 20],                 // 3pm–9pm
  shoulder: [7, 8, 9, 10, 11, 12, 13, 14, 21],    // 7am–3pm + 9pm–10pm
  offpeak: [22, 23, 0, 1, 2, 3, 4, 5, 6],         // 10pm–7am
};

// Build a usage profile from DAILY kWh entered per band {peak, shoulder, offpeak}
// — each band's kWh spread evenly across its window hours. Same profile weekday +
// weekend (the user gives one typical day).
OET.usageFromBands = function (bands) {
  bands = bands || {};
  const per = Array(24).fill(0);
  const place = (kwh, hours) => { kwh = +kwh || 0; if (kwh > 0 && hours.length) for (const h of hours) per[h] += kwh / hours.length; };
  place(bands.peak, OET.TOU_WINDOWS.peak);
  place(bands.shoulder, OET.TOU_WINDOWS.shoulder);
  place(bands.offpeak, OET.TOU_WINDOWS.offpeak);
  return { weekday: per.slice(), weekend: per.slice() };
};

// Build a usage profile from an annual total + a named load shape.
OET.usageFromAnnual = function (annualKwh, shape) {
  const s = OET.SHAPES[shape] || OET.SHAPES.flat;
  const sum = s.reduce((a, b) => a + b, 0);
  const daily = (annualKwh || 0) / 365;
  const perHour = s.map((v) => daily * v / sum);
  return { weekday: perHour.slice(), weekend: perHour.slice() };
};

// Parse a distributor "wide" interval export (AusNet / NEM-style): a header with
// NMI, METER SERIAL, CON/GEN, DATE, ESTIMATED?, then 48 half-hourly columns
// ("00:00 - 00:30" ...). One row per day; CON rows = consumption, GEN rows = solar
// export. -> { profile:{weekday,weekend}, annualKwh, exportKwh, days } or null.
OET.parseWideCsv = function (text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const delim = lines[0].split('\t').length > lines[0].split(',').length ? '\t' : ',';
  const header = lines[0].split(delim).map((s) => s.trim().replace(/^"|"$/g, ''));
  const win = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/;
  const intervalCols = [];
  header.forEach((h, i) => { if (win.test(h)) intervalCols.push(i); });
  if (intervalCols.length < 20) return null; // not the wide interval format
  const dateCol = header.findIndex((h) => /date/i.test(h));
  const cgCol = header.findIndex((h) => /con\s*\/?\s*gen|^con$|^gen$/i.test(h));
  if (dateCol === -1) return null;
  const parseDate = (s) => {
    s = (s || '').trim().replace(/^"|"$/g, '');
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // DD/MM/YYYY (AU)
    if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1]); }
    const dt = new Date(s); return isNaN(dt.getTime()) ? null : dt;
  };
  const con = {}; // 'wd|h' / 'we|h' -> { dateKey: kWh }
  const conDays = new Set(), genDays = new Set();
  let exportTotal = 0;
  for (let r = 1; r < lines.length; r++) {
    const c = lines[r].split(delim).map((s) => s.trim().replace(/^"|"$/g, ''));
    if (c.length <= intervalCols[intervalCols.length - 1]) continue;
    const d = parseDate(c[dateCol]); if (!d) continue;
    const isGen = cgCol !== -1 && /gen/i.test(c[cgCol] || '');
    const we = (d.getDay() === 0 || d.getDay() === 6) ? 'we' : 'wd';
    const dk = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    let dayKwh = 0;
    for (let j = 0; j < intervalCols.length; j++) {
      const v = parseFloat(c[intervalCols[j]]); if (!isFinite(v)) continue;
      dayKwh += v;
      if (!isGen) { const h = Math.floor(j / 2); const k = we + '|' + h; (con[k] = con[k] || {}); con[k][dk] = (con[k][dk] || 0) + v; }
    }
    if (isGen) { exportTotal += dayKwh; genDays.add(dk); } else conDays.add(dk);
  }
  if (!conDays.size) return null;
  const avg = (we) => { const out = Array(24).fill(0); for (let h = 0; h < 24; h++) { const days = con[we + '|' + h]; if (!days) continue; const vals = Object.values(days); out[h] = vals.reduce((a, b) => a + b, 0) / vals.length; } return out; };
  const profile = { weekday: avg('wd'), weekend: avg('we') };
  const annualKwh = Math.round(profile.weekday.reduce((a, b) => a + b, 0) * 261 + profile.weekend.reduce((a, b) => a + b, 0) * 104);
  const exportKwh = genDays.size ? Math.round(exportTotal / genDays.size * 365) : 0;
  if (exportKwh) profile.exportKwh = exportKwh;
  return { profile, annualKwh, exportKwh, days: conDays.size, hasExport: genDays.size > 0 };
};

// Parse interval CSV into the raw series for an exact HISTORICAL replay.
OET.parseIntervals = function (text) {
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
};

// HISTORICAL replay: cost the user's ACTUAL intervals against a plan's bands for
// their data's period, then annualise. -> { periodCost, annual, days }.
OET.estimateFromIntervals = function (tariff, parsed) {
  if (!tariff || !parsed || !parsed.intervals.length) return null;
  const r = OET.hourlyRates(tariff);
  let energy = 0;
  for (const iv of parsed.intervals) energy += iv.kwh * (iv.we ? r.weekend : r.weekday)[iv.hour];
  const periodCost = energy + (r.supplyDaily || 0) * parsed.days;
  const annual = parsed.days ? periodCost * 365 / parsed.days : periodCost;
  return { periodCost, annual, days: parsed.days };
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
