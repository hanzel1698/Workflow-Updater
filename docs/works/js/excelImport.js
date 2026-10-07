/**
 * Reads the workflow sheet out of an Excel copy of the Google Sheet (File → Download → Microsoft
 * Excel), producing the same rows the Apps Script Web App serves, so everything downstream —
 * profile filtering, status mapping, the report — runs unchanged on a file instead of a network
 * read that can take a minute and a half.
 *
 * Mirrors doGet in windows/google_apps_script.js: the tab is found by name, else by scanning for
 * the header row; the header row is the first one carrying "e-Office File Number" or "Name of
 * Work"; a data row counts only when Name of Work is filled.
 *
 * Takes the SheetJS library as an argument rather than importing it, because it is a classic
 * script loaded on demand in the browser (see vendor.js) and `require`d in the tests.
 */

import { SHEET_NAME } from './config.js';

const HEADER_MARKERS = ['e-Office File Number', 'Name of Work'];
const WORK_NAME_HEADERS = ['Name of Work', 'Work Name'];
/** How far down a tab the header row may sit, as in getTargetSheet. */
const HEADER_SCAN_ROWS = 10;

/**
 * Picks the workflow tab: the configured sheet name, else the first tab that is not an archived
 * "OLD" copy and has a header row near the top.
 * @returns {string|null}
 */
export function findWorkflowSheetName(XLSX, workbook) {
  const names = workbook.SheetNames || [];
  const exact = names.find((name) => name.trim().toLowerCase() === SHEET_NAME.toLowerCase());
  if (exact && workbook.Sheets[exact]) return exact;

  for (const name of names) {
    if (name.toUpperCase().includes('OLD')) continue;
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const grid = sheetGrid(XLSX, sheet, HEADER_SCAN_ROWS);
    if (grid.cells.some((row) => isHeaderRow(row))) return name;
  }
  return null;
}

/**
 * The workflow rows of `workbook`, shaped like the Web App's `rows`: every value a string, keyed
 * by trimmed header, plus `_rowNum` (the 1-based sheet row).
 * @returns {{ sheetName: string, headers: string[], rows: Array<Object> }}
 */
export function readWorkflowRows(XLSX, workbook) {
  const sheetName = findWorkflowSheetName(XLSX, workbook);
  if (!sheetName) {
    throw new Error(`No "${SHEET_NAME}" tab, and no tab with a "Name of Work" header, in this file`);
  }

  const grid = sheetGrid(XLSX, workbook.Sheets[sheetName]);
  const headerIndex = Math.max(0, grid.cells.findIndex((row) => isHeaderRow(row)));
  const headers = (grid.cells[headerIndex] || []).map((header) => header.trim());
  const workNameIndex = WORK_NAME_HEADERS.map((name) => headers.indexOf(name)).find((index) => index !== -1);

  const rows = [];
  for (let i = headerIndex + 1; i < grid.cells.length; i += 1) {
    const cells = grid.cells[i];
    const populated =
      workNameIndex === undefined ? cells.join('').trim() !== '' : (cells[workNameIndex] || '').trim() !== '';
    if (!populated) continue;

    const row = { _rowNum: String(grid.firstRow + i + 1) };
    headers.forEach((header, j) => {
      if (header) row[header] = cells[j] === undefined ? '' : cells[j];
    });
    rows.push(row);
  }

  return { sheetName, headers, rows };
}

/**
 * The tab as a grid of strings, from the top-left of its used range. Date cells become
 * `DD/MM/YYYY` straight from the stored day number: Excel dates carry no timezone, so converting
 * them through a JS Date could only introduce the day-slip the sheet's ISO instants need
 * SheetDateFormatter to undo.
 */
function sheetGrid(XLSX, sheet, maxRows = Infinity) {
  const ref = sheet['!ref'];
  if (!ref) return { firstRow: 0, cells: [] };
  const range = XLSX.utils.decode_range(ref);
  const lastRow = Math.min(range.e.r, range.s.r + maxRows - 1);

  const cells = [];
  for (let r = range.s.r; r <= lastRow; r += 1) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      row.push(cellText(XLSX, sheet[XLSX.utils.encode_cell({ r, c })]));
    }
    cells.push(row);
  }
  return { firstRow: range.s.r, cells };
}

function cellText(XLSX, cell) {
  if (!cell || cell.v === undefined || cell.v === null) return '';
  switch (cell.t) {
    case 'n':
      if (isDateFormat(XLSX, cell)) return formatSerialDate(XLSX, cell.v);
      return String(cell.v);
    case 'd':
      return cell.v instanceof Date ? formatDateParts(cell.v.getFullYear(), cell.v.getMonth() + 1, cell.v.getDate()) : '';
    case 'b':
      // Apps Script stringifies booleans the same way: "true" / "false".
      return cell.v ? 'true' : 'false';
    case 'e':
      return cell.w || '';
    default:
      return String(cell.v);
  }
}

function isDateFormat(XLSX, cell) {
  const format = cell.z;
  if (!format || typeof format !== 'string') return false;
  return XLSX.SSF.is_date(format);
}

function formatSerialDate(XLSX, serial) {
  const parts = XLSX.SSF.parse_date_code(serial);
  if (!parts || !parts.y) return String(serial);
  return formatDateParts(parts.y, parts.m, parts.d);
}

function formatDateParts(year, month, day) {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).padStart(4, '0')}`;
}

function isHeaderRow(row) {
  return row.some((value) => HEADER_MARKERS.includes(value.trim()));
}

/**
 * Parses an .xlsx file's bytes. Only the workflow tab is parsed in full when it can be found by
 * name; the real workbook carries five other tabs that would otherwise double the parse time.
 */
export function parseWorkbook(XLSX, data) {
  const options = { type: 'array', cellNF: true, cellDates: false, cellHTML: false, cellStyles: false };
  const outline = XLSX.read(data, { ...options, bookSheets: true });
  const named = (outline.SheetNames || []).find((name) => name.trim().toLowerCase() === SHEET_NAME.toLowerCase());
  return XLSX.read(data, named ? { ...options, sheets: [named] } : options);
}
