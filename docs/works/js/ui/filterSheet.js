/** Filter bottom sheet. Ported from android/.../ui/main/FilterSheet.kt. */

import { el } from './dom.js';
import { openBottomSheet } from './sheet.js';

export function showFilterSheet({ state, onApply }) {
  const selection = {
    district: state.filters.district,
    lac: state.filters.lac,
    se: state.filters.se,
    asStatus: state.filters.asStatus,
    arStatus: state.filters.arStatus,
    srStatus: state.filters.srStatus,
  };

  const body = el('div', { className: 'filter-groups' });
  const groups = [
    ['District', 'district', state.districtOptions],
    ['LAC', 'lac', state.lacOptions],
    ['SE', 'se', state.seOptions],
    ['AS Status', 'asStatus', state.asStatusOptions],
    ['AR Status', 'arStatus', state.arStatusOptions],
    ['SR Status', 'srStatus', state.srStatusOptions],
  ];

  const chipsByKey = new Map();

  for (const [title, key, options] of groups) {
    if (options.length === 0) continue;
    const row = el('div', { className: 'filter-chip-row' });
    const chips = options.map((option) =>
      el('button', {
        className: `filter-chip${selection[key] === option ? ' selected' : ''}`,
        text: option,
        attrs: { type: 'button', 'aria-pressed': String(selection[key] === option) },
        on: {
          click: () => {
            selection[key] = selection[key] === option ? null : option;
            syncGroup(key);
          },
        },
      }),
    );
    chipsByKey.set(key, { chips, options });
    row.append(...chips);
    body.append(el('div', { className: 'filter-group' }, [el('h3', { className: 'filter-group-title', text: title }), row]));
  }

  function syncGroup(key) {
    const group = chipsByKey.get(key);
    if (!group) return;
    group.chips.forEach((chip, index) => {
      const active = selection[key] === group.options[index];
      chip.classList.toggle('selected', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }

  const clearButton = el('button', {
    className: 'text-btn',
    text: 'Clear all',
    attrs: { type: 'button' },
    on: {
      click: () => {
        for (const key of Object.keys(selection)) selection[key] = null;
        for (const key of chipsByKey.keys()) syncGroup(key);
      },
    },
  });

  const applyButton = el('button', {
    className: 'filled-btn',
    text: 'Apply filters',
    attrs: { type: 'button' },
    on: {
      click: () => {
        onApply({ ...selection, statusCode: state.filters.statusCode });
        sheet.close();
      },
    },
  });

  const footer = el('div', { className: 'sheet-footer' }, [clearButton, applyButton]);

  const sheet = openBottomSheet({
    title: 'Filter works',
    subtitle: 'Narrow the list down by location or approval status',
    body,
    footer,
  });

  return sheet;
}
