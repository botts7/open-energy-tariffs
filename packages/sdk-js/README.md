# @open-energy-tariffs/sdk

Thin, dependency-free JS client for the
[open-energy-tariffs](../../README.md) database. Encapsulates the bits every
consumer would otherwise reinvent: ETag-cached fetch, a bundled-snapshot offline
fallback, plan lookup by id, effective-date version resolution, and a pluggable
adapter step. Raw JSON consumption still works — this is sugar, not a gate.

## Use

```js
import { createClient } from '@open-energy-tariffs/sdk';
import snapshot from './bundled-tariffs.json' assert { type: 'json' }; // optional offline fallback

const client = createClient({
  base: 'https://botts7.github.io/open-energy-tariffs', // set at publish
  bundled: { index: snapshot.index, countries: snapshot.countries },
});

// pick-lists
const index = await client.fetchIndex();              // country -> region -> provider -> [{id,plan,verified}]

// fetch a plan + apply it
const entry = await client.getPlan('au-nsw-ausgrid-agl-night-saver-ev');
const generic = await client.apply(entry, 'generic'); // { ...entry, tariff: <effective> }

// historical billing: resolve the version effective on a date
const lastYear = await client.apply(entry.meta.id, 'raw', { at: '2025-06-01' });
```

## Adapters

Built-in: `generic` (entry with its effective tariff) and `raw` (just the tariff).
Register app-specific shapes — the **Wallbox** 24-hour-array adapter is **not**
shipped here (it lives with the Wallbox consumer):

```js
import { toWallbox } from 'wallbox-tariff-adapter';   // provided by that app
client.registerAdapter('wallbox', toWallbox);
const wb = await client.apply(id, 'wallbox');
```

## API

| Method | Returns |
|---|---|
| `createClient({ base, fetch?, store?, bundled?, indexPath?, countryPath? })` | client |
| `fetchIndex()` | the index manifest (bundled fallback) |
| `fetchCountry(cc)` | `{ schemaMajor, count, entries }` for a country |
| `getPlan(id)` | full canonical entry, or `null` |
| `apply(idOrEntry, adapter='generic', { at })` | adapter output, or `null` |
| `registerAdapter(name, fn)` | `this` (chainable) |

Also exported: `resolveEffective(entry, at)`, `countryOf(id)`, `dayString(d)`.

- **Caching:** pass `store` (`{ get, set }`, e.g. wrapping `localStorage`) to
  persist ETags + bodies across sessions; defaults to in-memory.
- **Offline:** on fetch error the client returns the last-good cache, then
  `bundled`; ship a snapshot with your app so it works with no network.
- **Pinning:** point `base` at a versioned GitHub Release instead of `latest`.
