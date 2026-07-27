// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-07-27';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.6991, EUR: 1.139, GBP: 1.334, CAD: 0.7099, NZD: 0.5795, SGD: 0.7752,
  ZAR: 0.05966, BRL: 0.1966, JPY: 0.00611, INR: 0.01035, PLN: 0.2638, CHF: 1.224, MXN: 0.05731,
  SEK: 0.1031, NOK: 0.1044, DKK: 0.1527, KRW: 0.0006851, THB: 0.02971, MYR: 0.2444, PHP: 0.01618,
  IDR: 0.00005571, CNY: 0.1475, VND: 0.00003809, CLP: 0.001056, COP: 0.0003118, PEN: 0.2937, ARS: 0.0006692,
  TWD: 0.03091, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3277, TRY: 0.02112, CZK: 0.04715,
  HUF: 0.003154, RON: 0.2174, EGP: 0.01949, NGN: 0.0007317, KES: 0.007719, PKR: 0.003598, UAH: 0.02229,
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
