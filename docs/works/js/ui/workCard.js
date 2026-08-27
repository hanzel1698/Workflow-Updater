/** One work in the list. Ported from android/.../ui/main/WorkCard.kt. */

import { STATUS_SHORT_LABELS } from '../config.js';
import { el } from './dom.js';
import { Icons } from './icons.js';
import { statusTone } from './statusTone.js';

export function workCard(work, onClick) {
  const card = el('article', {
    className: 'work-card',
    attrs: { tabindex: '0', role: 'button', 'aria-label': `${work.workName}. View full details` },
    on: {
      click: () => onClick(work.rowNum),
      keydown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(work.rowNum);
        }
      },
    },
  });

  card.append(
    el('div', { className: 'work-card-top' }, [
      el('span', { className: 'work-file-number', text: work.fileNumber || 'No file number' }),
      statusBadge(work.status, work.statusCode),
    ]),
    el('h3', { className: 'work-title', text: work.workName }),
    metaRow(Icons.locationOn(), [work.lac, work.district].filter(Boolean).join(' • ') || 'Location not set'),
  );

  if (work.floors || work.area) {
    const parts = [];
    if (work.floors) parts.push(`${work.floors} floors`);
    if (work.area) parts.push(`${work.area} m²`);
    card.append(metaRow(Icons.squareFoot(), parts.join('  •  ')));
  }

  card.append(
    el('div', { className: 'mini-pill-row' }, [
      miniPill('AS', work.asStatus),
      miniPill('AR', work.arStatus),
      miniPill('SR', work.srStatus),
    ]),
  );

  if (work.remarks) {
    card.append(el('p', { className: 'work-remarks', text: work.remarks }));
  }

  card.append(
    el('div', { className: 'work-card-footer' }, [
      el('span', { text: 'View full details' }),
      el('span', { className: 'chevron', html: Icons.chevronRight() }),
    ]),
  );

  return card;
}

function statusBadge(status, code) {
  return el('span', {
    className: 'status-badge',
    text: STATUS_SHORT_LABELS[code] || status,
    dataset: { tone: statusTone(code) },
  });
}

function metaRow(icon, text) {
  return el('div', { className: 'work-meta' }, [el('span', { className: 'meta-icon', html: icon }), el('span', { text })]);
}

function miniPill(label, value) {
  return el('span', { className: 'mini-pill' }, [
    el('span', { className: 'mini-pill-label', text: `${label}:` }),
    el('span', { className: 'mini-pill-value', text: value || '—' }),
  ]);
}
