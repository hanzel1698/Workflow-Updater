/**
 * Draws the grouped A3 report straight into a PDF file with jsPDF + AutoTable, for the bulk
 * Excel → PDF screen, where one tap has to produce a file per engineer — something the browser's
 * print dialog (one document per dialog, saved by hand) cannot do.
 *
 * Renders the same model as the print view (buildReportModel in report.js) and copies its
 * REPORT_CSS layout: A3 landscape with 1 cm margins, the colgroup's column proportions, the same
 * fills and black 1px rules, the column header repeated on every page, and no row split across a
 * page break. Body text is set a touch smaller than the print view's 9.8pt, because the PDF's
 * Helvetica runs wider than the Segoe UI the print view gets on Windows, and a word that still
 * cannot fit its column is shrunk rather than broken ("Receive-d").
 *
 * jsPDF is passed in rather than imported, since it is a classic script loaded on demand
 * (see vendor.js).
 */

import { REPORT_COLUMNS } from './report.js';

const PT_PER_PX = 0.75;
const MARGIN = 28.35; // 1 cm

const INK = [30, 41, 59]; // #1e293b
const HEADING_INK = [15, 23, 42]; // #0f172a
const SUMMARY_INK = [51, 65, 85]; // #334155
const NIL_INK = [148, 163, 184]; // #94a3b8
const HEAD_FILL = [241, 245, 249]; // #f1f5f9
const GROUP_FILL = [226, 232, 240]; // #e2e8f0
const RULE = [0, 0, 0];

const BODY_SIZE = 9;
const REMARKS_SIZE = 8.8;
/** The smallest a cell's text is shrunk to so that its longest word fits the column. */
const MIN_FIT_SIZE = 6.5;
const PAD_X = 4;
const PAD_Y = 4;

/** Ceiling on layout passes; each pass fixes one stranded heading, and a report has nine groups. */
const MAX_LAYOUT_PASSES = 20;

/**
 * @param {Function} jsPDF   the jsPDF constructor, with the AutoTable plugin applied
 * @param {ReturnType<import('./report.js').buildReportModel>} model
 * @returns the finished jsPDF document
 */
export function renderReportPdf(jsPDF, model) {
  const rows = flattenRows(model);

  // A status heading must not sit alone at the foot of a page with its first work overleaf
  // (the print view's `page-break-after: avoid`). AutoTable has no keep-with-next, so lay the
  // report out, find the first stranded heading, start a fresh page there and lay it out again.
  const breaks = new Set();
  for (let pass = 0; ; pass += 1) {
    const { doc, strandedHeading } = layout(jsPDF, model, rows, breaks);
    if (strandedHeading === null || breaks.has(strandedHeading) || pass >= MAX_LAYOUT_PASSES) return doc;
    breaks.add(strandedHeading);
  }
}

/** Rows in print order: each group's heading, then its works or a single NIL row. */
function flattenRows(model) {
  const rows = [];
  for (const group of model.groups) {
    rows.push({ kind: 'heading', cells: [group.heading] });
    if (group.rows.length === 0) rows.push({ kind: 'nil', cells: ['NIL'] });
    else for (const cells of group.rows) rows.push({ kind: 'work', cells });
  }
  return rows;
}

function layout(jsPDF, model, rows, breaks) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3', compress: true });
  doc.setProperties({ title: pdfText(model.title), creator: 'RDO KKD Works' });
  doc.setLineHeightFactor(1.25);

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = drawHeader(doc, model, pageWidth, contentWidth);

  const totalPx = REPORT_COLUMNS.reduce((sum, column) => sum + column.width, 0);
  const columnStyles = {};
  REPORT_COLUMNS.forEach((column, i) => {
    columnStyles[i] = { cellWidth: (column.width / totalPx) * contentWidth, halign: column.align };
  });

  const head = [
    REPORT_COLUMNS.map((column) => ({
      content: pdfText(column.label.toUpperCase()),
      styles: column.dateHeader
        ? { fontSize: 8.5, halign: 'center', lineHeight: 1.2 }
        : { halign: column.headerAlign || 'left' },
    })),
  ];

  const pages = new Array(rows.length);
  const starts = [0, ...[...breaks].sort((a, b) => a - b)];

  starts.forEach((start, chunkIndex) => {
    const end = chunkIndex + 1 < starts.length ? starts[chunkIndex + 1] : rows.length;
    if (chunkIndex > 0) {
      doc.addPage();
      y = MARGIN;
    }

    doc.autoTable({
      startY: y,
      margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      tableWidth: contentWidth,
      theme: 'grid',
      head,
      body: rows.slice(start, end).map(bodyRow),
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      styles: {
        font: 'helvetica',
        fontSize: BODY_SIZE,
        textColor: INK,
        lineColor: RULE,
        lineWidth: PT_PER_PX,
        cellPadding: { top: PAD_Y, bottom: PAD_Y, left: PAD_X, right: PAD_X },
        valign: 'top',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: HEAD_FILL,
        textColor: HEADING_INK,
        fontStyle: 'bold',
        fontSize: 9.5,
        valign: 'middle',
      },
      bodyStyles: { fillColor: false },
      columnStyles,
      didParseCell: (data) => fitLongestWord(doc, data.cell, columnStyles[data.column.index].cellWidth),
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          pages[start + data.row.index] = doc.internal.getCurrentPageInfo().pageNumber;
        }
      },
    });
  });

  let strandedHeading = null;
  for (let i = 0; i < rows.length - 1; i += 1) {
    if (rows[i].kind === 'heading' && pages[i + 1] > pages[i]) {
      strandedHeading = i;
      break;
    }
  }
  return { doc, strandedHeading };
}

