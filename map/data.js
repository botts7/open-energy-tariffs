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
// Structural guard for entries coming from the REMOTE, third-party extended feed
// before they're merged into the live set. Without this, one malformed entry throws
// in renderMap and blanks the whole map. Also rejects angle-bracketed string fields
// as defense beyond esc() (so a missed escape can't become stored XSS).
OET.isValidEntry = function (e) {
  if (!e || typeof e !== 'object') return false;
  const m = e.meta, t = e.tariff;
  if (!m || typeof m !== 'object' || !t || typeof t !== 'object') return false;
  if (typeof m.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id)) return false;
  if (typeof m.country !== 'string' || !/^[A-Z]{2}$/.test(m.country)) return false;
  if (t.kind !== 'flat' && t.kind !== 'tou') return false;
  if (!t.import || typeof t.import !== 'object') return false;
  for (const v of [m.provider, m.plan, m.region, m.notes, m.currency]) {
    if (v != null && /[<>]/.test(String(v))) return false;
  }
  return true;
};
OET.loadExtended = async function () {
  OET._extendedError = null;
  try {
    const res = await fetch(OET.EXTENDED_FEED, { cache: 'no-store' });
    if (!res.ok) { OET._extendedError = `feed returned HTTP ${res.status}`; }
    else {
      const b = await res.json();
      if (b && Array.isArray(b.entries)) return b.entries.filter(OET.isValidEntry);
      OET._extendedError = 'feed JSON missing entries[]';
    }
  } catch (_) {
    OET._extendedError = 'feed unreachable (offline or CORS)';
  }
  // Opt-in was ON but nothing loaded — surface it (the toggle would otherwise look
  // active while no copyleft data is present).
  console.warn('[OET] extended overlay enabled but not loaded:', OET._extendedError);
  return [];
};

OET.loadPlans = async function () {
  const sources = ['../dist/canonical/tariffs.json', 'dist/canonical/tariffs.json'];
  for (const url of sources) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const bundle = await res.json();
        if (bundle && Array.isArray(bundle.entries)) {
          if (bundle.freshness) OET._freshness = bundle.freshness;
          if (bundle.builtAt) OET._builtAt = bundle.builtAt;
          return { entries: bundle.entries, source: url };
        }
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
  // r may originate from stored band.role (incl. third-party feed) — escape it for
  // the title attribute. roleColor() maps any unknown role to a fixed safe colour.
  const safe = String(r).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<span title="${safe}" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${OET.roleColor(r)};margin-right:6px;vertical-align:middle"></span>`;
};
