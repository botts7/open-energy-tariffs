// Build-time DK-Energinet importer CLI: fetch DatahubPricelist tariff rows, map
// each to a canonical entry, and write under tariffs/DK/.
//
//   node importers/dk-energinet/run.mjs [--chargeType D03] [--updated 2026-06-20] \
//        [--limit 50] [--dry]
//
// NOTE: the assistant cannot run this (no-node constraint). Run it yourself / in
// CI, then `npm run validate`.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPricelist } from './fetch.mjs';
import { mapPricelistRecord, slug } from './map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const chargeType = arg('chargeType', 'D03');
const updated = arg('updated');
const limit = Number(arg('limit', '0')) || 0;
const dry = Boolean(arg('dry', false));

const records = await fetchPricelist({ chargeType, limit: limit || 500 });
console.log(`fetched ${records.length} tariff record(s)`);
const work = limit ? records.slice(0, limit) : records;

const seen = new Set();
let written = 0, skipped = 0;
for (const rec of work) {
  try {
    const entry = mapPricelistRecord(rec, updated ? { updated } : {});
    if (seen.has(entry.meta.id)) { skipped++; continue; }
    seen.add(entry.meta.id);

    const file = join(root, 'tariffs', 'DK', 'national', slug(entry.meta.provider), `${slug(entry.meta.plan)}.json`);
    if (dry) {
      console.log(`[dry] ${entry.meta.id} -> ${file}`);
    } else {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(entry, null, 2) + '\n');
    }
    written++;
  } catch (e) {
    skipped++;
    console.warn(`skip ${rec.chargeOwner}/${rec.description}: ${e.message}`);
  }
}
console.log(`${dry ? '[dry] ' : ''}wrote ${written}, skipped ${skipped}. Run 'npm run validate' next.`);
