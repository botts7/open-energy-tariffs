// Fetch the latest Dutch household electricity price from CBS StatLine 85592NED
// (OData). Incl. VAT, standard contract. CI-only: CBS is reachable from GitHub
// runners but blocked from the dev sandbox — so this runs via the import-data
// workflow, not locally. Uses global fetch (Node >= 18).
//
// Electricity fields (the _7.._15 group; _1.._6 are gas):
//   Transporttarief_7                       network transport            €/year
//   VastLeveringstariefVasteEnVar_8         fixed supply (fixed+var)     €/year
//   VariabelLeveringstariefContractprijs_9  variable energy (contract)   €/kWh
//   OpslagDuurzameEnergieODE_13             renewable surcharge (ODE)    €/kWh
//   Energiebelasting_14                     energy tax                   €/kWh
//   VerminderingEnergiebelasting_15         energy-tax rebate            €/year (neg)
//   VariabelLeveringstariefDynamisch_12     variable energy (dynamic)    €/kWh

const BASE = 'https://opendata.cbs.nl/ODataApi/odata/85592NED';

async function odata(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`CBS ${r.status} ${r.statusText} for ${path}`);
  return (await r.json()).value;
}

/** Fetch the latest monthly, incl-VAT electricity record. */
export async function fetchCbsNl() {
  // The Btw (VAT) dimension: pick the "inclusief btw" code (consumer price).
  const btw = await odata('/Btw?$format=json');
  const incl = (btw.find((b) => /inclusief|incl/i.test(b.Title || '')) || btw[btw.length - 1] || {}).Key;
  if (!incl) throw new Error('CBS: could not resolve incl-VAT Btw code');

  // CBS OData v3 ignores $orderby, so fetch all rows for that VAT code and pick the
  // latest MONTHLY period in JS (string compare on "YYYYMMnn" works).
  const rows = await odata(`/TypedDataSet?$format=json&$filter=${encodeURIComponent(`Btw eq '${incl}'`)}&$top=100000`);
  const monthly = rows.filter((x) => /\dMM\d/.test(x.Perioden)).sort((a, b) => String(b.Perioden).localeCompare(String(a.Perioden)));
  const r = monthly[0] || rows[rows.length - 1];
  if (!r) throw new Error('CBS: no rows returned');
  console.log(`CBS-NL: latest monthly period = ${r.Perioden} (of ${rows.length} rows)`);

  return {
    period: r.Perioden,
    energy: r.VariabelLeveringstariefContractprijs_9,
    ode: r.OpslagDuurzameEnergieODE_13,
    energyTax: r.Energiebelasting_14,
    transport: r.Transporttarief_7,
    fixedSupply: r.VastLeveringstariefVasteEnVar_8,
    taxRebate: r.VerminderingEnergiebelasting_15,
    dynamicVar: r.VariabelLeveringstariefDynamisch_12,
  };
}
