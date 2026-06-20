// Approximate FX (USD per 1 unit of currency, ~2026) so the rate COLOURS are
// comparable across currencies (e.g. PLN 1.05/kWh vs AUD 0.40/kWh). Illustrative
// and static — a production map would fetch live rates. Displayed rates stay in
// each plan's local currency; only the colour bucket uses the USD-equivalent.
window.OET = window.OET || {};
OET.FX = {
  USD: 1, AUD: 0.65, EUR: 1.08, GBP: 1.27, CAD: 0.73, NZD: 0.60, SGD: 0.74,
  ZAR: 0.055, BRL: 0.18, JPY: 0.0066, INR: 0.012, PLN: 0.25, CHF: 1.12, MXN: 0.055,
  SEK: 0.095, NOK: 0.094, DKK: 0.145, KRW: 0.00073,
  THB: 0.028, MYR: 0.22, PHP: 0.018, IDR: 0.000062, CNY: 0.14, VND: 0.00004,
  CLP: 0.0011, COP: 0.00025, PEN: 0.27, ARS: 0.0009, TWD: 0.031, HKD: 0.128,
  AED: 0.272, SAR: 0.267, ILS: 0.27, TRY: 0.029, CZK: 0.043, HUF: 0.0027,
  RON: 0.217, EGP: 0.020, NGN: 0.00065, KES: 0.0077, PKR: 0.0036, UAH: 0.024,
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
