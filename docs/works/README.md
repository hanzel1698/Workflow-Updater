# RDO KKD Works — read-only web app

Looks up the RDO KKD works in the office Google Sheet, on a phone or a PC, and exports each
engineer's A3 PDF report. It reads the sheet through the Apps Script Web App in
[`apps-script/Code.js`](../../apps-script/Code.js) and never writes to it. It began as a browser
build of the Android app, which has since been retired.

Static HTML/CSS/ES modules — no build step, no dependencies, no bundler. This folder *is* the
published app; there is no sync script and no second copy.

## Run it

Double-click `Launch Web App.bat`, or:

```powershell
powershell -ExecutionPolicy Bypass -File .\start_server.ps1
```

Either serves the `docs/` folder at <http://localhost:8080/works/>, so local paths match the live
site. Any static server works, as long as you serve `docs/` rather than this folder:

```bash
python3 -m http.server 8080 --directory docs   # then open http://localhost:8080/works/
```

It must be served over HTTP, not opened from disk — ES modules, the service worker and the live
sheet fetch are all blocked on `file://`.

## Published site

GitHub Pages serves `docs/` from `master`, so a merge publishes this folder as-is:

| URL | Source |
|---|---|
| `https://hanzel1698.github.io/Workflow-Updater/` | `docs/index.html` — the privacy policy URL registered with Google Play |
| `https://hanzel1698.github.io/Workflow-Updater/app/` | `docs/app/` — redirects here; the retired editable dashboard used to live there |
| `https://hanzel1698.github.io/Workflow-Updater/works/` | this folder |

Every asset path here is relative, so the app runs from the `/works/` subdirectory with no
base-path rewriting: service worker scope, manifest `start_url` and icons all resolve correctly.

It is marked `noindex` because the sheet it reads is office-internal: the URL works for anyone who
has it, but it stays out of search results. Nothing server-side is required — the browser talks to
the Apps Script Web App directly. Any other static host (Netlify, an office intranet share) works
the same way.

## Features

