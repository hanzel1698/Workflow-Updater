/** "Export PDF" name prompt. Ported from android/.../ui/main/ExportPdfNameDialog.kt. */

import { ALL_PROFILE_ID } from '../config.js';
import { el } from './dom.js';
import { openDialog } from './dialog.js';

export function showExportPdfNameDialog({ designation, onConfirm }) {
  const profileHint =
    designation === ALL_PROFILE_ID ? 'Report covers all RDO KKD engineers.' : `Profile: ${designation}`;

  const input = el('input', {
    className: 'text-input',
    attrs: {
      type: 'text',
      id: 'export-engineer-name',
      placeholder: 'e.g. Hanzel H. Fernandez',
      autocomplete: 'name',
      'aria-label': "Engineer's name",
    },
  });

  const body = el('div', { className: 'export-dialog-body' }, [
    el('p', {
      className: 'dialog-text',
      text: `Enter your name for the report title and file name. ${profileHint}`,
    }),
    el('label', { className: 'text-field-label', text: "Engineer's name", attrs: { for: 'export-engineer-name' } }),
    input,
  ]);

  let confirmButton;

  const dialog = openDialog({
    title: 'Export PDF',
    body,
    actions: (close) => {
      const cancel = el('button', {
        className: 'text-btn',
        text: 'Cancel',
        attrs: { type: 'button' },
        on: { click: close },
      });
      confirmButton = el('button', {
        className: 'text-btn primary',
        text: 'Export',
        attrs: { type: 'button', disabled: 'true' },
        on: {
          click: () => {
            const name = input.value.trim();
            if (name === '') return;
            close();
            onConfirm(name);
          },
        },
      });
      return [cancel, confirmButton];
    },
  });

  const syncValidity = () => {
    const valid = input.value.trim() !== '';
    confirmButton.disabled = !valid;
    input.classList.toggle('invalid', input.value !== '' && !valid);
  };

  input.addEventListener('input', syncValidity);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && input.value.trim() !== '') confirmButton.click();
  });
  syncValidity();

  return dialog;
}
