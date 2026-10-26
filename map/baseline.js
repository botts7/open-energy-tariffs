// Reference household electricity prices for cross-validating our community data
// and overlaying a baseline in the ranking. Source: Eurostat 'Electricity prices
// for household consumers' (nrg_pc_204), CC BY 4.0. Band DC (2 500-4 999 kWh/yr,
// typical household), ALL taxes & levies included, EUR per kWh, period 2026-S1.
// Attributed in the ranking panel + LICENSING.md. Regenerate: node scripts/refresh-baseline.mjs
// DATA ONLY — the cross-check logic lives in baseline-logic.js.
window.OET = window.OET || {};
OET.BASELINE_AS_OF = '2026-S1';
OET.BASELINE_SOURCE = 'Eurostat nrg_pc_204 (CC BY 4.0)';
OET.BASELINE = {"AL":{"eur":0.119},"AT":{"eur":0.326},"BA":{"eur":0.0995},"BE":{"eur":0.3575},"BG":{"eur":0.1341},"CY":{"eur":0.2688},"CZ":{"eur":0.2884},"DE":{"eur":0.3618},"DK":{"eur":0.2375},"EE":{"eur":0.2118},"ES":{"eur":0.2509},"FI":{"eur":0.2694},"FR":{"eur":0.2485},"GE":{"eur":0.0731},"GR":{"eur":0.2401},"HR":{"eur":0.1816},"HU":{"eur":0.1139},"IE":{"eur":0.3871},"IS":{"eur":0.2076},"IT":{"eur":0.3142},"LI":{"eur":0.2988},"LT":{"eur":0.2162},"LU":{"eur":0.2023},"LV":{"eur":0.2415},"MD":{"eur":0.1872},"ME":{"eur":0.1039},"MK":{"eur":0.1168},"MT":{"eur":0.1268},"NL":{"eur":0.244},"NO":{"eur":0.1993},"PL":{"eur":0.2999},"PT":{"eur":0.2367},"RO":{"eur":0.2836},"RS":{"eur":0.1197},"SE":{"eur":0.3062},"SI":{"eur":0.2118},"SK":{"eur":0.1985},"TR":{"eur":0.0657},"XK":{"eur":0.0869}};
