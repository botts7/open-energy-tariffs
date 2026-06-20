import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapRate } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

function validator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(read('../../schema/v1/tariff.schema.json'));
}

test('REAL Ohio Power TOU (seasonal+adj): hour matrix -> interval schedule', () => {
  const got = mapRate(read('fixtures/ohio-tou.detail.json'), { state: 'OH', timezone: 'America/New_York', updated: '2026-06-20' });
  assert.deepEqual(got, read('fixtures/ohio-tou.expected.json'));
});

test('REAL Ohio Power flat rate (rate+adj summed)', () => {
  const got = mapRate(read('fixtures/ohio-flat.detail.json'), { state: 'OH', timezone: 'America/New_York', updated: '2026-06-20' });
  assert.deepEqual(got, read('fixtures/ohio-flat.expected.json'));
});

test('URDB output validates against schema/v1 (bulk-storable, CC0)', () => {
  const validate = validator();
  for (const [f, o] of [
    ['fixtures/ohio-tou.detail.json', { state: 'OH', updated: '2026-06-20' }],
    ['fixtures/ohio-flat.detail.json', { state: 'OH', updated: '2026-06-20' }],
  ]) {
    assert.ok(validate(mapRate(read(f), o)), JSON.stringify(validate.errors, null, 2));
  }
});

test('monthly fixed charge converts to a daily supply charge', () => {
  const got = mapRate(
    { label: 'm', utility: 'U', name: 'N', energyratestructure: [[{ rate: 0.1 }]], fixedchargefirstmeter: 30.44, fixedchargeunits: '$/month' },
    { updated: '2026-06-20' },
  );
  assert.equal(got.tariff.supply.daily, 1);
});

test('weekday != weekend produces split day-sets', () => {
  const wdRow = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]; // all peak weekdays
  const weRow = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]; // all off-peak weekends
  const got = mapRate({
    label: 'x', utility: 'U', name: 'N',
    energyratestructure: [[{ rate: 0.5 }], [{ rate: 0.2 }]],
    energyweekdayschedule: Array(12).fill(wdRow),
    energyweekendschedule: Array(12).fill(weRow),
  }, { updated: '2026-06-20' });
  assert.deepEqual(got.tariff.import.schedule, [
    { days: 'weekday', from: '00:00', to: '24:00', band: 'p0' },
    { days: 'weekend', from: '00:00', to: '24:00', band: 'p1' },
  ]);
});
