// Data-freshness helpers: relative age + "static vs live" conversion badge, so
// people can see how current a number is. Runs in the browser (new Date() is
// fine here). All our conversions (FX, income, baselines) are DATED STATIC
// snapshots — none are live — so the badge says "Static" with the snapshot date.
window.OET = window.OET || {};

(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // Parse our date forms: YYYY-MM-DD, YYYY-MM, YYYY-S1/S2 (Eurostat semester), YYYY.
  function toDate(s) {
    if (!s) return null; s = String(s); let m;
    if ((m = s.match(/^(\d{4})-S([12])$/))) return new Date(+m[1], m[2] === '1' ? 5 : 11, 1);
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{4})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, 1);
    if ((m = s.match(/^(\d{4})$/))) return new Date(+m[1], 11, 1);
    const d = new Date(s); return isNaN(d.getTime()) ? null : d;
  }

  OET.ageMonths = function (s) {
    const d = toDate(s); if (!d) return null;
    const now = new Date();
    return Math.max(0, (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth()));
  };

  OET.relAge = function (s) {
    const m = OET.ageMonths(s); if (m == null) return '';
    if (m === 0) return 'this month';
    if (m === 1) return '1 month ago';
    if (m < 12) return m + ' months ago';
    const y = Math.floor(m / 12), rem = m % 12;
    return rem ? `${y}y ${rem}m ago` : `${y} year${y > 1 ? 's' : ''} ago`;
  };

  // Small relative-age pill; amber + ⚠ when older than `staleMonths` (default 18).
  OET.freshPill = function (s, opts) {
    opts = opts || {};
    if (!s) return '';
    const m = OET.ageMonths(s), stale = m != null && m >= (opts.staleMonths || 18);
    const tip = `${opts.prefix || 'Updated'} ${esc(s)} · ${OET.relAge(s)}${stale ? ' — may be out of date, verify' : ''}`;
    const fg = stale ? '#b45309' : 'var(--muted,#64748b)', bg = stale ? 'rgba(234,179,8,.16)' : 'transparent';
    return `<span class="oet-fresh" title="${tip}" style="font-size:10px;color:${fg};background:${bg};border-radius:4px;padding:0 4px;white-space:nowrap">${OET.relAge(s)}${stale ? ' ⚠' : ''}</span>`;
  };

  // --- Per-source freshness + the auto-refresh schedule (mirrors the cron in
  // .github/workflows/scheduled-*.yml). staleDays = how long past the cycle before a
  // source is flagged (a proxy for "an import failed / paused"). ---
  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function nextWeekly(dow) { const d = startOfToday(); const add = ((dow - d.getDay()) + 7) % 7 || 7; d.setDate(d.getDate() + add); return d; }
  function nextMonthly(day) { const d = startOfToday(); if (d.getDate() < day) { d.setDate(day); return d; } d.setMonth(d.getMonth() + 1, day); return d; }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function ageDays(s) { const d = toDate(s); if (!d) return null; return Math.floor((startOfToday() - d) / 86400000); }
  function inDays(d) { const n = Math.round((d - startOfToday()) / 86400000); return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; }

  const SOURCE_META = {
    cdr: { label: 'AU retail plans (AER CDR)', cadence: 'weekly', staleDays: 12, next: () => nextWeekly(1) },
    provider: { label: 'National stats offices', cadence: 'monthly', staleDays: 40, next: () => nextMonthly(1) },
    urdb: { label: 'US utilities (OpenEI URDB)', cadence: 'monthly', staleDays: 40, next: () => nextMonthly(5) },
    manual: { label: 'Hand-curated estimates', cadence: 'none' },
    other: { label: 'Other public data', cadence: 'none' },
  };

  OET.freshnessSummary = function () {
    const fr = OET._freshness || { bySource: {}, latest: '' };
    const rows = [];
    let anyStale = false;
    for (const src of Object.keys(fr.bySource || {})) {
      const info = fr.bySource[src];
      const meta = SOURCE_META[src] || { label: src, cadence: 'none' };
      // Judge staleness by last-CHECK (when the importer last refreshed) if we have
      // it, else fall back to last-CHANGE (newest data) — so an incrementally
      // refreshed source with no changes isn't wrongly flagged stale.
      const checked = (fr.checked || {})[src] || '';
      const basis = checked || info.latest;
      const age = ageDays(basis), auto = meta.cadence !== 'none';
      const stale = auto && meta.staleDays != null && age != null && age > meta.staleDays;
      if (stale) anyStale = true;
      rows.push({
        src, label: meta.label, count: info.count || 0, latest: info.latest || '',
        rel: OET.relAge(info.latest), checked, checkedRel: checked ? OET.relAge(checked) : '',
        cadence: meta.cadence, auto, stale,
        next: auto && meta.next ? ymd(meta.next()) : null,
        nextRel: auto && meta.next ? inDays(meta.next()) : null,
      });
    }
    rows.sort((a, b) => b.count - a.count);
    return { latest: fr.latest, builtAt: OET._builtAt, rows, anyStale };
  };

  function injectFrCss() {
    if (document.getElementById('oet-fresh-css')) return;
    const s = document.createElement('style'); s.id = 'oet-fresh-css';
    s.textContent =
      '.oet-frback{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:10001;padding:20px}'
      + '.oet-frp{background:var(--panel,#fff);color:var(--text,#1a2233);border-radius:12px;max-width:580px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 12px 44px rgba(0,0,0,.45);font-size:13px}'
      + '.oet-frh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--border,#e2e8f0);position:sticky;top:0;background:var(--panel,#fff)}'
      + '.oet-frh h2{margin:0;font-size:16px;display:flex;align-items:center;gap:8px}'
      + '.oet-frx{border:none;background:var(--hover,#f1f5f9);color:var(--text,#1a2233);border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:17px;flex:none}'
      + '.oet-frb{padding:12px 18px 16px}'
      + '.oet-frt{width:100%;border-collapse:collapse;font-size:12.5px}'
      + '.oet-frt th,.oet-frt td{text-align:left;padding:7px 6px;border-bottom:1px solid var(--border,#eef2f7);vertical-align:top}'
      + '.oet-frt th{color:var(--muted,#64748b);font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em}'
      + '.oet-fr-ok{color:#16a34a;font-weight:700}.oet-fr-stale{color:#b45309;font-weight:700}.oet-fr-na{color:var(--muted,#94a3b8)}'
      + '.oet-frnote{font-size:11.5px;color:var(--muted,#64748b);margin-top:12px;line-height:1.5}';
    document.head.appendChild(s);
  }

  let frback = null;
  function closeFr() { if (frback) { frback.remove(); frback = null; document.removeEventListener('keydown', onFrKey); } }
  function onFrKey(e) { if (e.key === 'Escape') closeFr(); }

  OET.showFreshness = function () {
    injectFrCss(); closeFr();
    const sum = OET.freshnessSummary();
    const row = (r) => '<tr>'
      + '<td><b>' + esc(r.label) + '</b><br><span class="oet-fr-na">' + r.count.toLocaleString() + ' plan(s)</span></td>'
      + '<td>' + esc(r.latest || '—') + '<br><span class="oet-fr-na">' + esc(r.rel) + (r.checked ? ' · checked ' + esc(r.checkedRel) : '') + '</span></td>'
      + '<td>' + (r.auto ? esc(r.cadence) + '<br><span class="oet-fr-na">next ' + esc(r.nextRel || '') + '</span>' : '<span class="oet-fr-na">curated · manual</span>') + '</td>'
      + '<td>' + (!r.auto ? '<span class="oet-fr-na">—</span>' : r.stale ? '<span class="oet-fr-stale">⚠ stale</span>' : '<span class="oet-fr-ok">✓ fresh</span>') + '</td>'
      + '</tr>';
    frback = document.createElement('div'); frback.className = 'oet-frback';
    frback.addEventListener('click', (e) => { if (e.target === frback) closeFr(); });
    frback.innerHTML =
      '<div class="oet-frp" role="dialog" aria-label="Data freshness">'
      + '<div class="oet-frh"><h2>🕔 Data freshness</h2><button class="oet-frx" aria-label="Close">×</button></div>'
      + '<div class="oet-frb">'
      + '<p style="margin:0 0 10px">Data current through <b>' + esc(sum.latest || '—') + '</b>' + (sum.builtAt ? ' · site built ' + esc(sum.builtAt) : '') + '.</p>'
      + (sum.anyStale ? '<div style="background:rgba(234,179,8,.14);border:1px solid rgba(234,179,8,.45);border-radius:8px;padding:8px 10px;margin-bottom:10px">⚠ <b>One or more sources are stale</b> — their newest data is older than the refresh cycle (likely a failed or paused auto-import).</div>' : '')
      + '<table class="oet-frt"><thead><tr><th>Source</th><th>Last updated</th><th>Auto-refresh</th><th>Status</th></tr></thead><tbody>'
      + sum.rows.map(row).join('') + '</tbody></table>'
      + '<div class="oet-frnote">The site auto-refreshes from public APIs via scheduled GitHub Actions, each opening a reviewed data PR. <b>⚠ stale</b> means a source hasn’t refreshed within its cycle — usually an API that didn’t respond. Hand-curated estimates aren’t auto-updated.</div>'
      + '</div></div>';
    document.body.appendChild(frback);
    frback.querySelector('.oet-frx').addEventListener('click', closeFr);
    document.addEventListener('keydown', onFrKey);
  };

  // Reflect overall freshness on the header button (amber + ⚠ when anything stale).
  OET.updateFreshButton = function () {
    const b = document.getElementById('freshToggle'); if (!b) return;
    const sum = OET.freshnessSummary();
    b.title = 'Data through ' + (sum.latest || '—') + (sum.anyStale ? ' · ⚠ some data is stale' : ' · sources current') + ' — click for detail';
    if (sum.anyStale) { b.style.background = 'rgba(234,179,8,.22)'; b.style.borderColor = '#eab308'; b.textContent = '🕔⚠'; }
    else { b.style.background = ''; b.style.borderColor = ''; b.textContent = '🕔'; }
  };

  // "Static" conversion badge — FX is a dated snapshot, not live.
  OET.conversionBadge = function () {
    const as = OET.FX_AS_OF || 'n/a';
    const tip = `USD conversion uses a STATIC FX snapshot from ${esc(as)} (${OET.relAge(as)}), not live rates. PPP is the fairer cross-country basis.`;
    return `<span class="oet-fresh" title="${tip}" style="font-size:10px;font-weight:700;color:#1d4ed8;background:rgba(37,99,235,.12);border:1px solid rgba(37,99,235,.4);border-radius:5px;padding:0 5px;white-space:nowrap">💱 Static FX · ${esc(as)}</span>`;
  };
})();
