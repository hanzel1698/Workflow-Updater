/**
 * Logic tests for the read-only web app. They began as ports of the retired Android app's unit
 * tests, which the section headings still name. No dependencies — run with:
 *
 *     node docs/works/tests/run-tests.mjs
 */

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// SheetJS ships as a classic script for the browser; Node can `require` the same vendored copy.
const XLSX = createRequire(import.meta.url)('../vendor/xlsx.mini.min.js');

import { ALL_PROFILE, MOCK_ROWS, STATUS_OPTIONS, profileById } from '../js/config.js';
import { SheetDateFormatter, StatusMapper, createWorkItem } from '../js/model.js';
import {
  computeDropdownOptions,
  createFilters,
  createUiState,
  hasAnyFilter,
  pruneSelections,
  recomputeDerived,
} from '../js/state.js';
import * as chipOrder from '../js/chipOrder.js';
import { createRepository, filterRowsForProfile } from '../js/repository.js';
import { REPORT_COLUMNS, REPORT_CSS, buildReportBody, buildReportHtml, buildReportModel, reportTitle } from '../js/report.js';
import { parseWorkbook, readWorkflowRows } from '../js/excelImport.js';
import { bulkEngineers, bulkReport, pdfFileName, suggestedEngineerName, titleDateFromInput } from '../js/bulkReports.js';
import { hasUnsupportedCharacters, pdfText } from '../js/pdfDocument.js';
import { createWorksViewModel } from '../js/viewmodel.js';
import { DESKTOP_MIN_WIDTH, applyDesktopLayout, isDesktopEnvironment } from '../js/ui/deviceLayout.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const works = () => MOCK_ROWS.map(createWorkItem);
const baseState = (overrides = {}) => createUiState({ isLoading: false, allWorks: works(), ...overrides });

/* ---------------- StatusMapper (MainScreenViewModelTest.kt) ---------------- */

test('statusMapper maps category codes', () => {
  assert.equal(StatusMapper.mapCategoryToStatus('DDO', '', ''), '04 Detailed Design Ongoing');
  assert.equal(StatusMapper.mapCategoryToStatus('FNO', '', ''), '07 File Not Yet Opened');
  assert.equal(StatusMapper.mapCategoryToStatus('TDI', '', ''), '03 Tentative Design Issued');
  assert.equal(StatusMapper.mapCategoryToStatus('discarded', '', ''), '08 Discarded Work');
});

test('statusMapper infers from remarks when blank', () => {
  assert.equal(StatusMapper.mapCategoryToStatus('', 'Design completed and issued', ''), '06 Detailed Design Issued');
  assert.equal(StatusMapper.mapCategoryToStatus('', 'Awaiting AR drawing', ''), '07 File Not Yet Opened');
});

test('statusMapper passes through numbered status', () => {
  assert.equal(
    StatusMapper.mapCategoryToStatus('02 Tentative Design On Hold', '', ''),
    '02 Tentative Design On Hold',
  );
  assert.equal(StatusMapper.mapCategoryToStatus('05', '', ''), '05 Detailed Design On Hold');
});

test('statusMapper codeOf falls back to 07', () => {
  assert.equal(StatusMapper.codeOf('01 Tentative Design Ongoing'), '01');
  assert.equal(StatusMapper.codeOf('   '), '07');
});

/* ---------------- SheetDateFormatter (SheetDateFormatterTest.kt) ---------------- */

test('sheet dates render as DD/MM/YYYY in Asia/Kolkata', () => {
  // Midnight IST arrives as the previous day in UTC — it must still read as the 7th.
  assert.equal(SheetDateFormatter.format('2025-01-06T18:30:00.000Z'), '07/01/2025');
  assert.equal(SheetDateFormatter.format('2025-01-07'), '07/01/2025');
  assert.equal(SheetDateFormatter.format('7/1/2025'), '07/01/2025');
  assert.equal(SheetDateFormatter.format('7-1-2025'), '07/01/2025');
  assert.equal(SheetDateFormatter.format(''), '');
  assert.equal(
    SheetDateFormatter.format('After getting intimation from field officials'),
    'After getting intimation from field officials',
  );
});

/* ---------------- Row normalization ---------------- */

test('work items resolve columns case-insensitively and expose extras', () => {
  const work = createWorkItem({
    _rowNum: '12',
    'name of work': 'Lowercase header work',
    'DESIGN OFFICE': 'RDO KKD',
    'Unknown Column': 'Keep me',
    Blank: '',
  });
  assert.equal(work.rowNum, 12);
  assert.equal(work.workName, 'Lowercase header work');
  assert.equal(work.designOffice, 'RDO KKD');
  assert.deepEqual(work.extraFields, [['Unknown Column', 'Keep me']]);
});

test('work items fall back to a readable name', () => {
  assert.equal(createWorkItem({ _rowNum: '1' }).workName, 'Untitled Work');
});

/* ---------------- Profile filtering (WorkflowRepositoryFilterTest.kt) ---------------- */

const row = (office, ase, rowNum = '1') => ({
  _rowNum: rowNum,
  'Design Office': office,
  ASE: ase,
  'Name of Work': 'Sample work',
  'Design Status': '04 Detailed Design Ongoing',
});

