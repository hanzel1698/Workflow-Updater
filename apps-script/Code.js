/**
 * Workflow Updater - Google Apps Script backend (read-only, served from a snapshot)
 *
 * Reading the workflow sheet takes Apps Script 15-80 s, far too long to make someone wait for
 * every time the app opens. So the slow read happens in the background instead: every 15 minutes
 * refreshSnapshot checks whether the sheet has been edited, and only if it has, reads it once and
 * saves the response as a JSON file in this account's Drive. doGet just hands that file back, so
 * the app gets its rows in a few seconds, at most ~15 minutes old. The app's refresh button asks
 * for ?refresh=1, which re-reads the sheet straight away if it was edited since the snapshot.
 *
 * The response is the same { success, headers, rows } the apps have always read, plus snapshotAt
 * (when the sheet was read) and checkedAt (when the copy was last confirmed to match the sheet:
 * its read, or a later check that found no edit). Nothing here writes to the sheet.
 *
 * SETUP (standalone project at script.google.com, signed in as ad.rdokkd@gmail.com):
 * 1. Paste this entire file into Code.gs, replacing what is there.
 * 2. Pick "setup" in the function menu, Run, and approve the permissions it asks for. It saves
 *    the first snapshot and installs the 15-minute trigger. Running it again is harmless.
 * 3. Deploy > Manage deployments > select the existing Web app > Edit (pencil) >
 *    Version: New version > Deploy. Keep "Execute as: Me" and "Who has access: Anyone".
 *    Do NOT use "New deployment": that gets a new URL, and SCRIPT_URL in docs/works/js/config.js
 *    (and any phone still running the old Android app) only knows this one.
 */

var SPREADSHEET_ID = "1tDBZGfYmtEQLwepDHDVwd2pAT_-qvIoJxVYG8Ub6vI8";
var SHEET_NAME = "WORKFLOW MONITORING SHEET";
var SNAPSHOT_FILE_NAME = "Workflow Updater - sheet snapshot.json";

// Apps Script only accepts 1, 5, 10, 15 or 30. Free accounts get 90 min of trigger runtime a day,
// so a full read on every tick would not fit; the edit check below keeps most ticks to a second.
var REFRESH_EVERY_MINUTES = 15;
// Rebuilt this often even when Drive reports no edit, so values that change without an edit
// (formulas like TODAY() or IMPORTRANGE) cannot leave the snapshot stale for long.
var MAX_SNAPSHOT_AGE_MS = 6 * 60 * 60 * 1000;
// How long a refresh waits for a read already under way. The web app gives up after 90 s.
var LOCK_WAIT_MS = 80 * 1000;

var PROP_FILE_ID = "SNAPSHOT_FILE_ID";
var PROP_SOURCE_UPDATED = "SNAPSHOT_SOURCE_UPDATED_MS";
var PROP_SNAPSHOT_AT = "SNAPSHOT_AT_MS";
var PROP_CHECKED_AT = "SNAPSHOT_CHECKED_AT_MS";

var HEADER_MARKERS = ["e-Office File Number", "Name of Work"];

/** Run once from the editor: saves the first snapshot and installs the refresh trigger. */
function setup() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "refreshSnapshot") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("refreshSnapshot").timeBased().everyMinutes(REFRESH_EVERY_MINUTES).create();

  saveSnapshot_();
  Logger.log('Saved "' + SNAPSHOT_FILE_NAME + '" to My Drive; it refreshes every ' +
    REFRESH_EVERY_MINUTES + " minutes. Now redeploy the Web app as a new version.");
}

/** Time-driven trigger: re-reads the sheet only when it changed since the last snapshot. */
function refreshSnapshot() {
  refreshIfChanged_();
}

/**
 * Serves the saved snapshot. With ?refresh=1 (the app's refresh button) it first re-reads the
 * sheet if it was edited since the snapshot, so a fresh edit can be exported right away; that one
 * request then takes as long as a full read. Builds a snapshot here only if none exists yet.
 */
