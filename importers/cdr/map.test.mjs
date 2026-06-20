import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapPlanDetail, toHHMM, mapDays, slug, money } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

test('mapPlanDetail maps the AGL sample to the expected canonical entry', () => {
  const detail = read('fixtures/agl-sample.detail.json');
  const expected = read('fixtures/agl-sample.expected.json');
  const got = mapPlanDetail(detail, { updated: '2026-06-20' });
  assert.deepEqual(got, expected);
});

test('mapped output validates against schema/v1', () => {
  const schema = read('../../schema/v1/tariff.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const got = mapPlanDetail(read('fixtures/agl-sample.detail.json'), { updated: '2026-06-20' });
  assert.ok(validate(got), JSON.stringify(validate.errors, null, 2));
});

test('helpers', () => {
  assert.equal(toHHMM('1500'), '15:00');
  assert.equal(toHHMM('07:00:00'), '07:00');
  assert.equal(toHHMM('0000', { isEnd: true }), '24:00');
  assert.equal(toHHMM('0000'), '00:00');
  assert.equal(mapDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']), 'all');
  assert.equal(mapDays(['MON', 'TUE', 'WED', 'THU', 'FRI']), 'weekday');
  assert.equal(mapDays(['SAT', 'SUN']), 'weekend');
  assert.equal(mapDays(['BUSINESS_DAYS']), 'weekday');
  assert.deepEqual(mapDays(['MON', 'SAT', 'PUBLIC_HOLIDAYS']), ['mon', 'sat']);
  assert.equal(slug('Night Saver EV'), 'night-saver-ev');
  assert.equal(money('0.0800'), 0.08);
});
