// Build-time TW-Taipower importer CLI: fetch the live Taipower rate JSON, extract
// the residential simplified two-section time-of-use tariff, map it to a canonical
// entry, and write it under tariffs/TW/. Reproducible — re-running refreshes rates.
//
//   node importers/tw-taipower/run.mjs [--updated 2026-06-22] [--dry]
//   node importers/tw-taipower/run.mjs --record path/to/record.json   # offline override
//
// Then `npm run validate`.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapTaipowerTou, slug } from './map.mjs';
import { fetchTaipowerTou } from './fetch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const recordPath = arg('record');
const updated = arg('updated');
const dry = Boolean(arg('dry', false));

const rec = recordPath
  ? JSON.parse(await readFile(recordPath, 'utf8'))
  : await fetchTaipowerTou();
const entry = mapTaipowerTou(rec, updated ? { updated } : {});

const file = join(root, 'tariffs', 'TW', 'national', slug(entry.meta.provider), `${slug(entry.meta.plan)}.json`);
if (dry) {
  console.log(`[dry] ${entry.meta.id} -> ${file}`);
  console.log(JSON.stringify(entry, null, 2));
} else {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(entry, null, 2) + '\n');
  console.log(`wrote ${entry.meta.id}. Run 'npm run validate' next.`);
}
