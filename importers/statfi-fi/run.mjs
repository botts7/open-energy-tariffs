// Build-time StatFin-FI importer CLI: fetch Finnish household prices, map, write.
//   node importers/statfi-fi/run.mjs [--updated 2026-06-23] [--dry]
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFinland } from './fetch.mjs';
import { mapFinland, slug } from './map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
function arg(name, def) { const i = process.argv.indexOf(`--${name}`); if (i === -1) return def; const v = process.argv[i + 1]; return v && !v.startsWith('--') ? v : true; }
const updated = arg('updated'); const dry = Boolean(arg('dry', false));

const records = await fetchFinland();
console.log(`fetched ${records.length} household band(s)`);
const seen = new Set(); let written = 0, skipped = 0;
for (const rec of records) {
  const entry = mapFinland(rec, updated ? { updated } : {});
  if (seen.has(entry.meta.id)) { skipped++; continue; }
  seen.add(entry.meta.id);
  const file = join(root, 'tariffs', 'FI', 'national', 'household-average', `${slug(entry.meta.plan)}.json`);
  if (dry) console.log(`[dry] ${entry.meta.id} | ${entry.tariff.import.flatRate} EUR/kWh`);
  else { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(entry, null, 2) + '\n'); }
  written++;
}
console.log(`${dry ? '[dry] ' : ''}wrote ${written}, skipped ${skipped}.`);
