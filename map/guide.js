// In-page user guide / onboarding overlay. Opened by the header "?" button, and
// auto-shown once on a visitor's first load (localStorage 'oet-guide-seen').
// Self-contained: own namespaced CSS, var() themed for light/dark, Esc/backdrop
// close. Honest about data maturity so users know what they're looking at.
window.OET = window.OET || {};

(function () {
  const REPO = 'https://github.com/botts7/open-energy-tariffs';

  function injectCss() {
    if (document.getElementById('oet-guide-css')) return;
    const s = document.createElement('style');
    s.id = 'oet-guide-css';
    s.textContent =
      '.oet-gback{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:10001;padding:20px}'
      + '.oet-guide{background:var(--panel,#fff);color:var(--text,#1a2233);border-radius:12px;max-width:600px;width:100%;max-height:88vh;overflow:auto;box-shadow:0 12px 44px rgba(0,0,0,.45);font-size:13.5px;line-height:1.5}'
      + '.oet-ghead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--border,#e2e8f0);position:sticky;top:0;background:var(--panel,#fff)}'
      + '.oet-ghead h2{margin:0;font-size:17px;display:flex;align-items:center;gap:9px}'
      + '.oet-gx{border:none;background:var(--hover,#f1f5f9);color:var(--text,#1a2233);border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:17px;flex:none}'
      + '.oet-gbody{padding:6px 18px 16px}'
      + '.oet-gsec{margin:16px 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted,#64748b);font-weight:700}'
      + '.oet-guide p{margin:6px 0}.oet-guide b{color:var(--text,#0f172a)}'
      + '.oet-guide ul{margin:6px 0;padding-left:20px}.oet-guide li{margin:4px 0}'
      + '.oet-guide a{color:var(--accent,#2563eb)}'
      + '.oet-gwarn{background:rgba(234,179,8,.14);border:1px solid rgba(234,179,8,.45);border-radius:8px;padding:10px 12px;margin:10px 0}'
      + '.oet-gwarn b{color:inherit}'
      + '.oet-gfoot{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding:12px 18px;border-top:1px solid var(--border,#e2e8f0);position:sticky;bottom:0;background:var(--panel,#fff)}'
      + '.oet-gbtn{padding:8px 16px;border-radius:7px;border:1px solid var(--input-bd,#cbd5e1);background:var(--chip,#f8fafc);color:var(--text,#1a2233);cursor:pointer;font-size:13px;text-decoration:none;display:inline-block}'
      + '.oet-gbtn.primary{background:#2563eb;border-color:#2563eb;color:#fff}'
      + '.oet-gkbd{font:inherit;background:var(--hover,#f1f5f9);border:1px solid var(--border,#e2e8f0);border-radius:4px;padding:0 5px}';
    document.head.appendChild(s);
  }

  let backdrop = null;
  function close() { if (backdrop) { backdrop.remove(); backdrop = null; document.removeEventListener('keydown', onKey); } }
  function onKey(e) { if (e.key === 'Escape') close(); }

  OET.showGuide = function () {
    injectCss();
    close();
    backdrop = document.createElement('div');
    backdrop.className = 'oet-gback';
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    backdrop.innerHTML =
      '<div class="oet-guide" role="dialog" aria-label="How to use this site">'
      + '<div class="oet-ghead"><h2><img src="favicon.svg" width="24" height="24" alt=""/> Welcome to open·energy·tariffs</h2>'
      + '<button class="oet-gx" aria-label="Close">×</button></div>'
      + '<div class="oet-gbody">'
      + '<p>A free, community map of <b>electricity plans</b> you can browse, filter and compare against your own usage — no account, nothing leaves your browser.</p>'

      + '<div class="oet-gwarn">⚠️ <b>How complete is the data?</b> Australia has <b>thousands of real plans</b> (from the AER open-data feed). Most other countries currently have only <b>1–3 example plans</b> with <b>approximate, unverified rates</b> — they show the shape, not the exact price. Every plan lists its <b>source &amp; date</b>; treat anything marked <i>verified: no</i> as a guide and <b>always check your own bill.</b></div>'

      + '<div class="oet-gsec">1 · Compare against your usage</div>'
      + '<p>Open the sidebar and tell it what you use — any one of:</p>'
      + '<ul>'
      + '<li><b>Annual kWh</b> + a usage shape, or per-band <b>peak / shoulder / off-peak</b> daily averages,</li>'
      + '<li>or <b>upload your meter CSV</b> (your distributor’s interval export) / a <b>bill PDF</b>.</li>'
      + '<li>Set <b>“my current plan”</b> (or your actual annual $) as the baseline to see <b>savings</b>.</li>'
      + '</ul>'

      + '<div class="oet-gsec">2 · Browse &amp; filter</div>'
      + '<ul>'
      + '<li>Narrow by <b>country → distributor → provider</b>, <b>flat vs time-of-use</b>, and <b>sort cheapest-first</b> for your usage.</li>'
      + '<li>Search the box for an <b>address, postcode, suburb or provider</b> — the map zooms and lists the plans serving that spot.</li>'
      + '</ul>'

      + '<div class="oet-gsec">3 · Read a plan</div>'
      + '<p>Click any plan for the full <b>rate bands &amp; time-of-use schedule</b>, a per-band <b>cost breakdown</b> for your usage, and a <b>side-by-side</b> vs your current plan (green = cheaper, red = dearer). <b>+ Compare</b> stacks several plans column-by-column.</p>'

      + '<div class="oet-gsec">4 · The map</div>'
      + '<p>Coverage areas are coloured by rate. Pick a country/postcode to draw them; click a plan to zoom. Use <span class="oet-gkbd">◐</span> for light/dark and the layer control (top-right) for street/satellite.</p>'

      + '<div class="oet-gsec">Help grow it</div>'
      + '<p>Plans are crowd-sourced. If yours is missing or out of date, <a href="' + REPO + '/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener">add it via a quick pull request</a> — structure only, never account or meter numbers.</p>'

      + '</div>'
      + '<div class="oet-gfoot">'
      + '<a class="oet-gbtn" href="' + REPO + '" target="_blank" rel="noopener">View on GitHub ↗</a>'
      + '<button class="oet-gbtn primary" data-close>Got it</button>'
      + '</div></div>';
    document.body.appendChild(backdrop);
    backdrop.querySelector('.oet-gx').addEventListener('click', close);
    backdrop.querySelector('[data-close]').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    try { localStorage.setItem('oet-guide-seen', '1'); } catch (_) {}
  };

  // First-visit auto-open (once). Delayed so it doesn't fight initial map paint.
  OET.maybeAutoGuide = function () {
    let seen = null; try { seen = localStorage.getItem('oet-guide-seen'); } catch (_) {}
    if (!seen) setTimeout(OET.showGuide, 800);
  };
})();
