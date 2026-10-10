# Workflow Updater

A read-only web app for the RDO KKD Google Sheets workflow tracker: look works up on a phone or a
PC, filter them, and export each engineer's A3 PDF report. It never writes to the sheet. Changes
are made in the Google Sheet itself.

**Live:** <https://hanzel1698.github.io/Workflow-Updater/works/>

## Project layout

| Path | Purpose |
|------|---------|
| `docs/works/` | The web app. See [`docs/works/README.md`](docs/works/README.md) |
| `apps-script/Code.js` | The Google Apps Script Web App that serves the sheet to the app |
| `docs/` | GitHub Pages site: the privacy policy at the root, the app at `/works/` |
| `docs/app/` | A redirect left where the retired editable dashboard used to be (see [Retired](#retired)) |
| `scripts/` | `generate-works-icons.py` for the app, plus Play release tooling for the other Android repos |

## How the data loads

Reading the sheet takes Apps Script 15–80 s, so the app doesn't wait on that read every time it opens:

- **In the background**, every 15 minutes, the Apps Script checks whether the sheet has been edited.
  If it has, it reads the sheet once and saves the result as a JSON file in the Drive of the account
  that deployed the script (ad.rdokkd@gmail.com).
- **Opening the app** fetches that saved copy, which takes a few seconds and is at most ~15 minutes old.
  The app also shows its own last copy straight away, so it opens instantly and works offline.
- **The refresh button** (or pull-to-refresh) asks the script to look at the sheet now. If nothing
  has been edited since the saved copy, the answer is just as quick. If it has, that one refresh
  waits for a full read (15–80 s, as before), and everyone who opens the app afterwards gets the new copy
  instantly. Use it after editing the sheet when you need a report straight away.
- **PDFs from Excel** (`/works/#/bulk`) skips the script entirely: download the sheet as `.xlsx`
  and build every engineer's report from the file.

## Web app

`docs/works/` is plain HTML, CSS and ES modules: no build step and no dependencies. GitHub Pages
publishes `docs/` on every push to `master` (`.github/workflows/deploy-pages.yml`).

Run it locally by double-clicking `docs\works\Launch Web App.bat`, or:

```bash
python3 -m http.server 8080 --directory docs   # then open http://localhost:8080/works/
node docs/works/tests/run-tests.mjs            # logic tests, no dependencies
```

## Google Apps Script

`apps-script/Code.js` is a standalone Apps Script project owned by ad.rdokkd@gmail.com, which has
access to the office sheet. The script reads the sheet as that account, so the sheet never needs
to be shared any further.

**To deploy a change** (the steps are also at the top of the file):

1. At [script.google.com](https://script.google.com), sign in as ad.rdokkd@gmail.com and open the
   project. Replace the contents of `Code.gs` with `apps-script/Code.js`.
2. Pick **setup** in the function menu and click **Run**, then approve the permissions it asks
   for: Sheets, Drive (for the saved copy and the sheet's last-edited time) and triggers. It saves
   the first copy and installs the 15-minute trigger. Running it again is harmless.
3. **Deploy → Manage deployments**, select the existing Web app, click **Edit** (pencil),
   choose **Version: New version**, and click **Deploy**. Keep *Execute as: Me* and *Who has
   access: Anyone*. Don't use **New deployment**: that gets a new URL, and `SCRIPT_URL` in
   `docs/works/js/config.js` only knows the current one.

**To check it:** open the Web App URL in a browser. You should get JSON straight away, with
`snapshotAt` (when the sheet was last read) and `checkedAt` (when the copy was last confirmed to
match the sheet; the app shows this as "Sheet as of"). The saved copy is **Workflow Updater - sheet snapshot.json** in My Drive. Leave
it there and don't share it: if it's deleted, the next refresh recreates it.

Free Google accounts get 90 minutes of trigger runtime a day. The trigger only does the slow read
after an edit (or every 6 hours regardless, to catch formula-only changes), so it stays well
inside that.

The Web App is shared with *Anyone*, and its URL is in the public `config.js`, so anyone who
finds the URL can read the rows the app shows. That was already true before. What changed is
that the script no longer accepts writes.

## Retired

These have been removed. They are still in the git history if ever needed.

- **The editable dashboard** (`windows/`, served at `/app/`, plus the Windows EXE build). Editing
  happens in the Google Sheet now. `docs/app/` keeps a small page that redirects to `/works/`, and
  a service worker that removes the dashboard from browsers that installed it.
- **The Android app** (`android/` and its build, signing and Play upload workflows). This doesn't
  unpublish it from Google Play: phones that already have it keep loading the sheet, because the
  Apps Script's response hasn't changed. To withdraw it, unpublish it in Play Console. The
  privacy policy at `docs/index.html` must stay online as long as the listing exists. The Play
  signing secrets in this repo's GitHub settings are no longer used.

The release tooling in `scripts/` (`deploy-play-workflows.sh`, `play-workflows/`,
`sync-github-secrets.sh`, `create-keystores-termux.sh`, `generate-android-release-notes.py`)
serves the other Android repos and was left in place.
