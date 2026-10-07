/**
 * "PDFs from Excel": builds every engineer's A3 progress report in one go from an Excel copy of
 * the sheet, without the Apps Script read that can take a minute and a half. The file is read in
 * the browser and never uploaded anywhere.
 *
 * 1. Pick the .xlsx downloaded from Google Sheets (File → Download → Microsoft Excel).
 * 2. Type a name for each engineer to report on (names are remembered on this device).
 * 3. Save: choose a folder and get one PDF per engineer in it, or choose where to save one ZIP.
 *
 * Not ported from Android — a web-only screen.
 */

import { loadJsPdf, loadJsZip, loadSheetJs } from '../vendor.js';
import { parseWorkbook, readWorkflowRows } from '../excelImport.js';
import {
  bulkEngineers,
  bulkReport,
  inputDateFrom,
  suggestedEngineerName,
  titleDateFromInput,
} from '../bulkReports.js';
import { buildReportBody } from '../report.js';
import { hasUnsupportedCharacters, renderReportPdf } from '../pdfDocument.js';
import { BulkPrefs } from '../prefs.js';
import { el, iconButton } from './dom.js';
import { Icons } from './icons.js';
import { printReport } from './pdfExport.js';
import { showToast } from './toast.js';
import {
  canPickFolder,
  canPickSaveFile,
  downloadBlobs,
  pickFolder,
  pickZipLocation,
  writeToFolder,
  writeToHandle,
} from './saveFiles.js';

