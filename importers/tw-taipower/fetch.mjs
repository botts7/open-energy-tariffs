// Fetch + parse the official Taipower machine-readable rate table (簡要電價表) and
// extract the residential simplified TIME-OF-USE tariff into the record shape
// map.mjs expects. No auth. Reproducible — re-running picks up rate changes.
//
//   https://service.taipower.com.tw/data/opendata/apply/file/d007008/001.json
//   (data.gov.tw dataset 17060 -> "台灣電力公司_簡要電價表", JSON)
//
// The JSON's data["簡易型時間電價(二段式)"] holds the two-section residential ToU:
// 基本電費 (basic monthly charge), 流動電費 (energy) split 週一至週五 (Mon-Fri) /
// 週六日 (weekend), 尖峰/離峰 (peak/off-peak), 夏月/非夏月 (summer/non-summer),
// each with 時段 (time window) + 單價 (NT$/kWh). Uses global fetch (Node >= 18).

export const TW_RATE_JSON =
  'https://service.taipower.com.tw/data/opendata/apply/file/d007008/001.json';

const TWO = '簡易型時間電價(二段式)';

/** "06:00~11:00/14:00~24:00" -> [{from:'06:00',to:'11:00'},{from:'14:00',to:'24:00'}] */
export function parseWindows(s) {
  if (!s || /全日/.test(s)) return [];
  return String(s).split('/').map((seg) => {
    const m = /(\d{1,2}:\d{2})\s*[~\-—]\s*(\d{1,2}:\d{2})/.exec(seg.trim());
    if (!m) return null;
    const pad = (t) => { const [h, mi] = t.split(':'); return `${h.padStart(2, '0')}:${mi}`; };
    return { from: pad(m[1]), to: pad(m[2]) };
  }).filter(Boolean);
}

/** Extract the two-section residential ToU record from the Taipower JSON. */
export function extractTwoSection(json) {
  const d = (json.data || {})[TWO];
  if (!d) throw new Error(`Taipower JSON missing "${TWO}"`);
  const basic = d['基本電費']?.['按戶計收']?.['單價'];
  const wk = d['流動電費']?.['週一至週五'];
  const sPeak = wk?.['尖峰時間']?.['夏月'];
  const nsPeak = wk?.['尖峰時間']?.['非夏月'];
  const sOff = wk?.['離峰時間']?.['夏月'];
  const nsOff = wk?.['離峰時間']?.['非夏月'];
  if (!sPeak || !nsPeak || !sOff || !nsOff) throw new Error('Taipower JSON: unexpected ToU shape');

  return {
    scheme: 'two-section',
    summer: { peakRate: Number(sPeak['單價']), offpeakRate: Number(sOff['單價']) },
    nonSummer: { peakRate: Number(nsPeak['單價']), offpeakRate: Number(nsOff['單價']) },
    // v1 has ONE schedule; use the non-summer windows (8 months of the year) as
    // canonical and record the differing summer window for the note.
    peakWindows: parseWindows(nsPeak['時段']),
    summerPeakWindow: sPeak['時段'] !== nsPeak['時段'] ? String(sPeak['時段']).replace(/~/g, '–') : null,
    basicMonthly: Number(basic),
    effectiveFrom: (json.metadata || {})['實施日期'],
  };
}

/** Fetch the live Taipower rate JSON and return the two-section record. */
export async function fetchTaipowerTou(url = TW_RATE_JSON) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Taipower ${r.status} ${r.statusText} for ${url}`);
  return extractTwoSection(await r.json());
}
