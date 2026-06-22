// Build-time CH-ElCom importer CLI: fetch per-operator Swiss household tariffs from
// LINDAS, map each to a canonical entry, and write under tariffs/CH/. Reproducible
// — defaults to the latest period.
//
//   node importers/ch-elcom/run.mjs [--updated 2026-06-22] [--period 2026] [--dry]
//
// Then `npm run validate` (and `npm run build` to refresh index.json).
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchElcom } from './fetch.mjs';
import { mapElcom, slug } from './map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const updated = arg('updated');
const period = arg('period');
const limit = Number(arg('limit', '0')) || 0;
const dry = Boolean(arg('dry', false));

const records = await fetchElcom(period ? { period } : {});
console.log(`fetched ${records.length} operator tariff(s)`);
const work = limit ? records.slice(0, limit) : records;

const seen = new Set();
let written = 0, skipped = 0;
for (const rec of work) {
  const entry = mapElcom(rec, updated ? { updated } : {});
  if (seen.has(entry.meta.id)) { skipped++; continue; }
  seen.add(entry.meta.id);
  const file = join(root, 'tariffs', 'CH', 'national', slug(entry.meta.provider), `${slug(entry.meta.plan)}.json`);
  if (dry) {
    console.log(`[dry] ${entry.meta.id}`);
  } else {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(entry, null, 2) + '\n');
  }
  written++;
}
console.log(`${dry ? '[dry] ' : ''}wrote ${written}, skipped ${skipped}. Run 'npm run validate && npm run build' next.`);
