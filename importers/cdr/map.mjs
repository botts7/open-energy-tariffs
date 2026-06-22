// Pure mapping: AU-CDR EnergyPlanDetail -> canonical v1 entry.
//
// Source of truth for the input shape: the CDR Energy OpenAPI
// (EnergyPlanDetailV*, EnergyPlanContractFull, EnergyPlanContractTariffPeriod).
// This module is intentionally side-effect-free and framework-free so it can be
// run at BUILD time (here) or ON-DEVICE by the SDK, and unit-tested with fixtures.
//
// ⚠️ Authored from the CDR spec + docs; VERIFY against a real captured response
// (see fixtures/ + README) before trusting committed output — the assistant
// could not exercise the live API (the x-v header isn't settable from its fetch).

import { slug, money, toHHMM, assignRoles } from '../_lib/canonical.mjs';

// Re-export the shared helpers so existing importers/tests can keep importing
// them from this module.
export { slug, money, toHHMM };

const DAY_MAP = {
  MON: 'mon', TUE: 'tue', WED: 'wed', THU: 'thu', FRI: 'fri', SAT: 'sat', SUN: 'sun',
};
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKEND = ['sat', 'sun'];
const ALL7 = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

// AU distributor (network) -> state, for region + identity. Extend as needed;
// unknown distributors leave region "" (still valid).
const DISTRIBUTOR_STATE = {
  Ausgrid: 'NSW', Endeavour: 'NSW', 'Endeavour Energy': 'NSW',
  Essential: 'NSW', 'Essential Energy': 'NSW',
  Energex: 'QLD', Ergon: 'QLD', 'Ergon Energy': 'QLD',
  SAPN: 'SA', 'SA Power Networks': 'SA',
  Citipower: 'VIC', CitiPower: 'VIC', Powercor: 'VIC', Jemena: 'VIC',
  Ausnet: 'VIC', 'AusNet Services': 'VIC', United: 'VIC', 'United Energy': 'VIC',
  TasNetworks: 'TAS', Evoenergy: 'ACT',
};

// CDR days[] (with BUSINESS_DAYS / PUBLIC_HOLIDAYS) -> canonical day-set.
export function mapDays(days = []) {
  const set = new Set();
  for (const d of days) {
    if (d === 'BUSINESS_DAYS') WEEKDAYS.forEach((x) => set.add(x));
    else if (d === 'PUBLIC_HOLIDAYS') continue; // not modelled in v1
    else if (DAY_MAP[d]) set.add(DAY_MAP[d]);
  }
  const list = ALL7.filter((d) => set.has(d));
  if (list.length === 7) return 'all';
  if (eq(list, WEEKDAYS)) return 'weekday';
  if (eq(list, WEEKEND)) return 'weekend';
  return list;
}
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function pickElectricityContract(detail) {
  // EnergyPlanDetail nests the contract under electricityContract (or
  // gasContract). Some payloads wrap in { data: ... }.
  const d = detail?.data ?? detail;
  return { plan: d, contract: d?.electricityContract };
}

// Build a tou import.bands[] + import.schedule[] from a tariffPeriod's
// timeOfUseRates[]. Bands are keyed by `type` (PEAK/OFF_PEAK/SHOULDER) falling
// back to a slug of displayName.
function mapTimeOfUse(timeOfUseRates = []) {
  const bands = [];
  const schedule = [];
  // Key bands by the (unique) displayName+rate, NOT by `type`: CDR plans can have
  // several blocks sharing a type (e.g. two SHOULDER blocks "Tariff 1"/"Tariff 2"
  // at different rates) which a type-keyed id would wrongly collapse into one.
  const byKey = new Map();
  const used = new Set();
  timeOfUseRates.forEach((tou, i) => {
    const label = tou.displayName || tou.type || `band-${i + 1}`;
    const rate = money(tou.rates?.[0]?.unitPrice) ?? 0;
    const key = `${label}|${rate}`;
    let id = byKey.get(key);
    if (id === undefined) {
      const base = slug(label) || `band-${i + 1}`;
      id = base;
      let j = 2;
      while (used.has(id)) id = `${base}-${j++}`;
      used.add(id);
      byKey.set(key, id);
      bands.push({ id, name: label, rate });
    }
    for (const w of tou.timeOfUse || []) {
      const from = toHHMM(w.startTime);
      const to = endExclusive(w.endTime);
      if (from && to) schedule.push({ days: mapDays(w.days), from, to, band: id });
    }
  });
  return { bands, schedule };
}

// CDR endTime is INCLUSIVE (e.g. "20:59" means up to 21:00). Canonical `to` is
// exclusive, so a trailing :59 rounds up to the next hour; "00:00" -> "24:00".
function endExclusive(v) {
  const t = toHHMM(v, { isEnd: true });
  if (!t) return t;
  const [hh, mm] = t.split(':').map(Number);
  if (mm === 59) return hh >= 23 ? '24:00' : `${String(hh + 1).padStart(2, '0')}:00`;
  return t;
}

