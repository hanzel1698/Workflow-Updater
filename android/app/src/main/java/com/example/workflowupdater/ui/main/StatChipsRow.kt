package com.example.workflowupdater.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FilterAltOff
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.ui.common.statusTone

/** Horizontally scrollable KPI chips, mirroring the stats grid on the desktop dashboard.
 *  Tapping a chip toggles it as the active status filter. Only statuses present in the
 *  current filtered pool are shown. */
@Composable
fun StatChipsRow(
  statusCounts: Map<String, Int>,
  selectedCode: String?,
  onChipClick: (String?) -> Unit,
  hasAnyFilter: Boolean,
  onClearAllFilters: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val total = statusCounts.values.sum()
  val visibleStatusCodes =
    SheetConfig.STATUS_SHORT_LABELS.keys.filter { (statusCounts[it] ?: 0) > 0 }

  Row(
    modifier = modifier.fillMaxWidth().padding(end = 8.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Row(
      modifier = Modifier.weight(1f).horizontalScroll(rememberScrollState()).padding(start = 16.dp),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      if (total > 0) {
        StatChip(label = "All works", count = total, selected = selectedCode == null, onClick = { onChipClick(null) })
      }
      visibleStatusCodes.forEach { code ->
        val label = SheetConfig.STATUS_SHORT_LABELS[code] ?: code
        StatChip(
          label = label,
          count = statusCounts[code] ?: 0,
          selected = selectedCode == code,
          code = code,
          onClick = { onChipClick(code) },
        )
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
private fun StatChip(label: String, count: Int, selected: Boolean, onClick: () -> Unit, code: String? = null) {
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
      Modifier.clip(RoundedCornerShape(14.dp))
        .background(background)
        .clickable(onClick = onClick)
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
