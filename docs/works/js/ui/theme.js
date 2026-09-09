/**
 * Dark / light theme.
 *
 * With no stored choice the app follows the operating system, which is what it has always done;
 * the app bar's button overrides that and writes the choice down. The key is shared with the
 * editable dashboard at /app/ — both are served from the same origin, so picking light in one
 * picks it in the other, and the two apps never disagree about which theme this device is on.
 *
 * The stored value is *applied* by a two-line gate in index.html, early enough that a light-theme
 * user never sees a dark flash. This module owns the key and the button.
 */

import { el } from './dom.js';
import { Icons } from './icons.js';

export const THEME_KEY = 'wu.theme';

function storedTheme() {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch (err) {
    return null; // private mode — the system preference still applies
  }
}

function systemTheme() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

/** The theme now in force, whether it was chosen or inherited from the system. */
export function currentTheme() {
  return document.documentElement.dataset.theme || storedTheme() || systemTheme();
}

/** Applies a stored choice. Safe to call twice — index.html's gate has usually done it already. */
export function applyStoredTheme() {
  const stored = storedTheme();
  if (stored) document.documentElement.dataset.theme = stored;
}

/**
 * The app bar's theme button. Clicking always sets an explicit theme: once you have expressed a
 * preference, the system stops overruling it.
 */
export function createThemeToggle() {
  const button = el('button', {
    className: 'icon-btn theme-btn',
    attrs: { type: 'button' },
    on: {
      click: () => {
        const next = currentTheme() === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        try {
          window.localStorage.setItem(THEME_KEY, next);
        } catch (err) {
          /* private mode — the theme still applies for this session */
        }
        label();
      },
    },
  });

  // Both glyphs live in the button; styles.css shows whichever the resolved theme calls for.
  button.innerHTML = `<span class="icon-sun">${Icons.lightMode()}</span><span class="icon-moon">${Icons.darkMode()}</span>`;

  function label() {
    const to = currentTheme() === 'light' ? 'dark' : 'light';
    button.setAttribute('aria-label', `Switch to the ${to} theme`);
    button.setAttribute('title', `Switch to the ${to} theme`);
  }

  label();
  return button;
}
