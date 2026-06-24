// Bulk-import AU electricity plans across ALL AER retailer base URIs into
// tariffs/. Reuses the CDR importer (fetch + map). Writes license:other (public CDR Product Reference Data) entries with
// AER attribution + meta.coverage (postcodes) so the map fills out nationally.
//
//   node importers/cdr/run-au.mjs [--updated 2026-06-20] [--limit 100] [--dry]
//                                 [--concurrency 8] [--full] [--prune]
//
// INCREMENTAL by default: each plan's CDR `lastUpdated` is stored as meta.sourceUpdated
// (+ planId as meta.sourceId); on re-run, plans whose lastUpdated is unchanged REUSE
// the committed file (no detail fetch, no rewrite) — so a weekly run only pulls the
// handful that changed and the diff is tiny. --full forces a complete re-fetch;
// --prune deletes files for plans no longer offered (only when no retailer list failed).
//
// Covers NSW/VIC/SA/ACT/TAS/QLD (the AER generic-plans scheme). WA & NT are NOT
// in CDR. NOTE: the assistant can't run node — run in CI / locally, then
// `npm run validate && npm run build`. This can write MANY files; use --limit first.
import { writeFile, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPlans, fetchPlanDetail } from './fetch.mjs';
import { mapPlanDetail, slug } from './map.mjs';
import { pool } from '../_lib/pool.mjs';
import { stampRefresh } from '../_lib/write.mjs';

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
const concurrency = Number(arg('concurrency', '8')) || 8; // parallel detail fetches
const full = Boolean(arg('full', false));     // re-fetch everything (ignore incremental)
const prune = Boolean(arg('prune', false));   // delete withdrawn plans
const dry = Boolean(arg('dry', false));

async function walk(dir) {
  let out = [];
  let ents;
  try { ents = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(await walk(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

// Index existing AU entries by their CDR planId (meta.sourceId) so unchanged plans
// can be reused without re-fetching detail. Files predating this feature have no
// sourceId -> they fall through to a (one-time) full fetch that seeds the markers.
const existing = new Map(); // planId -> { id, file, sourceUpdated }
const existingFiles = [];
for (const f of await walk(join(root, 'tariffs', 'AU'))) {
  try {
    const m = JSON.parse(await readFile(f, 'utf8')).meta || {};
    existingFiles.push({ file: f, sourceId: m.sourceId });
    if (m.sourceId) existing.set(m.sourceId, { id: m.id, file: f, sourceUpdated: m.sourceUpdated });
  } catch { /* skip unreadable */ }
}

const seen = new Set();        // meta.id dedup
const liveIds = new Set();     // planIds still on offer (for prune)
let written = 0, reused = 0, skipped = 0, failed = 0;

for (const code of RETAILERS) {
  const base = `${HOST}/${code}`;
  let plans = [];
  try {
    plans = await fetchPlans(base, { fuelType: 'ELECTRICITY' });
  } catch (e) { console.warn(`! ${code}: list failed — ${e.message}`); failed++; continue; }
  const work = limit ? plans.slice(0, limit) : plans;

  // Incremental split: unchanged (reuse committed file) vs changed/new (fetch detail).
  const toFetch = [];
  let reusedThis = 0;
  for (const p of work) {
    const ex = existing.get(p.planId);
    if (!full && ex && ex.sourceUpdated && p.lastUpdated && ex.sourceUpdated === p.lastUpdated) {
      seen.add(ex.id); liveIds.add(p.planId); reused++; reusedThis++;
    } else {
      toFetch.push(p);
    }
  }
  console.log(`${code}: ${plans.length} plan(s) — ${reusedThis} unchanged, ${toFetch.length} to fetch`);

  // Fetch the changed/new plan DETAILS concurrently (the slow I/O), bounded to stay
  // polite. The map + dedup + write stays SEQUENTIAL so `seen` + writes can't race.
  const fetched = await pool(toFetch, concurrency, async (p) => {
    try { return { p, detail: await fetchPlanDetail(base, p.planId) }; }
    catch (e) { return { p, error: e }; }
  });

  for (const d of fetched) {
    if (!d || d.error || !d.detail) { skipped++; continue; }
    try {
      const entry = mapPlanDetail(d.detail, updated ? { updated } : {});
      if (seen.has(entry.meta.id)) { skipped++; continue; }
      seen.add(entry.meta.id);
      liveIds.add(d.p.planId);
      // Store the change markers so the NEXT run can skip this plan when unchanged.
      entry.meta.sourceId = d.p.planId;
      if (d.p.lastUpdated) entry.meta.sourceUpdated = d.p.lastUpdated;
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

// Prune withdrawn plans (opt-in): files whose planId no longer appears on offer.
// Only when EVERY retailer list succeeded — never delete on a partial run.
let pruned = 0;
if (prune && !dry && failed === 0) {
  for (const ef of existingFiles) {
    if (ef.sourceId && !liveIds.has(ef.sourceId)) { await rm(ef.file); pruned++; }
  }
}

// Stamp "last refreshed" for the freshness panel, so an unchanged-but-checked run
// isn't mistaken for stale (incremental keeps old per-plan dates by design).
if (!dry) await stampRefresh(root, 'cdr', updated);

console.log(`\n${dry ? '[dry] ' : ''}wrote ${written}, reused ${reused} unchanged, skipped ${skipped}, pruned ${pruned}, ${failed} retailer(s) failed.`);
console.log("Next: npm run validate && npm run build  (then review the diff before committing).");