| Feature | Notes |
|---|---|
| One-time **What's New** screen per release | Reads `release_notes.json`; shown once per `versionCode` |
| One-time **default profile** setup gate | Choice persists in `localStorage` and is reused on every later visit |
| Works list with status badge, location, floors/area, AS/AR/SR pills, remarks | |
| Live search over work name, file number, LAC and design-unit remarks | |
| Design-status KPI chips with counts, tap to filter, "All works" pinned first | Only statuses present in the current pool are shown |
| **Reorder status chips**, persisted | Press-and-drag (long-press on touch); `Alt`+`←`/`→` also works with a keyboard |
| Filter sheet: District, LAC, SE, AS/AR/SR status, with cascading options | Same "clear all" / "apply" behaviour and active-filter badge |
| Filter result chip ("N of M works match your filters") | |
| Clear-all-filters button | |
| Engineer profile switcher, set-default star, active check | |
| Read-only work detail: Overview, Approvals, Building, Timeline, Remarks, Additional Information | Unknown sheet columns still surface under Additional Information |
| Sheet dates shown as `DD/MM/YYYY` in Asia/Kolkata | ISO instants are converted before the date is read, so the day never slips |
| Export grouped **A3 landscape PDF** report, named after the engineer | The report is rendered into the page behind a print stylesheet, then `window.print()` → "Save as PDF". Not an iframe: a 0×0 iframe is never laid out and prints blank |
| Opens instantly, and offline, from the last synced sheet | Snapshot in `localStorage`, shown first while a fresh copy loads behind it; app shell cached by a service worker |
| Offline banner with last-synced time | |
| Pull to refresh, or the refresh button in the top bar | Asks the Web App to re-read the sheet if it was edited since its saved copy (see [Where the data comes from](#where-the-data-comes-from)) |
| Sample data when there is no network and no cache | |
| Installable to the home screen | Web app manifest + icons |
| **Desktop layout** | On a PC the app drops the phone column and uses the whole window (see below) |
| **PDFs from Excel** | Every engineer's report in one go from a downloaded copy of the sheet, with no Apps Script read (see below) |

The app is read-only: no add, edit or delete. Changes are made in the Google Sheet itself.

## Where the data comes from

Reading the sheet takes Apps Script 15–80 s, so the Web App keeps a saved copy instead and
answers from that in a few seconds. Every 15 minutes it checks whether the sheet was edited and,
if so, reads it again, so the copy is at most ~15 minutes old.

A refresh (the button, or pull-to-refresh) sends `refresh=1`, which makes the Web App check the
sheet straight away. If it hasn't been edited, the refresh returns as fast as any other load. If
it has, that refresh waits for the full read before the list updates, so a fresh edit is in the
report you export next. A refresh never settles for a plain read already in flight
(`js/repository.js`).

## Opened on a desktop PC

The phone layout is a 900px column, which wastes most of a monitor. `js/ui/deviceLayout.js` works
out whether the app is on a desktop PC and, if it is, stamps `data-device="desktop"` on `<html>`;
`styles.css` opens the layout out from there. Nothing changes on a phone.

A desktop PC means **a mouse-driven machine with a window at least 900px wide** — not just a big
screen:

| Signal | Effect |
|---|---|
| `navigator.userAgentData.mobile` is true | Never desktop, whatever else says |
| Window narrower than 900px | Compact — a half-screen window on a PC is phone-shaped, and gets the phone layout |
| `(hover: hover) and (pointer: fine)` | The deciding test: a mouse or trackpad, not a finger. Keeps tablets in landscape — and iPadOS, which sends a Mac user-agent string — on the compact layout |
| No pointer media queries at all | Falls back to "no touch digitizer and a wide window" |

It is re-checked on resize and when the pointer changes, so shrinking a window or docking a tablet
switches layouts live. What the desktop layout does with the extra room:

- **Works list** — one column per ~340px of window, so a 1080p monitor shows around 15 works at
  once instead of 3, and a 4K one more again.
- **Work details** — sections flow into columns (`columns`, not a grid, so a short section leaves
  no void beside it); a whole work usually fits on one screen with no scrolling.
- **Search and KPI chips share a row** above 1600px, which buys the list another row of cards.
  Below that the chips keep the full width, so they never have to be scrolled sideways with a
  mouse.
- **Wider gutters** and a floating action button that follows the window edge rather than the
  vanished column.
- **The What's New and profile gates keep a readable measure** — full width helps a list, not a
  paragraph.

## PDFs from Excel

The **PDFs from Excel** screen (`#/bulk`) skips Apps Script altogether: download the sheet from
Google Sheets (**File → Download → Microsoft Excel**), pick the file, type a name for each engineer, and save one A3 report per engineer in a
single step. The reports show the sheet exactly as it was downloaded, so they can be newer than
what the list on screen shows.

It is reached from the app bar's upload button on a wide screen, from the **Export PDF** dialog,
and from the "Taking a while?" link while the sheet is still loading. A direct link to
`/works/#/bulk` opens it without waiting for anything.

- **Reading the file** (`js/excelImport.js`) mirrors `buildPayload_` in `apps-script/Code.js`:
  the `WORKFLOW MONITORING SHEET` tab (else the first non-`OLD` tab with a header row), the
  header row found by `Name of Work` / `e-Office File Number`, and only rows with a Name of Work.
  Date cells are read from Excel's day number, so no timezone can shift the day. Against the live
  sheet, every engineer's report came out byte-identical to the Apps Script one.
- **Engineers** (`js/bulkReports.js`): the roster, "All engineers", then any ASE value in the
  file's RDO KKD rows that is not on the roster (a new engineer, or "Not Assigned"). Names and
  ticks are remembered in `localStorage`; AD's roster name is pre-filled.
- **The PDF** (`js/pdfDocument.js`) is drawn with jsPDF + AutoTable from the same
  `buildReportModel` the print view uses: same title, groups, NIL rows, column proportions,
  fills and rules, header repeated on every page, no row split, and no status heading left alone
  at the foot of a page. Text is set slightly smaller than the print view because Helvetica runs
  wider than Segoe UI, and a word too long for its column is shrunk rather than broken.
  Helvetica covers Latin-1 only: anything outside it is flagged on the result, and each
  engineer's **print** button opens the browser print view, which draws every character.
- **Saving** (`js/ui/saveFiles.js`): Chrome and Edge on a computer ask for a **folder** and write
  every PDF into it (a same-named report there is replaced), or ask **where to save** the single
  ZIP. Other browsers cannot pick a location from a page, so the files go through the normal
  download, which asks where only when the browser's "Ask where to save each file" setting is on.
- **Libraries** live in `vendor/` (SheetJS mini 0.18.5, jsPDF 2.5.1, jsPDF-AutoTable 3.8.4,
  JSZip 3.10.1, copied from cdnjs) and load only when the screen is used, so the list never pays
  for them. The file is never uploaded anywhere.

## Layout

| Path | Purpose |
|---|---|
| `index.html`, `styles.css` | App shell, and the violet theme — one accent, five status tones applied through `data-tone`, one radius scale |
| `js/config.js` | Sheet URL, spreadsheet id, engineer roster, statuses, column aliases, sample rows |
| `js/model.js` | Row normalization, design-status mapping, `DD/MM/YYYY` date formatting |
| `js/repository.js` | Apps Script fetch (with `refresh=1` on a forced refresh) → profile filtering → cache/sample fallbacks |
| `js/cache.js`, `js/prefs.js` | `localStorage` snapshot and persisted preferences |
| `js/state.js`, `js/chipOrder.js` | Derived state (filters, options, counts) and chip ordering |
| `js/viewmodel.js` | Screen state and the actions that change it |
| `js/report.js` | The report model (`buildReportModel`) and its A3 landscape print HTML |
| `js/excelImport.js` | Reads the workflow rows out of an Excel copy of the sheet |
| `js/bulkReports.js`, `js/pdfDocument.js` | PDFs from Excel: the per-engineer plan, and the report drawn as a PDF file |
| `js/vendor.js`, `vendor/` | On-demand loader and the SheetJS / jsPDF / AutoTable / JSZip builds it loads |
| `js/ui/` | Screens, sheets, dialogs, chips, cards |
| `js/ui/deviceLayout.js` | Desktop-PC detection; stamps `data-device` on `<html>` for the desktop layout |
| `js/ui/theme.js` | The app bar's dark/light button |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline app shell and installability |
| `tests/run-tests.mjs` | Logic tests |

Most modules still name the Kotlin file they were ported from. The Android app is gone, but
those files are in the git history.

## Tests

```bash
node docs/works/tests/run-tests.mjs
```

No dependencies. Covers status mapping, date formatting, profile filtering, derived state and
cascading filter options, chip ordering, repository fallbacks, view-model actions, desktop-PC
detection, the PDF report, and the Excel import and bulk reports.

## Making a change

When the sheet, roster or status rules change, update `js/config.js`. If the sheet's layout
changes (tab name, header row), update `apps-script/Code.js` and `js/excelImport.js` together, as
they read it the same way. To announce a release with the What's New screen, write the notes in
`release_notes.json` and set its `versionCode` and `APP_VERSION_CODE` in `js/config.js` to the
same new number: the screen only shows notes that match the build it ships with.