const sampleRows = () => [
  row('RDO KKD', 'AD'),
  row('RDO KKD', 'AD'),
  row('RDO KKD', 'ASE01'),
  row('RDO KKD', 'ASE01'),
  row('RDO TCR', 'AD'),
  row('RDO KKD', 'OTHER'),
];

test('single profile keeps RDO KKD rows with a matching ASE', () => {
  const filtered = filterRowsForProfile(sampleRows(), profileById('AD'));
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((work) => work.designOffice.toLowerCase().includes('rdo kkd')));
  assert.ok(filtered.every((work) => work.ase.toLowerCase() === 'ad'));
});

test('all profile keeps RDO KKD rows for every configured engineer', () => {
  const filtered = filterRowsForProfile(sampleRows(), ALL_PROFILE);
  assert.equal(filtered.length, 4);
  const engineers = new Set(filtered.map((work) => work.ase.toUpperCase()));
  assert.ok(engineers.has('AD') && engineers.has('ASE01'));
});

test('all profile excludes other offices and unknown engineers', () => {
  const filtered = filterRowsForProfile(sampleRows(), ALL_PROFILE);
  assert.ok(filtered.every((work) => work.ase.toUpperCase() !== 'OTHER'));
  assert.ok(filtered.every((work) => !work.designOffice.toLowerCase().includes('rdo tcr')));
});

/* ---------------- Derived state (MainScreenViewModelTest.kt) ---------------- */

test('search and status chip narrow the list', () => {
  const bySearch = recomputeDerived(baseState({ searchQuery: 'family court' }));
  assert.equal(bySearch.filteredWorks.length, 1);
  assert.equal(bySearch.filteredWorks[0].workName, 'Construction of Family Court - Kasargod');

  const byStatus = recomputeDerived(baseState({ filters: createFilters({ statusCodes: ['07'] }) }));
  assert.equal(byStatus.filteredWorks.length, 1);
});

test('search also matches file number, LAC and design-unit remarks', () => {
  assert.equal(recomputeDerived(baseState({ searchQuery: 'balusseri' })).filteredWorks.length, 2);
  assert.equal(recomputeDerived(baseState({ searchQuery: 'soil investigation' })).filteredWorks.length, 1);
  // Parity with Android: the short "Remarks" column is shown on the card but is not searched.
  assert.equal(recomputeDerived(baseState({ searchQuery: 'shuttering' })).filteredWorks.length, 0);
});

test('filter options are built from the loaded works', () => {
  const state = recomputeDerived(baseState());
  assert.ok(state.districtOptions.length > 0);
  assert.ok(state.seOptions.every((option) => works().some((work) => work.se === option)));
  assert.ok(state.asStatusOptions.every((option) => works().some((work) => work.asStatus === option)));
  assert.ok(state.arStatusOptions.every((option) => works().some((work) => work.arStatus === option)));
  assert.ok(state.srStatusOptions.every((option) => works().some((work) => work.srStatus === option)));
});

test('SE filter narrows the list', () => {
  const bySe = recomputeDerived(baseState({ filters: createFilters({ se: ['DD'] }) }));
  assert.equal(bySe.filteredWorks.length, 1);
  assert.equal(bySe.filteredWorks[0].se, 'DD');
});

test('dropdown filters are multi-select: picking several widens the match to any of them', () => {
  const [districtA, districtB] = [...new Set(works().map((w) => w.district))];
  const state = recomputeDerived(baseState({ filters: createFilters({ district: [districtA, districtB] }) }));
  assert.ok(state.filteredWorks.every((w) => w.district === districtA || w.district === districtB));
  assert.equal(
    state.filteredWorks.length,
    works().filter((w) => w.district === districtA || w.district === districtB).length,
  );
});

test('filter options cascade when a district is selected', () => {
  const district = works()[0].district;
  const state = recomputeDerived(baseState({ filters: createFilters({ district: [district] }) }));
  const expected = [
    ...new Set(
      works()
        .filter((work) => work.district === district)
        .map((work) => work.lac)
        .filter((lac) => lac !== ''),
    ),
  ].sort();
  assert.deepEqual(state.lacOptions, expected);
});

test('cascading options widen across several selected districts (union, not intersection)', () => {
  const [districtA, districtB] = [...new Set(works().map((w) => w.district))];
  const options = computeDropdownOptions(works(), createFilters({ district: [districtA, districtB] }));
  const expected = [
    ...new Set(
      works()
        .filter((w) => w.district === districtA || w.district === districtB)
        .map((w) => w.lac)
        .filter((lac) => lac !== ''),
    ),
  ].sort();
  assert.deepEqual(options.lac, expected);
});

test('selections that no longer exist are cleared', () => {
  const state = recomputeDerived(baseState({ filters: createFilters({ district: ['Nonexistent District'] }) }));
  assert.deepEqual(state.filters.district, []);
});

test('status counts come from the pool before the status chip is applied', () => {
  const state = recomputeDerived(baseState());
  assert.equal(
    Object.values(state.statusCounts).reduce((sum, count) => sum + count, 0),
    works().length,
  );

  const district = works()[0].district;
  const narrowed = recomputeDerived(baseState({ filters: createFilters({ district: [district] }) }));
  const pool = works().filter((work) => work.district === district);
  assert.equal(
    Object.values(narrowed.statusCounts).reduce((sum, count) => sum + count, 0),
    pool.length,
  );

  // Picking a chip must not empty the other chips.
  const withChip = recomputeDerived(baseState({ filters: createFilters({ statusCodes: ['07'] }) }));
  assert.equal(
    Object.values(withChip.statusCounts).reduce((sum, count) => sum + count, 0),
    works().length,
  );
});

