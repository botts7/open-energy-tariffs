import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapProduct } from './map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));

// On-device output carries source:octopus, which the STORED schema rejects by
// design. To still prove structural validity, validate against a patched schema
// that additionally permits source:octopus.
function structuralValidator() {
  const schema = read('../../schema/v1/tariff.schema.json');
  schema.properties.meta.properties.source.enum.push('octopus');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

test('single-register product -> flat canonical', () => {
  const got = mapProduct(read('fixtures/single-flexible.detail.json'), { gsp: '_A', updated: '2026-06-20' });
  assert.deepEqual(got, read('fixtures/single-flexible.expected.json'));
});

test('dual-register (Economy 7) -> tou with default night window', () => {
  const got = mapProduct(read('fixtures/dual-economy7.detail.json'), { gsp: '_A', updated: '2026-06-20' });
  assert.deepEqual(got, read('fixtures/dual-economy7.expected.json'));
});

test('output is structurally valid canonical (modulo source:octopus)', () => {
  const validate = structuralValidator();
  for (const f of ['fixtures/single-flexible.detail.json', 'fixtures/dual-economy7.detail.json']) {
    const got = mapProduct(read(f), { gsp: '_A', updated: '2026-06-20' });
    assert.ok(validate(got), JSON.stringify(validate.errors, null, 2));
  }
});

test('the STORED schema rejects source:octopus (never bulk-stored)', () => {
  const schema = read('../../schema/v1/tariff.schema.json');
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const got = mapProduct(read('fixtures/single-flexible.detail.json'), { gsp: '_A', updated: '2026-06-20' });
  assert.equal(validate(got), false);
});

test('dynamic products are refused', () => {
  assert.throws(() => mapProduct({ code: 'AGILE-22-11-01' }), /dynamic/);
  assert.throws(() => mapProduct({ code: 'X', is_tracker: true }), /dynamic/);
});

test('custom night window', () => {
  const got = mapProduct(read('fixtures/dual-economy7.detail.json'), {
    gsp: '_A', updated: '2026-06-20', nightWindow: { from: '01:00', to: '08:00' },
  });
  assert.deepEqual(got.tariff.import.schedule, [
    { days: 'all', from: '00:00', to: '01:00', band: 'day' },
    { days: 'all', from: '01:00', to: '08:00', band: 'night' },
    { days: 'all', from: '08:00', to: '24:00', band: 'day' },
  ]);
});
