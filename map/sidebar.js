// Sidebar: browse + filter plans (country / source / provider / price / text) and
// drive the map. Reads OET.PLANS, calls OET.applyPlanFilter + OET.focusPlan from
// render.js. All plan data is inserted via textContent (community data is untrusted).
window.OET = window.OET || {};

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

  const state = { text: '', countries: new Set(), sources: new Set(), provider: '', min: '', max: '', usage: null, usageKwh: '', shape: 'flat', currentPlanId: '' };

  const count = h('div', { class: 'sb-count' });
  const list = h('div', { class: 'sb-list' });

  // --- controls ---
  const search = h('input', { type: 'search', placeholder: 'Search provider, plan, postcode…', class: 'sb-input',
    oninput: (e) => { state.text = e.target.value.trim().toLowerCase(); apply(); } });

  function chipRow(label, values, set) {
    const wrap = h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: label })]);
    for (const v of values) {
      const cb = h('label', { class: 'sb-chip' }, [
        h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? set.add(v) : set.delete(v); apply(); } }),
        h('span', { text: v }),
      ]);
      wrap.appendChild(cb);
    }
    return wrap;
  }

  const providerSel = h('select', { class: 'sb-input', onchange: (e) => { state.provider = e.target.value; apply(); } },
    [h('option', { value: '', text: 'All providers' })].concat(providers.map((p) => h('option', { value: p, text: p }))));

  const minIn = h('input', { type: 'number', step: '0.01', placeholder: 'min', class: 'sb-num',
    oninput: (e) => { state.min = e.target.value; apply(); } });
  const maxIn = h('input', { type: 'number', step: '0.01', placeholder: 'max', class: 'sb-num',
    oninput: (e) => { state.max = e.target.value; apply(); } });
  const priceRow = h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Rate/kWh' }), minIn, h('span', { text: '–' }), maxIn]);

  const reset = h('button', { class: 'sb-reset', text: 'Reset', onclick: () => {
    state.text = ''; state.countries.clear(); state.sources.clear(); state.provider = ''; state.min = ''; state.max = '';
    state.usage = null; state.usageKwh = ''; state.shape = 'flat'; state.currentPlanId = '';
    search.value = ''; providerSel.value = ''; minIn.value = ''; maxIn.value = '';
    kwhIn.value = ''; shapeSel.value = 'flat'; csvIn.value = ''; currentSel.value = ''; cmpNote.textContent = '';
    root.querySelectorAll('.sb-chip input').forEach((c) => { c.checked = false; });
    apply();
  } });

  // --- compare to my usage ---
  const cmpNote = h('div', { class: 'sb-sub' });
  function recomputeUsage() {
    const kwh = parseFloat(state.usageKwh);
    state.usage = kwh > 0 ? OET.usageFromAnnual(kwh, state.shape) : null;
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
        state.usage = r.profile; state.usageKwh = String(r.annualKwh); kwhIn.value = r.annualKwh;
        cmpNote.textContent = `Ranking by your CSV (~${r.annualKwh} kWh/yr)`;
        apply();
      };
      rd.readAsText(f);
    } });
  const currentSel = h('select', { class: 'sb-input', onchange: (e) => { state.currentPlanId = e.target.value; apply(); } },
    [h('option', { value: '', text: 'My current plan (optional)…' })].concat(
      plans.slice().sort((a, b) => (a.meta.provider + a.meta.plan).localeCompare(b.meta.provider + b.meta.plan))
        .map((p) => h('option', { value: p.id, text: `${p.meta.provider} · ${p.meta.plan} (${p.meta.country})` }))));
  const cmp = h('details', { class: 'sb-cmp' }, [
    h('summary', { text: 'Compare to my usage' }),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Annual kWh + load shape' }), kwhIn, shapeSel]),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'or upload interval CSV (time,kWh)' }), csvIn]),
    h('div', { class: 'sb-chips' }, [h('span', { class: 'sb-lbl', text: 'Savings vs my current plan' }), currentSel]),
    cmpNote,
  ]);

  root.appendChild(h('div', { class: 'sb-head' }, [h('strong', { text: 'Plans' }), count]));
  root.appendChild(search);
  root.appendChild(chipRow('Country', countries, state.countries));
  root.appendChild(chipRow('Source', sources, state.sources));
  root.appendChild(providerSel);
  root.appendChild(priceRow);
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

    if (/^\d{3,5}$/.test(q)) {
      const prefix = q.length < 4;
      const known = (OET.AU_POSTCODES && OET.AU_POSTCODES[q]) || null;
      const matchExact = (r) => postcodesOf(r).some((x) => x === q || (prefix && x.indexOf(q) === 0));
      const area = q.slice(0, 3); // postal area
      const matchArea = (r) => postcodesOf(r).some((x) => x.indexOf(area) === 0);
      if (plans.some((r) => base(r) && matchExact(r))) {
        textPred = matchExact; focus = known;                       // exact postcode / prefix
      } else if (plans.some((r) => base(r) && matchArea(r))) {
        note = `${q}: showing ${area}× area`; textPred = matchArea; focus = known; // snap to postal area
      } else {
        note = `${q}: no plans in this area`; textPred = () => false;
      }
    }
    return { pred: (r) => base(r) && textPred(r), note, focus };
  }

  function renderList(visible) {
    list.textContent = '';
    const usage = state.usage;
    const arr = visible.slice();
    if (usage) {
      for (const r of arr) r._cost = OET.estimateAnnualCost(r.tariff, usage);
      arr.sort((a, b) => (a._cost == null ? Infinity : a._cost) - (b._cost == null ? Infinity : b._cost));
    } else {
      arr.sort((a, b) => (a.meta.country + a.meta.provider + a.meta.plan).localeCompare(b.meta.country + b.meta.provider + b.meta.plan));
    }
    const cheapest = usage && arr.length && arr[0]._cost != null ? arr[0]._cost : null;
    let currentCost = null;
    if (usage && state.currentPlanId) {
      const cur = plans.find((p) => p.id === state.currentPlanId);
      if (cur) currentCost = OET.estimateAnnualCost(cur.tariff, usage);
    }
    const cap = 400;
    for (const r of arr.slice(0, cap)) {
      const m = r.meta;
      const sw = h('span', { class: 'sb-sw' }); sw.style.background = OET.rateColor(r.rate);
      const best = usage && r._cost != null && r._cost === cheapest;
      const isCurrent = r.id === state.currentPlanId;
      const kids = [h('strong', { text: m.provider }), h('span', { text: ' · ' + m.plan })];
      if (isCurrent) kids.push(h('span', { class: 'sb-cur', text: 'current' }));
      if (best && !isCurrent) kids.push(h('span', { class: 'sb-best', text: 'cheapest' }));
      let sub = `${m.country}${m.region ? '/' + m.region : ''} · ${m.source} · ${r.rate == null ? '—' : r.rate.toFixed(3) + ' ' + m.currency}${r.located ? '' : ' · (no map area)'}`;
      if (usage) sub += r._cost == null ? ' · cost n/a' : ` · ~${Math.round(r._cost).toLocaleString()} ${m.currency}/yr`;
      const subEl = h('div', { class: 'sb-sub', text: sub });
      if (usage && currentCost != null && r._cost != null && !isCurrent && m.currency === (plans.find((p) => p.id === state.currentPlanId) || {}).meta.currency) {
        const d = r._cost - currentCost;
        subEl.appendChild(h('span', { class: d < 0 ? 'sb-save' : 'sb-cost', text: ` · ${d < 0 ? 'save ' : '+'}${Math.abs(Math.round(d)).toLocaleString()} ${m.currency}/yr` }));
      }
      const row = h('div', { class: 'sb-row' + (r.located ? '' : ' sb-nolocate') + (best && !isCurrent ? ' sb-bestrow' : '') + (isCurrent ? ' sb-currow' : ''), onclick: () => OET.focusPlan(r.id) },
        [sw, h('div', {}, [h('div', { class: 'sb-title' }, kids), subEl])]);
      list.appendChild(row);
    }
    if (arr.length > cap) list.appendChild(h('div', { class: 'sb-more', text: `…and ${arr.length - cap} more (refine filters)` }));
  }

  function apply() {
    const { pred, note, focus } = buildPredicate();
    const visible = plans.filter(pred);
    OET.applyPlanFilter(pred);
    renderList(visible);
    count.textContent = `${visible.length} / ${plans.length}${note ? ' · ' + note : ''}`;
    if (focus && OET._map) OET._map.setView(focus, 11);
  }

  apply();
};
