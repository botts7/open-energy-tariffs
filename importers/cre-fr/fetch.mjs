// Fetch + normalise the CRE "Tarif réglementé de vente" (EDF Tarif Bleu) open
// data from data.gouv.fr into the record shape map.mjs expects. No auth.
//
// ⚠️ The exact resource URLs and column headers vary by yearly release. The
// column map below is authored from the documented French grid (P_SOUSCRITE,
// PART_FIXE, PART_VARIABLE[_HP|_HC], DATE_DEBUT) — DOWNLOAD a current CSV and
// confirm headers + units before trusting output. CRE price columns are commonly
// in c€/kWh and €/year incl. taxes (TTC); adjust UNIT_DIVISOR if a file differs.
//
// Uses global fetch (Node >= 18).

const UNIT_DIVISOR = { price: 1, fixed: 1 }; // set price:100 if a file is in c€/kWh

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

/**
 * Normalise parsed CSV rows for one option into map.mjs records.
 * @param {object[]} rows parsed rows
 * @param {'BASE'|'HPHC'|'TEMPO'} option
 * @param {object} [hcWindowsByPower] optional { [kVA]: [{from,to}] } HC windows
 */
export function normaliseRows(rows, option, hcWindowsByPower = {}) {
  return rows.map((r) => {
    const puissance = num(r.P_SOUSCRITE ?? r.PUISSANCE ?? r.puissance);
    const partFixe = num(r.PART_FIXE_TTC ?? r.PART_FIXE ?? r.part_fixe);
    const rec = {
      option,
      puissance,
      partFixeAnnuelle: partFixe != null ? partFixe / UNIT_DIVISOR.fixed : undefined,
      dateDebut: (r.DATE_DEBUT ?? r.date_debut ?? '').slice(0, 10) || undefined,
    };
    if (option === 'HPHC') {
      rec.partVariableHP = num(r.PART_VARIABLE_HP) != null ? num(r.PART_VARIABLE_HP) / UNIT_DIVISOR.price : undefined;
      rec.partVariableHC = num(r.PART_VARIABLE_HC) != null ? num(r.PART_VARIABLE_HC) / UNIT_DIVISOR.price : undefined;
      rec.hcWindows = hcWindowsByPower[puissance] || [{ from: '22:00', to: '06:00' }];
    } else {
      rec.partVariable = num(r.PART_VARIABLE ?? r.PART_VARIABLE_TTC) != null
        ? num(r.PART_VARIABLE ?? r.PART_VARIABLE_TTC) / UNIT_DIVISOR.price : undefined;
    }
    return rec;
  }).filter((r) => r.puissance != null);
}

/** Fetch a data.gouv.fr CSV resource and normalise it. */
export async function fetchTrvCsv(resourceUrl, option, hcWindowsByPower) {
  const res = await fetch(resourceUrl, { headers: { accept: 'text/csv' } });
  if (!res.ok) throw new Error(`CRE ${res.status} ${res.statusText} for ${resourceUrl}`);
  return normaliseRows(parseCsv(await res.text()), option, hcWindowsByPower);
}
