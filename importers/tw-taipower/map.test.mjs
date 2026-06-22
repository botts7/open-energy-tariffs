import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapTaipowerTou, touSchedule } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

test('maps the two-section residential ToU sample to the expected canonical entry', () => {
  const sample = read('fixtures/residential-tou-two-section.sample.json');
  const expected = read('fixtures/residential-tou-two-section.expected.json');
  assert.deepEqual(mapTaipowerTou(sample, { updated: '2026-06-20' }), expected);
});

test('summer rates ride on band.seasonRates; non-summer is the default rate', () => {
  const got = mapTaipowerTou(read('fixtures/residential-tou-two-section.sample.json'), { updated: '2026-06-20' });
  const peak = got.tariff.import.bands.find((b) => b.id === 'peak');
  assert.equal(peak.rate, 4.78);
  assert.equal(peak.seasonRates.summer, 5.01);
  assert.deepEqual(got.tariff.seasons, [{ id: 'summer', name: 'Summer', from: 5, to: 8 }]);
});

test('touSchedule: weekdays peak in-window, off-peak otherwise; weekends all off-peak', () => {
  const s = touSchedule([{ from: '16:00', to: '22:00' }]);
  const wd = s.filter((x) => x.days === 'weekday');
  // contiguous weekday cover
  assert.equal(wd[0].from, '00:00');
  assert.equal(wd.at(-1).to, '24:00');
  for (let i = 1; i < wd.length; i++) assert.equal(wd[i].from, wd[i - 1].to);
  assert.equal(wd.find((x) => x.band === 'peak').from, '16:00');
  assert.deepEqual(s.find((x) => x.days === 'weekend'), { days: 'weekend', from: '00:00', to: '24:00', band: 'offpeak' });
});

test('output validates against schema/v1', () => {
  const schema = read('../../schema/v1/tariff.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const got = mapTaipowerTou(read('fixtures/residential-tou-two-section.sample.json'), { updated: '2026-06-20' });
  assert.ok(validate(got), JSON.stringify(validate.errors, null, 2));
});
