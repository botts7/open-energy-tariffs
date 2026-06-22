// Fetch + normalise Danish "DatahubPricelist" records from Energi Data Service
// into the record shape map.mjs expects. No auth, no version header.
//
//   https://api.energidataservice.dk/dataset/DatahubPricelist
//
// We want the per-kWh NETWORK tariff rows (ChargeType "D03" = Tarif) that carry
// 24 hourly columns Price1..Price24 (DKK/kWh). Subscription/abonnement rows are a
// different ChargeType and are skipped (no hourly prices).
//
// ⚠️ Authored from the documented dataset shape — confirm the current field names
// (ChargeOwner / Description / ValidFrom / Price1..24) against a live response.
// Uses global fetch (Node >= 18).

const BASE = 'https://api.energidataservice.dk/dataset/DatahubPricelist';

/** Pull Price1..Price24 into a 0-indexed array; null if any hour is missing. */
function hourlyPrices(rec) {
  const out = [];
  for (let h = 1; h <= 24; h++) {
    const v = rec[`Price${h}`];
    if (v == null || v === '') return null;
    out.push(Number(v));
  }
  return out;
}

/** Normalise raw API records into map.mjs records (only 24-hour tariff rows). */
export function normaliseRecords(records) {
  const out = [];
  for (const r of records) {
    const prices = hourlyPrices(r);
    if (!prices) continue;
    out.push({
      chargeOwner: r.ChargeOwner,
      chargeOwnerShort: (r.ChargeOwner || '').replace(/\s+(A\/S|ApS)$/i, ''),
      description: r.Description || r.Note,
      chargeTypeCode: r.ChargeTypeCode,
      validFrom: r.ValidFrom,
      prices,
    });
  }
  return out;
}

/**
 * Fetch DatahubPricelist tariff rows.
 * @param {object} [opts] { chargeType:'D03', limit:500, filter:{...} }
 */
export async function fetchPricelist({ chargeType = 'D03', limit = 500, filter } = {}) {
  const f = JSON.stringify(filter || { ChargeType: [chargeType] });
  const url = `${BASE}?limit=${limit}&filter=${encodeURIComponent(f)}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`EDS ${res.status} ${res.statusText} for ${url}`);
  const body = await res.json();
  return normaliseRecords(body?.records ?? []);
}
