/**
 * Workflow Updater - Targeted Frontend Controller (RDO KKD • AD)
 * Handles state, fetch/sync, profile-filtering, searching, and optimistic updates.
 */

const CONFIG = window.CONFIG;

// Application State
let state = {
  tasks: [],
  sheetHeaders: CONFIG.DEFAULT_SHEET_HEADERS || [],
  dropdownOptions: {},
  searchQuery: '',
  isSimulationMode: CONFIG.SIMULATION_MODE || !CONFIG.SCRIPT_URL,
  activeStatusFilter: 'ALL',
  activeView: 'LIST', // 'LIST', 'CALENDAR', 'ANALYTICS'
  currentMonth: new Date(),
  activityLogs: [],
  filters: {
    district: 'ALL',
    lac: 'ALL',
    asStatus: 'ALL',
    arStatus: 'ALL',
    srStatus: 'ALL'
  },
  expandedGroups: new Set(),
  activeProfileId: localStorage.getItem('activeProfileId') || CONFIG.DEFAULT_PROFILE_ID || 'AD'
};

// === ROBUST COLUMN MAPPING HELPERS ===
function getRowValue(row, keyOrKeys) {
  if (!row) return '';
  const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
  
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
    
    // Case-insensitive lookup
    const targetKeyLower = key.toLowerCase();
    for (const k in row) {
      if (k.toLowerCase() === targetKeyLower) {
        return row[k];
      }
    }
  }
  return '';
}

function setRowValue(row, keyOrKeys, value) {
  if (!row) return;
  const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
  
  for (const key of keys) {
    if (row[key] !== undefined) {
      row[key] = value;
      return;
    }
    
    // Case-insensitive lookup
    const targetKeyLower = key.toLowerCase();
    for (const k in row) {
      if (k.toLowerCase() === targetKeyLower) {
        row[k] = value;
        return;
      }
    }
  }
  
  // Default to first key in config definition
  row[keys[0]] = value;
}

// Dynamically retrieves the actual active sheet header name that matches the configuration fallbacks
function getMatchingKey(row, keyOrKeys) {
  const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];

  const findInHeaders = (headers) => {
    for (const key of keys) {
      for (const h of headers) {
        if (h && h.toLowerCase() === key.toLowerCase()) return h;
      }
    }
    return null;
  };

  if (state.sheetHeaders && state.sheetHeaders.length > 0) {
    const match = findInHeaders(state.sheetHeaders);
    if (match) return match;
  }

  if (row) {
    for (const key of keys) {
      if (row[key] !== undefined) return key;

      const targetKeyLower = key.toLowerCase();
      for (const k in row) {
        if (k.toLowerCase() === targetKeyLower) {
          return k;
        }
      }
    }
  }
  if (state.tasks && state.tasks.length > 0) {
    const refTask = state.tasks[0];
    for (const key of keys) {
      if (refTask[key] !== undefined) return key;

      const targetKeyLower = key.toLowerCase();
      for (const k in refTask) {
        if (k.toLowerCase() === targetKeyLower) {
          return k;
        }
      }
    }
  }
  return keys[0];
}