function mapSupply(tp) {
  // Field is singular `dailySupplyCharge` in current CDR; tolerate the plural too.
  const daily = money(tp?.dailySupplyCharge ?? tp?.dailySupplyCharges);
  return daily != null ? { daily } : undefined;
}

function mapExport(solarFeedInTariff = []) {
  const sfit = solarFeedInTariff[0];
  if (!sfit) return undefined;
  if (sfit.tariffUType === 'singleTariff' || sfit.singleTariff) {
    const amount = money(sfit.singleTariff?.amount ?? sfit.singleTariff?.rates?.[0]?.unitPrice);
    if (amount != null) return { flatRate: amount };
  }
  // time-varying export not modelled in v1 — caller should log this skip.
  return undefined;
}

function mapControlledLoad(controlledLoad = []) {
  const out = [];
  for (const cl of controlledLoad) {
    const tp = cl.singleRate || cl.timeOfUseRates?.[0];
    const rate = money(tp?.rates?.[0]?.unitPrice);
    if (rate != null) {
      out.push({ id: slug(cl.displayName || `cl-${out.length + 1}`), name: cl.displayName || 'Controlled load', rate });
    }
  }
  return out.length ? out : undefined;
}

/**
 * Map a CDR EnergyPlanDetail into a canonical v1 entry.
 * @param {object} detail  CDR EnergyPlanDetail (or { data: EnergyPlanDetail }).
 * @param {object} [opts]  { updated: 'YYYY-MM-DD' } — stamp; pass in (no clock here).
 * @returns {object} canonical entry { meta, tariff }
 */
export function mapPlanDetail(detail, opts = {}) {
  const { plan, contract } = pickElectricityContract(detail);
  if (!plan) throw new Error('mapPlanDetail: no plan in payload');

  const provider = plan.brandName || plan.brand || 'Unknown';
  const distributor = contract?.distributors?.[0] || plan.geography?.distributors?.[0] || '';
  const region = DISTRIBUTOR_STATE[distributor] || '';
  const planName = plan.displayName || plan.planId || 'Unnamed plan';

  // Use the first/primary tariffPeriod. (Seasonal multi-period support is a
  // follow-up: would populate seasons[] + band.seasonRates.)
  const tp = contract?.tariffPeriod?.[0] || {};
  const isTou = tp.rateBlockUType === 'timeOfUseRates' || Array.isArray(tp.timeOfUseRates);

  const tariff = { kind: isTou ? 'tou' : 'flat', import: {} };
  const supply = mapSupply(tp);
  if (supply) tariff.supply = supply;

  if (isTou) {
    const { bands, schedule } = mapTimeOfUse(tp.timeOfUseRates);
    tariff.import.bands = assignRoles(bands);
    tariff.import.schedule = schedule;
  } else {
    const rate = money(tp.singleRate?.rates?.[0]?.unitPrice);
    tariff.import.flatRate = rate ?? 0;
  }

  const exp = mapExport(contract?.solarFeedInTariff);
  if (exp) tariff.export = exp;
  const cl = mapControlledLoad(contract?.controlledLoad);
  if (cl) tariff.controlledLoad = cl;

  const idParts = ['au', region, distributor, provider, planName].filter(Boolean).map(slug).filter(Boolean);
  const id = idParts.join('-');

  const geo = plan.geography || {};
  const coverage = {};
  if (geo.includedPostcodes?.length) coverage.postcodes = geo.includedPostcodes;
  if (geo.excludedPostcodes?.length) coverage.exclude = geo.excludedPostcodes;

  const meta = {
    id,
    schemaVersion: '1',
    country: 'AU',
    ...(region ? { region } : {}),
    ...(distributor ? { distributor } : {}),
    provider,
    plan: planName,
    currency: 'AUD',
    unit: 'kWh',
    timezone: stateTz(region),
    source: 'cdr',
    sourceUrl: 'https://www.aer.gov.au/energy-product-reference-data',
    license: 'other',
    updated: opts.updated || plan.effectiveFrom?.slice(0, 10) || '1970-01-01',
    verified: false,
    notes: 'Imported via the AER public Consumer Data Right (CDR) Product Reference Data API (cdr.energymadeeasy.gov.au). Public energy plan data from the Australian Energy Regulator and retailers; no formal open licence; used per the CDR public-data framework. Not endorsed by the AER.',
    ...(Object.keys(coverage).length ? { coverage } : {}),
  };

  return { meta, tariff };
}

function stateTz(region) {
  return {
    NSW: 'Australia/Sydney', ACT: 'Australia/Sydney', VIC: 'Australia/Melbourne',
    QLD: 'Australia/Brisbane', SA: 'Australia/Adelaide', TAS: 'Australia/Hobart',
  }[region] || 'Australia/Sydney';
}
