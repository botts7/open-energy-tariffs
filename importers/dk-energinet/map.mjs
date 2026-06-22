// Pure mapping: Danish "DatahubPricelist" record (Energinet / Energi Data
// Service) -> canonical v1 entry.
//
// The dataset exposes regulated DSO/TSO network charges with 24 hourly price
// columns (Price1..Price24, DKK/kWh). We map the per-kWh NETWORK tariff (the grid
// charge every consumer pays by hour) — NOT a full retail plan. Subscription
// (fixed abonnement) rows are a separate ChargeType and aren't mapped here.
//
// Input is a normalised record from fetch.mjs. Side-effect-free + framework-free.
//
// Licence: CC-BY 4.0 (Energinet / Energi Data Service) -> license:"CC-BY-4.0".

import { slug, money, round, hoursToIntervals, assignRoles } from '../_lib/canonical.mjs';

export { slug, money };

const SOURCE_URL = 'https://www.energidataservice.dk/tso-electricity/DatahubPricelist';
const NOTES =
  'Danish DSO/TSO network tariff component — the per-kWh grid charge applied by hour — from Energinet\'s Energi Data Service "DatahubPricelist" dataset. Licensed CC BY 4.0; attribute Energinet / Energi Data Service. This is the NETWORK charge, not a full retail plan.';

const RANK_LABEL = ['Low', 'High', 'Peak'];

/** Build {bands,schedule} (or {flat}) from 24 hourly DKK/kWh prices. */
export function buildFromHourlyPrices(prices) {
  const rounded = prices.map((p) => round(money(p)));
  const distinct = [...new Set(rounded)].sort((a, b) => a - b);
  if (distinct.length === 1) return { flat: distinct[0] };

  const rankOf = new Map(distinct.map((p, i) => [p, i + 1]));
  const total = distinct.length;
  const label = (rank) => (total <= 3 ? RANK_LABEL[rank - 1] : `Tier ${rank}`);
  const bands = distinct.map((p, i) => ({ id: `b${i + 1}`, name: label(i + 1), rate: p }));
  const hourBands = rounded.map((p) => `b${rankOf.get(p)}`);
  const schedule = hoursToIntervals(hourBands).map((iv) => ({ days: 'all', ...iv }));
  return { bands, schedule };
}

/**
 * Map one normalised DatahubPricelist record into a canonical v1 entry.
 * @param {object} rec { chargeOwner, chargeOwnerShort, description, chargeTypeCode,
 *                       validFrom, prices:[24] }
 * @param {object} [opts] { updated:'YYYY-MM-DD' }
 */
export function mapPricelistRecord(rec, opts = {}) {
  const prices = rec.prices || [];
  if (prices.length !== 24) throw new Error(`mapPricelistRecord: expected 24 hourly prices, got ${prices.length}`);

  const owner = rec.chargeOwnerShort || rec.chargeOwner || 'Unknown';
  const planName = rec.description || rec.chargeTypeCode || 'Network tariff';

  const tariff = { kind: 'flat', import: {} };
  const built = buildFromHourlyPrices(prices);
  if (built.flat != null) {
    tariff.import.flatRate = built.flat;
  } else {
    tariff.kind = 'tou';
    tariff.import.bands = assignRoles(built.bands);
    tariff.import.schedule = built.schedule;
  }
  if (rec.validFrom) tariff.validFrom = String(rec.validFrom).slice(0, 10);

  const id = ['dk', owner, planName].map(slug).filter(Boolean).join('-');

  const meta = {
    id,
    schemaVersion: '1',
    country: 'DK',
    distributor: rec.chargeOwner || owner,
    provider: owner,
    plan: planName,
    currency: 'DKK',
    unit: 'kWh',
    timezone: 'Europe/Copenhagen',
    source: 'provider',
    sourceUrl: SOURCE_URL,
    license: 'CC-BY-4.0',
    updated: opts.updated || String(rec.validFrom || '').slice(0, 10) || '1970-01-01',
    verified: false,
    notes: NOTES,
  };

  return { meta, tariff };
}
