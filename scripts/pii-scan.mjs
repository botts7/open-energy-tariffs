// Scan tariffs/**/*.json for personal data that must never be committed.
// Plan STRUCTURES are public; account/meter/identity data is not.
// Run with:  npm run pii   (CI runs it on every PR)
// NOTE: authored here; executed by CI / the user (no-node constraint).
//
// Scope: tariffs/ only (contributed data). Dev fixtures under importers/ are not
// scanned — they hold synthetic source-shaped samples by design.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Each rule: a regex + why it's flagged. A match fails the scan.
const RULES = [
  { name: 'email address', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { name: 'long numeric id (NMI / MPAN / meter / account / card)', re: /\b\d{10,}\b/ },
  { name: 'AU phone number', re: /\b(?:\+?61|0)[2-478](?:[ -]?\d){8}\b/ },
  // Street address — two rules so plan-name acronyms don't false-positive:
  //  (a) full words are case-insensitive ("12 Smith Street/Road/Close").
  //  (b) short abbreviations match only Title/lower case ("12 Smith St/Rd/Cl"),
  //      never ALL-CAPS — else energy acronyms like "5 Day TOU with CL" (CL =
  //      Controlled Load) read as "<num> ... Close".
  { name: 'street address', re: /\b\d+\s+[A-Za-z][A-Za-z .'-]*\s+(?:street|road|avenue|drive|lane|court|place|crescent|close|way|highway|parade|boulevard|terrace)\b/i },
  { name: 'street address (abbrev)', re: /\b\d+\s+[A-Za-z][A-Za-z .'-]*\s+(?:St|Rd|Ave|Dr|Ln|Ct|Pl|Cl|Cres|Pde|Blvd|Hwy|Tce|st|rd|ave|dr|ln|ct|pl|cl|cres|pde|blvd|hwy|tce)\b/ },
  { name: 'identity keyword', re: /\b(nmi|mpan|meter\s*(?:no|number|serial|id)|account\s*(?:no|number)|date\s*of\s*birth|\bdob\b|driver'?s?\s*licen[cs]e|passport|medicare)\b/i },
  { name: 'secret / credential keyword', re: /\b(api[_-]?key|secret|passwd|password|bearer|authorization|client[_-]?secret|access[_-]?token)\b/i },
  // Long opaque blobs catch embedded secrets/tokens — but skip http(s) URLs:
  // legit sourceUrls (e.g. URDB rate links .../rate/view/<base64 page-id>) are
  // public, not secrets, and the base64 char class includes '/' so a URL path
  // reads as one long blob. Secrets passed in a URL query are still caught by
  // the secret-keyword rule below (api_key=/token=/secret=...).
  { name: 'hex secret (>=32)', re: /\b[A-Fa-f0-9]{32,}\b/, notInUrl: true },
  { name: 'base64 blob (>=40)', re: /\b[A-Za-z0-9+/]{40,}={0,2}\b/, notInUrl: true },
];

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) out.push(...await walk(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

function redact(s) {
  if (s.length <= 4) return '*'.repeat(s.length);
  return s.slice(0, 2) + '*'.repeat(Math.min(s.length - 4, 8)) + s.slice(-2);
}

const files = await walk(join(root, 'tariffs'));
const hits = [];

for (const f of files) {
  const rel = relative(root, f).split('\\').join('/');
  const lines = (await readFile(f, 'utf8')).split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      const target = rule.notInUrl ? line.replace(/https?:\/\/[^\s"']+/g, ' ') : line;
      const m = rule.re.exec(target);
      if (m) hits.push({ rel, line: i + 1, rule: rule.name, snippet: redact(m[0]) });
    }
  });
}

if (hits.length) {
  console.error(`✗ PII scan found ${hits.length} suspected personal-data match(es):`);
  for (const h of hits) console.error(`  - ${h.rel}:${h.line}  [${h.rule}]  "${h.snippet}"`);
  console.error('\nPlan STRUCTURES are public, but account/meter/identity data is not.');
  console.error('Remove it. If this is a false positive, refactor the value (e.g. don\'t put a 10+ digit code in notes).');
  process.exit(1);
}
console.log(`✓ PII scan clean across ${files.length} tariff file(s).`);
