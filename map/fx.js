// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-06-21';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.7014, EUR: 1.147, GBP: 1.323, CAD: 0.7068, NZD: 0.5741, SGD: 0.7748,
  ZAR: 0.06077, BRL: 0.194, JPY: 0.006203, INR: 0.01059, PLN: 0.2694, CHF: 1.24, MXN: 0.05769,
  SEK: 0.1044, NOK: 0.1032, DKK: 0.1537, KRW: 0.0006532, THB: 0.03041, MYR: 0.2421, PHP: 0.01646,
  IDR: 0.00005621, CNY: 0.1473, VND: 0.00003785, CLP: 0.001113, COP: 0.0002876, PEN: 0.2926, ARS: 0.0006848,
  TWD: 0.0316, HKD: 0.1276, AED: 0.2723, SAR: 0.2667, ILS: 0.3379, TRY: 0.02153, CZK: 0.04738,
  HUF: 0.003258, RON: 0.2189, EGP: 0.02003, NGN: 0.0007321, KES: 0.007726, PKR: 0.003568, UAH: 0.02227,
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
