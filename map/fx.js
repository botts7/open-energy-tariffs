// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-06-24';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.6924, EUR: 1.139, GBP: 1.32, CAD: 0.7044, NZD: 0.567, SGD: 0.7715,
  ZAR: 0.06053, BRL: 0.1933, JPY: 0.00619, INR: 0.01055, PLN: 0.266, CHF: 1.235, MXN: 0.05703,
  SEK: 0.1028, NOK: 0.1022, DKK: 0.1526, KRW: 0.0006517, THB: 0.03011, MYR: 0.2415, PHP: 0.01632,
  IDR: 0.00005595, CNY: 0.1471, VND: 0.00003809, CLP: 0.001103, COP: 0.0002913, PEN: 0.2944, ARS: 0.0006803,
  TWD: 0.03154, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3339, TRY: 0.02152, CZK: 0.04703,
  HUF: 0.003207, RON: 0.2172, EGP: 0.02011, NGN: 0.0007303, KES: 0.007722, PKR: 0.003591, UAH: 0.02225,
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
