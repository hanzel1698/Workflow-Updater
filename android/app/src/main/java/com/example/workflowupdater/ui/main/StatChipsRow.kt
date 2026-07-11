package com.example.workflowupdater.ui.main

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterAltOff
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.data.StatusChipOrder
import com.example.workflowupdater.ui.common.statusTone
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

/**
 * Horizontally scrollable KPI chips, mirroring the stats grid on the desktop dashboard.
 * Tapping a chip toggles it as the active status filter. Long-press and drag to reorder
 * status chips; the custom order is persisted. Only statuses present in the current
 * filtered pool are shown. The "All works" chip stays fixed at the start.
 */
@Composable
fun StatChipsRow(
  statusCounts: Map<String, Int>,
  statusOrder: List<String>,
  selectedCode: String?,
  onChipClick: (String?) -> Unit,
  onStatusOrderChange: (List<String>) -> Unit,
  hasAnyFilter: Boolean,
  onClearAllFilters: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val total = statusCounts.values.sum()
  val haptic = LocalHapticFeedback.current

  val orderedVisible =
    remember(statusOrder, statusCounts) {
      StatusChipOrder.normalize(statusOrder).filter { (statusCounts[it] ?: 0) > 0 }
    }

  var visibleOrder by remember { mutableStateOf(orderedVisible) }
  LaunchedEffect(orderedVisible) { visibleOrder = orderedVisible }

  // "All works" is a non-reorderable header item at index 0 when present.
  val headerCount = if (total > 0) 1 else 0

  val lazyListState = rememberLazyListState()
  val reorderableLazyListState =
    rememberReorderableLazyListState(lazyListState) { from, to ->
      val fromVisible = from.index - headerCount
      val toVisible = to.index - headerCount
      if (fromVisible !in visibleOrder.indices || toVisible !in visibleOrder.indices) return@rememberReorderableLazyListState
      visibleOrder = StatusChipOrder.move(visibleOrder, fromVisible, toVisible)
      haptic.performHapticFeedback(HapticFeedbackType.SegmentFrequentTick)
    }

  Row(
    modifier = modifier.fillMaxWidth().padding(end = 8.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    LazyRow(
      state = lazyListState,
      modifier = Modifier.weight(1f),
      contentPadding = PaddingValues(start = 16.dp, end = 8.dp),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      if (total > 0) {
        item(key = "ALL") {
          StatChip(
            label = "All works",
            count = total,
            selected = selectedCode == null,
            onClick = { onChipClick(null) },
          )
        }
      }
      items(items = visibleOrder, key = { it }) { code ->
        ReorderableItem(reorderableLazyListState, key = code) { isDragging ->
          val elevation by animateDpAsState(if (isDragging) 6.dp else 0.dp, label = "chipElevation")
          val interactionSource = remember { MutableInteractionSource() }
          Surface(
            shadowElevation = elevation,
            shape = RoundedCornerShape(14.dp),
            color = androidx.compose.ui.graphics.Color.Transparent,
          ) {
            StatChip(
              label = SheetConfig.STATUS_SHORT_LABELS[code] ?: code,
              count = statusCounts[code] ?: 0,
              selected = selectedCode == code,
              code = code,
              onClick = { onChipClick(code) },
              interactionSource = interactionSource,
              modifier =
                Modifier
                  .longPressDraggableHandle(
                    interactionSource = interactionSource,
                    onDragStarted = {
                      haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    },
                    onDragStopped = {
                      haptic.performHapticFeedback(HapticFeedbackType.GestureEnd)
                      onStatusOrderChange(StatusChipOrder.applyVisibleReorder(statusOrder, visibleOrder))
                    },
                  )
                  .semantics { contentDescription = "Design status $code. Long press to reorder." },
            )
          }
        }
      }
    }

    if (hasAnyFilter) {
      IconButton(onClick = onClearAllFilters, modifier = Modifier.size(40.dp)) {
        Icon(
          imageVector = Icons.Filled.FilterAltOff,
          contentDescription = "Clear all filters",
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(22.dp),
        )
      }
    }
  }
}

@Composable
private fun StatChip(
  label: String,
  count: Int,
  selected: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
  code: String? = null,
  interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
) {
  val tone = code?.let { statusTone(it) }
  val background =
    when {
      selected && tone != null -> tone.background
      selected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)
      else -> MaterialTheme.colorScheme.surfaceContainer
    }
  val textColor =
    when {
      selected && tone != null -> tone.foreground
      selected -> MaterialTheme.colorScheme.primary
      else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

  Column(
    modifier =
      modifier
        .clip(RoundedCornerShape(14.dp))
        .background(background)
        .clickable(
          interactionSource = interactionSource,
          indication = LocalIndication.current,
          onClick = onClick,
        )
        .padding(horizontal = 14.dp, vertical = 8.dp),
  ) {
    Text(text = count.toString(), style = MaterialTheme.typography.titleMedium, color = textColor)
    Text(text = label, style = MaterialTheme.typography.labelSmall, color = textColor)
  }
}

/** Info chip shown below design-status chips when any filter is active. */
@Composable
fun FilterResultChip(filteredCount: Int, totalCount: Int, modifier: Modifier = Modifier) {
  val label =
    if (filteredCount == totalCount) {
      "$filteredCount ${if (filteredCount == 1) "work" else "works"} match your filters"
    } else {
      "$filteredCount of $totalCount ${if (filteredCount == 1) "work" else "works"} match your filters"
    }

  Row(
    modifier =
      modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp)
        .clip(RoundedCornerShape(12.dp))
        .background(MaterialTheme.colorScheme.secondaryContainer)
        .padding(horizontal = 14.dp, vertical = 10.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(
      imageVector = Icons.Filled.Info,
      contentDescription = null,
      tint = MaterialTheme.colorScheme.onSecondaryContainer,
      modifier = Modifier.size(18.dp),
    )
    Spacer(Modifier.width(8.dp))
    Text(
      text = label,
      style = MaterialTheme.typography.labelLarge,
      color = MaterialTheme.colorScheme.onSecondaryContainer,
    )
  }
}
