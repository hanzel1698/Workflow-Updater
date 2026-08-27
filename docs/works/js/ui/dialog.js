/** Centered modal dialog, the web counterpart of Material 3's `AlertDialog`. */

import { el } from './dom.js';

export function openDialog({ title, body, actions, onDismiss }) {
  const scrim = el('div', { className: 'scrim' });
  const panel = el('div', {
    className: 'dialog',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
  });

  panel.append(el('h2', { className: 'dialog-title', text: title }), el('div', { className: 'dialog-body' }, [body]));

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeydown);
    root.remove();
    if (!document.querySelector('.sheet-root, .dialog-root')) document.body.classList.remove('modal-open');
    if (onDismiss) onDismiss();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') close();
  }

  panel.append(el('div', { className: 'dialog-actions' }, actions(close)));

  const root = el('div', { className: 'dialog-root' }, [scrim, panel]);
  document.body.append(root);
  document.body.classList.add('modal-open');
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', onKeydown);
  requestAnimationFrame(() => root.classList.add('open'));

  const focusable = panel.querySelector('input, button');
  if (focusable) focusable.focus();

  return { close, panel };
}
