// Fetch the Norwegian household electricity price from Statistics Norway (SSB)
// StatBank table 09387 (PxWeb JSON-stat2). One national-average entry, all-in
// NET price (after the government electricity support), with the breakdown. No auth.
//
//   https://data.ssb.no/api/v0/en/table/09387
//
// Licence: NLOD (Norwegian Licence for Open Government Data) — open + commercial,
// attribution. Uses global fetch (Node >= 18).

const TABLE = 'https://data.ssb.no/api/v0/en/table/09387';

// Stable SSB content codes (øre/kWh unless noted).
const CODES = {
  net: 'KraftOgNettIUStrSt',  // total incl. taxes, gov support deducted (what's PAID)
  gross: 'KraftOgNettIA',     // total incl. taxes (before support)
  elec: 'KraftprisIA',        // electricity incl. taxes
  grid: 'NettleieIA',         // grid rent incl. taxes
  support: 'StoetteMyndighet', // government electricity support
  tax: 'ForbrAvgKraft',       // electricity consumption tax
};

/** json-stat2 value lookup by {dimCode: categoryCode}. */
function jsonStatLookup(js) {
  const ids = js.id, size = js.size, stride = new Array(ids.length);
  stride[ids.length - 1] = 1;
  for (let i = ids.length - 2; i >= 0; i--) stride[i] = stride[i + 1] * size[i + 1];
  return (sel) => {
    let idx = 0;
    for (let i = 0; i < ids.length; i++) {
      const pos = js.dimension[ids[i]].category.index[sel[ids[i]]];
      if (pos == null) return undefined;
      idx += pos * stride[i];
    }
    return js.value[idx];
  };
}

export async function fetchNorway() {
  const meta = await (await fetch(TABLE, { signal: AbortSignal.timeout(30000) })).json();
  const tid = meta.variables.find((v) => v.code === 'Tid');
  const latest = tid.values[tid.values.length - 1];

  const query = {
    query: [
      { code: 'ContentsCode', selection: { filter: 'item', values: Object.values(CODES) } },
      { code: 'Tid', selection: { filter: 'item', values: [latest] } },
    ],
    response: { format: 'json-stat2' },
  };
  const r = await fetch(TABLE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(query), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`SSB ${r.status} ${r.statusText}`);
  const js = await r.json();
  const at = jsonStatLookup(js);
  const v = (code) => at({ ContentsCode: code, Tid: latest });

  return {
    period: latest,
    net: v(CODES.net),
    gross: v(CODES.gross),
    elec: v(CODES.elec),
    grid: v(CODES.grid),
    support: v(CODES.support),
    tax: v(CODES.tax),
  };
}
