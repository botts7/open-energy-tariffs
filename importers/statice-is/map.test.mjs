import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapIceland, periodToDate } from './map.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const REC = { code: 'x', label: '2500 - 5000 kWH', period: '2022H1', priceIsk: 21.63 };
test('maps Hagstofa record to flat ISK entry', () => {
  const got = mapIceland(REC, { updated: '2026-06-23' });
  assert.equal(got.meta.country, 'IS'); assert.equal(got.meta.currency, 'ISK'); assert.equal(got.meta.license, 'CC-BY-4.0');
  assert.equal(got.tariff.import.flatRate, 21.63); assert.equal(got.tariff.validFrom, '2022-01-01');
  assert.match(got.meta.plan, /2500–5000 kWh/); assert.match(got.meta.notes, /Statistics Iceland/);
});
test('periodToDate', () => { assert.equal(periodToDate('2022H1'), '2022-01-01'); assert.equal(periodToDate('2021H2'), '2021-07-01'); });
test('validates against schema/v1', () => { const s = read('../../schema/v1/tariff.schema.json'); const a = new Ajv({ allErrors: true, strict: false }); addFormats(a); assert.ok(a.compile(s)(mapIceland(REC, { updated: '2026-06-23' }))); });
