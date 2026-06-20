// Import (flat) plans from a CSV file into tariffs/.
//   node importers/csv/run.mjs path/to/plans.csv [--updated 2026-06-21] [--dry]
// Then: npm run validate && npm run build.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapCsv } from './map.mjs';
import { slug } from '../_lib/canonical.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('Usage: node importers/csv/run.mjs <file.csv> [--updated YYYY-MM-DD] [--dry]'); process.exit(2); }
const updated = (() => { const i = args.indexOf('--updated'); return i > -1 ? args[i + 1] : undefined; })();
const dry = args.includes('--dry');

const entries = mapCsv(await readFile(file, 'utf8'), updated ? { updated } : {});
const seen = new Set();
let wrote = 0, skipped = 0;
for (const e of entries) {
  if (seen.has(e.meta.id)) { skipped++; continue; }
  seen.add(e.meta.id);
  const region = e.meta.region || (e.meta.coverage && e.meta.coverage.national ? '_national' : '_unknown');
  const out = join(root, 'tariffs', e.meta.country, region, slug(e.meta.provider), `${slug(e.meta.plan)}.json`);
  if (dry) console.log(`[dry] ${e.meta.id} -> ${out}`);
  else { await mkdir(dirname(out), { recursive: true }); await writeFile(out, JSON.stringify(e, null, 2) + '\n'); }
  wrote++;
}
console.log(`${dry ? '[dry] ' : ''}wrote ${wrote}, skipped ${skipped} dup(s). Run 'npm run validate' next.`);
