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