export function createBulkScreen({ onBack }) {
  const names = BulkPrefs.names;
  const savedSelection = BulkPrefs.selectedIds;

  /** Rows of the loaded file; `null` until one is picked. */
  let rows = null;
  let engineers = bulkEngineers([]);
  const selected = new Set(
    savedSelection ??
      engineers.filter((e) => e.onRoster && e.profile.id !== 'ALL' && nameFor(e.profile) !== '').map((e) => e.profile.id),
  );
  let busy = false;

  function nameFor(profile) {
    const typed = names[profile.id];
    return typeof typed === 'string' ? typed.trim() : suggestedEngineerName(profile);
  }

  /* ---------------- 1. Excel file ---------------- */

  const fileInput = el('input', {
    className: 'visually-hidden',
    attrs: {
      type: 'file',
      id: 'bulk-file',
      accept: '.xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
    },
    on: { change: () => fileInput.files[0] && loadFile(fileInput.files[0]) },
  });

  const fileStatus = el('p', { className: 'bulk-file-status', text: 'No file chosen yet.' });

  const dropZone = el('label', { className: 'bulk-drop', attrs: { for: 'bulk-file' } }, [
    el('span', { className: 'bulk-drop-icon', html: Icons.uploadFile() }),
    el('span', { className: 'bulk-drop-text' }, [
      el('strong', { text: 'Choose the Excel file' }),
      el('span', { text: 'or drop it here' }),
    ]),
  ]);
  for (const type of ['dragenter', 'dragover']) {
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add('dragging');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    dropZone.addEventListener(type, () => dropZone.classList.remove('dragging'));
  }
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  });

  const fileCard = el('div', { className: 'detail-card bulk-card' }, [
    el('p', {
      className: 'bulk-help',
      html:
        'In Google Sheets, use <strong>File → Download → Microsoft Excel (.xlsx)</strong>, then pick that file ' +
        'here. The reports are built from the file alone, so they show the sheet exactly as it was when you ' +
        'downloaded it. The file stays on this device.',
    }),
    fileInput,
    dropZone,
    fileStatus,
  ]);

  async function loadFile(file) {
    if (busy) return;
    setBusy(true, 'Reading the file…');
    fileStatus.dataset.tone = '';
    fileStatus.textContent = `Reading ${file.name}…`;
    try {
      const XLSX = await loadSheetJs();
      const workbook = parseWorkbook(XLSX, await file.arrayBuffer());
      const result = readWorkflowRows(XLSX, workbook);
      rows = result.rows;
      engineers = bulkEngineers(rows);
      const officeWorks = engineers.find((e) => e.profile.id === 'ALL')?.workCount ?? 0;
      fileStatus.dataset.tone = 'success';
      fileStatus.textContent =
        `${file.name} · ${result.rows.length} works on “${result.sheetName}”, ${officeWorks} for RDO KKD engineers` +
        ` · saved ${formatFileTime(file.lastModified)}`;
      renderEngineers();
    } catch (error) {
      rows = null;
      engineers = bulkEngineers([]);
      fileStatus.dataset.tone = 'danger';
      fileStatus.textContent = `Could not read ${file.name}: ${error.message || error}`;
      renderEngineers();
    } finally {
      fileInput.value = '';
      setBusy(false);
    }
  }

  /* ---------------- 2. Engineers ---------------- */

  const engineerList = el('div', { className: 'bulk-engineers' });

  const dateInput = el('input', {
    className: 'text-input bulk-date',
    attrs: { type: 'date', id: 'bulk-date', value: inputDateFrom(), 'aria-label': 'Report date' },
    on: { change: syncActions },
  });

  const engineerCard = el('div', { className: 'detail-card bulk-card' }, [
    el('p', {
      className: 'bulk-help',
      text: 'Tick the engineers to report on and type the name to print on each report. Names are remembered on this device.',
    }),
    engineerList,
    el('div', { className: 'bulk-date-row' }, [
      el('label', { className: 'text-field-label', text: 'Report date (“AS ON”)', attrs: { for: 'bulk-date' } }),
      dateInput,
    ]),
  ]);

  function renderEngineers() {
    const roster = engineers.filter((e) => e.onRoster);
    const extras = engineers.filter((e) => !e.onRoster);
    engineerList.replaceChildren(
      ...roster.map(engineerRow),
      ...(extras.length > 0
        ? [
            el('p', {
              className: 'bulk-subhead',
              text: 'Also in this file — ASE values that are not on the engineer roster',
            }),
            ...extras.map(engineerRow),
          ]
        : []),
    );
    syncActions();
  }

  function engineerRow(entry) {
    const { profile } = entry;
    const inputId = `bulk-name-${profile.id.replace(/[^A-Za-z0-9_-]/g, '_')}`;

    const checkbox = el('input', {
      className: 'bulk-check',
      attrs: { type: 'checkbox', 'aria-label': `Include ${profile.id}` },
      checked: selected.has(profile.id),
      on: {
        change: () => {
          if (checkbox.checked) selected.add(profile.id);
          else selected.delete(profile.id);
          BulkPrefs.selectedIds = [...selected];
          syncRow();
          syncActions();
        },
      },
    });

    const nameInput = el('input', {
      className: 'text-input bulk-name',
      attrs: {
        type: 'text',
        id: inputId,
        placeholder: profile.id === 'ALL' ? 'Name for the all-engineers report' : "Engineer's name",
        autocomplete: 'off',
        'aria-label': `Name for ${profile.id}`,
      },
      value: nameFor(profile),
      on: {
        input: () => {
          const hadName = nameFor(profile) !== '';
          names[profile.id] = nameInput.value;
          BulkPrefs.names = names;
          const hasName = nameInput.value.trim() !== '';
          // Typing a name is the obvious way to say "include this one"; clearing it, the opposite.
          if (hasName && !hadName) selected.add(profile.id);
          if (!hasName && hadName) selected.delete(profile.id);
          checkbox.checked = selected.has(profile.id);
          BulkPrefs.selectedIds = [...selected];
          syncRow();
          syncActions();
        },
      },
    });

    const previewButton = iconButton(Icons.print(), {
      label: `Print view for ${profile.id}`,
      className: 'bulk-preview',
      onClick: () => openPrintView(profile, nameInput.value.trim()),
    });

    const count = el('span', {
      className: 'bulk-count',
      text: rows ? `${entry.workCount} ${entry.workCount === 1 ? 'work' : 'works'}` : '—',
    });

    const row = el('div', { className: 'bulk-engineer' }, [
      checkbox,
      el('span', { className: 'bulk-id', text: profile.id === 'ALL' ? 'ALL' : profile.id }),
      nameInput,
      count,
      previewButton,
    ]);

    function syncRow() {
      const included = selected.has(profile.id);
      row.classList.toggle('included', included);
      nameInput.classList.toggle('invalid', included && nameInput.value.trim() === '');
      previewButton.disabled = !rows || nameInput.value.trim() === '';
    }
    syncRow();
    return row;
  }

  /* ---------------- 3. Save ---------------- */

  const folderMode = canPickFolder();
  const zipPicker = canPickSaveFile();

  const saveButton = el('button', {
    className: 'filled-btn block',
    attrs: { type: 'button' },
    on: { click: () => generate(folderMode ? 'folder' : 'download') },
  });
  const zipButton = el('button', {
    className: 'text-btn primary bulk-zip',
    attrs: { type: 'button' },
    text: zipPicker ? 'Save as one ZIP file instead…' : 'Download as one ZIP file instead',
    on: { click: () => generate('zip') },
  });
  const actionHint = el('p', { className: 'bulk-hint' });
  const results = el('div', { className: 'bulk-results', hidden: true });

  const saveCard = el('div', { className: 'bulk-actions' }, [
    saveButton,
    zipButton,
    actionHint,
    results,
  ]);

  /** The engineers that will get a report, or why there are none yet. */
  function plan() {
    const date = titleDateFromInput(dateInput.value);
    const picked = engineers.filter((e) => selected.has(e.profile.id));
    const unnamed = picked.filter((e) => nameFor(e.profile) === '');
    let blocker = null;
    if (!rows) blocker = 'Choose the Excel file first.';
    else if (picked.length === 0) blocker = 'Tick at least one engineer.';
    else if (unnamed.length > 0) blocker = `Type a name for ${unnamed.map((e) => e.profile.id).join(', ')}.`;
    else if (!date) blocker = 'Pick the report date.';
    return { date, picked, blocker };
  }

  function syncActions() {
    const { picked, blocker } = plan();
    const n = picked.length;
    const files = `${n} PDF${n === 1 ? '' : 's'}`;
    saveButton.textContent = busy ? busyLabel : folderMode ? `Choose a folder and save ${files}…` : `Download ${files}`;
    saveButton.disabled = busy || blocker !== null;
    zipButton.disabled = busy || blocker !== null;
    zipButton.hidden = n < 2;
    actionHint.dataset.tone = blocker ? 'warning' : '';
    actionHint.textContent =
      blocker ??
      (folderMode
        ? 'You will be asked which folder to save into. A report with the same name already there is replaced.'
        : 'This browser saves into its download folder. To be asked where each time, turn on “Ask where to save ' +
          'each file before downloading” in its download settings — or use Chrome or Edge on a computer, which ' +
          'ask for a folder.');
  }

  let busyLabel = '';
  function setBusy(value, label = '') {
    busy = value;
    busyLabel = label;
    saveButton.classList.toggle('busy', value);
    syncActions();
  }

  async function generate(mode) {
    const { date, picked, blocker } = plan();
    if (busy || blocker) return;

    // The pickers need this click's user activation, so they open before anything else is awaited.
    let folder = null;
    let zipHandle = null;
    try {
      if (mode === 'folder') {
        folder = await pickFolder();
        if (!folder) return;
      } else if (mode === 'zip' && zipPicker) {
        zipHandle = await pickZipLocation(`RDO KKD progress reports - AS ON ${date}.zip`);
        if (!zipHandle) return;
      }
    } catch (error) {
      showToast(`Could not open the save dialog: ${error.message || error}`, { long: true });
      return;
    }

    setBusy(true, 'Making the PDFs…');
    results.hidden = true;
    try {
      const jsPDF = await loadJsPdf();
      const reports = picked.map((entry) => bulkReport(rows, { profile: entry.profile, engineerName: nameFor(entry.profile) }, date));
      const files = [];
      for (const report of reports) {
        // Yield between reports so the button's label and spinner can repaint.
        await new Promise((resolve) => setTimeout(resolve, 0));
        const doc = renderReportPdf(jsPDF, report.model);
        files.push({
          report,
          name: report.fileName,
          blob: doc.output('blob'),
          pages: doc.getNumberOfPages(),
          lossy: hasUnsupportedCharacters(report.model),
        });
      }

      let where;
      if (mode === 'folder') {
        setBusy(true, 'Saving…');
        for (const file of files) await writeToFolder(folder, file.name, file.blob);
        where = `Saved to the “${folder.name}” folder`;
      } else if (mode === 'zip') {
        setBusy(true, 'Packing the ZIP…');
        const JSZip = await loadJsZip();
        const zip = new JSZip();
        for (const file of files) zip.file(file.name, file.blob);
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        const zipName = zipHandle ? zipHandle.name : `RDO KKD progress reports - AS ON ${date}.zip`;
        if (zipHandle) await writeToHandle(zipHandle, zipBlob);
        else await downloadBlobs([{ name: zipName, blob: zipBlob }]);
        where = zipHandle ? `Saved as ${zipName}` : `Downloaded as ${zipName}`;
      } else {
        await downloadBlobs(files);
        where = 'Sent to the browser’s downloads';
      }

      showResults(files, where);
      showToast(`${files.length} PDF${files.length === 1 ? '' : 's'} ready`);
    } catch (error) {
      showToast(`Could not make the PDFs: ${error.message || error}`, { long: true });
    } finally {
      setBusy(false);
    }
  }

  function showResults(files, where) {
    results.replaceChildren(
      el('p', { className: 'bulk-results-title', text: where }),
      ...files.map((file) =>
        el('div', { className: 'bulk-result' }, [
          el('span', { className: 'bulk-result-icon', html: Icons.check() }),
          el('div', { className: 'bulk-result-text' }, [
            el('span', { className: 'bulk-result-name', text: file.name }),
            el('span', {
              className: 'bulk-result-meta',
              text:
                `${file.report.works.length} works · ${file.pages} page${file.pages === 1 ? '' : 's'}` +
                (file.lossy ? ' · some characters could not be drawn — use Print view for this one' : ''),
            }),
          ]),
        ]),
      ),
    );
    results.hidden = false;
  }

  function openPrintView(profile, engineerName) {
    const date = titleDateFromInput(dateInput.value);
    if (!rows || engineerName === '' || !date) return;
    const report = bulkReport(rows, { profile, engineerName }, date);
    printReport({
      html: buildReportBody(report.works, profile, engineerName, { date }),
      jobName: report.fileName.replace(/\.pdf$/, ''),
      onStarted: () => {},
      onError: (message) => showToast(message, { long: true }),
    });
  }

  /* ---------------- Layout ---------------- */

  const appBar = el('header', { className: 'app-bar detail-bar' }, [
    iconButton(Icons.arrowBack(), { label: 'Back', onClick: onBack }),
    el('div', { className: 'app-bar-titles' }, [
      el('h1', { className: 'app-bar-title', text: 'PDFs from Excel' }),
      el('p', { className: 'app-bar-subtitle', text: 'Every engineer’s report in one go' }),
    ]),
  ]);

  const section = (title, card) =>
    el('section', { className: 'detail-section bulk-section' }, [el('h2', { className: 'detail-section-title', text: title }), card]);

  const body = el('main', { className: 'scroll-area detail-body bulk-body' }, [
    section('1 · EXCEL FILE', fileCard),
    section('2 · ENGINEERS', engineerCard),
    section('3 · SAVE', saveCard),
  ]);

  renderEngineers();

  return { root: el('div', { className: 'screen bulk-screen' }, [appBar, body]) };
}

function formatFileTime(millis) {
  if (!millis) return 'at an unknown time';
  const when = new Date(millis);
  const date = `${String(when.getDate()).padStart(2, '0')}/${String(when.getMonth() + 1).padStart(2, '0')}/${when.getFullYear()}`;
  const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
}
