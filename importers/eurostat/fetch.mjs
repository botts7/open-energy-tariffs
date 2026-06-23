// Fetch household electricity prices for ALL EU/EFTA countries from Eurostat
// nrg_pc_204 (band DC = 2 500–5 000 kWh, all taxes included, EUR/kWh). One national-
// average entry per country. CI-only: Eurostat is reachable from GitHub runners but
// blocked from the dev sandbox — runs via the import-data workflow.
//
//   https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204
//
// Licence: CC-BY 4.0 (Eurostat / European Union). Uses global fetch (Node >= 18).

const API = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204';
const PARAMS = '?format=JSON&consom=4161901&unit=KWH&currency=EUR&tax=I_TAX';

// Eurostat geo -> ISO 3166-1 alpha-2 (most already match).
const GEO_FIX = { EL: 'GR', UK: 'GB' };

/**
 * Parse a Eurostat JSON (json-stat-ish) response into per-country latest records.
 * Pure — unit-tested with a synthetic fixture.
 * @returns {Array<{country, price, period}>}  price in EUR/kWh
 */
export function parseEurostat(json) {
  const ids = json.id, size = json.size, dim = json.dimension, value = json.value || {};
  const stride = {};
  let s = 1;
  for (let i = ids.length - 1; i >= 0; i--) { stride[ids[i]] = s; s *= size[i]; }

  const geoIdx = dim.geo.category.index;
  const timeIdx = dim.time.category.index;
  const times = Object.keys(timeIdx).sort(); // ascending; latest last

  const out = [];
  for (const [geo, gpos] of Object.entries(geoIdx)) {
    if (!/^[A-Z]{2}$/.test(geo)) continue;       // skip EU27_2020, EA, etc.
    for (let t = times.length - 1; t >= 0; t--) {
      const idx = gpos * stride.geo + timeIdx[times[t]] * stride.time;
      const v = value[String(idx)];
      if (v != null) { out.push({ country: GEO_FIX[geo] || geo, price: v, period: times[t] }); break; }
    }
  }
  return out;
}

export async function fetchEurostat() {
  const r = await fetch(API + PARAMS, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(40000) });
  if (!r.ok) throw new Error(`Eurostat ${r.status} ${r.statusText}`);
  return parseEurostat(await r.json());
}
