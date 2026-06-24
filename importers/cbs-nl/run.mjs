// Build-time CBS-NL importer CLI: fetch the latest Dutch household average from
// CBS, map to canonical, write under tariffs/NL/. CI-only (CBS is sandbox-blocked).
//
//   node importers/cbs-nl/run.mjs [--updated 2026-06-23] [--dry]
import { writeEntryIfChanged, stampRefresh } from '../_lib/write.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchCbsNl } from './fetch.mjs';
import { mapCbsNl, slug } from './map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const updated = arg('updated');
const dry = Boolean(arg('dry', false));

const rec = await fetchCbsNl();
const entry = mapCbsNl(rec, updated ? { updated } : {});
const file = join(root, 'tariffs', 'NL', 'national', 'national-average', `${slug(entry.meta.plan)}.json`);
if (dry) {
  console.log(`[dry] ${entry.meta.id}`);
  console.log(JSON.stringify(entry, null, 2));
} else {
  const st = await writeEntryIfChanged(file, entry);
  await stampRefresh(root, 'provider', updated);
  console.log(`${st} ${entry.meta.id}. Run 'npm run validate && npm run build' next.`);
}
