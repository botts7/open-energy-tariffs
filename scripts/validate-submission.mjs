// Validate data-source submission manifests in sources/*.json against the manifest
// schema, and route by licence. This is the FIRST automated gate for contributed
// sources — a maintainer still reviews before any importer is written/merged.
//
//   node scripts/validate-submission.mjs
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Licence routing. PERMISSIVE -> core repo; SHARE-ALIKE -> extended repo.
const COPYLEFT = new Set(['CC-BY-SA-4.0', 'ODbL-1.0']);
// (Anything not in the manifest schema's enum is already rejected by validation,
//  which deliberately excludes non-commercial / all-rights-reserved / unknown.)

const schema = JSON.parse(await readFile(join(root, 'schema', 'source-manifest.schema.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

let files = [];
try { files = (await readdir(join(root, 'sources'))).filter((f) => f.endsWith('.json') && !f.startsWith('_')); }
catch { /* no sources dir */ }

if (!files.length) { console.log('No submission manifests in sources/. Nothing to check.'); process.exit(0); }

const errors = [];
for (const f of files) {
  const rel = `sources/${f}`;
  let m;
  try { m = JSON.parse(await readFile(join(root, 'sources', f), 'utf8')); }
  catch (e) { errors.push(`${rel}: invalid JSON — ${e.message}`); continue; }

  if (!validate(m)) {
    for (const e of validate.errors) errors.push(`${rel}: ${e.instancePath || '(root)'} ${e.message}`);
    continue;
  }
  // Extra safety checks beyond the schema.
  if (!/^https:\/\//.test(m.sourceUrl)) errors.push(`${rel}: sourceUrl must be HTTPS`);

  const route = COPYLEFT.has(m.licence) ? 'EXTENDED (share-alike → open-energy-tariffs-extended)' : 'CORE (permissive)';
  console.log(`✓ ${rel}  [${m.country}] ${m.name} — licence ${m.licence} → ${route}`);
}

if (errors.length) {
  console.error('\n✗ Submission validation failed:\n' + errors.map((e) => '  - ' + e).join('\n'));
  console.error('\nSee schema/source-manifest.schema.json and CONTRIBUTING.md.');
  process.exit(1);
}
console.log(`\n✓ ${files.length} submission manifest(s) valid.`);
