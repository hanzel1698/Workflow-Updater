/**
 * Holds the main screen's state and every action that mutates it, notifying subscribers on change.
 * Ported from android/.../ui/main/WorksViewModel.kt.
 */

import { profileById } from './config.js';
import { ProfilePrefs } from './prefs.js';
import { normalize } from './chipOrder.js';
import { buildReportBody } from './report.js';
import { createFilters, createUiState, recomputeDerived } from './state.js';

export function createWorksViewModel({ repository, prefs = ProfilePrefs }) {
  let state = createUiState({
    activeProfile: profileById(prefs.launchProfileId()),
    defaultProfileId: prefs.defaultProfileId,
    statusChipOrder: prefs.statusChipOrder,
  });

  const listeners = new Set();

  function emit() {
    for (const listener of listeners) listener(state);
  }

  function update(mutator) {
    state = mutator(state);
    emit();
  }

  async function refresh() {
    const hasData = state.allWorks.length > 0;
    update((s) => ({ ...s, isLoading: !hasData, isRefreshing: hasData }));

    const profile = state.activeProfile;
    const result = await repository.loadWorks(profile);

    update((s) =>
      recomputeDerived({
        ...s,
        isLoading: false,
        isRefreshing: false,
        allWorks: result.works,
        isOffline: result.isOffline,
        isSample: Boolean(result.isSample),
        // Unlike the Android app, the reason is always surfaced: on the web a failure can be a
        // blocked host, a CORS rejection or a timeout, and none of that is visible otherwise.
        errorMessage: result.errorMessage,
        lastSyncedAtMillis: result.lastSyncedAtMillis ?? s.lastSyncedAtMillis,
      }),
    );
  }

  function showCachedThenRefresh(profile) {
    const cached = repository.loadCachedWorks(profile);
    if (cached && cached.works.length > 0) {
      update((s) =>
        recomputeDerived({
          ...s,
          isLoading: false,
          allWorks: cached.works,
          isOffline: true,
          lastSyncedAtMillis: cached.lastSyncedAtMillis ?? s.lastSyncedAtMillis,
        }),
      );
    }
    return refresh();
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },

    /** Show the last saved sheet immediately (works with no internet), then refresh from the network. */
    start() {
      return showCachedThenRefresh(state.activeProfile);
    },

    refresh,

    selectProfile(profile) {
      if (profile.id === state.activeProfile.id) return Promise.resolve();
      prefs.activeProfileId = profile.id;
      update((s) =>
        recomputeDerived({ ...s, activeProfile: profile, allWorks: [], filters: createFilters(), isLoading: true }),
      );
      return showCachedThenRefresh(profile);
    },

    setDefaultProfile(profile) {
      if (profile.id === state.defaultProfileId) return;
      prefs.setDefaultProfile(profile.id);
      update((s) => ({ ...s, defaultProfileId: profile.id }));
    },

    onSearchQueryChange(query) {
      update((s) => recomputeDerived({ ...s, searchQuery: query }));
    },

    onStatusChipSelected(code) {
      update((s) => {
        const newCode = s.filters.statusCode === code ? null : code;
        return recomputeDerived({ ...s, filters: { ...s.filters, statusCode: newCode } });
      });
    },

    /** Persists a new design-status chip order after the user drags chips around. */
    onStatusChipOrderChange(order) {
      const normalized = normalize(order);
      if (sameOrder(normalized, state.statusChipOrder)) return;
      prefs.statusChipOrder = normalized;
      update((s) => ({ ...s, statusChipOrder: normalized }));
    },

    applyFilters(filters) {
      update((s) => recomputeDerived({ ...s, filters: { ...filters, statusCode: s.filters.statusCode } }));
    },

    clearAllFilters() {
      update((s) => recomputeDerived({ ...s, filters: createFilters(), searchQuery: '' }));
    },

    setExporting(exporting) {
      update((s) => ({ ...s, isExporting: exporting }));
    },

    /** The report markup for the print view — see ui/pdfExport.js. */
    buildReportBody(engineerName) {
      return buildReportBody(state.filteredWorks, state.activeProfile, engineerName);
    },

    findWork(rowNum) {
      return state.allWorks.find((work) => work.rowNum === rowNum) || null;
    },
  };
}

function sameOrder(a, b) {
  return a.length === b.length && a.every((code, i) => code === b[i]);
}
