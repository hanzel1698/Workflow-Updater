# Workflow Updater

Custom dashboard frontend for the RDO KKD Google Sheets workflow tracker.

## Project layout

| Folder | Purpose |
|--------|---------|
| `windows/` | Desktop dashboard (HTML/CSS/JS) with editing, Python local server, and EXE build scripts |
| `android/` | Native Android app (Jetpack Compose) for viewing works on mobile |
| `docs/` | GitHub Pages site — privacy policy at the root, plus both web apps (`docs/app/`, `docs/works/`) |
| `scripts/` | Shared maintenance scripts |

The **canonical source** for the editable dashboard lives in `windows/`. After editing those files,
sync the copies:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-android-assets.ps1   # Android assets
python3 scripts/sync-web-assets.py                                           # docs/app web app
```

## Two web apps

The Pages site hosts both, for two different jobs:

| URL | What it is | Source |
|-----|------------|--------|
| [`/app/`](https://hanzel1698.github.io/Workflow-Updater/app/) | **Editable dashboard** — the full `windows/` workspace in the browser: add and edit works, calendar, analytics, Excel export. On a desktop PC it uses the whole window rather than a 1440px column | Synced from `windows/` |
| [`/works/`](https://hanzel1698.github.io/Workflow-Updater/works/) | **Read-only works viewer** — the Android app's feature set, built for a phone in the field: search, status chips, filters, A3 PDF report. Opened on a desktop PC it uses the whole window instead of a phone column | `docs/works/` |

Both read the same Google Sheet through the same Apps Script Web App, and both work offline once
loaded. Use `/app/` at a desk when you need to change something; use `/works/` on a phone when you
only need to look something up.

`/works/` and `android/` are read-only viewers that share the same engineer roster, design-status
rules and PDF report — when those change, update `windows/config.js`, `docs/works/js/config.js` and
`android/.../data/SheetConfig.kt` together.

## Editable web app (no server)

`docs/app/` is the same dashboard built to run entirely in the browser — no Python, no Node, no
backend. It calls the Google Apps Script Web App directly, so publishing it is nothing more than
serving static files.

**Live URL** once GitHub Pages is enabled:

```
https://<your-github-user>.github.io/Workflow-Updater/app/
```

Enable it once under **Settings → Pages → Build and deployment → Deploy from a branch →
`master` + `/docs`**. The privacy policy keeps the site root; the dashboard is served from `/app/`.
Open that URL on a phone or PC and the dashboard is simply there — no launcher, no local server.

What the web build adds on top of `windows/`:

- **Installable** — the header's *Install App* button (or the browser's own install control) puts it
  on the home screen / Start menu and launches it without browser chrome. On iPhone/iPad, Safari
  has no install button: use **Share → Add to Home Screen**.
- **Works offline** — a service worker caches the app shell, and the last sheet payload is kept in
  the browser. Launching offline shows that data with a pill saying when it was saved. Writing back
  to the sheet still needs a connection.
- **Settings in the UI** — the Apps Script URL, Sheet ID and tab name are editable from the
  *Settings* button and stored in that browser only, so each engineer can point the app at their own
  deployment without editing `config.js`.
- **Fast start** — the Google Fonts import is taken off the render-blocking path, so a slow or
  missing network no longer delays the dashboard by several seconds.

URL options: `?demo=1` loads the bundled sample data (handy for showing the app without the sheet),
`?profile=ASE01` opens a specific engineer profile.

### Desktop screen real estate

The dashboard defaults to a 1440px column centred in the window, which leaves a 4K monitor more
than half empty. A gate at the top of `windows/app.js` works out whether it is running on a desktop
PC and, if so, stamps `data-device="desktop"` on `<html>`; `windows/style.css` opens the layout out
from there. Because it lives in `windows/`, both the local dashboard and `/app/` get it.

A desktop PC means **a mouse-driven machine with a window at least 900px wide** — not just a big
screen. `navigator.userAgentData.mobile` vetoes outright, and `(hover: hover) and (pointer: fine)`
is the deciding test, which keeps tablets in landscape (iPadOS included, where Safari sends a Mac
user-agent string) on the normal layout. It is re-checked on resize and when the pointer changes.

What the extra room buys:

- **The dashboard spans the window** — at 2560px the KPI cards fit on one row instead of two, and
  the filters, calendar and analytics panels all widen with it.
- **Wider work rows** — at 1920px a row goes from 1376px to about 1800px, which is usually the
  difference between a truncated remark and the whole one.
- **Two columns of work rows** once there is room for two comfortable ones (about 2000px of
  container), so a 4K monitor shows twice as many works.
- **A roomier edit sheet** above 1700px, where the form and its timeline both have space.

Nothing changes on a phone, a tablet, or a narrowed window — the rules are additive and keyed to
`data-device="desktop"`.

### Rebuilding the web app

`windows/` stays the canonical source. After editing it, re-run:

```bash
python3 scripts/sync-web-assets.py        # Windows: py scripts\sync-web-assets.py
```

That copies `index.html`, `app.js`, `config.js` and `style.css` into `docs/app/`, injects the PWA
tags, and re-stamps the service worker so returning visitors pick up the change. The
**Web App In Sync** workflow fails the build if `docs/app/` is stale.

Icons are generated and only need rebuilding if the artwork changes:

```bash
python3 scripts/generate-web-icons.py
```

Files owned by the web build and never overwritten by the sync: `web-boot.js` (settings, offline
cache, install prompt), `sw.js`, `manifest.webmanifest`, `icons/`.

## Read-only works viewer

`docs/works/` is a browser build of the **Android** app rather than the desktop dashboard: the same
works list, search, design-status chips, filters, engineer profiles, detail view and A3 PDF report,
and no editing at all. It is mobile-first, installs to a home screen, and opens offline from the
last synced sheet.

It also knows when it has been opened on a desktop PC — a mouse-driven machine with a window at
least 900px wide, so tablets and half-screen windows are not mistaken for one — and then drops the
phone column for the full window: a works grid that grows a column per ~340px, and a detail view
that fits on one screen. See [`docs/works/README.md`](docs/works/README.md#opened-on-a-desktop-pc).

It has no build step and no sync script — the folder is the app, published straight from `docs/`.
To run it locally, double-click `docs\works\Launch Web App.bat` (or
`powershell -ExecutionPolicy Bypass -File .\docs\works\start_server.ps1`), which serves `docs/`
at <http://localhost:8080/works/> so local paths match the live site.

```bash
node docs/works/tests/run-tests.mjs        # logic tests, no dependencies
python3 scripts/generate-works-icons.py    # only if the icon artwork changes
```

See [`docs/works/README.md`](docs/works/README.md) for the full feature-parity table against the
Android app.

## Windows app

**Quick start:** double-click `Launch Dashboard.bat` at the repo root (or `windows\Launch Dashboard.bat`).
This starts a local Python/Node server because browsers block live sheet access from `file://`. To
skip that entirely, use the hosted [web apps](#two-web-apps) instead.

**Standalone EXE:**

```powershell
cd windows
powershell -ExecutionPolicy Bypass -File .\build_exe.ps1
```

## Android app

**Sync assets and build release APK:**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-release.ps1
```

Release APK output: `android/app/build/outputs/apk/release/app-release.apk`

On the first launch after installing a release APK, users see a one-time **What's New** screen. Release builds embed `app/src/main/assets/release_notes.json`, generated by `scripts/generate-android-release-notes.py` (also run automatically in CI before `assembleRelease`).

**How What's New content is chosen**

1. **Preferred:** edit `android/whats_new.md` with short end-user bullets before shipping. That file is the source of truth for the screen.
2. **Fallback:** if that file is empty/missing, the script scans recent git commits and keeps only user-facing changes (`feat` / `fix` / `perf`, or commits that touch app code). Pure CI/workflow/docs/signing/script changes are skipped.

Write notes the user would care about (new capability, visible fix). Do not list GitHub Actions, Gradle, keystore, or other engineering chores.

Signing uses `android/keystore.properties` and a local keystore (not committed). Generate once:

```powershell
cd android
keytool -genkeypair -v -keystore workflow-updater-release.keystore -alias workflowupdater -keyalg RSA -keysize 2048 -validity 10000
```

Then create `android/keystore.properties`:

```properties
storeFile=workflow-updater-release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=workflowupdater
keyPassword=YOUR_KEY_PASSWORD
```

## Google Apps Script

Deploy `windows/google_apps_script.js` as a Web App from your Google Sheet and set the URL in `windows/config.js`.
