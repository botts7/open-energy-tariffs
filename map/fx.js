// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-11-16';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.6777, EUR: 1.103, GBP: 1.322, CAD: 0.701, NZD: 0.5527, SGD: 0.7766,
  ZAR: 0.05905, BRL: 0.1766, JPY: 0.006258, INR: 0.01059, PLN: 0.2503, CHF: 1.192, MXN: 0.05392,
  SEK: 0.0993, NOK: 0.1045, DKK: 0.1478, KRW: 0.0007486, THB: 0.0295, MYR: 0.2446, PHP: 0.01565,
  IDR: 0.00005488, CNY: 0.1497, VND: 0.00003889, CLP: 0.001005, COP: 0.0003015, PEN: 0.2933, ARS: 0.0006464,
  TWD: 0.03038, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3114, TRY: 0.01985, CZK: 0.04518,
  HUF: 0.003022, RON: 0.2066, EGP: 0.01861, NGN: 0.0007396, KES: 0.007691, PKR: 0.003611, UAH: 0.02201,
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
