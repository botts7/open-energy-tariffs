// Guided "find my best plan" flow: location -> usage -> ranked table. A friendly
// front door over the same filters/usage the sidebar exposes (OET.quickNav /
// setUsage / setView). Inspired by Victorian Energy Compare's wizard.
window.OET = window.OET || {};

(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  let back = null, step = 1, loc = null, pcText = '', kwh = '';
  const PRESETS = [['Small home', '~1–2 people', 3000], ['Medium', '~3–4 people', 5000], ['Large / electric heat', '5+ people', 8000], ['Not sure', 'use a typical profile', 4000]];

  function injectCss() {
    if (document.getElementById('oet-wz-css')) return;
    const s = document.createElement('style'); s.id = 'oet-wz-css';
    s.textContent =
      '.oet-wzback{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:10002;padding:20px}'
      + '.oet-wz{background:var(--panel,#fff);color:var(--text,#1a2233);border-radius:12px;max-width:460px;width:100%;box-shadow:0 12px 44px rgba(0,0,0,.45);font-size:14px;overflow:hidden}'
      + '.oet-wzh{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border,#e2e8f0)}'
      + '.oet-wzh h2{margin:0;font-size:17px}.oet-wzx{border:none;background:var(--hover,#f1f5f9);color:var(--text);border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:17px}'
      + '.oet-wzb{padding:16px 18px}.oet-wzb p{margin:0 0 12px;color:var(--muted,#64748b)}'
      + '.oet-wzbtn{display:block;width:100%;text-align:left;padding:11px 13px;margin:7px 0;border:1px solid var(--input-bd,#cbd5e1);background:var(--chip,#f8fafc);color:var(--text);border-radius:9px;cursor:pointer;font-size:14px}'
      + '.oet-wzbtn:hover{background:var(--hover,#f1f5f9);border-color:var(--accent,#2563eb)}'
      + '.oet-wzbtn.on{border-color:var(--accent,#2563eb);background:rgba(37,99,235,.1)}'
      + '.oet-wzbtn small{display:block;color:var(--muted,#64748b);font-size:12px;margin-top:2px}'
      + '.oet-wzin{width:100%;padding:10px 12px;border:1px solid var(--input-bd,#cbd5e1);border-radius:8px;font-size:14px;background:var(--input-bg,#fff);color:var(--text);margin:4px 0}'
      + '.oet-wzf{display:flex;justify-content:space-between;gap:8px;padding:12px 18px;border-top:1px solid var(--border,#e2e8f0)}'
      + '.oet-wzg{padding:6px 14px;border-radius:8px;border:1px solid var(--input-bd,#cbd5e1);background:transparent;color:var(--text);cursor:pointer;font-size:13px}'
      + '.oet-wzg.primary{background:#2563eb;border-color:#2563eb;color:#fff;font-weight:600}'
      + '.oet-wznote{font-size:12px;color:#15803d;margin-top:6px}';
    document.head.appendChild(s);
  }

  function close() { if (back) { back.remove(); back = null; document.removeEventListener('keydown', onKey); } }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function finish() {
    const action = {};
    if (loc) { action.country = loc.cc; if (loc.cc === 'AU' && loc.postcode) action.text = loc.postcode; }
    else if (pcText) { action.text = pcText; }
    if (OET.quickNav && (action.country || action.text)) OET.quickNav(action);
    if (OET.setUsage) OET.setUsage(kwh ? parseFloat(kwh) : 4000, 'flat');
    if (OET.setView) OET.setView('table');
    close();
  }

  function render() {
    const body = back.querySelector('.oet-wzb'), foot = back.querySelector('.oet-wzf');
    if (step === 1) {
      body.innerHTML = '<p>Where are you? This finds the plans that serve your area.</p>'
        + '<button class="oet-wzbtn" id="wz-loc">📡 Use my location<small>fastest — no typing</small></button>'
        + '<div style="text-align:center;color:var(--muted);font-size:12px;margin:6px 0">or</div>'
        + `<input class="oet-wzin" id="wz-pc" inputmode="numeric" placeholder="Enter your postcode" value="${esc(pcText)}" />`
        + '<div class="oet-wznote" id="wz-locnote" style="display:none"></div>';
      foot.innerHTML = '<button class="oet-wzg" id="wz-skip">Skip — just browse</button><button class="oet-wzg primary" id="wz-next">Next →</button>';
      body.querySelector('#wz-loc').addEventListener('click', (e) => {
        const b = e.currentTarget, note = body.querySelector('#wz-locnote');
        if (!navigator.geolocation) { note.style.display = ''; note.style.color = '#dc2626'; note.textContent = 'Geolocation not available — enter a postcode'; return; }
        b.textContent = 'Locating…';
        navigator.geolocation.getCurrentPosition((pos) => {
          (OET.reverseGeocode ? OET.reverseGeocode(pos.coords.latitude, pos.coords.longitude) : Promise.resolve(null)).then((res) => {
            if (res) { loc = res; pcText = ''; note.style.display = ''; note.textContent = '✓ ' + (res.label || 'Located').split(',').slice(0, 3).join(', '); step = 2; render(); }
            else { b.innerHTML = '📡 Use my location<small>couldn’t resolve — try a postcode</small>'; }
          });
        }, () => { b.innerHTML = '📡 Use my location<small>blocked — enter a postcode</small>'; }, { timeout: 10000, maximumAge: 600000 });
      });
      const pc = body.querySelector('#wz-pc');
      pc.addEventListener('input', () => { pcText = pc.value.trim(); loc = null; });
      pc.addEventListener('keydown', (e) => { if (e.key === 'Enter') { step = 2; render(); } });
      foot.querySelector('#wz-skip').addEventListener('click', () => { if (OET.setView) OET.setView('table'); close(); });
      foot.querySelector('#wz-next').addEventListener('click', () => { step = 2; render(); });
    } else {
      body.innerHTML = '<p>Roughly how much electricity do you use? This makes the cost estimates yours.</p>'
        + PRESETS.map(([t, sub, v]) => `<button class="oet-wzbtn${String(kwh) === String(v) ? ' on' : ''}" data-kwh="${v}">${esc(t)}<small>${esc(sub)} · ~${v.toLocaleString()} kWh/yr</small></button>`).join('')
        + `<input class="oet-wzin" id="wz-kwh" inputmode="numeric" placeholder="or enter exact annual kWh" value="${kwh && !PRESETS.some((p) => String(p[2]) === String(kwh)) ? esc(kwh) : ''}" />`;
      foot.innerHTML = '<button class="oet-wzg" id="wz-back2">← Back</button><button class="oet-wzg primary" id="wz-go">Show my best plans</button>';
      body.querySelectorAll('[data-kwh]').forEach((b) => b.addEventListener('click', () => { kwh = b.dataset.kwh; render(); }));
      body.querySelector('#wz-kwh').addEventListener('input', (e) => { kwh = e.target.value.trim(); });
      foot.querySelector('#wz-back2').addEventListener('click', () => { step = 1; render(); });
      foot.querySelector('#wz-go').addEventListener('click', finish);
    }
  }

  OET.showWizard = function () {
    injectCss(); close(); step = 1; loc = null; pcText = ''; kwh = '';
    back = document.createElement('div'); back.className = 'oet-wzback';
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    back.innerHTML = '<div class="oet-wz" role="dialog" aria-label="Find my best plan">'
      + '<div class="oet-wzh"><h2>✨ Find my best plan</h2><button class="oet-wzx" aria-label="Close">×</button></div>'
      + '<div class="oet-wzb"></div><div class="oet-wzf"></div></div>';
    document.body.appendChild(back);
    back.querySelector('.oet-wzx').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    render();
  };
})();