/** Title, its rule, the works total and any status scope note; returns where the table starts. */
function drawHeader(doc, model, pageWidth, contentWidth) {
  let y = MARGIN;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...HEADING_INK);
  const titleLines = doc.splitTextToSize(pdfText(model.title.toUpperCase()), contentWidth);
  const titleLineHeight = 16 * 1.35;
  titleLines.forEach((line, i) => {
    doc.text(line, pageWidth / 2, y + 16 + i * titleLineHeight, { align: 'center' });
  });
  y += titleLines.length * titleLineHeight + 12 * PT_PER_PX;

  doc.setDrawColor(...HEADING_INK);
  doc.setLineWidth(2 * PT_PER_PX);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 25 * PT_PER_PX + 10 * PT_PER_PX;

  doc.setFontSize(10);
  doc.setTextColor(...SUMMARY_INK);
  doc.text(pdfText(`Total number of works: ${model.totalWorks}`), MARGIN, y + 10);
  y += 10 * 1.35;

  if (model.scopeNote) {
    const noteLines = doc.splitTextToSize(pdfText(model.scopeNote), contentWidth);
    noteLines.forEach((line, i) => doc.text(line, MARGIN, y + 4 * PT_PER_PX + 10 + i * 10 * 1.35));
    y += 4 * PT_PER_PX + noteLines.length * 10 * 1.35;
  }

  return y + 10 * PT_PER_PX;
}

/** Shrinks a cell's font until its longest single word fits the column's width. */
function fitLongestWord(doc, cell, columnWidth) {
  if (cell.colSpan > 1) return;
  const words = cell.text.join(' ').split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) return;

  const padding = typeof cell.styles.cellPadding === 'number' ? cell.styles.cellPadding * 2 : PAD_X * 2;
  const available = columnWidth - padding - 0.5;
  doc.setFont('helvetica', cell.styles.fontStyle || 'normal');
  const widest = Math.max(...words.map((word) => doc.getStringUnitWidth(word)));

  const fitted = Math.max(MIN_FIT_SIZE, Math.floor((available / widest) * 10) / 10);
  if (fitted < cell.styles.fontSize) cell.styles.fontSize = fitted;
}

function bodyRow(row) {
  if (row.kind === 'heading') {
    return [
      {
        content: pdfText(row.cells[0]),
        colSpan: REPORT_COLUMNS.length,
        styles: {
          fillColor: GROUP_FILL,
          textColor: HEADING_INK,
          fontStyle: 'bold',
          fontSize: 10.5,
          halign: 'left',
          cellPadding: { top: 8 * PT_PER_PX, bottom: 8 * PT_PER_PX, left: 10 * PT_PER_PX, right: 10 * PT_PER_PX },
        },
      },
    ];
  }
  if (row.kind === 'nil') {
    return [
      {
        content: 'NIL',
        styles: { fontStyle: 'italic', fontSize: 8.5, textColor: NIL_INK, halign: 'left', cellPadding: 8 * PT_PER_PX },
      },
      ...new Array(REPORT_COLUMNS.length - 1).fill(''),
    ];
  }
  return row.cells.map((text, i) =>
    REPORT_COLUMNS[i].remarks ? { content: pdfText(text), styles: { fontSize: REMARKS_SIZE, textColor: SUMMARY_INK } } : pdfText(text),
  );
}

const PUNCTUATION = {
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  ' ': ' ',
  '​': '',
  '‐': '-',
  '‑': '-',
  '‒': '-',
  '–': '-',
  '—': '-',
  '‘': "'",
  '’': "'",
  '‚': ',',
  '“': '"',
  '”': '"',
  '•': '*',
  '…': '...',
  '−': '-',
};

/**
 * jsPDF's built-in Helvetica only covers Latin-1, so typographic punctuation is folded to its
 * plain equivalent and anything else outside Latin-1 becomes "?" rather than mojibake. The live
 * sheet's RDO KKD rows hold nothing past Latin-1 bar non-breaking spaces; for a sheet that does,
 * the screen's "Print view" renders through the browser and keeps every character.
 */
export function pdfText(text) {
  return foldPunctuation(text).replace(UNSUPPORTED_ALL, '?');
}

/** Whether any of the report's text would lose characters in the PDF (see pdfText). */
export function hasUnsupportedCharacters(model) {
  const texts = [model.title, ...model.groups.flatMap((group) => group.rows.flat())];
  return texts.some((text) => UNSUPPORTED.test(foldPunctuation(text)));
}

const UNSUPPORTED = /[^\n\r\t\u0020-\u00ff]/;
const UNSUPPORTED_ALL = new RegExp(UNSUPPORTED.source, 'g');

function foldPunctuation(text) {
  return String(text)
    .normalize('NFC')
    .replace(/[\u00a0\u2002\u2003\u2009\u200b\u2010-\u2014\u2018\u2019\u201a\u201c\u201d\u2022\u2026\u2212]/g, (ch) => PUNCTUATION[ch]);
}
