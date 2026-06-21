// In-browser self-test harness. Encodes the invariants that have bitten us
// (geocoding country-context, per-country coverage, cost engine per currency,
// CSV parsers, theme/UI) so they're checked automatically instead of by luck.
//
// Run:  OET.selfTest()            -> Promise<{passed,failed,total,results}>
//       OET.selfTest({online:false})  skip network (geocoder) tests
//       open map/?selftest=1      auto-runs + prints a table to the console
//
// The OFFLINE suite (data/cost/parsers/ui) is deterministic and CI-friendly.
// The ONLINE suite hits Photon/Nominatim and can be skipped or may flake.
window.OET = window.OET || {};

OET.selfTest = async function (opts) {
  opts = opts || {};
  const online = opts.online !== false;
  const results = [];
  const ok = (name, cond, msg) => results.push({ name, ok: !!cond, msg: cond ? '' : (msg || 'failed') });
  const okAsync = async (name, fn) => { try { const [c, m] = await fn(); ok(name, c, m); } catch (e) { ok(name, false, 'threw: ' + e.message); } };
  const P = OET.PLANS || [];

  // ---- DATA INTEGRITY (per country) --------------------------------------
  ok('data: plans loaded', P.length > 0, 'no plans');
  ok('data: every plan has a finite rate > 0', P.every(r => typeof r.rate === 'number' && isFinite(r.rate) && r.rate > 0),
    P.filter(r => !(typeof r.rate === 'number' && isFinite(r.rate) && r.rate > 0)).slice(0, 3).map(r => r.id).join(', '));
  ok('data: every plan has currency + source + license', P.every(r => r.meta.currency && r.meta.source && r.meta.license));
  const unlocated = P.filter(r => !r.located);
  ok('data: every plan locates on the map', unlocated.length === 0, unlocated.map(r => r.id).join(', '));
  // national plans must resolve a geometry
  const natMiss = P.filter(r => r.meta.coverage && r.meta.coverage.national && OET.nationalGeometry && !OET.nationalGeometry(r.meta.country, r.meta.region));
  ok('data: national plans resolve a country geometry', natMiss.length === 0, natMiss.map(r => r.meta.country).join(', '));

  // ---- COST ENGINE (per currency) ----------------------------------------
  const usage = OET.usageFromAnnual(5000);
  ok('cost: usageFromAnnual returns 24h weekday+weekend', usage && usage.weekday.length === 24 && usage.weekend.length === 24);
  const bandUsage = OET.usageFromBands ? OET.usageFromBands({ peak: 5, shoulder: 5, offpeak: 5 }) : null;
  ok('cost: usageFromBands returns a profile', bandUsage && bandUsage.weekday.length === 24);
  // one plan per distinct currency must cost without NaN, and the two engines agree
  const byCur = {}; P.forEach(r => { byCur[r.meta.currency] = byCur[r.meta.currency] || r; });
  const curs = Object.keys(byCur);
  let costBad = [];
  for (const cur of curs) {
    const r = byCur[cur];
    const a = OET.estimateAnnualCost(r.tariff, usage);
    const b = OET.costBreakdown(r.tariff, usage);
    if (!(typeof a === 'number' && isFinite(a) && a > 0)) costBad.push(cur + ':estimate');
    else if (!b || Math.abs(b.total - a) > 1) costBad.push(cur + ':mismatch');
  }
  ok('cost: every currency estimates without NaN and both engines agree (' + curs.length + ' currencies)', costBad.length === 0, costBad.join(', '));
  // TOU vs flat band counts
  const aTou = P.find(r => r.tariff.kind === 'tou'), aFlat = P.find(r => r.tariff.kind === 'flat');
  ok('cost: TOU breakdown has >=2 bands', !aTou || OET.costBreakdown(aTou.tariff, usage).bands.length >= 2);
  ok('cost: flat breakdown has 1 band', !aFlat || OET.costBreakdown(aFlat.tariff, usage).bands.length === 1);

  // ---- CSV PARSERS -------------------------------------------------------
  const long = ['2025-01-01 00:00,0.5', '2025-01-01 00:30,0.4', '2025-06-15 18:00,1.2'].join('\n');
  const cols = []; for (let h = 0; h < 24; h++) { const a = String(h).padStart(2, '0'); cols.push(`${a}:00 - ${a}:30`, `${a}:30 - ${String((h + 1) % 24).padStart(2, '0')}:00`); }
  const wide = [['NMI', 'Type', 'Date', ...cols].join(','),
    ['1', 'CON', '01/01/2025', ...cols.map(() => '0.5')].join(','),
    ['1', 'CON', '02/01/2025', ...cols.map(() => '0.4')].join(','),
    ['1', 'CON', '01/01/2025', ...cols.map(() => '0.5')].join(',')].join('\n'); // dup row
  const rl = OET.parseUsageFile ? OET.parseUsageFile(long) : null;
  const rw = OET.parseUsageFile ? OET.parseUsageFile(wide) : null;
  ok('parser: long (timestamp,kWh) detected + parsed', rl && rl.profile && rl.annualKwh > 0);
  ok('parser: wide 48-col detected + parsed', rw && rw.profile && rw.annualKwh > 0);
  ok('parser: wide dedupes duplicate rows', rw && rw.duplicates >= 1, 'duplicates=' + (rw && rw.duplicates));

  // ---- UI / THEME (DOM, non-destructive) ---------------------------------
  const root = document.documentElement, themeBefore = root.getAttribute('data-theme');
  root.setAttribute('data-theme', 'dark'); if (OET.setMapTheme) OET.setMapTheme(true);
  ok('ui: dark theme adds dark map tiles', !!document.querySelector('.oet-dark-tiles'));
  root.setAttribute('data-theme', 'light'); if (OET.setMapTheme) OET.setMapTheme(false);
  ok('ui: light theme removes dark map tiles', !document.querySelector('.oet-dark-tiles'));
  if (themeBefore) root.setAttribute('data-theme', themeBefore); if (OET.setMapTheme) OET.setMapTheme(themeBefore === 'dark');
  ok('ui: guide is available', typeof OET.showGuide === 'function');
  if (OET.showGuide) { OET.showGuide(); const present = !!document.querySelector('.oet-guide'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); ok('ui: guide opens and Esc-closes', present && !document.querySelector('.oet-guide')); }
  ok('ui: help + theme + nav buttons exist', ['helpToggle', 'themeToggle', 'navToggle'].every(id => document.getElementById(id)));

  // ---- GEOCODING (online; the class of bug that kept biting) --------------
  if (online && OET.geocodeAddress) {
    await okAsync('geo: "london" worldwide -> United Kingdom', async () => { const r = await OET.geocodeAddress('london', ''); return [r && /United Kingdom|England/.test(r.label) && r.cc === 'GB', r && r.label]; });
    await okAsync('geo: "sydney" worldwide -> Australia', async () => { const r = await OET.geocodeAddress('sydney', ''); return [r && r.cc === 'AU', r && r.label]; });
    await okAsync('geo: country-scoped "manchester" cc=gb stays GB', async () => { const l = await OET.suggestAddress('manchester', null, 'gb'); return [l.length > 0 && l.every(s => s.cc === 'GB'), 'n=' + l.length]; });
    await okAsync('geo: worldwide "sunset strip" ranks US first (no AU bias)', async () => { const l = await OET.suggestAddress('sunset strip', null, ''); return [l[0] && l[0].cc === 'US', l[0] && l[0].label]; });
    await okAsync('geo: results carry an ISO-2 country code', async () => { const l = await OET.suggestAddress('berlin', null, ''); return [l[0] && /^[A-Z]{2}$/.test(l[0].cc || ''), l[0] && l[0].cc]; });
  }

  const passed = results.filter(r => r.ok).length;
  const out = { passed, failed: results.length - passed, total: results.length, results };
  // pretty console output
  try {
    console.log(`%c OET self-test: ${passed}/${results.length} passed `, `background:${out.failed ? '#dc2626' : '#16a34a'};color:#fff;font-weight:bold`);
    console.table(results.map(r => ({ test: r.name, result: r.ok ? '✓' : '✗ ' + r.msg })));
  } catch (_) {}
  return out;
};

// auto-run when ?selftest is present
(function () {
  if (/[?&]selftest/.test(location.search)) {
    window.addEventListener('DOMContentLoaded', () => setTimeout(() => OET.selfTest(), 1500));
  }
})();
