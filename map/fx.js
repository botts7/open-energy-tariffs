// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-10-26';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.7028, EUR: 1.121, GBP: 1.337, CAD: 0.7136, NZD: 0.5698, SGD: 0.7821,
  ZAR: 0.06025, BRL: 0.2002, JPY: 0.006375, INR: 0.01051, PLN: 0.2547, CHF: 1.213, MXN: 0.05341,
  SEK: 0.1007, NOK: 0.1073, DKK: 0.1498, KRW: 0.0007553, THB: 0.02962, MYR: 0.2448, PHP: 0.0157,
  IDR: 0.00005528, CNY: 0.1498, VND: 0.00003872, CLP: 0.001011, COP: 0.0003154, PEN: 0.2906, ARS: 0.0006543,
  TWD: 0.03068, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3211, TRY: 0.02008, CZK: 0.04607,
  HUF: 0.003058, RON: 0.2093, EGP: 0.01796, NGN: 0.0007495, KES: 0.0077, PKR: 0.003611, UAH: 0.02209,
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