// Build GET URL and POST payload with optional spreadsheet ID for standalone script deployments
function buildScriptGetUrl(baseUrl) {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}sheet=${encodeURIComponent(CONFIG.SHEET_NAME || CONFIG.PROFILE.DESIGN_OFFICE)}&spreadsheetId=${encodeURIComponent(CONFIG.SPREADSHEET_ID || '')}`;
}

function withSpreadsheetId(payload) {
  payload.spreadsheetId = CONFIG.SPREADSHEET_ID || '';
  return payload;
}

// Parse sheet date strings (DD/MM/YYYY or ISO) into YYYY-MM-DD for date inputs
function parseSheetDateToInput(rawDate) {
  if (!rawDate) return '';
  const str = rawDate.toString().trim();
  if (!str) return '';

  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return '';
}

// Resolve dropdown options from live sheet response or config fallback
function resolveDropdownOptions(apiDropdowns) {
  const fallback = CONFIG.MOCK_DROPDOWNS || {};
  const source = apiDropdowns && Object.keys(apiDropdowns).length > 0 ? apiDropdowns : fallback;

  return {
    district: source['District'] || fallback['District'] || [],
    lac: source['LAC'] || fallback['LAC'] || [],
    asStatus: source['AS Status'] || fallback['AS Status'] || [],
    arStatus: source['AR Status'] || fallback['AR Status'] || [],
    srStatus: source['SR Status'] || fallback['SR Status'] || [],
    designOffice: source['Design Office'] || fallback['Design Office'] || [],
    designStatus: source['Design Status'] || fallback['Design Status'] || CONFIG.STATUS_OPTIONS,
    ase: source['ASE'] || fallback['ASE'] || [],
    se: source['SE'] || fallback['SE'] || []
  };
}

// Populate a select element with options, preserving current value when possible
function populateSelectOptions(selectEl, options, { blankLabel = '-- Select --', currentValue = null } = {}) {
  if (!selectEl) return;

  const prev = currentValue !== null ? currentValue : selectEl.value;
  selectEl.innerHTML = '';

  if (blankLabel) {
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = blankLabel;
    selectEl.appendChild(blank);
  }

  (options || []).forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    selectEl.appendChild(option);
  });

  if (prev && Array.from(selectEl.options).some(o => o.value === prev)) {
    selectEl.value = prev;
  }
}

// Apply sheet dropdown values to all form and filter selects
function applyDropdownOptionsToForms() {
  const opts = state.dropdownOptions;
  if (!opts || !opts.designStatus) return;

  populateSelectOptions(dom.addStatusSelect, opts.designStatus, { blankLabel: null });
  populateSelectOptions(dom.editStatusSelect, opts.designStatus, { blankLabel: null });

  const formSelects = [
    ['add-district', opts.district, '-- Select District --'],
    ['add-lac', opts.lac, '-- Select LAC --'],
    ['add-as-status', opts.asStatus],
    ['add-ar-status', opts.arStatus],
    ['add-sr-status', opts.srStatus],
    ['add-se', opts.se],
    ['edit-district', opts.district, '-- Select District --'],
    ['edit-lac', opts.lac, '-- Select LAC --'],
    ['edit-as-status', opts.asStatus],
    ['edit-ar-status', opts.arStatus],
    ['edit-sr-status', opts.srStatus],
    ['edit-design-office', opts.designOffice],
    ['edit-ase', opts.ase],
    ['edit-se', opts.se]
  ];

  formSelects.forEach(([id, options, blankLabel]) => {
    populateSelectOptions(document.getElementById(id), options, { blankLabel: blankLabel || '-- Select --' });
  });

  updateFilterStatusDropdowns();
}

function updateFilterStatusDropdowns() {
  // Filter-bar AS/AR/SR selects are populated from loaded tasks in populateDynamicFilters().
}

function hasAnyActiveFilter() {
  return !!state.searchQuery ||
    state.activeStatusFilter !== 'ALL' ||
    state.filters.district !== 'ALL' ||
    state.filters.lac !== 'ALL' ||
    state.filters.asStatus !== 'ALL' ||
    state.filters.arStatus !== 'ALL' ||
    state.filters.srStatus !== 'ALL';
}

function getWorksForFilterOptions(excludeFilter) {
  const colKeys = CONFIG.COLUMNS;
  return state.tasks.filter(task => {
    if (state.searchQuery) {
      const fileNum = getRowValue(task, colKeys.FILE_NUMBER).toString().toLowerCase();
      const workName = getRowValue(task, colKeys.WORK_NAME).toString().toLowerCase();
      const lac = getRowValue(task, colKeys.LAC).toString().toLowerCase();
      const remarks = getRowValue(task, colKeys.REMARKS).toString().toLowerCase();

      const match =
        fileNum.includes(state.searchQuery) ||
        workName.includes(state.searchQuery) ||
        lac.includes(state.searchQuery) ||
        remarks.includes(state.searchQuery);

      if (!match) return false;
    }

    if (state.activeStatusFilter !== 'ALL') {
      const status = getRowValue(task, colKeys.STATUS).toString().trim();
      const prefix = status.substring(0, 2);
      if (prefix !== state.activeStatusFilter) return false;
    }

    if (excludeFilter !== 'district' && state.filters.district !== 'ALL') {
      const dist = getRowValue(task, colKeys.DISTRICT).toString().trim();
      if (dist !== state.filters.district) return false;
    }
    if (excludeFilter !== 'lac' && state.filters.lac !== 'ALL') {
      const lacVal = getRowValue(task, colKeys.LAC).toString().trim();
      if (lacVal !== state.filters.lac) return false;
    }
    if (excludeFilter !== 'asStatus' && state.filters.asStatus !== 'ALL') {
      const asVal = getRowValue(task, colKeys.AS_STATUS).toString().trim();
      if (asVal !== state.filters.asStatus) return false;
    }
    if (excludeFilter !== 'arStatus' && state.filters.arStatus !== 'ALL') {
      const arVal = getRowValue(task, colKeys.AR_STATUS).toString().trim();
      if (arVal !== state.filters.arStatus) return false;
    }
    if (excludeFilter !== 'srStatus' && state.filters.srStatus !== 'ALL') {
      const srVal = getRowValue(task, colKeys.SR_STATUS).toString().trim();
      if (srVal !== state.filters.srStatus) return false;
    }

    return true;
  });
}

function collectDistinctValues(works, columnKey) {
  const values = new Set();
  works.forEach(task => {
    const val = getRowValue(task, columnKey);
    if (val !== null && val !== undefined) {
      const trimmed = val.toString().trim();
      if (trimmed) values.add(trimmed);
    }
  });
  return Array.from(values).sort();
}

function repopulateFilterSelect(selectEl, allLabel, values, stateKey) {
  if (!selectEl) return;

  const currentVal = selectEl.value;
  selectEl.innerHTML = `<option value="ALL">${allLabel}</option>`;
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });

  if (values.includes(currentVal)) {
    selectEl.value = currentVal;
  } else {
    selectEl.value = 'ALL';
    state.filters[stateKey] = 'ALL';
  }

  const filterItem = selectEl.closest('.filter-item');
  if (filterItem) {
    filterItem.style.display = values.length > 0 ? 'flex' : 'none';
  }
}

function updateFilterResultChip(filteredCount, totalCount) {
  const chip = dom.filterResultChip;
  if (!chip) return;

  if (!hasAnyActiveFilter()) {
    chip.style.display = 'none';
    return;
  }

  chip.style.display = 'flex';
  const countEl = chip.querySelector('.filter-result-count');
  if (!countEl) return;

  const workWord = filteredCount === 1 ? 'work' : 'works';
  if (filteredCount === totalCount) {
    countEl.textContent = `${filteredCount} ${workWord} match your filters`;
  } else {
    countEl.textContent = `${filteredCount} of ${totalCount} ${workWord} match your filters`;
  }
}

// Map spreadsheet category code to full status string
function mapCategoryToStatus(category, remarks, presentStatus) {
  if (!category) {
    const text = ((remarks || '') + ' ' + (presentStatus || '')).toLowerCase();
    if (text.includes('complete') || text.includes('despatched') || text.includes('issued')) {
      return "06 Detailed Design Issued";
    }
    return "07 File Not Yet Opened";
  }
  
  const cat = category.toString().trim();
  const catUpper = cat.toUpperCase();
  switch (catUpper) {
    case 'TDO': return "01 Tentative Design Ongoing";
    case 'TDOH': return "02 Tentative Design On Hold";
    case 'TDI': return "03 Tentative Design Issued";
    case 'DDO': return "04 Detailed Design Ongoing";
    case 'DDOH': return "05 Detailed Design On Hold";
    case 'DDI': return "06 Detailed Design Issued";
    case 'FNO': return "07 File Not Yet Opened";
    case 'DISCARDED': return "08 Discarded Work";
    case 'RETURNED': return "09 Returned to Site";
    default:
      // Check if it is already a full status option (exact or case-insensitive match)
      const matchedOptionExact = CONFIG.STATUS_OPTIONS.find(o => o.toLowerCase() === cat.toLowerCase());
      if (matchedOptionExact) return matchedOptionExact;

      // If category starts with a number like "01" already
      if (/^\d{2}/.test(cat)) {
        const matchedOption = CONFIG.STATUS_OPTIONS.find(o => o.startsWith(cat.substring(0, 2)));
        if (matchedOption) return matchedOption;
      }
      const text = ((remarks || '') + ' ' + (presentStatus || '')).toLowerCase();
      if (text.includes('complete') || text.includes('despatched') || text.includes('issued')) {
        return "06 Detailed Design Issued";
      }
      return "07 File Not Yet Opened";
  }
}

// Map full status string to spreadsheet category code
function mapStatusToCategory(status) {
  // Return the full status string to match the Google Sheet's dropdown data validation
  return status || "";
}

// Normalize spreadsheet data row into standard format for UI
function normalizeLoadedTasks(filteredRows) {
  return filteredRows.map(row => {
    const cat = getRowValue(row, CONFIG.COLUMNS.STATUS);
    const remarks = getRowValue(row, CONFIG.COLUMNS.REMARKS);
    const presentStatus = getRowValue(row, "PRESENT STATUS OF WORK");
    const statusVal = mapCategoryToStatus(cat, remarks, presentStatus);
    setRowValue(row, CONFIG.COLUMNS.STATUS, statusVal);
    return row;
  });
}

// Global click lock to prevent recursive click bubbling on local files
let isModalOpening = false;

// DOM Cache
const dom = {
  simulationToggleBtn: document.getElementById('simulation-toggle-btn'),
  searchInput: document.getElementById('search-input'),
  syncDataBtn: document.getElementById('sync-data-btn'),
  cardsContainer: document.getElementById('cards-container'),
  taskCountBadge: document.getElementById('task-count-badge'),
  toastContainer: document.getElementById('toast-container'),
  
  // Stats
  statTotal: document.getElementById('stat-total').querySelector('.number'),
  filterResultChip: document.getElementById('filter-result-chip'),
  statCards: {
    "01": document.getElementById('stat-01').querySelector('.number'),
    "02": document.getElementById('stat-02').querySelector('.number'),
    "03": document.getElementById('stat-03').querySelector('.number'),
    "04": document.getElementById('stat-04').querySelector('.number'),
    "05": document.getElementById('stat-05').querySelector('.number'),
    "06": document.getElementById('stat-06').querySelector('.number'),
    "07": document.getElementById('stat-07').querySelector('.number'),
    "08": document.getElementById('stat-08').querySelector('.number'),
    "09": document.getElementById('stat-09').querySelector('.number')
  },
  
  // Add Modal
  openAddModalBtn: document.getElementById('open-add-modal-btn'),
  addModal: document.getElementById('add-modal'),
  closeAddModalBtn: document.getElementById('close-add-modal-btn'),
  cancelAddBtn: document.getElementById('cancel-add-btn'),
  addTaskForm: document.getElementById('add-task-form'),
  addStatusSelect: document.getElementById('add-status'),
  
  // Edit Modal
  editModal: document.getElementById('edit-modal'),
  closeEditModalBtn: document.getElementById('close-edit-modal-btn'),
  cancelEditBtn: document.getElementById('cancel-edit-btn'),
  editTaskForm: document.getElementById('edit-task-form'),
  editStatusSelect: document.getElementById('edit-status'),

  // View Switcher & Action Buttons
  tabList: document.getElementById('tab-list-view'),
  tabCalendar: document.getElementById('tab-calendar-view'),
  tabAnalytics: document.getElementById('tab-analytics-view'),
  exportDataBtn: document.getElementById('export-data-btn'),
  openLogsBtn: document.getElementById('open-logs-btn'),

  // View Containers
  dashboardViewTitle: document.getElementById('dashboard-view-title'),
  calendarContainer: document.getElementById('calendar-container'),
  calendarDaysGrid: document.getElementById('calendar-days-grid'),
  calendarMonthYear: document.getElementById('calendar-month-year'),
  calendarPrevMonth: document.getElementById('calendar-prev-month'),
  calendarNextMonth: document.getElementById('calendar-next-month'),

  analyticsContainer: document.getElementById('analytics-container'),
  completionRing: document.getElementById('completion-ring'),
  completionPercentage: document.getElementById('completion-percentage'),
  completionSummary: document.getElementById('completion-summary'),
  analyticsBarChart: document.getElementById('analytics-bar-chart'),

  // Activity Log Drawer Elements
  drawerOverlay: document.getElementById('drawer-overlay'),
  closeLogsBtn: document.getElementById('close-logs-btn'),
  logEmptyState: document.getElementById('log-empty-state'),
  logItemsContainer: document.getElementById('log-items-container')
};

// Initialize Application
function init() {
  setupUIThemeAndDropdowns();
  setupEventListeners();
  // Highlight Total Works stat card by default
  document.getElementById('stat-total').classList.add('active');
  loadData();
  logActivity('Workflow Updater initialized in Simulation Mode', 'info');
}

// Populate dropdown lists and style setup
function setupUIThemeAndDropdowns() {
  updateSimulationToggleUI();
  renderProfileSwitcher();

  state.dropdownOptions = resolveDropdownOptions(CONFIG.MOCK_DROPDOWNS);
  applyDropdownOptionsToForms();
}

// Attach event listeners
function setupEventListeners() {
  // Sync button
  dom.syncDataBtn.addEventListener('click', () => {
    showToast('Refreshing data...', 'info');
    loadData();
  });

  // Simulation Toggle
  dom.simulationToggleBtn.addEventListener('click', () => {
    state.isSimulationMode = !state.isSimulationMode;
    updateSimulationToggleUI();
    showToast(
      state.isSimulationMode 
        ? 'Switched to Simulation Mode (using local high-fidelity data)' 
        : 'Switched to Live Google Sheet Mode', 
      'warning'
    );
    loadData();
  });

  // Searching
  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    const dbSearchInput = document.getElementById('dashboard-search-input');
    if (dbSearchInput) dbSearchInput.value = e.target.value;
    renderDashboard();
  });

  const dbSearchInput = document.getElementById('dashboard-search-input');
  if (dbSearchInput) {
    dbSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      dom.searchInput.value = e.target.value;
      renderDashboard();
    });
  }

  // Dynamic dynamic filter dropdown fields
  const filterDistrict = document.getElementById('filter-district');
  const filterLac = document.getElementById('filter-lac');
  const filterAsStatus = document.getElementById('filter-as-status');
  const filterArStatus = document.getElementById('filter-ar-status');
  const filterSrStatus = document.getElementById('filter-sr-status');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');

  const onFilterChange = () => {
    state.filters.district = filterDistrict.value;
    state.filters.lac = filterLac.value;
    state.filters.asStatus = filterAsStatus.value;
    state.filters.arStatus = filterArStatus.value;
    state.filters.srStatus = filterSrStatus.value;
    
    const anyActive = state.filters.district !== 'ALL' ||
                      state.filters.lac !== 'ALL' ||
                      state.filters.asStatus !== 'ALL' ||
                      state.filters.arStatus !== 'ALL' ||
                      state.filters.srStatus !== 'ALL';
                      
    if (anyActive) {
      resetFiltersBtn.style.display = 'flex';
    } else {
      resetFiltersBtn.style.display = 'none';
    }
    
    renderDashboard();
  };

  if (filterDistrict) filterDistrict.addEventListener('change', onFilterChange);
  if (filterLac) filterLac.addEventListener('change', onFilterChange);
  if (filterAsStatus) filterAsStatus.addEventListener('change', onFilterChange);
  if (filterArStatus) filterArStatus.addEventListener('change', onFilterChange);
  if (filterSrStatus) filterSrStatus.addEventListener('change', onFilterChange);

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (filterDistrict) filterDistrict.value = 'ALL';
      if (filterLac) filterLac.value = 'ALL';
      if (filterAsStatus) filterAsStatus.value = 'ALL';
      if (filterArStatus) filterArStatus.value = 'ALL';
      if (filterSrStatus) filterSrStatus.value = 'ALL';
      onFilterChange();
    });
  }

  // Add Modal Toggles
  dom.openAddModalBtn.addEventListener('click', () => {
    dom.addTaskForm.reset();
    const activeProfile = getActiveProfile();
    document.getElementById('add-ase').value = activeProfile.id;
    document.getElementById('add-design-office').value = CONFIG.PROFILE.DESIGN_OFFICE;

    const addDistrict = document.getElementById('add-district');
    if (addDistrict && state.dropdownOptions.district.includes('13 Kannur')) {
      addDistrict.value = '13 Kannur';
    }

    openModal(dom.addModal);
  });
  dom.closeAddModalBtn.addEventListener('click', () => closeModal(dom.addModal));
  dom.cancelAddBtn.addEventListener('click', () => closeModal(dom.addModal));

  // Edit Modal Toggles
  dom.closeEditModalBtn.addEventListener('click', () => closeModal(dom.editModal));
  dom.cancelEditBtn.addEventListener('click', () => closeModal(dom.editModal));

  // Forms Submissions
  dom.addTaskForm.addEventListener('submit', handleAddTaskSubmit);
  dom.editTaskForm.addEventListener('submit', handleEditTaskSubmit);

  // Active Stat Cards clicks for Filter updates
  document.getElementById('stat-total').addEventListener('click', () => {
    setActiveStatusFilter('ALL');
  });

  for (let i = 1; i <= 9; i++) {
    const prefix = i.toString().padStart(2, '0');
    const el = document.getElementById(`stat-${prefix}`);
    if (el) {
      el.addEventListener('click', () => {
        setActiveStatusFilter(prefix);
      });
    }
  }

  // View Switchers Event Listeners
  dom.tabList.addEventListener('click', () => switchView('LIST'));
  dom.tabCalendar.addEventListener('click', () => switchView('CALENDAR'));
  dom.tabAnalytics.addEventListener('click', () => switchView('ANALYTICS'));

  // Calendar Monthly Navigation Listeners
  dom.calendarPrevMonth.addEventListener('click', () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
    renderCalendar();
  });
  dom.calendarNextMonth.addEventListener('click', () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
    renderCalendar();
  });

  // Export Dropdown handling
  const exportDropdownMenu = document.getElementById('export-dropdown-menu');
  const exportPdfOpt = document.getElementById('export-pdf-opt');
  const exportExcelOpt = document.getElementById('export-excel-opt');

  dom.exportDataBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdownMenu.classList.toggle('show');
  });

  // Profile Switcher Dropdown handling
  const profileSwitcherContainer = document.getElementById('profile-switcher-container');
  const profileDropdownMenu = document.getElementById('profile-dropdown-menu');
  const profileSwitcherBtn = document.getElementById('profile-switcher-btn');

  if (profileSwitcherBtn) {
    profileSwitcherBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileDropdownMenu.classList.toggle('show');
      profileSwitcherContainer.classList.toggle('active');
    });
  }

  document.addEventListener('click', (e) => {
    if (exportDropdownMenu && !exportDropdownMenu.contains(e.target) && e.target !== dom.exportDataBtn) {
      exportDropdownMenu.classList.remove('show');
    }
    if (profileDropdownMenu && !profileDropdownMenu.contains(e.target) && !profileSwitcherBtn.contains(e.target)) {
      profileDropdownMenu.classList.remove('show');
      profileSwitcherContainer.classList.remove('active');
    }
  });

  exportPdfOpt.addEventListener('click', () => {
    exportDropdownMenu.classList.remove('show');
    openExportPdfModal();
  });

  exportExcelOpt.addEventListener('click', () => {
    exportDropdownMenu.classList.remove('show');
    downloadExcelReport();
  });

  // Export PDF engineer name modal
  const exportPdfModal = document.getElementById('export-pdf-modal');
  const exportPdfForm = document.getElementById('export-pdf-form');
  const exportEngineerNameInput = document.getElementById('export-engineer-name');
  const closeExportPdfModalBtn = document.getElementById('close-export-pdf-modal-btn');
  const cancelExportPdfBtn = document.getElementById('cancel-export-pdf-btn');

  if (closeExportPdfModalBtn) {
    closeExportPdfModalBtn.addEventListener('click', () => closeModal(exportPdfModal));
  }
  if (cancelExportPdfBtn) {
    cancelExportPdfBtn.addEventListener('click', () => closeModal(exportPdfModal));
  }
  if (exportPdfForm) {
    exportPdfForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const engineerName = exportEngineerNameInput.value.trim();
      if (!engineerName) {
        showToast('Please enter your name to export the PDF report.', 'error');
        exportEngineerNameInput.focus();
        return;
      }
      closeModal(exportPdfModal);
      downloadPdfReport(engineerName);
    });
  }

  // Logs Side Drawer Toggles
  dom.openLogsBtn.addEventListener('click', () => {
    renderActivityLogs();
    dom.drawerOverlay.classList.add('active');
  });
  dom.closeLogsBtn.addEventListener('click', () => {
    dom.drawerOverlay.classList.remove('active');
  });
  dom.drawerOverlay.addEventListener('click', (e) => {
    if (e.target === dom.drawerOverlay) {
      dom.drawerOverlay.classList.remove('active');
    }
  });
}

// Active Stat/Filter Handler
function setActiveStatusFilter(prefix) {
  state.activeStatusFilter = prefix;
  
  // Clear explicit group expansions on filter change
  state.expandedGroups.clear();
  
  // If filtering to a specific group, ensure it starts expanded
  if (prefix !== 'ALL') {
    const matchedOpt = CONFIG.STATUS_OPTIONS.find(o => o.startsWith(prefix));
    if (matchedOpt) {
      state.expandedGroups.add(matchedOpt);
    }
  }
  
  // Remove active class from all stat cards
  document.getElementById('stat-total').classList.remove('active');
  for (let i = 1; i <= 9; i++) {
    const p = i.toString().padStart(2, '0');
    const el = document.getElementById(`stat-${p}`);
    if (el) el.classList.remove('active');
  }
  
  // Add active class to clicked card
  if (prefix === 'ALL') {
    document.getElementById('stat-total').classList.add('active');
    showToast('Viewing all project tasks', 'info');
  } else {
    const el = document.getElementById(`stat-${prefix}`);
    if (el) {
      el.classList.add('active');
      const labelText = el.querySelector('.label').textContent;
      showToast(`Filtered list to status: ${labelText}`, 'info');
    }
  }
  
  // Re-render dashboard
  renderDashboard();
}

// Update the state and button classes for simulation mode
function updateSimulationToggleUI() {
  if (state.isSimulationMode) {
    dom.simulationToggleBtn.classList.add('active');
    dom.simulationToggleBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Simulation Mode: ON
    `;
  } else {
    dom.simulationToggleBtn.classList.remove('active');
    dom.simulationToggleBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--color-success)"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      Live Sheets Connected
    `;
  }
}

// Open/Close Modals
function openModal(modalEl) {
  modalEl.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// closeModal
function closeModal(modalEl) {
  modalEl.classList.remove('active');
  document.body.style.overflow = '';
}

// Toast Notifications Helper
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '';
  if (type === 'success') {
    icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === 'error') {
    icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else if (type === 'warning' || type === 'info') {
    icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="12" x2="12" y2="16"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `${icon}<span>${message}</span>`;
  dom.toastContainer.appendChild(toast);
  
  // Slide out after delay — errors stay longer so they can be read
  const dismissMs = type === 'error' ? 12000 : 3700;
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s reverse ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, dismissMs - 300);
}

// Render skeleton card loaders while fetching
function renderSkeletons() {
  dom.cardsContainer.innerHTML = Array(2).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-header">
        <div class="skeleton-item skeleton-file"></div>
        <div class="skeleton-item skeleton-badge"></div>
      </div>
      <div class="skeleton-item skeleton-title"></div>
      <div class="skeleton-item skeleton-desc"></div>
      <div class="skeleton-item skeleton-meta"></div>
      <div class="skeleton-footer">
        <div class="skeleton-item skeleton-avatar"></div>
        <div class="skeleton-item skeleton-button"></div>
      </div>
    </div>
  `).join('');
}

