package com.example.workflowupdater.ui.main

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.SquareFoot
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.data.WorkItem
import com.example.workflowupdater.ui.common.statusTone

@Composable
fun WorkCard(work: WorkItem, onClick: () -> Unit, modifier: Modifier = Modifier) {
  Card(
    onClick = onClick,
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(18.dp),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
  ) {
    Column(modifier = Modifier.padding(16.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
        Text(
          text = work.fileNumber.ifBlank { "No file number" },
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.weight(1f, fill = false),
        )
        Spacer(Modifier.width(8.dp))
        StatusBadge(status = work.status, code = work.statusCode)
      }

      Spacer(Modifier.height(6.dp))

      Text(
        text = work.workName,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurface,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )

      Spacer(Modifier.height(10.dp))

      Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Filled.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(4.dp))
        Text(
          text = listOf(work.lac, work.district).filter { it.isNotBlank() }.joinToString(" \u2022 ").ifBlank { "Location not set" },
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.weight(1f),
        )
      }

      if (work.floors.isNotBlank() || work.area.isNotBlank()) {
        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
          Icon(Icons.Filled.SquareFoot, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
          Spacer(Modifier.width(4.dp))
          Text(
            text = listOfNotNull(
                work.floors.ifBlank { null }?.let { "$it floors" },
                work.area.ifBlank { null }?.let { "$it m\u00b2" },
              )
              .joinToString("  \u2022  "),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }

      Spacer(Modifier.height(10.dp))

      Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        MiniStatusPill(label = "AS", value = work.asStatus)
        MiniStatusPill(label = "AR", value = work.arStatus)
        MiniStatusPill(label = "SR", value = work.srStatus)
      }

      if (work.remarks.isNotBlank()) {
        Spacer(Modifier.height(10.dp))
        Text(
          text = work.remarks,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 2,
          overflow = TextOverflow.Ellipsis,
        )
      }

      Spacer(Modifier.height(10.dp))

      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
        Text(
          text = "View full details",
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.primary,
        )
        Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
      }
    }
  }
}

@Composable
private fun StatusBadge(status: String, code: String) {
  val tone = statusTone(code)
  val label = SheetConfig.STATUS_SHORT_LABELS[code] ?: status
  Row(
    modifier =
      Modifier.background(color = tone.background, shape = RoundedCornerShape(20.dp))
        .padding(horizontal = 10.dp, vertical = 4.dp),
  ) {
    Text(text = label, style = MaterialTheme.typography.labelSmall, color = tone.foreground, maxLines = 1)
  }
}

@Composable
private fun MiniStatusPill(label: String, value: String) {
  val display = value.ifBlank { "\u2014" }
  Row(
    modifier =
      Modifier.background(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = RoundedCornerShape(8.dp))
        .padding(horizontal = 8.dp, vertical = 4.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(text = "$label:", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.width(4.dp))
    Text(
      text = display,
      style = MaterialTheme.typography.labelSmall,
      color = MaterialTheme.colorScheme.onSurface,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
    )
  }
}
