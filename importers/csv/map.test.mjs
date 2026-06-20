import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parseCsv, mapRow, mapCsv } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('parseCsv handles quotes, escaped quotes and commas-in-quotes', () => {
  const rows = parseCsv('a,b\n"x,y","say ""hi"""\n');
  assert.deepEqual(rows, [{ a: 'x,y', b: 'say "hi"' }]);
});

test('mapRow builds a valid flat entry with defaults', () => {
  const e = mapRow({ country: 'nz', provider: 'Contact', plan: 'Basic', currency: 'nzd', flatRate: '0.28', supplyDaily: '1.2', national: 'yes' }, { updated: '2026-06-21' });
  assert.equal(e.meta.id, 'nz-contact-basic');
  assert.equal(e.meta.country, 'NZ');
  assert.equal(e.meta.currency, 'NZD');
  assert.equal(e.meta.timezone, 'Pacific/Auckland');
  assert.equal(e.meta.license, 'CC0-1.0');
  assert.deepEqual(e.meta.coverage, { national: true });
  assert.equal(e.tariff.kind, 'flat');
  assert.equal(e.tariff.import.flatRate, 0.28);
  assert.equal(e.tariff.supply.daily, 1.2);
});

test('mapRow throws on missing required column', () => {
  assert.throws(() => mapRow({ country: 'NZ', plan: 'x', currency: 'NZD' }), /provider/);
});

test('sample.csv maps to schema-valid entries', () => {
  const schema = JSON.parse(readFileSync(join(here, '../../schema/v1/tariff.schema.json'), 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
  const validate = ajv.compile(schema);
  const entries = mapCsv(readFileSync(join(here, 'sample.csv'), 'utf8'), { updated: '2026-06-21' });
  assert.ok(entries.length >= 2);
  for (const e of entries) assert.ok(validate(e), JSON.stringify(validate.errors, null, 2));
});
