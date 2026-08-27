/**
 * The works list: top bar, search, KPI status chips, filter/profile sheets, offline banner,
 * pull-to-refresh and the Export PDF action.
 * Ported from android/.../ui/main/MainScreen.kt.
 */

import { isAllProfile } from '../config.js';
import { countActiveDropdownFilters, hasAnyFilter } from '../state.js';
import { clear, el, iconButton } from './dom.js';
import { Icons } from './icons.js';
import { createFilterResultChip, createStatChipsRow } from './chips.js';
import { showFilterSheet } from './filterSheet.js';
import { profileDisplayName, showProfileSheet } from './profileSheet.js';
import { showExportPdfNameDialog } from './exportDialog.js';
import { jobNameFor, printReport } from './pdfExport.js';
import { showToast } from './toast.js';
import { workCard } from './workCard.js';
import { attachPullToRefresh } from './pullToRefresh.js';

export function createMainScreen({ viewModel, onWorkClick }) {
  let state = viewModel.getState();

  const subtitle = el('p', { className: 'app-bar-subtitle' });
  const filterBadge = el('span', { className: 'filter-badge', hidden: true });

  const profileButton = iconButton(Icons.switchAccount(), {
    label: 'Switch engineer profile',
    onClick: () => showProfileSheet({
      state,
      onSelect: (profile) => viewModel.selectProfile(profile),
      onSetDefault: (profile) => {
        viewModel.setDefaultProfile(profile);
        showToast(`${profileDisplayName(profile)} set as default on app launch`);
      },
    }),
  });

  const refreshButton = iconButton(Icons.refresh(), {
    label: 'Refresh from the live sheet',
    className: 'refresh-btn',
    onClick: () => viewModel.refresh(),
  });

  const filterButton = iconButton(Icons.filterList(), {
    label: 'Filter works',
    onClick: () => showFilterSheet({ state, onApply: (filters) => viewModel.applyFilters(filters) }),
  });
  filterButton.append(filterBadge);

  const appBar = el('header', { className: 'app-bar' }, [
    el('div', { className: 'app-bar-titles' }, [
      el('h1', { className: 'app-bar-title', text: 'RDO KKD Works' }),
      subtitle,
    ]),
    el('div', { className: 'app-bar-actions' }, [profileButton, refreshButton, filterButton]),
  ]);

  const searchInput = el('input', {
    className: 'search-input',
    attrs: {
      type: 'search',
      placeholder: 'Search work, LAC or remarks…',
      'aria-label': 'Search work, LAC or remarks',
      enterkeyhint: 'search',
    },
    on: { input: (event) => viewModel.onSearchQueryChange(event.target.value) },
  });

  const searchField = el('div', { className: 'search-field' }, [
    el('span', { className: 'search-icon', html: Icons.search() }),
    searchInput,
  ]);

  const chipsRow = createStatChipsRow({
    onChipClick: (code) => viewModel.onStatusChipSelected(code),
    onStatusOrderChange: (order) => viewModel.onStatusChipOrderChange(order),
    onClearAllFilters: () => viewModel.clearAllFilters(),
  });

  const filterResultChip = createFilterResultChip();
  const offlineBanner = el('div', { className: 'offline-banner', hidden: true });
  const list = el('div', { className: 'works-list' });
  const refreshIndicator = el('div', { className: 'refresh-indicator', hidden: true }, [el('span', { className: 'spinner' })]);
  const scrollArea = el('main', { className: 'scroll-area' }, [refreshIndicator, list]);

  const exportFab = el('button', {
    className: 'fab',
    attrs: { type: 'button' },
    on: { click: onExportClick },
  }, [el('span', { className: 'fab-icon', html: Icons.pictureAsPdf() }), el('span', { className: 'fab-label', text: 'Export PDF' })]);

  const root = el('div', { className: 'screen main-screen' }, [
    appBar,
    el('div', { className: 'main-controls' }, [searchField, chipsRow.root, filterResultChip.root, offlineBanner]),
    scrollArea,
    exportFab,
  ]);

  attachPullToRefresh(scrollArea, () => viewModel.refresh());

  function onExportClick() {
    if (state.isExporting) return;
    if (state.filteredWorks.length === 0) {
      showToast('No works to export');
      return;
    }
    showExportPdfNameDialog({
      designation: state.activeProfile.id,
      onConfirm: (engineerName) => exportPdf(engineerName),
    });
  }

  function exportPdf(engineerName) {
    viewModel.setExporting(true);
    const html = viewModel.buildReportHtml(engineerName);
    printReport({
      html,
      jobName: jobNameFor(state.activeProfile.id, engineerName),
      onStarted: () => viewModel.setExporting(false),
      onError: (message) => {
        viewModel.setExporting(false);
        showToast(`Could not create PDF: ${message}`, { long: true });
      },
    });
  }

  function renderOfflineBanner() {
    if (!state.isOffline) {
      offlineBanner.hidden = true;
      return;
    }
    const syncedLabel = state.lastSyncedAtMillis
      ? `Last updated ${new Date(state.lastSyncedAtMillis).toLocaleString(undefined, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}`
      : null;

    let body;
    if (state.errorMessage && syncedLabel) body = `${state.errorMessage} · ${syncedLabel}`;
    else if (state.errorMessage) body = state.errorMessage;
    else if (syncedLabel) body = `Showing saved data — ${syncedLabel}. Pull down to retry.`;
    else body = 'Showing saved data — pull down to retry the live sheet';

    clear(offlineBanner);
    offlineBanner.append(el('span', { className: 'meta-icon', html: Icons.cloudOff() }), el('span', { text: body }));
    offlineBanner.hidden = false;
  }

  function renderList() {
    clear(list);

    if (state.isLoading) {
      list.append(el('div', { className: 'state-block' }, [el('span', { className: 'spinner large' })]));
      return;
    }

    if (state.filteredWorks.length === 0) {
      const anyFilter = hasAnyFilter(state);
      const block = el('div', { className: 'state-block' }, [
        el('p', {
          className: 'empty-title',
          text: anyFilter ? 'No works match your filters' : 'No works found for this engineer',
        }),
      ]);
      if (anyFilter) {
        block.append(
          el('button', {
            className: 'link-btn',
            text: 'Tap to clear all filters',
            attrs: { type: 'button' },
            on: { click: () => viewModel.clearAllFilters() },
          }),
        );
      }
      list.append(block);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const work of state.filteredWorks) fragment.append(workCard(work, onWorkClick));
    list.append(fragment);
  }

  function render(next) {
    state = next;

    subtitle.textContent = isAllProfile(state.activeProfile)
      ? `All engineers • ${state.filteredWorks.length} shown`
      : `Engineer ${state.activeProfile.id} • ${state.filteredWorks.length} shown`;

    if (searchInput.value !== state.searchQuery) searchInput.value = state.searchQuery;

    const activeCount = countActiveDropdownFilters(state.filters);
    filterBadge.textContent = String(activeCount);
    filterBadge.hidden = activeCount === 0;

    chipsRow.render({ ...state, hasAnyFilter: hasAnyFilter(state) });

    if (hasAnyFilter(state)) {
      filterResultChip.render(state.filteredWorks.length, state.allWorks.length);
      filterResultChip.root.hidden = false;
    } else {
      filterResultChip.root.hidden = true;
    }

    renderOfflineBanner();
    refreshIndicator.hidden = !state.isRefreshing;
    refreshButton.classList.toggle('spinning', state.isRefreshing);

    exportFab.classList.toggle('busy', state.isExporting);
    exportFab.querySelector('.fab-label').textContent = state.isExporting ? 'Preparing…' : 'Export PDF';
    exportFab.querySelector('.fab-icon').innerHTML = state.isExporting ? '<span class="spinner"></span>' : Icons.pictureAsPdf();

    renderList();
  }

  return { root, render };
}
