// Country price-ranking view: "what's the cheapest country for electricity?"
// Three honest lenses (nominal sticker price, PPP-adjusted, and affordability as
// a share of income), computed from our community plans (the spread/band) and
// World Bank income/PPP reference data (OET.INCOME). Single numbers hide that
// the within-country spread is often as wide as the between-country gap, so each
// country shows a min–median–max band, and thin-data countries are flagged.
window.OET = window.OET || {};

(function () {
  const REF_KWH = 3500; // reference annual household consumption for affordability

  function median(a) {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // metric value for a single local rate, given country code + currency
  function valueOf(metric, rate, cur, cc) {
    const inc = OET.INCOME && OET.INCOME[cc];
    if (metric === 'ppp') return inc ? rate / inc.ppp : null;                 // int$ / kWh
    if (metric === 'afford') return inc ? (rate * REF_KWH / inc.ppp) / inc.gni * 100 : null; // % of GNI/yr
    return OET.toUsd ? OET.toUsd(rate, cur) : rate;                           // nominal USD / kWh
  }

  // Build the ranking. Returns [{cc, name, n, currency, value, min, max, thin, hasIncome}] sorted cheapest-first.
  OET.countryRanking = function (metric) {
    metric = metric || 'nominal';
    const P = OET.PLANS || [];
    const by = {};
    for (const r of P) {
      const cc = r.meta.country;
      (by[cc] = by[cc] || { rates: [], cur: r.meta.currency, srcs: new Set() }).rates.push(r.rate);
      by[cc].srcs.add(r.meta.source);
    }
    const rows = [];
    for (const cc in by) {
      const g = by[cc];
      const vals = g.rates.map((rt) => valueOf(metric, rt, g.cur, cc)).filter((v) => v != null && isFinite(v));
      if (!vals.length) continue; // e.g. PPP/afford with no income row
      rows.push({
        cc, name: (OET.countryName ? OET.countryName(cc) : cc), n: g.rates.length, currency: g.cur,
        value: median(vals), min: Math.min(...vals), max: Math.max(...vals),
        thin: g.rates.length < 5, hasIncome: !!(OET.INCOME && OET.INCOME[cc]), srcs: [...g.srcs],
      });
    }
    rows.sort((a, b) => a.value - b.value);
    return rows;
  };

  // ---- panel UI ----------------------------------------------------------
  const METRICS = [
    { id: 'nominal', label: 'Sticker price', unit: 'USD/kWh', fmt: (v) => '$' + v.toFixed(3), help: 'Price in US dollars at market exchange rates (FX as of ' + (OET.FX_AS_OF || 'n/a') + '). Market FX is noisy — PPP is the fairer comparison.' },
    { id: 'ppp', label: 'PPP-adjusted', unit: 'int$/kWh', fmt: (v) => v.toFixed(3), help: 'Adjusted for cost-of-living (purchasing-power parity). Fairer real price.' },
    { id: 'afford', label: 'Affordability', unit: '% income/yr', fmt: (v) => v.toFixed(2) + '%', help: 'Cost of ' + REF_KWH + ' kWh/yr as a share of GNI per capita (PPP).' },
  ];

  function injectCss() {
    if (document.getElementById('oet-rank-css')) return;
    const s = document.createElement('style'); s.id = 'oet-rank-css';
    s.textContent =
      '.oet-rback{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:10001;padding:20px}'
      + '.oet-rank{background:var(--panel,#fff);color:var(--text,#1a2233);border-radius:12px;max-width:680px;width:100%;max-height:88vh;display:flex;flex-direction:column;box-shadow:0 12px 44px rgba(0,0,0,.45);font-size:13px}'
      + '.oet-rhead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border,#e2e8f0)}'
      + '.oet-rhead h2{margin:0;font-size:17px}.oet-rx{border:none;background:var(--hover,#f1f5f9);color:var(--text,#1a2233);border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:17px}'
      + '.oet-rtabs{display:flex;gap:6px;padding:10px 18px 4px;flex-wrap:wrap}'
      + '.oet-rtab{padding:6px 12px;border-radius:999px;border:1px solid var(--input-bd,#cbd5e1);background:var(--chip,#f8fafc);color:var(--text,#1a2233);cursor:pointer;font-size:12.5px}'
      + '.oet-rtab.on{background:#2563eb;border-color:#2563eb;color:#fff}'
      + '.oet-rhelp{padding:2px 18px 8px;color:var(--muted,#64748b);font-size:12px}'
      + '.oet-rbody{overflow:auto;padding:0 10px 10px}'
      + '.oet-rrow{display:grid;grid-template-columns:26px 1fr auto;gap:10px;align-items:center;padding:6px 8px;border-bottom:1px solid var(--border,#f1f5f9)}'
      + '.oet-rnum{color:var(--muted,#94a3b8);font-variant-numeric:tabular-nums;text-align:right}'
      + '.oet-rname{font-weight:600}.oet-rmeta{font-size:11px;color:var(--muted,#64748b)}'
      + '.oet-rbar{height:6px;border-radius:3px;background:var(--hover,#eef2f7);position:relative;margin-top:4px;overflow:hidden}'
      + '.oet-rbar > i{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,#16a34a,#eab308,#dc2626);opacity:.65;border-radius:3px}'
      + '.oet-rval{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}'
      + '.oet-rband{font-size:11px;color:var(--muted,#64748b);text-align:right}'
      + '.oet-rthin{display:inline-block;font-size:10px;color:#b45309;background:rgba(234,179,8,.15);border-radius:4px;padding:0 4px;margin-left:5px}'
      + '.oet-rsearch{padding:4px 18px 6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}'
      + '.oet-rsi{flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--input-bd,#cbd5e1);border-radius:7px;background:var(--input-bg,#fff);color:var(--text,#1a2233);font-size:13px}'
      + '.oet-rmy{padding:7px 8px;border:1px solid var(--input-bd,#cbd5e1);border-radius:7px;background:var(--input-bg,#fff);color:var(--text,#1a2233);font-size:13px;max-width:170px}'
      + '.oet-rsummary{margin:0 18px 6px;padding:8px 10px;border-radius:7px;background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.35);font-size:12.5px;color:var(--text,#1a2233)}'
      + '.oet-rrow.oet-rmine{background:rgba(37,99,235,.1);border-radius:6px}'
      + '.oet-ryou{display:inline-block;font-size:10px;font-weight:700;color:#fff;background:#2563eb;border-radius:5px;padding:0 5px;vertical-align:middle}'
      + '.oet-rfoot{padding:10px 18px;border-top:1px solid var(--border,#e2e8f0);font-size:11px;color:var(--muted,#64748b);line-height:1.5}';
    document.head.appendChild(s);
  }

  let back = null, curMetric = 'nominal', curSearch = '', myCountry = '';
  try { myCountry = localStorage.getItem('oet-my-country') || ''; } catch (_) {}
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function close() { if (back) { back.remove(); back = null; document.removeEventListener('keydown', onKey); } }
  function onKey(e) { if (e.key === 'Escape') close(); }

  // Cross-check chip: ✓ corroborated by / ⚠ diverges from the Eurostat reference.
  function xcChip(cc) {
    const x = OET.crossCheck && OET.crossCheck(cc);
    if (!x || x.ours == null) return '';
    const ok = x.status === 'match';
    const fg = ok ? '#15803d' : '#b45309', bg = ok ? 'rgba(22,163,74,.12)' : 'rgba(234,179,8,.16)';
    const tip = `Eurostat reference $${x.ref.toFixed(3)}/kWh vs our $${x.ours.toFixed(3)} (${Math.round(x.ratio * 100)}% of reference)`;
    return ` <span title="${tip}" style="font-size:10px;color:${fg};background:${bg};border-radius:4px;padding:0 4px;white-space:nowrap">${ok ? '✓' : '⚠'} ref</span>`;
  }

  // "My country" banner: where you rank vs everyone else, in the current metric.
  function renderSummary(all, m) {
    const el = back && back.querySelector('.oet-rsummary');
    if (!el) return;
    const mine = myCountry ? all.find((r) => r.cc === myCountry) : null;
    if (!mine) { el.style.display = 'none'; el.textContent = ''; return; }
    el.style.display = '';
    const rank = all.indexOf(mine) + 1, cheapest = all[0], dearest = all[all.length - 1];
    const median = all[Math.floor((all.length - 1) / 2)].value;
    const vsMed = median ? mine.value / median : 1;
    const vsCheap = cheapest.value ? mine.value / cheapest.value : 1;
    const place = rank === 1 ? 'the cheapest' : rank === all.length ? 'the most expensive' : `#${rank} of ${all.length}`;
    el.innerHTML = `🏠 <b>${esc(mine.name)}</b> is <b>${place}</b> · ${m.fmt(mine.value)} — `
      + `${vsMed >= 1.02 ? Math.round((vsMed - 1) * 100) + '% above' : vsMed <= 0.98 ? Math.round((1 - vsMed) * 100) + '% below' : 'about'} the median`
      + (rank > 1 ? `, ${vsCheap.toFixed(1)}× the cheapest (${esc(cheapest.name)})` : '') + '.';
  }

  function render(bodyEl) {
    const m = METRICS.find((x) => x.id === curMetric);
    const all = OET.countryRanking(curMetric);
    const maxV = Math.max(...all.map((r) => r.max), 1e-9);
    // Search: comma-separated country names/codes (OR) so you can find yours or
    // compare a few — ranks are preserved from the full list.
    const q = curSearch.trim().toLowerCase();
    const terms = q ? q.split(',').map((t) => t.trim()).filter(Boolean) : null;
    const rows = terms ? all.filter((r) => terms.some((t) => r.name.toLowerCase().indexOf(t) !== -1 || r.cc.toLowerCase() === t)) : all;
    renderSummary(all, m);
    bodyEl.innerHTML = rows.map((r) => {
      const i = all.indexOf(r), mine = r.cc === myCountry;
      const wMin = Math.max(1, (r.min / maxV) * 100), wSpan = Math.max(1.5, ((r.max - r.min) / maxV) * 100);
      return `<div class="oet-rrow${mine ? ' oet-rmine' : ''}">`
        + `<div class="oet-rnum">${i + 1}</div>`
        + `<div><div class="oet-rname">${mine ? '<span class="oet-ryou">You</span> ' : ''}${r.name} ${OET.maturityPill ? OET.maturityPill(OET.countryMaturity(r.cc)) : ''}${xcChip(r.cc)}</div>`
        + `<div class="oet-rmeta">${r.n} plan${r.n > 1 ? 's' : ''} · ${r.currency}${!r.hasIncome && curMetric !== 'nominal' ? ' · no income data' : ''}</div>`
        + `<div class="oet-rbar"><i style="left:${wMin}%;width:${wSpan}%"></i></div></div>`
        + `<div><div class="oet-rval">${m.fmt(r.value)}</div><div class="oet-rband">${m.fmt(r.min)}–${m.fmt(r.max)}</div></div>`
        + '</div>';
    }).join('') || `<div class="oet-rhelp">${terms ? 'No country matches “' + esc(curSearch) + '”.' : 'No data for this metric.'}</div>`;
  }

  OET.showRanking = function () {
    injectCss(); close(); curSearch = '';
    back = document.createElement('div'); back.className = 'oet-rback';
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    back.innerHTML =
      '<div class="oet-rank" role="dialog" aria-label="Country electricity price ranking">'
      + `<div class="oet-rhead"><h2>🌍 Cheapest countries for electricity ${OET.maturityPill ? OET.maturityPill(OET.FEATURE_MATURITY.ranking) : ''}</h2><button class="oet-rx" aria-label="Close">×</button></div>`
      + '<div class="oet-rtabs">' + METRICS.map((x) => `<button class="oet-rtab" data-m="${x.id}">${x.label}<span style="opacity:.7"> · ${x.unit}</span></button>`).join('') + '</div>'
      + '<div class="oet-rsearch"><input class="oet-rsi" type="search" placeholder="🔎 Find your country — or compare: australia, germany" aria-label="Search countries" />'
      + '<select class="oet-rmy" aria-label="My country"></select></div>'
      + '<div class="oet-rsummary" style="display:none"></div>'
      + '<div class="oet-rhelp"></div>'
      + '<div class="oet-rbody"></div>'
      + `<div class="oet-rfoot">Ranked cheapest→dearest by the median of our community plans; the bar shows each country’s min–max spread. `
      + `${OET.maturityPill ? OET.maturityPill('beta') + ' = real source / corroborated · ' + OET.maturityPill('experimental') + ' = illustrative. ' : ''}`
      + `<b>✓ ref</b> = within 25% of the Eurostat household reference; <b>⚠ ref</b> = diverges (check the basis). `
      + `Baseline: Eurostat nrg_pc_204 ${OET.BASELINE_AS_OF || ''} (CC BY 4.0). Income/PPP: World Bank (CC BY 4.0); FX ${OET.FX_AS_OF || 'n/a'} via exchangerate-api.com. Prices: community-maintained, verify your bill.</div>`
      + '</div>';
    document.body.appendChild(back);
    const bodyEl = back.querySelector('.oet-rbody'), helpEl = back.querySelector('.oet-rhelp');
    const tabs = [...back.querySelectorAll('.oet-rtab')];
    function select(id) {
      curMetric = id;
      tabs.forEach((t) => t.classList.toggle('on', t.dataset.m === id));
      const mm = METRICS.find((x) => x.id === id);
      helpEl.innerHTML = esc(mm.help) + (id === 'nominal' && OET.conversionBadge ? ' ' + OET.conversionBadge() : '');
      render(bodyEl);
    }
    tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.m)));
    const si = back.querySelector('.oet-rsi');
    if (si) si.addEventListener('input', () => { curSearch = si.value; render(bodyEl); });
    // Populate "My country" from the ranked set (alphabetical), persist the choice.
    const my = back.querySelector('.oet-rmy');
    if (my) {
      const opts = OET.countryRanking('nominal').map((r) => ({ cc: r.cc, name: r.name })).sort((a, b) => a.name.localeCompare(b.name));
      my.innerHTML = '<option value="">🏠 My country…</option>' + opts.map((o) => `<option value="${o.cc}"${o.cc === myCountry ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
      my.addEventListener('change', () => { myCountry = my.value; try { localStorage.setItem('oet-my-country', myCountry); } catch (_) {} render(bodyEl); });
    }
    back.querySelector('.oet-rx').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    select(curMetric);
  };
})();
