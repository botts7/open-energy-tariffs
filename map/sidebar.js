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

  const state = { text: '', countries: new Set(), sources: new Set(), provider: '', min: '', max: '' };

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
    search.value = ''; providerSel.value = ''; minIn.value = ''; maxIn.value = '';
    root.querySelectorAll('.sb-chip input').forEach((c) => { c.checked = false; });
    apply();
  } });

  root.appendChild(h('div', { class: 'sb-head' }, [h('strong', { text: 'Plans' }), count]));
  root.appendChild(search);
  root.appendChild(chipRow('Country', countries, state.countries));
  root.appendChild(chipRow('Source', sources, state.sources));
  root.appendChild(providerSel);
  root.appendChild(priceRow);
  root.appendChild(reset);
  root.appendChild(list);

  function predicate() {
    const q = state.text;
    const min = state.min === '' ? -Infinity : parseFloat(state.min);
    const max = state.max === '' ? Infinity : parseFloat(state.max);
    const priceOn = min > -Infinity || max < Infinity;
    return (r) => {
      if (q && r.hay.indexOf(q) === -1) return false;
      if (state.countries.size && !state.countries.has(r.meta.country)) return false;
      if (state.sources.size && !state.sources.has(r.src)) return false;
      if (state.provider && r.meta.provider !== state.provider) return false;
      if (priceOn) { if (typeof r.rate !== 'number') return false; if (r.rate < min || r.rate > max) return false; }
      return true;
    };
  }

  function renderList(visible) {
    list.textContent = '';
    const sorted = visible.slice().sort((a, b) =>
      (a.meta.country + a.meta.provider + a.meta.plan).localeCompare(b.meta.country + b.meta.provider + b.meta.plan));
    const cap = 400;
    for (const r of sorted.slice(0, cap)) {
      const m = r.meta;
      const sw = h('span', { class: 'sb-sw' }); sw.style.background = OET.rateColor(r.rate);
      const title = h('div', { class: 'sb-title' }, [h('strong', { text: m.provider }), h('span', { text: ' · ' + m.plan })]);
      const sub = h('div', { class: 'sb-sub', text:
        `${m.country}${m.region ? '/' + m.region : ''} · ${m.source} · ${r.rate == null ? '—' : r.rate.toFixed(3) + ' ' + m.currency}${r.located ? '' : ' · (no map area)'}` });
      const row = h('div', { class: 'sb-row' + (r.located ? '' : ' sb-nolocate'), onclick: () => OET.focusPlan(r.id) }, [sw, h('div', {}, [title, sub])]);
      list.appendChild(row);
    }
    if (sorted.length > cap) list.appendChild(h('div', { class: 'sb-more', text: `…and ${sorted.length - cap} more (refine filters)` }));
  }

  function apply() {
    const pred = predicate();
    const visible = plans.filter(pred);
    OET.applyPlanFilter(pred);
    renderList(visible);
    count.textContent = `${visible.length} / ${plans.length}`;
  }

  apply();
};
