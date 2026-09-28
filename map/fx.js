// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-09-28';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.7014, EUR: 1.138, GBP: 1.323, CAD: 0.7068, NZD: 0.5657, SGD: 0.7823,
  ZAR: 0.06127, BRL: 0.1927, JPY: 0.00635, INR: 0.01042, PLN: 0.2604, CHF: 1.206, MXN: 0.05638,
  SEK: 0.1008, NOK: 0.1051, DKK: 0.1525, KRW: 0.0007374, THB: 0.02993, MYR: 0.2454, PHP: 0.01601,
  IDR: 0.0000558, CNY: 0.1488, VND: 0.00003856, CLP: 0.001039, COP: 0.0002999, PEN: 0.2947, ARS: 0.0006562,
  TWD: 0.03148, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3283, TRY: 0.02043, CZK: 0.04673,
  HUF: 0.003116, RON: 0.216, EGP: 0.01933, NGN: 0.0007534, KES: 0.007715, PKR: 0.003611, UAH: 0.0223,
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
