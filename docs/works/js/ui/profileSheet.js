/** Engineer profile bottom sheet. Ported from android/.../ui/main/ProfileSheet.kt. */

import { DESIGN_OFFICE, isAllProfile, selectableProfiles } from '../config.js';
import { el, iconButton } from './dom.js';
import { Icons } from './icons.js';
import { openBottomSheet } from './sheet.js';

export function profileDisplayName(profile) {
  return isAllProfile(profile) ? 'All engineers' : profile.name;
}

export function profileSubtitle(profile) {
  if (isAllProfile(profile)) return `All works at ${DESIGN_OFFICE}`;
  return profile.email || null;
}

export function profileAvatar(profile) {
  return el('span', { className: 'profile-avatar', text: isAllProfile(profile) ? 'All' : profile.id.slice(0, 2) });
}

export function showProfileSheet({ state, onSelect, onSetDefault }) {
  const body = el('div', { className: 'profile-list' });
  const profiles = selectableProfiles();

  const render = (defaultProfileId) => {
    body.replaceChildren(
      ...profiles.map((profile) => {
        const isActive = profile.id === state.activeProfile.id;
        const isDefault = profile.id === defaultProfileId;

        const nameRow = el('div', { className: 'profile-name-row' }, [
          el('span', { className: 'profile-name', text: profileDisplayName(profile) }),
          isDefault ? el('span', { className: 'profile-default-tag', text: 'Default' }) : null,
        ]);

        const subtitle = profileSubtitle(profile);
        const info = el('div', { className: 'profile-info' }, [
          nameRow,
          subtitle ? el('span', { className: 'profile-subtitle', text: subtitle }) : null,
        ]);

        const selectArea = el('button', {
          className: 'profile-select',
          attrs: { type: 'button', 'aria-label': `View works for ${profileDisplayName(profile)}` },
          on: {
            click: () => {
              onSelect(profile);
              sheet.close();
            },
          },
        }, [profileAvatar(profile), info]);

        const starButton = iconButton(isDefault ? Icons.star() : Icons.starOutline(), {
          label: isDefault ? 'Default profile' : 'Set as default profile',
          className: isDefault ? 'star-btn active' : 'star-btn',
          onClick: () => {
            onSetDefault(profile);
            render(profile.id);
          },
        });

        return el('div', { className: `profile-row${isActive ? ' active' : ''}` }, [
          selectArea,
          el('div', { className: 'profile-actions' }, [
            starButton,
            isActive
              ? el('span', { className: 'profile-check', html: Icons.check(), attrs: { title: 'Active profile' } })
              : el('span', { className: 'profile-check-spacer' }),
          ]),
        ]);
      }),
    );
  };

  render(state.defaultProfileId);

  const sheet = openBottomSheet({
    title: 'Switch engineer profile',
    subtitle: `View works at ${DESIGN_OFFICE} for one engineer or all engineers.`,
    body,
  });

  return sheet;
}
