// Sidebar: browse + filter plans (country / source / provider / price / text) and
// drive the map. Reads OET.PLANS, calls OET.applyPlanFilter + OET.focusPlan from
// render.js. All plan data is inserted via textContent (community data is untrusted).
window.OET = window.OET || {};

// ISO-3166 alpha-2 -> display name (for the country dropdown, list + modal).
OET.COUNTRY_NAMES = {
  AE: 'United Arab Emirates', AR: 'Argentina', AT: 'Austria', AU: 'Australia',
  BE: 'Belgium', BR: 'Brazil', CA: 'Canada', CH: 'Switzerland', CL: 'Chile',
  CN: 'China', CO: 'Colombia', CZ: 'Czechia', DE: 'Germany', DK: 'Denmark',
  EG: 'Egypt', ES: 'Spain', FI: 'Finland', FR: 'France', GB: 'United Kingdom',
  GR: 'Greece', HK: 'Hong Kong', HU: 'Hungary', ID: 'Indonesia', IE: 'Ireland',
  IL: 'Israel', IN: 'India', IT: 'Italy', JP: 'Japan', KE: 'Kenya',
  KR: 'South Korea', MX: 'Mexico', MY: 'Malaysia', NG: 'Nigeria', NL: 'Netherlands',
  NO: 'Norway', NZ: 'New Zealand', PE: 'Peru', PH: 'Philippines', PK: 'Pakistan',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SA: 'Saudi Arabia', SE: 'Sweden',
  SG: 'Singapore', TH: 'Thailand', TR: 'Türkiye', TW: 'Taiwan', UA: 'Ukraine',
  US: 'United States', VN: 'Vietnam', ZA: 'South Africa',
};
OET.countryName = (c) => (OET.COUNTRY_NAMES && OET.COUNTRY_NAMES[c]) || c;

OET.SOURCE_NAMES = { cdr: 'AER CDR (real)', manual: 'Manual', urdb: 'US URDB', provider: 'Provider', other: 'Other' };
OET.sourceName = (s) => (OET.SOURCE_NAMES && OET.SOURCE_NAMES[s]) || s;

function h(tag, attrs, children) {
  const e = document.createElement(tag);
  for (const k in (attrs || {})) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
    else e.setAttribute(k, attrs[k]);
  }
  for (const c of (children || [])) e.appendChild(c);
  return e;
}

// A searchable single-select combo (type to filter long lists). `options` =
// [{value,label}] (include an empty-value "All …" entry). Returns { el, setValue }.
function makeCombo(initialOptions, placeholder, onPick) {
  const dd = h('div', { class: 'sb-sugg' });
  let options = initialOptions;
  let curValue = '';
  const labelOf = (v) => { const o = options.find((x) => x.value === v); return o ? o.label : ''; };
  const filtered = (q) => {
    q = (q || '').trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    const toks = q.split(/\s+/); // every word must appear (any order) — "agl saver" matches
    return options.filter((o) => { const l = o.label.toLowerCase(); return toks.every((t) => l.indexOf(t) !== -1); }).slice(0, 80);
  };
  function render(q) {
    dd.textContent = '';
    filtered(q).forEach((o) => dd.appendChild(h('div', { class: 'sb-sugg-item', text: o.label, onmousedown: (e) => { e.preventDefault(); pick(o); } })));
  }
  function pick(o) { curValue = o.value; input.value = o.value ? o.label : ''; dd.textContent = ''; onPick(o.value); }
  function reconcile() {
    const txt = input.value.trim().toLowerCase();
    if (!txt) { if (curValue) { curValue = ''; onPick(''); } return; }
    const exact = options.find((o) => o.label.toLowerCase() === txt);
    if (exact) pick(exact); else input.value = labelOf(curValue);
  }
  const input = h('input', { type: 'text', class: 'sb-input', placeholder,
    name: 'flt-' + String(placeholder).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    oninput: () => render(input.value),
    onfocus: () => render(input.value),
    onkeydown: (e) => { if (e.key === 'Escape') dd.textContent = ''; else if (e.key === 'Enter') { const f = filtered(input.value)[0]; if (f) pick(f); } },
    onblur: () => setTimeout(() => { dd.textContent = ''; reconcile(); }, 120) });
  return {
    el: h('div', {}, [input, dd]),
    setValue: (v) => { curValue = v || ''; input.value = v ? labelOf(v) : ''; },
    setOptions: (opts) => { options = opts; if (curValue && !options.some((o) => o.value === curValue)) { curValue = ''; input.value = ''; } },
  };
}

