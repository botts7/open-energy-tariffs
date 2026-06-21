// Plan-details modal: click a plan in the sidebar -> a dialog with the FULL
// tariff (rate structure, schedule, supply, export, controlled load, coverage,
// notes, source). All community/imported values are escaped (untrusted input).
window.OET = window.OET || {};

(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const num = (n) => (typeof n === 'number' && isFinite(n) ? n : null);

  // one-time CSS
  function injectCss() {
    if (document.getElementById('oet-modal-css')) return;
    const s = document.createElement('style');
    s.id = 'oet-modal-css';
    s.textContent =
      '.oet-mback{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px}'
      + '.oet-modal{background:var(--panel,#fff);border-radius:10px;max-width:540px;width:100%;max-height:86vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.45);font-size:13px;color:var(--text,#1a2233)}'
      + '.oet-mhead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border,#e2e8f0);position:sticky;top:0;background:var(--panel,#fff)}'
      + '.oet-mhead h2{margin:0;font-size:16px}.oet-mhead .sub{font-size:12px;color:var(--muted,#64748b);margin-top:2px}'
      + '.oet-mx{border:none;background:var(--hover,#f1f5f9);color:var(--text,#1a2233);border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:16px;flex:none}'
      + '.oet-mbody{padding:14px 16px}'
      + '.oet-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0 0 12px}'
      + '.oet-kv dt{color:var(--muted,#64748b)}.oet-kv dd{margin:0;font-weight:600}'
      + '.oet-sec{margin:14px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#94a3b8);border-top:1px solid var(--border,#f1f5f9);padding-top:10px}'
      + '.oet-tbl{width:100%;border-collapse:collapse;font-size:12.5px}.oet-tbl th,.oet-tbl td{text-align:left;padding:4px 6px;border-bottom:1px solid var(--border,#f1f5f9)}.oet-tbl th{color:var(--muted,#64748b);font-weight:600}'
      + '.oet-sw{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px;border:1px solid rgba(0,0,0,.2)}'
      + '.oet-note{font-size:12px;color:var(--text,#475569);background:var(--hover,#f8fafc);border:1px solid var(--border,#eef2f7);border-radius:6px;padding:8px 10px;line-height:1.4}'
      + '.oet-mfoot{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--border,#e2e8f0);position:sticky;bottom:0;background:var(--panel,#fff)}'
      + '.oet-btn{padding:7px 14px;border-radius:6px;border:1px solid var(--input-bd,#cbd5e1);background:var(--chip,#f8fafc);color:var(--text,#1a2233);cursor:pointer;font-size:13px}'
      + '.oet-btn.primary{background:#2563eb;border-color:#2563eb;color:#fff}'
      + '.oet-mfoot{flex-wrap:wrap}'
      + '.oet-cmp th{vertical-align:top;position:relative;min-width:130px}'
      + '.oet-cmp tbody th{text-align:left;color:var(--muted,#64748b);font-weight:600;white-space:nowrap;min-width:auto}'
      + '.oet-rm{position:absolute;top:0;right:0;border:none;background:var(--hover,#f1f5f9);color:var(--text,#1a2233);border-radius:4px;width:18px;height:18px;cursor:pointer;font-size:12px;line-height:1}'
      + '.oet-best{background:rgba(22,163,74,.15)}';
    document.head.appendChild(s);
  }

  const fmtDays = (d) => Array.isArray(d) ? d.join(', ') : esc(d);

  function rateStructHtml(rs, currency) {
    if (!rs) return '';
    if (num(rs.flatRate) != null) return `<div>Flat: <b>${rs.flatRate} ${esc(currency)}/kWh</b></div>`;
    let html = '';
    if (Array.isArray(rs.bands) && rs.bands.length) {
      html += '<table class="oet-tbl"><thead><tr><th>Band</th><th>Rate</th></tr></thead><tbody>'
        + rs.bands.map((b) => `<tr><td>${esc(b.name || b.id)}</td><td>${num(b.rate) != null ? b.rate + ' ' + esc(currency) : '—'}</td></tr>`).join('')
        + '</tbody></table>';
    }
    if (Array.isArray(rs.schedule) && rs.schedule.length) {
      html += '<table class="oet-tbl" style="margin-top:6px"><thead><tr><th>Days</th><th>From</th><th>To</th><th>Band</th></tr></thead><tbody>'
        + rs.schedule.map((iv) => `<tr><td>${fmtDays(iv.days)}</td><td>${esc(iv.from)}</td><td>${esc(iv.to)}</td><td>${esc(iv.band)}</td></tr>`).join('')
        + '</tbody></table>';
    }
    return html;
  }

  let backdrop = null;
  function close() { if (backdrop) { backdrop.remove(); backdrop = null; document.removeEventListener('keydown', onKey); } }
  function onKey(e) { if (e.key === 'Escape') close(); }

  OET.showPlanModal = function (rec) {
    if (!rec) return;
    injectCss();
    close();
    const m = rec.meta, t = rec.tariff, cur = m.currency, cov = m.coverage || {};
    const pcCount = (cov.postcodes || []).length;
    const heavy = pcCount >= 120; // big networks lag when drawn as real boundaries
    const swatch = (OET._rateColorNow || OET.rateColorFor || OET.rateColor || (() => '#999'))(rec.rate, cur);

    const kv = [];
    const add = (k, v) => { if (v != null && v !== '') kv.push(`<dt>${esc(k)}</dt><dd>${v}</dd>`); };
    const cName = (OET.countryName ? OET.countryName(m.country) : m.country);
    const sName = (OET.sourceName ? OET.sourceName(m.source) : m.source);
    add('Country', esc(cName) + (m.region ? ' / ' + esc(m.region) : ''));
    add('Distributor', m.distributor ? esc(m.distributor) : null);
    add('Retailer', esc(m.provider));
    add('Type', esc(t.kind));
    add('Rate', rec.rate == null ? '—' : `<span class="oet-sw" style="background:${swatch}"></span>${rec.rate} ${esc(cur)}/kWh`);
    if (t.supply && num(t.supply.daily) != null) add('Daily supply', `${t.supply.daily} ${esc(cur)}/day`);
    add('Source', esc(sName));
    add('Updated', esc(m.updated));
    add('Verified', m.verified ? 'yes' : 'no');

    let where = cov.national ? 'National' : '';
    if (cov.postcodes) where = `${cov.postcodes.length} postcode(s)`;
    else if (cov.gsp) where = `GSP ${esc(cov.gsp)}`;
    else if (cov.utilityId) where = `utility ${esc(cov.utilityId)}`;
    add('Coverage', where || '—');

    let body = `<dl class="oet-kv">${kv.join('')}</dl>`;
    // Detailed cost for the user's loaded/entered usage — what this plan would cost.
    const bd = (OET._usage && OET.costBreakdown) ? OET.costBreakdown(t, OET._usage) : null;
    if (bd) {
      body += `<div class="oet-sec">Your estimated annual cost</div>`;
      body += '<table class="oet-tbl"><tbody>'
        + bd.bands.map((b) => `<tr><td>${esc(b.name)} <span style="color:#94a3b8">${Math.round(b.kwh).toLocaleString()} kWh @ ${b.rate} ${esc(cur)}</span></td><td>${Math.round(b.cost).toLocaleString()} ${esc(cur)}</td></tr>`).join('')
        + `<tr><td>Daily supply × 365</td><td>${Math.round(bd.supply).toLocaleString()} ${esc(cur)}</td></tr>`
        + (bd.exportCredit ? `<tr><td>Solar export credit <span style="color:#94a3b8">${Math.round(bd.exportKwh).toLocaleString()} kWh</span></td><td>−${Math.round(bd.exportCredit).toLocaleString()} ${esc(cur)}</td></tr>` : '')
        + `<tr style="font-weight:700;border-top:2px solid #e2e8f0"><td>Total / year</td><td>${Math.round(bd.total).toLocaleString()} ${esc(cur)}</td></tr>`
        + '</tbody></table>';
      // History (your current) vs proposed (this plan) — the saving.
      const bl = OET._baseline;
      if (bl && typeof bl.cost === 'number') {
        const diff = bd.total - bl.cost, save = diff < 0;
        body += `<div class="oet-note" style="margin-top:8px;background:${save ? '#f0fdf4' : '#fef2f2'};border-color:${save ? '#bbf7d0' : '#fecaca'}">`
          + `Your current (${esc(bl.label)}): ~${Math.round(bl.cost).toLocaleString()} ${esc(cur)}/yr · `
          + `on this plan <b style="color:${save ? '#16a34a' : '#dc2626'}">${save ? 'save ' : '+'}${Math.round(Math.abs(diff)).toLocaleString()} ${esc(cur)}/yr</b></div>`;
      }
      body += `<div class="oet-note" style="margin-top:8px">Based on your usage (~${Math.round(bd.annualKwh).toLocaleString()} kWh/yr), annualised against this plan's own time-of-use bands.</div>`;
    }
    body += `<div class="oet-sec">Import rates</div>${rateStructHtml(t.import, cur) || '—'}`;
    // Side-by-side comparison vs the user's current plan, with coloured diffs.
    const blRec = OET._baseline && OET._baseline.rec;
    if (blRec && blRec.tariff && blRec.id !== rec.id) {
      const bdCur = (bd && OET.costBreakdown && OET._usage) ? OET.costBreakdown(blRec.tariff, OET._usage) : null;
      const feed = (tar) => (tar.export && typeof tar.export.flatRate === 'number') ? tar.export.flatRate : null;
      const supplyOf = (tar) => tar.supply && num(tar.supply.daily) != null ? tar.supply.daily : 0;
      // [label, thisVal, currentVal, lowerIsBetter, decimals]
      const rows = [];
      if (bd && bdCur) rows.push(['Effective rate /kWh', bd.energy / (bd.annualKwh || 1), bdCur.energy / (bdCur.annualKwh || 1), true, 4]);
      rows.push(['Daily supply', supplyOf(t), supplyOf(blRec.tariff), true, 3]);
      const fT = feed(t), fC = feed(blRec.tariff);
      if (fT != null || fC != null) rows.push(['Solar feed-in /kWh', fT || 0, fC || 0, false, 3]);
      if (bd && bdCur) rows.push(['Total / year', bd.total, bdCur.total, true, 0]);
      const fnum = (v, dp) => dp === 0 ? Math.round(v).toLocaleString() : v.toFixed(dp);
      const cellRow = (label, a, b, lowerBetter, dp) => {
        const diff = a - b, eps = dp === 0 ? 0.5 : Math.pow(10, -dp) / 2;
        const same = Math.abs(diff) < eps, better = lowerBetter ? diff < 0 : diff > 0;
        const color = same ? '#64748b' : (better ? '#16a34a' : '#dc2626');
        const txt = same ? '≈' : (diff > 0 ? '+' : '−') + fnum(Math.abs(diff), dp);
        return `<tr><th>${label}</th><td>${fnum(a, dp)}</td><td>${fnum(b, dp)}</td><td style="color:${color};font-weight:700">${txt}</td></tr>`;
      };
      body += `<div class="oet-sec">This plan vs your current — ${esc(OET._baseline.label)}</div>`;
      body += `<table class="oet-tbl"><thead><tr><th></th><th>This plan</th><th>Current</th><th>Diff</th></tr></thead><tbody>`
        + rows.map((r) => cellRow.apply(null, r)).join('') + '</tbody></table>';
    }
    if (t.export) body += `<div class="oet-sec">Export (feed-in)</div>${rateStructHtml(t.export, cur)}`;
    if (Array.isArray(t.controlledLoad) && t.controlledLoad.length) {
      body += '<div class="oet-sec">Controlled load</div><table class="oet-tbl"><tbody>'
        + t.controlledLoad.map((c) => `<tr><td>${esc(c.name || c.id)}</td><td>${num(c.rate) != null ? c.rate + ' ' + esc(cur) : '—'}</td></tr>`).join('')
        + '</tbody></table>';
    }
    if (pcCount) body += `<div class="oet-sec">Coverage on map</div><div class="oet-note">The map shows an approximate coverage outline. <b>Exact boundary</b> fetches the real ABS postcode shapes${heavy ? ` — this plan serves <b>${pcCount}</b> postcodes, so it can take a few seconds and briefly lag the map.` : '.'}</div>`;
    if (m.notes) body += `<div class="oet-sec">Notes</div><div class="oet-note">${esc(m.notes)}</div>`;
    // Only render the link for http(s) URLs (block javascript:/data: in href).
    const safeUrl = /^https?:\/\//i.test(m.sourceUrl || '') ? m.sourceUrl : null;
    if (safeUrl) body += `<div style="margin-top:12px"><a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">Source ↗</a> · licence ${esc(m.license)}</div>`;
    else if (m.license) body += `<div style="margin-top:12px;color:#64748b">Licence ${esc(m.license)}</div>`;

    backdrop = document.createElement('div');
    backdrop.className = 'oet-mback';
    backdrop.innerHTML =
      `<div class="oet-modal" role="dialog" aria-modal="true">`
      + `<div class="oet-mhead"><div><h2>${esc(m.provider)}</h2><div class="sub">${esc(m.plan)}</div></div>`
      + `<button class="oet-mx" title="Close">×</button></div>`
      + `<div class="oet-mbody">${body}</div>`
      + `<div class="oet-mfoot">`
        + `<button class="oet-btn" data-cmp>${OET.isInCompare && OET.isInCompare(rec.id) ? '✓ In compare' : '+ Compare'}</button>`
        + (pcCount ? `<button class="oet-btn" data-exact title="Fetches real ABS postcode boundaries — can lag for large networks">Exact boundary · ${pcCount} pc${heavy ? ' ⚠' : ''}</button>` : '')
        + (rec.located ? '<button class="oet-btn" data-zoom>Show on map</button>' : '')
        + `<button class="oet-btn primary" data-close>Close</button></div>`
      + `</div>`;
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.matches('.oet-mx,[data-close]')) close(); });
    const zoom = backdrop.querySelector('[data-zoom]');
    if (zoom) zoom.addEventListener('click', () => { close(); if (OET.focusPlan) OET.focusPlan(rec.id); });
    const cmpBtn = backdrop.querySelector('[data-cmp]');
    if (cmpBtn) cmpBtn.addEventListener('click', () => {
      if (OET.isInCompare(rec.id)) { OET.removeFromCompare(rec.id); cmpBtn.textContent = '+ Compare'; }
      else { OET.addToCompare(rec.id); cmpBtn.textContent = '✓ In compare'; }
    });
    // Explicit, opt-in heavy load (real boundaries) with a loading state.
    const exact = backdrop.querySelector('[data-exact]');
    if (exact) exact.addEventListener('click', () => {
      exact.disabled = true; exact.textContent = 'Loading…';
      if (OET.focusPlan) OET.focusPlan(rec.id); // snap to it first
      Promise.resolve(OET.loadRealCoverage ? OET.loadRealCoverage(rec.id) : false).then(() => close());
    });
    document.body.appendChild(backdrop);
    document.addEventListener('keydown', onKey);
  };

  // --- compare set + side-by-side compare modal ---
  OET.compareSet = OET.compareSet || [];
  OET.isInCompare = (id) => (OET.compareSet || []).indexOf(id) !== -1;
  OET.addToCompare = function (id) { OET.compareSet = OET.compareSet || []; if (OET.compareSet.indexOf(id) === -1) { OET.compareSet.push(id); if (OET._onCompareChange) OET._onCompareChange(); } };
  OET.removeFromCompare = function (id) { OET.compareSet = (OET.compareSet || []).filter((x) => x !== id); if (OET._onCompareChange) OET._onCompareChange(); };
  OET.clearCompare = function () { OET.compareSet = []; if (OET._onCompareChange) OET._onCompareChange(); };

  OET.showCompareModal = function () {
    injectCss();
    close();
    const recs = (OET.compareSet || []).map((id) => (OET.PLANS || []).find((p) => p.id === id)).filter(Boolean);
    let body;
    if (!recs.length) {
      body = '<div class="oet-note">No plans added yet. Open a plan (click it on the list, or a map popup → <b>Full details</b>) and hit <b>+ Compare</b>.</div>';
    } else {
      const usage = OET._usage;
      const cName = (r) => (OET.countryName ? OET.countryName(r.meta.country) : r.meta.country);
      const sName = (r) => (OET.sourceName ? OET.sourceName(r.meta.source) : r.meta.source);
      const cur = (r) => esc(r.meta.currency);
      const oneCur = new Set(recs.map((r) => r.meta.currency)).size === 1; // cheapest only meaningful within one currency
      const minRate = oneCur ? Math.min.apply(null, recs.map((r) => (r.rate == null ? Infinity : r.rate))) : null;
      const costs = recs.map((r) => (usage && OET.estimateAnnualCost) ? OET.estimateAnnualCost(r.tariff, usage) : null);
      const minCost = (oneCur && usage) ? Math.min.apply(null, costs.map((c) => (c == null ? Infinity : c))) : null;
      const row = (label, fn, best) => `<tr><th>${label}</th>${recs.map((r, i) => `<td${best && best(r, i) ? ' class="oet-best"' : ''}>${fn(r, i)}</td>`).join('')}</tr>`;
      let html = '<div style="overflow-x:auto"><table class="oet-tbl oet-cmp"><thead><tr><th></th>'
        + recs.map((r) => `<th><div>${esc(r.meta.provider)}</div><div style="font-weight:400;color:#64748b">${esc(r.meta.plan)}</div><button class="oet-rm" data-rm="${esc(r.id)}" title="Remove">×</button></th>`).join('')
        + '</tr></thead><tbody>';
      html += row('Country', (r) => esc(cName(r)) + (r.meta.region ? ' / ' + esc(r.meta.region) : ''));
      html += row('Type', (r) => esc(r.tariff.kind));
      html += row('Rate /kWh', (r) => r.rate == null ? '—' : `${r.rate} ${cur(r)}`, oneCur ? (r) => r.rate === minRate : null);
      html += row('Daily supply', (r) => (r.tariff.supply && r.tariff.supply.daily != null) ? `${r.tariff.supply.daily} ${cur(r)}` : '—');
      html += row('Export', (r) => (r.tariff.export && r.tariff.export.flatRate != null) ? `${r.tariff.export.flatRate} ${cur(r)}` : '—');
      html += row('Coverage', (r) => { const c = r.meta.coverage || {}; return c.national ? 'National' : (c.postcodes ? c.postcodes.length + ' pc' : (c.gsp ? 'GSP ' + esc(c.gsp) : (c.utilityId ? 'utility' : '—'))); });
      html += row('Source', (r) => esc(sName(r)));
      if (usage) html += row('~Annual cost', (r, i) => costs[i] == null ? '—' : `${Math.round(costs[i]).toLocaleString()} ${cur(r)}`, (oneCur && usage) ? (r, i) => costs[i] === minCost : null);
      html += '</tbody></table></div>';
      if (!usage) html += '<div class="oet-note" style="margin-top:10px">Enter your usage in the sidebar (“Compare to my usage”) to add an estimated annual-cost row.</div>';
      else if (!oneCur) html += '<div class="oet-note" style="margin-top:10px">Plans span different currencies — cheapest is not highlighted.</div>';
      body = html;
    }
    backdrop = document.createElement('div');
    backdrop.className = 'oet-mback';
    backdrop.innerHTML = `<div class="oet-modal" role="dialog" aria-modal="true">`
      + `<div class="oet-mhead"><div><h2>Compare plans</h2><div class="sub">${recs.length} plan(s)</div></div><button class="oet-mx" title="Close">×</button></div>`
      + `<div class="oet-mbody">${body}</div>`
      + `<div class="oet-mfoot">${recs.length ? '<button class="oet-btn" data-clear>Clear all</button>' : ''}<button class="oet-btn primary" data-close>Close</button></div>`
      + `</div>`;
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.matches('.oet-mx,[data-close]')) close(); });
    backdrop.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { OET.removeFromCompare(b.getAttribute('data-rm')); OET.showCompareModal(); }));
    const clr = backdrop.querySelector('[data-clear]');
    if (clr) clr.addEventListener('click', () => { OET.clearCompare(); OET.showCompareModal(); });
    document.body.appendChild(backdrop);
    document.addEventListener('keydown', onKey);
  };
})();