// Helper to retrieve active engineer profile details from config list
function getActiveProfile() {
  const profiles = CONFIG.PROFILES || [CONFIG.PROFILE];
  return profiles.find(p => p.id === state.activeProfileId) || profiles[0];
}

// Render dynamic profile items in the header dropdown list
function renderProfileSwitcher() {
  const container = document.getElementById('profile-switcher-container');
  const btn = document.getElementById('profile-switcher-btn');
  const avatar = document.getElementById('active-profile-avatar');
  const text = document.getElementById('active-profile-text');
  const menu = document.getElementById('profile-dropdown-menu');
  
  if (!menu || !container || !btn) return;
  
  const activeProfile = getActiveProfile();
  
  // Update badge UI
  if (avatar) avatar.textContent = activeProfile.id;
  if (text) text.innerHTML = `RDO KKD • <strong>${activeProfile.id}</strong>`;
  
  const headerEngineerProfile = document.getElementById('header-engineer-profile');
  if (headerEngineerProfile) headerEngineerProfile.textContent = activeProfile.id;
  
  const profiles = CONFIG.PROFILES || [CONFIG.PROFILE];
  
  // Render options list
  menu.innerHTML = profiles.map(p => {
    const isActive = p.id === activeProfile.id;
    const itemClass = `profile-dropdown-item ${isActive ? 'active' : ''}`;
    const emailHtml = p.email ? `<span class="profile-email">${p.email}</span>` : '';
    return `
      <button type="button" class="${itemClass}" data-profile-id="${p.id}">
        <div class="profile-dropdown-avatar">${p.id}</div>
        <div class="profile-dropdown-item-details">
          <span class="profile-name">${p.name}</span>
          ${emailHtml}
        </div>
      </button>
    `;
  }).join('');
  
  // Bind click handlers to newly rendered profile list items
  menu.querySelectorAll('.profile-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const selectedId = item.getAttribute('data-profile-id');
      if (selectedId !== state.activeProfileId) {
        state.activeProfileId = selectedId;
        localStorage.setItem('activeProfileId', selectedId);
        
        // Refresh local switcher elements
        renderProfileSwitcher();
        
        // Auto update initials inside add modal form
        const addAseField = document.getElementById('add-ase');
        if (addAseField) addAseField.value = selectedId;
        
        showToast(`Switched active profile to ${selectedId}`, 'success');
        logActivity(`Switched active profile to engineer: ${selectedId}`, 'info');
        
        // Trigger dashboard reload for new engineer's works
        loadData();
      }
      menu.classList.remove('show');
      container.classList.remove('active');
    });
  });
}

// Filter rows specifically matching the RDO KKD & selected engineer profile
function filterTasksByProfile(allRows) {
  const targetOffice = CONFIG.PROFILE.DESIGN_OFFICE.toLowerCase();
  const activeProfile = getActiveProfile();
  const targetAse = activeProfile.id.toLowerCase();
  
  return allRows.filter(row => {
    const office = getRowValue(row, CONFIG.COLUMNS.DESIGN_OFFICE).toString().toLowerCase();
    const ase = getRowValue(row, CONFIG.COLUMNS.ASE).toString().toLowerCase().trim();
    
    // Exact match for ASE and contains match for Design Office
    return office.includes(targetOffice) && ase === targetAse;
  });
}

// Populate dynamic filter dropdowns from loaded tasks (cascading by active filters)
function populateDynamicFilters() {
  const colKeys = CONFIG.COLUMNS;
  const filterDistrict = document.getElementById('filter-district');
  const filterLac = document.getElementById('filter-lac');
  const filterAsStatus = document.getElementById('filter-as-status');
  const filterArStatus = document.getElementById('filter-ar-status');
  const filterSrStatus = document.getElementById('filter-sr-status');

  const districtValues = collectDistinctValues(getWorksForFilterOptions('district'), colKeys.DISTRICT);
  const lacValues = collectDistinctValues(getWorksForFilterOptions('lac'), colKeys.LAC);
  const asValues = collectDistinctValues(getWorksForFilterOptions('asStatus'), colKeys.AS_STATUS);
  const arValues = collectDistinctValues(getWorksForFilterOptions('arStatus'), colKeys.AR_STATUS);
  const srValues = collectDistinctValues(getWorksForFilterOptions('srStatus'), colKeys.SR_STATUS);

  repopulateFilterSelect(filterDistrict, 'All Districts', districtValues, 'district');
  repopulateFilterSelect(filterLac, 'All LACs', lacValues, 'lac');
  repopulateFilterSelect(filterAsStatus, 'All AS Status', asValues, 'asStatus');
  repopulateFilterSelect(filterArStatus, 'All AR Status', arValues, 'arStatus');
  repopulateFilterSelect(filterSrStatus, 'All SR Status', srValues, 'srStatus');
}

// Fetch sheet data
async function loadData() {
  renderSkeletons();
  const activeProfile = getActiveProfile();
  const currentScriptUrl = activeProfile.scriptUrl || CONFIG.SCRIPT_URL;
  
  if (state.isSimulationMode) {
    setTimeout(() => {
      state.sheetHeaders = Object.keys(CONFIG.MOCK_DATA[0] || {}).filter(k => k !== '_rowNum');
      state.dropdownOptions = resolveDropdownOptions(CONFIG.MOCK_DROPDOWNS);
      applyDropdownOptionsToForms();
      const filtered = filterTasksByProfile(CONFIG.MOCK_DATA);
      state.tasks = normalizeLoadedTasks(JSON.parse(JSON.stringify(filtered)));
      populateDynamicFilters();
      renderDashboard();
      showToast(`Loaded ${activeProfile.id}'s targeted profile data!`, 'success');
    }, 150);
    return;
  }

  if (!currentScriptUrl) {
    showToast('Apps Script URL is empty! Reverting to Simulation Mode.', 'error');
    state.isSimulationMode = true;
    updateSimulationToggleUI();
    loadData();
    return;
  }

  try {
    const fetchUrl = buildScriptGetUrl(currentScriptUrl);
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const data = await response.json();
    
    if (data.success) {
      state.sheetHeaders = data.headers || [];
      state.dropdownOptions = resolveDropdownOptions(data.dropdowns);
      applyDropdownOptionsToForms();
      const filtered = filterTasksByProfile(data.rows);
      state.tasks = normalizeLoadedTasks(filtered);
      populateDynamicFilters();
      renderDashboard();
      showToast(`Connected! Loaded ${state.tasks.length} works for ${activeProfile.id}`, 'success');
    } else {
      const errMsg = data.error || 'Server error';
      if (errMsg.includes('getSheetByName') || errMsg.includes('getSheets') || errMsg.includes('Cannot access spreadsheet') || errMsg.includes('SPREADSHEET_ID')) {
        throw new Error(
          'Apps Script cannot reach your Google Sheet. In your standalone script: paste the latest google_apps_script.js, ' +
          'run authorizeSpreadsheetAccess once, redeploy the Web App, and update SCRIPT_URL in config.js if the URL changed.'
        );
      }
      throw new Error(errMsg);
    }
  } catch (err) {
    console.error(err);
    showToast(`Sync failed: ${err.message}. Falling back to simulation mode.`, 'error');
    state.isSimulationMode = true;
    updateSimulationToggleUI();
    loadData();
  }
}

