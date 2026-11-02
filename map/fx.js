// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-11-02';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.7029, EUR: 1.116, GBP: 1.339, CAD: 0.7159, NZD: 0.5625, SGD: 0.7824,
  ZAR: 0.0599, BRL: 0.1839, JPY: 0.006348, INR: 0.01052, PLN: 0.2531, CHF: 1.213, MXN: 0.05318,
  SEK: 0.1018, NOK: 0.1085, DKK: 0.1494, KRW: 0.0007503, THB: 0.02962, MYR: 0.2465, PHP: 0.0157,
  IDR: 0.00005511, CNY: 0.1501, VND: 0.00003878, CLP: 0.001009, COP: 0.0003133, PEN: 0.2884, ARS: 0.0006505,
  TWD: 0.03064, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3184, TRY: 0.02002, CZK: 0.04582,
  HUF: 0.003052, RON: 0.2091, EGP: 0.01787, NGN: 0.0007416, KES: 0.007696, PKR: 0.003614, UAH: 0.02201,
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
