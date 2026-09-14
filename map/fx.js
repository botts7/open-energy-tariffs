// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-09-14';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.7155, EUR: 1.16, GBP: 1.352, CAD: 0.7213, NZD: 0.5811, SGD: 0.7892,
  ZAR: 0.06188, BRL: 0.1953, JPY: 0.00651, INR: 0.01046, PLN: 0.2681, CHF: 1.225, MXN: 0.05891,
  SEK: 0.1031, NOK: 0.1076, DKK: 0.1551, KRW: 0.0007448, THB: 0.03023, MYR: 0.2457, PHP: 0.01595,
  IDR: 0.00005674, CNY: 0.1489, VND: 0.00003865, CLP: 0.001063, COP: 0.0003241, PEN: 0.298, ARS: 0.0006623,
  TWD: 0.03169, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3296, TRY: 0.02057, CZK: 0.04786,
  HUF: 0.00319, RON: 0.2209, EGP: 0.01946, NGN: 0.0007535, KES: 0.007726, PKR: 0.003602, UAH: 0.02244,
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
