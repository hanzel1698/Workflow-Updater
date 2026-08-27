/** Touch pull-to-refresh for the works list, matching Material 3's `PullToRefreshBox`. */

const TRIGGER_PX = 72;
const MAX_PULL_PX = 110;

export function attachPullToRefresh(scrollArea, onRefresh) {
  let startY = null;
  let pull = 0;

  scrollArea.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length !== 1 || scrollArea.scrollTop > 0) {
        startY = null;
        return;
      }
      startY = event.touches[0].clientY;
      pull = 0;
    },
    { passive: true },
  );

  scrollArea.addEventListener(
    'touchmove',
    (event) => {
      if (startY === null) return;
      const delta = event.touches[0].clientY - startY;
      if (delta <= 0) {
        reset();
        return;
      }
      pull = Math.min(delta * 0.5, MAX_PULL_PX);
      scrollArea.style.transform = `translateY(${pull}px)`;
      scrollArea.classList.toggle('pull-armed', pull >= TRIGGER_PX);
    },
    { passive: true },
  );

  const finish = () => {
    if (startY === null) return;
    const shouldRefresh = pull >= TRIGGER_PX;
    reset();
    if (shouldRefresh) onRefresh();
  };

  function reset() {
    startY = null;
    pull = 0;
    scrollArea.style.transform = '';
    scrollArea.classList.remove('pull-armed');
  }

  scrollArea.addEventListener('touchend', finish, { passive: true });
  scrollArea.addEventListener('touchcancel', reset, { passive: true });
}
