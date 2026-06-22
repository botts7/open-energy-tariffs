import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapElcom } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

const REC = {
  operator: 'Test Energie AG', period: '2026', category: 'H4',
  totalRp: 27.296, energyRp: 10.887, gridRp: 11.253, aidfeeRp: 2.3,
  fixCostChf: 96, municipalities: 318,
};

test('maps an ElCom operator record to a flat CHF household tariff', () => {
  const got = mapElcom(REC, { updated: '2026-06-22' });
  assert.equal(got.meta.id, 'ch-test-energie-ag-standard-supply-household-h4');
  assert.equal(got.meta.country, 'CH');
  assert.equal(got.meta.currency, 'CHF');
  assert.equal(got.tariff.kind, 'flat');
  assert.equal(got.tariff.import.flatRate, 0.27296);   // Rp -> CHF, all-in total
  assert.equal(got.tariff.supply.daily, 0.26301);      // 96 CHF/yr -> /day
  assert.equal(got.tariff.validFrom, '2026-01-01');
  assert.match(got.meta.notes, /H4/);
  assert.match(got.meta.notes, /terms_open/);
  assert.match(got.meta.notes, /27\.30 Rp\/kWh/);
  assert.match(got.meta.notes, /318 municipalities/);
});

test('zero fixed cost -> no supply charge', () => {
  const got = mapElcom({ ...REC, fixCostChf: 0 }, { updated: '2026-06-22' });
  assert.equal(got.tariff.supply, undefined);
});

test('output validates against schema/v1', () => {
  const schema = read('../../schema/v1/tariff.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const got = mapElcom(REC, { updated: '2026-06-22' });
  assert.ok(validate(got), JSON.stringify(validate.errors, null, 2));
});
