// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-08-17';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.7084, EUR: 1.157, GBP: 1.354, CAD: 0.7208, NZD: 0.5891, SGD: 0.7818,
  ZAR: 0.06177, BRL: 0.1929, JPY: 0.006281, INR: 0.01046, PLN: 0.2686, CHF: 1.231, MXN: 0.05876,
  SEK: 0.1051, NOK: 0.1059, DKK: 0.1547, KRW: 0.0007067, THB: 0.03018, MYR: 0.2447, PHP: 0.01626,
  IDR: 0.00005607, CNY: 0.1482, VND: 0.00003837, CLP: 0.001094, COP: 0.0003201, PEN: 0.2967, ARS: 0.0006717,
  TWD: 0.03128, HKD: 0.1274, AED: 0.2723, SAR: 0.2667, ILS: 0.3384, TRY: 0.02088, CZK: 0.0478,
  HUF: 0.003188, RON: 0.2207, EGP: 0.0199, NGN: 0.0007357, KES: 0.007738, PKR: 0.003602, UAH: 0.02237,
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
