// Fetch + normalise Danish "DatahubPricelist" records from Energi Data Service
// into the record shape map.mjs expects. No auth, no version header.
//
//   https://api.energidataservice.dk/dataset/DatahubPricelist
//
// The dataset stores ONE row per (DSO, tariff, validity-period) — heavily
// historical AND future-dated — so a naive fetch returns stale/duplicate rows.
// We want each DSO's CURRENT per-kWh network tariff (ChargeType "D03") that has
// 24 hourly columns Price1..Price24 (DKK/kWh). Strategy:
//   - `end=<today>` caps ValidFrom to today (drops future-dated schedules),
//   - `sort=ValidFrom desc` so the first row we see per tariff is the latest,
//   - page in small batches (large pages get connection-reset) with retry,
//   - keep the first <=today row per (owner, code, note) if it's active + 24h,
//   - stop once ValidFrom drops below `cutoff` (older rows can't be newer).
//
// Uses global fetch (Node >= 18).

const BASE = 'https://api.energidataservice.dk/dataset/DatahubPricelist';

// Pull Price1..Price24 into a 24-slot array. Full hourly set -> the 24 values;
// a single Price1 (flat C tariff) -> 24 copies (map collapses uniform to flat);
// partial/odd rows -> null (skip).
function hourlyPrices(rec) {
  const out = [];
  for (let h = 1; h <= 24; h++) {
    const v = rec[`Price${h}`];
    out.push(v == null || v === '' ? null : Number(v));
  }
  if (out.every((v) => v != null)) return out;
  if (out[0] != null && out.slice(1).every((v) => v == null)) return Array(24).fill(out[0]);
  return null;
}

const short = (owner) => (owner || '').replace(/\s+(A\/S|ApS|A\.m\.b\.a\.?|A\s*M\s*B\s*A)$/i, '').trim();

// Keep only the RESIDENTIAL low-voltage (0,4 kV) net tariff a household pays.
// The authoritative classifier is the Note field: "Nettarif C" = household,
// "Nettarif B/A" = commercial/transmission. Also drop demand charges (effekt),
// self-producer/feed-in (producent/produktion/indfødning), temp reductions
// (midlertidig), discounts (rabat) and upstream/HV (overliggende, 10-150 kV).
export function isConsumerLvHourly(note, desc = '') {
  const n = (note || '').toLowerCase();
  const s = `${n} ${(desc || '').toLowerCase()}`;
  if (/effekt|producent|egenprod|produktion|indf[øo]dning|rabat|midlertidig|neds[æa]ttelse|overliggende|abonnement|r[åa]dighed|nettab|transport\s*betaling/.test(s)) return false;
  // tariff class from Note: B (commercial) / A (transmission) are not residential
  if (/nettarif\s*[ba]\b|\b[ba]\s*(lav|h[øo]j)\b|\b[ba]-?tarif\b/.test(n)) return false;
  // high-voltage connection point, unless it's the 0,4 kV (LV) side
  if (/132|150\s*kv|\b60\s*kv|30-60|10-20\s*kv|\b20\s*kv\b/.test(s) && !/0[.,-]?4\s*kv/.test(s)) return false;
  return /0[.,-]?4\s*kv|\bc\s*(time|flex)\b|nettarif\s*c\b|c[\s-]*kunder|lavsp[æa]nding|timeafl/.test(s);
}

// A short, unique-per-DSO plan name: prefer the Note class ("Nettarif C") plus a
// metering/connection qualifier from the Description, else fall back to the prose.
export function planName(x) {
  const note = (x.Note || '').trim();
  const d = (x.Description || '').toLowerCase();
  let q = '';
  if (/timeafl/.test(d)) q = ' (hourly meter)';
  else if (/[åa]rsafl|rsafl/.test(d)) q = ' (annual meter)';
  if (/siden af/.test(d)) q += ' — transformer side';
  if (note && /nettarif/i.test(note)) return (note + q).trim();
  return x.Description || note || 'Network tariff';
}

async function getPage(off, pageSize, filter, today, attempt = 0) {
  const f = encodeURIComponent(JSON.stringify(filter));
  const url = `${BASE}?limit=${pageSize}&offset=${off}&end=${today}T00:00&sort=${encodeURIComponent('ValidFrom desc')}&filter=${f}`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`EDS ${res.status} ${res.statusText}`);
    const body = await res.json();
    return body?.records ?? [];
  } catch (e) {
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      return getPage(off, pageSize, filter, today, attempt + 1);
    }
    throw e;
  }
}

/** Map a raw EDS record to the map.mjs record shape. */
export function toRecord(x) {
  return {
    chargeOwner: x.ChargeOwner,
    chargeOwnerShort: short(x.ChargeOwner),
    description: planName(x),
    chargeTypeCode: x.ChargeTypeCode,
    validFrom: x.ValidFrom,
    prices: hourlyPrices(x),
  };
}

/**
 * Fetch each DSO's CURRENT 24-hour network tariff.
 * @param {object} [opts] { chargeType:'D03', cutoff:'2019-01-01', pageSize:4000,
 *                          today:'YYYY-MM-DD', onProgress }
 * @returns {Promise<object[]>} normalised records (one per current tariff)
 */
export async function fetchPricelist({
  chargeType = 'D03',
  cutoff = '2019-01-01',
  pageSize = 4000,
  today = new Date().toISOString().slice(0, 10),
  consumerOnly = true,
  onProgress,
} = {}) {
  const filter = { ChargeType: [chargeType] };
  const seen = new Map(); // key -> raw record (latest active 24h) or null (seen, not eligible)
  let off = 0;
  for (;;) {
    const recs = await getPage(off, pageSize, filter, today);
    if (!recs.length) break;
    let belowCutoff = false;
    for (const x of recs) {
      const vf = (x.ValidFrom || '').slice(0, 10);
      if (vf < cutoff) { belowCutoff = true; continue; }
      const key = `${x.ChargeOwner}|${x.ChargeTypeCode}|${x.Note || x.Description || ''}`;
      if (seen.has(key)) continue; // first (latest) <=today row decides
      const vt = (x.ValidTo || '').slice(0, 10);
      const active = !vt || vt > today;
      seen.set(key, active && hourlyPrices(x) ? x : null);
    }
    if (onProgress) onProgress(seen.size, off + recs.length);
    if (belowCutoff) break;
    off += pageSize;
    if (off > 1_000_000) break; // safety backstop
  }
  const out = [];
  for (const x of seen.values()) {
    if (!x) continue;
    if (consumerOnly && !isConsumerLvHourly(x.Note, x.Description)) continue;
    const rec = toRecord(x);
    if (rec.prices) out.push(rec);
  }
  return out;
}

/** Back-compat: normalise an array of raw EDS records (used by tests). */
export function normaliseRecords(records) {
  return records.map(toRecord).filter((r) => r.prices);
}
