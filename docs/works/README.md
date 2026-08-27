# RDO KKD Works — read-only web app

A read-only browser build of the Android app (`android/`), feature-for-feature. Same Google Sheet,
same Apps Script endpoint, same engineer roster, same design-status rules and the same A3 PDF report.

Static HTML/CSS/ES modules — no build step, no dependencies, no bundler. This folder *is* the
published app; there is no sync script and no second copy.

Not to be confused with `docs/app/`, the browser build of the **editable** `windows/` dashboard.
That one is for changing works at a desk; this one is for looking them up on a phone.

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
| `https://hanzel1698.github.io/Workflow-Updater/app/` | `docs/app/` — the editable dashboard |
| `https://hanzel1698.github.io/Workflow-Updater/works/` | this folder |

Every asset path here is relative, so the app runs from the `/works/` subdirectory with no
base-path rewriting: service worker scope, manifest `start_url` and icons all resolve correctly.

It is marked `noindex` because the sheet it reads is office-internal: the URL works for anyone who
has it, but it stays out of search results. Nothing server-side is required — the browser talks to
the Apps Script Web App directly, exactly as the phone does. Any other static host (Netlify, an
office intranet share) works the same way.

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
node docs/works/tests/run-tests.mjs
```

No dependencies. Covers status mapping, date formatting, profile filtering, derived state and
cascading filter options, chip ordering, repository fallbacks, view-model actions and the PDF
report — the same ground as `android/app/src/test/`.

## Keeping it in sync with the app

When the sheet, roster or status rules change, update `android/.../data/SheetConfig.kt`,
`docs/works/js/config.js` and `windows/config.js` together. When shipping a release, update
`docs/works/release_notes.json` alongside `android/whats_new.md`, keeping `versionCode` equal to
`APP_VERSION_CODE` in `docs/works/js/config.js` (the What's New screen only shows notes that match
the build it ships with).