// Get current date in DD-MM-YYYY format
function getCurrentDateFormatted() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function buildProgressReportTitle(designation, engineerName) {
  const date = getCurrentDateFormatted();
  return `PROGRESS REPORT - ${designation.toString().trim().toUpperCase()} - ${engineerName.toString().trim()} - AS ON ${date}.`;
}

// Format date values cleanly for export tables
function formatDateValue(val) {
  if (!val) return '-';
  if (val instanceof Date) {
    const dd = String(val.getDate()).padStart(2, '0');
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const yyyy = val.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  const dateStr = val.toString().trim();
  if (!dateStr || dateStr.toLowerCase() === 'null') return '-';
  
  // Try to parse standard ISO format
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime()) && dateStr.includes('-')) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
  } catch (e) {}

  return dateStr;
}

function escapeHtml(str) {
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Keep each LAC word intact; allow line breaks only between words
function formatLacForPdf(val) {
  const text = (val ?? '').toString().trim();
  if (!text) return '-';
  return text.split(/\s+/).filter(Boolean).map(word =>
    `<span class="lac-word">${escapeHtml(word)}</span>`
  ).join(' ');
}

// Escape values for CSV spreadsheet export
function escapeCsvValue(val) {
  if (val === null || val === undefined) return '""';
  let str = val.toString();
  str = str.replace(/"/g, '""');
  // Wrap in double quotes if it contains comma, quotes, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str}"`;
  }
  return `"${str}"`;
}

// Filter tasks systematically according to dynamic filters and search terms
function getFilteredTasks() {
  const colKeys = CONFIG.COLUMNS;
  return state.tasks.filter(task => {
    // Search Query
    if (state.searchQuery) {
      const fileNum = getRowValue(task, colKeys.FILE_NUMBER).toString().toLowerCase();
      const workName = getRowValue(task, colKeys.WORK_NAME).toString().toLowerCase();
      const lac = getRowValue(task, colKeys.LAC).toString().toLowerCase();
      const remarks = getRowValue(task, colKeys.REMARKS).toString().toLowerCase();
      
      const match = fileNum.includes(state.searchQuery) || 
                    workName.includes(state.searchQuery) || 
                    lac.includes(state.searchQuery) ||
                    remarks.includes(state.searchQuery);
                    
      if (!match) return false;
    }

    // Active Status Stat Filter
    if (state.activeStatusFilter !== 'ALL') {
      const status = getRowValue(task, colKeys.STATUS).toString().trim();
      const prefix = status.substring(0, 2);
      if (prefix !== state.activeStatusFilter) return false;
    }

    // Dynamic dropdown filter fields
    if (state.filters.district !== 'ALL') {
      const dist = getRowValue(task, colKeys.DISTRICT).toString().trim();
      if (dist !== state.filters.district) return false;
    }
    if (state.filters.lac !== 'ALL') {
      const lac = getRowValue(task, colKeys.LAC).toString().trim();
      if (lac !== state.filters.lac) return false;
    }
    if (state.filters.asStatus !== 'ALL') {
      const asVal = getRowValue(task, colKeys.AS_STATUS).toString().trim();
      if (asVal !== state.filters.asStatus) return false;
    }
    if (state.filters.arStatus !== 'ALL') {
      const arVal = getRowValue(task, colKeys.AR_STATUS).toString().trim();
      if (arVal !== state.filters.arStatus) return false;
    }
    if (state.filters.srStatus !== 'ALL') {
      const srVal = getRowValue(task, colKeys.SR_STATUS).toString().trim();
      if (srVal !== state.filters.srStatus) return false;
    }

    return true;
  });
}

// Open export PDF modal and prompt for engineer name
function openExportPdfModal() {
  const exportPdfModal = document.getElementById('export-pdf-modal');
  const exportEngineerNameInput = document.getElementById('export-engineer-name');
  if (!exportPdfModal || !exportEngineerNameInput) return;
  exportEngineerNameInput.value = '';
  openModal(exportPdfModal);
  setTimeout(() => exportEngineerNameInput.focus(), 100);
}

// Download PDF Report
function downloadPdfReport(engineerName) {
  const colKeys = CONFIG.COLUMNS;
  const filteredTasks = getFilteredTasks();
  const activeProfile = getActiveProfile();
  const totalWorks = filteredTasks.length;
  const title = buildProgressReportTitle(activeProfile.id, engineerName);
  
  // Group tasks
  const tasksByStatus = {};
  CONFIG.STATUS_OPTIONS.forEach(opt => {
    tasksByStatus[opt] = [];
  });

  filteredTasks.forEach(task => {
    const statusVal = getRowValue(task, colKeys.STATUS).toString().trim();
    const matchedOpt = CONFIG.STATUS_OPTIONS.find(opt => {
      return opt.toLowerCase() === statusVal.toLowerCase() || 
             opt.toLowerCase().startsWith(statusVal.substring(0, 2).toLowerCase());
    }) || statusVal;

    if (!tasksByStatus[matchedOpt]) {
      tasksByStatus[matchedOpt] = [];
    }
    tasksByStatus[matchedOpt].push(task);
  });
  
  let tableBodyHtml = "";
  
  CONFIG.STATUS_OPTIONS.forEach(statusName => {
    const groupTasks = tasksByStatus[statusName] || [];
    
    // Add group header row spanning all 14 columns
    const count = groupTasks.length;
    const suffix = count === 1 ? "WORK" : "WORKS";
    const headerText = `${statusName.toUpperCase()} : ${count} ${suffix}`;
    
    tableBodyHtml += `
      <tr class="status-group-row">
        <td colspan="14">${headerText}</td>
      </tr>
    `;
    
    if (groupTasks.length === 0) {
      tableBodyHtml += `
        <tr class="nil-row">
          <td style="color: #94a3b8; font-style: italic; font-weight: 500; font-size: 8.5pt; padding: 8px;">NIL</td>
          <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
        </tr>
      `;
      return;
    }
    
    // Add task rows
    groupTasks.forEach(task => {
      tableBodyHtml += `
        <tr>
          <td>${getRowValue(task, colKeys.WORK_NAME) || '-'}</td>
          <td>${getRowValue(task, colKeys.DISTRICT) || '-'}</td>
          <td class="lac-cell">${formatLacForPdf(getRowValue(task, colKeys.LAC))}</td>
          <td class="center">${getRowValue(task, colKeys.AS_STATUS) || '-'}</td>
          <td class="center">${getRowValue(task, colKeys.AR_STATUS) || '-'}</td>
          <td class="center">${getRowValue(task, colKeys.SR_STATUS) || '-'}</td>
          <td class="center">${getRowValue(task, colKeys.FLOORS) || '-'}</td>
          <td class="center">${getRowValue(task, colKeys.AREA) || '-'}</td>
          <td class="center">${getRowValue(task, colKeys.SE) || '-'}</td>
          <td class="remarks-cell">${getRowValue(task, colKeys.REMARKS) || '-'}</td>
          <td class="center">${formatDateValue(getRowValue(task, colKeys.TARGET_DATE))}</td>
          <td class="center">${formatDateValue(getRowValue(task, CONFIG.COLUMNS.TENTATIVE_ISSUED_DATE))}</td>
          <td class="center">${formatDateValue(getRowValue(task, CONFIG.COLUMNS.DETAILED_LAST_ISSUED_DATE))}</td>
          <td class="center">${formatDateValue(getRowValue(task, CONFIG.COLUMNS.DETAILED_COMPLETE_ISSUED_DATE))}</td>
        </tr>
      `;
    });
  });
  
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("Popup blocked! Please allow popups to export the PDF report.", "error");
    return;
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(title)}</title>
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1e293b;
          background: white;
          margin: 1.5cm;
          font-size: 10.5pt;
          line-height: 1.35;
        }
        .header-container {
          text-align: center;
          margin-bottom: 25px;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
        }
        h1 {
          font-size: 16pt;
          margin: 0;
          color: #0f172a;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .meta-subtitle {
          font-size: 11.5pt;
          color: #64748b;
          margin: 6px 0 0 0;
          font-weight: 500;
        }
        .total-works-summary {
          text-align: left;
          font-size: 10pt;
          font-weight: 600;
          color: #334155;
          margin: 10px 0 0 0;
        }
        table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          page-break-inside: auto;
          margin-top: 10px;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        thead {
          display: table-header-group;
        }
        th {
          background-color: #f1f5f9;
          border: 1px solid #000000;
          color: #0f172a;
          font-weight: 600;
          text-align: left;
          padding: 6px 8px;
          font-size: 9.5pt;
          text-transform: uppercase;
        }
        td {
          border: 1px solid #000000;
          padding: 6px 8px;
          font-size: 9.8pt;
          vertical-align: top;
          word-wrap: break-word;
        }
        .status-group-row {
          background-color: #e2e8f0 !important;
          font-weight: 700;
          color: #0f172a;
          font-size: 10.5pt;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .status-group-row td {
          border: 1px solid #000000;
          padding: 8px 10px;
        }
        .center {
          text-align: center;
        }
        .lac-cell {
          word-break: normal;
          overflow-wrap: normal;
        }
        .lac-cell .lac-word {
          white-space: nowrap;
        }
        th.date-col {
          font-size: 8.5pt;
          line-height: 1.2;
          text-align: center;
        }
        .remarks-cell {
          font-size: 9.5pt;
          color: #334155;
        }
        @media print {
          body {
            margin: 1cm;
          }
          th, td {
            border-color: #000000 !important;
          }
          th {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .status-group-row {
            background-color: #e2e8f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        @page {
          size: A3 landscape;
          margin: 1cm;
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        <h1>${escapeHtml(title)}</h1>
      </div>
      <p class="total-works-summary">Total number of works: ${totalWorks}</p>
      <table>
        <colgroup>
          <col style="width: 350px" />
          <col style="width: 120px" />
          <col style="width: 100px" />
          <col style="width: 80px" />
          <col style="width: 80px" />
          <col style="width: 80px" />
          <col style="width: 90px" />
          <col style="width: 110px" />
          <col style="width: 80px" />
          <col style="width: 395px" />
          <col style="width: 105px" />
          <col style="width: 105px" />
          <col style="width: 115px" />
          <col style="width: 115px" />
        </colgroup>
        <thead>
          <tr>
            <th>Name of Work</th>
            <th>District</th>
            <th class="lac-cell">LAC</th>
            <th>AS Status</th>
            <th>AR Status</th>
            <th>SR Status</th>
            <th>No. of Floors</th>
            <th class="center">Total Area (m²)</th>
            <th>SE</th>
            <th>Remarks by Building Design Unit</th>
            <th class="date-col">Target Date</th>
            <th class="date-col">Tentative Issued Date</th>
            <th class="date-col">Detailed Design Last Issued Date</th>
            <th class="date-col">Detailed Design Complete Issued Date</th>
          </tr>
        </thead>
        <tbody>
          ${tableBodyHtml}
        </tbody>
      </table>
      <script>
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 350);
        });
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
  
  logActivity('Generated PDF report with customized grouping and columns', 'info');
  showToast('PDF report generated successfully!', 'success');
}

