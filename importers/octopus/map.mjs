// Pure mapping: Octopus Energy product detail -> canonical v1 entry.
//
// ⚠️ ON-DEVICE ONLY. Octopus's ToS forbids redistributing its content, so output
// of this importer is RUNTIME data for the user's own use and MUST NEVER be
// committed to tariffs/. It carries `meta.source: "octopus"`, which the stored
// schema deliberately REJECTS — that exclusion is the guard (see ATTRIBUTION.md).
//
// Authored from the Octopus public API shape; verify against a live
// GET /v1/products/{code}/ response (see README "Verification gap").
//
// Scope: STATIC products only — single-register (flat/variable) and
// dual-register (Economy 7 day/night). DYNAMIC products (Agile/Flux/Tracker,
// half-hourly) are out of scope — consume the live HA price entity instead.
import { slug, round, money, dayComplement } from '../_lib/canonical.mjs';

const DYNAMIC = /AGILE|FLUX|TRACKER|GO-VAR/i;

// Octopus inline rates are pence/kWh (or pence/day) incl VAT -> major units.
const major = (pence) => (pence == null ? undefined : round(money(pence) / 100, 5));

/**
 * @param {object} detail  Octopus product detail (GET /v1/products/{code}/).
 * @param {object} [opts]
 *   gsp='_A'                Grid Supply Point group (_A.._P).
 *   paymentMethod='direct_debit_monthly'
 *   nightWindow={from,to}   E7 cheap window (meter-specific; default 00:30-07:30).
 *   updated                 'YYYY-MM-DD' stamp.
 * @returns {object} canonical entry (runtime-only).
 */
export function mapProduct(detail, opts = {}) {
  if (!detail?.code) throw new Error('mapProduct: no product code');
  if (detail.is_tracker || DYNAMIC.test(detail.code)) {
    throw new Error(`Octopus product "${detail.code}" is dynamic — consume the live price entity, not a preset`);
  }

  const gsp = opts.gsp || '_A';
  const pm = opts.paymentMethod || 'direct_debit_monthly';
  const region = gsp.replace(/^_/, '');
  const single = detail.single_register_electricity_tariffs?.[gsp]?.[pm];
  const dual = detail.dual_register_electricity_tariffs?.[gsp]?.[pm];

  const tariff = { kind: 'flat', import: {} };
  if (single) {
    const supply = major(single.standing_charge_inc_vat);
    if (supply != null) tariff.supply = { daily: supply };
    tariff.import.flatRate = major(single.standard_unit_rate_inc_vat) ?? 0;
  } else if (dual) {
    tariff.kind = 'tou';
    const supply = major(dual.standing_charge_inc_vat);
    if (supply != null) tariff.supply = { daily: supply };
    const night = opts.nightWindow || { from: '00:30', to: '07:30' };
    tariff.import.bands = [
      { id: 'day', name: 'Day', rate: major(dual.day_unit_rate_inc_vat) ?? 0 },
      { id: 'night', name: 'Night', rate: major(dual.night_unit_rate_inc_vat) ?? 0 },
    ];
    const dayParts = dayComplement(night, 'day').map((p) => ({ days: 'all', ...p }));
    tariff.import.schedule = [
      ...dayParts,
      { days: 'all', from: night.from, to: night.to, band: 'night' },
    ].sort((a, b) => a.from.localeCompare(b.from));
  } else {
    throw new Error(`No ${pm} tariff for GSP ${gsp} on "${detail.code}"`);
  }

  const plan = detail.display_name || detail.full_name || detail.code;
  const meta = {
    id: slug(`gb ${region} octopus ${detail.code}`),
    schemaVersion: '1',
    country: 'GB',
    ...(region ? { region } : {}),
    provider: 'Octopus Energy',
    plan,
    currency: 'GBP',
    unit: 'kWh',
    timezone: 'Europe/London',
    source: 'octopus',
    sourceUrl: `https://octopus.energy/`,
    license: 'other',
    updated: opts.updated || (detail.available_from?.slice(0, 10)) || '1970-01-01',
    verified: false,
    notes: 'Imported ON-DEVICE from the Octopus API for personal use. NOT redistributable — never commit to the database (source:octopus is rejected by the stored schema).',
  };

  return { meta, tariff };
}
