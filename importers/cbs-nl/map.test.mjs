import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapCbsNl, periodToDate } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

const REC = { period: '2026MM03', energy: 0.0661, ode: 0.0363, energyTax: 0.11408, transport: 257.35, fixedSupply: 67.49, taxRebate: -558.56 };

test('maps a CBS record to a flat all-in NL entry', () => {
  const got = mapCbsNl(REC, { updated: '2026-06-23' });
  assert.equal(got.meta.country, 'NL');
  assert.equal(got.meta.currency, 'EUR');
  assert.equal(got.meta.license, 'CC-BY-4.0');
  assert.equal(got.tariff.kind, 'flat');
  assert.equal(got.tariff.import.flatRate, 0.21648);   // energy + ODE + energy tax
  assert.equal(got.tariff.validFrom, '2026-03-01');
  assert.match(got.meta.notes, /CBS/);
});

test('net-negative fixed (rebate exceeds charges) -> no supply charge', () => {
  // 257.35 + 67.49 - 558.56 < 0
  assert.equal(mapCbsNl(REC, {}).tariff.supply, undefined);
});

test('net-positive fixed -> a supply charge', () => {
  const got = mapCbsNl({ ...REC, taxRebate: -100 }, {}); // 257.35+67.49-100 = 224.84
  assert.ok(got.tariff.supply.daily > 0);
});

test('periodToDate', () => {
  assert.equal(periodToDate('2026MM03'), '2026-03-01');
  assert.equal(periodToDate('2025JJ00'), '2025-01-01');
});

test('output validates against schema/v1', () => {
  const schema = read('../../schema/v1/tariff.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert.ok(validate(mapCbsNl(REC, { updated: '2026-06-23' })), JSON.stringify(validate.errors, null, 2));
});
