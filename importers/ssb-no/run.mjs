// Build-time SSB-NO importer CLI: fetch the Norwegian household average, map, write.
//   node importers/ssb-no/run.mjs [--updated 2026-06-23] [--dry]
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchNorway } from './fetch.mjs';
import { mapNorway, slug } from './map.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
function arg(name, def) { const i = process.argv.indexOf(`--${name}`); if (i === -1) return def; const v = process.argv[i + 1]; return v && !v.startsWith('--') ? v : true; }
const updated = arg('updated'); const dry = Boolean(arg('dry', false));
const entry = mapNorway(await fetchNorway(), updated ? { updated } : {});
const file = join(root, 'tariffs', 'NO', 'national', 'national-average', `${slug(entry.meta.plan)}.json`);
if (dry) { console.log(`[dry] ${entry.meta.id} | ${entry.tariff.import.flatRate} NOK/kWh | ${entry.tariff.validFrom}`); }
else { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(entry, null, 2) + '\n'); console.log(`wrote ${entry.meta.id}.`); }
