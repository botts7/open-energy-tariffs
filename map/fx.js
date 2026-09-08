// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-09-07';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.7206, EUR: 1.161, GBP: 1.352, CAD: 0.723, NZD: 0.5882, SGD: 0.7892,
  ZAR: 0.06267, BRL: 0.1952, JPY: 0.006403, INR: 0.01058, PLN: 0.2693, CHF: 1.235, MXN: 0.05921,
  SEK: 0.1045, NOK: 0.1075, DKK: 0.1554, KRW: 0.0007426, THB: 0.03038, MYR: 0.2473, PHP: 0.01594,
  IDR: 0.00005664, CNY: 0.1488, VND: 0.00003846, CLP: 0.001072, COP: 0.0003184, PEN: 0.298, ARS: 0.0006634,
  TWD: 0.03161, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.332, TRY: 0.02064, CZK: 0.04801,
  HUF: 0.003205, RON: 0.2212, EGP: 0.01965, NGN: 0.0007564, KES: 0.007729, PKR: 0.003602, UAH: 0.02244,
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
