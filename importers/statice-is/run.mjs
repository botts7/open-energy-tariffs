// Build-time Hagstofa-IS importer CLI.  node importers/statice-is/run.mjs [--updated 2026-06-23] [--dry]
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchIceland } from './fetch.mjs';
import { mapIceland, slug } from './map.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
function arg(name, def) { const i = process.argv.indexOf(`--${name}`); if (i === -1) return def; const v = process.argv[i + 1]; return v && !v.startsWith('--') ? v : true; }
const updated = arg('updated'); const dry = Boolean(arg('dry', false));
const records = await fetchIceland(); console.log(`fetched ${records.length} band(s)`);
const seen = new Set(); let written = 0;
for (const rec of records) {
  const entry = mapIceland(rec, updated ? { updated } : {});
  if (seen.has(entry.meta.id)) continue; seen.add(entry.meta.id);
  const file = join(root, 'tariffs', 'IS', 'national', 'household-average', `${slug(entry.meta.plan)}.json`);
  if (dry) console.log(`[dry] ${entry.meta.id} | ${entry.tariff.import.flatRate} ISK/kWh`);
  else { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(entry, null, 2) + '\n'); }
  written++;
}
console.log(`${dry ? '[dry] ' : ''}wrote ${written}.`);
