/** Filter bottom sheet. Ported from android/.../ui/main/FilterSheet.kt. */

import { isAllProfile } from '../config.js';
import { computeDropdownOptions, matchesSearchQuery } from '../state.js';
import { el } from './dom.js';
import { openBottomSheet } from './sheet.js';

const GROUP_TITLES = [
  ['District', 'district'],
  ['LAC', 'lac'],
  ['SE', 'se'],
  ['AS Status', 'asStatus'],
  ['AR Status', 'arStatus'],
  ['SR Status', 'srStatus'],
  ['ASE', 'ase'],
];

export function showFilterSheet({ state, onApply }) {
  const groupDefs = isAllProfile(state.activeProfile)
    ? GROUP_TITLES
    : GROUP_TITLES.filter(([, key]) => key !== 'ase');

  const selection = {
    district: [...state.filters.district],
    lac: [...state.filters.lac],
    se: [...state.filters.se],
    asStatus: [...state.filters.asStatus],
    arStatus: [...state.filters.arStatus],
    srStatus: [...state.filters.srStatus],
    ase: [...state.filters.ase],
  };

  // Cascading uses the same works the rest of the screen sees (search text still applies), but
  // never the currently committed dropdown filters — those are exactly what this sheet lets the
  // user change, and the live selection above stands in for them instead.
  const searchedWorks = state.allWorks.filter((work) => matchesSearchQuery(work, state.searchQuery));

  const body = el('div', { className: 'filter-groups' });
  const chipsByKey = new Map();

  for (const [title, key] of groupDefs) {
    const row = el('div', { className: 'filter-chip-row' });
    const group = el('div', { className: 'filter-group' }, [el('h3', { className: 'filter-group-title', text: title }), row]);
    chipsByKey.set(key, { row, group });
    body.append(group);
  }

  /** Toggles one value in or out of a group's selection, then re-cascades every group's options. */
  function toggle(key, option) {
    const values = selection[key];
    const index = values.indexOf(option);
    if (index >= 0) values.splice(index, 1);
    else values.push(option);
    render(key);
  }

  /**
   * Recomputes every group's options from the current selection and re-renders its chips. When
   * called right after a toggle, `authoritativeKey` is the group the user just touched: its own
   * picks are never pruned, but every *other* group drops any selection the new pick makes
   * unreachable (e.g. picking a District clears a previously-picked LAC from a different one).
   * Without an authoritative key (initial render, "Clear all"), the selection is already
   * self-consistent, so nothing needs pruning.
   */
  function render(authoritativeKey) {
    if (authoritativeKey) {
      const beforePrune = computeDropdownOptions(searchedWorks, selection);
      for (const [, key] of groupDefs) {
        if (key === authoritativeKey) continue;
        selection[key] = selection[key].filter((value) => beforePrune[key].includes(value));
      }
    }

    const options = computeDropdownOptions(searchedWorks, selection);
    for (const [, key] of groupDefs) {
      const { row, group } = chipsByKey.get(key);
      const values = options[key];
      group.hidden = values.length === 0;
      row.replaceChildren(
        ...values.map((option) => {
          const active = selection[key].includes(option);
          return el('button', {
            className: `filter-chip${active ? ' selected' : ''}`,
            text: option,
            attrs: { type: 'button', 'aria-pressed': String(active) },
            on: { click: () => toggle(key, option) },
          });
        }),
      );
    }
  }

  render();

  const clearButton = el('button', {
    className: 'text-btn',
    text: 'Clear all',
    attrs: { type: 'button' },
    on: {
      click: () => {
        for (const key of Object.keys(selection)) selection[key] = [];
        render();
      },
    },
  });

  const applyButton = el('button', {
    className: 'filled-btn',
    text: 'Apply filters',
    attrs: { type: 'button' },
    on: {
      click: () => {
        onApply({ ...selection, statusCodes: state.filters.statusCodes });
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
