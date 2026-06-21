// Top-bar universal/quick search. Searches across countries, providers, networks,
// postcodes and individual plans, and drives the app (OET.quickNav / openModalById /
// showRanking). Keyboard: ↑/↓ to move, Enter to pick, Esc to close.
window.OET = window.OET || {};

(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  let INDEX = null;
  function buildIndex() {
    const P = OET.PLANS || [];
    const countries = {}, providers = new Set(), distributors = new Set();
    for (const r of P) {
      countries[r.meta.country] = (OET.countryName ? OET.countryName(r.meta.country) : r.meta.country);
      if (r.meta.provider) providers.add(r.meta.provider);
      if (r.meta.distributor) distributors.add(r.meta.distributor);
    }
    const items = [];
    for (const cc in countries) items.push({ type: 'country', label: countries[cc], sub: 'Country', cc, key: countries[cc].toLowerCase() + ' ' + cc.toLowerCase() });
    providers.forEach((p) => items.push({ type: 'provider', label: p, sub: 'Retailer', provider: p, key: p.toLowerCase() }));
    distributors.forEach((d) => items.push({ type: 'distributor', label: d, sub: 'Network', distributor: d, key: d.toLowerCase() }));
    // Plans: index by provider · plan · country (cap kept reasonable via match-time slice)
    for (const r of P) items.push({ type: 'plan', label: `${r.meta.provider} · ${r.meta.plan}`, sub: OET.countryName ? OET.countryName(r.meta.country) : r.meta.country, id: r.id, key: r.hay || (r.meta.provider + ' ' + r.meta.plan).toLowerCase() });
    return items;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) return [];
    if (!INDEX) INDEX = buildIndex();
    const toks = q.split(/\s+/);
    const out = [];
    // a numeric query is a postcode action first
    if (/^\d{3,5}$/.test(q)) out.push({ type: 'postcode', label: 'Go to postcode ' + q, sub: 'Postcode', text: q });
    const order = { country: 0, postcode: 0, provider: 1, distributor: 2, plan: 3 };
    const matches = INDEX.filter((it) => toks.every((t) => it.key.indexOf(t) !== -1));
    matches.sort((a, b) => (order[a.type] - order[b.type]) || a.label.length - b.label.length);
    // keep a useful spread: a few of each type
    const caps = { country: 6, provider: 6, distributor: 4, plan: 8 }; const seen = {};
    for (const m of matches) { seen[m.type] = (seen[m.type] || 0) + 1; if (seen[m.type] <= caps[m.type]) out.push(m); if (out.length >= 20) break; }
    return out;
  }

  function act(it) {
    if (!it) return;
    if (it.type === 'plan' && OET.openModalById) OET.openModalById(it.id);
    else if (it.type === 'country' && OET.quickNav) OET.quickNav({ country: it.cc });
    else if (it.type === 'provider' && OET.quickNav) OET.quickNav({ provider: it.provider });
    else if (it.type === 'distributor' && OET.quickNav) OET.quickNav({ distributor: it.distributor });
    else if (it.type === 'postcode' && OET.quickNav) OET.quickNav({ text: it.text });
  }

  OET.initUniversalSearch = function () {
    const input = document.getElementById('topSearch');
    const dd = document.getElementById('topSearchDD');
    if (!input || !dd) return;
    let results = [], active = -1;
    const close = () => { dd.textContent = ''; dd.style.display = 'none'; active = -1; };
    function renderDD() {
      if (!results.length) { close(); return; }
      dd.style.display = 'block';
      dd.innerHTML = results.map((it, i) =>
        `<div class="ts-item${i === active ? ' on' : ''}" data-i="${i}"><span>${esc(it.label)}</span><span class="ts-sub">${esc(it.sub)}</span></div>`).join('');
      [...dd.querySelectorAll('.ts-item')].forEach((el) => {
        el.addEventListener('mousedown', (e) => { e.preventDefault(); act(results[+el.dataset.i]); input.value = ''; close(); input.blur(); });
      });
    }
    input.addEventListener('input', () => { results = search(input.value); active = -1; renderDD(); });
    input.addEventListener('focus', () => { if (input.value) { results = search(input.value); renderDD(); } });
    input.addEventListener('blur', () => setTimeout(close, 150));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); input.blur(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, results.length - 1); renderDD(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); renderDD(); }
      else if (e.key === 'Enter') { const it = results[active] || results[0]; if (it) { act(it); input.value = ''; close(); input.blur(); } }
    });
  };
})();
