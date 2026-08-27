/**
 * Row normalization, design-status mapping and sheet date formatting.
 * Ported from android/.../data/WorkItem.kt and android/.../data/SheetDateFormatter.kt.
 */

import { ALL_KNOWN_COLUMNS, Columns, STATUS_OPTIONS } from './config.js';

/** Looks up `keys` (in priority order) inside `row`, matching header names case-insensitively. */
export function rowValue(row, keys) {
  for (const key of keys) {
    const direct = row[key];
    if (typeof direct === 'string' && direct.trim() !== '') return direct;
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase() === key.toLowerCase() && typeof v === 'string' && v.trim() !== '') return v;
    }
  }
  return '';
}

const isBlank = (value) => !value || value.trim() === '';

/**
 * Maps a raw category code (e.g. "TDO") or free-text status to one of the nine canonical
 * design-status strings. Ported from `mapCategoryToStatus` in windows/app.js.
 */
export const StatusMapper = {
  mapCategoryToStatus(category, remarks, presentStatus) {
    const cat = (category || '').trim();
    if (cat === '') return inferFromText(remarks, presentStatus);

    switch (cat.toUpperCase()) {
      case 'TDO':
        return STATUS_OPTIONS[0];
      case 'TDOH':
        return STATUS_OPTIONS[1];
      case 'TDI':
        return STATUS_OPTIONS[2];
      case 'DDO':
        return STATUS_OPTIONS[3];
      case 'DDOH':
        return STATUS_OPTIONS[4];
      case 'DDI':
        return STATUS_OPTIONS[5];
      case 'FNO':
        return STATUS_OPTIONS[6];
      case 'DISCARDED':
        return STATUS_OPTIONS[7];
      case 'RETURNED':
        return STATUS_OPTIONS[8];
      default: {
        const exact = STATUS_OPTIONS.find((option) => option.toLowerCase() === cat.toLowerCase());
        if (exact) return exact;
        const prefix = cat.slice(0, 2);
        if (cat.length >= 2 && /^\d{2}$/.test(prefix)) {
          const byPrefix = STATUS_OPTIONS.find((option) => option.startsWith(prefix));
          if (byPrefix) return byPrefix;
        }
        return inferFromText(remarks, presentStatus);
      }
    }
  },

  /** The two-digit prefix ("01".."09") used for KPI counters and quick filter chips. */
  codeOf(status) {
    const code = (status || '').trim().slice(0, 2);
    return code === '' ? '07' : code;
  },
};

function inferFromText(remarks, presentStatus) {
  const text = `${remarks || ''} ${presentStatus || ''}`.toLowerCase();
  const issued = text.includes('complete') || text.includes('despatched') || text.includes('issued');
  return issued ? STATUS_OPTIONS[5] : STATUS_OPTIONS[6];
}

/**
 * A single row from the live workflow sheet, normalized against `Columns` so the UI never has
 * to worry about the sheet's exact header spelling.
 */
export function createWorkItem(row) {
  const raw = row || {};
  const parsedRowNum = Number.parseFloat(raw._rowNum);
  const rowNum = Number.isFinite(parsedRowNum) ? Math.trunc(parsedRowNum) : -1;

  const field = (keys) => rowValue(raw, keys);
  const workName = field(Columns.WORK_NAME) || 'Untitled Work';
  const remarks = field(Columns.REMARKS);
  const status = StatusMapper.mapCategoryToStatus(field(Columns.STATUS), remarks, field(Columns.PRESENT_STATUS));

  const knownNames = new Set(ALL_KNOWN_COLUMNS.flat().map((name) => name.toLowerCase()));
  const extraFields = Object.entries(raw)
    .filter(([key, value]) => key !== '_rowNum' && !isBlank(value) && !knownNames.has(key.toLowerCase()))
    .map(([key, value]) => [key, value]);

  return {
    rowNum,
    raw,
    fileNumber: field(Columns.FILE_NUMBER),
    workName,
    district: field(Columns.DISTRICT),
    lac: field(Columns.LAC),
    asStatus: field(Columns.AS_STATUS),
    arStatus: field(Columns.AR_STATUS),
    srStatus: field(Columns.SR_STATUS),
    designOffice: field(Columns.DESIGN_OFFICE),
    floors: field(Columns.FLOORS),
    area: field(Columns.AREA),
    ase: field(Columns.ASE),
    se: field(Columns.SE),
    remarks,
    shortRemarks: field(Columns.SHORT_REMARKS),
    targetDate: field(Columns.TARGET_DATE),
    clientDept: field(Columns.CLIENT_DEPT),
    tentativeIssuedDate: field(Columns.TENTATIVE_ISSUED_DATE),
    detailedLastIssuedDate: field(Columns.DETAILED_LAST_ISSUED_DATE),
    detailedCompleteIssuedDate: field(Columns.DETAILED_COMPLETE_ISSUED_DATE),
    asOrder: field(Columns.AS_ORDER),
    asDate: field(Columns.AS_DATE),
    tsOrder: field(Columns.TS_ORDER),
    tsDate: field(Columns.TS_DATE),
    eeRiqclRemarks: field(Columns.EE_RIQCL_REMARKS),
    architectureRemarks: field(Columns.ARCHITECTURE_REMARKS),
    status,
    statusCode: StatusMapper.codeOf(status),
    extraFields,
  };
}

/**
 * Formats raw date values from the live Google Sheet exactly as Google Sheets shows them: DD/MM/YYYY.
 *
 * The sheet delivers date cells as ISO-8601 instants (e.g. "2025-01-06T18:30:00.000Z"), which are
 * midnight in India Standard Time. They must be converted to Asia/Kolkata before extracting the
 * day/month/year, otherwise the displayed day is off by one. Non-date free text (e.g. a Target Date
 * like "After getting intimation from field officials") passes through unchanged.
 */
const KOLKATA_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** Plain day/month/year already in the sheet's DD/MM/YYYY convention, e.g. "07/01/2025" or "7-1-2025". */
const DAY_MONTH_YEAR = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;

/** ISO date without a time component, e.g. "2025-01-07". */
const ISO_DATE_ONLY = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

export const SheetDateFormatter = {
  format(raw) {
    const str = (raw === null || raw === undefined ? '' : String(raw)).trim();
    if (str === '') return '';

    // ISO-8601 timestamp (has a time component): parse as an instant and convert to Asia/Kolkata.
    if (str.includes('T')) {
      const millis = Date.parse(str);
      if (Number.isFinite(millis)) {
        return KOLKATA_FORMATTER.format(new Date(millis));
      }
    }

    // ISO date only ("2025-01-07"): no timezone shifting.
    const iso = ISO_DATE_ONLY.exec(str);
    if (iso) return pad(Number(iso[3]), Number(iso[2]), Number(iso[1]));

    // Plain day/month/year with "/" or "-": normalize/zero-pad, keep DD/MM/YYYY order.
    const dmy = DAY_MONTH_YEAR.exec(str);
    if (dmy) return pad(Number(dmy[1]), Number(dmy[2]), Number(dmy[3]));

    // Anything else (free text like "After getting intimation from field officials"): unchanged.
    return str;
  },
};

function pad(day, month, year) {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).padStart(4, '0')}`;
}
