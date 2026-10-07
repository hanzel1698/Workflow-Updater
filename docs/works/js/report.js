/**
 * Renders the same grouped, print-ready A3 report as the Android app's "Export PDF" action and
 * the Windows dashboard's "Download PDF Report", so a work handled by an engineer looks identical
 * whether it was exported from the desktop, the phone or the browser.
 * Ported from android/.../pdf/PdfReportBuilder.kt.
 */

import { STATUS_OPTIONS } from './config.js';
import { SheetDateFormatter } from './model.js';

export function reportTitle(designation, engineerName, date = todayFormatted()) {
  return `PROGRESS REPORT - ${designation.trim().toUpperCase()} - ${engineerName.trim()} - AS ON ${date}.`;
}

/**
 * Report styles, scoped to `.report-root` so the same markup can be printed either as a
 * standalone document or injected into the app's own page.
 */
export const REPORT_CSS = `
.report-root {
  font-family: 'Segoe UI', Roboto, sans-serif;
  color: #1e293b;
  background: white;
  font-size: 10.5pt;
  line-height: 1.35;
}
.report-root .header-container {
  text-align: center;
  margin-bottom: 25px;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 12px;
}
.report-root h1 {
  font-size: 16pt;
  margin: 0;
  color: #0f172a;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.report-root .total-works-summary {
  text-align: left;
  font-size: 10pt;
  font-weight: 600;
  color: #334155;
  margin: 10px 0 0 0;
}
.report-root table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  page-break-inside: auto;
  margin-top: 10px;
}
.report-root tr { page-break-inside: avoid; page-break-after: auto; }
.report-root thead { display: table-header-group; }
.report-root th {
  background-color: #f1f5f9;
  border: 1px solid #000000;
  color: #0f172a;
  font-weight: 600;
  text-align: left;
  padding: 6px 8px;
  font-size: 9.5pt;
  text-transform: uppercase;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.report-root td {
  border: 1px solid #000000;
  padding: 6px 8px;
  font-size: 9.8pt;
  vertical-align: top;
  word-wrap: break-word;
}
.report-root .report-scope-note {
  text-align: left;
  font-size: 10pt;
  font-weight: 600;
  color: #334155;
  margin: 4px 0 0 0;
}
.report-root .status-group-row {
  background-color: #e2e8f0 !important;
  font-weight: 700;
  color: #0f172a;
  font-size: 10.5pt;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  page-break-after: avoid !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.report-root .status-group-row td { border: 1px solid #000000; padding: 8px 10px; }
.report-root .center { text-align: center; }
.report-root th.date-col { font-size: 8.5pt; line-height: 1.2; text-align: center; }
.report-root .remarks-cell { font-size: 9.5pt; color: #334155; }
`;

/** Page setup for the grouped report: A3 landscape, matching the Android print job. */
export const REPORT_PAGE_CSS = '@page { size: A3 landscape; margin: 1cm; }';

/**
 * Columns in the report table. The NIL row's filler cells are counted from this rather than
 * written out by hand: a row one cell short leaves the last column with no cell at all, and
 * an absent cell draws no borders, so the printed table ends in a gap.
 */
const COLUMN_COUNT = 14; // REPORT_COLUMNS.length, asserted by the tests

/**
 * The status groups the report prints, in canonical order.
 *
 * With design-status chips picked, the report covers exactly those statuses — every work in each
 * one, and no group for a status that was filtered out. Printing "01 TENTATIVE DESIGN ONGOING :
 * 0 WORKS / NIL" under a report the reader was told is about detailed design reads as a finding
 * about the office rather than a consequence of the filter. With no chips picked, nothing is
 * excluded, so every status is listed and the empty ones stay as NIL.
 */
function reportStatuses(statusCodes) {
  if (statusCodes.length === 0) return STATUS_OPTIONS;
  return STATUS_OPTIONS.filter((status) => statusCodes.includes(status.slice(0, 2)));
}

/**
 * The report's columns, in order: header label, width in the report's px grid (the HTML colgroup;
 * the PDF scales the same proportions onto the page), alignment of the body cells and whether the
 * header is one of the small two-line date headers.
 */
export const REPORT_COLUMNS = [
  { label: 'Name of Work', width: 350, align: 'left', value: (w) => w.workName },
  { label: 'District', width: 120, align: 'left', value: (w) => w.district },
  { label: 'LAC', width: 100, align: 'left', value: (w) => w.lac },
  { label: 'AS Status', width: 80, align: 'center', value: (w) => w.asStatus },
  { label: 'AR Status', width: 80, align: 'center', value: (w) => w.arStatus },
  { label: 'SR Status', width: 80, align: 'center', value: (w) => w.srStatus },
  { label: 'No. of Floors', width: 90, align: 'center', value: (w) => w.floors },
  { label: 'Total Area (m\u00b2)', width: 110, align: 'center', headerAlign: 'center', value: (w) => w.area },
  { label: 'SE', width: 80, align: 'center', value: (w) => w.se },
  { label: 'Remarks by Building Design Unit', width: 395, align: 'left', remarks: true, value: (w) => w.remarks },
  { label: 'Target Date', width: 105, align: 'center', dateHeader: true, value: (w) => formatDate(w.targetDate) },
  { label: 'Tentative Issued Date', width: 105, align: 'center', dateHeader: true, value: (w) => formatDate(w.tentativeIssuedDate) },
  {
    label: 'Detailed Design Last Issued Date',
    width: 115,
    align: 'center',
    dateHeader: true,
    value: (w) => formatDate(w.detailedLastIssuedDate),
  },
  {
    label: 'Detailed Design Complete Issued Date',
    width: 115,
    align: 'center',
    dateHeader: true,
    value: (w) => formatDate(w.detailedCompleteIssuedDate),
  },
];