// Download Excel CSV spreadsheet
function downloadExcelReport() {
  const colKeys = CONFIG.COLUMNS;
  const filteredTasks = getFilteredTasks();
  const activeProfile = getActiveProfile();
  const title = `WORKS HANDLED BY ${activeProfile.name.toUpperCase()} AT RDO KKD as on ${getCurrentDateFormatted()}`;
  
  // Group tasks
  const tasksByStatus = {};
  CONFIG.STATUS_OPTIONS.forEach(opt => {
    tasksByStatus[opt] = [];
  });

  filteredTasks.forEach(task => {
    const statusVal = getRowValue(task, colKeys.STATUS).toString().trim();
    const matchedOpt = CONFIG.STATUS_OPTIONS.find(opt => {
      return opt.toLowerCase() === statusVal.toLowerCase() || 
             opt.toLowerCase().startsWith(statusVal.substring(0, 2).toLowerCase());
    }) || statusVal;

    if (!tasksByStatus[matchedOpt]) {
      tasksByStatus[matchedOpt] = [];
    }
    tasksByStatus[matchedOpt].push(task);
  });
  
  let tableBodyHtml = "";
  
  CONFIG.STATUS_OPTIONS.forEach(statusName => {
    const groupTasks = tasksByStatus[statusName] || [];
    
    // Add group header row spanning all 14 columns
    const count = groupTasks.length;
    const suffix = count === 1 ? "WORK" : "WORKS";
    const headerText = `${statusName.toUpperCase()} : ${count} ${suffix}`;
    
    tableBodyHtml += `
      <tr class="status-group-row">
        <td colspan="14" style="background-color: #cbd5e1; font-weight: bold; color: #0f172a; border: 1px solid #94a3b8; font-size: 12pt; height: 30px; padding: 6px; vertical-align: middle; font-family: 'Segoe UI', sans-serif;">
          ${headerText}
        </td>
      </tr>
    `;
    
    if (groupTasks.length === 0) {
      tableBodyHtml += `
        <tr class="nil-row">
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: left; font-style: italic; font-family: 'Segoe UI', sans-serif; color: #94a3b8; height: 25px; vertical-align: middle;">NIL</td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
          <td style="border: 1px solid #cbd5e1;"></td>
        </tr>
      `;
      return;
    }
    
    // Add task rows
    groupTasks.forEach(task => {
      tableBodyHtml += `
        <tr>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: left; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${getRowValue(task, colKeys.WORK_NAME) || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: left; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${getRowValue(task, colKeys.DISTRICT) || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: left; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${getRowValue(task, colKeys.LAC) || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: center; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${getRowValue(task, colKeys.AS_STATUS) || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: center; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${getRowValue(task, colKeys.AR_STATUS) || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: center; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${getRowValue(task, colKeys.SR_STATUS) || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: center; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${getRowValue(task, colKeys.FLOORS) || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: right; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${getRowValue(task, colKeys.AREA) || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: center; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${getRowValue(task, colKeys.SE) || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 10.5pt; padding: 6px; text-align: left; vertical-align: top; color: #334155; white-space: normal; font-family: 'Segoe UI', sans-serif;">${getRowValue(task, colKeys.REMARKS) || '-'}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: center; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${formatDateValue(getRowValue(task, colKeys.TARGET_DATE))}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: center; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${formatDateValue(getRowValue(task, CONFIG.COLUMNS.TENTATIVE_ISSUED_DATE))}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: center; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${formatDateValue(getRowValue(task, CONFIG.COLUMNS.DETAILED_LAST_ISSUED_DATE))}</td>
          <td style="border: 1px solid #cbd5e1; font-size: 11pt; padding: 6px; text-align: center; vertical-align: top; font-family: 'Segoe UI', sans-serif;">${formatDateValue(getRowValue(task, CONFIG.COLUMNS.DETAILED_COMPLETE_ISSUED_DATE))}</td>
        </tr>
      `;
    });
  });

  const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Progress Report</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
        }
        th {
          background-color: #f1f5f9;
          color: #0f172a;
          font-weight: bold;
          border: 1px solid #cbd5e1;
          font-size: 11pt;
          height: 25px;
          text-align: left;
          padding: 6px;
        }
      </style>
    </head>
    <body>
      <table>
        <!-- Title Header Spanning 14 Columns -->
        <tr>
          <td colspan="14" style="text-align: center; font-size: 16pt; font-weight: bold; height: 40px; color: #0f172a; vertical-align: middle; font-family: 'Segoe UI', sans-serif; padding-bottom: 10px;">
            ${title}
          </td>
        </tr>
        <tr><td colspan="14" style="height: 10px;"></td></tr>
      </table>
      
      <table>
        <!-- Define exact column widths matching PDF -->
        <colgroup>
          <col width="350" />
          <col width="120" />
          <col width="100" />
          <col width="80" />
          <col width="80" />
          <col width="80" />
          <col width="90" />
          <col width="110" />
          <col width="80" />
          <col width="350" />
          <col width="110" />
          <col width="120" />
          <col width="150" />
          <col width="170" />
        </colgroup>
        <thead>
          <tr>
            <th>Name of Work</th>
            <th>District</th>
            <th>LAC</th>
            <th>AS Status</th>
            <th>AR Status</th>
            <th>SR Status</th>
            <th>No. of Floors</th>
            <th>Total Area (m²)</th>
            <th>SE</th>
            <th>Remarks by Building Design Unit</th>
            <th>Target Date</th>
            <th>Tentative Issued Date</th>
            <th>Detailed Design Last Issued Date</th>
            <th>Detailed Design Complete Issued Date</th>
          </tr>
        </thead>
        <tbody>
          ${tableBodyHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const bom = "\uFEFF"; // UTF-8 BOM
  const blob = new Blob([bom + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const fileName = `WORKS HANDLED BY ${activeProfile.name.toUpperCase()} AT RDO KKD as on ${getCurrentDateFormatted()}.xls`;
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  logActivity(`Downloaded Excel Report: ${fileName}`, 'success');
  showToast('Excel report downloaded successfully!', 'success');
}

// Render Dashboard (Stats + Task Cards)
function renderDashboard() {
  if (state.activeView === 'CALENDAR') {
    renderCalendar();
    return;
  } else if (state.activeView === 'ANALYTICS') {
    renderAnalytics();
    return;
  }

  const colKeys = CONFIG.COLUMNS;
  
  // Calculate dynamic stats
  let totalCount = state.tasks.length;
  
  // Initialize counts for all 9 design statuses
  const statusCounts = {
    "01": 0,
    "02": 0,
    "03": 0,
    "04": 0,
    "05": 0,
    "06": 0,
    "07": 0,
    "08": 0,
    "09": 0
  };

  state.tasks.forEach(task => {
    const status = getRowValue(task, colKeys.STATUS).toString().trim();
    const prefix = status.substring(0, 2);
    if (statusCounts[prefix] !== undefined) {
      statusCounts[prefix]++;
    }
  });

  // Update dynamic count statistics labels with animation
  animateCount(dom.statTotal, totalCount);
  for (const prefix in statusCounts) {
    if (dom.statCards[prefix]) {
      animateCount(dom.statCards[prefix], statusCounts[prefix]);
    }
  }

  // Apply filters to task list
  populateDynamicFilters();
  const filteredTasks = getFilteredTasks();

  // Update display count text
  dom.taskCountBadge.textContent = `Showing ${filteredTasks.length} of ${totalCount} works`;
  updateFilterResultChip(filteredTasks.length, totalCount);

  // Render cards
  if (filteredTasks.length === 0) {
    dom.cardsContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
        <h3>No matching works found</h3>
        <p>Try clearing your search query or click the '+' floating button to append a new project.</p>
      </div>
    `;
    return;
  }

  dom.cardsContainer.innerHTML = '';
  
  if (state.searchQuery) {
    // 1. SEARCH VIEW: Render a flat cards list to save space (no status header bars)
    const flatListContainer = document.createElement('div');
    flatListContainer.className = 'search-results-flat';
    flatListContainer.style.display = 'flex';
    flatListContainer.style.flexDirection = 'column';
    flatListContainer.style.gap = '0.85rem';
    flatListContainer.style.width = '100%';
    
    filteredTasks.forEach(task => {
      const cardEl = createTaskCardElement(task);
      flatListContainer.appendChild(cardEl);
    });
    
    dom.cardsContainer.appendChild(flatListContainer);
  } else {
    // 2. NORMAL GROUPED VIEW: Render dynamic, collapsible design status group headers
    // Group tasks by their normalized design status
    const tasksByStatus = {};
    CONFIG.STATUS_OPTIONS.forEach(opt => {
      tasksByStatus[opt] = [];
    });

    filteredTasks.forEach(task => {
      const statusVal = getRowValue(task, colKeys.STATUS).toString().trim();
      const matchedOpt = CONFIG.STATUS_OPTIONS.find(opt => {
        return opt.toLowerCase() === statusVal.toLowerCase() || 
               opt.toLowerCase().startsWith(statusVal.substring(0, 2).toLowerCase());
      }) || statusVal;

      if (!tasksByStatus[matchedOpt]) {
        tasksByStatus[matchedOpt] = [];
      }
      tasksByStatus[matchedOpt].push(task);
    });

    // Render each status group container that has at least one task
    CONFIG.STATUS_OPTIONS.forEach(statusName => {
      const tasksInGroup = tasksByStatus[statusName] || [];
      if (tasksInGroup.length === 0) return;

      const groupEl = document.createElement('section');
      
      const isFiltered = state.activeStatusFilter === statusName.substring(0, 2);
      const isExpanded = isFiltered || state.expandedGroups.has(statusName);
      
      groupEl.className = `status-group ${isExpanded ? '' : 'collapsed'}`;
      
      // Style status badges depending on group type
      let badgeClass = 'status-ongoing';
      const statusLower = statusName.toLowerCase();
      if (statusLower.includes('hold') || statusLower.includes('02') || statusLower.includes('05')) {
        badgeClass = 'status-hold';
      } else if (statusLower.includes('issued') || statusLower.includes('complete') || statusLower.includes('03') || statusLower.includes('06')) {
        badgeClass = 'status-issued';
      }

      groupEl.innerHTML = `
        <div class="status-group-header" style="cursor: pointer;">
          <div class="status-group-title" style="display: flex; align-items: center;">
            <svg class="collapse-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 8px; transition: transform var(--transition-normal);"><polyline points="9 18 15 12 9 6"></polyline></svg>
            <span class="status-group-badge ${badgeClass}">${statusName}</span>
          </div>
          <span class="status-group-count">${tasksInGroup.length} ${tasksInGroup.length === 1 ? 'work' : 'works'}</span>
        </div>
        <div class="status-group-cards"></div>
      `;

      // Header click toggles collapse
      const headerEl = groupEl.querySelector('.status-group-header');
      headerEl.addEventListener('click', () => {
        const currentlyCollapsed = groupEl.classList.contains('collapsed');
        if (currentlyCollapsed) {
          groupEl.classList.remove('collapsed');
          state.expandedGroups.add(statusName);
        } else {
          groupEl.classList.add('collapsed');
          state.expandedGroups.delete(statusName);
        }
      });

      const subContainer = groupEl.querySelector('.status-group-cards');
      tasksInGroup.forEach(task => {
        const cardEl = createTaskCardElement(task);
        subContainer.appendChild(cardEl);
      });

      dom.cardsContainer.appendChild(groupEl);
    });
  }
}

// Numbers count micro-animation
function animateCount(element, targetValue) {
  const duration = 400; // ms
  const startValue = parseInt(element.textContent) || 0;
  if (startValue === targetValue) {
    element.textContent = targetValue;
    return;
  }
  
  const startTime = performance.now();

  function updateNumber(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // EaseOutQuad formula
    const easeProgress = progress * (2 - progress);
    const currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
    
    element.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    } else {
      element.textContent = targetValue;
    }
  }

  requestAnimationFrame(updateNumber);
}

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Parse remarks into a chronological event log
function parseRemarksToEvents(remarks) {
  if (!remarks) return [];
  
  // Split by sentence delimiters (. or ; or \n) that are followed by space or end of line
  // This avoids splitting internal periods in dates (like 11.02.2026) since they are not followed by spaces
  const parts = remarks.split(/(?:\.|\n|;)+(?=\s|$)/);
  const events = [];
  
  // Date regex matching common formats: DD-MM-YYYY, DD.MM.YYYY, DD/MM/YYYY, and DD-MM-YY, DD.MM.YY, DD/MM/YY
  const dateRegex = /\b(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})\b/;
  
  parts.forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;
    
    const dateMatch = trimmed.match(dateRegex);
    if (dateMatch) {
      const fullDateStr = dateMatch[0];
      const day = parseInt(dateMatch[1]);
      const month = parseInt(dateMatch[2]);
      let year = parseInt(dateMatch[3]);
      
      // Standardize 2-digit years
      if (year < 100) {
        year += 2000;
      }
      
      let parsedDate = null;
      try {
        parsedDate = new Date(year, month - 1, day);
      } catch (e) {}
      
      // Clean description by removing date match and nearby prepositions/words
      const prepositionPattern = new RegExp(`(?:\\s*(?:on|dated|received|issued|despatched|awaited|as of)\\s+)?${escapeRegExp(fullDateStr)}`, 'i');
      let description = trimmed.replace(prepositionPattern, '').trim();
      
      if (description.length < 3) {
        description = trimmed;
      }
      
      // Clean up leftovers
      description = description.replace(/^[,.\s-]+|[,.\s-]+$/g, '');
      description = description.charAt(0).toUpperCase() + description.slice(1);
      
      events.push({
        date: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null,
        dateStr: fullDateStr,
        description: description,
        originalText: trimmed
      });
    } else {
      // Sentences without a date
      let description = trimmed.replace(/^[,.\s-]+|[,.\s-]+$/g, '');
      description = description.charAt(0).toUpperCase() + description.slice(1);
      
      events.push({
        date: null,
        dateStr: null,
        description: description,
        originalText: trimmed
      });
    }
  });
  
  // Sort events chronologically (oldest to newest) by date, placing non-dated items at the end
  events.sort((a, b) => {
    if (a.date && b.date) {
      return a.date.getTime() - b.date.getTime();
    }
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return 0;
  });
  
  return events;
}

// Generate Card Component DOM node
function createTaskCardElement(task) {
  const colKeys = CONFIG.COLUMNS;
  const fileNum = getRowValue(task, colKeys.FILE_NUMBER) || 'File Details Awaited';
  const name = getRowValue(task, colKeys.WORK_NAME) || 'Untitled Work';
  const status = getRowValue(task, colKeys.STATUS) || 'No Status';
  const floors = getRowValue(task, colKeys.FLOORS) || '-';
  const area = getRowValue(task, colKeys.AREA) || '-';
  const remarks = getRowValue(task, colKeys.REMARKS) || 'No remarks provided.';
  const assignee = getRowValue(task, colKeys.ASE) || 'Unassigned';
  const targetDate = getRowValue(task, colKeys.TARGET_DATE) || '';
  const lac = getRowValue(task, colKeys.LAC) || '';
  const district = getRowValue(task, colKeys.DISTRICT) || '';

  const card = document.createElement('article');
  card.className = 'task-card';
  
  // Style status badges
  let badgeClass = 'status-ongoing';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('hold') || statusLower.includes('02') || statusLower.includes('05')) {
    badgeClass = 'status-hold';
  } else if (statusLower.includes('issued') || statusLower.includes('complete') || statusLower.includes('03') || statusLower.includes('06')) {
    badgeClass = 'status-issued';
  }

  // Target Date formatting
  let dateText = 'No Target';
  if (targetDate) {
    try {
      const d = new Date(targetDate);
      if (!isNaN(d.getTime())) {
        dateText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } else {
        dateText = targetDate;
      }
    } catch {
      dateText = targetDate;
    }
  }

  // Get initials for Avatar
  const initials = assignee.substring(0, 3).toUpperCase();

  // Parse remarks into timeline events
  const events = parseRemarksToEvents(remarks);
  const showTimeline = events.length > 1 || (events.length === 1 && events[0].dateStr);

  card.innerHTML = `
    <div class="card-main-content">
      <div class="card-header">
        <span class="file-number" title="${fileNum}">${fileNum.length > 25 ? fileNum.substring(0,25)+'...' : fileNum}</span>
        <span class="badge-status ${badgeClass}">${status}</span>
      </div>
      
      <div class="card-body">
        <h3 title="${name}">${name}</h3>
        
        <div class="card-details">
          <div class="card-detail-item">
            <span class="lbl">Floors & Area</span>
            <span class="val">${floors} (${area} m²)</span>
          </div>
          <div class="card-detail-item">
            <span class="lbl">LAC & District</span>
            <span class="val" title="${lac}, ${district}">${lac || 'General'}</span>
          </div>
        </div>
        
        <div class="card-remarks-wrapper">
          <p class="card-remarks" title="${remarks}">${remarks}</p>
          ${showTimeline ? `
            <button class="timeline-toggle-btn" data-row="${task._rowNum}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span class="btn-text">Timeline Log (${events.length})</span>
            </button>
          ` : ''}
        </div>
      </div>
      
      <div class="card-footer">
        <div class="card-assignee">
          <div class="avatar" style="box-shadow: 0 0 8px hsla(142, 70%, 50%, 0.2); background: linear-gradient(135deg, hsl(142, 70%, 45%), hsl(142, 60%, 50%))">${initials}</div>
          <span>Target: ${dateText}</span>
        </div>
        <button class="quick-update-btn" data-row="${task._rowNum}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="14 2 18 6 7 17 3 17 3 13 14 2"></polygon><line x1="3" y1="22" x2="21" y2="22"></line></svg>
          Edit Details
        </button>
      </div>
    </div>
    
    ${showTimeline ? `
      <div class="card-timeline-container collapsed" id="timeline-${task._rowNum}">
        <h4 class="timeline-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--color-accent); vertical-align: middle;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          Project Event History Log
        </h4>
        <div class="timeline-list">
          ${events.map(ev => {
            const hasDate = !!ev.dateStr;
            const dateBadge = hasDate ? `<span class="timeline-date-badge">${ev.dateStr}</span>` : '';
            const itemClass = hasDate ? 'timeline-item has-date' : 'timeline-item no-date';
            return `
              <div class="${itemClass}">
                <div class="timeline-dot"></div>
                <div class="timeline-meta">
                  ${dateBadge}
                </div>
                <div class="timeline-content">
                  <span class="timeline-desc-text">${ev.description}</span>
                  ${hasDate ? `<div class="timeline-original-text">"${ev.originalText}"</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : ''}
  `;

  // Click anywhere on the card opens the edit modal (except when clicking interactive child elements)
  card.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.card-timeline-container') || e.target.closest('a') || e.target.closest('input')) {
      return;
    }
    openEditModal(task);
  });

  // Explicit click on the "Edit Details" button
  card.querySelector('.quick-update-btn').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openEditModal(task);
  });

  // Timeline toggle button listener
  if (showTimeline) {
    const toggleBtn = card.querySelector('.timeline-toggle-btn');
    const timelineContainer = card.querySelector('.card-timeline-container');
    
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isCollapsed = timelineContainer.classList.contains('collapsed');
      if (isCollapsed) {
        timelineContainer.classList.remove('collapsed');
        timelineContainer.classList.add('expanded');
        toggleBtn.classList.add('active');
        toggleBtn.querySelector('.btn-text').textContent = 'Hide Timeline';
      } else {
        timelineContainer.classList.remove('expanded');
        timelineContainer.classList.add('collapsed');
        toggleBtn.classList.remove('active');
        toggleBtn.querySelector('.btn-text').textContent = `Timeline Log (${events.length})`;
      }
    });

    // Prevent clicking inside the timeline from opening the edit modal
    timelineContainer.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  return card;
}

