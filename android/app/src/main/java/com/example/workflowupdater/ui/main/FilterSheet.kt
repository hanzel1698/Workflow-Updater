package com.example.workflowupdater.ui.main

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilterSheet(
  sheetState: SheetState,
  districtOptions: List<String>,
  lacOptions: List<String>,
  seOptions: List<String>,
  asStatusOptions: List<String>,
  arStatusOptions: List<String>,
  srStatusOptions: List<String>,
  filters: WorkFilters,
  onApply: (WorkFilters) -> Unit,
  onDismiss: () -> Unit,
) {
  var district by remember(filters) { mutableStateOf(filters.district) }
  var lac by remember(filters) { mutableStateOf(filters.lac) }
  var se by remember(filters) { mutableStateOf(filters.se) }
  var asStatus by remember(filters) { mutableStateOf(filters.asStatus) }
  var arStatus by remember(filters) { mutableStateOf(filters.arStatus) }
  var srStatus by remember(filters) { mutableStateOf(filters.srStatus) }

  ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
    Column(modifier = Modifier.padding(horizontal = 20.dp).navigationBarsPadding()) {
      Text(text = "Filter works", style = MaterialTheme.typography.titleLarge)
      Spacer(Modifier.height(4.dp))
      Text(
        text = "Narrow the list down by location or approval status",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Spacer(Modifier.height(16.dp))

      if (districtOptions.isNotEmpty()) {
        FilterGroup("District", districtOptions, district) { district = if (district == it) null else it }
        Spacer(Modifier.height(16.dp))
      }
      if (lacOptions.isNotEmpty()) {
        FilterGroup("LAC", lacOptions, lac) { lac = if (lac == it) null else it }
        Spacer(Modifier.height(16.dp))
      }
      if (seOptions.isNotEmpty()) {
        FilterGroup("SE", seOptions, se) { se = if (se == it) null else it }
        Spacer(Modifier.height(16.dp))
      }
      if (asStatusOptions.isNotEmpty()) {
        FilterGroup("AS Status", asStatusOptions, asStatus) { asStatus = if (asStatus == it) null else it }
        Spacer(Modifier.height(16.dp))
      }
      if (arStatusOptions.isNotEmpty()) {
        FilterGroup("AR Status", arStatusOptions, arStatus) { arStatus = if (arStatus == it) null else it }
        Spacer(Modifier.height(16.dp))
      }
      if (srStatusOptions.isNotEmpty()) {
        FilterGroup("SR Status", srStatusOptions, srStatus) { srStatus = if (srStatus == it) null else it }
      }

      Spacer(Modifier.height(20.dp))
      HorizontalDivider()
      Spacer(Modifier.height(12.dp))

      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        TextButton(
          onClick = {
            district = null
            lac = null
            se = null
            asStatus = null
            arStatus = null
            srStatus = null
          }
        ) {
          Text("Clear all")
        }
        Button(
          onClick = {
            onApply(WorkFilters(district = district, lac = lac, se = se, asStatus = asStatus, arStatus = arStatus, srStatus = srStatus))
            onDismiss()
          }
        ) {
          Text("Apply filters")
        }
      }
      Spacer(Modifier.height(20.dp))
    }
  }
}

@Composable
private fun FilterGroup(title: String, options: List<String>, selected: String?, onSelect: (String) -> Unit) {
  Text(text = title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurface)
  Spacer(Modifier.height(8.dp))
  Row(
    modifier = Modifier.horizontalScroll(rememberScrollState()),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    options.forEach { option ->
      FilterChip(selected = selected == option, onClick = { onSelect(option) }, label = { Text(option) })
    }
  }
}
