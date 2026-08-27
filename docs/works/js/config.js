/**
 * Central configuration for the live Google Sheet integration, ported from
 * android/.../data/SheetConfig.kt so the web app, the Android app and the desktop
 * dashboard stay pointed at the same spreadsheet, roster and column layout.
 */

/** Apps Script Web App URL used when a profile doesn't define its own. */
export const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbypzZxZAa0BdbsjA7hYXt02HStBrcwFsTLokgj_m9lHJfRuMGxRNOYZg8f1fstV2Fu5/exec';

export const SPREADSHEET_ID = '1tDBZGfYmtEQLwepDHDVwd2pAT_-qvIoJxVYG8Ub6vI8';
export const SHEET_NAME = 'WORKFLOW MONITORING SHEET';
export const DESIGN_OFFICE = 'RDO KKD';
export const DEFAULT_PROFILE_ID = 'AD';
export const ALL_PROFILE_ID = 'ALL';

/**
 * Web build identity. Mirrors the Android app's versionCode/versionName so the
 * one-time "What's New" screen uses the identical show-once rule.
 */
export const APP_VERSION_CODE = 8;
export const APP_VERSION_NAME = '3.0.0';

/** One engineer whose works can be viewed. */
export const ALL_PROFILE = { id: ALL_PROFILE_ID, name: 'All engineers', email: '', scriptUrl: '' };

export const PROFILES = [
  { id: 'AD', name: 'Hanzel H. Fernandez (AD)', email: 'ad.rdokk@gmail.com', scriptUrl: '' },
  { id: 'ASE01', name: 'ASE01', email: '', scriptUrl: '' },
  { id: 'ASE02', name: 'ASE02', email: '', scriptUrl: '' },
  { id: 'ASE03', name: 'ASE03', email: '', scriptUrl: '' },
  { id: 'AHE01', name: 'AHE01', email: '', scriptUrl: '' },
  { id: 'AHE02', name: 'AHE02', email: '', scriptUrl: '' },
];

/** Engineer ids used when the All profile is active (RDO KKD rows for every configured engineer). */
export const ENGINEER_PROFILE_IDS = new Set(PROFILES.map((p) => p.id));

export function selectableProfiles() {
  return [ALL_PROFILE, ...PROFILES];
}

export function profileById(id) {
  if (id === ALL_PROFILE_ID) return ALL_PROFILE;
  return PROFILES.find((p) => p.id === id) || PROFILES[0];
}

export function isAllProfile(profile) {
  return profile.id === ALL_PROFILE_ID;
}

/** The nine canonical design-status categories used for grouping, filtering and KPIs. */
export const STATUS_OPTIONS = [
  '01 Tentative Design Ongoing',
  '02 Tentative Design On Hold',
  '03 Tentative Design Issued',
  '04 Detailed Design Ongoing',
  '05 Detailed Design On Hold',
  '06 Detailed Design Issued',
  '07 File Not Yet Opened',
  '08 Discarded Work',
  '09 Returned to Site',
];

/** Short human labels for the KPI chips, keyed by the two-digit status code. */
export const STATUS_SHORT_LABELS = {
  '01': 'Tentative Ongoing',
  '02': 'Tentative On Hold',
  '03': 'Tentative Issued',
  '04': 'Detailed Ongoing',
  '05': 'Detailed On Hold',
  '06': 'Detailed Issued',
  '07': 'File Not Opened',
  '08': 'Discarded',
  '09': 'Returned to Site',
};

/**
 * Column name fallbacks. Sheets sometimes rename headers, so every logical field is
 * resolved against a list of candidate header names, matched case-insensitively.
 */
export const Columns = {
  FILE_NUMBER: ['Sl. No.', 'e-Office File Number'],
  WORK_NAME: ['Name of Work', 'Work Name'],
  DISTRICT: ['Districts', 'District'],
  LAC: ['LAC'],
  AS_STATUS: ['AS STATUS', 'AS Status'],
  AR_STATUS: ['AR STATUS', 'AR Status'],
  SR_STATUS: ['SR STATUS', 'SR Status'],
  DESIGN_OFFICE: ['DESIGN OFFICE', 'Design Office'],
  STATUS: ['CATEGORY', 'Design Status'],
  FLOORS: ['No. of Floors', 'Floors'],
  AREA: ['Total area in m2', 'Area'],
  ASE: ['ASE'],
  SE: ['SE'],
  REMARKS: ['REMARKS OF DESIGN UNITS', 'Remarks by Building Design Unit', 'Remarks'],
  TARGET_DATE: ['Target dates', 'Target Date'],
  CLIENT_DEPT: ['Client Department'],
  TENTATIVE_ISSUED_DATE: ['Tentative Issued Date'],
  DETAILED_LAST_ISSUED_DATE: ['Detailed Design Last Issued Date'],
  DETAILED_COMPLETE_ISSUED_DATE: ['Detailed Design Complete Issued Date'],
  PRESENT_STATUS: ['PRESENT STATUS OF WORK'],
  AS_ORDER: ['AS Order No & Date'],
  AS_DATE: ['AS Date'],
  TS_ORDER: ['TS Order No and date'],
  TS_DATE: ['TS Date'],
  SHORT_REMARKS: ['Remarks'],
  EE_RIQCL_REMARKS: ['Remarks of EE RIQCL'],
  ARCHITECTURE_REMARKS: ['REMARKS OF ARCHITECTURE WING'],
};

