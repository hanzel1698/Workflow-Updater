/**
 * Helpers for the persisted design-status filter chip order.
 * Ported from android/.../data/StatusChipOrder.kt.
 */

import { STATUS_SHORT_LABELS } from './config.js';

/** Default chip order matching `STATUS_SHORT_LABELS` insertion order (01…09). */
export function defaultOrder() {
  return Object.keys(STATUS_SHORT_LABELS);
}

/**
 * Returns a complete, de-duplicated order: saved codes first (when known), then any missing
 * canonical codes appended in their default positions.
 */
export function normalize(saved) {
  const defaults = defaultOrder();
  if (!saved || saved.length === 0) return defaults;
  const known = new Set(defaults);
  const ordered = [...new Set(saved.filter((code) => known.has(code)))];
  const orderedSet = new Set(ordered);
  const missing = defaults.filter((code) => !orderedSet.has(code));
  return [...ordered, ...missing];
}

/**
 * Applies a reorder of the currently visible chips onto the full persisted order, keeping
 * hidden (zero-count) chip slots in place.
 */
export function applyVisibleReorder(fullOrder, visibleNewOrder) {
  const normalized = normalize(fullOrder);
  if (!visibleNewOrder || visibleNewOrder.length === 0) return normalized;
  const visibleSet = new Set(visibleNewOrder);
  const visibleSlots = normalized.map((code, index) => (visibleSet.has(code) ? index : -1)).filter((i) => i >= 0);
  if (visibleSlots.length !== visibleNewOrder.length) {
    // Visibility changed mid-drag — fall back to placing the new visible order up front.
    return normalize([...visibleNewOrder, ...normalized.filter((code) => !visibleSet.has(code))]);
  }
  const result = [...normalized];
  visibleNewOrder.forEach((code, i) => {
    result[visibleSlots[i]] = code;
  });
  return result;
}

export function move(order, fromIndex, toIndex) {
  if (fromIndex === toIndex) return order;
  if (fromIndex < 0 || fromIndex >= order.length || toIndex < 0 || toIndex >= order.length) return order;
  const result = [...order];
  const [moved] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, moved);
  return result;
}
