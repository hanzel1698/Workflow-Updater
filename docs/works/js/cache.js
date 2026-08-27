/**
 * Persists the latest live sheet rows so the app can show real data after a reload or when the
 * device has no internet. One shared snapshot covers every engineer profile — filtering still
 * happens at read time. Web counterpart of android/.../data/WorksLocalCache.kt.
 */

const CACHE_KEY = 'workflow_updater.sheet_snapshot';

export const WorksLocalCache = {
  /** @param {Array<Object>} rows @param {number} syncedAtMillis */
  save(rows, syncedAtMillis) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({ syncedAtMillis, rows }));
    } catch (error) {
      // Quota exceeded or site data disabled — the app falls back to a network-only session.
      console.warn('Failed to persist offline sheet cache', error);
    }
  },

  /** @returns {{syncedAtMillis: number, rows: Array<Object>}|null} */
  load() {
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const snapshot = JSON.parse(raw);
      if (!snapshot || !Array.isArray(snapshot.rows)) return null;
      return { syncedAtMillis: Number(snapshot.syncedAtMillis) || 0, rows: snapshot.rows };
    } catch (error) {
      console.warn('Failed to read offline sheet cache', error);
      return null;
    }
  },
};
