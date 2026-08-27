/**
 * Prints the grouped report through the browser's own print pipeline, so its print CSS —
 * A3 landscape `@page`, table borders and page-break rules — is honoured and the output matches
 * the Android app's print preview. The user then picks "Save as PDF".
 *
 * Web counterpart of android/.../pdf/PdfExporter.kt (which drives Android's PrintManager).
 *
 * The report is rendered into the app's own document rather than a hidden iframe. An iframe
 * sized 0x0 (or hidden with `visibility`) is never laid out, so its document has zero height and
 * the browser prints a blank page; giving it a real size means a visible flash, and printing
 * across documents is unreliable on mobile browsers. Printing the host document sidesteps all of
 * that: a print stylesheet hides the app and shows only the report.
 */

import { REPORT_CSS, REPORT_PAGE_CSS, reportFileName } from '../report.js';

const CONTAINER_ID = 'print-report';
const STYLE_ID = 'print-report-styles';

function printStyles() {
  return `
/* Hidden on screen; the print rules below reveal it and hide everything else. */
#${CONTAINER_ID} { display: none; }

@media print {
  /* Only the report goes on paper — not the app shell, sheets, dialogs or toasts. */
  body > *:not(#${CONTAINER_ID}) { display: none !important; }

  html, body {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
    height: auto !important;
    overflow: visible !important;
    background: #ffffff !important;
  }

  #${CONTAINER_ID} { display: block !important; margin: 0; }

  ${REPORT_CSS}

  ${REPORT_PAGE_CSS}
}
`;
}

/**
 * @param {{ html: string, jobName: string, onStarted: () => void, onError: (message: string) => void }} options
 *   `html` is the report body markup from `buildReportBody`.
 */
export function printReport({ html, jobName, onStarted, onError }) {
  const previousTitle = document.title;

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.removeEventListener('afterprint', cleanup);
    document.getElementById(CONTAINER_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.title = previousTitle;
  };

  try {
    // Browsers seed the "Save as PDF" file name from the document title, the way Android seeds
    // it from the print job name.
    document.title = jobName;

    document.getElementById(CONTAINER_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = printStyles();
    document.head.append(style);

    const container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.setAttribute('aria-hidden', 'true');
    container.innerHTML = html;
    document.body.append(container);

    window.addEventListener('afterprint', cleanup);
    // Safety net: `afterprint` does not fire everywhere, and never fires if the user dismisses
    // the dialog on some mobile browsers.
    setTimeout(cleanup, 60000);

    if (typeof window.print !== 'function') {
      cleanup();
      onError('This browser cannot open a print dialog');
      return;
    }

    onStarted();
    window.print();
  } catch (error) {
    cleanup();
    onError(error.message || 'Could not open the print preview');
  }
}

export function jobNameFor(designation, engineerName) {
  return reportFileName(designation, engineerName);
}
