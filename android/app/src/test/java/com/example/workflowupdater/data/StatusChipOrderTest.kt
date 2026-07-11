package com.example.workflowupdater.data

import org.junit.Assert.assertEquals
import org.junit.Test

class StatusChipOrderTest {

  @Test
  fun default_matchesCanonicalStatusCodes() {
    assertEquals(SheetConfig.STATUS_SHORT_LABELS.keys.toList(), StatusChipOrder.default())
  }

  @Test
  fun normalize_nullOrEmpty_returnsDefault() {
    assertEquals(StatusChipOrder.default(), StatusChipOrder.normalize(null))
    assertEquals(StatusChipOrder.default(), StatusChipOrder.normalize(emptyList()))
  }

  @Test
  fun normalize_keepsSavedOrderAndAppendsMissing() {
    val saved = listOf("06", "01", "99", "06", "04")
    val normalized = StatusChipOrder.normalize(saved)
    assertEquals(listOf("06", "01", "04"), normalized.take(3))
    assertEquals(StatusChipOrder.default().toSet(), normalized.toSet())
    assertEquals(StatusChipOrder.default().size, normalized.size)
  }

  @Test
  fun move_reordersWithinBounds() {
    val order = listOf("01", "02", "03", "04")
    assertEquals(listOf("02", "01", "03", "04"), StatusChipOrder.move(order, 0, 1))
    assertEquals(listOf("01", "02", "04", "03"), StatusChipOrder.move(order, 3, 2))
    assertEquals(order, StatusChipOrder.move(order, 1, 1))
    assertEquals(order, StatusChipOrder.move(order, -1, 2))
  }

  @Test
  fun applyVisibleReorder_preservesHiddenChipSlots() {
    val full = StatusChipOrder.default()
    // Only 01, 03, 05 are visible; user swaps to 05, 01, 03
    val reordered = StatusChipOrder.applyVisibleReorder(full, listOf("05", "01", "03"))
    assertEquals(
      listOf("05", "02", "01", "04", "03", "06", "07", "08", "09"),
      reordered,
    )
  }

  @Test
  fun applyVisibleReorder_emptyVisible_returnsNormalizedFull() {
    assertEquals(
      StatusChipOrder.normalize(listOf("03", "01")),
      StatusChipOrder.applyVisibleReorder(listOf("03", "01"), emptyList()),
    )
  }
}
