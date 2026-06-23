import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parseEurostat } from './fetch.mjs';
import { mapEurostat, periodToDate } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

// Synthetic json-stat: dims [unit, geo, time]; sizes [1,3,2]. strides time=1, geo=2.
const FIX = {
  id: ['unit', 'geo', 'time'],
  size: [1, 3, 2],
  dimension: {
    unit: { category: { index: { KWH: 0 } } },
    geo: { category: { index: { ES: 0, EL: 1, EU27_2020: 2 } } },
    time: { category: { index: { '2025S1': 0, '2025S2': 1 } } },
  },
  value: { 0: 0.20, 1: 0.25, 2: 0.28, 3: 0.29 }, // ES S1/S2, EL S1/S2
};

test('parseEurostat: latest period per country, EL->GR, aggregates skipped', () => {
  const recs = parseEurostat(FIX);
  const byCc = Object.fromEntries(recs.map((r) => [r.country, r]));
  assert.equal(recs.length, 2);                       // EU27_2020 skipped
  assert.deepEqual(byCc.ES, { country: 'ES', price: 0.25, period: '2025S2' });
  assert.deepEqual(byCc.GR, { country: 'GR', price: 0.29, period: '2025S2' }); // EL -> GR
});

test('mapEurostat -> flat EUR entry', () => {
  const got = mapEurostat({ country: 'ES', price: 0.25, period: '2025S2' }, { updated: '2026-06-23' });
  assert.equal(got.meta.country, 'ES');
  assert.equal(got.meta.currency, 'EUR');
  assert.equal(got.meta.license, 'CC-BY-4.0');
  assert.equal(got.tariff.import.flatRate, 0.25);
  assert.equal(got.tariff.validFrom, '2025-07-01');
  assert.match(got.meta.notes, /Eurostat/);
});

test('periodToDate', () => {
  assert.equal(periodToDate('2025S2'), '2025-07-01');
  assert.equal(periodToDate('2024S1'), '2024-01-01');
});

test('validates against schema/v1', () => {
  const schema = read('../../schema/v1/tariff.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  assert.ok(ajv.compile(schema)(mapEurostat({ country: 'ES', price: 0.25, period: '2025S2' }, {})));
});
