// Fetch helpers for the Taipower rate tables on data.gov.tw (datasets 17052 /
// 17060). No auth.
//
// ⚠️ Unlike the CDR/EDS APIs, these are flat RATE TABLES (Chinese headers), not a
// per-plan record feed — the optional time-of-use residential schedule (summer vs
// non-summer peak/off-peak per-kWh + the peak time windows + monthly basic charge)
// is best assembled BY HAND from the published rate sheet into the normalised
// record shape map.mjs expects (see fixtures/*.sample.json). This module just
// pulls the CSV so a human/CI step can read the current numbers off it.
//
// Uses global fetch (Node >= 18).

/** Direct CSV resource for dataset 17052 (confirm the current resource id). */
export const TW_TOU_CSV = 'https://data.gov.tw/api/v2/rest/datastore/A07007-001';

/** Minimal CSV parse into row objects (comma-delimited, UTF-8). */
export function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

/** Fetch the raw CSV text for inspection / hand-mapping. */
export async function fetchCsv(url = TW_TOU_CSV) {
  const res = await fetch(url, { headers: { accept: 'text/csv' } });
  if (!res.ok) throw new Error(`data.gov.tw ${res.status} ${res.statusText} for ${url}`);
  return res.text();
}
