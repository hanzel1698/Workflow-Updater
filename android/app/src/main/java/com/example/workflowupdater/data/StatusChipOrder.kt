package com.example.workflowupdater.data

/** Helpers for the persisted design-status filter chip order. */
object StatusChipOrder {

  /** Default chip order matching [SheetConfig.STATUS_SHORT_LABELS] insertion order (01…09). */
  fun default(): List<String> = SheetConfig.STATUS_SHORT_LABELS.keys.toList()

  /**
   * Returns a complete, de-duplicated order: saved codes first (when known), then any missing
   * canonical codes appended in their default positions.
   */
  fun normalize(saved: List<String>?): List<String> {
    val defaults = default()
    if (saved.isNullOrEmpty()) return defaults
    val known = defaults.toSet()
    val ordered = saved.filter { it in known }.distinct()
    val missing = defaults.filter { it !in ordered.toSet() }
    return ordered + missing
  }

  /**
   * Applies a reorder of the currently visible chips onto the full persisted order, keeping
   * hidden (zero-count) chip slots in place.
   */
  fun applyVisibleReorder(fullOrder: List<String>, visibleNewOrder: List<String>): List<String> {
    val normalized = normalize(fullOrder)
    if (visibleNewOrder.isEmpty()) return normalized
    val visibleSet = visibleNewOrder.toSet()
    val visibleSlots = normalized.withIndex().filter { it.value in visibleSet }.map { it.index }
    if (visibleSlots.size != visibleNewOrder.size) {
      // Visibility changed mid-drag — fall back to placing the new visible order up front.
      return normalize(visibleNewOrder + normalized.filter { it !in visibleSet })
    }
    val result = normalized.toMutableList()
    visibleNewOrder.forEachIndexed { i, code -> result[visibleSlots[i]] = code }
    return result
  }

  fun move(order: List<String>, fromIndex: Int, toIndex: Int): List<String> {
    if (fromIndex == toIndex) return order
    if (fromIndex !in order.indices || toIndex !in order.indices) return order
    return order.toMutableList().apply { add(toIndex, removeAt(fromIndex)) }
  }
}