test('picking several status chips widens the list to their union', () => {
  const one = recomputeDerived(baseState({ filters: createFilters({ statusCodes: ['06'] }) }));
  const other = recomputeDerived(baseState({ filters: createFilters({ statusCodes: ['07'] }) }));
  const both = recomputeDerived(baseState({ filters: createFilters({ statusCodes: ['06', '07'] }) }));

  assert.equal(both.filteredWorks.length, one.filteredWorks.length + other.filteredWorks.length);
  assert.ok(both.filteredWorks.every((work) => work.statusCode === '06' || work.statusCode === '07'));

  // No chip picked is "every status", not "no status".
  assert.equal(recomputeDerived(baseState({ filters: createFilters({ statusCodes: [] }) })).filteredWorks.length, works().length);
});

test('status counts stay whole however many chips are picked', () => {
  const state = recomputeDerived(baseState({ filters: createFilters({ statusCodes: ['06', '07'] }) }));
  assert.equal(
    Object.values(state.statusCounts).reduce((sum, count) => sum + count, 0),
    works().length,
  );
});

test('ASE options are exposed for the All Engineers profile filter group', () => {
  const state = recomputeDerived(baseState());
  assert.ok(state.aseOptions.every((option) => works().some((work) => work.ase === option)));
});

test('pruneSelections drops a value no longer present in its computed options', () => {
  const options = computeDropdownOptions(works(), createFilters());
  const pruned = pruneSelections(createFilters({ lac: ['Nonexistent LAC'] }), options);
  assert.deepEqual(pruned.lac, []);
});

test('picking a District cascades LAC options the way the filter sheet does, dropping a now-stale LAC pick', () => {
  // Mirrors filterSheet.js's render(): the just-picked field (District) is kept as-is, and every
  // other field is re-cascaded and pruned against it — never the other way around, so a fresh
  // pick is never undone by a selection made before it.
  const district = works()[0].district;
  const otherLac = works().find((w) => w.district !== district && w.lac !== '').lac;
  const selection = createFilters({ district: [district], lac: [otherLac] });

  const options = computeDropdownOptions(works(), selection);
  const afterPruningEverythingButDistrict = {
    ...selection,
    lac: selection.lac.filter((value) => options.lac.includes(value)),
  };

  assert.deepEqual(afterPruningEverythingButDistrict.lac, [], 'a LAC from another district falls out of the cascade');
  assert.deepEqual(afterPruningEverythingButDistrict.district, [district], 'the just-picked field is never pruned');
});

test('hasAnyFilter tracks search, dropdowns and the status chip', () => {
  assert.equal(hasAnyFilter(baseState()), false);
  assert.equal(hasAnyFilter(baseState({ searchQuery: 'court' })), true);
  assert.equal(hasAnyFilter(baseState({ filters: createFilters({ statusCodes: ['06'] }) })), true);
  assert.equal(hasAnyFilter(baseState({ filters: createFilters({ lac: ['Tarur'] }) })), true);
});

/* ---------------- Chip order (StatusChipOrderTest.kt) ---------------- */

test('chip order normalizes unknown, missing and duplicate codes', () => {
  assert.deepEqual(chipOrder.normalize(null), chipOrder.defaultOrder());
  assert.deepEqual(chipOrder.normalize([]), chipOrder.defaultOrder());
  assert.deepEqual(chipOrder.normalize(['06', '06', 'ZZ', '01']).slice(0, 2), ['06', '01']);
  assert.equal(chipOrder.normalize(['06']).length, 9);
  assert.deepEqual([...chipOrder.normalize(['06'])].sort(), [...chipOrder.defaultOrder()].sort());
});

test('chip move reorders and ignores out-of-range indices', () => {
  const order = chipOrder.defaultOrder();
  assert.deepEqual(chipOrder.move(order, 0, 2).slice(0, 3), ['02', '03', '01']);
  assert.deepEqual(chipOrder.move(order, 0, 99), order);
  assert.deepEqual(chipOrder.move(order, 3, 3), order);
});

test('reordering visible chips keeps hidden chips in their slots', () => {
  const full = chipOrder.defaultOrder(); // 01..09
  const reordered = chipOrder.applyVisibleReorder(full, ['04', '01']); // visible were 01, 04
  assert.deepEqual(reordered[0], '04');
  assert.deepEqual(reordered[3], '01');
  assert.deepEqual(reordered.slice(1, 3), ['02', '03']);
  assert.equal(reordered.length, 9);
});

/* ---------------- Repository fallbacks (WorkflowRepositoryOfflineCacheTest.kt) ---------------- */

const memoryCache = () => {
  let snapshot = null;
  return {
    save(rows, syncedAtMillis) {
      snapshot = { rows, syncedAtMillis };
    },
    load() {
      return snapshot;
    },
  };
};