// Build a sheet payload object from form field values
function buildTaskDataPayload(formValues, refRow) {
  const colKeys = CONFIG.COLUMNS;
  const data = {};

  data[getMatchingKey(refRow, colKeys.FILE_NUMBER)] = formValues.fileNumber;
  if (formValues.workName !== undefined) {
    data[getMatchingKey(refRow, colKeys.WORK_NAME)] = formValues.workName;
  }
  data[getMatchingKey(refRow, colKeys.DISTRICT)] = formValues.district;
  data[getMatchingKey(refRow, colKeys.LAC)] = formValues.lac;
  data[getMatchingKey(refRow, colKeys.AS_STATUS)] = formValues.asStatus;
  data[getMatchingKey(refRow, colKeys.AR_STATUS)] = formValues.arStatus;
  data[getMatchingKey(refRow, colKeys.SR_STATUS)] = formValues.srStatus;
  data[getMatchingKey(refRow, colKeys.DESIGN_OFFICE)] = formValues.designOffice;
  data[getMatchingKey(refRow, colKeys.STATUS)] = mapStatusToCategory(formValues.status);
  data[getMatchingKey(refRow, colKeys.FLOORS)] = formValues.floors;
  data[getMatchingKey(refRow, colKeys.AREA)] = formValues.area;
  data[getMatchingKey(refRow, colKeys.ASE)] = formValues.ase;
  data[getMatchingKey(refRow, colKeys.SE)] = formValues.se;
  data[getMatchingKey(refRow, colKeys.REMARKS)] = formValues.remarks;
  data[getMatchingKey(refRow, colKeys.TARGET_DATE)] = formValues.targetDate;
  data[getMatchingKey(refRow, colKeys.TENTATIVE_ISSUED_DATE)] = formValues.tentativeDate;
  data[getMatchingKey(refRow, colKeys.DETAILED_LAST_ISSUED_DATE)] = formValues.detailedLastDate;
  data[getMatchingKey(refRow, colKeys.DETAILED_COMPLETE_ISSUED_DATE)] = formValues.detailedCompleteDate;

  return data;
}

