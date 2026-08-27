/**
 * Screen state and everything derived from it.
 * Ported from android/.../ui/main/WorksUiState.kt.
 */

import { DEFAULT_PROFILE_ID, STATUS_SHORT_LABELS, profileById } from './config.js';

/** Active filter selections. `null` means "no restriction" (i.e. "All"). */
export function createFilters(overrides = {}) {
  return {
    district: null,
    lac: null,
    se: null,
    asStatus: null,
    arStatus: null,
    srStatus: null,
    statusCode: null,
    ...overrides,
  };
}

export function hasDropdownFilters(filters) {
  return (
    filters.district !== null ||
    filters.lac !== null ||
    filters.se !== null ||
    filters.asStatus !== null ||
    filters.arStatus !== null ||
    filters.srStatus !== null
  );
}

export function countActiveDropdownFilters(filters) {
  return [filters.district, filters.lac, filters.se, filters.asStatus, filters.arStatus, filters.srStatus].filter(
    (value) => value !== null,
  ).length;
}

export function hasAnyFilter(state) {
  return hasDropdownFilters(state.filters) || state.searchQuery.trim() !== '' || state.filters.statusCode !== null;
}

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
    statusCounts: {},
    /** Persisted display order for design-status filter chips (two-digit codes, 01…09). */
    statusChipOrder: Object.keys(STATUS_SHORT_LABELS),
    isOffline: false,
    /** True when the five built-in sample works are on screen instead of the user's sheet. */
    isSample: false,
    errorMessage: null,
    lastSyncedAtMillis: null,
    isExporting: false,
    ...overrides,
  };
}

/**
 * Recomputes everything derived from `allWorks`, `searchQuery` and `filters`.
 * Call after any change to those three inputs.
 */
export function recomputeDerived(state) {
  const query = state.searchQuery.trim().toLowerCase();
  const { filters } = state;

  const matchesSearch = (work) =>
    query === '' ||
    work.workName.toLowerCase().includes(query) ||
    work.fileNumber.toLowerCase().includes(query) ||
    work.lac.toLowerCase().includes(query) ||
    work.remarks.toLowerCase().includes(query);

  const filterWorks = (overrides = {}) => {
    const active = { ...filters, ...overrides };
    return state.allWorks.filter(
      (work) =>
        matchesSearch(work) &&
        (active.district === null || work.district === active.district) &&
        (active.lac === null || work.lac === active.lac) &&
        (active.se === null || work.se === active.se) &&
        (active.asStatus === null || work.asStatus === active.asStatus) &&
        (active.arStatus === null || work.arStatus === active.arStatus) &&
        (active.srStatus === null || work.srStatus === active.srStatus) &&
        (active.statusCode === null || work.statusCode === active.statusCode),
    );
  };

  const distinctOptions = (works, selector) =>
    [...new Set(works.map(selector).filter((value) => value.trim() !== ''))].sort(compareStrings);

  const districtOptions = distinctOptions(filterWorks({ district: null }), (w) => w.district);
  const lacOptions = distinctOptions(filterWorks({ lac: null }), (w) => w.lac);
  const seOptions = distinctOptions(filterWorks({ se: null }), (w) => w.se);
  const asStatusOptions = distinctOptions(filterWorks({ asStatus: null }), (w) => w.asStatus);
  const arStatusOptions = distinctOptions(filterWorks({ arStatus: null }), (w) => w.arStatus);
  const srStatusOptions = distinctOptions(filterWorks({ srStatus: null }), (w) => w.srStatus);

  const keepIfPresent = (value, options) => (value !== null && options.includes(value) ? value : null);
  const sanitizedFilters = {
    ...filters,
    district: keepIfPresent(filters.district, districtOptions),
    lac: keepIfPresent(filters.lac, lacOptions),
    se: keepIfPresent(filters.se, seOptions),
    asStatus: keepIfPresent(filters.asStatus, asStatusOptions),
    arStatus: keepIfPresent(filters.arStatus, arStatusOptions),
    srStatus: keepIfPresent(filters.srStatus, srStatusOptions),
  };

  const matchesDropdowns = (work) =>
    matchesSearch(work) &&
    (sanitizedFilters.district === null || work.district === sanitizedFilters.district) &&
    (sanitizedFilters.lac === null || work.lac === sanitizedFilters.lac) &&
    (sanitizedFilters.se === null || work.se === sanitizedFilters.se) &&
    (sanitizedFilters.asStatus === null || work.asStatus === sanitizedFilters.asStatus) &&
    (sanitizedFilters.arStatus === null || work.arStatus === sanitizedFilters.arStatus) &&
    (sanitizedFilters.srStatus === null || work.srStatus === sanitizedFilters.srStatus);

  const filtered = state.allWorks.filter(
    (work) =>
      matchesDropdowns(work) &&
      (sanitizedFilters.statusCode === null || work.statusCode === sanitizedFilters.statusCode),
  );

  // Status chip counts ignore the active status chip so the row keeps showing every reachable status.
  const poolForStatusChips = state.allWorks.filter(matchesDropdowns);
  const statusCounts = {};
  for (const work of poolForStatusChips) {
    statusCounts[work.statusCode] = (statusCounts[work.statusCode] || 0) + 1;
  }

  return {
    ...state,
    filters: sanitizedFilters,
    filteredWorks: filtered,
    districtOptions,
    lacOptions,
    seOptions,
    asStatusOptions,
    arStatusOptions,
    srStatusOptions,
    statusCounts,
  };
}

/** Matches Kotlin's `sorted()` on strings: ordering by UTF-16 code unit. */
function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