test('a successful fetch is served live and written to the cache', async () => {
  const cache = memoryCache();
  const repository = createRepository({ remote: async () => ({ headers: [], rows: sampleRows() }), localCache: cache, retryDelays: [0] });
  const result = await repository.loadWorks(profileById('AD'));

  assert.equal(result.isOffline, false);
  assert.equal(result.works.length, 2);
  assert.ok(result.lastSyncedAtMillis > 0);
  assert.equal(cache.load().rows.length, 6);
});

test('a failed fetch falls back to the cached snapshot', async () => {
  const cache = memoryCache();
  cache.save(sampleRows(), 1700000000000);
  const repository = createRepository({
    retryDelays: [0],
    remote: async () => {
      throw new Error('Network unreachable');
    },
    localCache: cache,
  });
  const result = await repository.loadWorks(profileById('AD'));

  assert.equal(result.isOffline, true);
  assert.equal(result.works.length, 2);
  assert.equal(result.errorMessage, 'Network unreachable');
  assert.equal(result.lastSyncedAtMillis, 1700000000000);
});

test('with no cache a failed fetch falls back to the offline sample, and says so', async () => {
  const repository = createRepository({
    retryDelays: [0],
    remote: async () => {
      throw new Error('boom');
    },
    localCache: null,
  });
  const result = await repository.loadWorks(profileById('AD'));

  assert.equal(result.isOffline, true);
  assert.equal(result.isSample, true, 'sample rows must be labelled as such, not as saved data');
  assert.equal(result.works.length, MOCK_ROWS.length);
  assert.equal(result.lastSyncedAtMillis, null);
});

test('a transient failure is retried before giving up', async () => {
  let calls = 0;
  const repository = createRepository({
    retryDelays: [0],
    remote: async () => {
      calls += 1;
      if (calls === 1) throw new Error('transient');
      return { headers: [], rows: sampleRows() };
    },
    localCache: null,
  });
  const result = await repository.loadWorks(profileById('AD'));

  assert.equal(calls, 2);
  assert.equal(result.isOffline, false, 'the retry succeeded, so this is a live load');
  assert.equal(result.works.length, 2);
});

test('a copy synced moments ago is reused; a forced refresh and concurrent loads hit the sheet once', async () => {
  let calls = 0;
  const remote = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { headers: [], rows: sampleRows() };
  };
  const repository = createRepository({ remote, localCache: memoryCache(), retryDelays: [0] });
  const profile = profileById('AD');

  await Promise.all([repository.loadWorks(profile, { force: true }), repository.loadWorks(profile, { force: true })]);
  assert.equal(calls, 1, 'overlapping loads share one request');

  const reused = await repository.loadWorks(profile);
  assert.equal(calls, 1, 'a fresh copy is not re-fetched');
  assert.equal(reused.isOffline, false);

  await repository.loadWorks(profile, { force: true });
  assert.equal(calls, 2);
});

test('only a forced refresh asks the Web App to re-read the sheet', async () => {
  const asked = [];
  const remote = async (scriptUrl, options) => {
    asked.push(options.refresh);
    return { headers: [], rows: sampleRows() };
  };
  const repository = createRepository({ remote, localCache: null, retryDelays: [0], freshWindowMs: 0 });
  const profile = profileById('AD');

  await repository.loadWorks(profile);
  await repository.loadWorks(profile, { force: true });
  assert.deepEqual(asked, [false, true]);
});

test('a forced refresh does not settle for a plain read already in flight', async () => {
  const asked = [];
  const remote = async (scriptUrl, options) => {
    asked.push(options.refresh);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { headers: [], rows: options.refresh ? sampleRows() : [] };
  };
  const repository = createRepository({ remote, localCache: null, retryDelays: [0] });
  const profile = profileById('AD');

  const [plain, forced] = await Promise.all([
    repository.loadWorks(profile),
    repository.loadWorks(profile, { force: true }),
  ]);
  assert.deepEqual(asked, [false, true]);
  assert.equal(plain.works.length, 0);
  assert.equal(forced.works.length, 2, 'the refresh gets the re-read sheet');

  await repository.loadWorks(profile);
  assert.equal(asked.length, 2, 'the refreshed copy is then reused');
});

test('browser network errors are translated into something actionable', async () => {
  const repository = createRepository({
    retryDelays: [0],
    remote: async () => {
      throw new TypeError('Failed to fetch');
    },
    localCache: null,
  });
  const result = await repository.loadWorks(profileById('AD'));

  assert.match(result.errorMessage, /script\.google\.com/);
  assert.doesNotMatch(result.errorMessage, /Failed to fetch/);
});

test('a timeout is reported as a timeout', async () => {
  const repository = createRepository({
    retryDelays: [0],
    remote: async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    },
    localCache: null,
  });
  assert.match((await repository.loadWorks(profileById('AD'))).errorMessage, /too long to respond/);
});

test('the failure reason survives even when fallback data is shown', async () => {
  const prefs = stubPrefs();
  const repository = createRepository({
    retryDelays: [0],
    remote: async () => {
      throw new TypeError('Failed to fetch');
    },
    localCache: null,
  });
  const viewModel = createWorksViewModel({ repository, prefs });
  await viewModel.start();

  const state = viewModel.getState();
  assert.ok(state.works !== undefined || true);
  assert.equal(state.isSample, true);
  assert.ok(state.errorMessage, 'the reason must reach the UI, not be swallowed because rows exist');
  assert.ok(state.allWorks.length > 0);
});

