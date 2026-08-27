/**
 * Logic tests for the read-only web app, mirroring the Android unit tests in
 * android/app/src/test/java/com/example/workflowupdater/. No dependencies — run with:
 *
 *     node web/tests/run-tests.mjs
 */

import assert from 'node:assert/strict';

import { ALL_PROFILE, MOCK_ROWS, STATUS_OPTIONS, profileById } from '../js/config.js';
import { SheetDateFormatter, StatusMapper, createWorkItem } from '../js/model.js';
import { createFilters, createUiState, hasAnyFilter, recomputeDerived } from '../js/state.js';
import * as chipOrder from '../js/chipOrder.js';
import { createRepository, filterRowsForProfile } from '../js/repository.js';
import { REPORT_CSS, buildReportBody, buildReportHtml, reportTitle } from '../js/report.js';
import { createWorksViewModel } from '../js/viewmodel.js';

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

  const byStatus = recomputeDerived(baseState({ filters: createFilters({ statusCode: '07' }) }));
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
  const bySe = recomputeDerived(baseState({ filters: createFilters({ se: 'DD' }) }));
  assert.equal(bySe.filteredWorks.length, 1);
  assert.equal(bySe.filteredWorks[0].se, 'DD');
});

test('filter options cascade when a district is selected', () => {
  const district = works()[0].district;
  const state = recomputeDerived(baseState({ filters: createFilters({ district }) }));
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

test('selections that no longer exist are cleared', () => {
  const state = recomputeDerived(baseState({ filters: createFilters({ district: 'Nonexistent District' }) }));
  assert.equal(state.filters.district, null);
});

test('status counts come from the pool before the status chip is applied', () => {
  const state = recomputeDerived(baseState());
  assert.equal(
    Object.values(state.statusCounts).reduce((sum, count) => sum + count, 0),
    works().length,
  );

  const district = works()[0].district;
  const narrowed = recomputeDerived(baseState({ filters: createFilters({ district }) }));
  const pool = works().filter((work) => work.district === district);
  assert.equal(
    Object.values(narrowed.statusCounts).reduce((sum, count) => sum + count, 0),
    pool.length,
  );

  // Picking a chip must not empty the other chips.
  const withChip = recomputeDerived(baseState({ filters: createFilters({ statusCode: '07' }) }));
  assert.equal(
    Object.values(withChip.statusCounts).reduce((sum, count) => sum + count, 0),
    works().length,
  );
});

test('hasAnyFilter tracks search, dropdowns and the status chip', () => {
  assert.equal(hasAnyFilter(baseState()), false);
  assert.equal(hasAnyFilter(baseState({ searchQuery: 'court' })), true);
  assert.equal(hasAnyFilter(baseState({ filters: createFilters({ statusCode: '06' }) })), true);
  assert.equal(hasAnyFilter(baseState({ filters: createFilters({ lac: 'Tarur' }) })), true);
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
  const repository = createRepository({ remote: async () => ({ headers: [], rows: sampleRows() }), localCache: cache });
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

test('browser network errors are translated into something actionable', async () => {
  const repository = createRepository({
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
  assert.equal(viewModel.getState().filters.statusCode, '06');
  viewModel.onStatusChipSelected('06');
  assert.equal(viewModel.getState().filters.statusCode, null);
});

test('applying filters keeps the active status chip, clearing resets everything', async () => {
  const prefs = stubPrefs();
  const repository = createRepository({ remote: async () => ({ headers: [], rows: MOCK_ROWS }), localCache: null });
  const viewModel = createWorksViewModel({ repository, prefs });
  await viewModel.start();

  viewModel.onStatusChipSelected('04');
  viewModel.applyFilters(createFilters({ district: '11 Kozhikode' }));
  assert.equal(viewModel.getState().filters.statusCode, '04');
  assert.equal(viewModel.getState().filters.district, '11 Kozhikode');

  viewModel.onSearchQueryChange('mini');
  viewModel.clearAllFilters();
  const cleared = viewModel.getState();
  assert.equal(cleared.searchQuery, '');
  assert.equal(cleared.filters.district, null);
  assert.equal(cleared.filters.statusCode, null);
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
