// Reference household electricity prices for cross-validating our community data
// and overlaying a baseline in the ranking. Source: Eurostat 'Electricity prices
// for household consumers' (nrg_pc_204), CC BY 4.0. Band DC (2 500-4 999 kWh/yr,
// typical household), ALL taxes & levies included, EUR per kWh, period 2025-S2.
// Attributed in the ranking panel + LICENSING.md. Regenerate: node scripts/refresh-baseline.mjs
window.OET = window.OET || {};
OET.BASELINE_AS_OF = '2025-S2';
OET.BASELINE_SOURCE = 'Eurostat nrg_pc_204 (CC BY 4.0)';
OET.BASELINE = {"AL":{"eur":0.1175},"AT":{"eur":0.3272},"BA":{"eur":0.0966},"BE":{"eur":0.3499},"BG":{"eur":0.1355},"CY":{"eur":0.2774},"CZ":{"eur":0.3217},"DE":{"eur":0.3869},"DK":{"eur":0.3312},"EE":{"eur":0.2303},"ES":{"eur":0.2669},"FI":{"eur":0.2254},"FR":{"eur":0.2561},"GE":{"eur":0.0731},"GR":{"eur":0.2378},"HR":{"eur":0.1658},"HU":{"eur":0.1082},"IE":{"eur":0.4042},"IT":{"eur":0.2966},"LI":{"eur":0.3062},"LT":{"eur":0.1955},"LU":{"eur":0.2665},"LV":{"eur":0.2452},"MD":{"eur":0.1967},"ME":{"eur":0.0998},"MK":{"eur":0.1161},"MT":{"eur":0.1282},"NL":{"eur":0.2558},"NO":{"eur":0.1922},"PL":{"eur":0.2709},"PT":{"eur":0.2434},"RO":{"eur":0.2893},"RS":{"eur":0.119},"SE":{"eur":0.2711},"SI":{"eur":0.2121},"SK":{"eur":0.1853},"TR":{"eur":0.0636},"XK":{"eur":0.0877}};

// Reference price for a country as USD/kWh (nominal), via the dated FX snapshot.
OET.baselineUsd = function (cc) {
  const b = OET.BASELINE && OET.BASELINE[cc];
  if (!b) return null;
  const eurUsd = (OET.FX && OET.FX.EUR) || 1.1;
  return b.eur * eurUsd;
};

// Cross-check our community median against the reference. ±25% = 'match' (data is
// externally corroborated -> Beta-eligible); outside = 'diverge'; no ref = null.
OET.crossCheck = function (cc) {
  const ref = OET.baselineUsd(cc);
  if (ref == null) return null;
  const ps = (OET.PLANS || []).filter((r) => r.meta.country === cc);
  const us = ps.map((r) => OET.toUsd(r.rate, r.meta.currency)).filter((v) => v > 0).sort((a, b) => a - b);
  if (!us.length) return { ref, ours: null, status: 'no-data' };
  const med = us[us.length >> 1];
  const ratio = med / ref;
  return { ref, ours: med, ratio, status: ratio >= 0.75 && ratio <= 1.34 ? 'match' : 'diverge' };
};
