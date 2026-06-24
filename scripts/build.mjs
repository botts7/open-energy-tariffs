// Compile tariffs/**/*.json into dist/ + index.json.
// Run with:  npm run build   (CI runs it on every PR, after validate)
// Emits:
//   dist/canonical/tariffs.json        — all canonical entries (one bundle)
//   dist/canonical/tariffs.<CC>.json   — per-country chunks
//   index.json                         — country -> region -> provider -> [{id,plan,verified}]
// TODO (next): run adapters/ (canonical -> wallbox 24h arrays) into dist/wallbox/.
// NOTE: this repo's host has a "don't run node" constraint for the assistant —
// authored here, executed by CI / the user.
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_MAJOR = 1;

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) out.push(...await walk(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

const files = await walk(join(root, 'tariffs'));
const entries = [];
for (const f of files) entries.push(JSON.parse(await readFile(f, 'utf8')));
entries.sort((a, b) => a.meta.id.localeCompare(b.meta.id));

// Fail fast on duplicate identity keys (validate.mjs also checks this).
const seen = new Set();
for (const e of entries) {
  if (seen.has(e.meta.id)) throw new Error(`duplicate meta.id: ${e.meta.id}`);
  seen.add(e.meta.id);
}

// index: country -> region -> provider -> [{ id, plan, verified }]
const index = {};
for (const e of entries) {
  const { country, region = '', provider, plan, id, verified = false } = e.meta;
  (((index[country] ??= {})[region] ??= {})[provider] ??= []).push({ id, plan, verified });
}

const distCanon = join(root, 'dist', 'canonical');
await mkdir(distCanon, { recursive: true });

const bundle = (list) => ({ schemaMajor: SCHEMA_MAJOR, count: list.length, entries: list });

// Freshness manifest: newest meta.updated per source (+ overall) and a build stamp,
// so the GUI can show how current each source is, the next auto-refresh, and flag
// stale sources. Deterministic except builtAt (dist/ isn't committed, so that's OK).
const bySource = {};
let latestAll = '';
for (const e of entries) {
  const s = e.meta.source || 'other';
  const u = e.meta.updated || '';
  const S = (bySource[s] ??= { count: 0, latest: '' });
  S.count++; if (u > S.latest) S.latest = u;
  if (u > latestAll) latestAll = u;
}
// "checked" = when each source was last refreshed (importers stamp data-status.json).
// Lets the GUI judge staleness by last-CHECK, not last-CHANGE — so an incrementally
// refreshed source (CDR) that simply had no changes doesn't read as stale.
let checked = {};
try {
  const status = JSON.parse(await readFile(join(root, 'data-status.json'), 'utf8'));
  for (const [k, v] of Object.entries(status)) if (v && v.lastRefresh) checked[k] = v.lastRefresh;
} catch { /* no status file yet */ }
const mainBundle = {
  ...bundle(entries),
  builtAt: new Date().toISOString().slice(0, 10),
  freshness: { latest: latestAll, bySource, checked },
};
await writeFile(join(distCanon, 'tariffs.json'), JSON.stringify(mainBundle, null, 0));

// Per-country chunks.
const byCountry = {};
for (const e of entries) (byCountry[e.meta.country] ??= []).push(e);
for (const [cc, list] of Object.entries(byCountry))
  await writeFile(join(distCanon, `tariffs.${cc}.json`), JSON.stringify(bundle(list), null, 0));

await writeFile(join(root, 'index.json'), JSON.stringify(index, null, 2));
console.log(`built ${entries.length} tariffs across ${Object.keys(byCountry).length} countries -> dist/canonical/ + index.json`);
