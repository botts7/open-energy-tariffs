// Table ("decide") view — a cheapest-first, sortable comparison table over the
// same filtered plan set the map shows (OET._visible) + the same usage. Reuses
// the cost engine, maturity/freshness badges, plan modal and compare set. The
// header Map⇄Table toggle calls OET.setView().
window.OET = window.OET || {};

(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  let view = 'map', sortCol = 'cost', sortDir = 1, period = 'annual';
  const PERIODS = { annual: { div: 1, lbl: '/yr' }, quarterly: { div: 4, lbl: '/qtr' }, monthly: { div: 12, lbl: '/mo' } };
  const CAP = 250;

  function annualCost(r) {
    const u = OET._tableUsage;
    if (!u || !OET.estimateAnnualCost) return null;
    const c = OET.estimateAnnualCost(r.tariff, u);
    return (typeof c === 'number' && isFinite(c)) ? c : null;
  }
  const usd = (v, cur) => (OET.toUsd ? OET.toUsd(v, cur) : v);

  // Representative rate (ToU average, not peak) for the reference comparison.
  function repRate(r) {
    const t = r.tariff, imp = t && t.import;
    if (t && t.kind === 'tou' && imp && imp.bands && imp.bands.length) return imp.bands.reduce((a, b) => a + (b.rate || 0), 0) / imp.bands.length;
    return r.rate;
  }
  // Country median (USD/kWh) — the fallback reference where there's no official
  // benchmark (e.g. AU isn't in Eurostat/EIA). Cached per country.
  const medianCache = {};
  function countryMedianUsd(cc) {
    if (cc in medianCache) return medianCache[cc];
    const vals = (OET.PLANS || []).filter((r) => r.meta.country === cc).map((r) => usd(repRate(r), r.meta.currency)).filter((v) => v > 0).sort((a, b) => a - b);
    return (medianCache[cc] = vals.length ? vals[vals.length >> 1] : null);
  }
  // Reference price for this plan: EIA per-state (US), Eurostat (EU), else the
  // country median. Returns { ref, src } or null.
  function planRef(r) {
    const m = r.meta; let ref = null, src = '';
    if (m.country === 'US' && OET.BASELINE_US) { const s = OET.BASELINE_US.states && OET.BASELINE_US.states[m.region]; ref = s != null ? s : (OET.BASELINE_US.national || null); src = 'EIA'; }
    else if (OET.baselineUsd) { ref = OET.baselineUsd(m.country); src = 'Eurostat'; }
    if (ref == null) { ref = countryMedianUsd(m.country); src = 'median'; }
    return ref != null ? { ref, src } : null;
  }
  // Savings vs the user's baseline (current plan / actual bill), same currency.
  function hasBaseline() { return !!(OET._tableUsageReal && OET._baseline && OET._baseline.cost > 0); }
  function savingsCell(r) {
    const b = OET._baseline, c = annualCost(r);
    if (c == null || (b.rec && b.rec.meta.currency !== r.meta.currency)) return '<td data-label="Savings">—</td>';
    const s = b.cost - c; // positive = cheaper than your baseline
    const fg = s > 1 ? '#15803d' : s < -1 ? '#dc2626' : 'var(--muted,#64748b)';
    const txt = s > 1 ? '−' + Math.round(s).toLocaleString() + ' ' + esc(r.meta.currency) : s < -1 ? '+' + Math.round(-s).toLocaleString() + ' ' + esc(r.meta.currency) : '≈';
    return `<td class="tv-save" data-label="Savings" style="color:${fg};font-weight:700" title="vs ${esc(b.label || 'your current')}">${txt}</td>`;
  }
  // "% vs reference" cell: green below (cheaper), red above; — when no reference.
  function refCell(r) {
    const pr = planRef(r), mine = pr && usd(repRate(r), r.meta.currency);
    if (!pr || mine == null || !isFinite(mine)) return '<td class="tv-ref" data-label="vs ref">—</td>';
    const pct = Math.round((mine / pr.ref - 1) * 100);
    const fg = pct <= -2 ? '#15803d' : pct >= 2 ? '#dc2626' : 'var(--muted,#64748b)';
    const txt = pct === 0 ? '≈' : (pct < 0 ? pct + '%' : '+' + pct + '%');
    const tip = pr.src === 'median'
      ? 'vs the median plan in ' + esc(OET.countryName ? OET.countryName(r.meta.country) : r.meta.country) + ' (no official reference yet)'
      : 'vs the ' + pr.src + ' household reference price';
    return `<td class="tv-ref" data-label="vs ref" title="${tip}" style="color:${fg}">${txt}</td>`;
  }

  OET.setView = function (v) {
    view = v;
    const map = document.getElementById('map'), tbl = document.getElementById('tableview');
    const sbScroll = document.querySelector('.sb-scroll');
    if (map) map.style.display = v === 'table' ? 'none' : '';
    if (tbl) tbl.style.display = v === 'table' ? 'flex' : 'none';
    if (sbScroll) sbScroll.style.display = v === 'table' ? 'none' : ''; // hide the redundant list in table mode
    document.querySelectorAll('.sb-maponly').forEach((e) => { e.style.display = v === 'table' ? 'none' : ''; }); // map-only controls (e.g. outline)
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    if (v === 'table') OET.renderTable();
    else if (OET._map) OET._map.invalidateSize();
  };
  OET.onResults = function () { if (view === 'table') OET.renderTable(); };

  function sortRows(rows) {
    const key = {
      cost: (r) => { const c = annualCost(r); return c == null ? Infinity : usd(c, r.meta.currency); },
      rate: (r) => { const v = usd(r.rate, r.meta.currency); return (v == null || isNaN(v)) ? Infinity : v; },
      supply: (r) => { const s = r.tariff.supply && r.tariff.supply.daily; return s == null ? Infinity : usd(s, r.meta.currency); },
      provider: (r) => (r.meta.provider + ' ' + r.meta.plan).toLowerCase(),
    }[sortCol] || (() => 0);
    return rows.slice().sort((a, b) => { const ka = key(a), kb = key(b); return ka < kb ? -sortDir : ka > kb ? sortDir : 0; });
  }

  OET.renderTable = function () {
    const host = document.getElementById('tableview'); if (!host) return;
    const all = OET._visible || OET.PLANS || [];
    const rows = sortRows(all).slice(0, CAP);
    const real = OET._tableUsageReal;
    // cheapest plan (by estimated cost, USD-normalised) gets a badge
    let cheapestId = null, minC = Infinity;
    for (const r of rows) { const c = annualCost(r), cu = c == null ? Infinity : usd(c, r.meta.currency); if (cu < minC) { minC = cu; cheapestId = r.id; } }
    const plbl = PERIODS[period].lbl, div = PERIODS[period].div;
    const arrow = (c) => sortCol === c ? (sortDir > 0 ? ' ▲' : ' ▼') : '';
    const th = (c, label) => `<th data-col="${c}" class="${sortCol === c ? 'sorted' : ''}">${label}${arrow(c)}</th>`;

    let html = '<div class="tv-bar">'
      + `<div class="tv-count">${all.length.toLocaleString()} plan${all.length === 1 ? '' : 's'}${all.length > CAP ? ` · showing cheapest ${CAP}` : ''}`
      + `${real ? '' : ' · <span class="tv-warn">estimates use a typical profile — enter your usage for accurate costs</span>'}</div>`
      + `<div class="tv-period">Show cost: ${Object.keys(PERIODS).map((p) => `<button data-period="${p}" class="${period === p ? 'on' : ''}">${p}</button>`).join('')}</div>`
      + '</div>'
      + (hasBaseline() ? `<div class="tv-baseline">Comparing against <b>${esc(OET._baseline.label || 'your current plan')}</b> (~${Math.round(OET._baseline.cost).toLocaleString()}/yr) — <span style="color:#16a34a">green = you save</span>, red = costs more</div>` : '')
      + '<div class="tv-scroll"><table class="tv-table"><thead><tr>'
      + th('provider', 'Provider · plan') + th('cost', 'Est. cost' + plbl)
      + (hasBaseline() ? '<th class="tv-savehdr" title="vs your current plan / actual bill">Savings/yr</th>' : '')
      + '<th class="tv-ref" title="vs the Eurostat/EIA household reference price">vs ref</th>' + th('rate', 'Rate /kWh')
      + th('supply', 'Supply /day') + '<th>Feed-in</th><th>Type</th><th>Compare</th>'
      + '</tr></thead><tbody>';

    for (const r of rows) {
      const m = r.meta, cur = m.currency, c = annualCost(r), cv = c == null ? null : c / div;
      const sup = r.tariff.supply && r.tariff.supply.daily, fin = r.tariff.export && r.tariff.export.flatRate;
      const inCmp = OET.compareSet && OET.compareSet.indexOf(r.id) !== -1;
      html += `<tr data-id="${esc(r.id)}"${r.id === cheapestId ? ' class="tv-best"' : ''}>`
        + `<td class="tv-name" title="${esc(m.provider + ' · ' + m.plan)}">${r.id === cheapestId ? '<span class="tv-badge">Cheapest</span> ' : ''}<b>${esc(m.provider)}</b> · ${esc(m.plan)}`
        + `<div class="tv-sub">${esc(OET.countryName ? OET.countryName(m.country) : m.country)}${m.region ? '/' + esc(m.region) : ''} `
        + `${OET.maturityPill ? OET.maturityPill(OET.countryMaturity(m.country)) : ''} ${OET.freshPill ? OET.freshPill(m.updated) : ''}</div></td>`
        + `<td class="tv-cost" data-label="Est. cost">${cv == null ? '—' : '~' + Math.round(cv).toLocaleString() + ' ' + esc(cur)}</td>`
        + (hasBaseline() ? savingsCell(r) : '')
        + refCell(r)
        + `<td data-label="Rate /kWh">${r.rate == null ? '—' : r.rate.toFixed(3) + ' ' + esc(cur)}</td>`
        + `<td data-label="Supply /day">${sup == null ? '—' : sup.toFixed(3) + ' ' + esc(cur)}</td>`
        + `<td data-label="Feed-in">${fin == null ? '—' : fin.toFixed(3) + ' ' + esc(cur)}</td>`
        + `<td data-label="Type">${r.tariff.kind === 'tou' ? 'ToU' : 'Flat'}</td>`
        + `<td data-label="Compare"><input type="checkbox" data-cmp="${esc(r.id)}"${inCmp ? ' checked' : ''} aria-label="Add to compare"></td>`
        + '</tr>';
    }
    html += '</tbody></table></div>';
    host.innerHTML = html;

    host.querySelectorAll('th[data-col]').forEach((el) => el.addEventListener('click', () => {
      const c = el.dataset.col; if (sortCol === c) sortDir *= -1; else { sortCol = c; sortDir = 1; } OET.renderTable();
    }));
    host.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => { period = b.dataset.period; OET.renderTable(); }));
    host.querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const r = (OET.PLANS || []).find((x) => x.id === tr.dataset.id); if (r && OET.showPlanModal) OET.showPlanModal(r);
    }));
    host.querySelectorAll('input[data-cmp]').forEach((cb) => cb.addEventListener('change', () => {
      const id = cb.dataset.cmp; OET.compareSet = OET.compareSet || [];
      const i = OET.compareSet.indexOf(id);
      if (cb.checked && i === -1) OET.compareSet.push(id); else if (!cb.checked && i !== -1) OET.compareSet.splice(i, 1);
      if (OET._onCompareChange) OET._onCompareChange();
    }));
  };
})();
