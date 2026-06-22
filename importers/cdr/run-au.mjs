// Bulk-import AU electricity plans across ALL AER retailer base URIs into
// tariffs/. Reuses the CDR importer (fetch + map). Writes license:other (public CDR Product Reference Data) entries with
// AER attribution + meta.coverage (postcodes) so the map fills out nationally.
//
//   node importers/cdr/run-au.mjs [--updated 2026-06-20] [--limit 100] [--dry]
//
// Covers NSW/VIC/SA/ACT/TAS/QLD (the AER generic-plans scheme). WA & NT are NOT
// in CDR. NOTE: the assistant can't run node — run in CI / locally, then
// `npm run validate && npm run build`. This can write MANY files; use --limit first.
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPlans, fetchPlanDetail } from './fetch.mjs';
import { mapPlanDetail, slug } from './map.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOST = 'https://cdr.energymadeeasy.gov.au';

// AER Energy Made Easy brand slugs, verified live 2026-06-21 (cdr.energymadeeasy.gov.au/<code>).
// Note several slugs differ from the brand name (origin, red-energy, ovo-energy, alinta).
// Simply Energy isn't served here (self-hosted CDR). Re-probe periodically — slugs change.
const RETAILERS = [
  'agl', 'origin', 'energyaustralia', 'red-energy', 'alinta', 'engie', 'powershop',
  'momentum', 'globird', 'dodo', 'lumo', 'nectr', 'ovo-energy', 'ergon', 'amber',
  'covau', 'kogan', 'actewagl', 'diamond', 'tango', 'arcline', 'radian',
];

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const updated = arg('updated');
const limit = Number(arg('limit', '0')) || 0; // 0 = all plans per retailer
const dry = Boolean(arg('dry', false));

const seen = new Set();
let written = 0, skipped = 0, failed = 0;

for (const code of RETAILERS) {
  const base = `${HOST}/${code}`;
  let plans = [];
  try {
    plans = await fetchPlans(base, { fuelType: 'ELECTRICITY' });
  } catch (e) { console.warn(`! ${code}: list failed — ${e.message}`); failed++; continue; }
  const work = limit ? plans.slice(0, limit) : plans;
  console.log(`${code}: ${plans.length} plan(s)${limit ? ` (importing ${work.length})` : ''}`);

  for (const p of work) {
    try {
      const detail = await fetchPlanDetail(base, p.planId);
      const entry = mapPlanDetail(detail, updated ? { updated } : {});
      if (seen.has(entry.meta.id)) { skipped++; continue; }
      seen.add(entry.meta.id);
      const region = entry.meta.region || '_unknown';
      // Include the distributor in the FILENAME: a retailer offers the same plan
      // name across multiple distribution zones; those share region/provider/plan
      // but differ by distributor (which IS in meta.id). Without it, ~1/3 of plans
      // overwrite each other on disk. Suffix keeps every unique meta.id a file.
      const distSlug = slug(entry.meta.distributor || '');
      const planFile = distSlug ? `${slug(entry.meta.plan)}--${distSlug}` : slug(entry.meta.plan);
      const file = join(root, 'tariffs', 'AU', region, slug(entry.meta.provider), `${planFile}.json`);
      if (dry) { console.log(`  [dry] ${entry.meta.id}`); }
      else { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(entry, null, 2) + '\n'); }
      written++;
    } catch (e) { skipped++; }
  }
}
console.log(`\n${dry ? '[dry] ' : ''}wrote ${written}, skipped ${skipped}, ${failed} retailer(s) failed.`);
console.log("Next: npm run validate && npm run build  (then review the diff before committing).");
