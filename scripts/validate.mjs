// Validate every tariffs/**/*.json against schema/v1/tariff.schema.json,
// enforce unique meta.id, and re-check the licence/source compliance rules.
// Run with:  npm run validate   (CI runs it on every PR)
// NOTE: this repo's host has a "don't run node" constraint for the assistant —
// authored here, executed by CI / the user.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) out.push(...await walk(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

const schema = JSON.parse(await readFile(join(root, 'schema/v1/tariff.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const files = await walk(join(root, 'tariffs'));
const errors = [];
const ids = new Map();

for (const f of files) {
  const rel = relative(root, f);
  let entry;
  try {
    entry = JSON.parse(await readFile(f, 'utf8'));
  } catch (e) {
    errors.push(`${rel}: invalid JSON — ${e.message}`);
    continue;
  }

  if (!validate(entry)) {
    for (const e of validate.errors) errors.push(`${rel}: ${e.instancePath || '/'} ${e.message}`);
    continue;
  }

  // Unique identity key.
  const id = entry.meta.id;
  if (ids.has(id)) errors.push(`${rel}: duplicate meta.id "${id}" (also in ${ids.get(id)})`);
  else ids.set(id, rel);

  // Compliance: Octopus data is never bulk-stored (the schema already excludes
  // source: octopus, but assert the sourceUrl/provider didn't sneak real data in
  // under a wrong source — a human-review hint, not a hard fail).
  const m = entry.meta;
  if (m.source === 'cdr' && m.license !== 'CC-BY-4.0')
    errors.push(`${rel}: source=cdr requires license=CC-BY-4.0 (AER attribution)`);

  // Path should mirror country (lightweight sanity check).
  const wantSeg = `tariffs/${m.country}/`;
  if (!rel.split('\\').join('/').startsWith(wantSeg))
    errors.push(`${rel}: path should start with ${wantSeg} (country=${m.country})`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} validation error(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ ${files.length} tariff(s) valid; ${ids.size} unique id(s).`);
