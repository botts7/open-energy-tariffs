// Shared, pure helpers for all importers (CDR, Octopus, URDB, ...).
// Keep importer-specific mapping in each importer's map.mjs; put anything reused
// across importers here. No I/O, no source-specific shapes.

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
