// Load the tariff bundle: prefer the live build output (when served over http),
// fall back to the embedded sample (e.g. opened from file://, where fetch of a
// local path is blocked by the browser).
window.OET = window.OET || {};

// Lazy-load a data bundle by injecting a <script> (works on file:// and http,
// unlike fetch). Resolves once loaded; cached so repeated calls are cheap.
OET._loaded = {};
OET.loadScript = function (src) {
  if (OET._loaded[src]) return OET._loaded[src];
  OET._loaded[src] = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = src; s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return OET._loaded[src];
};

// Opt-in COPYLEFT overlay: a SEPARATE repo (open-energy-tariffs-extended) holds
// share-alike data (CC-BY-SA / ODbL) that can't live in the permissive core. It's
// fetched + merged ONLY in the user's browser, only when they opt in — so the core
// never ships a merged (share-alike) artifact. See that repo's README.
OET.EXTENDED_FEED = 'https://botts7.github.io/open-energy-tariffs-extended/dist/canonical/tariffs.json';
OET.extendedEnabled = function () { try { return localStorage.getItem('oet-extended') === '1'; } catch (_) { return false; } };
OET.setExtendedEnabled = function (on) {
  try { localStorage.setItem('oet-extended', on ? '1' : '0'); } catch (_) {}
  location.reload(); // re-bootstrap with/without the overlay (clean, no live re-render)
};
OET.loadExtended = async function () {
  try {
    const res = await fetch(OET.EXTENDED_FEED, { cache: 'no-store' });
    if (res.ok) { const b = await res.json(); if (b && Array.isArray(b.entries)) return b.entries; }
  } catch (_) { /* feed offline — core still works */ }
  return [];
};

OET.loadPlans = async function () {
  const sources = ['../dist/canonical/tariffs.json', 'dist/canonical/tariffs.json'];
  for (const url of sources) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const bundle = await res.json();
        if (bundle && Array.isArray(bundle.entries)) return { entries: bundle.entries, source: url };
      }
    } catch (_) { /* file:// or missing build — fall through to sample */ }
  }
  return { entries: (OET.SAMPLE || {}).entries || [], source: 'embedded sample' };
};

// Representative per-unit rate for colouring: peak (max band) for ToU, else flat.
OET.planRate = function (tariff) {
  if (!tariff) return null;
  if (tariff.kind === 'tou' && tariff.import && tariff.import.bands && tariff.import.bands.length) {
    return Math.max.apply(null, tariff.import.bands.map((b) => b.rate));
  }
  return tariff.import ? tariff.import.flatRate ?? null : null;
};

// Wholesale / spot pass-through plans (Amber, Globird WHOLESAVE, Octopus Agile…)
// are NOT fixed — the rate tracks the live wholesale price, so a stored rate is a
// snapshot and the cost estimate is unreliable. Flag them so they're not ranked
// as fixed (e.g. never crowned 'Cheapest'). Detect by provider + plan name.
OET.isDynamic = function (rec) {
  const m = (rec && rec.meta) || {};
  const p = String(m.provider || '').toLowerCase(), n = String(m.plan || '').toLowerCase();
  return /\bamber\b/.test(p)
    || /wholesale|wholesave|spot[- ]?price|\bspot\b|market[- ]?linked|\bagile\b|real[- ]?time price/.test(n);
};

// Semantic band role (backend-normalised). Use the stored `role` (our domain);
// fall back to a name guess so pre-backfill / external data still colours sanely.
OET.bandRole = function (band) {
  if (band && band.role) return band.role;
  const s = String((band && (band.name || band.id)) || '').toLowerCase();
  if (/control|\bcl\d?\b/.test(s)) return 'controlled';
  if (/off.?peak|\bnight\b|離峰|creuses|\bhc\b|solar\s*(sponge|soak)|\bfree\b/.test(s)) return 'offpeak';
  if (/shoulder|half.?peak|半尖峰/.test(s)) return 'shoulder';
  if (/\bpeak\b|尖峰|pleines|\bhp\b/.test(s)) return 'peak';
  return '';
};

// Role -> UI colour (the logic layer made visible). Language/label-independent.
OET.ROLE_COLOR = { peak: '#dc2626', shoulder: '#f59e0b', offpeak: '#16a34a', night: '#3b82f6', controlled: '#64748b' };
OET.roleColor = function (role) { return OET.ROLE_COLOR[role] || '#94a3b8'; };
OET.roleDot = function (band) {
  const r = OET.bandRole(band);
  if (!r) return '';
  return `<span title="${r}" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${OET.roleColor(r)};margin-right:6px;vertical-align:middle"></span>`;
};
