package com.example.workflowupdater.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.ui.common.statusTone

/** Horizontally scrollable KPI chips, mirroring the stats grid on the desktop dashboard.
 *  Tapping a chip toggles it as the active status filter. */
@Composable
fun StatChipsRow(
  statusCounts: Map<String, Int>,
  selectedCode: String?,
  onChipClick: (String?) -> Unit,
  modifier: Modifier = Modifier,
) {
  val total = statusCounts.values.sum()
  Row(
    modifier = modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    StatChip(label = "All works", count = total, selected = selectedCode == null, onClick = { onChipClick(null) })
    SheetConfig.STATUS_SHORT_LABELS.forEach { (code, label) ->
      StatChip(
        label = label,
        count = statusCounts[code] ?: 0,
        selected = selectedCode == code,
        code = code,
        onClick = { onChipClick(code) },
      )
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
