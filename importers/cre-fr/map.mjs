// Pure mapping: French regulated tariff (CRE "Tarif réglementé de vente" /
// EDF Tarif Bleu) record -> canonical v1 entry.
//
// Input is a NORMALISED record produced by fetch.mjs from the CRE Open Data CSVs
// on data.gouv.fr (Option Base / HP-HC / Tempo). Authored from the documented
// column set — VERIFY the real column names against a downloaded file (see
// README) before trusting committed output. Side-effect-free + framework-free so
// it can run at BUILD time or be unit-tested with fixtures.
//
// Licence: Licence Ouverte / Etalab 2.0 (commercial reuse + redistribution with
// attribution). Recorded as license:"other" — the schema enum has no Etalab
// value, and Etalab 2.0 is CC-BY-compatible but not literally CC BY 4.0.

import { slug, money, round, dayComplement } from '../_lib/canonical.mjs';

export { slug, money };

const SOURCE_URL =
  'https://www.data.gouv.fr/fr/datasets/historique-des-tarifs-reglementes-de-vente-delectricite/';
const NOTES =
  'Regulated French electricity tariff (Tarif réglementé de vente / EDF Tarif Bleu), published by the CRE as open data on data.gouv.fr under Licence Ouverte / Etalab 2.0 (commercial reuse + redistribution with attribution). Attribute the CRE; recorded as license:other (Etalab 2.0 ~ CC BY).';

/**
 * Build the import schedule for an Heures Pleines / Heures Creuses plan from the
 * HC (off-peak) windows. Supports one window, optionally wrapping midnight
 * (from > to, e.g. 22:00->06:00). HP is the complement that fills the day.
 */
export function hpHcSchedule(hcWindows) {
  const schedule = [];
  for (const w of hcWindows) schedule.push({ days: 'all', from: w.from, to: w.to, band: 'hc' });
  if (hcWindows.length === 1) {
    const { from, to } = hcWindows[0];
    if (from < to) {
      for (const iv of dayComplement({ from, to }, 'hp')) schedule.push({ days: 'all', ...iv });
    } else {
      // wrapping HC window -> HP is the single block between to..from
      schedule.push({ days: 'all', from: to, to: from, band: 'hp' });
    }
  }
  return schedule;
}

/**
 * Map one normalised CRE TRV record into a canonical v1 entry.
 * @param {object} rec  { option:'BASE'|'HPHC'|'TEMPO', puissance, partFixeAnnuelle,
 *                        partVariable, partVariableHP, partVariableHC, hcWindows, dateDebut }
 * @param {object} [opts] { updated:'YYYY-MM-DD' }
 * @returns {object|null} canonical entry, or null for unsupported options (Tempo).
 */
export function mapTrvRecord(rec, opts = {}) {
  const option = String(rec.option || '').toUpperCase();
  // Tempo prices by day COLOUR (Bleu/Blanc/Rouge) x HP/HC — a day-type scheme v1
  // does not model. Skip until v1.1 day-type seasons.
  if (option === 'TEMPO') return null;

  const puissance = rec.puissance;
  const provider = 'EDF';
  const distributor = 'Enedis';
  const isHpHc = option === 'HPHC';
  const planName = `Tarif Bleu ${isHpHc ? 'HP/HC' : 'Base'} ${puissance} kVA`;

  const tariff = { kind: isHpHc ? 'tou' : 'flat', import: {} };

  const fixe = money(rec.partFixeAnnuelle);
  if (fixe != null) tariff.supply = { daily: round(fixe / 365) };

  if (isHpHc) {
    tariff.import.bands = [
      { id: 'hp', name: 'Heures Pleines', rate: money(rec.partVariableHP) ?? 0 },
      { id: 'hc', name: 'Heures Creuses', rate: money(rec.partVariableHC) ?? 0 },
    ];
    tariff.import.schedule = hpHcSchedule(rec.hcWindows || [{ from: '22:00', to: '06:00' }]);
  } else {
    tariff.import.flatRate = money(rec.partVariable) ?? 0;
  }

  if (rec.dateDebut) tariff.validFrom = rec.dateDebut;

  const id = ['fr', distributor, provider, planName].map(slug).filter(Boolean).join('-');

  const meta = {
    id,
    schemaVersion: '1',
    country: 'FR',
    distributor,
    provider,
    plan: planName,
    currency: 'EUR',
    unit: 'kWh',
    timezone: 'Europe/Paris',
    source: 'provider',
    sourceUrl: SOURCE_URL,
    license: 'other',
    updated: opts.updated || rec.dateDebut || '1970-01-01',
    verified: false,
    notes: NOTES,
    coverage: { national: true },
  };

  return { meta, tariff };
}
