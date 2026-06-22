// Build-time TW-Taipower importer CLI: map a normalised residential time-of-use
// record (assembled from the Taipower rate sheet — see README) to a canonical
// entry and write it under tariffs/TW/.
//
//   node importers/tw-taipower/run.mjs --record path/to/record.json \
//        [--updated 2026-06-20] [--dry]
//
// (Defaults to the bundled two-section sample if --record is omitted, so a dry
// run shows the shape.) NOTE: the assistant cannot run this (no-node constraint);
// run it yourself / in CI, then `npm run validate`.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mapTaipowerTou, slug } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const recordPath = arg('record', join(here, 'fixtures', 'residential-tou-two-section.sample.json'));
const updated = arg('updated');
const dry = Boolean(arg('dry', false));

const rec = JSON.parse(await readFile(recordPath, 'utf8'));
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
