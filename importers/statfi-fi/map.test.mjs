import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapFinland, periodToDate } from './map.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const REC = { code: 'C', label: 'Household customer, annual consumption 2 500 kWh - 4 999 kWh', period: '2026M03', energy: 8.5, distribution: 6.2, taxes: 4.1, total: 18.8 };
test('maps a StatFin record to a flat all-in FI entry', () => {
  const got = mapFinland(REC, { updated: '2026-06-23' });
  assert.equal(got.meta.country, 'FI');
  assert.equal(got.meta.license, 'CC-BY-4.0');
  assert.equal(got.tariff.import.flatRate, 0.188);   // 18.8 c/kWh -> €/kWh
  assert.equal(got.tariff.validFrom, '2026-03-01');
  assert.match(got.meta.plan, /2,500.*4,999/);
  assert.match(got.meta.notes, /Statistics Finland/);
});
test('periodToDate', () => { assert.equal(periodToDate('2026M03'), '2026-03-01'); });
test('validates against schema/v1', () => {
  const schema = read('../../schema/v1/tariff.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
  assert.ok(ajv.compile(schema)(mapFinland(REC, { updated: '2026-06-23' })));
});
