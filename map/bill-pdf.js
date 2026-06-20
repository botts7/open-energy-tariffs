// Best-effort PDF bill parser: extract the total kWh from an uploaded electricity
// bill to pre-fill the usage for the cost comparison. Bill layouts vary wildly,
// so this is a heuristic ASSIST (the user verifies/adjusts), not a guarantee.
// pdf.js is lazy-loaded (pinned + SRI) only when a PDF is actually uploaded.
window.OET = window.OET || {};

const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
const PDFJS_SRI = 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e';

OET._pdfjs = null;
function ensurePdfjs() {
  if (OET._pdfjs) return OET._pdfjs;
  OET._pdfjs = new Promise((resolve) => {
    if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return resolve(window.pdfjsLib); }
    const s = document.createElement('script');
    s.src = PDFJS; s.integrity = PDFJS_SRI; s.crossOrigin = 'anonymous';
    s.onload = () => { if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; resolve(window.pdfjsLib || null); };
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return OET._pdfjs;
}

// arrayBuffer -> { totalKwh, currencyTotal, text }. totalKwh = the largest "<n> kWh"
// figure on the bill (usually the period's total usage).
OET.parseBillPdf = async function (arrayBuffer) {
  const lib = await ensurePdfjs();
  if (!lib) throw new Error('pdf.js failed to load');
  const pdf = await lib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map((it) => it.str).join(' ') + ' ';
  }
  const kwh = Array.from(text.matchAll(/([\d][\d,]*(?:\.\d+)?)\s*kwh/gi))
    .map((m) => parseFloat(m[1].replace(/,/g, ''))).filter((n) => n > 0);
  const totalKwh = kwh.length ? Math.max.apply(null, kwh) : null;
  return { totalKwh, text };
};
