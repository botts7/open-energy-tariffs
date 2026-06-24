// Build-time Eurostat importer CLI: fetch all EU/EFTA household averages, replace
// each country's hand-curated estimate with the real Eurostat value. CI-only
// (Eurostat is sandbox-blocked, reachable from runners).
//
//   node importers/eurostat/run.mjs [--updated 2026-06-23] [--dry]
import { readdir, readFile, rm } from 'node:fs/promises';
import { writeEntryIfChanged, stampRefresh } from '../_lib/write.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchEurostat } from './fetch.mjs';
import { mapEurostat, slug } from './map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Countries with richer, real importer data — never overwrite these with a single
// Eurostat average.
const SKIP = new Set(['CH', 'DK', 'FR', 'NL', 'FI', 'NO', 'IS']);

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const updated = arg('updated');
const dry = Boolean(arg('dry', false));

async function walk(dir) {
  let out = [];
  let ents;
  try { ents = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(await walk(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

/** Remove a country's hand-curated estimate files (source manual, unverified). */
async function removeEstimates(cc) {
  let removed = 0;
  for (const f of await walk(join(root, 'tariffs', cc))) {
    try {
      const m = JSON.parse(await readFile(f, 'utf8')).meta || {};
      if (m.source === 'manual' && !m.verified) { if (!dry) await rm(f); removed++; }
    } catch { /* skip */ }
  }
  return removed;
}

const records = await fetchEurostat();
console.log(`fetched ${records.length} country average(s)`);

let written = 0, skipped = 0, replaced = 0, unchanged = 0;
for (const rec of records) {
  if (SKIP.has(rec.country)) { skipped++; continue; }
  replaced += await removeEstimates(rec.country);
  const entry = mapEurostat(rec, updated ? { updated } : {});
  const file = join(root, 'tariffs', rec.country, 'national', 'eurostat', `${slug(entry.meta.plan)}.json`);
  if (dry) { console.log(`[dry] ${entry.meta.id} | ${entry.tariff.import.flatRate} EUR/kWh | ${entry.tariff.validFrom}`); written++; }
  else if ((await writeEntryIfChanged(file, entry)) === 'unchanged') unchanged++;
  else written++;
}
if (!dry) await stampRefresh(root, 'provider', updated);
console.log(`${dry ? '[dry] ' : ''}wrote/changed ${written}, unchanged ${unchanged}, skipped ${skipped} (real-data countries), replaced ${replaced} estimate(s).`);
