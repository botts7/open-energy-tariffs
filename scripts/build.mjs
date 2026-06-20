// Compile tariffs/**/*.json into dist/tariffs.json + index.json.
// Run with:  node scripts/build.mjs   (CI runs it on every PR)
// NOTE: this repo's host has a "don't run node" constraint for the assistant —
// the script is authored here but executed by CI / the user, not the assistant.
import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const files = await walk(join(root, 'tariffs'));
const entries = [];
for (const f of files) {
  const e = JSON.parse(await readFile(f, 'utf8'));
  entries.push(e);
}
entries.sort((a, b) => JSON.stringify(a.meta).localeCompare(JSON.stringify(b.meta)));

// index: country -> region -> provider -> [plan...]
const index = {};
for (const e of entries) {
  const { country, region = '', provider, plan } = e.meta;
  ((((index[country] ??= {})[region] ??= {})[provider] ??= [])).push(plan);
}

await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist', 'tariffs.json'), JSON.stringify({ version: 1, count: entries.length, entries }, null, 0));
await writeFile(join(root, 'index.json'), JSON.stringify(index, null, 2));
console.log(`built ${entries.length} tariffs -> dist/tariffs.json + index.json`);