OET.initSidebar = function () {
  const root = document.getElementById('sidebar');
  const plans = OET.PLANS || [];
  if (!root || !plans.length) return;

  const uniq = (f) => [...new Set(plans.map(f))].filter(Boolean).sort();
  const countries = uniq((p) => p.meta.country);
  const sources = uniq((p) => p.src);
  const providers = uniq((p) => p.meta.provider);
  const distributors = uniq((p) => p.meta.distributor);

  const state = { text: '', countries: new Set(), sources: new Set(), provider: '', distributor: '', kind: '', sort: 'az', min: '', max: '', usage: null, usageKwh: '', shape: 'flat', bandPeak: '', bandShoulder: '', bandOff: '', exportKwh: '', currentPlanId: '', currentCostActual: '', intervals: null, outline: false };
  // A typical-household profile so "cheapest for typical use" sorting works even
  // before the user enters their own usage (~4000 kWh/yr, even load).
  const typicalUsage = OET.usageFromAnnual ? OET.usageFromAnnual(4000, 'flat') : null;

  const postcodesOf = (r) => (r.meta.coverage && r.meta.coverage.postcodes) || [];
  // Resolve the active search text to a postcode (3-5 digits, or an AU suburb name).
  function resolvedPostcode() {
    const q = state.text;
    if (/^\d{3,5}$/.test(q)) return q;
    if (q && q.length >= 3 && OET.AU_SUBURBS && OET.AU_SUBURBS[q]) return OET.AU_SUBURBS[q];
    return null;
  }
  // The plan-matcher for a postcode: exact (or 3-digit area fallback) within `baseFn`.
  function postcodeMatcher(pc, baseFn) {
    const prefix = pc.length < 4;
    const exact = (r) => postcodesOf(r).some((x) => x === pc || (prefix && x.indexOf(pc) === 0));
    const area = pc.slice(0, 3);
    const areaM = (r) => postcodesOf(r).some((x) => x.indexOf(area) === 0);
    if (plans.some((r) => baseFn(r) && exact(r))) return exact;
    if (plans.some((r) => baseFn(r) && areaM(r))) return areaM;
    return () => false;
  }

  const count = h('div', { class: 'sb-count' });
  const list = h('div', { class: 'sb-list' });

  // --- controls ---
  // Debounce the search: re-filtering 1600+ plans (add/remove that many map
  // layers) on every keystroke makes typing stutter. Wait for a ~180ms pause.
  let searchTimer = null, suggTimer = null, lastSugg = [];
  // Drive the map from a chosen address: switch to that location's COUNTRY (so
  // the list/map reflect where you are, not the default AU-heavy all-countries
  // view), pin the exact spot, and for AU also filter to the postcode area.
  function selectAddress(s) {
    clearSugg();
    if (s.cc) {
      state.countries.clear(); state.countries.add(s.cc);
      if (countryCombo) countryCombo.setValue(s.cc);
      refreshDependentOptions();
    }
    // Only AU has postcode-level coverage; elsewhere we only know the country.
    if (s.cc === 'AU' && s.postcode) { search.value = s.postcode; state.text = s.postcode.toLowerCase(); }
    else { search.value = s.label; state.text = ''; }
    apply();
    if (OET.setAddressPin) OET.setAddressPin([s.lat, s.lng], s.label);
    if (OET._map) OET._map.setView([s.lat, s.lng], 14);
  }
  function clearSugg() { suggestBox.textContent = ''; lastSugg = []; }
  // Scope geocoding to the selected country (ISO-2, lower-case) when one is
  // picked; else search worldwide. The tool covers many countries, so the
  // geocoder must NOT be AU-locked.
  function selectedCC() { return state.countries.size ? [...state.countries][0].toLowerCase() : ''; }
  function renderSuggestions(q) {
    if (!OET.suggestAddress) return;
    // Bias suggestions toward the map only when a country is selected (local
    // refinement). With no country, the map starts over AU/the data centroid, so
    // biasing would bury non-AU places (e.g. "sunset strip" → only AU) — search
    // worldwide and let ranking decide.
    const c = (state.countries.size && OET._map) ? OET._map.getCenter() : null;
    OET.suggestAddress(q, c ? [c.lat, c.lng] : null, selectedCC()).then((list) => {
      lastSugg = list || [];
      suggestBox.textContent = '';
      lastSugg.slice(0, 6).forEach((s) => suggestBox.appendChild(
        h('div', { class: 'sb-sugg-item', text: s.label, onclick: () => selectAddress(s) })));
    });
  }
  // Fallback single-shot geocode (Nominatim) for the button when no live list.
  function geocodeAndShow(q) {
    q = (q || '').trim();
    if (!q || !OET.geocodeAddress) return;
    count.textContent = 'Finding address…';
    OET.geocodeAddress(q, selectedCC()).then((res) => {
      if (!res) { count.textContent = `“${q.slice(0, 24)}” not found`; return; }
      selectAddress(res);
    });
  }
  // Trigger live suggestions for street addresses (has a number), multi-word
  // queries, OR a single place name (≥5 letters, e.g. "london", "berlin") so a
  // bare city/suburb gives pickable results instead of silently finding nothing.
  const looksAddressy = (q) => /\d/.test(q) || (/\s/.test(q) && q.length >= 6) || /^[a-z .'À-ɏ-]{5,}$/i.test(q);
  const suggestBox = h('div', { class: 'sb-sugg' });
  const search = h('input', { type: 'search', placeholder: 'Address, postcode, suburb, provider…', class: 'sb-input', name: 'q',
    oninput: (e) => {
      const raw = e.target.value.trim();
      state.text = raw.toLowerCase();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        // Suburb names need the lazy bundle — load on demand, re-filter when ready.
        if (/[a-z]/.test(state.text) && !OET.AU_SUBURBS && OET.loadScript) OET.loadScript('au-suburbs.js').then(apply);
        apply();
      }, 180);
      // Live address autocomplete (Photon) for address-like queries, debounced.
      clearTimeout(suggTimer);
      if (looksAddressy(raw)) suggTimer = setTimeout(() => renderSuggestions(raw), 300);
      else clearSugg();
    },
    onkeydown: (e) => {
      if (e.key === 'Escape') { clearSugg(); return; }
      if (e.key !== 'Enter') return;
      const q = e.target.value.trim();
      if (lastSugg.length) selectAddress(lastSugg[0]);
      else if (q && !/^\d{3,5}$/.test(q)) geocodeAndShow(q);
    } });
  const geoBtn = h('button', { class: 'sb-reset', text: '📍 Find address', title: 'Geocode the typed street address', onclick: () => { if (lastSugg.length) selectAddress(lastSugg[0]); else geocodeAndShow(search.value); } });
  const locBtn = h('button', { class: 'sb-reset', text: '📡 Use my location', title: 'Detect your location (no typing)', onclick: () => {
    if (!navigator.geolocation) { count.textContent = 'Geolocation not available — type an address'; return; }
    count.textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude, ln = pos.coords.longitude;
        const done = (res) => { if (res) selectAddress(res); else { if (OET.setAddressPin) OET.setAddressPin([la, ln], 'My location'); if (OET._map) OET._map.setView([la, ln], 13); apply(); } };
        if (OET.reverseGeocode) OET.reverseGeocode(la, ln).then(done); else done(null);
      },
      () => { count.textContent = 'Location blocked — type an address instead'; },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  } });

  // Single-select dropdowns (country / source / provider) instead of chip grids —
  // far less sidebar space. They AND together with the search + price filters, and
  // every control persists in the shareable URL hash.
  const cname = OET.countryName, sname = OET.sourceName;
  // Searchable combos (type to filter) for the big lists; provider/distributor/
  // current-plan options are recomputed to the selected country (hierarchy).
  const countryCombo = makeCombo(
    [{ value: '', label: 'All countries' }].concat(countries.slice().sort((a, b) => cname(a).localeCompare(cname(b))).map((c) => ({ value: c, label: cname(c) }))),
    'All countries (type to search)', (v) => { state.countries.clear(); if (v) state.countries.add(v); refreshDependentOptions(); apply(true); });
  const sourceSel = h('select', { class: 'sb-input', name: 'source', onchange: (e) => { state.sources.clear(); if (e.target.value) state.sources.add(e.target.value); refreshDependentOptions(); apply(); } },
    [h('option', { value: '', text: 'All sources' })].concat(
      sources.slice().sort((a, b) => sname(a).localeCompare(sname(b))).map((s) => h('option', { value: s, text: sname(s) }))));
  const providerCombo = makeCombo(
    [{ value: '', label: 'All providers' }].concat(providers.map((p) => ({ value: p, label: p }))),
    'All providers', (v) => { state.provider = v; apply(true); });
  const distributorCombo = makeCombo(
    [{ value: '', label: 'All networks (distributors)' }].concat(distributors.map((d) => ({ value: d, label: d }))),
    'All networks', (v) => { state.distributor = v; apply(true); });
  // Recompute provider/distributor/current-plan lists for the selected country/
  // source — AND the searched postcode, so you can only pick a network/provider
  // that actually serves that postcode (no more empty results from a network in
  // the wrong state).
  function refreshDependentOptions() {
    const csBase = (r) => (!state.countries.size || state.countries.has(r.meta.country)) && (!state.sources.size || state.sources.has(r.src));
    const pc = resolvedPostcode();
    const serves = pc ? postcodeMatcher(pc, csBase) : null;
    const base = plans.filter((r) => csBase(r) && (!serves || serves(r)));
    const provs = [...new Set(base.map((r) => r.meta.provider))].filter(Boolean).sort();
    const dists = [...new Set(base.map((r) => r.meta.distributor))].filter(Boolean).sort();
    if (state.provider && provs.indexOf(state.provider) === -1) state.provider = '';
    if (state.distributor && dists.indexOf(state.distributor) === -1) state.distributor = '';
    providerCombo.setOptions([{ value: '', label: 'All providers' }].concat(provs.map((p) => ({ value: p, label: p })))); providerCombo.setValue(state.provider);
    distributorCombo.setOptions([{ value: '', label: 'All networks (distributors)' }].concat(dists.map((d) => ({ value: d, label: d })))); distributorCombo.setValue(state.distributor);
    if (currentCombo) {
      const cps = base.slice().sort((a, b) => (a.meta.provider + a.meta.plan).localeCompare(b.meta.provider + b.meta.plan)).map((r) => ({ value: r.id, label: `${r.meta.provider} · ${r.meta.plan} (${OET.countryName(r.meta.country)})` }));
      if (state.currentPlanId && !base.some((r) => r.id === state.currentPlanId)) state.currentPlanId = '';
      currentCombo.setOptions([{ value: '', label: 'My current plan (optional)…' }].concat(cps)); currentCombo.setValue(state.currentPlanId);
    }
  }
  const kindSel = h('select', { class: 'sb-input', name: 'kind', onchange: (e) => { state.kind = e.target.value; apply(); } },
    [['', 'All rate types'], ['flat', 'Flat / single rate'], ['tou', 'Time-of-use']].map(([v, t]) => h('option', { value: v, text: t })));
  const sortSel = h('select', { class: 'sb-input', name: 'sort', onchange: (e) => { state.sort = e.target.value; apply(); } },
    [['az', 'Sort: Provider A–Z'], ['rate-asc', 'Sort: Rate (low→high)'], ['rate-desc', 'Sort: Rate (high→low)'], ['cost', 'Sort: Cheapest for typical use']].map(([v, t]) => h('option', { value: v, text: t })));

  const minIn = h('input', { type: 'number', step: '0.01', placeholder: 'min', class: 'sb-num', name: 'min',
    oninput: (e) => { state.min = e.target.value; apply(); } });
  const maxIn = h('input', { type: 'number', step: '0.01', placeholder: 'max', class: 'sb-num', name: 'max',
    oninput: (e) => { state.max = e.target.value; apply(); } });
  const priceRow = h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Rate/kWh' }), minIn, h('span', { text: '–' }), maxIn]);

  // Outline mode: draw areas as coloured boundaries (almost no fill) so overlapping
  // coverage areas and the basemap stay visible.
  const outlineCb = h('input', { type: 'checkbox', name: 'outline', onchange: (e) => { state.outline = e.target.checked; if (OET.setOutline) OET.setOutline(state.outline); syncHash(); } });
  const outlineRow = h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Display' }),
    h('label', { class: 'sb-chip' }, [outlineCb, h('span', { text: 'Outline (show overlaps)' })])]);

  function resetAll() {
    state.text = ''; state.countries.clear(); state.sources.clear(); state.provider = ''; state.min = ''; state.max = '';
    state.usage = null; state.usageKwh = ''; state.shape = 'flat'; state.currentPlanId = ''; state.currentCostActual = ''; state.intervals = null;
    state.bandPeak = ''; state.bandShoulder = ''; state.bandOff = ''; peakIn.value = ''; shoulderIn.value = ''; offIn.value = '';
    state.exportKwh = ''; exportIn.value = '';
    state.outline = false; outlineCb.checked = false; if (OET.setOutline) OET.setOutline(false);
    state.kind = ''; state.sort = 'az'; kindSel.value = ''; sortSel.value = 'az';
    state.distributor = ''; distributorCombo.setValue('');
    search.value = ''; countryCombo.setValue(''); sourceSel.value = ''; providerCombo.setValue(''); minIn.value = ''; maxIn.value = '';
    kwhIn.value = ''; shapeSel.value = 'flat'; csvIn.value = ''; currentCombo.setValue(''); currentCostIn.value = ''; if (cmpNote) cmpNote.textContent = '';
    refreshDependentOptions();
    apply();
  }
  const reset = h('button', { class: 'sb-reset', text: 'Reset', onclick: resetAll });

  // Visible, removable chips for every filter narrowing the list — so an empty
  // result is never a mystery (e.g. a network that doesn't serve the postcode).
  const activeBar = h('div', { class: 'sb-active' });
  // Clear ONE filter then re-apply (combos re-sync via setValue/refresh).
  function clearFilter(kind) {
    if (kind === 'text') { state.text = ''; search.value = ''; clearSugg(); }
    else if (kind === 'country') { state.countries.clear(); countryCombo.setValue(''); refreshDependentOptions(); }
    else if (kind === 'source') { state.sources.clear(); sourceSel.value = ''; refreshDependentOptions(); }
    else if (kind === 'provider') { state.provider = ''; providerCombo.setValue(''); }
    else if (kind === 'distributor') { state.distributor = ''; distributorCombo.setValue(''); }
    else if (kind === 'kind') { state.kind = ''; kindSel.value = ''; }
    else if (kind === 'price') { state.min = ''; state.max = ''; minIn.value = ''; maxIn.value = ''; }
    else if (kind === 'sort') { state.sort = 'az'; sortSel.value = 'az'; }
    apply();
  }
  function renderActiveBar() {
    activeBar.textContent = '';
    const chips = [];
    if (state.text) chips.push(['text', /^\d{3,5}$/.test(state.text) ? 'Postcode ' + state.text : '“' + state.text + '”']);
    if (state.countries.size) chips.push(['country', OET.countryName([...state.countries][0])]);
    if (state.sources.size) chips.push(['source', (OET.sourceName ? OET.sourceName([...state.sources][0]) : [...state.sources][0])]);
    if (state.provider) chips.push(['provider', state.provider]);
    if (state.distributor) chips.push(['distributor', 'Network: ' + state.distributor]);
    if (state.kind) chips.push(['kind', state.kind === 'tou' ? 'Time-of-use' : 'Flat']);
    if (state.min !== '' || state.max !== '') chips.push(['price', `${state.min || '0'}–${state.max || '∞'}/kWh`]);
    if (state.sort && state.sort !== 'az') chips.push(['sort', 'Sorted']);
    if (!chips.length) { activeBar.style.display = 'none'; return; }
    activeBar.style.display = '';
    activeBar.appendChild(h('span', { class: 'sb-lbl', text: 'Active filters' }));
    chips.forEach(([k, label]) => activeBar.appendChild(
      h('span', { class: 'sb-chip sb-fchip', title: 'Remove this filter', onclick: () => clearFilter(k) }, [h('span', { text: label }), h('b', { text: ' ✕' })])));
    activeBar.appendChild(h('button', { class: 'sb-clearall', text: 'Clear all', onclick: resetAll }));
  }

  // --- compare to my usage ---
  const cmpNote = h('div', { class: 'sb-sub' });
  // Attach annual solar export (kWh) to the active usage profile so estimateAnnualCost
  // credits each plan's feed-in rate. Daily input × 365.
  function attachExport() {
    if (!state.usage) return;
    const ex = parseFloat(state.exportKwh) || 0;
    if (ex > 0) state.usage.exportKwh = ex * 365; else delete state.usage.exportKwh;
  }
  function recomputeExport() { attachExport(); apply(); }
  // Per-band entry overrides annual kWh + load shape, so grey those out when bands
  // are in use (they're alternative ways to describe the same usage).
  function bandsActive() { return (parseFloat(state.bandPeak) || 0) + (parseFloat(state.bandShoulder) || 0) + (parseFloat(state.bandOff) || 0) > 0; }
  function updateUsageUI() {
    const ba = bandsActive();
    shapeSel.disabled = ba; kwhIn.disabled = ba;
    shapeSel.style.opacity = ba ? '0.45' : ''; kwhIn.style.opacity = ba ? '0.45' : '';
    shapeSel.title = ba ? 'Not used while daily by-time kWh is entered' : '';
  }
  function recomputeUsage() {
    const kwh = parseFloat(state.usageKwh);
    state.usage = kwh > 0 ? OET.usageFromAnnual(kwh, state.shape) : null;
    state.intervals = null; // manual kWh/shape overrides an uploaded interval history
    attachExport();
    cmpNote.textContent = state.usage ? `Ranking by estimated cost for ~${Math.round(kwh)} kWh/yr (${state.shape})` : '';
    updateUsageUI();
    apply();
  }
  // Per-band daily kWh (peak / shoulder / off-peak) — more accurate than a generic
  // shape because the user gives their actual time-of-use split.
  function recomputeBands() {
    const p = parseFloat(state.bandPeak) || 0, s = parseFloat(state.bandShoulder) || 0, o = parseFloat(state.bandOff) || 0;
    const daily = p + s + o;
    if (daily > 0 && OET.usageFromBands) {
      state.usage = OET.usageFromBands({ peak: p, shoulder: s, offpeak: o });
      state.intervals = null;
      attachExport();
      const annual = Math.round(daily * 365);
      state.usageKwh = String(annual); kwhIn.value = annual;
      cmpNote.textContent = `By time-of-use: ${daily.toFixed(1)} kWh/day (peak ${p} · shoulder ${s} · off-peak ${o}) ≈ ${annual.toLocaleString()} kWh/yr`;
    } else { state.usage = null; cmpNote.textContent = ''; }
    updateUsageUI();
    apply();
  }
  const kwhIn = h('input', { type: 'number', step: '100', placeholder: 'annual kWh', class: 'sb-num sb-numw', name: 'kwh',
    oninput: (e) => { state.usageKwh = e.target.value; recomputeUsage(); } });
  const shapeSel = h('select', { class: 'sb-input', name: 'shape', onchange: (e) => { state.shape = e.target.value; recomputeUsage(); } },
    [['flat', 'Flat (even)'], ['daytime', 'Daytime-heavy'], ['evening', 'Evening-heavy'], ['night_ev', 'Night / EV']]
      .map(([v, t]) => h('option', { value: v, text: t })));
  const bandNum = (key, ph, tip) => h('input', { type: 'number', step: '0.5', min: '0', placeholder: ph, title: tip, class: 'sb-num', name: key,
    oninput: (e) => { state[key] = e.target.value; recomputeBands(); } });
  const peakIn = bandNum('bandPeak', 'peak', 'Peak kWh per day'),
    shoulderIn = bandNum('bandShoulder', 'shldr', 'Shoulder kWh per day'),
    offIn = bandNum('bandOff', 'off', 'Off-peak kWh per day');
  const exportIn = h('input', { type: 'number', step: '0.5', min: '0', placeholder: 'kWh/day', name: 'export', title: 'Average solar export to the grid per day — credits each plan’s feed-in rate', class: 'sb-num sb-numw',
    oninput: (e) => { state.exportKwh = e.target.value; recomputeExport(); } });
  const csvIn = h('input', { type: 'file', accept: '.csv', class: 'sb-input', name: 'csv',
    onchange: (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        // Pluggable parser registry (wide 48-col, long timestamp,kWh, + community).
        const res = OET.parseUsageFile ? OET.parseUsageFile(rd.result) : null;
        if (!res) { cmpNote.textContent = 'Could not read that CSV — see docs/USAGE_CSV_PARSERS.md to add its format'; return; }
        state.usage = res.profile;
        state.intervals = res.intervals || null;
        if (res.exportKwh) { state.exportKwh = String(Math.round(res.exportKwh / 365 * 10) / 10); exportIn.value = state.exportKwh; }
        attachExport();
        state.usageKwh = String(state.intervals ? state.intervals.totalKwh : res.annualKwh); kwhIn.value = state.usageKwh;
        cmpNote.textContent = (state.intervals
          ? `Historical replay: ${state.intervals.days} days of your real data`
          : `${res.parser}: ~${(res.annualKwh || 0).toLocaleString()} kWh/yr`)
          + (res.hasExport ? ` + ${res.exportKwh.toLocaleString()} kWh/yr solar` : '')
          + (res.duplicates ? ` · ${res.duplicates.toLocaleString()} dup rows skipped` : '');
        updateUsageUI(); apply();
      };
      rd.readAsText(f);
    } });
  const pdfIn = h('input', { type: 'file', accept: '.pdf', class: 'sb-input', name: 'pdf',
    onchange: (e) => {
      const f = e.target.files[0]; if (!f || !OET.parseBillPdf) return;
      cmpNote.textContent = 'Reading bill PDF…';
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          const { totalKwh, totalCost } = await OET.parseBillPdf(rd.result);
          const bits = [];
          if (totalKwh) { state.usageKwh = String(Math.round(totalKwh)); kwhIn.value = Math.round(totalKwh); bits.push(`${Math.round(totalKwh).toLocaleString()} kWh`); }
          if (totalCost) { state.currentCostActual = String(Math.round(totalCost)); currentCostIn.value = Math.round(totalCost); bits.push(`${Math.round(totalCost).toLocaleString()} cost`); }
          recomputeUsage();
          cmpNote.textContent = bits.length
            ? `Bill: found ${bits.join(' + ')} — these are a billing PERIOD; ×4 (quarterly) or ×12 (monthly) for ANNUAL`
            : 'Nothing found in PDF — enter values manually';
        } catch (_) { cmpNote.textContent = 'Could not read that PDF — enter annual kWh manually'; }
      };
      rd.readAsArrayBuffer(f);
    } });
  const currentCombo = makeCombo(
    [{ value: '', label: 'My current plan (optional)…' }].concat(
      plans.slice().sort((a, b) => (a.meta.provider + a.meta.plan).localeCompare(b.meta.provider + b.meta.plan))
        .map((p) => ({ value: p.id, label: `${p.meta.provider} · ${p.meta.plan} (${OET.countryName(p.meta.country)})` }))),
    'My current plan (search)', (v) => { state.currentPlanId = v; apply(); });
  // Or compare against what you ACTUALLY pay (annual) — the ground truth even if
  // your exact plan isn't in the DB. Auto-filled from a bill PDF's total.
  const currentCostIn = h('input', { type: 'number', step: '10', placeholder: 'actual $/yr', class: 'sb-num sb-numw', name: 'actual-cost',
    oninput: (e) => { state.currentCostActual = e.target.value; apply(); } });
  const cmp = h('details', { class: 'sb-cmp' }, [
    h('summary', { text: 'Compare to my usage' }),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Annual kWh + load shape' }), kwhIn, shapeSel]),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'or daily kWh by time (peak / shoulder / off-peak)' }), peakIn, shoulderIn, offIn]),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: '☀ Solar export to grid (avg kWh/day) — credits feed-in' }), exportIn]),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'or upload usage CSV (distributor 48-col export, or time,kWh)' }), csvIn]),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'or upload a bill PDF (best-effort)' }), pdfIn]),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Baseline: my current plan, or my actual annual $' }), currentCombo.el, currentCostIn]),
    cmpNote,
  ]);

  // Collapsible filters/sort/display so the controls don't dominate the sidebar.
  const filtersSummary = h('summary', { text: 'Filters · sort · display' });
  const filters = h('details', { class: 'sb-cmp' }, [filtersSummary,
    countryCombo.el, sourceSel, providerCombo.el, distributorCombo.el, kindSel, sortSel, priceRow, outlineRow]);
  // Controls stay pinned (their own box); only the plan list scrolls.
  const controls = h('div', { class: 'sb-controls' }, [
    h('div', { class: 'sb-head' }, [h('strong', { text: 'Plans' }), count]),
    search, suggestBox, h('div', { class: 'sb-chips' }, [geoBtn, locBtn]), activeBar, filters, cmp, reset,
  ]);
  root.appendChild(controls);
  root.appendChild(h('div', { class: 'sb-scroll' }, [list]));

  // Build the filter predicate. Postcode queries (3-5 digits) are special:
  //  - 3 digits = area prefix (e.g. 300 -> 3000-3099);
  //  - 4 digits = exact; if no plan covers it, snap to the nearest COVERED
  //    postcode (via G-NAF centroids) and note it. Otherwise free-text on `hay`.
  function buildPredicate() {
    const q = state.text;
    const min = state.min === '' ? -Infinity : parseFloat(state.min);
    const max = state.max === '' ? Infinity : parseFloat(state.max);
    const priceOn = min > -Infinity || max < Infinity;
    const base = (r) => {
      if (state.countries.size && !state.countries.has(r.meta.country)) return false;
      if (state.sources.size && !state.sources.has(r.src)) return false;
      if (state.provider && r.meta.provider !== state.provider) return false;
      if (state.distributor && r.meta.distributor !== state.distributor) return false;
      if (state.kind && r.tariff.kind !== state.kind) return false;
      if (priceOn) { if (typeof r.rate !== 'number') return false; if (r.rate < min || r.rate > max) return false; }
      return true;
    };
    let note = '', focus = null;
    let textPred = (r) => !q || r.hay.indexOf(q) !== -1;

    // A query is a postcode (3-5 digits) OR a suburb name (resolved to a postcode).
    const isPc = /^\d{3,5}$/.test(q);
    const sub = (!isPc && q.length >= 3 && OET.AU_SUBURBS) ? OET.AU_SUBURBS[q] : null;
    const pc = isPc ? q : sub;
    if (pc) {
      const prefix = pc.length < 4;
      const known = (OET.AU_POSTCODES && OET.AU_POSTCODES[pc]) || null;
      const label = sub ? `“${state.text}” → ${pc}` : pc;
      const matchExact = (r) => postcodesOf(r).some((x) => x === pc || (prefix && x.indexOf(pc) === 0));
      const area = pc.slice(0, 3);
      const matchArea = (r) => postcodesOf(r).some((x) => x.indexOf(area) === 0);
      if (plans.some((r) => base(r) && matchExact(r))) {
        textPred = matchExact; focus = known; if (sub) note = label;
      } else if (plans.some((r) => base(r) && matchArea(r))) {
        note = `${label}: ${area}× area`; textPred = matchArea; focus = known;
      } else {
        note = `${label}: no plans in this area`; textPred = () => false;
      }
    }
    // pc (a single 4-5 digit postcode with a known centroid) drives postcode mode.
    return { pred: (r) => base(r) && textPred(r), note, focus, pc: (pc && pc.length >= 4 && focus) ? pc : null };
  }

  function renderList(visible) {
    list.textContent = '';
    const usage = state.usage;
    const arr = visible.slice();
    // Cost basis: the user's usage if entered, else a typical household profile so
    // "cheapest for typical use" works out of the box.
    const costUsage = usage || typicalUsage;
    if ((usage || state.sort === 'cost') && costUsage && OET.estimateAnnualCost) {
      for (const r of arr) r._cost = (usage && state.intervals)
        ? ((OET.estimateFromIntervals(r.tariff, state.intervals) || {}).annual ?? null)  // historical replay
        : OET.estimateAnnualCost(r.tariff, costUsage);
    }
    // USD-normalise the sort key so cross-currency ordering is fair (display stays local).
    const usd = (v, cur) => (OET.toUsd ? OET.toUsd(v, cur) : v);
    const rateKey = (r) => { const v = usd(r.rate, r.meta.currency); return v == null ? Infinity : v; };
    const costKey = (r) => { const v = r._cost == null ? null : usd(r._cost, r.meta.currency); return v == null ? Infinity : v; };
    arr.sort((a, b) => {
      if (state.sort === 'rate-asc') return rateKey(a) - rateKey(b);
      if (state.sort === 'rate-desc') return (rateKey(b) === Infinity ? -Infinity : rateKey(b)) - (rateKey(a) === Infinity ? -Infinity : rateKey(a));
      if (state.sort === 'cost') return costKey(a) - costKey(b);
      return (a.meta.country + a.meta.provider + a.meta.plan).localeCompare(b.meta.country + b.meta.provider + b.meta.plan);
    });
    const cheapest = usage && arr.length && arr[0]._cost != null ? arr[0]._cost : null;
    // Baseline for savings: your ACTUAL annual $ (ground truth) if entered, else
    // an estimate of your selected current plan.
    let baseline = null, baselineKind = '';
    const actual = usage ? parseFloat(state.currentCostActual) : NaN;
    if (usage && actual > 0) { baseline = actual; baselineKind = 'your actual'; }
    else if (usage && state.currentPlanId) { const cur = plans.find((p) => p.id === state.currentPlanId); if (cur) { baseline = OET.estimateAnnualCost(cur.tariff, usage); baselineKind = 'current plan'; } }
    if (usage && baseline != null) {
      list.appendChild(h('div', { class: 'sb-baseline', text: `Your current (${baselineKind}): ~${Math.round(baseline).toLocaleString()}/yr — candidates show savings vs this` }));
    }
    const cap = 400;
    for (const r of arr.slice(0, cap)) {
      const m = r.meta;
      const sw = h('span', { class: 'sb-sw' }); sw.style.background = (OET._rateColorNow || OET.rateColorFor || OET.rateColor)(r.rate, m.currency);
      const best = usage && r._cost != null && r._cost === cheapest;
      const isCurrent = r.id === state.currentPlanId;
      const kids = [h('strong', { text: m.provider }), h('span', { text: ' · ' + m.plan })];
      if (isCurrent) kids.push(h('span', { class: 'sb-cur', text: 'current' }));
      if (best && !isCurrent) kids.push(h('span', { class: 'sb-best', text: 'cheapest' }));
      let sub = `${OET.countryName(m.country)}${m.region ? '/' + m.region : ''} · ${OET.sourceName(m.source)} · ${r.rate == null ? '—' : r.rate.toFixed(3) + ' ' + m.currency}${r.located ? '' : ' · (no map area)'}`;
      if (usage) sub += r._cost == null ? ' · cost n/a' : ` · ~${Math.round(r._cost).toLocaleString()} ${m.currency}/yr`;
      const subEl = h('div', { class: 'sb-sub', text: sub });
      if (usage && baseline != null && r._cost != null && !isCurrent) {
        const d = r._cost - baseline;
        subEl.appendChild(h('span', { class: d < 0 ? 'sb-save' : 'sb-cost', text: ` · ${d < 0 ? 'save ' : '+'}${Math.abs(Math.round(d)).toLocaleString()} ${m.currency}/yr` }));
      }
      const row = h('div', { class: 'sb-row' + (r.located ? '' : ' sb-nolocate') + (best && !isCurrent ? ' sb-bestrow' : '') + (isCurrent ? ' sb-currow' : ''), onclick: () => { if (OET.showPlanModal) OET.showPlanModal(r); else OET.focusPlan(r.id); } },
        [sw, h('div', {}, [h('div', { class: 'sb-title' }, kids), subEl])]);
      list.appendChild(row);
    }
    if (arr.length > cap) list.appendChild(h('div', { class: 'sb-more', text: `…and ${arr.length - cap} more (refine filters)` }));
  }

  // How many filters are narrowing the list (so hidden/collapsed filters can't
  // silently cause "no results").
  function activeFilterCount() {
    let n = 0;
    if (state.countries.size) n++;
    if (state.sources.size) n++;
    if (state.provider) n++;
    if (state.distributor) n++;
    if (state.kind) n++;
    if (state.min !== '' || state.max !== '') n++;
    if (state.sort && state.sort !== 'az') n++;
    if (state.outline) n++;
    return n;
  }
  function apply(fit) {
    // When the searched postcode changes, re-narrow the network/provider dropdowns
    // to what serves it (so you can't pick a network in the wrong area, then get 0).
    const pcNow = resolvedPostcode();
    if (pcNow !== state._pcKey) { state._pcKey = pcNow; refreshDependentOptions(); }
    OET._usage = state.usage; // expose to the compare modal's annual-cost row
    // Expose the baseline (your actual $ or current-plan cost) so the plan modal
    // can show history-vs-proposed savings.
    OET._baseline = null;
    if (state.usage) {
      const actual = parseFloat(state.currentCostActual);
      if (actual > 0) OET._baseline = { cost: actual, label: 'your actual bill' };
      else if (state.currentPlanId) {
        const cur = plans.find((p) => p.id === state.currentPlanId);
        if (cur && OET.estimateAnnualCost) OET._baseline = { cost: OET.estimateAnnualCost(cur.tariff, state.usage), label: cur.meta.provider + ' · ' + cur.meta.plan, rec: cur };
      }
    }
    const { pred, note, focus, pc } = buildPredicate();
    const visible = plans.filter(pred);
    OET.applyPlanFilter(pred);
    renderList(visible);
    // Feed the same filtered set + usage to the Table view (comparison layer).
    OET._visible = visible;
    OET._tableUsage = state.usage || typicalUsage;
    OET._tableUsageReal = !!state.usage;
    OET._tableSort = state.sort;
    if (OET.onResults) OET.onResults();
    const hidden = OET._suppressedHeavy ? ` · ${OET._suppressedHeavy.toLocaleString()} areas hidden — pick a country/postcode/provider to map them` : '';
    count.textContent = `${visible.length} / ${plans.length}${note ? ' · ' + note : ''}${hidden}`;
    // Reflect active filters on the (collapsible) summary, and reveal them if a
    // filter is hiding results — so it's never a mystery why the list is short.
    const af = activeFilterCount();
    filtersSummary.textContent = af ? `Filters · sort · display — ${af} active` : 'Filters · sort · display';
    renderActiveBar();
    // If filters wiped the list, say so plainly right where the chips are.
    if ((af || state.text) && visible.length === 0) { filters.open = true; activeBar.setAttribute('data-empty', '1'); }
    else activeBar.removeAttribute('data-empty');
    // Postcode search: draw the postcode as a polygon and HIDE provider coverage —
    // the plans serving it are the (ranked) list. (Each matching plan serves its
    // whole distribution network, so its coverage hull is noise at this point.)
    if (pc && OET.showPostcodeArea) OET.showPostcodeArea(pc, focus);
    else if (OET.clearPostcodeArea) OET.clearPostcodeArea();
    if (!pc && focus && OET._map) OET._map.setView(focus, 11);
    // Geographic dropdown change -> zoom the map to the filtered area.
    if (fit && !pc && OET.fitToFiltered) OET.fitToFiltered(pred);
    syncHash();
  }

  // --- shareable URL: encode the filter/usage state in the hash (not the raw
  // CSV/PDF — too big; manual entries only). ---
  function syncHash() {
    const p = new URLSearchParams();
    if (state.countries.size) p.set('c', [...state.countries].join(','));
    if (state.sources.size) p.set('s', [...state.sources].join(','));
    if (state.provider) p.set('p', state.provider);
    if (state.distributor) p.set('d', state.distributor);
    if (state.kind) p.set('k', state.kind);
    if (state.sort && state.sort !== 'az') p.set('sort', state.sort);
    if (state.text) p.set('q', state.text);
    if (state.min) p.set('min', state.min);
    if (state.max) p.set('max', state.max);
    if (state.usageKwh) p.set('kwh', state.usageKwh);
    if (state.shape && state.shape !== 'flat') p.set('shape', state.shape);
    if (state.currentCostActual) p.set('cost', state.currentCostActual);
    if (state.currentPlanId) p.set('cur', state.currentPlanId);
    if (state.outline) p.set('o', '1');
    if ((OET.compareSet || []).length) p.set('cmp', OET.compareSet.join(','));
    const s = p.toString();
    try { history.replaceState(null, '', s ? '#' + s : location.pathname + location.search); } catch (_) {}
  }

  function restore() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (!([...p].length)) return;
    (p.get('c') || '').split(',').filter(Boolean).forEach((x) => state.countries.add(x));
    (p.get('s') || '').split(',').filter(Boolean).forEach((x) => state.sources.add(x));
    countryCombo.setValue(state.countries.size ? [...state.countries][0] : '');
    sourceSel.value = state.sources.size ? [...state.sources][0] : '';
    state.provider = p.get('p') || ''; providerCombo.setValue(state.provider);
    state.distributor = p.get('d') || ''; distributorCombo.setValue(state.distributor);
    state.kind = p.get('k') || ''; kindSel.value = state.kind;
    state.sort = p.get('sort') || 'az'; sortSel.value = state.sort;
    state.text = p.get('q') || ''; search.value = state.text;
    state.min = p.get('min') || ''; minIn.value = state.min;
    state.max = p.get('max') || ''; maxIn.value = state.max;
    state.usageKwh = p.get('kwh') || ''; kwhIn.value = state.usageKwh;
    state.shape = p.get('shape') || 'flat'; shapeSel.value = state.shape;
    state.currentCostActual = p.get('cost') || ''; currentCostIn.value = state.currentCostActual;
    state.currentPlanId = p.get('cur') || ''; currentCombo.setValue(state.currentPlanId);
    state.outline = p.get('o') === '1'; outlineCb.checked = state.outline; if (state.outline && OET.setOutline) OET.setOutline(true);
    (p.get('cmp') || '').split(',').filter(Boolean).forEach((id) => { OET.compareSet = OET.compareSet || []; if (OET.compareSet.indexOf(id) === -1) OET.compareSet.push(id); });
    if (parseFloat(state.usageKwh) > 0) state.usage = OET.usageFromAnnual(parseFloat(state.usageKwh), state.shape);
  }

  const copyBtn = h('button', { class: 'sb-reset', text: '🔗 Copy link', onclick: () => {
    const url = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => { copyBtn.textContent = '✓ Copied'; setTimeout(() => { copyBtn.textContent = '🔗 Copy link'; }, 1500); },
      () => { window.prompt('Copy this link:', url); });
  } });
  reset.after(copyBtn);

  // Compare launcher — opens the side-by-side compare modal; label tracks count.
  const compareBtn = h('button', { class: 'sb-reset', text: 'Compare (0)', onclick: () => { if (OET.showCompareModal) OET.showCompareModal(); } });
  copyBtn.after(compareBtn);
  OET._onCompareChange = () => { compareBtn.textContent = `Compare (${(OET.compareSet || []).length})`; syncHash(); };

  // Quick-nav API for the top-bar universal search: each is a focused jump
  // (resets other filters first). Plans are opened via OET.openModalById.
  OET.quickNav = function (action) {
    action = action || {};
    resetAll();
    if (action.country) { state.countries.add(action.country); countryCombo.setValue(action.country); }
    if (action.provider) { state.provider = action.provider; providerCombo.setValue(action.provider); }
    if (action.distributor) { state.distributor = action.distributor; distributorCombo.setValue(action.distributor); }
    if (action.text) { state.text = action.text; search.value = action.text; }
    refreshDependentOptions();
    apply(true);
    document.body.classList.remove('nav-open');
  };

  restore();
  refreshDependentOptions(); // narrow provider/distributor/current-plan to the restored country
  if (activeFilterCount()) filters.open = true; // don't hide filters that are already on (e.g. from a shared link)
  if (OET._onCompareChange) OET._onCompareChange();
  updateUsageUI();
  apply();
};
