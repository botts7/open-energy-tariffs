// Fetch + normalise the CRE "Tarif réglementé de vente" (EDF Tarif Bleu) open
// data into the record shape map.mjs expects. No auth.
//
// Confirmed against the live CRE files (Feb 2026):
//   Base: DATE_DEBUT;DATE_FIN;P_SOUSCRITE;PART_FIXE_HT;PART_FIXE_TTC;
//         PART_VARIABLE_HT;PART_VARIABLE_TTC
//   HPHC: …;PART_VARIABLE_HC_HT;PART_VARIABLE_HC_TTC;
//         PART_VARIABLE_HP_HT;PART_VARIABLE_HP_TTC
//   - dates are DD/MM/YYYY; prices are €/kWh (TTC = incl. tax); fixed part €/year.
//   - current rows have an empty DATE_FIN; we keep those (latest per power level).
//
// Official CSVs (data.gouv.fr → CRE):
//   https://www.cre.fr/fileadmin/Documents/Open_data/Marches_de_detail/Option_Base.csv
//   https://www.cre.fr/fileadmin/Documents/Open_data/Marches_de_detail/Option_HPHC.csv
//   https://www.cre.fr/fileadmin/Documents/Open_data/Marches_de_detail/Option_Tempo.csv
//
// Uses global fetch (Node >= 18).

export const CSV = {
  BASE: 'https://www.cre.fr/fileadmin/Documents/Open_data/Marches_de_detail/Option_Base.csv',
  HPHC: 'https://www.cre.fr/fileadmin/Documents/Open_data/Marches_de_detail/Option_HPHC.csv',
};

/** Parse a French ';'-delimited CSV (decimal comma) into row objects. */
export function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(';').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(';');
    const row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

const num = (v) => {
  if (v == null || v === '') return undefined;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** "01/02/2026" -> "2026-02-01"; undefined if unparseable. */
function frDate(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((s || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

/**
 * Normalise parsed CSV rows for one option into map.mjs records. Keeps only the
 * CURRENT tariff (empty DATE_FIN), one per subscribed power (latest DATE_DEBUT).
 * @param {object[]} rows parsed rows
 * @param {'BASE'|'HPHC'} option
 * @param {object} [hcWindowsByPower] optional { [kVA]: [{from,to}] } HC windows
 */
export function normaliseRows(rows, option, hcWindowsByPower = {}) {
  const best = new Map(); // puissance -> {row, dd}
  for (const r of rows) {
    if ((r.DATE_FIN || '').trim()) continue; // not the current tariff
    const p = num(r.P_SOUSCRITE);
    if (p == null) continue;
    const dd = frDate(r.DATE_DEBUT);
    const prev = best.get(p);
    if (!prev || (dd || '') > (prev.dd || '')) best.set(p, { row: r, dd });
  }
  return [...best.values()].map(({ row: r, dd }) => {
    const rec = {
      option,
      puissance: num(r.P_SOUSCRITE),
      partFixeAnnuelle: num(r.PART_FIXE_TTC),
      dateDebut: dd,
    };
    if (option === 'HPHC') {
      rec.partVariableHP = num(r.PART_VARIABLE_HP_TTC);
      rec.partVariableHC = num(r.PART_VARIABLE_HC_TTC);
      rec.hcWindows = hcWindowsByPower[rec.puissance] || [{ from: '22:00', to: '06:00' }];
    } else {
      rec.partVariable = num(r.PART_VARIABLE_TTC);
    }
    return rec;
  }).filter((r) => r.puissance != null);
}

/** Fetch a CRE CSV (by option key or explicit URL) and normalise it. */
export async function fetchTrvCsv(optionOrUrl, option, hcWindowsByPower) {
  const url = CSV[optionOrUrl] || optionOrUrl;
  const opt = CSV[optionOrUrl] ? optionOrUrl : option;
  const res = await fetch(url, { headers: { accept: 'text/csv' } });
  if (!res.ok) throw new Error(`CRE ${res.status} ${res.statusText} for ${url}`);
  return normaliseRows(parseCsv(await res.text()), opt, hcWindowsByPower);
}
