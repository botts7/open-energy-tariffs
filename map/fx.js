// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-08-03';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.7041, EUR: 1.154, GBP: 1.348, CAD: 0.7136, NZD: 0.5892, SGD: 0.78,
  ZAR: 0.06065, BRL: 0.1972, JPY: 0.006328, INR: 0.01047, PLN: 0.2677, CHF: 1.239, MXN: 0.05777,
  SEK: 0.1051, NOK: 0.1054, DKK: 0.1546, KRW: 0.0006942, THB: 0.02994, MYR: 0.2447, PHP: 0.01633,
  IDR: 0.00005532, CNY: 0.1479, VND: 0.0000382, CLP: 0.001077, COP: 0.0003182, PEN: 0.2947, ARS: 0.0006718,
  TWD: 0.03098, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3277, TRY: 0.02105, CZK: 0.04765,
  HUF: 0.003171, RON: 0.2193, EGP: 0.01967, NGN: 0.0007345, KES: 0.007721, PKR: 0.0036, UAH: 0.02238,
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
