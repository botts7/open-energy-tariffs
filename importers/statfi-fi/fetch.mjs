// Fetch Finnish household electricity prices from Statistics Finland (Tilastokeskus)
// StatFin table 13rb (PxWeb JSON-stat2 API). One entry per household consumption
// band, with the energy / distribution / tax breakdown (c/kWh). No auth.
//
//   https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin/ehi/13rb.px
//
// Licence: CC-BY 4.0 (Statistics Finland). Uses global fetch (Node >= 18).

const TABLE = 'https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin/ehi/13rb.px';

/** json-stat2 value lookup by {dimCode: categoryCode}. */
function jsonStatLookup(js) {
  const ids = js.id, size = js.size;
  const stride = new Array(ids.length);
  stride[ids.length - 1] = 1;
  for (let i = ids.length - 2; i >= 0; i--) stride[i] = stride[i + 1] * size[i + 1];
  return (sel) => {
    let idx = 0;
    for (let i = 0; i < ids.length; i++) {
      const code = ids[i];
      const pos = js.dimension[code].category.index[sel[code]];
      if (pos == null) return undefined;
      idx += pos * stride[i];
    }
    return js.value[idx];
  };
}

export async function fetchFinland() {
  const meta = await (await fetch(TABLE, { signal: AbortSignal.timeout(30000) })).json();
  const time = meta.variables.find((v) => /month/i.test(v.text));
  const comp = meta.variables.find((v) => /component/i.test(v.text));
  const cons = meta.variables.find((v) => /consumer/i.test(v.text));
  const latest = time.values[time.values.length - 1];
  const hhCodes = cons.values.filter((_, i) => /^Household/i.test(cons.valueTexts[i]));
  const labelOf = {};
  cons.values.forEach((v, i) => { labelOf[v] = cons.valueTexts[i]; });

  const query = {
    query: [
      { code: time.code, selection: { filter: 'item', values: [latest] } },
      { code: comp.code, selection: { filter: 'item', values: comp.values } },
      { code: cons.code, selection: { filter: 'item', values: hhCodes } },
      { code: 'contentscode', selection: { filter: 'item', values: ['hinta_snt_kwh'] } },
    ],
    response: { format: 'json-stat2' },
  };
  const r = await fetch(TABLE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(query), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`StatFin ${r.status} ${r.statusText}`);
  const js = await r.json();
  const at = jsonStatLookup(js);
  const C = comp.code, K = cons.code;

  return hhCodes.map((code) => ({
    code,
    label: labelOf[code],
    period: latest,                                   // "2026M03"
    energy: at({ [time.code]: latest, [C]: 'A', [K]: code, contentscode: 'hinta_snt_kwh' }),
    distribution: at({ [time.code]: latest, [C]: 'B', [K]: code, contentscode: 'hinta_snt_kwh' }),
    taxes: at({ [time.code]: latest, [C]: 'C', [K]: code, contentscode: 'hinta_snt_kwh' }),
    total: at({ [time.code]: latest, [C]: 'SSS', [K]: code, contentscode: 'hinta_snt_kwh' }),
  })).filter((x) => x.total != null);
}
