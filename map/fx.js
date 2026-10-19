// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '2026-10-05';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
  USD: 1, AUD: 0.6948, EUR: 1.125, GBP: 1.323, CAD: 0.7018, NZD: 0.5614, SGD: 0.7816,
  ZAR: 0.06003, BRL: 0.1915, JPY: 0.00634, INR: 0.01037, PLN: 0.2567, CHF: 1.207, MXN: 0.05496,
  SEK: 0.09958, NOK: 0.104, DKK: 0.1504, KRW: 0.0007437, THB: 0.02979, MYR: 0.2448, PHP: 0.01597,
  IDR: 0.00005582, CNY: 0.149, VND: 0.00003854, CLP: 0.001012, COP: 0.0003022, PEN: 0.2891, ARS: 0.0006566,
  TWD: 0.03138, HKD: 0.1274, AED: 0.2723, SAR: 0.2667, ILS: 0.3284, TRY: 0.02034, CZK: 0.04601,
  HUF: 0.003052, RON: 0.2103, EGP: 0.01914, NGN: 0.0007512, KES: 0.007717, PKR: 0.003604, UAH: 0.02216,
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