/** Every column considered "known" — anything else found on a row is shown as extra info. */
export const ALL_KNOWN_COLUMNS = [
  Columns.FILE_NUMBER,
  Columns.WORK_NAME,
  Columns.DISTRICT,
  Columns.LAC,
  Columns.AS_STATUS,
  Columns.AR_STATUS,
  Columns.SR_STATUS,
  Columns.DESIGN_OFFICE,
  Columns.STATUS,
  Columns.FLOORS,
  Columns.AREA,
  Columns.ASE,
  Columns.SE,
  Columns.REMARKS,
  Columns.TARGET_DATE,
  Columns.CLIENT_DEPT,
  Columns.TENTATIVE_ISSUED_DATE,
  Columns.DETAILED_LAST_ISSUED_DATE,
  Columns.DETAILED_COMPLETE_ISSUED_DATE,
  Columns.PRESENT_STATUS,
  Columns.AS_ORDER,
  Columns.AS_DATE,
  Columns.TS_ORDER,
  Columns.TS_DATE,
  Columns.SHORT_REMARKS,
  Columns.EE_RIQCL_REMARKS,
  Columns.ARCHITECTURE_REMARKS,
];

/** A small, high-fidelity offline sample so the app remains useful without network access. */
export const MOCK_ROWS = [
  {
    _rowNum: '588',
    'Name of Work': 'PWD Rest house at Vadakkanchery',
    District: '09 Palakkad',
    LAC: 'Tarur',
    'AS Status': 'Yes',
    'AR Status': 'Received',
    'SR Status': 'Received',
    'Design Office': 'RDO KKD',
    'Design Status': '06 Detailed Design Issued',
    'No. of Floors': 'G+1',
    'Total area in m2': '1015',
    ASE: 'AD',
    SE: 'SE',
    'Remarks by Building Design Unit': 'Complete detailed design drawing despatched. Design completed.',
    Remarks: 'Work Completed',
    'AS Order No & Date': 'GO(Rt) No.625/2018/PWD',
    'AS Date': '31/03/2018',
  },
  {
    _rowNum: '623',
    'Name of Work': 'Construction of building for Govt. Fisheries UP School, Kadavanad, Malappuram',
    District: '10 Malappuram',
    LAC: 'Ponnani',
    'AS Status': 'Yes',
    'AR Status': 'Received',
    'SR Status': 'Received',
    'Design Office': 'RDO KKD',
    'Design Status': '04 Detailed Design Ongoing',
    'No. of Floors': 'G+2',
    'Total area in m2': '939',
    ASE: 'AD',
    SE: 'SE',
    'Remarks by Building Design Unit':
      'Revised AR and clarification from EE received on 31-07-2023. DD of first floor issued on 11.02.2026.',
    Remarks: 'Finishing work is in progress',
    'Tentative Issued Date': '24/01/2024',
    'Detailed Design Last Issued Date': '11/02/2026',
  },
  {
    _rowNum: '678',
    'Name of Work': 'Mini Civil Station, Balusserry, Kozhikode',
    District: '11 Kozhikode',
    LAC: 'Balusseri',
    'AS Status': 'Yes',
    'AR Status': 'Received',
    'SR Status': 'Received',
    'Design Office': 'RDO KKD',
    'Design Status': '04 Detailed Design Ongoing',
    'No. of Floors': 'B1+B2+G+3',
    'Total area in m2': '5805',
    ASE: 'AD',
    SE: 'SE',
    'Remarks by Building Design Unit': 'DD of Ground floor issued on 27-01-2026. DD of FF issued on 21/04/2026.',
    Remarks: 'FF floor slab design obtained. Centering and shuttering work started.',
    'Tentative Issued Date': '07/01/2025',
    'Detailed Design Last Issued Date': '21/04/2026',
  },
  {
    _rowNum: '850',
    'Name of Work': 'Construction of Family Court - Kasargod',
    District: '14 Kasargod',
    LAC: 'Kasaragod',
    'AS Status': 'Yes',
    'AR Status': 'Received',
    'SR Status': 'Received',
    'Design Office': 'RDO KKD',
    'Design Status': '06 Detailed Design Issued',
    'No. of Floors': 'G+2',
    'Total area in m2': '1451',
    ASE: 'AD',
    SE: 'SE',
    'Remarks by Building Design Unit': 'Final DD issued on 19-01-2026',
    Remarks: '',
    'Tentative Issued Date': '10/11/2022',
    'Detailed Design Last Issued Date': '19/01/2026',
    'Detailed Design Complete Issued Date': '19/01/2026',
  },
  {
    _rowNum: '720',
    'Name of Work': 'Construction of New Rest House Block in PWD Rest House Compound, Balussery, Kozhikode',
    District: '11 Kozhikode',
    LAC: 'Balusseri',
    'AS Status': 'No Details Available',
    'AR Status': 'Not Received',
    'SR Status': 'Not Received',
    'Design Office': 'RDO KKD',
    'Design Status': '07 File Not Yet Opened',
    ASE: 'AD',
    SE: 'DD',
    'Remarks by Building Design Unit':
      'AR drawing, Soil investigation report and feasibility report awaited from Buildings wing.',
    Remarks: '',
  },
];