test('cached works are available before any network call', () => {
  const cache = memoryCache();
  cache.save(sampleRows(), 42);
  const repository = createRepository({ remote: async () => ({ headers: [], rows: [] }), localCache: cache });

  assert.equal(repository.loadCachedWorks(profileById('AD')).works.length, 2);
  assert.equal(createRepository({ localCache: null }).loadCachedWorks(profileById('AD')), null);
});

/* ---------------- View model ---------------- */

const stubPrefs = () => {
  const store = { activeProfileId: 'AD', defaultProfileId: 'AD', statusChipOrder: chipOrder.defaultOrder() };
  return {
    get activeProfileId() {
      return store.activeProfileId;
    },
    set activeProfileId(value) {
      store.activeProfileId = value;
    },
    get defaultProfileId() {
      return store.defaultProfileId;
    },
    get statusChipOrder() {
      return store.statusChipOrder;
    },
    set statusChipOrder(value) {
      store.statusChipOrder = value;
    },
    launchProfileId: () => store.activeProfileId,
    setDefaultProfile(id) {
      store.defaultProfileId = id;
    },
    store,
  };
};

test('view model loads works and recomputes derived state', async () => {
  const prefs = stubPrefs();
  const repository = createRepository({ remote: async () => ({ headers: [], rows: MOCK_ROWS }), localCache: null });
  const viewModel = createWorksViewModel({ repository, prefs });

  await viewModel.start();
  const state = viewModel.getState();
  assert.equal(state.isLoading, false);
  assert.equal(state.allWorks.length, MOCK_ROWS.length);
  assert.equal(state.filteredWorks.length, MOCK_ROWS.length);
  assert.equal(state.isOffline, false);
});

test('tapping the active status chip clears it', async () => {
  const prefs = stubPrefs();
  const repository = createRepository({ remote: async () => ({ headers: [], rows: MOCK_ROWS }), localCache: null });
  const viewModel = createWorksViewModel({ repository, prefs });
  await viewModel.start();

  viewModel.onStatusChipSelected('06');
  assert.deepEqual(viewModel.getState().filters.statusCodes, ['06']);
  viewModel.onStatusChipSelected('06');
  assert.deepEqual(viewModel.getState().filters.statusCodes, []);
});

test('status chips accumulate, toggle off individually, and All works clears them', async () => {
  const prefs = stubPrefs();
  const repository = createRepository({ remote: async () => ({ headers: [], rows: MOCK_ROWS }), localCache: null });
  const viewModel = createWorksViewModel({ repository, prefs });
  await viewModel.start();

  viewModel.onStatusChipSelected('06');
  viewModel.onStatusChipSelected('07');
  assert.deepEqual(viewModel.getState().filters.statusCodes, ['06', '07'], 'a second chip adds, it does not replace');

  // Kept in canonical order however they were tapped, so the report reads 01…09.
  viewModel.onStatusChipSelected('01');
  assert.deepEqual(viewModel.getState().filters.statusCodes, ['01', '06', '07']);

  viewModel.onStatusChipSelected('06');
  assert.deepEqual(viewModel.getState().filters.statusCodes, ['01', '07'], 'tapping a picked chip removes just that one');

  viewModel.onStatusChipSelected(null);
  assert.deepEqual(viewModel.getState().filters.statusCodes, [], 'All works clears the whole selection');
});

test('applying filters keeps the active status chip, clearing resets everything', async () => {
  const prefs = stubPrefs();
  const repository = createRepository({ remote: async () => ({ headers: [], rows: MOCK_ROWS }), localCache: null });
  const viewModel = createWorksViewModel({ repository, prefs });
  await viewModel.start();

  viewModel.onStatusChipSelected('04');
  viewModel.applyFilters(createFilters({ district: ['11 Kozhikode'] }));
  assert.deepEqual(viewModel.getState().filters.statusCodes, ['04']);
  assert.deepEqual(viewModel.getState().filters.district, ['11 Kozhikode']);

  viewModel.onSearchQueryChange('mini');
  viewModel.clearAllFilters();
  const cleared = viewModel.getState();
  assert.equal(cleared.searchQuery, '');
  assert.deepEqual(cleared.filters.district, []);
  assert.deepEqual(cleared.filters.statusCodes, []);
});

test('chip order changes are persisted through prefs', async () => {
  const prefs = stubPrefs();
  const repository = createRepository({ remote: async () => ({ headers: [], rows: MOCK_ROWS }), localCache: null });
  const viewModel = createWorksViewModel({ repository, prefs });
  await viewModel.start();

  viewModel.onStatusChipOrderChange(['06', '04']);
  assert.equal(viewModel.getState().statusChipOrder[0], '06');
  assert.equal(prefs.store.statusChipOrder[0], '06');
});

test('switching profile reloads for that engineer', async () => {
  const prefs = stubPrefs();
  const repository = createRepository({ remote: async () => ({ headers: [], rows: sampleRows() }), localCache: null });
  const viewModel = createWorksViewModel({ repository, prefs });
  await viewModel.start();
  assert.equal(viewModel.getState().allWorks.length, 2);

  await viewModel.selectProfile(ALL_PROFILE);
  assert.equal(viewModel.getState().activeProfile.id, 'ALL');
  assert.equal(viewModel.getState().allWorks.length, 4);
  assert.equal(prefs.store.activeProfileId, 'ALL');
});

