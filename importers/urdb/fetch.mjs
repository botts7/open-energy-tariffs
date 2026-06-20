// Fetch wrapper for the OpenEI URDB API.
// Needs a free api.data.gov / OpenEI API key (env URDB_API_KEY) — DO NOT hardcode
// or commit it. CI provides it as a secret.
const BASE = 'https://api.openei.org/utility_rates';

function apiKey() {
  const k = process.env.URDB_API_KEY;
  if (!k) throw new Error('URDB_API_KEY env var is required (free key from api.data.gov)');
  return k;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`URDB ${res.status} ${res.statusText}`);
  return res.json();
}

/** Fetch rate items (detail=full). Filter e.g. by `ratesforutility` or `address`. */
export async function fetchRates({ limit = 50, sector = 'Residential', getpage, ratesforutility } = {}) {
  const qs = new URLSearchParams({
    version: 'latest', format: 'json', api_key: apiKey(),
    detail: 'full', limit: String(limit), sector,
  });
  if (getpage) qs.set('getpage', getpage);
  if (ratesforutility) qs.set('ratesforutility', ratesforutility);
  const body = await getJson(`${BASE}?${qs}`);
  return body.items || [];
}
