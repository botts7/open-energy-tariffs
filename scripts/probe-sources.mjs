// CI experiment: are these permissive sources reachable from a GitHub runner
// (they fail at connection-level from the dev sandbox)? If so, dump structure.
const T = [
  ['CBS-NL 85592NED', 'https://opendata.cbs.nl/ODataApi/odata/85592NED/TypedDataSet?$top=2&$format=json'],
  ['CBS-NL meta',      'https://opendata.cbs.nl/ODataApi/odata/85592NED/DataProperties?$format=json'],
];
for (const [label, url] of T) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
    console.log(`\n### ${label}: HTTP ${r.status}`);
    if (r.ok) { const b = await r.json(); console.log(JSON.stringify(b).slice(0, 1200)); }
  } catch (e) { console.log(`\n### ${label}: ERR ${e.message}`); }
}
