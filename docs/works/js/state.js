/**
 * Screen state and everything derived from it.
 * Ported from android/.../ui/main/WorksUiState.kt.
 */

import { DEFAULT_PROFILE_ID, STATUS_SHORT_LABELS, profileById } from './config.js';

/** The dropdown filter groups, each keyed by the `filters` field and the matching `Work` field. */
export const DROPDOWN_FIELDS = [
  ['District', 'district'],
  ['LAC', 'lac'],
  ['SE', 'se'],
  ['AS Status', 'asStatus'],
  ['AR Status', 'arStatus'],
  ['SR Status', 'srStatus'],
  ['ASE', 'ase'],
];

/**
 * Active filter selections. Every dropdown filter is a multi-select, where an empty array means
 * "no restriction" (i.e. "All"); picking several values widens the match to any of them.
 * `statusCodes` is the design-status chip selection, same convention.
 */
export function createFilters(overrides = {}) {
  return {
    district: [],
    lac: [],
    se: [],
    asStatus: [],
    arStatus: [],
    srStatus: [],
    ase: [],
    statusCodes: [],
    ...overrides,
  };
}

/** A multi-select filter matches when nothing is picked, or the value is one of the picks. */
export function matchesMulti(value, selected) {
  return !selected || selected.length === 0 || selected.includes(value);
}

/** Design-status chips are additive: no chip picked means every status is in scope. */
export function matchesStatusSelection(work, statusCodes) {
  return matchesMulti(work.statusCode, statusCodes);
}

export function hasDropdownFilters(filters) {
  return DROPDOWN_FIELDS.some(([, key]) => filters[key].length > 0);
}

export function countActiveDropdownFilters(filters) {
  return DROPDOWN_FIELDS.reduce((sum, [, key]) => sum + filters[key].length, 0);
}

export function hasAnyFilter(state) {
  return hasDropdownFilters(state.filters) || state.searchQuery.trim() !== '' || state.filters.statusCodes.length > 0;
}

export function matchesSearchQuery(work, query) {
  const q = query.trim().toLowerCase();
  return (
    q === '' ||
    work.workName.toLowerCase().includes(q) ||
    work.fileNumber.toLowerCase().includes(q) ||
    work.lac.toLowerCase().includes(q) ||
    work.remarks.toLowerCase().includes(q)
  );
}

/**
 * Distinct, sorted values for every dropdown field, each one computed against `works` with every
 * *other* dropdown filter applied (but not its own), so picking a value in one group narrows the
 * choices offered in the rest — e.g. picking a District narrows the LAC options to that
 * District's LACs. Used both for the committed global filter options and for the live preview
 * inside the filter sheet while the user is still choosing.
 */
export function computeDropdownOptions(works, filters) {
  const options = {};
  for (const [, key] of DROPDOWN_FIELDS) {
    const pool = works.filter((work) =>
      DROPDOWN_FIELDS.every(([, otherKey]) => otherKey === key || matchesMulti(work[otherKey], filters[otherKey])),
    );
    options[key] = distinctOptions(pool, (w) => w[key]);
  }
  return options;
}

/** Drops any selections that fell outside their (possibly narrowed) options, e.g. after a cascade. */
export function pruneSelections(filters, options) {
  const pruned = { ...filters };
  for (const [, key] of DROPDOWN_FIELDS) pruned[key] = filters[key].filter((value) => options[key].includes(value));
  return pruned;
}

const distinctOptions = (works, selector) =>
  [...new Set(works.map(selector).filter((value) => value.trim() !== ''))].sort(compareStrings);

export function createUiState(overrides = {}) {
  return {
    isLoading: true,
    isRefreshing: false,
    activeProfile: profileById(DEFAULT_PROFILE_ID),
    defaultProfileId: DEFAULT_PROFILE_ID,
    allWorks: [],
    filteredWorks: [],
    searchQuery: '',
    filters: createFilters(),
    districtOptions: [],
    lacOptions: [],
    seOptions: [],
    asStatusOptions: [],
    arStatusOptions: [],
    srStatusOptions: [],
    aseOptions: [],
    statusCounts: {},
    /** Persisted display order for design-status filter chips (two-digit codes, 01…09). */
    statusChipOrder: Object.keys(STATUS_SHORT_LABELS),
    isOffline: false,
    /** True when the five built-in sample works are on screen instead of the user's sheet. */
    isSample: false,
    errorMessage: null,
    lastSyncedAtMillis: null,
    /** When the rows on screen were last confirmed to match the sheet; null for sample data. */
    sheetAsOfMillis: null,
    isExporting: false,
    ...overrides,
  };
}

/**
 * Recomputes everything derived from `allWorks`, `searchQuery` and `filters`.
 * Call after any change to those three inputs.
 */
export function recomputeDerived(state) {
  const { filters } = state;
  const searchedWorks = state.allWorks.filter((work) => matchesSearchQuery(work, state.searchQuery));

  const options = computeDropdownOptions(searchedWorks, filters);
  const sanitizedFilters = pruneSelections(filters, options);

  const matchesDropdowns = (work) =>
    matchesSearchQuery(work, state.searchQuery) &&
    DROPDOWN_FIELDS.every(([, key]) => matchesMulti(work[key], sanitizedFilters[key]));

  const filtered = state.allWorks.filter(
    (work) => matchesDropdowns(work) && matchesStatusSelection(work, sanitizedFilters.statusCodes),
  );

  // Status chip counts ignore the active status chip so the row keeps showing every reachable status.
  const poolForStatusChips = state.allWorks.filter(matchesDropdowns);
  const statusCounts = {};
  for (const work of poolForStatusChips) {
    statusCounts[work.statusCode] = (statusCounts[work.statusCode] || 0) + 1;
  }

  return {
    ...state,
    filters: { ...sanitizedFilters, statusCodes: filters.statusCodes },
    filteredWorks: filtered,
    districtOptions: options.district,
    lacOptions: options.lac,
    seOptions: options.se,
    asStatusOptions: options.asStatus,
    arStatusOptions: options.arStatus,
    srStatusOptions: options.srStatus,
    aseOptions: options.ase,
    statusCounts,
  };
}

/** Matches Kotlin's `sorted()` on strings: ordering by UTF-16 code unit. */
function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
