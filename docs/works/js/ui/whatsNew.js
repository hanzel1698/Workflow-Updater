/**
 * One-time "What's New" screen, shown once per release.
 * Ported from android/.../releasenotes/WhatsNewScreen.kt, WhatsNewGate.kt and
 * ReleaseNotesRepository.kt (which reads the same release_notes.json shape).
 */

import { APP_VERSION_CODE } from '../config.js';
import { ProfilePrefs } from '../prefs.js';
import { el } from './dom.js';
import { Icons } from './icons.js';

const NOTES_URL = './release_notes.json';

export async function loadReleaseNotes() {
  try {
    const response = await fetch(NOTES_URL, { cache: 'no-cache' });
    if (!response.ok) return null;
    const notes = await response.json();
    if (!notes || typeof notes.versionCode !== 'number') return null;
    return { title: "What's New", features: [], ...notes };
  } catch {
    return null;
  }
}

export function shouldShowReleaseNotes(notes) {
  if (!notes || notes.versionCode <= 0 || notes.features.length === 0) return false;
  if (notes.versionCode !== APP_VERSION_CODE) return false;
  return notes.versionCode > ProfilePrefs.lastSeenVersionCode;
}

export function markReleaseNotesSeen(notes) {
  ProfilePrefs.lastSeenVersionCode = notes.versionCode;
}

export function createWhatsNewScreen({ notes, onContinue }) {
  const root = el('div', { className: 'screen gate-screen' }, [
    el('div', { className: 'gate-content' }, [
      el('span', { className: 'gate-icon', html: Icons.newReleases() }),
      el('h1', { className: 'gate-title', text: notes.title }),
      el('p', { className: 'gate-version', text: `Version ${notes.versionName}` }),
      el(
        'ul',
        { className: 'whats-new-list' },
        notes.features.map((feature) => el('li', { text: feature })),
      ),
    ]),
    el('button', {
      className: 'filled-btn block',
      text: 'Continue',
      attrs: { type: 'button' },
      on: { click: onContinue },
    }),
  ]);

  return { root };
}