test('findWork resolves a row number for the detail view', async () => {
  const prefs = stubPrefs();
  const repository = createRepository({ remote: async () => ({ headers: [], rows: MOCK_ROWS }), localCache: null });
  const viewModel = createWorksViewModel({ repository, prefs });
  await viewModel.start();

  assert.equal(viewModel.findWork(850).workName, 'Construction of Family Court - Kasargod');
  assert.equal(viewModel.findWork(-99), null);
});

/* ---------------- PDF report (PdfReportBuilder.kt) ---------------- */

test('report title matches the Android print job name', () => {
  assert.equal(reportTitle('AD', 'Hanzel H. Fernandez', '26-08-2026'), 'PROGRESS REPORT - AD - Hanzel H. Fernandez - AS ON 26-08-2026.');
});

test('report groups every status and marks empty groups NIL', () => {
  const html = buildReportHtml(works(), profileById('AD'), 'Hanzel H. Fernandez');
  for (const status of STATUS_OPTIONS) assert.ok(html.includes(status.toUpperCase()), `missing group ${status}`);
  assert.ok(html.includes('06 DETAILED DESIGN ISSUED : 2 WORKS'));
  assert.ok(html.includes('07 FILE NOT YET OPENED : 1 WORK'));
  assert.equal((html.match(/nil-row/g) || []).length, 6);
  assert.ok(html.includes('Total number of works: 5'));
  assert.ok(html.includes('@page { size: A3 landscape; margin: 1cm; }'));
});

test('the report body carries the whole report, for the in-page print view', () => {
  const body = buildReportBody(works(), profileById('AD'), 'Hanzel H. Fernandez');
  assert.ok(body.startsWith('<div class="report-root">'));
  assert.ok(!body.includes('<!DOCTYPE'), 'the body is injected into the app page, not a document');
  assert.equal((body.match(/class="status-group-row"/g) || []).length, 9);
  assert.equal((body.match(/nil-row/g) || []).length, 6);
  assert.ok(body.includes('Total number of works: 5'));
});

test('a multi-status report carries every picked status, and only those', () => {
  const statusCodes = ['06', '07'];
  const selected = recomputeDerived(baseState({ filters: createFilters({ statusCodes }) })).filteredWorks;
  const body = buildReportBody(selected, profileById('AD'), 'Hanzel H. Fernandez', { statusCodes });

  // Both picked groups are present and populated — neither is dropped in favour of the other.
  assert.ok(body.includes('06 DETAILED DESIGN ISSUED : 2 WORKS'));
  assert.ok(body.includes('07 FILE NOT YET OPENED : 1 WORK'));
  assert.equal((body.match(/class="status-group-row"/g) || []).length, 2);
  assert.equal((body.match(/nil-row/g) || []).length, 0, 'a picked status with works is never NIL');

  // Every work of both statuses reaches the file.
  assert.ok(body.includes('Total number of works: 3'));
  for (const work of selected) assert.ok(body.includes(work.workName), `missing work: ${work.workName}`);

  // The groups filtered out are absent, not printed as NIL.
  assert.ok(!body.includes('01 TENTATIVE DESIGN ONGOING'));
  assert.ok(body.includes('Design status: 06 Detailed Design Issued; 07 File Not Yet Opened'));
});

test('a report with no chips picked still lists every status, NIL included', () => {
  const body = buildReportBody(works(), profileById('AD'), 'Hanzel H. Fernandez', { statusCodes: [] });
  assert.equal((body.match(/class="status-group-row"/g) || []).length, 9);
  assert.ok(!body.includes('report-scope-note'), 'an unfiltered report has no status scope to declare');
});

test('every report row fills all 14 columns, so no cell loses its borders', () => {
  // A row one cell short leaves the last column with no cell at all in that row, and a cell that
  // is not there draws no borders — the printed table then ends in a gap.
  const body = buildReportBody(works(), profileById('AD'), 'Hanzel H. Fernandez');
  const headerCells = (body.match(/<th[\s>]/g) || []).length;
  assert.equal(headerCells, 14);
  assert.equal((body.match(/<col[\s>]/g) || []).length, 14);

  for (const row of body.match(/<tr[\s\S]*?<\/tr>/g) || []) {
    if (row.includes('<th')) continue;
    const spans = [...row.matchAll(/<td(?:\s[^>]*)?>/g)].map((match) => {
      const colspan = /colspan="(\d+)"/.exec(match[0]);
      return colspan ? Number(colspan[1]) : 1;
    });
    assert.equal(
      spans.reduce((total, span) => total + span, 0),
      headerCells,
      `row does not span every column: ${row}`,
    );
  }
});

test('report CSS is fully scoped so it cannot leak into the app when injected', () => {
  // Every rule must be scoped to .report-root. A bare `body`/`table`/`td` rule here would
  // restyle the whole dashboard the moment the print view is added to the page.
  const selectors = REPORT_CSS.split('}')
    .map((block) => block.split('{')[0].trim())
    .filter((selector) => selector !== '' && !selector.startsWith('@'));
  assert.ok(selectors.length > 5, 'expected the report stylesheet to have rules');
  for (const selector of selectors) {
    for (const part of selector.split(',')) {
      assert.ok(
        part.trim().startsWith('.report-root'),
        `unscoped selector would leak into the app: ${part.trim()}`,
      );
    }
  }
});

