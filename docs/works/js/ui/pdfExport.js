/**
 * Renders the report HTML through the browser's print pipeline so its print CSS — A3 landscape
 * `@page`, table borders and page-break rules — is honoured and the output is a faithful match
 * for the Android app's print preview. The user picks "Save as PDF" in the print dialog.
 *
 * Web counterpart of android/.../pdf/PdfExporter.kt (which drives Android's PrintManager).
 */

import { reportFileName } from '../report.js';

const RENDER_TIMEOUT_MS = 8000;

export function printReport({ html, jobName, onStarted, onError }) {
  const previousTitle = document.title;
  // Browsers seed the "Save as PDF" file name from the document title, the way Android seeds it
  // from the print job name.
  document.title = jobName;

  const restoreTitle = () => {
    document.title = previousTitle;
  };

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';

  let settled = false;
  const failsafe = setTimeout(() => {
    if (settled) return;
    settled = true;
    cleanup();
    onError('The report took too long to render');
  }, RENDER_TIMEOUT_MS);

  function cleanup() {
    clearTimeout(failsafe);
    restoreTitle();
    setTimeout(() => frame.remove(), 1000);
  }

  frame.addEventListener('load', () => {
    if (settled) return;
    settled = true;
    clearTimeout(failsafe);
    try {
      const view = frame.contentWindow;
      view.focus();
      view.print();
      onStarted();
      cleanup();
    } catch (error) {
      cleanup();
      if (!openInNewTab(html, jobName)) {
        onError(error.message || 'Could not open the print preview');
        return;
      }
      onStarted();
    }
  });

  document.body.append(frame);
  frame.srcdoc = html;
}

/** Fallback for browsers that refuse to print a hidden iframe (notably iOS Safari). */
function openInNewTab(html, jobName) {
  const tab = window.open('', '_blank');
  if (!tab) return false;
  tab.document.open();
  tab.document.write(html);
  tab.document.close();
  tab.document.title = jobName;
  tab.focus();
  setTimeout(() => tab.print(), 400);
  return true;
}

export function jobNameFor(designation, engineerName) {
  return reportFileName(designation, engineerName);
}
