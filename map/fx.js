// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-06-29';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.6897, EUR: 1.139, GBP: 1.32, CAD: 0.7048, NZD: 0.5642, SGD: 0.7727,
  ZAR: 0.06074, BRL: 0.1933, JPY: 0.006182, INR: 0.01058, PLN: 0.2656, CHF: 1.235, MXN: 0.05713,
  SEK: 0.1028, NOK: 0.1007, DKK: 0.1526, KRW: 0.0006507, THB: 0.02996, MYR: 0.2446, PHP: 0.01631,
  IDR: 0.00005591, CNY: 0.147, VND: 0.00003813, CLP: 0.001086, COP: 0.00029, PEN: 0.2929, ARS: 0.0006781,
  TWD: 0.03137, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3334, TRY: 0.02146, CZK: 0.04696,
  HUF: 0.003218, RON: 0.2175, EGP: 0.02021, NGN: 0.0007256, KES: 0.007721, PKR: 0.003597, UAH: 0.02227,
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