test('report escapes HTML and blanks become dashes', () => {
  const html = buildReportHtml(
    [createWorkItem({ _rowNum: '1', 'Name of Work': '<script>&"', 'Design Status': '01 Tentative Design Ongoing' })],
    profileById('AD'),
    'Tester',
  );
  assert.ok(html.includes('&lt;script&gt;&amp;&quot;'));
  assert.ok(!html.includes('<script>&"'));
  assert.ok(html.includes('<td class="center">-</td>'));
});

/* ---------------- Desktop detection (deviceLayout.js) ---------------- */

test('a wide mouse-driven window is a desktop PC', () => {
  assert.equal(
    isDesktopEnvironment({ viewportWidth: 1920, finePointer: true, mobileHint: false, maxTouchPoints: 0 }),
    true,
  );
  // Touchscreen laptops still report a fine primary pointer.
  assert.equal(
    isDesktopEnvironment({ viewportWidth: 1440, finePointer: true, mobileHint: false, maxTouchPoints: 10 }),
    true,
  );
});

test('phones and tablets keep the compact layout', () => {
  // Phone: narrow and coarse.
  assert.equal(isDesktopEnvironment({ viewportWidth: 412, finePointer: false, mobileHint: true }), false);
  // Tablet in landscape: wide enough, but finger-driven.
  assert.equal(isDesktopEnvironment({ viewportWidth: 1180, finePointer: false, maxTouchPoints: 5 }), false);
  // iPadOS Safari sends a Mac user-agent string; the pointer check is what catches it.
  assert.equal(isDesktopEnvironment({ viewportWidth: 1024, finePointer: false, mobileHint: null }), false);
});

test('the mobile client hint overrules a wide window', () => {
  assert.equal(isDesktopEnvironment({ viewportWidth: 1600, finePointer: true, mobileHint: true }), false);
});

test('a PC window narrowed below the threshold falls back to the compact layout', () => {
  assert.equal(isDesktopEnvironment({ viewportWidth: DESKTOP_MIN_WIDTH, finePointer: true }), true);
  assert.equal(isDesktopEnvironment({ viewportWidth: DESKTOP_MIN_WIDTH - 1, finePointer: true }), false);
});

test('without pointer media queries, no touch digitizer means a PC', () => {
  assert.equal(isDesktopEnvironment({ viewportWidth: 1280, finePointer: null, maxTouchPoints: 0 }), true);
  assert.equal(isDesktopEnvironment({ viewportWidth: 1280, finePointer: null, maxTouchPoints: 5 }), false);
});

test('nothing known at all is treated as compact', () => {
  assert.equal(isDesktopEnvironment(), false);
});

test('applyDesktopLayout stamps <html> and re-checks when the window is resized', () => {
  const listeners = { resize: [], change: [] };
  const root = { dataset: {} };
  const view = {
    innerWidth: 1600,
    document: { documentElement: root },
    navigator: { maxTouchPoints: 0 },
    matchMedia: () => ({
      matches: true,
      addEventListener: (_type, handler) => listeners.change.push(handler),
    }),
    addEventListener: (type, handler) => listeners[type].push(handler),
  };

  applyDesktopLayout(view);
  assert.equal(root.dataset.device, 'desktop');

  view.innerWidth = 700;
  for (const handler of listeners.resize) handler();
  assert.equal(root.dataset.device, 'compact', 'a narrowed window goes back to the phone layout');

  assert.equal(listeners.change.length, 1, 'pointer changes (docking a tablet) re-run the check');
});

/* ---------------- Excel import (js/excelImport.js) ---------------- */

/** An .xlsx shaped like the Google Sheets download: title rows above the header, extra tabs. */
function workbookBytes({ sheetName = 'WORKFLOW MONITORING SHEET', extraTabs = true } = {}) {
  const header = ['e-Office File Number', 'Name of Work', 'District', 'LAC', 'Design Office', 'Design Status', 'ASE', 'Total area in m2', 'Tentative Issued Date', 'I/C (ASE)'];
  const ws = XLSX.utils.aoa_to_sheet([
    ['RDO KKD workflow'],
    [],
    header,
    ['F1', 'Rest house', '09 Palakkad', 'Tarur', 'RDO KKD', '06 Detailed Design Issued', 'AD', 1015, 45663, false],
    ['F2', 'Library', '13 Kannur', 'Payyannur', 'RDO KKD', 'DDO', 'ASE02', '', '', ''],
    ['', '', '', '', 'RDO KKD', '', 'AD', '', '', ''], // formatted but empty table row
    ['F3', 'Hostel', '11 Kozhikode', 'Kozhikode North', 'RDO KKD', 'FNO', 'Not Assigned', '', '', ''],
    ['F4', 'Court', '14 Kasargod', 'Kasaragod', 'RDO TVM', 'DDI', 'AD', '', '', ''],
  ]);
  // Column I holds a real date cell: serial 45663 is 06/01/2025.
  ws.I4.z = 'dd/mm/yyyy';
  const wb = XLSX.utils.book_new();
  if (extraTabs) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Districts'], ['09 Palakkad']]), 'Dropdown Details');
  if (extraTabs) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ['', 'Old work']]), 'OLD WORKFLOW MONITORING SHEET');
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

