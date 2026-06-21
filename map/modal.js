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
      + '.oet-modal{background:#fff;border-radius:10px;max-width:540px;width:100%;max-height:86vh;overflow:auto;box-shadow:0 12px 40px rgba(0,0,0,.35);font-size:13px;color:#1a2233}'
      + '.oet-mhead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:14px 16px;border-bottom:1px solid #e2e8f0;position:sticky;top:0;background:#fff}'
      + '.oet-mhead h2{margin:0;font-size:16px}.oet-mhead .sub{font-size:12px;color:#64748b;margin-top:2px}'
      + '.oet-mx{border:none;background:#f1f5f9;border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:16px;flex:none}'
      + '.oet-mbody{padding:14px 16px}'
      + '.oet-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0 0 12px}'
      + '.oet-kv dt{color:#64748b}.oet-kv dd{margin:0;font-weight:600}'
      + '.oet-sec{margin:14px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:10px}'
      + '.oet-tbl{width:100%;border-collapse:collapse;font-size:12.5px}.oet-tbl th,.oet-tbl td{text-align:left;padding:4px 6px;border-bottom:1px solid #f1f5f9}.oet-tbl th{color:#64748b;font-weight:600}'
      + '.oet-sw{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:-1px;border:1px solid rgba(0,0,0,.2)}'
      + '.oet-note{font-size:12px;color:#475569;background:#f8fafc;border:1px solid #eef2f7;border-radius:6px;padding:8px 10px;line-height:1.4}'
      + '.oet-mfoot{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #e2e8f0;position:sticky;bottom:0;background:#fff}'
      + '.oet-btn{padding:7px 14px;border-radius:6px;border:1px solid #cbd5e1;background:#f8fafc;cursor:pointer;font-size:13px}'
      + '.oet-btn.primary{background:#2563eb;border-color:#2563eb;color:#fff}';
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
    body += `<div class="oet-sec">Import rates</div>${rateStructHtml(t.import, cur) || '—'}`;
    if (t.export) body += `<div class="oet-sec">Export (feed-in)</div>${rateStructHtml(t.export, cur)}`;
    if (Array.isArray(t.controlledLoad) && t.controlledLoad.length) {
      body += '<div class="oet-sec">Controlled load</div><table class="oet-tbl"><tbody>'
        + t.controlledLoad.map((c) => `<tr><td>${esc(c.name || c.id)}</td><td>${num(c.rate) != null ? c.rate + ' ' + esc(cur) : '—'}</td></tr>`).join('')
        + '</tbody></table>';
    }
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
      + `<div class="oet-mfoot">${rec.located ? '<button class="oet-btn" data-zoom>Show on map</button>' : ''}<button class="oet-btn primary" data-close>Close</button></div>`
      + `</div>`;
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.matches('.oet-mx,[data-close]')) close(); });
    const zoom = backdrop.querySelector('[data-zoom]');
    if (zoom) zoom.addEventListener('click', () => { close(); if (OET.focusPlan) OET.focusPlan(rec.id); });
    document.body.appendChild(backdrop);
    document.addEventListener('keydown', onKey);
  };
})();
