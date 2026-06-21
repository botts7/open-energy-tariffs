// Maturity / honesty flags. Single source of truth for how mature a feature or a
// country's data is, so the UI never over-claims. Three tiers:
//   experimental — illustrative, not cross-checked, may be wrong / may change
//   beta         — real source data, limited coverage, not bill-verified
//   verified     — checked against an authoritative source
// Promotion is earned (see docs/TEST_PLAN.md / governance): experimental→beta
// needs a cross-source sanity check; beta→verified needs bill/community confirmation.
window.OET = window.OET || {};

(function () {
  OET.TIER_META = {
    experimental: { label: 'Experimental', fg: '#b45309', bg: 'rgba(234,179,8,.16)', bd: 'rgba(234,179,8,.5)', title: 'Illustrative — not cross-checked against external sources. May be inaccurate and may change.' },
    beta: { label: 'Beta', fg: '#1d4ed8', bg: 'rgba(37,99,235,.12)', bd: 'rgba(37,99,235,.4)', title: 'Real source data, limited coverage, not yet verified against bills. Feedback welcome.' },
    verified: { label: 'Verified', fg: '#15803d', bg: 'rgba(22,163,74,.14)', bd: 'rgba(22,163,74,.45)', title: 'Checked against an authoritative source.' },
  };

  // Feature → tier. Used to badge features in the UI.
  OET.FEATURE_MATURITY = {
    app: 'beta', map: 'beta', compare: 'beta', geocode: 'beta', csv: 'beta',
    pdf: 'experimental', ranking: 'experimental',
  };

  // A country's data maturity, derived from the loaded plans:
  //   verified  — at least one plan verified against a source
  //   beta      — real bulk-import data (AER CDR / URDB), unverified
  //   experimental — only hand-curated illustrative plans (or none)
  OET.countryMaturity = function (cc) {
    const ps = (OET.PLANS || []).filter((r) => r.meta.country === cc);
    if (!ps.length) return 'experimental';
    if (ps.some((r) => r.meta.verified)) return 'verified';
    if (ps.some((r) => r.meta.source === 'cdr' || r.meta.source === 'urdb')) return 'beta';
    // Hand-curated data is promoted experimental -> beta when an external
    // reference (Eurostat) corroborates it within tolerance (the promotion gate).
    if (OET.crossCheck) { const x = OET.crossCheck(cc); if (x && x.status === 'match') return 'beta'; }
    return 'experimental';
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // HTML-string pill (for innerHTML contexts; `tier` is from the trusted fixed set).
  OET.maturityPill = function (tier) {
    const t = OET.TIER_META[tier];
    if (!t) return '';
    return `<span class="oet-mat" title="${esc(t.title)}" style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.02em;color:${t.fg};background:${t.bg};border:1px solid ${t.bd};border-radius:5px;padding:0 5px;line-height:1.55;vertical-align:middle;white-space:nowrap">${esc(t.label)}</span>`;
  };

  // DOM-element pill (for safe-DOM contexts).
  OET.maturityEl = function (tier) {
    const w = document.createElement('span');
    w.innerHTML = OET.maturityPill(tier);
    return w.firstChild;
  };
})();
