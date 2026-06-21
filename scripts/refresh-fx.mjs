// Refresh map/fx.js with a current, DATE-STAMPED FX snapshot.
// FX rates are facts (not copyrightable); we bake a dated snapshot so the
// ranking's nominal lens + colour buckets are current without a runtime API call.
//   node scripts/refresh-fx.mjs
// Run it periodically (CI cron or before a release), then commit map/fx.js.
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// the currencies the dataset uses (keep in sync with the plans)
const NEED = ['USD', 'AUD', 'EUR', 'GBP', 'CAD', 'NZD', 'SGD', 'ZAR', 'BRL', 'JPY', 'INR', 'PLN', 'CHF', 'MXN',
  'SEK', 'NOK', 'DKK', 'KRW', 'THB', 'MYR', 'PHP', 'IDR', 'CNY', 'VND', 'CLP', 'COP', 'PEN', 'ARS', 'TWD', 'HKD',
  'AED', 'SAR', 'ILS', 'TRY', 'CZK', 'HUF', 'RON', 'EGP', 'NGN', 'KES', 'PKR', 'UAH'];

const sig4 = (v) => Number(v.toPrecision(4)); // 4 significant figures

const res = await fetch('https://open.er-api.com/v6/latest/USD', { headers: { accept: 'application/json' } });
if (!res.ok) throw new Error(`FX fetch ${res.status}`);
const d = await res.json();
const rates = d.rates || {};
const missing = NEED.filter((c) => rates[c] == null);
if (missing.length) throw new Error('missing currencies: ' + missing.join(', '));
const asOf = new Date(d.time_last_update_utc).toISOString().slice(0, 10);

const fx = {};
for (const c of NEED) fx[c] = c === 'USD' ? 1 : sig4(1 / rates[c]);

const lines = [];
for (let i = 0; i < NEED.length; i += 7) lines.push('  ' + NEED.slice(i, i + 7).map((k) => `${k}: ${fx[k]}`).join(', ') + ',');

const body = `// Foreign-exchange snapshot so rates COLOUR-compare and the ranking's nominal
// 'sticker price' lens convert to USD. USD per 1 unit of each currency. FX rates
// are facts (not copyrightable); refreshed at build time and DATE-STAMPED below.
// Displayed plan rates always stay in their local currency. Note: market FX is
// noisy; the ranking's PPP lens is the fairer cross-country comparison.
// Source: open.er-api.com (exchangerate-api.com free endpoint), USD base.
// Regenerate: node scripts/refresh-fx.mjs
window.OET = window.OET || {};
OET.FX_AS_OF = '${asOf}';
OET.FX_SOURCE = 'exchangerate-api.com';
OET.FX = {
${lines.join('\n')}
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
`;

await writeFile(join(root, 'map', 'fx.js'), body);
console.log(`wrote map/fx.js — FX as of ${asOf}, ${NEED.length} currencies`);
