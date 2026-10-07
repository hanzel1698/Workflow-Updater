/**
 * Loads the bulk Excel → PDF screen's libraries on first use. They are classic scripts kept in
 * ../vendor/ (copied from cdnjs, so the screen still works where a CDN is blocked, and offline
 * once visited) and only fetched when that screen opens: ~700 KB that the works list never needs.
 *
 *   xlsx.mini.min.js               SheetJS 0.18.5 (Apache-2.0) — reads the .xlsx
 *   jspdf.umd.min.js               jsPDF 2.5.1 (MIT) — writes the PDF
 *   jspdf.plugin.autotable.min.js  jsPDF-AutoTable 3.8.4 (MIT) — the report table
 *   jszip.min.js                   JSZip 3.10.1 (MIT) — the "one ZIP" download
 */

const loaded = new Map();

function loadScript(src) {
  if (!loaded.has(src)) {
    loaded.set(
      src,
      new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = new URL(`../vendor/${src}`, import.meta.url).href;
        script.async = false; // keep jsPDF ahead of its AutoTable plugin
        script.onload = () => resolve();
        script.onerror = () => {
          loaded.delete(src);
          script.remove();
          reject(new Error(`Could not load ${src} — check the connection and try again`));
        };
        document.head.append(script);
      }),
    );
  }
  return loaded.get(src);
}

/** @returns {Promise<object>} the SheetJS `XLSX` namespace */
export async function loadSheetJs() {
  await loadScript('xlsx.mini.min.js');
  return window.XLSX;
}

/** @returns {Promise<Function>} the jsPDF constructor, with AutoTable applied */
export async function loadJsPdf() {
  await loadScript('jspdf.umd.min.js');
  await loadScript('jspdf.plugin.autotable.min.js');
  const { jsPDF } = window.jspdf;
  if (typeof jsPDF.API.autoTable !== 'function' && typeof window.jspdf_autotable?.applyPlugin === 'function') {
    window.jspdf_autotable.applyPlugin(jsPDF);
  }
  return jsPDF;
}

/** @returns {Promise<Function>} the JSZip constructor */
export async function loadJsZip() {
  await loadScript('jszip.min.js');
  return window.JSZip;
}
