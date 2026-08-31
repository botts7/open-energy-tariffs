// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-08-31';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.7164, EUR: 1.16, GBP: 1.355, CAD: 0.7199, NZD: 0.5919, SGD: 0.785,
  ZAR: 0.06199, BRL: 0.1931, JPY: 0.006248, INR: 0.01046, PLN: 0.2672, CHF: 1.238, MXN: 0.05872,
  SEK: 0.1042, NOK: 0.1068, DKK: 0.1557, KRW: 0.0007264, THB: 0.0302, MYR: 0.2484, PHP: 0.01603,
  IDR: 0.00005639, CNY: 0.1485, VND: 0.00003845, CLP: 0.001078, COP: 0.0003154, PEN: 0.2984, ARS: 0.0006609,
  TWD: 0.0316, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3342, TRY: 0.02072, CZK: 0.04807,
  HUF: 0.003177, RON: 0.2214, EGP: 0.01986, NGN: 0.0007469, KES: 0.007728, PKR: 0.003599, UAH: 0.02245,
};

// rate (local) -> USD-equivalent number (or the rate unchanged if currency unknown).
OET.toUsd = function (v, cur) {
  if (typeof v !== 'number') return v;
  const fx = OET.FX[cur];
  return fx != null ? v * fx : v;
};

// Colour for a local rate, normalised to USD so buckets compare globally.
OET.rateColorFor = function (rate, cur) {
  return OET.rateColor(OET.toUsd(rate, cur));
};