function readAddFormValues() {
  return {
    fileNumber: document.getElementById('add-file-number').value.trim() || 'Details Awaited',
    workName: document.getElementById('add-work-name').value.trim(),
    district: document.getElementById('add-district').value,
    lac: document.getElementById('add-lac').value,
    asStatus: document.getElementById('add-as-status').value,
    arStatus: document.getElementById('add-ar-status').value,
    srStatus: document.getElementById('add-sr-status').value,
    designOffice: CONFIG.PROFILE.DESIGN_OFFICE,
    status: dom.addStatusSelect.value,
    floors: document.getElementById('add-floors').value.trim(),
    area: document.getElementById('add-area').value.trim(),
    ase: getActiveProfile().id,
    se: document.getElementById('add-se').value,
    remarks: document.getElementById('add-remarks').value.trim(),
    targetDate: document.getElementById('add-target-date').value,
    tentativeDate: document.getElementById('add-tentative-date').value,
    detailedLastDate: document.getElementById('add-detailed-last-date').value,
    detailedCompleteDate: document.getElementById('add-detailed-complete-date').value
  };
}

function readEditFormValues() {
  return {
    fileNumber: document.getElementById('edit-file-number-val').value.trim(),
    status: dom.editStatusSelect.value,
    district: document.getElementById('edit-district').value,
    lac: document.getElementById('edit-lac').value,
    asStatus: document.getElementById('edit-as-status').value,
    arStatus: document.getElementById('edit-ar-status').value,
    srStatus: document.getElementById('edit-sr-status').value,
    designOffice: document.getElementById('edit-design-office').value,
    floors: document.getElementById('edit-floors').value.trim(),
    area: document.getElementById('edit-area').value.trim(),
    ase: document.getElementById('edit-ase').value,
    se: document.getElementById('edit-se').value,
    remarks: document.getElementById('edit-remarks').value.trim(),
    targetDate: document.getElementById('edit-target-date').value,
    tentativeDate: document.getElementById('edit-tentative-date').value,
    detailedLastDate: document.getElementById('edit-detailed-last-date').value,
    detailedCompleteDate: document.getElementById('edit-detailed-complete-date').value
  };
}

function applyFormValuesToTask(task, formValues) {
  const colKeys = CONFIG.COLUMNS;
  setRowValue(task, colKeys.FILE_NUMBER, formValues.fileNumber);
  setRowValue(task, colKeys.STATUS, formValues.status);
  setRowValue(task, colKeys.DISTRICT, formValues.district);
  setRowValue(task, colKeys.LAC, formValues.lac);
  setRowValue(task, colKeys.AS_STATUS, formValues.asStatus);
  setRowValue(task, colKeys.AR_STATUS, formValues.arStatus);
  setRowValue(task, colKeys.SR_STATUS, formValues.srStatus);
  setRowValue(task, colKeys.DESIGN_OFFICE, formValues.designOffice);
  setRowValue(task, colKeys.FLOORS, formValues.floors);
  setRowValue(task, colKeys.AREA, formValues.area);
  setRowValue(task, colKeys.ASE, formValues.ase);
  setRowValue(task, colKeys.SE, formValues.se);
  setRowValue(task, colKeys.REMARKS, formValues.remarks);
  setRowValue(task, colKeys.TARGET_DATE, formValues.targetDate);
  setRowValue(task, colKeys.TENTATIVE_ISSUED_DATE, formValues.tentativeDate);
  setRowValue(task, colKeys.DETAILED_LAST_ISSUED_DATE, formValues.detailedLastDate);
  setRowValue(task, colKeys.DETAILED_COMPLETE_ISSUED_DATE, formValues.detailedCompleteDate);
}

// Populate and Open Edit Modal
function openEditModal(task) {
  if (isModalOpening) return;
  isModalOpening = true;
  
  try {
    const colKeys = CONFIG.COLUMNS;
    
    // Safety check for all element mappings in case of DOM mismatches
    const editRowNum = document.getElementById('edit-row-num');
    const editFileNumVal = document.getElementById('edit-file-number-val');
    const editWorkName = document.getElementById('edit-work-name');
    const editTargetDate = document.getElementById('edit-target-date');
    const editFloors = document.getElementById('edit-floors');
    const editArea = document.getElementById('edit-area');
    const editRemarks = document.getElementById('edit-remarks');
    const editStatusSelect = document.getElementById('edit-status');
    const editModal = document.getElementById('edit-modal');
    
    if (editRowNum) editRowNum.value = task._rowNum || '';
    if (editFileNumVal) editFileNumVal.value = getRowValue(task, colKeys.FILE_NUMBER) || '';
    if (editWorkName) editWorkName.value = getRowValue(task, colKeys.WORK_NAME) || '';
    if (editStatusSelect) editStatusSelect.value = getRowValue(task, colKeys.STATUS) || state.dropdownOptions.designStatus[0] || '';

    if (editTargetDate) editTargetDate.value = parseSheetDateToInput(getRowValue(task, colKeys.TARGET_DATE));
    if (editFloors) editFloors.value = getRowValue(task, colKeys.FLOORS) || '';
    if (editArea) editArea.value = getRowValue(task, colKeys.AREA) || '';

    const editDistrict = document.getElementById('edit-district');
    const editLac = document.getElementById('edit-lac');
    const editAsStatus = document.getElementById('edit-as-status');
    const editArStatus = document.getElementById('edit-ar-status');
    const editSrStatus = document.getElementById('edit-sr-status');
    const editDesignOffice = document.getElementById('edit-design-office');
    const editAse = document.getElementById('edit-ase');
    const editSe = document.getElementById('edit-se');
    const editTentativeDate = document.getElementById('edit-tentative-date');
    const editDetailedLastDate = document.getElementById('edit-detailed-last-date');
    const editDetailedCompleteDate = document.getElementById('edit-detailed-complete-date');

    if (editDistrict) editDistrict.value = getRowValue(task, colKeys.DISTRICT) || '';
    if (editLac) editLac.value = getRowValue(task, colKeys.LAC) || '';
    if (editAsStatus) editAsStatus.value = getRowValue(task, colKeys.AS_STATUS) || '';
    if (editArStatus) editArStatus.value = getRowValue(task, colKeys.AR_STATUS) || '';
    if (editSrStatus) editSrStatus.value = getRowValue(task, colKeys.SR_STATUS) || '';
    if (editDesignOffice) editDesignOffice.value = getRowValue(task, colKeys.DESIGN_OFFICE) || '';
    if (editAse) editAse.value = getRowValue(task, colKeys.ASE) || '';
    if (editSe) editSe.value = getRowValue(task, colKeys.SE) || '';
    if (editTentativeDate) editTentativeDate.value = parseSheetDateToInput(getRowValue(task, colKeys.TENTATIVE_ISSUED_DATE));
    if (editDetailedLastDate) editDetailedLastDate.value = parseSheetDateToInput(getRowValue(task, colKeys.DETAILED_LAST_ISSUED_DATE));
    if (editDetailedCompleteDate) editDetailedCompleteDate.value = parseSheetDateToInput(getRowValue(task, colKeys.DETAILED_COMPLETE_ISSUED_DATE));
    
    if (editRemarks) editRemarks.value = getRowValue(task, colKeys.REMARKS) || '';
    
    // Realtime Timeline builder inside the details modal
    const updateEditModalTimeline = () => {
      const remarksText = editRemarks ? editRemarks.value : '';
      const modalTimelineList = document.getElementById('edit-modal-timeline-list');
      if (modalTimelineList) {
        const events = parseRemarksToEvents(remarksText);
        if (events.length === 0) {
          modalTimelineList.innerHTML = `
            <div class="empty-state" style="padding: 1.5rem; gap: 0.5rem; border: none; background: transparent;">
              <p style="font-size: 0.8rem; color: var(--text-muted); text-align: center;">No timeline events parsed from remarks yet. Type dates like '31-07-2025' or separate milestones to generate progress steps.</p>
            </div>
          `;
        } else {
          modalTimelineList.innerHTML = events.map(ev => {
            const hasDate = !!ev.dateStr;
            const dateBadge = hasDate ? `<span class="timeline-date-badge">${ev.dateStr}</span>` : '';
            const itemClass = hasDate ? 'timeline-item has-date' : 'timeline-item no-date';
            return `
              <div class="${itemClass}">
                <div class="timeline-dot"></div>
                <div class="timeline-meta">
                  ${dateBadge}
                </div>
                <div class="timeline-content">
                  <span class="timeline-desc-text" style="font-size: 0.78rem;">${ev.description}</span>
                  ${hasDate ? `<div class="timeline-original-text" style="font-size: 0.7rem; color: var(--text-muted); font-style: italic;">"${ev.originalText}"</div>` : ''}
                </div>
              </div>
            `;
          }).join('');
        }
      }
    };
    
    // Perform initial draw
    updateEditModalTimeline();
    
    // Bind real-time input event to the remarks textarea so the timeline preview updates live!
    if (editRemarks) {
      editRemarks.oninput = updateEditModalTimeline;
    }
    
    if (editModal) {
      const titleEl = editModal.querySelector('#edit-modal-title');
      if (titleEl) {
        titleEl.textContent = `Update File: ${getRowValue(task, colKeys.FILE_NUMBER) || 'Details'}`;
      }
      openModal(editModal);
    }
  } catch (err) {
    console.error("Critical error in openEditModal:", err);
  } finally {
    // Reset click lock immediately so subsequent clicks are registered
    isModalOpening = false;
  }
}

// Handle Add Task Submission (auto-inject active profile credentials!)
async function handleAddTaskSubmit(e) {
  e.preventDefault();

  const formValues = readAddFormValues();

  if (!formValues.workName) {
    showToast('Work Name is a required field (*)', 'error');
    return;
  }

  const activeProfile = getActiveProfile();
  const currentScriptUrl = activeProfile.scriptUrl || CONFIG.SCRIPT_URL;
  const newRowData = buildTaskDataPayload(formValues, null);

  closeModal(dom.addModal);
  showToast('Sending new project file to Google Sheets...', 'info');

  if (state.isSimulationMode) {
    setTimeout(() => {
      const mockRow = { ...newRowData };
      mockRow._rowNum = state.tasks.length > 0 ? Math.max(...state.tasks.map(t => t._rowNum || 0)) + 1 : 2;
      const statusKey = getMatchingKey(null, CONFIG.COLUMNS.STATUS);
      mockRow[statusKey] = mapCategoryToStatus(mockRow[statusKey], formValues.remarks);
      state.tasks.push(mockRow);
      populateDynamicFilters();
      renderDashboard();
      showToast('Mock project appended successfully!', 'success');
      logActivity(`Created mock project file: "${formValues.workName}"`, 'success');
    }, 600);
    return;
  }

  try {
    const response = await fetch(currentScriptUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(withSpreadsheetId({
        action: 'append',
        sheet: CONFIG.SHEET_NAME || CONFIG.PROFILE.DESIGN_OFFICE,
        data: newRowData
      }))
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      if (responseText.includes('protected cell')) {
        throw new Error(
          'Cannot write to the sheet — the target row is protected. Ask the spreadsheet owner to allow edits on the WORKFLOW MONITORING SHEET table for your account.'
        );
      }
      throw new Error('Unexpected server response. Check that the Web App is deployed with access set to Anyone.');
    }

    if (result.success) {
      showToast('New project file appended to Google Sheets!', 'success');
      logActivity(`Appended project file: "${formValues.workName}" to Google Sheets`, 'success');
      loadData();
    } else {
      throw new Error(result.error || 'Server rejected append');
    }
  } catch (err) {
    console.error(err);
    showToast(`Append failed: ${err.message}`, 'error');
  }
}

