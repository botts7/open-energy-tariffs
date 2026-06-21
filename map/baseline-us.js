// Reference residential electricity prices for cross-validating our US data.
// DERIVED from U.S. EIA retail-sales, sector RES (US public domain), $/kWh.
// PLACEHOLDER — populated by `EIA_API_KEY=... node scripts/refresh-baseline-us.mjs`
// once an EIA key is set. Until then US has no reference (stays Beta via URDB source).
window.OET = window.OET || {};
OET.BASELINE_US_SOURCE = 'U.S. EIA (public domain)';
OET.BASELINE_US = { asOf: null, national: null, states: {} };
