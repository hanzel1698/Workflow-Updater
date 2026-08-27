/**
 * One-time gate shown on first visit until the user picks a default engineer profile.
 * Ported from android/.../ui/main/DefaultProfileSetupScreen.kt and DefaultProfileGate.kt.
 */

import { ALL_PROFILE, DESIGN_OFFICE, selectableProfiles } from '../config.js';
import { el } from './dom.js';
import { Icons } from './icons.js';
import { profileAvatar, profileDisplayName, profileSubtitle } from './profileSheet.js';

export function createDefaultProfileSetupScreen({ onContinue }) {
  const profiles = selectableProfiles();
  let selected = ALL_PROFILE;

  const list = el('div', { className: 'setup-list', attrs: { role: 'radiogroup', 'aria-label': 'Default engineer profile' } });

  const rows = profiles.map((profile) => {
    const radio = el('span', { className: 'radio' });
    const subtitle = profileSubtitle(profile);
    const row = el('button', {
      className: `setup-row${profile.id === selected.id ? ' selected' : ''}`,
      attrs: { type: 'button', role: 'radio', 'aria-checked': String(profile.id === selected.id) },
      on: {
        click: () => {
          selected = profile;
          syncSelection();
        },
      },
    }, [
      radio,
      profileAvatar(profile),
      el('span', { className: 'profile-info' }, [
        el('span', { className: 'profile-name', text: profileDisplayName(profile) }),
        subtitle ? el('span', { className: 'profile-subtitle', text: subtitle }) : null,
      ]),
    ]);
    return { profile, row };
  });

  function syncSelection() {
    for (const { profile, row } of rows) {
      const active = profile.id === selected.id;
      row.classList.toggle('selected', active);
      row.setAttribute('aria-checked', String(active));
    }
  }

  list.append(...rows.map((entry) => entry.row));

  const root = el('div', { className: 'screen gate-screen' }, [
    el('div', { className: 'gate-content' }, [
      el('span', { className: 'gate-icon', html: Icons.engineering() }),
      el('h1', { className: 'gate-title', text: 'Choose your default view' }),
      el('p', {
        className: 'gate-text',
        text:
          `Pick the engineer profile to open with each time you launch the app. ` +
          `Choose All to see every ${DESIGN_OFFICE} engineer's works. You can change this later from the profile menu.`,
      }),
      list,
    ]),
    el('button', {
      className: 'filled-btn block',
      text: 'Continue',
      attrs: { type: 'button' },
      on: { click: () => onContinue(selected) },
    }),
  ]);

  return { root };
}
