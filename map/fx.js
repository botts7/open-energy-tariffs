// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-07-13';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.694, EUR: 1.141, GBP: 1.339, CAD: 0.706, NZD: 0.5758, SGD: 0.7737,
  ZAR: 0.06115, BRL: 0.1956, JPY: 0.006177, INR: 0.01047, PLN: 0.263, CHF: 1.236, MXN: 0.0571,
  SEK: 0.1033, NOK: 0.1023, DKK: 0.1529, KRW: 0.0006661, THB: 0.02999, MYR: 0.2457, PHP: 0.01625,
  IDR: 0.00005534, CNY: 0.1475, VND: 0.00003818, CLP: 0.00108, COP: 0.0003052, PEN: 0.2946, ARS: 0.0006707,
  TWD: 0.03118, HKD: 0.1276, AED: 0.2723, SAR: 0.2667, ILS: 0.3321, TRY: 0.02126, CZK: 0.04703,
  HUF: 0.003198, RON: 0.2184, EGP: 0.02008, NGN: 0.0007268, KES: 0.007741, PKR: 0.003597, UAH: 0.02247,
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
