// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-11-09';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.6869, EUR: 1.115, GBP: 1.336, CAD: 0.7084, NZD: 0.5557, SGD: 0.7795,
  ZAR: 0.06048, BRL: 0.1817, JPY: 0.006316, INR: 0.01063, PLN: 0.2536, CHF: 1.22, MXN: 0.05367,
  SEK: 0.1011, NOK: 0.1058, DKK: 0.1493, KRW: 0.0007345, THB: 0.0298, MYR: 0.2464, PHP: 0.01585,
  IDR: 0.00005524, CNY: 0.1497, VND: 0.00003904, CLP: 0.001023, COP: 0.0003083, PEN: 0.2903, ARS: 0.0006471,
  TWD: 0.03044, HKD: 0.1276, AED: 0.2723, SAR: 0.2667, ILS: 0.3137, TRY: 0.01992, CZK: 0.0458,
  HUF: 0.003069, RON: 0.209, EGP: 0.01851, NGN: 0.0007428, KES: 0.007696, PKR: 0.003613, UAH: 0.02204,
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
