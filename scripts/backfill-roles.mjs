// One-off + idempotent backfill: add the semantic `role` to every ToU band in
// committed tariffs that doesn't have it, using the same shared assignRoles()
// the importers use (source semantic word, else rate rank). Safe to re-run.
//
//   node scripts/backfill-roles.mjs [--dry]
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignRoles } from '../importers/_lib/canonical.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dry = process.argv.includes('--dry');

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.json')) yield p;
  }
}

let scanned = 0, updated = 0;
const roleCounts = {};
for await (const file of walk(join(root, 'tariffs'))) {
  scanned++;
  const j = JSON.parse(await readFile(file, 'utf8'));
  let touched = false;
  for (const key of ['import', 'export']) {
    const bands = j.tariff?.[key]?.bands;
    if (!Array.isArray(bands) || !bands.length) continue;
    const before = bands.map((b) => b.role).join('|');
    assignRoles(bands);
    if (bands.map((b) => b.role).join('|') !== before) touched = true;
    for (const b of bands) if (b.role) roleCounts[b.role] = (roleCounts[b.role] || 0) + 1;
  }
  if (touched) {
    updated++;
    if (!dry) await writeFile(file, JSON.stringify(j, null, 2) + '\n');
  }
}
console.log(`${dry ? '[dry] ' : ''}scanned ${scanned}, updated ${updated}`);
console.log('role distribution:', roleCounts);
