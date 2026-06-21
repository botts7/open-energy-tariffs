// Build-time URDB batch importer: loop the curated us-utilities.json list and
// import residential rates for each utility into tariffs/US/. URDB is CC0 so the
// output is bulk-storable (source:urdb, license:CC0-1.0).
//
//   URDB_API_KEY=... node importers/urdb/run-batch.mjs [--limit 50] [--dry]
//
// The assistant can't run node — CI (.github/workflows/import-urdb.yml) or the
// user runs this, then `npm run validate && npm run build`.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
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

const limit = Number(arg('limit', '50')) || 50;
const dry = Boolean(arg('dry', false));
const updated = new Date().toISOString().slice(0, 10);

const listPath = join(root, 'importers', 'urdb', 'us-utilities.json');
const { utilities } = JSON.parse(await readFile(listPath, 'utf8'));
console.log(`importing ${utilities.length} utility(ies), limit ${limit} each…`);

const seen = new Set();
let written = 0, skipped = 0, empty = 0;
for (const u of utilities) {
  let items = [];
  try { items = await fetchRates({ ratesforutility: u.utility, limit }); }
  catch (e) { console.warn(`fetch failed for "${u.utility}": ${e.message}`); continue; }
  if (!items.length) { empty++; console.warn(`0 items for "${u.utility}" — check the name matches URDB exactly`); continue; }
  for (const item of items) {
    try {
      const entry = mapRate(item, { state: u.state, timezone: u.timezone, updated });
      if (seen.has(entry.meta.id)) { skipped++; continue; }
      seen.add(entry.meta.id);
      const region = entry.meta.region || u.state || '_unknown';
      const file = join(root, 'tariffs', entry.meta.country, region, slug(entry.meta.provider), `${slug(entry.meta.plan)}.json`);
      if (dry) console.log(`[dry] ${entry.meta.id}`);
      else { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(entry, null, 2) + '\n'); }
      written++;
    } catch (e) { skipped++; console.warn(`skip ${item.label || '?'}: ${e.message}`); }
  }
}
console.log(`${dry ? '[dry] ' : ''}wrote ${written}, skipped ${skipped}, ${empty} utility(ies) returned nothing. Run 'npm run validate && npm run build' next.`);
