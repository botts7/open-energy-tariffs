// Fetch + parse the official Taipower machine-readable rate table (簡要電價表) and
// extract the residential simplified TIME-OF-USE tariffs (two- and three-section)
// into the generic band-record shape map.mjs expects. No auth. Reproducible —
// re-running picks up rate changes.
//
//   https://service.taipower.com.tw/data/opendata/apply/file/d007008/001.json
//   (data.gov.tw dataset 17060 -> "台灣電力公司_簡要電價表", JSON)
//
// Source structure (per scheme): 基本電費 (basic monthly), 流動電費 (energy) split
// 週一至週五 (Mon-Fri) / 週六日 (weekend), bands 尖峰/半尖峰/離峰 (peak/half-peak/
// off-peak), each 夏月/非夏月 (summer/non-summer) with 時段 (window) + 單價 (NT$/kWh).
// Uses global fetch (Node >= 18).

export const TW_RATE_JSON =
  'https://service.taipower.com.tw/data/opendata/apply/file/d007008/001.json';

const TWO = '簡易型時間電價(二段式)';
const THREE = '簡易型時間電價(三段式)';

/** "06:00~11:00/14:00~24:00" -> [{from,to},...]; [] for 全日 / missing. */
export function parseWindows(s) {
  if (!s || /全日/.test(s)) return [];
  return String(s).split('/').map((seg) => {
    const m = /(\d{1,2}:\d{2})\s*[~\-—]\s*(\d{1,2}:\d{2})/.exec(seg.trim());
    if (!m) return null;
    const pad = (t) => { const [h, mi] = t.split(':'); return `${h.padStart(2, '0')}:${mi}`; };
    return { from: pad(m[1]), to: pad(m[2]) };
  }).filter(Boolean);
}

const fmt = (s) => String(s ?? '').replace(/~/g, '–');
const basicOf = (d) => Number(d?.['基本電費']?.['按戶計收']?.['單價']);
const wkOf = (d) => d?.['流動電費']?.['週一至週五'];

/** Two-section: peak / off-peak. Canonical = non-summer windows (8 months). */
export function extractTwoSection(json, effectiveFrom) {
  const wk = wkOf((json.data || {})[TWO]);
  const sP = wk?.['尖峰時間']?.['夏月']; const nsP = wk?.['尖峰時間']?.['非夏月'];
  const sO = wk?.['離峰時間']?.['夏月']; const nsO = wk?.['離峰時間']?.['非夏月'];
  if (!sP || !nsP || !sO || !nsO) throw new Error('Taipower JSON: unexpected two-section shape');
  return {
    scheme: 'two-section',
    bands: [
      { id: 'peak', name: 'Peak', rate: Number(nsP['單價']), summerRate: Number(sP['單價']), windows: parseWindows(nsP['時段']) },
      { id: 'offpeak', name: 'Off-peak', rate: Number(nsO['單價']), summerRate: Number(sO['單價']) },
    ],
    summerPeakWindow: sP['時段'] !== nsP['時段'] ? fmt(sP['時段']) : null,
    basicMonthly: basicOf((json.data || {})[TWO]),
    effectiveFrom,
  };
}

/**
 * Three-section: peak / half-peak / off-peak. Peak exists only in SUMMER, so the
 * summer windows are canonical and each band's non-summer rate is the rate that
 * window actually carries in winter (peak window -> non-summer half-peak; etc).
 */
export function extractThreeSection(json, effectiveFrom) {
  const wk = wkOf((json.data || {})[THREE]);
  const sPeak = wk?.['尖峰時間']?.['夏月'];
  const sHalf = wk?.['半尖峰時間']?.['夏月']; const nsHalf = wk?.['半尖峰時間']?.['非夏月'];
  const sOff = wk?.['離峰時間']?.['夏月']; const nsOff = wk?.['離峰時間']?.['非夏月'];
  if (!sPeak || !sHalf || !nsHalf || !sOff || !nsOff) throw new Error('Taipower JSON: unexpected three-section shape');
  const nsHalfRate = Number(nsHalf['單價']);
  return {
    scheme: 'three-section',
    bands: [
      // peak window is half-peak in winter -> default (non-summer) = non-summer half-peak
      { id: 'peak', name: 'Peak', rate: nsHalfRate, summerRate: Number(sPeak['單價']), windows: parseWindows(sPeak['時段']) },
      { id: 'shoulder', name: 'Half-peak', rate: nsHalfRate, summerRate: Number(sHalf['單價']), windows: parseWindows(sHalf['時段']) },
      { id: 'offpeak', name: 'Off-peak', rate: Number(nsOff['單價']), summerRate: Number(sOff['單價']) },
    ],
    noteSuffix: `Non-summer (Oct–May) has no peak band and uses different windows; v1 has one schedule, so the summer windows are canonical (peak ${fmt(sPeak['時段'])}, half-peak ${fmt(sHalf['時段'])}). Each band carries its summer/non-summer RATE via band.seasonRates — in winter the peak/half-peak windows are charged the non-summer half-peak rate, so window boundaries are approximate while the rates are the published values.`,
    basicMonthly: basicOf((json.data || {})[THREE]),
    effectiveFrom,
  };
}

/** Fetch the live Taipower rate JSON and return both ToU records. */
export async function fetchTaipowerTou(url = TW_RATE_JSON) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`Taipower ${r.status} ${r.statusText} for ${url}`);
  const json = await r.json();
  const eff = (json.metadata || {})['實施日期'];
  return [extractTwoSection(json, eff), extractThreeSection(json, eff)];
}
