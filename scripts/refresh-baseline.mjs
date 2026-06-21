// Refresh map/baseline.js with Eurostat reference household electricity prices,
// used to cross-validate our community data and overlay a baseline in the ranking.
// Source: Eurostat nrg_pc_204 (CC BY 4.0), band DC (2500-4999 kWh/yr), all taxes
// included, EUR/kWh, latest semester.
//   node scripts/refresh-baseline.mjs
// Run periodically (Eurostat updates ~twice a year), then commit map/baseline.js.
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REMAP = { EL: 'GR', UK: 'GB' }; // Eurostat geo -> ISO-2 used in our data

const url = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204'
  + '?format=JSON&nrg_cons=KWH2500-4999&unit=KWH&tax=I_TAX&currency=EUR&lastTimePeriod=1';
const res = await fetch(url, { headers: { accept: 'application/json' } });
if (!res.ok) throw new Error(`Eurostat ${res.status}`);
const d = await res.json();

const idx = d.dimension.geo.category.index;
const period = Object.values(d.dimension.time.category.label)[0];
const vals = d.value;
const out = {};
for (const [g, pos] of Object.entries(idx)) {
  if (g.startsWith('EU') || g.startsWith('EA')) continue;
  const v = vals[String(pos)];
  if (v == null) continue;
  out[REMAP[g] || g] = { eur: Math.round(v * 1e4) / 1e4 };
}
const data = JSON.stringify(Object.fromEntries(Object.entries(out).sort()));

const body = `// Reference household electricity prices for cross-validating our community data
// and overlaying a baseline in the ranking. Source: Eurostat 'Electricity prices
// for household consumers' (nrg_pc_204), CC BY 4.0. Band DC (2 500-4 999 kWh/yr,
// typical household), ALL taxes & levies included, EUR per kWh, period ${period}.
// Attributed in the ranking panel + LICENSING.md. Regenerate: node scripts/refresh-baseline.mjs
window.OET = window.OET || {};
OET.BASELINE_AS_OF = '${period}';
OET.BASELINE_SOURCE = 'Eurostat nrg_pc_204 (CC BY 4.0)';
OET.BASELINE = ${data};

// Reference price for a country as USD/kWh (nominal), via the dated FX snapshot.
OET.baselineUsd = function (cc) {
  const b = OET.BASELINE && OET.BASELINE[cc];
  if (!b) return null;
  const eurUsd = (OET.FX && OET.FX.EUR) || 1.1;
  return b.eur * eurUsd;
};

// Cross-check our community median against the reference. ±25% = 'match' (data is
// externally corroborated -> Beta-eligible); outside = 'diverge'; no ref = null.
OET.crossCheck = function (cc) {
  const ref = OET.baselineUsd(cc);
  if (ref == null) return null;
  const ps = (OET.PLANS || []).filter((r) => r.meta.country === cc);
  const us = ps.map((r) => OET.toUsd(r.rate, r.meta.currency)).filter((v) => v > 0).sort((a, b) => a - b);
  if (!us.length) return { ref, ours: null, status: 'no-data' };
  const med = us[us.length >> 1];
  const ratio = med / ref;
  return { ref, ours: med, ratio, status: ratio >= 0.75 && ratio <= 1.34 ? 'match' : 'diverge' };
};
`;
await writeFile(join(root, 'map', 'baseline.js'), body);
console.log(`wrote map/baseline.js — ${Object.keys(out).length} countries, period ${period}`);
