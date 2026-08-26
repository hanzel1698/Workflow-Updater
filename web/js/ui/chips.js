/**
 * Horizontally scrollable KPI chips, mirroring the stats grid on the desktop dashboard.
 * Tapping a chip toggles it as the active status filter. Press and drag (long-press on touch)
 * to reorder status chips; the custom order is persisted. Only statuses present in the current
 * filtered pool are shown. The "All works" chip stays fixed at the start.
 *
 * Ported from android/.../ui/main/StatChipsRow.kt.
 */

import { STATUS_SHORT_LABELS } from '../config.js';
import { move, normalize } from '../chipOrder.js';
import { clear, el, iconButton } from './dom.js';
import { Icons } from './icons.js';
import { statusTone } from './statusTone.js';

const TOUCH_HOLD_MS = 350;
const DRAG_THRESHOLD_PX = 6;

export function createStatChipsRow({ onChipClick, onStatusOrderChange, onClearAllFilters }) {
  const scroller = el('div', { className: 'chips-scroller', attrs: { role: 'group', 'aria-label': 'Design status filters' } });
  const clearButton = iconButton(Icons.filterAltOff(), {
    label: 'Clear all filters',
    className: 'clear-filters-btn',
    onClick: onClearAllFilters,
  });
  const root = el('div', { className: 'chips-row' }, [scroller, clearButton]);

  let dragState = null;
  let suppressClick = false;

  function commitOrder() {
    const codes = [...scroller.querySelectorAll('.stat-chip[data-code]')].map((chip) => chip.dataset.code);
    onStatusOrderChange(codes);
  }

  function beginDrag(chip, event) {
    const rect = chip.getBoundingClientRect();
    const placeholder = el('div', { className: 'chip-placeholder' });
    placeholder.style.width = `${rect.width}px`;
    placeholder.style.height = `${rect.height}px`;
    chip.after(placeholder);

    chip.classList.add('dragging');
    chip.style.width = `${rect.width}px`;
    chip.style.height = `${rect.height}px`;
    chip.style.left = `${rect.left}px`;
    chip.style.top = `${rect.top}px`;

    dragState = { chip, placeholder, grabX: event.clientX - rect.left, grabY: event.clientY - rect.top, moved: false };
    if (navigator.vibrate) navigator.vibrate(10);
    updateDrag(event);
  }

  function updateDrag(event) {
    if (!dragState) return;
    const { chip, placeholder } = dragState;
    chip.style.left = `${event.clientX - dragState.grabX}px`;
    chip.style.top = `${event.clientY - dragState.grabY}px`;

    // Walk the other chips and move the placeholder across whichever one the pointer has passed.
    // `a.compareDocumentPosition(b)` describes where b sits relative to a.
    const siblings = [...scroller.querySelectorAll('.stat-chip[data-code]')].filter((node) => node !== chip);
    for (const sibling of siblings) {
      const rect = sibling.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      const position = sibling.compareDocumentPosition(placeholder);
      const placeholderIsAfter = Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING);
      const placeholderIsBefore = Boolean(position & Node.DOCUMENT_POSITION_PRECEDING);

      if (event.clientX < midpoint && placeholderIsAfter) {
        sibling.before(placeholder);
        return;
      }
      if (event.clientX > midpoint && placeholderIsBefore) {
        sibling.after(placeholder);
        return;
      }
    }
  }

  function endDrag() {
    if (!dragState) return;
    const { chip, placeholder, moved } = dragState;
    placeholder.replaceWith(chip);
    chip.classList.remove('dragging');
    chip.removeAttribute('style');
    dragState = null;
    if (moved) {
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
      commitOrder();
    }
  }

  function attachDragHandlers(chip) {
    let holdTimer = null;
    let pending = null;

    const cancelPending = () => {
      clearTimeout(holdTimer);
      holdTimer = null;
      pending = null;
    };

    chip.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      pending = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, event };
      if (event.pointerType === 'touch') {
        // Touch needs a hold first, otherwise the gesture would fight horizontal scrolling.
        holdTimer = setTimeout(() => {
          if (!pending) return;
          chip.setPointerCapture(event.pointerId);
          beginDrag(chip, pending.event);
          pending = null;
        }, TOUCH_HOLD_MS);
      }
    });

    chip.addEventListener('pointermove', (event) => {
      if (dragState && dragState.chip === chip) {
        event.preventDefault();
        dragState.moved = true;
        updateDrag(event);
        return;
      }
      if (!pending) return;
      const dx = Math.abs(event.clientX - pending.x);
      const dy = Math.abs(event.clientY - pending.y);
      if (event.pointerType === 'touch') {
        if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) cancelPending();
        return;
      }
      if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
        chip.setPointerCapture(event.pointerId);
        beginDrag(chip, event);
        pending = null;
      }
    });

    const finish = () => {
      cancelPending();
      endDrag();
    };
    chip.addEventListener('pointerup', finish);
    chip.addEventListener('pointercancel', finish);
    chip.addEventListener('lostpointercapture', finish);

    // Keyboard reordering, so the persisted order is reachable without a pointer.
    chip.addEventListener('keydown', (event) => {
      if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
      event.preventDefault();
      const codes = [...scroller.querySelectorAll('.stat-chip[data-code]')].map((node) => node.dataset.code);
      const from = codes.indexOf(chip.dataset.code);
      const to = event.key === 'ArrowLeft' ? from - 1 : from + 1;
      if (to < 0 || to >= codes.length) return;
      onStatusOrderChange(move(codes, from, to));
      requestAnimationFrame(() => {
        const moved = scroller.querySelector(`.stat-chip[data-code="${chip.dataset.code}"]`);
        if (moved) moved.focus();
      });
    });
  }

  function render(state) {
    const total = Object.values(state.statusCounts).reduce((sum, count) => sum + count, 0);
    const visibleOrder = normalize(state.statusChipOrder).filter((code) => (state.statusCounts[code] || 0) > 0);

    clear(scroller);

    if (total > 0) {
      scroller.append(
        statChip({
          label: 'All works',
          count: total,
          selected: state.filters.statusCode === null,
          onClick: () => onChipClick(null),
        }),
      );
    }

    for (const code of visibleOrder) {
      const chip = statChip({
        label: STATUS_SHORT_LABELS[code] || code,
        count: state.statusCounts[code] || 0,
        selected: state.filters.statusCode === code,
        code,
        onClick: () => onChipClick(code),
      });
      attachDragHandlers(chip);
      scroller.append(chip);
    }

    clearButton.hidden = !state.hasAnyFilter;
  }

  function statChip({ label, count, selected, code, onClick }) {
    const chip = el('button', {
      className: 'stat-chip',
      attrs: {
        type: 'button',
        'aria-pressed': String(selected),
        ...(code
          ? { 'aria-label': `${label}, ${count} works. Design status ${code}. Hold and drag, or Alt plus arrow keys, to reorder.` }
          : { 'aria-label': `${label}, ${count} works` }),
      },
      on: {
        click: () => {
          if (suppressClick) return;
          onClick();
        },
      },
    }, [el('span', { className: 'stat-chip-count', text: String(count) }), el('span', { className: 'stat-chip-label', text: label })]);

    if (selected) chip.classList.add('selected');
    if (code) {
      chip.dataset.code = code;
      chip.dataset.tone = statusTone(code);
      chip.classList.add('draggable');
    }
    return chip;
  }

  return { root, render };
}

/** Info chip shown below design-status chips when any filter is active. */
export function createFilterResultChip() {
  const label = el('span', { className: 'filter-result-count' });
  const root = el('div', { className: 'filter-result-chip', attrs: { 'aria-live': 'polite' } }, [
    el('span', { className: 'meta-icon', html: Icons.info() }),
    label,
  ]);

  return {
    root,
    render(filteredCount, totalCount) {
      const noun = filteredCount === 1 ? 'work' : 'works';
      label.textContent =
        filteredCount === totalCount
          ? `${filteredCount} ${noun} match your filters`
          : `${filteredCount} of ${totalCount} ${noun} match your filters`;
    },
  };
}
