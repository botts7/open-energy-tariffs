// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-11-23';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.6636, EUR: 1.098, GBP: 1.31, CAD: 0.6977, NZD: 0.5474, SGD: 0.7757,
  ZAR: 0.0571, BRL: 0.1682, JPY: 0.006301, INR: 0.01078, PLN: 0.246, CHF: 1.19, MXN: 0.05232,
  SEK: 0.09784, NOK: 0.1026, DKK: 0.1469, KRW: 0.0007443, THB: 0.02946, MYR: 0.2432, PHP: 0.01565,
  IDR: 0.00005472, CNY: 0.1497, VND: 0.00003879, CLP: 0.0009837, COP: 0.0002909, PEN: 0.2905, ARS: 0.0006345,
  TWD: 0.03033, HKD: 0.1276, AED: 0.2723, SAR: 0.2667, ILS: 0.2983, TRY: 0.01977, CZK: 0.04488,
  HUF: 0.002941, RON: 0.2053, EGP: 0.01846, NGN: 0.0007312, KES: 0.007697, PKR: 0.003616, UAH: 0.02225,
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