function doGet(e) {
  try {
    var json = e && e.parameter && e.parameter.refresh === "1" ? refreshIfChanged_() : null;
    if (!json) {
      var file = snapshotFile_();
      json = file ? file.getBlob().getDataAsString() : saveSnapshot_();
    }
    return ContentService.createTextOutput(withCheckedAt_(json)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return jsonResponse_({ success: false, error: error.toString() });
  }
}

/** Writes were retired; answers any leftover copy of the editable dashboard plainly. */
function doPost() {
  return jsonResponse_({ success: false, error: "The app is read-only now. Edit the Google Sheet directly." });
}

/**
 * Re-reads the sheet if it was edited since the snapshot, or the snapshot is old or missing.
 * Returns the new snapshot's JSON, or null when the saved one is still current (or another read
 * outlasted the wait). Holds the script lock, so a refresh and the trigger never read the sheet
 * twice over: whoever comes second waits, then finds the snapshot already current.
 */
function refreshIfChanged_() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) return null;
  try {
    var props = PropertiesService.getScriptProperties();
    var sourceUpdated = sheetLastUpdated_();
    var unchanged = sourceUpdated === Number(props.getProperty(PROP_SOURCE_UPDATED));
    var recent = Date.now() - Number(props.getProperty(PROP_SNAPSHOT_AT)) < MAX_SNAPSHOT_AGE_MS;
    if (unchanged && recent && snapshotFile_()) {
      props.setProperty(PROP_CHECKED_AT, String(Date.now()));
      return null;
    }
    return saveSnapshot_(sourceUpdated);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Reads the sheet, saves the response to the snapshot file and returns it. `sourceUpdated` must be
 * taken before the read, so an edit made while it runs is caught by the next refresh.
 */
function saveSnapshot_(sourceUpdated) {
  if (sourceUpdated === undefined) sourceUpdated = sheetLastUpdated_();
  var payload = buildPayload_();
  var json = asciiJson_(payload);

  var file = snapshotFile_();
  if (file) {
    file.setContent(json);
  } else {
    file = DriveApp.createFile(SNAPSHOT_FILE_NAME, json, "application/json");
  }

  var saved = {};
  saved[PROP_FILE_ID] = file.getId();
  saved[PROP_SOURCE_UPDATED] = String(sourceUpdated);
  saved[PROP_SNAPSHOT_AT] = String(Date.parse(payload.snapshotAt));
  saved[PROP_CHECKED_AT] = saved[PROP_SNAPSHOT_AT];
  PropertiesService.getScriptProperties().setProperties(saved);
  return json;
}

/** Adds checkedAt to the saved JSON, which always ends with the "}" of its top-level object. */
function withCheckedAt_(json) {
  var checkedAt = Number(PropertiesService.getScriptProperties().getProperty(PROP_CHECKED_AT));
  if (!checkedAt) return json;
  return json.slice(0, -1) + ',"checkedAt":"' + new Date(checkedAt).toISOString() + '"}';
}

function sheetLastUpdated_() {
  return DriveApp.getFileById(SPREADSHEET_ID).getLastUpdated().getTime();
}

/** The snapshot file, or null if it was never made or has since been deleted or trashed. */
function snapshotFile_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_FILE_ID);
  if (!id) return null;
  try {
    var file = DriveApp.getFileById(id);
    return file.isTrashed() ? null : file;
  } catch (error) {
    return null;
  }
}

/** Every workflow row with a Name of Work, keyed by header, plus its 1-based sheet row. */
function buildPayload_() {
  var snapshotAt = new Date().toISOString();
  var sheet = findWorkflowSheet_(SpreadsheetApp.openById(SPREADSHEET_ID));
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) {
    return { success: true, headers: [], rows: [], snapshotAt: snapshotAt };
  }

  var headerRowIndex = findHeaderRowIndex_(data);
  var headers = data[headerRowIndex].map(function(h) { return h.toString().trim(); });

  var rows = [];
  for (var i = headerRowIndex + 1; i < data.length; i++) {
    if (!isPopulatedDataRow_(data[i], headers)) continue;

    var row = { _rowNum: i + 1 };
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) row[headers[j]] = data[i][j] !== undefined ? data[i][j] : "";
    }
    rows.push(row);
  }

  return { success: true, headers: headers, rows: rows, snapshotAt: snapshotAt };
}

/** The named tab, else the first non-"OLD" tab with a header row in its first 10 rows. */
function findWorkflowSheet_(ss) {
  var named = ss.getSheetByName(SHEET_NAME);
  if (named) return named;

  var sheets = ss.getSheets();
  for (var k = 0; k < sheets.length; k++) {
    if (sheets[k].getName().toUpperCase().indexOf("OLD") !== -1) continue;
    var data = sheets[k].getDataRange().getValues();
    for (var i = 0; i < Math.min(data.length, 10); i++) {
      if (isHeaderRow_(data[i])) return sheets[k];
    }
  }
  return ss.getSheets()[0];
}

function isHeaderRow_(row) {
  return HEADER_MARKERS.some(function(marker) { return row.indexOf(marker) !== -1; });
}

function findHeaderRowIndex_(data) {
  for (var i = 0; i < data.length; i++) {
    if (isHeaderRow_(data[i])) return i;
  }
  return 0;
}

// A row counts only when Name of Work is filled: formatted table rows carry FALSE or other
// defaults in their remaining columns.
function isPopulatedDataRow_(row, headers) {
  var workNameIdx = headers.indexOf("Name of Work");
  if (workNameIdx === -1) workNameIdx = headers.indexOf("Work Name");
  if (workNameIdx !== -1) {
    var workName = row[workNameIdx];
    return workName !== undefined && workName !== null && workName.toString().trim() !== "";
  }
  return row.join("").trim() !== "";
}

// Non-ASCII characters are written as \u escapes, so the saved file reads back identically
// whatever character set Drive stores it in.
function asciiJson_(object) {
  return JSON.stringify(object).replace(/[\u007f-\uffff]/g, function(c) {
    return "\\u" + ("000" + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

function jsonResponse_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(ContentService.MimeType.JSON);
}
