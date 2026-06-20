// Build-time URDB importer CLI: fetch rate items, map to canonical, write under
// tariffs/US/. URDB is CC0 so output is bulk-storable.
//
//   URDB_API_KEY=... node importers/urdb/run.mjs --utility "Pacific Gas & Electric Co" \
//        --state CA --timezone America/Los_Angeles [--updated 2026-06-20] [--limit 50] [--dry]
//
// NOTE: the assistant can't run this (no-node + needs a key). Run it / in CI,
// then `npm run validate`.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchRates } from './fetch.mjs';
import { mapRate } from './map.mjs';
import { slug } from '../_lib/canonical.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const ratesforutility = arg('utility');
const state = arg('state', '');
const timezone = arg('timezone');
const currency = arg('currency');           // for IURDB international items (US defaults USD)
const updated = arg('updated');
const limit = Number(arg('limit', '50')) || 50;
const dry = Boolean(arg('dry', false));

const items = await fetchRates({ ratesforutility, limit });
console.log(`fetched ${items.length} URDB item(s)`);

const seen = new Set();
let written = 0, skipped = 0;
for (const item of items) {
  try {
    const entry = mapRate(item, { state, timezone, currency, updated });
    if (seen.has(entry.meta.id)) { skipped++; continue; }
    seen.add(entry.meta.id);
    const region = entry.meta.region || '_unknown';
    const file = join(root, 'tariffs', entry.meta.country, region, slug(entry.meta.provider), `${slug(entry.meta.plan)}.json`);
    if (dry) console.log(`[dry] ${entry.meta.id} -> ${file}`);
    else { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(entry, null, 2) + '\n'); }
    written++;
  } catch (e) {
    skipped++;
    console.warn(`skip ${item.label || '?'}: ${e.message}`);
  }
}
console.log(`${dry ? '[dry] ' : ''}wrote ${written}, skipped ${skipped}. Run 'npm run validate' next.`);