// Handle Edit Task Form Submission (Optimistic UI Update!)
async function handleEditTaskSubmit(e) {
  e.preventDefault();

  const colKeys = CONFIG.COLUMNS;
  const rowNum = parseInt(document.getElementById('edit-row-num').value, 10);
  const formValues = readEditFormValues();

  const taskIndex = state.tasks.findIndex(t => Number(t._rowNum) === rowNum);
  if (taskIndex === -1) {
    showToast('Error: Task index mismatch in memory!', 'error');
    return;
  }

  const originalTaskBackup = { ...state.tasks[taskIndex] };

  applyFormValuesToTask(state.tasks[taskIndex], formValues);
  populateDynamicFilters();
  renderDashboard();
  closeModal(dom.editModal);
  showToast('Updating spreadsheet in background...', 'info');
  logActivity(`Updated project "${getRowValue(originalTaskBackup, colKeys.WORK_NAME)}" details: Status -> "${formValues.status}"`, 'info');

  const updatePayload = withSpreadsheetId({
    action: 'update',
    sheet: CONFIG.SHEET_NAME || CONFIG.PROFILE.DESIGN_OFFICE,
    rowNum: rowNum,
    fileNumber: getRowValue(originalTaskBackup, colKeys.FILE_NUMBER),
    data: buildTaskDataPayload(formValues, originalTaskBackup)
  });

  if (state.isSimulationMode) {
    setTimeout(() => {
      showToast('Mock project updated successfully!', 'success');
    }, 400);
    return;
  }

  const activeProfile = getActiveProfile();
  const currentScriptUrl = activeProfile.scriptUrl || CONFIG.SCRIPT_URL;

  // 2. FULFILL WRITE OPERATION IN BACKGROUND
  try {
    const response = await fetch(currentScriptUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(updatePayload)
    });
    
    const result = await response.json();
    if (result.success) {
      showToast(`Google Sheets successfully updated!`, 'success');
    } else {
      throw new Error(result.error || 'Server write failed');
    }
  } catch (err) {
    console.error(err);
    showToast(`Failed to update Google Sheet: ${err.message}. Rolling back.`, 'error');
    
    // 3. API FAILURE ROLLBACK: Restore original values and re-render dashboard
    state.tasks[taskIndex] = originalTaskBackup;
    renderDashboard();
  }
}

// === ADVANCED FEATURES LOGIC ===

// Log custom local session activity
function logActivity(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.activityLogs.unshift({ message, type, timestamp });
  if (state.activityLogs.length > 50) {
    state.activityLogs.pop();
  }
}

// Render dynamic activity logs inside the retractable side drawer
function renderActivityLogs() {
  if (state.activityLogs.length === 0) {
    dom.logEmptyState.style.display = 'flex';
    dom.logItemsContainer.style.display = 'none';
    return;
  }
  dom.logEmptyState.style.display = 'none';
  dom.logItemsContainer.style.display = 'flex';
  dom.logItemsContainer.innerHTML = state.activityLogs.map(log => `
    <div class="log-item log-${log.type}">
      <span class="log-timestamp">${log.timestamp}</span>
      <p class="log-message">${log.message}</p>
    </div>
  `).join('');
}

// Handle active view toggles (List, Calendar, Analytics)
function switchView(viewName) {
  state.activeView = viewName;
  
  // Update tabs active state classes
  dom.tabList.classList.remove('active');
  dom.tabCalendar.classList.remove('active');
  dom.tabAnalytics.classList.remove('active');
  
  // Hide all dynamic layout containers
  dom.cardsContainer.style.display = 'none';
  dom.calendarContainer.style.display = 'none';
  dom.analyticsContainer.style.display = 'none';
  
  // Hide filters and dashboard search container inside Calendar or Analytics views
  const dbSearchContainer = document.getElementById('dashboard-search-container');
  const filtersBar = document.getElementById('filters-bar');
  const filterResultChip = document.getElementById('filter-result-chip');
  if (dbSearchContainer) {
    dbSearchContainer.style.display = viewName === 'LIST' ? 'flex' : 'none';
  }
  if (filtersBar) {
    filtersBar.style.display = viewName === 'LIST' ? 'flex' : 'none';
  }
  if (filterResultChip) {
    filterResultChip.style.display = viewName === 'LIST' && hasAnyActiveFilter() ? 'flex' : 'none';
  }
  
  if (viewName === 'LIST') {
    dom.tabList.classList.add('active');
    dom.cardsContainer.style.display = 'flex';
    dom.dashboardViewTitle.textContent = 'My Tasks & Structural Designs';
    renderDashboard();
  } else if (viewName === 'CALENDAR') {
    dom.tabCalendar.classList.add('active');
    dom.calendarContainer.style.display = 'flex';
    dom.dashboardViewTitle.textContent = 'Deadlines & Target Dates Calendar';
    renderCalendar();
  } else if (viewName === 'ANALYTICS') {
    dom.tabAnalytics.classList.add('active');
    dom.analyticsContainer.style.display = 'flex';
    dom.dashboardViewTitle.textContent = 'Performance & Completion Analytics';
    renderAnalytics();
  }
}

// Render pure SVG analytics elements reactive to the state.tasks data
function renderAnalytics() {
  const colKeys = CONFIG.COLUMNS;
  
  // 1. Calculate Detailed completion rate (Issued Detailed 06 vs total Detailed 04, 05, 06)
  const detailedTasks = state.tasks.filter(t => {
    const status = getRowValue(t, colKeys.STATUS).toString();
    return status.startsWith('04') || status.startsWith('05') || status.startsWith('06');
  });
  
  const completedDetailed = detailedTasks.filter(t => {
    const status = getRowValue(t, colKeys.STATUS).toString();
    return status.startsWith('06');
  });
  
  let percentage = 0;
  if (detailedTasks.length > 0) {
    percentage = Math.round((completedDetailed.length / detailedTasks.length) * 100);
  }
  
  // Set stroke-dashoffset percentage animation
  const circle = dom.completionRing;
  if (circle) {
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }
  
  dom.completionPercentage.textContent = `${percentage}%`;
  dom.completionSummary.textContent = `${completedDetailed.length} of ${detailedTasks.length} detailed designs fully completed and issued.`;
  
  // 2. Build reactive HSL color-coded distribution Bar Chart using CSS flex-columns
  const statusCounts = {
    "01": 0, "02": 0, "03": 0,
    "04": 0, "05": 0, "06": 0,
    "07": 0, "08": 0, "09": 0
  };
  
  state.tasks.forEach(t => {
    const status = getRowValue(t, colKeys.STATUS).toString().trim();
    const prefix = status.substring(0, 2);
    if (statusCounts[prefix] !== undefined) {
      statusCounts[prefix]++;
    }
  });
  
  const maxCount = Math.max(...Object.values(statusCounts), 1);
  
  dom.analyticsBarChart.innerHTML = Object.keys(statusCounts).map(prefix => {
    const count = statusCounts[prefix];
    const heightPercentage = Math.round((count / maxCount) * 100);
    const label = prefix;
    const fullText = CONFIG.STATUS_OPTIONS.find(o => o.startsWith(prefix)) || prefix;
    
    // Custom gradient styling per status category
    let styleBar = 'background: var(--gradient-accent); box-shadow: 0 0 10px -2px var(--color-accent-glow);';
    if (prefix === '02' || prefix === '05') {
      styleBar = 'background: linear-gradient(135deg, hsl(38, 92%, 45%), hsl(38, 92%, 55%)); box-shadow: 0 0 10px -2px hsla(38, 92%, 50%, 0.3);';
    } else if (prefix === '03' || prefix === '06') {
      styleBar = 'background: linear-gradient(135deg, hsl(142, 70%, 45%), hsl(142, 70%, 55%)); box-shadow: 0 0 10px -2px hsla(142, 70%, 50%, 0.3);';
    } else if (prefix === '08' || prefix === '09') {
      styleBar = 'background: linear-gradient(135deg, hsl(350, 89%, 55%), hsl(350, 89%, 65%)); box-shadow: 0 0 10px -2px hsla(350, 89%, 60%, 0.3);';
    }
    
    return `
      <div class="bar-chart-bar-wrapper">
        <span class="bar-chart-value">${count}</span>
        <div class="bar-chart-bar" style="height: ${heightPercentage}%; max-height: 100%; ${styleBar}" title="${fullText}: ${count} works"></div>
        <span class="bar-chart-label" title="${fullText}">${label}</span>
      </div>
    `;
  }).join('');
}

// Render monthly Deadlines Calendar mapping task Target Dates to date cells
function renderCalendar() {
  const colKeys = CONFIG.COLUMNS;
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  
  dom.calendarMonthYear.textContent = `${monthNames[month]} ${year}`;
  dom.calendarDaysGrid.innerHTML = '';
  
  // Calculations for calendar month layout boundaries
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  // Render empty day offsets for correct weekday starting splits
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    dom.calendarDaysGrid.appendChild(emptyCell);
  }
  
  const today = new Date();
  
  // Render days
  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    
    const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    if (isToday) {
      dayCell.classList.add('today');
    }
    
    dayCell.innerHTML = `<span class="day-num">${day}</span><div class="calendar-events"></div>`;
    const eventsContainer = dayCell.querySelector('.calendar-events');
    
    // Match and append active projects with a target date inside this day
    const dayTasks = state.tasks.filter(task => {
      const targetDateStr = getRowValue(task, colKeys.TARGET_DATE);
      if (!targetDateStr) return false;
      
      try {
        const d = new Date(targetDateStr);
        return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
      } catch {
        return false;
      }
    });
    
    dayTasks.forEach(task => {
      const eventTag = document.createElement('div');
      eventTag.className = 'calendar-event';
      const status = getRowValue(task, colKeys.STATUS).toString().toLowerCase();
      
      // Dynamic HSL colors inside calendar cell items
      let styleColor = 'background: hsla(200, 95%, 55%, 0.15); color: hsl(200, 95%, 55%); border-left: 2px solid hsl(200, 95%, 55%)';
      if (status.includes('hold') || status.includes('02') || status.includes('05')) {
        styleColor = 'background: hsla(38, 92%, 50%, 0.15); color: hsl(38, 92%, 50%); border-left: 2px solid hsl(38, 92%, 50%)';
      } else if (status.includes('issued') || status.includes('complete') || status.includes('03') || status.includes('06')) {
        styleColor = 'background: hsla(142, 70%, 50%, 0.15); color: hsl(142, 70%, 50%); border-left: 2px solid hsl(142, 70%, 50%)';
      }
      
      eventTag.style = styleColor;
      eventTag.textContent = getRowValue(task, colKeys.WORK_NAME) || 'Untitled Work';
      eventTag.title = `${getRowValue(task, colKeys.WORK_NAME)} (Status: ${getRowValue(task, colKeys.STATUS)})`;
      
      // Quick edit directly by clicking on event in calendar cell!
      eventTag.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(task);
      });
      
      eventsContainer.appendChild(eventTag);
    });
    
    dom.calendarDaysGrid.appendChild(dayCell);
  }
}

// Run App!
document.addEventListener('DOMContentLoaded', init);
