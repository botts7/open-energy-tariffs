import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, resolveEffective, countryOf, dayString } from './index.mjs';

const AGL = {
  meta: { id: 'au-nsw-ausgrid-agl-night-saver-ev', country: 'AU', provider: 'AGL', plan: 'Night Saver EV' },
  tariff: { kind: 'tou', validFrom: '2026-01-01', import: { flatRate: 0 } },
  history: [
    { validFrom: '2025-01-01', validTo: '2025-12-31', tariff: { kind: 'flat', import: { flatRate: 0.30 } } },
  ],
};
const AU_BUNDLE = { schemaMajor: 1, count: 1, entries: [AGL] };
const INDEX = { AU: { NSW: { AGL: [{ id: AGL.meta.id, plan: 'Night Saver EV', verified: false }] } } };

function makeFetch(routes) {
  const calls = [];
  const fn = async (url, { headers = {} } = {}) => {
    calls.push({ url, headers });
    const r = routes[url];
    if (!r) return { ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) };
    if (headers['If-None-Match'] && headers['If-None-Match'] === r.etag)
      return { ok: false, status: 304, headers: { get: (k) => (k === 'etag' ? r.etag : null) }, json: async () => { throw new Error('304: no body'); } };
    return { ok: true, status: 200, headers: { get: (k) => (k === 'etag' ? r.etag : null) }, json: async () => r.body };
  };
  fn.calls = calls;
  return fn;
}

test('helpers', () => {
  assert.equal(countryOf('au-nsw-ausgrid-agl-night-saver-ev'), 'AU');
  assert.equal(countryOf('gb-octopus-economy-7-example'), 'GB');
  assert.equal(dayString('2026-06-20T00:00:00Z'), '2026-06-20');
});

test('resolveEffective picks current vs history by date', () => {
  assert.equal(resolveEffective(AGL, '2026-03-01').kind, 'tou');   // >= current validFrom
  assert.equal(resolveEffective(AGL, '2025-06-01').kind, 'flat');  // inside history window
  assert.equal(resolveEffective(AGL, '2025-06-01').import.flatRate, 0.30);
});

test('getPlan + apply(generic|raw)', async () => {
  const f = makeFetch({ 'https://x/dist/canonical/tariffs.AU.json': { etag: '"a"', body: AU_BUNDLE } });
  const c = createClient({ base: 'https://x', fetch: f });

  const entry = await c.getPlan(AGL.meta.id);
  assert.equal(entry.meta.id, AGL.meta.id);

  const generic = await c.apply(AGL.meta.id, 'generic', { at: '2026-03-01' });
  assert.equal(generic.meta.id, AGL.meta.id);
  assert.equal(generic.tariff.kind, 'tou');

  const raw = await c.apply(AGL.meta.id, 'raw', { at: '2025-06-01' });
  assert.equal(raw.kind, 'flat');

  assert.equal(await c.getPlan('au-does-not-exist'), null);
});

test('registerAdapter is pluggable (e.g. wallbox lives elsewhere)', async () => {
  const f = makeFetch({ 'https://x/dist/canonical/tariffs.AU.json': { etag: '"a"', body: AU_BUNDLE } });
  const c = createClient({ base: 'https://x', fetch: f });
  c.registerAdapter('count-bands', (_e, t) => (t.import.bands || []).length);
  assert.equal(await c.apply(AGL.meta.id, 'count-bands'), 0);
  await assert.rejects(() => c.apply(AGL.meta.id, 'nope'), /unknown adapter/);
});

test('ETag revalidation returns cached body on 304', async () => {
  const f = makeFetch({ 'https://x/index.json': { etag: '"v1"', body: INDEX } });
  const c = createClient({ base: 'https://x', fetch: f });
  const a = await c.fetchIndex();
  const b = await c.fetchIndex();
  assert.deepEqual(a, INDEX);
  assert.deepEqual(b, INDEX);
  assert.equal(f.calls[1].headers['If-None-Match'], '"v1"');
});

test('offline falls back to bundled snapshot', async () => {
  const throwing = async () => { throw new Error('offline'); };
  const c = createClient({ base: 'https://x', fetch: throwing, bundled: { index: INDEX, countries: { AU: AU_BUNDLE } } });
  assert.deepEqual(await c.fetchIndex(), INDEX);
  assert.equal((await c.getPlan(AGL.meta.id)).meta.id, AGL.meta.id);
});
