/** Modal bottom sheet shell, the web counterpart of Material 3's `ModalBottomSheet`. */

import { el } from './dom.js';

export function openBottomSheet({ title, subtitle, body, footer, onDismiss }) {
  const scrim = el('div', { className: 'scrim' });
  const panel = el('div', {
    className: 'bottom-sheet',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
  });

  panel.append(
    el('div', { className: 'sheet-handle', attrs: { 'aria-hidden': 'true' } }),
    el('h2', { className: 'sheet-title', text: title }),
  );
  if (subtitle) panel.append(el('p', { className: 'sheet-subtitle', text: subtitle }));
  panel.append(el('div', { className: 'sheet-body' }, [body]));
  if (footer) panel.append(footer);

  const root = el('div', { className: 'sheet-root' }, [scrim, panel]);
  document.body.append(root);
  document.body.classList.add('modal-open');

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    root.classList.add('closing');
    document.removeEventListener('keydown', onKeydown);
    setTimeout(() => {
      root.remove();
      if (!document.querySelector('.sheet-root, .dialog-root')) document.body.classList.remove('modal-open');
    }, 200);
    if (onDismiss) onDismiss();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') close();
  }

  scrim.addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);
  requestAnimationFrame(() => root.classList.add('open'));

  const focusable = panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable) focusable.focus();

  return { close, panel };
}
