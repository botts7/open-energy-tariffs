import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapPricelistRecord, buildFromHourlyPrices } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

test('maps the N1 "Nettarif C time" sample to the expected canonical entry', () => {
  const sample = read('fixtures/n1-nettarif-c-time.sample.json');
  const expected = read('fixtures/n1-nettarif-c-time.expected.json');
  assert.deepEqual(mapPricelistRecord(sample, { updated: '2026-06-20' }), expected);
});

test('uniform 24h prices collapse to a flat plan', () => {
  const rec = { chargeOwner: 'Radius', description: 'Nettarif C', validFrom: '2024-01-01', prices: Array(24).fill(0.33) };
  const got = mapPricelistRecord(rec, { updated: '2026-06-20' });
  assert.equal(got.tariff.kind, 'flat');
  assert.equal(got.tariff.import.flatRate, 0.33);
});

test('buildFromHourlyPrices ranks bands cheapest->dearest as Low/High/Peak', () => {
  const prices = [...Array(6).fill(0.10), ...Array(11).fill(0.20), ...Array(4).fill(0.50), ...Array(3).fill(0.10)];
  const { bands, schedule } = buildFromHourlyPrices(prices);
  assert.deepEqual(bands.map((b) => b.name), ['Low', 'High', 'Peak']);
  assert.equal(schedule[0].from, '00:00');
  assert.equal(schedule.at(-1).to, '24:00');
  // schedule must paint a contiguous 24h with no gaps
  for (let i = 1; i < schedule.length; i++) assert.equal(schedule[i].from, schedule[i - 1].to);
});

test('output validates against schema/v1', () => {
  const schema = read('../../schema/v1/tariff.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const got = mapPricelistRecord(read('fixtures/n1-nettarif-c-time.sample.json'), { updated: '2026-06-20' });
  assert.ok(validate(got), JSON.stringify(validate.errors, null, 2));
});