/**
 * Everything the report says, independent of how it is drawn: the print view (HTML) and the bulk
 * PDF writer (js/pdfDocument.js) both render this, so the two can never disagree on a title,
 * a group, a count or a cell.
 *
 * Each group's `rows` holds the plain cell text for every work, blanks already turned into "-";
 * an empty group has no rows and is printed as NIL.
 */
export function buildReportModel(works, profile, engineerName, { statusCodes = [], date } = {}) {
  const statuses = reportStatuses(statusCodes);
  return {
    title: reportTitle(profile.id, engineerName, date),
    totalWorks: works.length,
    // Naming the picked statuses keeps a narrowed report honest: without it a reader has no way
    // to tell a report covering two statuses from one where the office happens to have works in two.
    scopeNote: statuses.length === STATUS_OPTIONS.length ? '' : `Design status: ${statuses.join('; ')}`,
    groups: statuses.map((status) => {
      const groupWorks = works.filter((work) => work.status === status);
      const suffix = groupWorks.length === 1 ? 'WORK' : 'WORKS';
      return {
        heading: `${status.toUpperCase()} : ${groupWorks.length} ${suffix}`,
        rows: groupWorks.map((work) => REPORT_COLUMNS.map((column) => cellText(column.value(work)))),
      };
    }),
  };
}

/** The report itself, without any surrounding document. */
export function buildReportBody(works, profile, engineerName, options = {}) {
  const model = buildReportModel(works, profile, engineerName, options);

  const bodyRows = model.groups.map((group) => {
    const heading =
      `<tr class="status-group-row"><td colspan="${COLUMN_COUNT}">` +
      `${escapeHtml(group.heading)}` +
      `</td></tr>`;

    if (group.rows.length === 0) {
      return (
        heading +
        '<tr class="nil-row"><td style="color:#94a3b8;font-style:italic;font-weight:500;font-size:8.5pt;padding:8px;">NIL</td>' +
        '<td></td>'.repeat(COLUMN_COUNT - 1) +
        '</tr>'
      );
    }

    return heading + group.rows.map(taskRow).join('');
  }).join('');

  const scopeNote = model.scopeNote === '' ? '' : `\n  <p class="report-scope-note">${escapeHtml(model.scopeNote)}</p>`;

  return `<div class="report-root">
  <div class="header-container"><h1>${escapeHtml(model.title)}</h1></div>
  <p class="total-works-summary">Total number of works: ${model.totalWorks}</p>${scopeNote}
  <table>
    <colgroup>
      <col style="width: 350px" /><col style="width: 120px" /><col style="width: 100px" />
      <col style="width: 80px" /><col style="width: 80px" /><col style="width: 80px" />
      <col style="width: 90px" /><col style="width: 110px" /><col style="width: 80px" />
      <col style="width: 395px" /><col style="width: 105px" /><col style="width: 105px" />
      <col style="width: 115px" /><col style="width: 115px" />
    </colgroup>
    <thead>
      <tr>
        <th>Name of Work</th>
        <th>District</th>
        <th>LAC</th>
        <th>AS Status</th>
        <th>AR Status</th>
        <th>SR Status</th>
        <th>No. of Floors</th>
        <th class="center">Total Area (m&sup2;)</th>
        <th>SE</th>
        <th>Remarks by Building Design Unit</th>
        <th class="date-col">Target Date</th>
        <th class="date-col">Tentative Issued Date</th>
        <th class="date-col">Detailed Design Last Issued Date</th>
        <th class="date-col">Detailed Design Complete Issued Date</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
</div>`;
}

/** The report as a complete, standalone printable document. */
export function buildReportHtml(works, profile, engineerName, options = {}) {
  const title = reportTitle(profile.id, engineerName, options.date);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    html, body { margin: 0; padding: 0; background: white; }
    body { margin: 1.5cm; }
    ${REPORT_CSS}
    @media print {
      body { margin: 1cm; }
    }
    ${REPORT_PAGE_CSS}
  </style>
</head>
<body>
${buildReportBody(works, profile, engineerName, options)}
</body>
</html>`;
}

function taskRow(cells) {
  const cellClass = (column) => (column.remarks ? ' class="remarks-cell"' : column.align === 'center' ? ' class="center"' : '');
  return `<tr>${cells.map((text, i) => `<td${cellClass(REPORT_COLUMNS[i])}>${escapeHtml(text)}</td>`).join('')}</tr>`;
}

function cellText(value) {
  const trimmed = (value || '').trim();
  return trimmed === '' ? '-' : trimmed;
}

function formatDate(value) {
  const formatted = SheetDateFormatter.format(value);
  return formatted === '' ? '-' : formatted;
}

export function todayFormatted(now = new Date()) {
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${now.getFullYear()}`;
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** File name for the browser's "Save as PDF" flow, matching the Android print job name. */
export function reportFileName(designation, engineerName, date) {
  return `PR-BUILDINGS - ${designation.trim().toUpperCase()} - ${engineerName.trim()} - as on ${date ?? todayFormatted()}`.replace(/[\\/:*?"<>|]/g, '-');
}
