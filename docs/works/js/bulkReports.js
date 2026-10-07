/**
 * The bulk Excel → PDF plan: which engineers an uploaded sheet has works for, and the report each
 * one gets. Pure logic, no DOM and no PDF library, so it is covered by tests/run-tests.mjs.
 */

import { ALL_PROFILE, Columns, DESIGN_OFFICE, ENGINEER_PROFILE_IDS, PROFILES } from './config.js';
import { rowValue } from './model.js';
import { filterRowsForProfile } from './repository.js';
import { buildReportModel, reportFileName } from './report.js';

/**
 * One line per engineer on the bulk screen: every configured engineer, then "All engineers",
 * then any ASE value the sheet's RDO KKD rows carry that is not on the roster (a new engineer, or
 * "Not Assigned"), so no work in the file is left without a report it could go into.
 *
 * @returns {Array<{ profile: object, workCount: number, onRoster: boolean }>}
 */
export function bulkEngineers(rows) {
  const office = DESIGN_OFFICE.toLowerCase();
  const rosterIds = new Set([...ENGINEER_PROFILE_IDS].map((id) => id.toLowerCase()));

  const extras = new Map();
  for (const row of rows) {
    if (!rowValue(row, Columns.DESIGN_OFFICE).toLowerCase().includes(office)) continue;
    const ase = rowValue(row, Columns.ASE).trim();
    if (ase === '' || rosterIds.has(ase.toLowerCase()) || extras.has(ase.toLowerCase())) continue;
    extras.set(ase.toLowerCase(), ase);
  }

  const line = (profile, onRoster) => ({
    profile,
    workCount: filterRowsForProfile(rows, profile).length,
    onRoster,
  });

  return [
    ...PROFILES.map((profile) => line(profile, true)),
    line(ALL_PROFILE, true),
    ...[...extras.values()]
      .sort()
      .map((id) => line({ id, name: id, email: '', scriptUrl: '' }, false)),
  ];
}

/**
 * The name to suggest for an engineer before the user has typed one: the roster's full name when
 * it has one ("Hanzel H. Fernandez (AD)" → "Hanzel H. Fernandez"), else nothing.
 */
export function suggestedEngineerName(profile) {
  const name = (profile.name || '').trim();
  if (name === '' || name === profile.id) return '';
  const suffix = ` (${profile.id})`;
  return name.endsWith(suffix) ? name.slice(0, -suffix.length).trim() : '';
}

/**
 * The report for one engineer, ready for the PDF writer or the print view.
 * @param {{ profile: object, engineerName: string }} entry
 * @param {string} date  `DD-MM-YYYY`, as in the report title
 */
export function bulkReport(rows, { profile, engineerName }, date) {
  const works = filterRowsForProfile(rows, profile);
  return {
    profile,
    engineerName,
    works,
    model: buildReportModel(works, profile, engineerName, { date }),
    fileName: pdfFileName(profile.id, engineerName, date),
  };
}

/** "PROGRESS REPORT - AD - Name - AS ON 07-10-2026.pdf" — the title, without its closing full stop. */
export function pdfFileName(designation, engineerName, date) {
  return `${reportFileName(designation, engineerName, date).replace(/\.+$/, '').trim()}.pdf`;
}

/** `YYYY-MM-DD` (a date input's value) → `DD-MM-YYYY` (the report title's format). */
export function titleDateFromInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** A `Date` → `YYYY-MM-DD` in local time, for a date input. */
export function inputDateFrom(date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}
