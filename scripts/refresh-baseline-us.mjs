// Refresh map/baseline-us.js with EIA reference residential electricity prices,
// used to cross-validate our US community data (national + per-state).
// Source: U.S. EIA, electricity retail-sales, sector RES (US public domain).
// Needs a free key from https://www.eia.gov/opendata/register.php in env EIA_API_KEY.
//   EIA_API_KEY=... node scripts/refresh-baseline-us.mjs
// Run periodically (EIA updates monthly), then commit map/baseline-us.js.
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const key = process.env.EIA_API_KEY;
if (!key) throw new Error('EIA_API_KEY env var is required (free key from eia.gov/opendata/register).');

// Annual residential retail price (cents/kWh) by state, most recent period.
const url = 'https://api.eia.gov/v2/electricity/retail-sales/data/'
  + `?api_key=${encodeURIComponent(key)}`
  + '&frequency=annual&data[0]=price&facets[sectorid][0]=RES'
  + '&sort[0][column]=period&sort[0][direction]=desc&length=5000';

const res = await fetch(url, { headers: { accept: 'application/json' } });
if (!res.ok) throw new Error(`EIA ${res.status} ${res.statusText}`);
const body = await res.json();
const rows = (body.response && body.response.data) || [];
if (!rows.length) throw new Error('EIA returned no rows — check the key / query.');

// keep the most recent period per state (rows are period-desc sorted)
const seen = {};
let latest = '';
for (const r of rows) {
  const st = r.stateid, p = Number(r.price);
  if (!st || !isFinite(p)) continue;
  if (!(st in seen)) seen[st] = p;       // first = newest period for that state
  if (r.period > latest) latest = r.period;
}
const toUsd = (cents) => Math.round((cents / 100) * 1e4) / 1e4; // cents/kWh -> $/kWh, 4dp
const national = seen.US != null ? toUsd(seen.US) : null;
const states = {};
for (const [st, cents] of Object.entries(seen)) {
  if (st === 'US' || st.length !== 2) continue; // skip national + region aggregates
  states[st] = toUsd(cents);
}
const data = JSON.stringify({ asOf: latest, national, states: Object.fromEntries(Object.entries(states).sort()) });

const out = `// Reference residential electricity prices for cross-validating our US data.
// DERIVED from U.S. EIA retail-sales, sector RES (US public domain): residential
// average price, latest annual period ${latest}, converted cents/kWh -> USD/kWh.
// Attributed in the ranking panel + LICENSING.md. Regenerate: EIA_API_KEY=... node scripts/refresh-baseline-us.mjs
window.OET = window.OET || {};
OET.BASELINE_US_SOURCE = 'U.S. EIA (public domain)';
OET.BASELINE_US = ${data};
`;
await writeFile(join(root, 'map', 'baseline-us.js'), out);
console.log(`wrote map/baseline-us.js — national $${national}/kWh, ${Object.keys(states).length} states, period ${latest}`);
