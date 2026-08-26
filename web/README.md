# RDO KKD Works — web app

A read-only browser build of the Android app (`android/`), feature-for-feature. Same Google Sheet,
same Apps Script endpoint, same engineer roster, same design-status rules and the same A3 PDF report.

Static HTML/CSS/ES modules — no build step, no dependencies, no bundler.

## Run it

```powershell
cd web
powershell -ExecutionPolicy Bypass -File .\start_server.ps1
```

or double-click `Launch Web App.bat`. Any static server works:

```bash
cd web && python3 -m http.server 8080   # then open http://localhost:8080
```

It must be served over HTTP, not opened from disk — ES modules, the service worker and the live
sheet fetch are all blocked on `file://`.

To publish it, upload the `web/` folder to any static host (GitHub Pages, Netlify, an office
intranet share). Nothing server-side is required: the browser talks to the Apps Script Web App
directly, exactly as the phone does.

## Feature parity with the Android app

| Android | Web | Notes |
|---|---|---|
| One-time **What's New** screen per release | ✅ | Reads `release_notes.json` (same shape as the app's asset); shown once per `versionCode` |
| One-time **default profile** setup gate | ✅ | Choice persists in `localStorage` and is reused on every later visit |
| Works list with status badge, location, floors/area, AS/AR/SR pills, remarks | ✅ | |
| Live search over work name, file number, LAC and design-unit remarks | ✅ | |
| Design-status KPI chips with counts, tap to filter, "All works" pinned first | ✅ | Only statuses present in the current pool are shown |
| **Reorder status chips**, persisted | ✅ | Press-and-drag (long-press on touch); `Alt`+`←`/`→` also works with a keyboard |
| Filter sheet: District, LAC, SE, AS/AR/SR status, with cascading options | ✅ | Same "clear all" / "apply" behaviour and active-filter badge |
| Filter result chip ("N of M works match your filters") | ✅ | |
| Clear-all-filters button | ✅ | |
| Engineer profile switcher, set-default star, active check | ✅ | |
| Read-only work detail: Overview, Approvals, Building, Timeline, Remarks, Additional Information | ✅ | Unknown sheet columns still surface under Additional Information |
| Sheet dates shown as `DD/MM/YYYY` in Asia/Kolkata | ✅ | ISO instants are converted before the date is read, so the day never slips |
| Export grouped **A3 landscape PDF** report, named after the engineer | ✅ | Goes through the browser's print dialog → "Save as PDF" (Android uses `PrintManager`) |
| Offline: last synced sheet is reopened without network | ✅ | Snapshot in `localStorage`; app shell cached by a service worker |
| Offline banner with last-synced time | ✅ | |
| Pull to refresh | ✅ | Plus a refresh button in the top bar, since desktop browsers have no pull gesture |
| Sample data when there is no network and no cache | ✅ | |
| Installable to the home screen | ✅ | Web app manifest + icons; Android ships as an APK |

The web app is read-only, like the Android app: no add, edit or delete. For editing, use the
desktop dashboard in `windows/`.

## Layout

| Path | Purpose |
|---|---|
| `index.html`, `styles.css` | App shell and the violet theme ported from the app's Compose theme |
| `js/config.js` | Sheet URL, spreadsheet id, engineer roster, statuses, column aliases, sample rows |
| `js/model.js` | Row normalization, design-status mapping, `DD/MM/YYYY` date formatting |
| `js/repository.js` | Apps Script fetch → profile filtering → cache/sample fallbacks |
| `js/cache.js`, `js/prefs.js` | `localStorage` snapshot and persisted preferences |
| `js/state.js`, `js/chipOrder.js` | Derived state (filters, options, counts) and chip ordering |
| `js/viewmodel.js` | Screen state and the actions that change it |
| `js/report.js` | A3 landscape PDF report HTML |
| `js/ui/` | Screens, sheets, dialogs, chips, cards |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline app shell and installability |
| `tests/run-tests.mjs` | Logic tests mirroring the Android unit tests |

Each module names the Kotlin file it was ported from, so the two clients can be kept in step.

## Tests

```bash
node web/tests/run-tests.mjs
```

No dependencies. Covers status mapping, date formatting, profile filtering, derived state and
cascading filter options, chip ordering, repository fallbacks, view-model actions and the PDF
report — the same ground as `android/app/src/test/`.

## Keeping it in sync with the app

When the sheet, roster or status rules change, update **both** `android/.../data/SheetConfig.kt`
and `web/js/config.js`. When shipping a release, update `web/release_notes.json` alongside
`android/whats_new.md`, keeping `versionCode` equal to `APP_VERSION_CODE` in `web/js/config.js`
(the What's New screen only shows notes that match the build it ships with).
