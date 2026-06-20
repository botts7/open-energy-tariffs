// Thin fetch wrapper for the AU-CDR (AER) energy generic-plans PRD endpoints.
// No auth required; the CDR API versioning header `x-v` IS required.
//
// Base URI: per-retailer under the AER host, e.g.
//   https://cdr.energymadeeasy.gov.au/<retailer>
// Discover the list from the AER "Energy Retailer Base URIs and CDR Brands"
// (see ../../SOURCES.md) or github.com/jxeeno/energy-cdr-prd-endpoints.
//
// Uses global fetch (Node >= 18). Pure-ish: only does network I/O.

// CDR API versioning differs per endpoint: Get Generic Plans = x-v:1,
// Get Generic Plan Detail = x-v:3 (a lower version returns 406).
async function getJson(url, xv) {
  const res = await fetch(url, { headers: { 'x-v': String(xv), accept: 'application/json' } });
  if (!res.ok) throw new Error(`CDR ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** List generic plans. Returns the full array across pages. */
export async function fetchPlans(baseUri, { fuelType = 'ELECTRICITY', effective = 'CURRENT', pageSize = 1000 } = {}) {
  const base = baseUri.replace(/\/$/, '');
  const plans = [];
  let page = 1;
  for (;;) {
    const u = `${base}/cds-au/v1/energy/plans?fuelType=${fuelType}&effective=${effective}&page=${page}&page-size=${pageSize}`;
    const body = await getJson(u, 1);
    const batch = body?.data?.plans ?? [];
    plans.push(...batch);
    const total = body?.meta?.totalPages ?? 1;
    if (page >= total || batch.length === 0) break;
    page += 1;
  }
  return plans;
}

/** Fetch one plan's full detail (rate structure). */
export async function fetchPlanDetail(baseUri, planId) {
  const base = baseUri.replace(/\/$/, '');
  const body = await getJson(`${base}/cds-au/v1/energy/plans/${encodeURIComponent(planId)}`, 3);
  return body?.data ?? body;
}
