/** Transient bottom message, the web counterpart of Android's `Toast`. */

import { el } from './dom.js';

const LONG_MS = 3500;
const SHORT_MS = 2000;

let host = null;

function ensureHost() {
  if (!host) {
    host = el('div', { className: 'toast-host', attrs: { role: 'status', 'aria-live': 'polite' } });
    document.body.append(host);
  }
  return host;
}

export function showToast(message, { long = false } = {}) {
  const node = el('div', { className: 'toast', text: message });
  ensureHost().append(node);
  requestAnimationFrame(() => node.classList.add('visible'));

  setTimeout(() => {
    node.classList.remove('visible');
    setTimeout(() => node.remove(), 250);
  }, long ? LONG_MS : SHORT_MS);
}
