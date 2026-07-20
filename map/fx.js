// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-07-20';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.6974, EUR: 1.143, GBP: 1.344, CAD: 0.7133, NZD: 0.5838, SGD: 0.774,
  ZAR: 0.06042, BRL: 0.1956, JPY: 0.006154, INR: 0.01036, PLN: 0.2632, CHF: 1.237, MXN: 0.057,
  SEK: 0.1035, NOK: 0.1036, DKK: 0.1532, KRW: 0.0006725, THB: 0.02972, MYR: 0.2442, PHP: 0.01621,
  IDR: 0.00005573, CNY: 0.1475, VND: 0.00003814, CLP: 0.001077, COP: 0.0003078, PEN: 0.2947, ARS: 0.0006756,
  TWD: 0.03087, HKD: 0.1275, AED: 0.2723, SAR: 0.2667, ILS: 0.3285, TRY: 0.02119, CZK: 0.04719,
  HUF: 0.003146, RON: 0.2182, EGP: 0.0197, NGN: 0.0007247, KES: 0.007735, PKR: 0.003595, UAH: 0.02238,
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
