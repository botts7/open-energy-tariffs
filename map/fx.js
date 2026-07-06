// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-07-06';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.6937, EUR: 1.144, GBP: 1.335, CAD: 0.7041, NZD: 0.5704, SGD: 0.7742,
  ZAR: 0.06163, BRL: 0.1931, JPY: 0.006196, INR: 0.01049, PLN: 0.2666, CHF: 1.244, MXN: 0.05722,
  SEK: 0.1036, NOK: 0.1017, DKK: 0.1533, KRW: 0.0006532, THB: 0.03015, MYR: 0.2456, PHP: 0.01626,
  IDR: 0.0000556, CNY: 0.1474, VND: 0.00003816, CLP: 0.001083, COP: 0.000298, PEN: 0.2939, ARS: 0.0006718,
  TWD: 0.03128, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3336, TRY: 0.02136, CZK: 0.04729,
  HUF: 0.003239, RON: 0.2187, EGP: 0.02039, NGN: 0.000731, KES: 0.00774, PKR: 0.0036, UAH: 0.02244,
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
