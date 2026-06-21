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

OET.initSidebar = function () {
  const root = document.getElementById('sidebar');
  const plans = OET.PLANS || [];
  if (!root || !plans.length) return;

  const uniq = (f) => [...new Set(plans.map(f))].filter(Boolean).sort();
  const countries = uniq((p) => p.meta.country);
  const sources = uniq((p) => p.src);
  const providers = uniq((p) => p.meta.provider);

  const state = { text: '', countries: new Set(), sources: new Set(), provider: '', min: '', max: '', usage: null, usageKwh: '', shape: 'flat', currentPlanId: '', currentCostActual: '', intervals: null, outline: false };

  const count = h('div', { class: 'sb-count' });
  const list = h('div', { class: 'sb-list' });

  // --- controls ---
  // Debounce the search: re-filtering 1600+ plans (add/remove that many map
  // layers) on every keystroke makes typing stutter. Wait for a ~180ms pause.
  let searchTimer = null;
  const search = h('input', { type: 'search', placeholder: 'Search postcode, suburb, provider, plan…', class: 'sb-input',
    oninput: (e) => {
      state.text = e.target.value.trim().toLowerCase();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        // Suburb names need the lazy bundle — load on demand, re-filter when ready.
        if (/[a-z]/.test(state.text) && !OET.AU_SUBURBS && OET.loadScript) OET.loadScript('au-suburbs.js').then(apply);
        apply();
      }, 180);
    } });

  // Single-select dropdowns (country / source / provider) instead of chip grids —
  // far less sidebar space. They AND together with the search + price filters, and
  // every control persists in the shareable URL hash.
  const cname = OET.countryName, sname = OET.sourceName;
  const countrySel = h('select', { class: 'sb-input', onchange: (e) => { state.countries.clear(); if (e.target.value) state.countries.add(e.target.value); apply(); } },
    [h('option', { value: '', text: 'All countries' })].concat(
      countries.slice().sort((a, b) => cname(a).localeCompare(cname(b))).map((c) => h('option', { value: c, text: cname(c) }))));
  const sourceSel = h('select', { class: 'sb-input', onchange: (e) => { state.sources.clear(); if (e.target.value) state.sources.add(e.target.value); apply(); } },
    [h('option', { value: '', text: 'All sources' })].concat(
      sources.slice().sort((a, b) => sname(a).localeCompare(sname(b))).map((s) => h('option', { value: s, text: sname(s) }))));
  const providerSel = h('select', { class: 'sb-input', onchange: (e) => { state.provider = e.target.value; apply(); } },
    [h('option', { value: '', text: 'All providers' })].concat(providers.map((p) => h('option', { value: p, text: p }))));

  const minIn = h('input', { type: 'number', step: '0.01', placeholder: 'min', class: 'sb-num',
    oninput: (e) => { state.min = e.target.value; apply(); } });
  const maxIn = h('input', { type: 'number', step: '0.01', placeholder: 'max', class: 'sb-num',
    oninput: (e) => { state.max = e.target.value; apply(); } });
  const priceRow = h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Rate/kWh' }), minIn, h('span', { text: '–' }), maxIn]);

  // Outline mode: draw areas as coloured boundaries (almost no fill) so overlapping
  // coverage areas and the basemap stay visible.
  const outlineCb = h('input', { type: 'checkbox', onchange: (e) => { state.outline = e.target.checked; if (OET.setOutline) OET.setOutline(state.outline); syncHash(); } });
  const outlineRow = h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Display' }),
    h('label', { class: 'sb-chip' }, [outlineCb, h('span', { text: 'Outline (show overlaps)' })])]);

  const reset = h('button', { class: 'sb-reset', text: 'Reset', onclick: () => {
    state.text = ''; state.countries.clear(); state.sources.clear(); state.provider = ''; state.min = ''; state.max = '';
    state.usage = null; state.usageKwh = ''; state.shape = 'flat'; state.currentPlanId = ''; state.currentCostActual = ''; state.intervals = null;
    state.outline = false; outlineCb.checked = false; if (OET.setOutline) OET.setOutline(false);
    search.value = ''; countrySel.value = ''; sourceSel.value = ''; providerSel.value = ''; minIn.value = ''; maxIn.value = '';
    kwhIn.value = ''; shapeSel.value = 'flat'; csvIn.value = ''; currentSel.value = ''; currentCostIn.value = ''; cmpNote.textContent = '';
    apply();
  } });

  // --- compare to my usage ---
  const cmpNote = h('div', { class: 'sb-sub' });
  function recomputeUsage() {
    const kwh = parseFloat(state.usageKwh);
    state.usage = kwh > 0 ? OET.usageFromAnnual(kwh, state.shape) : null;
    state.intervals = null; // manual kWh/shape overrides an uploaded interval history
    cmpNote.textContent = state.usage ? `Ranking by estimated cost for ~${Math.round(kwh)} kWh/yr (${state.shape})` : '';
    apply();
  }
  const kwhIn = h('input', { type: 'number', step: '100', placeholder: 'annual kWh', class: 'sb-num',
    oninput: (e) => { state.usageKwh = e.target.value; recomputeUsage(); } });
  const shapeSel = h('select', { class: 'sb-input', onchange: (e) => { state.shape = e.target.value; recomputeUsage(); } },
    [['flat', 'Flat (even)'], ['daytime', 'Daytime-heavy'], ['evening', 'Evening-heavy'], ['night_ev', 'Night / EV']]
      .map(([v, t]) => h('option', { value: v, text: t })));
  const csvIn = h('input', { type: 'file', accept: '.csv', class: 'sb-input',
    onchange: (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const r = OET.parseUsageCsv(rd.result);
        const iv = OET.parseIntervals ? OET.parseIntervals(rd.result) : null;
        state.usage = r.profile;
        state.intervals = (iv && iv.intervals.length) ? iv : null;
        state.usageKwh = String(state.intervals ? state.intervals.totalKwh : r.annualKwh); kwhIn.value = state.usageKwh;
        cmpNote.textContent = state.intervals
          ? `Historical: replaying ${state.intervals.days} days of your real data against each plan`
          : `Ranking by your CSV (~${r.annualKwh} kWh/yr)`;
        apply();
      };
      rd.readAsText(f);
    } });
  const pdfIn = h('input', { type: 'file', accept: '.pdf', class: 'sb-input',
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
  const currentSel = h('select', { class: 'sb-input', onchange: (e) => { state.currentPlanId = e.target.value; apply(); } },
    [h('option', { value: '', text: 'My current plan (optional)…' })].concat(
      plans.slice().sort((a, b) => (a.meta.provider + a.meta.plan).localeCompare(b.meta.provider + b.meta.plan))
        .map((p) => h('option', { value: p.id, text: `${p.meta.provider} · ${p.meta.plan} (${p.meta.country})` }))));
  // Or compare against what you ACTUALLY pay (annual) — the ground truth even if
  // your exact plan isn't in the DB. Auto-filled from a bill PDF's total.
  const currentCostIn = h('input', { type: 'number', step: '10', placeholder: 'actual $/yr', class: 'sb-num',
    oninput: (e) => { state.currentCostActual = e.target.value; apply(); } });
  const cmp = h('details', { class: 'sb-cmp' }, [
    h('summary', { text: 'Compare to my usage' }),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Annual kWh + load shape' }), kwhIn, shapeSel]),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'or upload interval CSV (time,kWh)' }), csvIn]),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'or upload a bill PDF (best-effort)' }), pdfIn]),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Baseline: my current plan, or my actual annual $' }), currentSel, currentCostIn]),
    cmpNote,
  ]);

  root.appendChild(h('div', { class: 'sb-head' }, [h('strong', { text: 'Plans' }), count]));
  root.appendChild(search);
  root.appendChild(countrySel);
  root.appendChild(sourceSel);
  root.appendChild(providerSel);
  root.appendChild(priceRow);
  root.appendChild(outlineRow);
  root.appendChild(cmp);
  root.appendChild(reset);
  root.appendChild(list);

  const postcodesOf = (r) => (r.meta.coverage && r.meta.coverage.postcodes) || [];

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
    if (usage) {
      for (const r of arr) r._cost = state.intervals
        ? ((OET.estimateFromIntervals(r.tariff, state.intervals) || {}).annual ?? null)  // historical replay
        : OET.estimateAnnualCost(r.tariff, usage);
      arr.sort((a, b) => (a._cost == null ? Infinity : a._cost) - (b._cost == null ? Infinity : b._cost));
    } else {
      arr.sort((a, b) => (a.meta.country + a.meta.provider + a.meta.plan).localeCompare(b.meta.country + b.meta.provider + b.meta.plan));
    }
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

  function apply() {
    const { pred, note, focus, pc } = buildPredicate();
    const visible = plans.filter(pred);
    OET.applyPlanFilter(pred);
    renderList(visible);
    count.textContent = `${visible.length} / ${plans.length}${note ? ' · ' + note : ''}`;
    // Postcode search: draw the postcode as a polygon and HIDE provider coverage —
    // the plans serving it are the (ranked) list. (Each matching plan serves its
    // whole distribution network, so its coverage hull is noise at this point.)
    if (pc && OET.showPostcodeArea) OET.showPostcodeArea(pc, focus);
    else if (OET.clearPostcodeArea) OET.clearPostcodeArea();
    if (!pc && focus && OET._map) OET._map.setView(focus, 11);
    syncHash();
  }

  // --- shareable URL: encode the filter/usage state in the hash (not the raw
  // CSV/PDF — too big; manual entries only). ---
  function syncHash() {
    const p = new URLSearchParams();
    if (state.countries.size) p.set('c', [...state.countries].join(','));
    if (state.sources.size) p.set('s', [...state.sources].join(','));
    if (state.provider) p.set('p', state.provider);
    if (state.text) p.set('q', state.text);
    if (state.min) p.set('min', state.min);
    if (state.max) p.set('max', state.max);
    if (state.usageKwh) p.set('kwh', state.usageKwh);
    if (state.shape && state.shape !== 'flat') p.set('shape', state.shape);
    if (state.currentCostActual) p.set('cost', state.currentCostActual);
    if (state.currentPlanId) p.set('cur', state.currentPlanId);
    if (state.outline) p.set('o', '1');
    const s = p.toString();
    try { history.replaceState(null, '', s ? '#' + s : location.pathname + location.search); } catch (_) {}
  }

  function restore() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (!([...p].length)) return;
    (p.get('c') || '').split(',').filter(Boolean).forEach((x) => state.countries.add(x));
    (p.get('s') || '').split(',').filter(Boolean).forEach((x) => state.sources.add(x));
    countrySel.value = state.countries.size ? [...state.countries][0] : '';
    sourceSel.value = state.sources.size ? [...state.sources][0] : '';
    state.provider = p.get('p') || ''; providerSel.value = state.provider;
    state.text = p.get('q') || ''; search.value = state.text;
    state.min = p.get('min') || ''; minIn.value = state.min;
    state.max = p.get('max') || ''; maxIn.value = state.max;
    state.usageKwh = p.get('kwh') || ''; kwhIn.value = state.usageKwh;
    state.shape = p.get('shape') || 'flat'; shapeSel.value = state.shape;
    state.currentCostActual = p.get('cost') || ''; currentCostIn.value = state.currentCostActual;
    state.currentPlanId = p.get('cur') || ''; currentSel.value = state.currentPlanId;
    state.outline = p.get('o') === '1'; outlineCb.checked = state.outline; if (state.outline && OET.setOutline) OET.setOutline(true);
    if (parseFloat(state.usageKwh) > 0) state.usage = OET.usageFromAnnual(parseFloat(state.usageKwh), state.shape);
  }

  const copyBtn = h('button', { class: 'sb-reset', text: '🔗 Copy link', onclick: () => {
    const url = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
      () => { copyBtn.textContent = '✓ Copied'; setTimeout(() => { copyBtn.textContent = '🔗 Copy link'; }, 1500); },
      () => { window.prompt('Copy this link:', url); });
  } });
  reset.after(copyBtn);

  restore();
  apply();
};
