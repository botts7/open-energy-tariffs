// open-energy-tariffs — thin JS consumer SDK.
//
// Responsibilities (deliberately minimal): fetch index + per-country chunks with
// ETag revalidation and a bundled-snapshot offline fallback; resolve a plan by id
// and its effective tariff version; apply a pluggable adapter. Dependency-free.
// Raw JSON consumption stays fully supported — this is sugar, not a gate.
//
// The `wallbox` adapter is NOT shipped here (it lives with the Wallbox consumer);
// register it with client.registerAdapter('wallbox', fn). Built-ins: generic, raw.

// Cost engine — "which plan is cheapest for me".
export * from './cost.mjs';

// Set to the real Pages/Release base at publish (schema $id OWNER too).
export const DEFAULT_BASE = 'https://OWNER.github.io/open-energy-tariffs';

// ---- date helpers (YYYY-MM-DD strings sort chronologically) ----
export function dayString(d) {
  if (!d) return undefined;
  if (typeof d === 'string') return d.slice(0, 10);
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function countryOf(id) {
  return String(id).split('-')[0].toUpperCase();
}

/**
 * Pick the tariff version effective on `at` (Date | 'YYYY-MM-DD' | undefined=today).
 * Top-level entry.tariff is "current"; entry.history[] holds prior versions with
 * validFrom/validTo.
 */
export function resolveEffective(entry, at) {
  const day = dayString(at) || dayString(new Date());
  const curFrom = entry.tariff?.validFrom || '0000-01-01';
  if (day >= curFrom || !entry.history?.length) return entry.tariff;
  for (const h of entry.history) {
    const from = h.validFrom || '0000-01-01';
    const to = h.validTo || '9999-12-31';
    if (day >= from && day <= to) return h.tariff;
  }
  return entry.tariff; // fall back to current if nothing matches
}

// ---- built-in adapters: (entry, effectiveTariff) -> output ----
const BUILTIN_ADAPTERS = {
  generic: (entry, tariff) => ({ ...entry, tariff }),
  raw: (_entry, tariff) => tariff,
};

class MemoryStore {
  #m = new Map();
  get(k) { return this.#m.get(k); }
  set(k, v) { this.#m.set(k, v); }
}

/**
 * @param {object} [opts]
 * @param {string} [opts.base]       Base URL for index.json + country chunks.
 * @param {function} [opts.fetch]    fetch impl (defaults to global fetch).
 * @param {object}  [opts.store]     { get(k), set(k,v) } for ETag+body cache.
 * @param {object}  [opts.bundled]   Offline snapshot: { index, countries: {CC: bundle} }.
 * @param {function}[opts.indexPath]    () => path (default 'index.json').
 * @param {function}[opts.countryPath]  (cc) => path (default dist/canonical/tariffs.<CC>.json).
 */
export function createClient(opts = {}) {
  const base = (opts.base || DEFAULT_BASE).replace(/\/$/, '');
  const doFetch = opts.fetch || globalThis.fetch;
  const store = opts.store || new MemoryStore();
  const bundled = opts.bundled || {};
  const indexPath = opts.indexPath || (() => 'index.json');
  const countryPath = opts.countryPath || ((cc) => `dist/canonical/tariffs.${cc}.json`);
  const adapters = { ...BUILTIN_ADAPTERS };

  async function fetchJson(path, fallback) {
    const url = `${base}/${path}`;
    const cached = store.get(path);
    try {
      if (!doFetch) throw new Error('no fetch available');
      const headers = {};
      if (cached?.etag) headers['If-None-Match'] = cached.etag;
      const res = await doFetch(url, { headers });
      if (res.status === 304 && cached) return cached.body;
      if (res.ok) {
        const body = await res.json();
        const etag = res.headers?.get?.('etag') || undefined;
        store.set(path, { etag, body });
        return body;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      // Offline / error: prefer last-good cache, then the bundled snapshot.
      if (cached) return cached.body;
      if (fallback !== undefined) return fallback;
      throw err;
    }
  }

  return {
    adapters,
    registerAdapter(name, fn) { adapters[name] = fn; return this; },

    /** country -> region -> provider -> [{id,plan,verified}] */
    fetchIndex() { return fetchJson(indexPath(), bundled.index); },

    /** { schemaMajor, count, entries:[...] } for one country. */
    fetchCountry(cc) {
      const CC = String(cc).toUpperCase();
      return fetchJson(countryPath(CC), bundled.countries?.[CC]);
    },

    /** Full canonical entry by id, or null if not found. */
    async getPlan(id) {
      const bundle = await this.fetchCountry(countryOf(id));
      return bundle?.entries?.find((e) => e.meta.id === id) || null;
    },

    /**
     * Resolve a plan and run an adapter on its effective tariff.
     * @param {string|object} idOrEntry  plan id or a full entry.
     * @param {string} [adapter='generic']
     * @param {object} [o] { at } effective date.
     */
    async apply(idOrEntry, adapter = 'generic', o = {}) {
      const entry = typeof idOrEntry === 'string' ? await this.getPlan(idOrEntry) : idOrEntry;
      if (!entry) return null;
      const fn = adapters[adapter];
      if (!fn) throw new Error(`unknown adapter "${adapter}" (have: ${Object.keys(adapters).join(', ')})`);
      return fn(entry, resolveEffective(entry, o.at));
    },
  };
}
