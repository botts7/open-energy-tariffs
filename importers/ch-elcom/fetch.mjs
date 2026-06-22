// Fetch Swiss ElCom per-operator household tariffs from the LINDAS SPARQL
// endpoint and normalise them into the record shape map.mjs expects. No auth.
// Reproducible — defaults to the latest period, so re-running self-updates.
//
//   endpoint: https://lindas.admin.ch/query
//   graph:    https://lindas.admin.ch/elcom/electricityprice
//
// The "electricityprice" RDF cube has one observation per (operator, municipality,
// category, product, year). An operator sets one tariff per category, so grouping
// by operator yields one record each. We take category H4 (reference household,
// ~4,500 kWh/yr) and product "standard" (Grundversorgung). Uses global fetch.

const ENDPOINT = 'https://lindas.admin.ch/query';
const GRAPH = 'https://lindas.admin.ch/elcom/electricityprice';
const D = 'https://energy.ld.admin.ch/elcom/electricityprice/dimension';

async function sparql(query) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/sparql-query', accept: 'application/sparql-results+json' },
    body: query,
  });
  if (!r.ok) throw new Error(`LINDAS ${r.status} ${r.statusText}`);
  return (await r.json()).results?.bindings || [];
}

/** Most recent period (year) in the cube. */
export async function latestPeriod() {
  const rows = await sparql(`SELECT (MAX(?p) AS ?m) FROM <${GRAPH}> WHERE { ?o <${D}/period> ?p }`);
  return rows[0]?.m?.value;
}

/**
 * Fetch per-operator household tariffs.
 * @param {object} [opts] { period, category='H4', product='standard' }
 * @returns {Promise<object[]>} records (one per operator)
 */
export async function fetchElcom({ period, category = 'H4', product = 'standard' } = {}) {
  const yr = period || (await latestPeriod());
  // AVG (not SAMPLE) so the result is DETERMINISTIC + reproducible: the all-in
  // total varies by municipality (cantonal/community taxes differ) even for one
  // operator, so we take the operator's mean across its municipalities. The
  // energy/grid/aidfee/fix components are operator-constant, so AVG == value.
  const query = `PREFIX schema: <http://schema.org/>
SELECT ?opName (AVG(?total) AS ?t) (AVG(?energy) AS ?e) (AVG(?grid) AS ?g) (AVG(?aidfee) AS ?a) (AVG(?fix) AS ?f) (COUNT(DISTINCT ?mun) AS ?n)
FROM <${GRAPH}> WHERE {
  ?o <${D}/period> ?period ; <${D}/category> ?cat ; <${D}/product> ?prod ;
     <${D}/operator> ?op ; <${D}/municipality> ?mun ;
     <${D}/total> ?total ; <${D}/energy> ?energy ; <${D}/gridusage> ?grid ;
     <${D}/aidfee> ?aidfee ; <${D}/fixcosts> ?fix .
  FILTER(STR(?period)="${yr}") FILTER(STRENDS(STR(?cat),"/${category}")) FILTER(STRENDS(STR(?prod),"/${product}"))
  ?op schema:name ?opName .
} GROUP BY ?op ?opName`;

  const rows = await sparql(query);
  return rows.map((x) => ({
    operator: x.opName.value.trim(),
    period: yr,
    category,
    totalRp: Number(x.t.value),
    energyRp: Number(x.e.value),
    gridRp: Number(x.g.value),
    aidfeeRp: Number(x.a.value),
    fixCostChf: Number(x.f.value),
    municipalities: Number(x.n.value),
  })).filter((r) => Number.isFinite(r.totalRp) && r.operator);
}
