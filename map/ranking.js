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
      + '.oet-rfoot{padding:10px 18px;border-top:1px solid var(--border,#e2e8f0);font-size:11px;color:var(--muted,#64748b);line-height:1.5}';
    document.head.appendChild(s);
  }

  let back = null, curMetric = 'nominal';
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

  function render(bodyEl) {
    const m = METRICS.find((x) => x.id === curMetric);
    const rows = OET.countryRanking(curMetric);
    const maxV = Math.max(...rows.map((r) => r.max), 1e-9);
    bodyEl.innerHTML = rows.map((r, i) => {
      const wMin = Math.max(1, (r.min / maxV) * 100), wSpan = Math.max(1.5, ((r.max - r.min) / maxV) * 100);
      return '<div class="oet-rrow">'
        + `<div class="oet-rnum">${i + 1}</div>`
        + `<div><div class="oet-rname">${r.name} ${OET.maturityPill ? OET.maturityPill(OET.countryMaturity(r.cc)) : ''}${xcChip(r.cc)}</div>`
        + `<div class="oet-rmeta">${r.n} plan${r.n > 1 ? 's' : ''} · ${r.currency}${!r.hasIncome && curMetric !== 'nominal' ? ' · no income data' : ''}</div>`
        + `<div class="oet-rbar"><i style="left:${wMin}%;width:${wSpan}%"></i></div></div>`
        + `<div><div class="oet-rval">${m.fmt(r.value)}</div><div class="oet-rband">${m.fmt(r.min)}–${m.fmt(r.max)}</div></div>`
        + '</div>';
    }).join('') || '<div class="oet-rhelp">No data for this metric.</div>';
  }

  OET.showRanking = function () {
    injectCss(); close();
    back = document.createElement('div'); back.className = 'oet-rback';
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    back.innerHTML =
      '<div class="oet-rank" role="dialog" aria-label="Country electricity price ranking">'
      + `<div class="oet-rhead"><h2>🌍 Cheapest countries for electricity ${OET.maturityPill ? OET.maturityPill(OET.FEATURE_MATURITY.ranking) : ''}</h2><button class="oet-rx" aria-label="Close">×</button></div>`
      + '<div class="oet-rtabs">' + METRICS.map((x) => `<button class="oet-rtab" data-m="${x.id}">${x.label}<span style="opacity:.7"> · ${x.unit}</span></button>`).join('') + '</div>'
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
      helpEl.textContent = METRICS.find((x) => x.id === id).help;
      render(bodyEl);
    }
    tabs.forEach((t) => t.addEventListener('click', () => select(t.dataset.m)));
    back.querySelector('.oet-rx').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    select(curMetric);
  };
})();
