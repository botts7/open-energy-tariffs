// Build-time AU-CDR importer CLI: fetch generic plans from an AER base URI,
// map each to a canonical entry, and write under tariffs/AU/.
//
//   node importers/cdr/run.mjs --base https://cdr.energymadeeasy.gov.au/<retailer> \
//        [--updated 2026-06-20] [--limit 50] [--dry]
//
// NOTE: the assistant cannot run this (no-node constraint + the x-v header it
// can't send from its fetch). Run it yourself / in CI, then `npm run validate`.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPlans, fetchPlanDetail } from './fetch.mjs';
import { mapPlanDetail, slug } from './map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const base = arg('base');
if (!base) { console.error('Missing --base <AER base URI>'); process.exit(2); }
const updated = arg('updated');
const limit = Number(arg('limit', '0')) || 0;
const dry = Boolean(arg('dry', false));

const plans = await fetchPlans(base);
console.log(`fetched ${plans.length} plan(s) from ${base}`);
const work = limit ? plans.slice(0, limit) : plans;

const seen = new Set();
let written = 0, skipped = 0;
for (const p of work) {
  try {
    const detail = await fetchPlanDetail(base, p.planId);
    const entry = mapPlanDetail(detail, updated ? { updated } : {});
    if (seen.has(entry.meta.id)) { skipped++; continue; }
    seen.add(entry.meta.id);

    const region = entry.meta.region || '_unknown';
    const file = join(root, 'tariffs', 'AU', region, slug(entry.meta.provider), `${slug(entry.meta.plan)}.json`);
    if (dry) {
      console.log(`[dry] ${entry.meta.id} -> ${file}`);
    } else {
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(entry, null, 2) + '\n');
    }
    written++;
  } catch (e) {
    skipped++;
    console.warn(`skip ${p.planId}: ${e.message}`);
  }
}
console.log(`${dry ? '[dry] ' : ''}wrote ${written}, skipped ${skipped}. Run 'npm run validate' next.`);
