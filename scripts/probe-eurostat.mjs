// CI probe: dump nrg_pc_204 valid dimension codes (Eurostat is CI-reachable).
const u = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204?format=JSON&geo=DE";
const r = await fetch(u, { signal: AbortSignal.timeout(40000) });
console.log("status", r.status);
if (r.ok) {
  const j = await r.json();
  console.log("dims:", (j.id||[]).join(","));
  for (const d of ['nrg_cons','siec','freq']) {
    if (j.dimension?.[d]) console.log(`${d}:`, Object.keys(j.dimension[d].category.index).join(","));
  }
  console.log("times:", Object.keys(j.dimension.time.category.index).slice(-3).join(","));
} else { console.log("body:", (await r.text()).slice(0,400)); }
