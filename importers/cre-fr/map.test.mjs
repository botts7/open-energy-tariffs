import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapTrvRecord, hpHcSchedule } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

test('maps the HP/HC 6 kVA sample to the expected canonical entry', () => {
  const sample = read('fixtures/tarif-bleu-hphc-6kva.sample.json');
  const expected = read('fixtures/tarif-bleu-hphc-6kva.expected.json');
  assert.deepEqual(mapTrvRecord(sample, { updated: '2026-06-20' }), expected);
});

test('Base option maps to a flat plan', () => {
  const got = mapTrvRecord(
    { option: 'BASE', puissance: 6, partFixeAnnuelle: 151.2, partVariable: 0.2516, dateDebut: '2025-02-01' },
    { updated: '2026-06-20' },
  );
  assert.equal(got.tariff.kind, 'flat');
  assert.equal(got.tariff.import.flatRate, 0.2516);
  assert.equal(got.tariff.supply.daily, 0.41425);
  assert.equal(got.meta.id, 'fr-enedis-edf-tarif-bleu-base-6-kva');
});

test('Tempo (day-colour) is intentionally skipped (null)', () => {
  assert.equal(mapTrvRecord({ option: 'TEMPO', puissance: 6 }), null);
});

test('hpHcSchedule: wrapping HC window -> one HC + one HP block', () => {
  const s = hpHcSchedule([{ from: '22:00', to: '06:00' }]);
  assert.deepEqual(s, [
    { days: 'all', from: '22:00', to: '06:00', band: 'hc' },
    { days: 'all', from: '06:00', to: '22:00', band: 'hp' },
  ]);
});

test('hpHcSchedule: non-wrapping HC window -> HP fills the day around it', () => {
  const s = hpHcSchedule([{ from: '02:00', to: '07:00' }]);
  const hc = s.filter((x) => x.band === 'hc');
  const hp = s.filter((x) => x.band === 'hp');
  assert.deepEqual(hc, [{ days: 'all', from: '02:00', to: '07:00', band: 'hc' }]);
  assert.deepEqual(hp, [
    { days: 'all', from: '00:00', to: '02:00', band: 'hp' },
    { days: 'all', from: '07:00', to: '24:00', band: 'hp' },
  ]);
});

test('output validates against schema/v1', () => {
  const schema = read('../../schema/v1/tariff.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const got = mapTrvRecord(read('fixtures/tarif-bleu-hphc-6kva.sample.json'), { updated: '2026-06-20' });
  assert.ok(validate(got), JSON.stringify(validate.errors, null, 2));
});
