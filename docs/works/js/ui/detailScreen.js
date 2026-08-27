/**
 * Fully read-only detail view of a single work. Renders every populated field, including any
 * unknown extra columns, so nothing from the live sheet is hidden.
 * Ported from android/.../ui/detail/WorkDetailScreen.kt.
 */

import { SheetDateFormatter } from '../model.js';
import { el, iconButton } from './dom.js';
import { Icons } from './icons.js';
import { statusTone } from './statusTone.js';

export function createDetailScreen({ work, onBack }) {
  const appBar = el('header', { className: 'app-bar detail-bar' }, [
    iconButton(Icons.arrowBack(), { label: 'Back', onClick: onBack }),
    el('h1', { className: 'app-bar-title', text: 'Work details' }),
  ]);

  const body = el('main', { className: 'scroll-area detail-body' });

  if (!work) {
    body.append(el('div', { className: 'state-block' }, [el('p', { className: 'empty-title', text: 'This work is no longer available.' })]));
    return { root: el('div', { className: 'screen detail-screen' }, [appBar, body]) };
  }

  body.append(
    el('div', { className: 'detail-status-header', dataset: { tone: statusTone(work.statusCode) } }, [
      el('span', { className: 'detail-status-dot' }),
      el('span', { className: 'detail-status-text', text: work.status }),
    ]),
    el('h2', { className: 'detail-title', text: work.workName }),
  );

  section('Overview', [
    row('e-Office File Number', work.fileNumber),
    row('Design Office', work.designOffice),
    row('District', work.district),
    row('LAC', work.lac),
    row('Client Department', work.clientDept),
  ]);

  section('Approvals', [
    row('AS Status', work.asStatus),
    row('AR Status', work.arStatus),
    row('SR Status', work.srStatus),
    row('AS Order No & Date', work.asOrder),
    row('AS Date', SheetDateFormatter.format(work.asDate)),
    row('TS Order No & Date', work.tsOrder),
    row('TS Date', SheetDateFormatter.format(work.tsDate)),
  ]);

  section('Building', [
    row('No. of Floors', work.floors),
    row('Total Area', work.area ? `${work.area} m²` : ''),
    row('ASE', work.ase),
    row('SE', work.se),
  ]);

  section('Timeline', [
    row('Target Date', SheetDateFormatter.format(work.targetDate)),
    row('Tentative Issued Date', SheetDateFormatter.format(work.tentativeIssuedDate)),
    row('Detailed Design Last Issued Date', SheetDateFormatter.format(work.detailedLastIssuedDate)),
    row('Detailed Design Complete Issued Date', SheetDateFormatter.format(work.detailedCompleteIssuedDate)),
  ]);

  section('Remarks', [
    paragraph('Remarks by Building Design Unit', work.remarks),
    paragraph('Present Status / Remarks', work.shortRemarks),
    paragraph('Remarks of EE RIQCL', work.eeRiqclRemarks),
    paragraph('Remarks of Architecture Wing', work.architectureRemarks),
  ]);

  if (work.extraFields.length > 0) {
    section(
      'Additional Information',
      work.extraFields.map(([label, value]) => row(label, value)),
    );
  }

  function section(title, entries) {
    const rows = entries.filter(Boolean);
    if (rows.length === 0) return;
    body.append(
      el('section', { className: 'detail-section' }, [
        el('h3', { className: 'detail-section-title', text: title.toUpperCase() }),
        el('div', { className: 'detail-card' }, rows),
      ]),
    );
  }

  function row(label, value) {
    if (!value || value.trim() === '') return null;
    return el('div', { className: 'detail-row' }, [
      el('span', { className: 'detail-label', text: label }),
      el('span', { className: 'detail-value', text: value }),
    ]);
  }

  function paragraph(label, value) {
    if (!value || value.trim() === '') return null;
    return el('div', { className: 'detail-paragraph' }, [
      el('span', { className: 'detail-label', text: label }),
      el('p', { className: 'detail-value', text: value }),
    ]);
  }

  return { root: el('div', { className: 'screen detail-screen' }, [appBar, body]) };
}
