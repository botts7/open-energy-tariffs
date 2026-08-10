// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-08-10';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.706, EUR: 1.155, GBP: 1.349, CAD: 0.7166, NZD: 0.5889, SGD: 0.7818,
  ZAR: 0.06186, BRL: 0.1965, JPY: 0.006334, INR: 0.0105, PLN: 0.2687, CHF: 1.237, MXN: 0.05834,
  SEK: 0.1055, NOK: 0.1053, DKK: 0.1548, KRW: 0.0007094, THB: 0.03028, MYR: 0.2444, PHP: 0.01644,
  IDR: 0.00005598, CNY: 0.1481, VND: 0.00003827, CLP: 0.001094, COP: 0.0003166, PEN: 0.2955, ARS: 0.0006674,
  TWD: 0.03108, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3335, TRY: 0.02096, CZK: 0.04763,
  HUF: 0.003176, RON: 0.2196, EGP: 0.02007, NGN: 0.0007332, KES: 0.00773, PKR: 0.003598, UAH: 0.02234,
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
