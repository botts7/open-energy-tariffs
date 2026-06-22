// Shared, pure helpers for all importers (CDR, Octopus, URDB, ...).
// Keep importer-specific mapping in each importer's map.mjs; put anything reused
// across importers here. No I/O, no source-specific shapes.

/**
 * Map a band's source label to the audience-neutral SEMANTIC role used by app
 * logic (colouring, sorting, cost comparison). Matches only unambiguous semantic
 * words across languages; rank words like "High"/"Low"/"Mid" are left undefined
 * for the rate-rank fallback in assignRoles(). Returns undefined if unknown.
 */
export function bandRole(name, id = '') {
  const s = `${name} ${id}`.toLowerCase();
  if (/control|controlled\s*load|\bcl\d?\b/.test(s)) return 'controlled';
  if (/off.?peak|super.?off|\bnight\b|離峰|creuses|\bhc\b|solar\s*(sponge|soak)|\bfree\b/.test(s)) return 'offpeak';
  if (/shoulder|half.?peak|半尖峰|partial.?peak/.test(s)) return 'shoulder';
  if (/\bpeak\b|尖峰|pleines|\bhp\b|on.?peak/.test(s)) return 'peak';
  return undefined;
}

/**
 * Assign `role` to each band (mutates + returns). Prefers the source semantic word
 * (bandRole); otherwise falls back to RATE RANK — cheapest=offpeak, dearest=peak,
 * any middle=shoulder — which is the economic meaning of the tiers and handles
 * rank-named bands (e.g. DK Low/High/Peak). Single-band sets are left untouched.
 */
export function assignRoles(bands) {
  if (!Array.isArray(bands) || bands.length === 0) return bands;
  const rates = [...new Set(bands.map((b) => Number(b.rate) || 0))].sort((a, b) => a - b);
  const n = rates.length;
  const rankRole = (rate) => {
    if (n <= 1) return undefined;
    const i = rates.indexOf(Number(rate) || 0);
    return i === 0 ? 'offpeak' : i === n - 1 ? 'peak' : 'shoulder';
  };
  for (const b of bands) {
    const role = bandRole(b.name, b.id) || rankRole(b.rate);
    if (role) b.role = role;
  }
  return bands;
}

/** kebab-case slug for ids/paths. */
export function slug(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Parse a number (handles money strings like "0.0800"); undefined if not finite. */
export function money(v) {
  if (v == null) return undefined;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
}

/** Round to `dp` decimal places (kills float noise from unit conversions). */
export function round(n, dp = 5) {
  const f = 10 ** dp;
  return Math.round(Number(n) * f) / f;
}

/** "0700" | "07:00" | "07:00:00" -> "HH:MM". A 00:00 END boundary -> "24:00". */
export function toHHMM(v, { isEnd = false } = {}) {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (digits.length < 4) return undefined;
  const out = `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
  return isEnd && out === '00:00' ? '24:00' : out;
}

const hh = (n) => `${String(n).padStart(2, '0')}:00`;

/**
 * Run-length-encode a 24-slot array of band ids (index = hour 0..23) into
 * contiguous {from,to,band} intervals. Used by hour-matrix sources (URDB).
 */
export function hoursToIntervals(hourBands) {
  const out = [];
  let start = 0;
  for (let h = 1; h <= 24; h++) {
    if (h === 24 || hourBands[h] !== hourBands[start]) {
      out.push({ from: hh(start), to: h === 24 ? '24:00' : hh(h), band: hourBands[start] });
      start = h;
    }
  }
  return out;
}

/**
 * Given one band window [from,to] within a day, return the complementary
 * intervals for the "other" band (no midnight wrap; from < to). Used to fill the
 * day band around a night/EV window (Octopus E7/Go).
 */
export function dayComplement({ from, to }, otherBand) {
  const out = [];
  if (from !== '00:00') out.push({ from: '00:00', to: from, band: otherBand });
  if (to !== '24:00') out.push({ from: to, to: '24:00', band: otherBand });
  return out;
}
