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
    // Real bulk-import sources: AER CDR, NREL URDB, and `provider` importers
    // (ElCom, Energi Data Service, CRE, Taipower) — real data, unverified-vs-bill.
    if (ps.some((r) => ['cdr', 'urdb', 'provider'].indexOf(r.meta.source) >= 0)) return 'beta';
    // Hand-curated data is promoted experimental -> beta when an external
    // reference (Eurostat) INDEPENDENTLY corroborates it. Skip when the value was
    // itself calibrated to that reference — matching it would be circular.
    if (OET.crossCheck && !isCalibrated(cc)) { const x = OET.crossCheck(cc); if (x && x.status === 'match') return 'beta'; }
    return 'experimental';
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // A single plan is a representative ESTIMATE (not a real shoppable plan) when it
  // is hand-curated and not verified. Some are calibrated to a national average.
  OET.isEstimatePlan = function (rec) {
    const m = (rec && rec.meta) || {};
    if (m.verified || ['cdr', 'urdb', 'provider'].indexOf(m.source) >= 0) return false;
    return m.source === 'manual' || m.source === 'other' || !m.source;
  };

  // Country data confidence: 'real' (importer/verified plans), 'estimate' (only
  // hand-curated/unverified), or 'none'.
  OET.countryDataLevel = function (cc) {
    const ps = (OET.PLANS || []).filter((r) => r.meta.country === cc);
    if (!ps.length) return 'none';
    return ps.some((r) => !OET.isEstimatePlan(r)) ? 'real' : 'estimate';
  };

  function isCalibrated(cc) {
    return (OET.PLANS || []).some((r) => r.meta.country === cc
      && /calibrat|estimat|representative|proxy|typical|average|illustrative/i.test(r.meta.notes || ''));
  }

  // Prominent honesty banner for a country with no real plan data. '' when real.
  OET.dataWarningHtml = function (cc, name) {
    const lvl = OET.countryDataLevel(cc);
    if (lvl === 'real') return '';
    const nm = esc(name || cc);
    const contribute = ' <a href="https://github.com/botts7/open-energy-tariffs#contributing" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Contribute real rates →</a>';
    if (lvl === 'none') return `<div class="oet-datawarn">⚠️ No tariff data for <b>${nm}</b> yet.${contribute}</div>`;
    const tail = isCalibrated(cc)
      ? `the figure is a single <b>representative estimate</b> (calibrated to a national average), not a shoppable plan`
      : `the data is <b>hand-entered and unverified</b> (not from a bulk source, not bill-checked)`;
    return `<div class="oet-datawarn">⚠️ <b>${nm}</b> has no verified real-plan data yet — ${tail}. Treat the numbers as indicative only.${contribute}</div>`;
  };

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
