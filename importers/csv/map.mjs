// Generic CSV -> canonical importer: bulk-add (flat) plans from a spreadsheet.
// Columns (header row):
//   country,provider,plan,currency           (required)
//   region,timezone,source,license,updated   (optional; defaults manual/CC0-1.0)
//   flatRate,supplyDaily                      (flat tariff + daily supply)
//   national,postcodes,notes                  (coverage + notes; postcodes ';'-sep)
// Time-of-use plans are richer than a flat CSV row -> author those as JSON.
import { slug } from '../_lib/canonical.mjs';

// Minimal RFC-4180-ish CSV parser (quotes, escaped quotes, commas in quotes).
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = (rows.shift() || []).map((h) => h.trim());
  return rows.filter((r) => r.some((v) => v !== '')).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] || '').trim(); });
    return o;
  });
}

const TZ = {
  AU: 'Australia/Sydney', GB: 'Europe/London', US: 'America/New_York', FR: 'Europe/Paris',
  CA: 'America/Toronto', SG: 'Asia/Singapore', ZA: 'Africa/Johannesburg', ES: 'Europe/Madrid',
  JP: 'Asia/Tokyo', BR: 'America/Sao_Paulo', NZ: 'Pacific/Auckland',
};
const truthy = (v) => /^(1|true|yes|y)$/i.test(String(v || '').trim());

/** Map one CSV row to a canonical (flat) entry. */
export function mapRow(row, opts = {}) {
  for (const k of ['country', 'provider', 'plan', 'currency']) {
    if (!row[k]) throw new Error(`CSV row missing required column: ${k}`);
  }
  const country = row.country.toUpperCase();
  const region = row.region || '';
  const source = row.source || 'manual';
  const id = [country, region, row.provider, row.plan].filter(Boolean).map(slug).filter(Boolean).join('-');

  const tariff = { kind: 'flat', import: { flatRate: Number(row.flatRate) || 0 } };
  if (row.supplyDaily) tariff.supply = { daily: Number(row.supplyDaily) };

  const coverage = {};
  if (truthy(row.national)) coverage.national = true;
  if (row.postcodes) coverage.postcodes = row.postcodes.split(';').map((p) => p.trim()).filter(Boolean);

  const meta = {
    id,
    schemaVersion: '1',
    country,
    ...(region ? { region } : {}),
    provider: row.provider,
    plan: row.plan,
    currency: row.currency.toUpperCase(),
    unit: 'kWh',
    timezone: row.timezone || TZ[country] || 'UTC',
    source,
    ...(row.sourceUrl ? { sourceUrl: row.sourceUrl } : {}),
    license: row.license || (source === 'cdr' ? 'CC-BY-4.0' : 'CC0-1.0'),
    updated: row.updated || opts.updated || '1970-01-01',
    verified: false,
    notes: row.notes || 'Imported from CSV.',
    ...(Object.keys(coverage).length ? { coverage } : {}),
  };
  return { meta, tariff };
}

/** Map a whole CSV string into canonical entries. */
export function mapCsv(text, opts = {}) {
  return parseCsv(text).map((r) => mapRow(r, opts));
}
