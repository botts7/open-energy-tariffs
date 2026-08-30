// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-08-24';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.7167, EUR: 1.168, GBP: 1.364, CAD: 0.7254, NZD: 0.5974, SGD: 0.7877,
  ZAR: 0.06245, BRL: 0.1934, JPY: 0.006293, INR: 0.01044, PLN: 0.2709, CHF: 1.249, MXN: 0.05911,
  SEK: 0.1056, NOK: 0.1075, DKK: 0.1563, KRW: 0.0007218, THB: 0.03062, MYR: 0.2475, PHP: 0.01621,
  IDR: 0.00005652, CNY: 0.1486, VND: 0.00003838, CLP: 0.001086, COP: 0.0003268, PEN: 0.2986, ARS: 0.0006678,
  TWD: 0.03145, HKD: 0.1276, AED: 0.2723, SAR: 0.2667, ILS: 0.3345, TRY: 0.0208, CZK: 0.04844,
  HUF: 0.00322, RON: 0.2226, EGP: 0.01966, NGN: 0.0007434, KES: 0.007728, PKR: 0.003603, UAH: 0.02238,
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
