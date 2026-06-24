// Build-time DK-Energinet importer CLI: fetch DatahubPricelist tariff rows, map
// each to a canonical entry, and write under tariffs/DK/.
//
//   node importers/dk-energinet/run.mjs [--chargeType D03] [--updated 2026-06-20] \
//        [--limit 50] [--dry]
//
// NOTE: the assistant cannot run this (no-node constraint). Run it yourself / in
// CI, then `npm run validate`.
import { writeEntryIfChanged, stampRefresh } from '../_lib/write.mjs';
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

const records = await fetchPricelist({
  chargeType,
  onProgress: (n, scanned) => process.stdout.write(`\r  scanning… ${n} current tariffs found (${scanned} rows)   `),
});
process.stdout.write('\n');
console.log(`found ${records.length} current tariff(s)`);
const work = limit ? records.slice(0, limit) : records;

const seen = new Set();
let written = 0, skipped = 0, unchanged = 0;
for (const rec of work) {
  try {
    const entry = mapPricelistRecord(rec, updated ? { updated } : {});
    if (seen.has(entry.meta.id)) { skipped++; continue; }
    seen.add(entry.meta.id);

    const file = join(root, 'tariffs', 'DK', 'national', slug(entry.meta.provider), `${slug(entry.meta.plan)}.json`);
    if (dry) { console.log(`[dry] ${entry.meta.id} -> ${file}`); written++; }
    else { (await writeEntryIfChanged(file, entry)) === 'unchanged' ? unchanged++ : written++; }
  } catch (e) {
    skipped++;
    console.warn(`skip ${rec.chargeOwner}/${rec.description}: ${e.message}`);
  }
}
if (!dry) await stampRefresh(root, 'provider', updated);
console.log(`${dry ? '[dry] ' : ''}wrote/changed ${written}, unchanged ${unchanged}, skipped ${skipped}. Run 'npm run validate' next.`);
