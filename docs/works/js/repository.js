/**
 * Talks to the same Google Apps Script Web App the Android and Windows clients use
 * (see windows/google_apps_script.js), then filters rows down to the active engineer profile.
 * Ported from android/.../data/SheetsRemoteDataSource.kt and WorkflowRepository.kt.
 */

import {
  Columns,
  DESIGN_OFFICE,
  ENGINEER_PROFILE_IDS,
  MOCK_ROWS,
  SCRIPT_URL,
  SHEET_NAME,
  SPREADSHEET_ID,
  isAllProfile,
} from './config.js';
import { createWorkItem, rowValue } from './model.js';
import { WorksLocalCache } from './cache.js';

// Apps Script needs 15-80 s to hand back a 1 MB sheet, so a short timeout aborts reads that
// would have succeeded.
const FETCH_TIMEOUT_MS = 90000;
// Waits before each retry of a transient failure (network drop, Google's HTML error page).
const RETRY_DELAYS_MS = [1500, 4000, 8000];
// A copy synced this recently is shown as-is instead of waiting on the sheet again.
const FRESH_WINDOW_MS = 30 * 1000;

function buildUrl(scriptUrl) {
  const separator = scriptUrl.includes('?') ? '&' : '?';
  return `${scriptUrl}${separator}sheet=${encodeURIComponent(SHEET_NAME)}&spreadsheetId=${encodeURIComponent(
    SPREADSHEET_ID,
  )}`;
}

/** @returns {Promise<{headers: string[], rows: Array<Object>}>} */
async function fetchSheet(scriptUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(buildUrl(scriptUrl), { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (!json || json.success !== true) throw new Error((json && json.error) || 'Unknown server error');
    return {
      headers: Array.isArray(json.headers) ? json.headers : [],
      rows: Array.isArray(json.rows) ? json.rows.map(toStringMap) : [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function toStringMap(row) {
  const map = {};
  for (const [key, value] of Object.entries(row || {})) {
    map[key] = value === null || value === undefined ? '' : String(value);
  }
  return map;
}

/** Filters sheet rows to RDO KKD works for one engineer or all configured engineers. */
export function filterRowsForProfile(rows, profile) {
  const targetOffice = DESIGN_OFFICE.toLowerCase();
  const allowedAseIds = isAllProfile(profile)
    ? new Set([...ENGINEER_PROFILE_IDS].map((id) => id.toLowerCase()))
    : new Set([profile.id.toLowerCase()]);

  return rows
    .filter((row) => {
      const office = rowValue(row, Columns.DESIGN_OFFICE).toLowerCase();
      const ase = rowValue(row, Columns.ASE).toLowerCase().trim();
      return office.includes(targetOffice) && allowedAseIds.has(ase);
    })
    .map(createWorkItem);
}

/**
 * Outcome of a load attempt: the resolved list of works plus whether we had to fall back to
 * cached or offline sample data because the live sheet couldn't be reached.
 */
export function createRepository({
  remote = fetchSheet,
  localCache = WorksLocalCache,
  retryDelays = RETRY_DELAYS_MS,
  freshWindowMs = FRESH_WINDOW_MS,
} = {}) {
  let lastGoodRows = null;
  let inflight = null;
  let lastSyncedAtMillis = null;
  let diskWarmed = false;

  function rememberRows(rows, syncedAtMillis) {
    lastGoodRows = rows;
    lastSyncedAtMillis = syncedAtMillis;
  }

  function memoryOrDiskRows() {
    if (lastGoodRows) return lastGoodRows;
    if (diskWarmed || !localCache) return null;
    diskWarmed = true;
    const snapshot = localCache.load();
    if (!snapshot) return null;
    rememberRows(snapshot.rows, snapshot.syncedAtMillis);
    return snapshot.rows;
  }

  return {
    /** Instantly returns the last good data from memory/storage (no network). */
    loadCachedWorks(profile) {
      const rows = memoryOrDiskRows();
      if (!rows) return null;
      return {
        works: filterRowsForProfile(rows, profile),
        isOffline: true,
        isSample: false,
        errorMessage: null,
        lastSyncedAtMillis,
      };
    },

    /**
     * Fetches the live sheet, persisting success; falls back to cache then sample on failure.
     * A copy synced within the last 30 s is reused unless `force` is set (manual refresh), and
     * overlapping loads share one request, since each one costs Apps Script up to a minute.
     */
    async loadWorks(profile, { force = false } = {}) {
      const scriptUrl = (profile.scriptUrl || '').trim() || SCRIPT_URL;

      const saved = force ? null : memoryOrDiskRows();
      if (saved && lastSyncedAtMillis && Date.now() - lastSyncedAtMillis < freshWindowMs) {
        return {
          works: filterRowsForProfile(saved, profile),
          isOffline: false,
          errorMessage: null,
          lastSyncedAtMillis,
        };
      }

      let response = null;
      let failure = null;
      try {
        if (!inflight) {
          inflight = fetchWithRetry(remote, scriptUrl, retryDelays).finally(() => {
            inflight = null;
          });
        }
        response = await inflight;
      } catch (error) {
        failure = error;
      }

      if (response) {
        const syncedAt = Date.now();
        rememberRows(response.rows, syncedAt);
        if (localCache) localCache.save(response.rows, syncedAt);
        return {
          works: filterRowsForProfile(response.rows, profile),
          isOffline: false,
          errorMessage: null,
          lastSyncedAtMillis: syncedAt,
        };
      }

      const cachedRows = memoryOrDiskRows();
      if (cachedRows) {
        return {
          works: filterRowsForProfile(cachedRows, profile),
          isOffline: true,
          isSample: false,
          errorMessage: describeFailure(failure),
          lastSyncedAtMillis,
        };
      }

      return {
        works: filterRowsForProfile(MOCK_ROWS, profile),
        isOffline: true,
        isSample: true,
        errorMessage: describeFailure(failure) || 'Could not reach the live sheet',
        lastSyncedAtMillis: null,
      };
    },
  };
}

/**
 * Apps Script is slow and now and then answers a valid request with a transient Google error
 * page or a dropped connection. Retry those with a growing delay before giving up on the live
 * sheet; a timeout is not retried, as it has already cost the full wait.
 */
async function fetchWithRetry(remote, scriptUrl, delays) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await remote(scriptUrl);
    } catch (error) {
      const retryable = error && error.name !== 'AbortError' && !/^HTTP 40[13]/.test(error.message || '');
      if (!retryable || attempt >= delays.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}

/**
 * Browsers report a blocked or unreachable cross-origin request as a bare
 * "TypeError: Failed to fetch", which tells the user nothing. Translate the cases we can
 * recognise into something they can act on, and pass anything else through verbatim.
 */
function describeFailure(error) {
  if (!error) return null;
  if (error.name === 'AbortError') return 'The live sheet took too long to respond';
  const message = error.message || '';
  if (error.name === 'TypeError' || /failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Could not reach script.google.com — check the connection, or whether the network blocks it';
  }
  if (/^HTTP 401|^HTTP 403/.test(message)) {
    return `${message} — the Apps Script Web App is not shared with "Anyone"`;
  }
  return message || 'Could not reach the live sheet';
}
