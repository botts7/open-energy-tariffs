// Pure mapping: OpenEI URDB rate item -> canonical v1 entry.
//
// URDB is CC0 -> output is bulk-storable (source:urdb, license:CC0-1.0) with an
// OpenEI/NREL courtesy citation. URDB has user-submitted entries, so output is
// always verified:false until checked.
//
// Authored from the URDB `energyratestructure` + `energyweekday/weekendschedule`
// model; verify against a real api.openei.org item (see README).
//
// v1 scope: flat + time-of-use. Tiered/block (multiple tiers per period) collapse
// to the first tier (reserved band.tiers[] is the v1.1 home). Demand charges and
// per-month seasonal variation are not modelled yet (a note is added when month
// rows differ).
import { slug, money, round, hoursToIntervals } from '../_lib/canonical.mjs';

const rowsEqual = (rows) => rows.every((r) => JSON.stringify(r) === JSON.stringify(rows[0]));

// URDB splits the per-kWh price into base `rate` + `adj` (riders/adjustments);
// the effective price is their sum. Use the first tier (block tiers = v1.1).
const tierRate = (tier) => round((money(tier?.rate) || 0) + (money(tier?.adj) || 0), 5);

// URDB items carry a country NAME; map to ISO 3166-1 alpha-2 so the importer is
// country-agnostic (works for IURDB international items, not just US URDB).
const COUNTRY_ISO = {
  USA: 'US', 'UNITED STATES': 'US', CANADA: 'CA', MEXICO: 'MX', AUSTRALIA: 'AU',
  'UNITED KINGDOM': 'GB', ENGLAND: 'GB', GERMANY: 'DE', FRANCE: 'FR', SPAIN: 'ES',
  ITALY: 'IT', INDIA: 'IN', 'NEW ZEALAND': 'NZ', JAPAN: 'JP', BRAZIL: 'BR',
};
function iso2(country) {
  if (!country) return 'US'; // the live OpenEI API is US-only today
  const c = String(country).trim();
  if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
  return COUNTRY_ISO[c.toUpperCase()] || c.slice(0, 2).toUpperCase();
}

function normalizeDate(v) {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return undefined;
}

function mapSupply(item) {
  const val = money(item.fixedchargefirstmeter);
  if (val == null || val <= 0) return undefined;
  const units = String(item.fixedchargeunits || '').toLowerCase();
  if (units.includes('day')) return { daily: round(val, 5) };
  if (units.includes('month')) return { daily: round(val / 30.44, 5) }; // avg days/month
  return undefined; // unknown unit -> skip rather than guess
}

/**
 * @param {object} item  URDB rate item.
 * @param {object} [opts] { state, timezone, updated }
 * @returns {object} canonical entry
 */
export function mapRate(item, opts = {}) {
  if (!item) throw new Error('mapRate: no item');
  const periods = item.energyratestructure || [];
  const isTou = periods.length > 1;

  const tariff = { kind: isTou ? 'tou' : 'flat', import: {} };
  const supply = mapSupply(item);
  if (supply) tariff.supply = supply;

  const notes = ['Imported from OpenEI URDB (CC0). User-submitted data — verify against an authoritative source/bill.'];

  if (!isTou) {
    tariff.import.flatRate = tierRate(periods[0]?.[0]);
  } else {
    tariff.import.bands = periods.map((tiers, i) => ({
      id: `p${i}`,
      name: `Period ${i + 1}`,
      rate: tierRate(tiers?.[0]),
    }));

    const wd = item.energyweekdayschedule || [];
    const we = item.energyweekendschedule || [];
    if (!rowsEqual(wd) || !rowsEqual(we)) {
      notes.push('Seasonal variation across months was not modelled (v1); used January.');
    }
    const wdHours = (wd[0] || []).map((p) => `p${p}`);
    const weHours = (we[0] || []).map((p) => `p${p}`);
    const sameWeek = JSON.stringify(wd[0]) === JSON.stringify(we[0]);

    if (sameWeek) {
      tariff.import.schedule = hoursToIntervals(wdHours).map((x) => ({ days: 'all', ...x }));
    } else {
      tariff.import.schedule = [
        ...hoursToIntervals(wdHours).map((x) => ({ days: 'weekday', ...x })),
        ...hoursToIntervals(weHours).map((x) => ({ days: 'weekend', ...x })),
      ];
    }
  }

  const country = iso2(item.country);
  const isUS = country === 'US';
  const provider = item.utility || 'Unknown';
  const planName = item.name || item.label || 'Unnamed rate';
  const region = opts.state || '';
  const id = [country.toLowerCase(), region, provider, planName].filter(Boolean).map(slug).filter(Boolean).join('-');
  const view = isUS ? 'USURDB' : 'IURDB';
  const coverage = item.eiaid != null ? { utilityId: String(item.eiaid) } : undefined;

  const meta = {
    id,
    schemaVersion: '1',
    country,
    ...(region ? { region } : {}),
    provider,
    plan: planName,
    currency: opts.currency || 'USD',
    unit: 'kWh',
    timezone: opts.timezone || (isUS ? 'America/New_York' : 'UTC'),
    source: 'urdb',
    sourceUrl: item.label ? `https://apps.openei.org/${view}/rate/view/${item.label}` : 'https://openei.org/wiki/Utility_Rate_Database',
    license: 'CC0-1.0',
    updated: opts.updated || normalizeDate(item.startdate) || '1970-01-01',
    verified: false,
    notes: notes.join(' '),
    ...(coverage ? { coverage } : {}),
  };

  // Skip plans with no usable energy rate (URDB has demand-only / rider tariffs
  // whose energy price is 0 — noise in a price-comparison DB). run.mjs catches
  // the throw and skips the item.
  const maxRate = Math.max(tariff.import.flatRate || 0, ...(tariff.import.bands || []).map((b) => b.rate || 0), 0);
  if (maxRate <= 0) throw new Error('no positive energy rate (demand-only / rider) — skipped');

  return { meta, tariff };
}
