// Fetch Icelandic household electricity prices from Statistics Iceland (Hagstofa)
// PxWeb table IDN02303 (JSON-stat2). One entry per household consumption band,
// all-taxes-included, ISK/kWh. No auth.
//
//   https://px.hagstofa.is/pxen/api/v1/en/Umhverfi/4_orkumal/1_orkuverdogkostnadur/IDN02303.px
//
// NOTE: Hagstofa's English series ends ~2022; Iceland's hydro/geothermal market is
// stable so it stays broadly representative, but the period is on every entry.
// Licence: CC-BY 4.0 (Statistics Iceland). Uses global fetch (Node >= 18).

const TABLE = 'https://px.hagstofa.is/pxen/api/v1/en/Umhverfi/4_orkumal/1_orkuverdogkostnadur/IDN02303.px';

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

export async function fetchIceland() {
  const meta = await (await fetch(TABLE, { signal: AbortSignal.timeout(30000) })).json();
  const find = (re) => meta.variables.find((v) => re.test(v.text) || re.test(v.code));
  const land = find(/country/i), band = find(/range/i), tid = find(/year/i), tax = find(/tax/i), cur = find(/currency/i);

  // Sort the year codes and take the max — don't rely on PxWeb ordering.
  const latest = [...tid.values].sort().at(-1);
  const isCode = land.values[land.valueTexts.findIndex((t) => /iceland/i.test(t))];
  const inclTax = tax.values[tax.valueTexts.findIndex((t) => /all taxes and fees included/i.test(t))];
  const nac = cur.values[cur.valueTexts.findIndex((t) => /^NAC$/i.test(t))] || 'NAC';
  const labelOf = {}; band.values.forEach((v, i) => { labelOf[v] = band.valueTexts[i]; });

  const query = {
    query: [
      { code: land.code, selection: { filter: 'item', values: [isCode] } },
      { code: band.code, selection: { filter: 'item', values: band.values } },
      { code: tid.code, selection: { filter: 'item', values: [latest] } },
      { code: tax.code, selection: { filter: 'item', values: [inclTax] } },
      { code: cur.code, selection: { filter: 'item', values: [nac] } },
    ],
    response: { format: 'json-stat2' },
  };
  const r = await fetch(TABLE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(query), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Hagstofa ${r.status} ${r.statusText}`);
  const js = await r.json();
  const at = jsonStatLookup(js);

  return band.values.map((code) => ({
    code,
    label: labelOf[code],
    period: latest,
    priceIsk: at({ [land.code]: isCode, [band.code]: code, [tid.code]: latest, [tax.code]: inclTax, [cur.code]: nac }),
  })).filter((x) => x.priceIsk != null);
}
