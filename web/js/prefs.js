/**
 * Persists engineer profile choices, chip order and release-notes "seen" state in localStorage.
 * Web counterpart of android/.../data/ProfilePrefs.kt (SharedPreferences).
 */

import { DEFAULT_PROFILE_ID } from './config.js';
import { normalize } from './chipOrder.js';

const KEY_ACTIVE_PROFILE = 'workflow_updater.active_profile_id';
const KEY_DEFAULT_PROFILE = 'workflow_updater.default_profile_id';
const KEY_DEFAULT_PROFILE_SETUP_COMPLETE = 'workflow_updater.default_profile_setup_complete';
const KEY_STATUS_CHIP_ORDER = 'workflow_updater.status_chip_order';
const KEY_LAST_SEEN_VERSION_CODE = 'workflow_updater.last_seen_version_code';

/** localStorage can throw (private mode, disabled site data) — never let that break the app. */
function readItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Preferences are a convenience; the app still works without them. */
  }
}

export const ProfilePrefs = {
  get activeProfileId() {
    return readItem(KEY_ACTIVE_PROFILE) || DEFAULT_PROFILE_ID;
  },

  set activeProfileId(value) {
    writeItem(KEY_ACTIVE_PROFILE, value);
  },

  get defaultProfileId() {
    return readItem(KEY_DEFAULT_PROFILE) || DEFAULT_PROFILE_ID;
  },

  get isDefaultProfileSetupComplete() {
    return readItem(KEY_DEFAULT_PROFILE_SETUP_COMPLETE) === 'true';
  },

  /** Persisted design-status filter chip order (two-digit codes). */
  get statusChipOrder() {
    const raw = readItem(KEY_STATUS_CHIP_ORDER);
    const saved = raw
      ? raw
          .split(',')
          .map((code) => code.trim())
          .filter((code) => code !== '')
      : null;
    return normalize(saved);
  },

  set statusChipOrder(value) {
    writeItem(KEY_STATUS_CHIP_ORDER, normalize(value).join(','));
  },

  /** Profile id used when the app opens after setup (default engineer or All). */
  launchProfileId() {
    return this.isDefaultProfileSetupComplete ? this.defaultProfileId : this.activeProfileId;
  },

  completeDefaultProfileSetup(profileId) {
    writeItem(KEY_DEFAULT_PROFILE, profileId);
    writeItem(KEY_ACTIVE_PROFILE, profileId);
    writeItem(KEY_DEFAULT_PROFILE_SETUP_COMPLETE, 'true');
  },

  setDefaultProfile(profileId) {
    writeItem(KEY_DEFAULT_PROFILE, profileId);
  },

  get lastSeenVersionCode() {
    return Number.parseInt(readItem(KEY_LAST_SEEN_VERSION_CODE) || '0', 10) || 0;
  },

  set lastSeenVersionCode(value) {
    writeItem(KEY_LAST_SEEN_VERSION_CODE, String(value));
  },
};
