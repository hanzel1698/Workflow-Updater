/**
 * Desktop-PC detection, so the phone-shaped layout can open out and use the whole window.
 *
 * "Desktop PC" here means a mouse-driven machine with a window wide enough to be worth
 * spreading into — not merely a big screen. A tablet held in landscape reports a coarse
 * pointer and keeps the compact layout, and iPadOS is caught by the same check even though
 * Safari sends a Mac user-agent string.
 *
 * The result is stamped on <html> as `data-device`; styles.css keys the desktop layout off it.
 */

/** Below this width the compact (phone) layout is the better use of the space, PC or not. */
export const DESKTOP_MIN_WIDTH = 900;

const POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/**
 * The decision itself, kept free of the browser so it can be tested. `finePointer` is `null`
 * when the browser cannot answer the pointer media query at all.
 */
export function isDesktopEnvironment({
  viewportWidth = 0,
  finePointer = null,
  mobileHint = null,
  maxTouchPoints = 0,
} = {}) {
  // Chromium tells us outright; nothing else can overrule it.
  if (mobileHint === true) return false;
  if (viewportWidth < DESKTOP_MIN_WIDTH) return false;
  // No pointer media queries (pre-2015 browsers): a window this wide with no touch digitizer
  // is a PC.
  if (finePointer === null) return maxTouchPoints === 0;
  return finePointer;
}

/** Reads the signals above off a window. */
export function readEnvironment(view = window) {
  const nav = view.navigator || {};
  const query = typeof view.matchMedia === 'function' ? view.matchMedia(POINTER_QUERY) : null;
  return {
    viewportWidth: view.innerWidth || 0,
    finePointer: query ? query.matches : null,
    mobileHint: nav.userAgentData ? nav.userAgentData.mobile : null,
    maxTouchPoints: nav.maxTouchPoints || 0,
  };
}

/**
 * Stamps `data-device="desktop"` or `"compact"` on <html> and keeps it current: shrinking a
 * window to a phone-sized column brings the compact layout back, and dragging it to another
 * display re-runs the check.
 */
export function applyDesktopLayout(view = window) {
  const root = view.document.documentElement;

  const update = () => {
    root.dataset.device = isDesktopEnvironment(readEnvironment(view)) ? 'desktop' : 'compact';
  };

  update();
  view.addEventListener('resize', update, { passive: true });

  const query = typeof view.matchMedia === 'function' ? view.matchMedia(POINTER_QUERY) : null;
  if (query) {
    // Safari before 14 only has the deprecated listener API.
    if (query.addEventListener) query.addEventListener('change', update);
    else if (query.addListener) query.addListener(update);
  }

  return update;
}
