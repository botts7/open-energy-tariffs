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

  // "Static" conversion badge — FX is a dated snapshot, not live.
  OET.conversionBadge = function () {
    const as = OET.FX_AS_OF || 'n/a';
    const tip = `USD conversion uses a STATIC FX snapshot from ${esc(as)} (${OET.relAge(as)}), not live rates. PPP is the fairer cross-country basis.`;
    return `<span class="oet-fresh" title="${tip}" style="font-size:10px;font-weight:700;color:#1d4ed8;background:rgba(37,99,235,.12);border:1px solid rgba(37,99,235,.4);border-radius:5px;padding:0 5px;white-space:nowrap">💱 Static FX · ${esc(as)}</span>`;
  };
})();
