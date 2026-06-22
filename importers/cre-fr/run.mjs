// Build-time CRE-FR importer CLI: fetch a data.gouv.fr TRV CSV resource for an
// option, map each row to a canonical entry, and write under tariffs/FR/.
//
//   node importers/cre-fr/run.mjs --base <csvUrl> --option HPHC \
//        [--updated 2026-06-20] [--limit 20] [--dry]
//
// NOTE: the assistant cannot run this (no-node constraint). Run it yourself / in
// CI after confirming the CSV headers (see README), then `npm run validate`.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchTrvCsv } from './fetch.mjs';
import { mapTrvRecord, slug } from './map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const url = arg('base');
const option = String(arg('option', 'BASE')).toUpperCase();
if (!url) { console.error('Missing --base <CSV resource URL>'); process.exit(2); }
const updated = arg('updated');
const limit = Number(arg('limit', '0')) || 0;
const dry = Boolean(arg('dry', false));

const records = await fetchTrvCsv(url, option);
console.log(`fetched ${records.length} ${option} record(s)`);
const work = limit ? records.slice(0, limit) : records;

const seen = new Set();
let written = 0, skipped = 0;
for (const rec of work) {
  const entry = mapTrvRecord(rec, updated ? { updated } : {});
  if (!entry) { skipped++; continue; } // e.g. Tempo
  if (seen.has(entry.meta.id)) { skipped++; continue; }
  seen.add(entry.meta.id);

  const file = join(root, 'tariffs', 'FR', 'national', slug(entry.meta.provider), `${slug(entry.meta.plan)}.json`);
  if (dry) {
    console.log(`[dry] ${entry.meta.id} -> ${file}`);
  } else {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(entry, null, 2) + '\n');
  }
  written++;
}
console.log(`${dry ? '[dry] ' : ''}wrote ${written}, skipped ${skipped}. Run 'npm run validate' next.`);
