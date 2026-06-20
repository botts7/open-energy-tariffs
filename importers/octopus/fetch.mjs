// On-device fetch for the Octopus Energy public API (no auth for product data).
// Uses global fetch (Node >= 18 / browser). Side-effects: network only.
const BASE = 'https://api.octopus.energy/v1';

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Octopus ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** List products (paginated). Returns the array across pages. */
export async function fetchProducts({ isVariable, isGreen } = {}) {
  const out = [];
  let url = `${BASE}/products/`;
  const qs = new URLSearchParams();
  if (isVariable != null) qs.set('is_variable', String(isVariable));
  if (isGreen != null) qs.set('is_green', String(isGreen));
  if ([...qs].length) url += `?${qs}`;
  while (url) {
    const body = await getJson(url);
    out.push(...(body.results || []));
    url = body.next || null;
  }
  return out;
}

/** Full product detail incl. per-GSP tariffs. */
export function fetchProduct(code) {
  return getJson(`${BASE}/products/${encodeURIComponent(code)}/`);
}
