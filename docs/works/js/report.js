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

/** The report itself, without any surrounding document. */
export function buildReportBody(works, profile, engineerName) {
  const title = reportTitle(profile.id, engineerName);

  const bodyRows = STATUS_OPTIONS.map((status) => {
    const groupWorks = works.filter((work) => work.status === status);
    const suffix = groupWorks.length === 1 ? 'WORK' : 'WORKS';
    const heading =
      `<tr class="status-group-row"><td colspan="14">` +
      `${escapeHtml(`${status.toUpperCase()} : ${groupWorks.length} ${suffix}`)}` +
      `</td></tr>`;

    if (groupWorks.length === 0) {
      return (
        heading +
        '<tr class="nil-row"><td style="color:#94a3b8;font-style:italic;font-weight:500;font-size:8.5pt;padding:8px;">NIL</td>' +
        '<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
      );
    }

    return heading + groupWorks.map(taskRow).join('');
  }).join('');

  return `<div class="report-root">
  <div class="header-container"><h1>${escapeHtml(title)}</h1></div>
  <p class="total-works-summary">Total number of works: ${works.length}</p>
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
export function buildReportHtml(works, profile, engineerName) {
  const title = reportTitle(profile.id, engineerName);
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
${buildReportBody(works, profile, engineerName)}
</body>
</html>`;
}

function taskRow(work) {
  return (
    '<tr>' +
    `<td>${cell(work.workName)}</td>` +
    `<td>${cell(work.district)}</td>` +
    `<td>${cell(work.lac)}</td>` +
    `<td class="center">${cell(work.asStatus)}</td>` +
    `<td class="center">${cell(work.arStatus)}</td>` +
    `<td class="center">${cell(work.srStatus)}</td>` +
    `<td class="center">${cell(work.floors)}</td>` +
    `<td class="center">${cell(work.area)}</td>` +
    `<td class="center">${cell(work.se)}</td>` +
    `<td class="remarks-cell">${cell(work.remarks)}</td>` +
    `<td class="center">${cell(formatDate(work.targetDate))}</td>` +
    `<td class="center">${cell(formatDate(work.tentativeIssuedDate))}</td>` +
    `<td class="center">${cell(formatDate(work.detailedLastIssuedDate))}</td>` +
    `<td class="center">${cell(formatDate(work.detailedCompleteIssuedDate))}</td>` +
    '</tr>'
  );
}

function cell(value) {
  const trimmed = (value || '').trim();
  return escapeHtml(trimmed === '' ? '-' : trimmed);
}

function formatDate(value) {
  const formatted = SheetDateFormatter.format(value);
  return formatted === '' ? '-' : formatted;
}

function todayFormatted(now = new Date()) {
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
export function reportFileName(designation, engineerName) {
  return `${reportTitle(designation, engineerName).replace(/[\\/:*?"<>|]/g, '-')}`;
}