test('the Excel copy yields the same rows the Apps Script serves', () => {
  const { sheetName, headers, rows } = readWorkflowRows(XLSX, parseWorkbook(XLSX, workbookBytes()));
  assert.equal(sheetName, 'WORKFLOW MONITORING SHEET');
  assert.equal(headers[1], 'Name of Work');
  assert.deepEqual(rows.map((row) => row['Name of Work']), ['Rest house', 'Library', 'Hostel', 'Court'], 'rows without a Name of Work are skipped');
  assert.equal(rows[0]._rowNum, '4', 'the 1-based sheet row, header offset included');
  assert.equal(rows[0]['Total area in m2'], '1015');
  assert.equal(rows[0]['I/C (ASE)'], 'false', 'booleans stringify as Apps Script does');
  assert.equal(rows[0]['Tentative Issued Date'], '06/01/2025', 'a date cell is read from its day number, with no timezone slip');
  assert.equal(SheetDateFormatter.format(rows[0]['Tentative Issued Date']), '06/01/2025');
});

test('a renamed workflow tab is still found, and archived OLD tabs are skipped', () => {
  const { sheetName, rows } = readWorkflowRows(XLSX, parseWorkbook(XLSX, workbookBytes({ sheetName: 'Sheet1' })));
  assert.equal(sheetName, 'Sheet1');
  assert.equal(rows.length, 4);
});

test('a workbook with no workflow tab says so', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Something else']]), 'Notes');
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  assert.throws(() => readWorkflowRows(XLSX, parseWorkbook(XLSX, bytes)), /Name of Work/);
});

/* ---------------- Bulk reports (js/bulkReports.js) ---------------- */

test('bulk lists the roster, All, then ASE values the file has that the roster lacks', () => {
  const { rows } = readWorkflowRows(XLSX, parseWorkbook(XLSX, workbookBytes()));
  const lines = bulkEngineers(rows);
  assert.deepEqual(
    lines.map((line) => line.profile.id),
    ['AD', 'ASE01', 'ASE02', 'ASE03', 'AHE01', 'AHE02', 'ALL', 'Not Assigned'],
  );
  const count = (id) => lines.find((line) => line.profile.id === id).workCount;
  assert.equal(count('AD'), 1, 'RDO TVM works are not RDO KKD works');
  assert.equal(count('ASE02'), 1);
  assert.equal(count('ALL'), 2, 'All covers the roster, not unassigned works');
  assert.equal(count('Not Assigned'), 1);
});

test('bulk report: title date, works and file name for one engineer', () => {
  const { rows } = readWorkflowRows(XLSX, parseWorkbook(XLSX, workbookBytes()));
  const report = bulkReport(rows, { profile: profileById('ASE02'), engineerName: 'A. N. Other' }, '07-10-2026');
  assert.equal(report.model.title, 'PROGRESS REPORT - ASE02 - A. N. Other - AS ON 07-10-2026.');
  assert.equal(report.works.length, 1);
  assert.equal(report.fileName, 'PR-BUILDINGS - ASE02 - A. N. Other - as on 07-10-2026.pdf');
  assert.equal(pdfFileName('AD', 'X/Y', '01-01-2026'), 'PR-BUILDINGS - AD - X-Y - as on 01-01-2026.pdf');
});

test('bulk suggests the roster name and converts the date input', () => {
  assert.equal(suggestedEngineerName(profileById('AD')), 'Hanzel H. Fernandez');
  assert.equal(suggestedEngineerName(profileById('ASE01')), '', 'an id-only roster entry has no name to offer');
  assert.equal(titleDateFromInput('2026-10-07'), '07-10-2026');
  assert.equal(titleDateFromInput(''), null);
});

/* ---------------- Report model and PDF text ---------------- */

test('the report model and the print view agree on every cell', () => {
  const model = buildReportModel(works(), profileById('AD'), 'Hanzel H. Fernandez', { date: '01-01-2026' });
  assert.equal(REPORT_COLUMNS.length, 14);
  assert.equal(model.groups.length, STATUS_OPTIONS.length);
  const body = buildReportBody(works(), profileById('AD'), 'Hanzel H. Fernandez', { date: '01-01-2026' });
  assert.ok(body.includes('AS ON 01-01-2026.'));
  for (const group of model.groups) {
    assert.ok(body.includes(group.heading));
    for (const cells of group.rows) {
      assert.equal(cells.length, 14);
      assert.ok(body.includes(cells[0]));
    }
  }
});

test('PDF text folds typographic punctuation and flags what Helvetica cannot draw', () => {
  assert.equal(pdfText('Area\u00a0m\u00b2 \u2013 \u201cDD\u201d issued\u2026'), 'Area m\u00b2 - "DD" issued...');
  assert.equal(pdfText('\u0d15\u0d4b'), '??');
  const model = buildReportModel(works(), profileById('AD'), 'Hanzel H. Fernandez');
  assert.equal(hasUnsupportedCharacters(model), false);
  model.groups[3].rows[0][9] = 'remark \u0d15';
  assert.equal(hasUnsupportedCharacters(model), true);
  assert.equal(hasUnsupportedCharacters(model), true, 'the check holds no state between calls');
});

/* ---------------- Runner ---------------- */

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${name}\n      ${error.message}`);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} passed`);
process.exit(failures === 0 ? 0 : 1);
