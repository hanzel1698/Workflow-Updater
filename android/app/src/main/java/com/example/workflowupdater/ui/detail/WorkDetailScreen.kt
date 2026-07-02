package com.example.workflowupdater.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.workflowupdater.data.SheetDateFormatter
import com.example.workflowupdater.data.WorkItem
import com.example.workflowupdater.ui.common.statusTone

/** Fully read-only detail view of a single work. Renders every populated field, including
 *  any unknown extra columns, so nothing from the live sheet is hidden. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkDetailScreen(work: WorkItem?, onBack: () -> Unit, modifier: Modifier = Modifier) {
  Scaffold(
    modifier = modifier.fillMaxSize(),
    topBar = {
      TopAppBar(
        colors =
          TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface,
          ),
        navigationIcon = {
          IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
          }
        },
        title = { Text("Work details", style = MaterialTheme.typography.titleLarge) },
      )
    },
  ) { innerPadding ->
    if (work == null) {
      Box(modifier = Modifier.padding(innerPadding).fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("This work is no longer available.", style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center)
      }
      return@Scaffold
    }

    Column(
      modifier =
        Modifier.padding(innerPadding)
          .fillMaxSize()
          .verticalScroll(rememberScrollState())
          .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
      StatusHeader(work)
      Spacer(Modifier.height(16.dp))

      Text(text = work.workName, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onSurface)
      Spacer(Modifier.height(16.dp))

      DetailSection(title = "Overview") {
        DetailRow("e-Office File Number", work.fileNumber)
        DetailRow("Design Office", work.designOffice)
        DetailRow("District", work.district)
        DetailRow("LAC", work.lac)
        DetailRow("Client Department", work.clientDept)
      }

      DetailSection(title = "Approvals") {
        DetailRow("AS Status", work.asStatus)
        DetailRow("AR Status", work.arStatus)
        DetailRow("SR Status", work.srStatus)
        DetailRow("AS Order No & Date", work.asOrder)
        DetailRow("AS Date", SheetDateFormatter.format(work.asDate))
        DetailRow("TS Order No & Date", work.tsOrder)
        DetailRow("TS Date", SheetDateFormatter.format(work.tsDate))
      }

      DetailSection(title = "Building") {
        DetailRow("No. of Floors", work.floors)
        DetailRow("Total Area", work.area.takeIf { it.isNotBlank() }?.let { "$it m\u00b2" } ?: "")
        DetailRow("ASE", work.ase)
        DetailRow("SE", work.se)
      }

      DetailSection(title = "Timeline") {
        DetailRow("Target Date", SheetDateFormatter.format(work.targetDate))
        DetailRow("Tentative Issued Date", SheetDateFormatter.format(work.tentativeIssuedDate))
        DetailRow("Detailed Design Last Issued Date", SheetDateFormatter.format(work.detailedLastIssuedDate))
        DetailRow("Detailed Design Complete Issued Date", SheetDateFormatter.format(work.detailedCompleteIssuedDate))
      }

      DetailSection(title = "Remarks") {
        DetailParagraph("Remarks by Building Design Unit", work.remarks)
        DetailParagraph("Present Status / Remarks", work.shortRemarks)
        DetailParagraph("Remarks of EE RIQCL", work.eeRiqclRemarks)
        DetailParagraph("Remarks of Architecture Wing", work.architectureRemarks)
      }

      if (work.extraFields.isNotEmpty()) {
        DetailSection(title = "Additional Information") {
          work.extraFields.forEach { (label, value) -> DetailRow(label, value) }
        }
      }

      Spacer(Modifier.height(32.dp))
    }
  }
}

@Composable
private fun StatusHeader(work: WorkItem) {
  val tone = statusTone(work.statusCode)
  Row(
    modifier =
      Modifier.fillMaxWidth()
        .background(tone.background, RoundedCornerShape(14.dp))
        .padding(horizontal = 14.dp, vertical = 10.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Box(modifier = Modifier.size(10.dp).background(tone.foreground, RoundedCornerShape(5.dp)))
    Spacer(Modifier.width(10.dp))
    Text(text = work.status, style = MaterialTheme.typography.titleSmall, color = tone.foreground)
  }
}

@Composable
private fun DetailSection(title: String, content: @Composable () -> Unit) {
  Column(modifier = Modifier.fillMaxWidth()) {
    Spacer(Modifier.height(8.dp))
    Text(
      text = title.uppercase(),
      style = MaterialTheme.typography.labelMedium,
      color = MaterialTheme.colorScheme.primary,
    )
    Spacer(Modifier.height(8.dp))
    Column(
      modifier =
        Modifier.fillMaxWidth()
          .background(MaterialTheme.colorScheme.surfaceContainer, RoundedCornerShape(14.dp))
          .padding(horizontal = 14.dp, vertical = 4.dp)
    ) {
      content()
    }
    Spacer(Modifier.height(16.dp))
  }
}

@Composable
private fun DetailRow(label: String, value: String) {
  if (value.isBlank()) return
  Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.Top) {
    Text(
      text = label,
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
      modifier = Modifier.width(140.dp),
    )
    Spacer(Modifier.width(12.dp))
    Text(
      text = value,
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurface,
      modifier = Modifier.weight(1f),
    )
  }
  HorizontalDivider(color = MaterialTheme.colorScheme.outline)
}

@Composable
private fun DetailParagraph(label: String, value: String) {
  if (value.isBlank()) return
  Column(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp)) {
    Text(text = label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(4.dp))
    Text(text = value, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
  }
  HorizontalDivider(color = MaterialTheme.colorScheme.outline)
}
