package com.example.workflowupdater.ui.main

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SwitchAccount
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.pdf.PdfExporter
import com.example.workflowupdater.pdf.rememberPdfExporter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(viewModel: WorksViewModel, onWorkClick: (Int) -> Unit, modifier: Modifier = Modifier) {
  val context = LocalContext.current
  val state by viewModel.uiState.collectAsStateWithLifecycle()

  val pdfExporter = rememberPdfExporter()

  val filterSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  val profileSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  var showFilterSheet by remember { mutableStateOf(false) }
  var showProfileSheet by remember { mutableStateOf(false) }
  var showExportNameDialog by remember { mutableStateOf(false) }

  Scaffold(
    modifier = modifier.fillMaxSize(),
    topBar = {
      TopAppBar(
        colors =
          TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface,
          ),
        title = {
          Column {
            Text(text = "RDO KKD Works", style = MaterialTheme.typography.titleLarge, maxLines = 1)
            Text(
              text =
                if (SheetConfig.isAllProfile(state.activeProfile)) {
                  "All engineers \u2022 ${state.filteredWorks.size} shown"
                } else {
                  "Engineer ${state.activeProfile.id} \u2022 ${state.filteredWorks.size} shown"
                },
              style = MaterialTheme.typography.labelMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
              maxLines = 1,
            )
          }
        },
        actions = {
          IconButton(onClick = { showProfileSheet = true }) {
            Icon(Icons.Filled.SwitchAccount, contentDescription = "Switch engineer profile")
          }
          BadgedBox(
            badge = {
              val activeCount = countActiveDropdownFilters(state.filters)
              if (activeCount > 0) Badge { Text(activeCount.toString()) }
            }
          ) {
            IconButton(onClick = { showFilterSheet = true }) {
              Icon(Icons.Filled.FilterList, contentDescription = "Filter works")
            }
          }
        },
      )
    },
    floatingActionButton = {
      ExtendedFloatingActionButton(
        onClick = {
          if (state.isExporting) return@ExtendedFloatingActionButton
          if (state.filteredWorks.isEmpty()) {
            Toast.makeText(context, "No works to export", Toast.LENGTH_SHORT).show()
            return@ExtendedFloatingActionButton
          }
          showExportNameDialog = true
        },
        icon = {
          if (state.isExporting) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
          } else {
            Icon(Icons.Filled.PictureAsPdf, contentDescription = null)
          }
        },
        text = { Text(if (state.isExporting) "Preparing\u2026" else "Export PDF") },
      )
    },
  ) { innerPadding ->
    Column(modifier = Modifier.padding(innerPadding).fillMaxSize()) {
      SearchField(query = state.searchQuery, onQueryChange = viewModel::onSearchQueryChange)

      Spacer(Modifier.height(8.dp))
      StatChipsRow(
        statusCounts = state.statusCounts,
        selectedCode = state.filters.statusCode,
        onChipClick = viewModel::onStatusChipSelected,
        hasAnyFilter = state.hasAnyFilter,
        onClearAllFilters = viewModel::clearAllFilters,
      )
      if (state.hasAnyFilter) {
        Spacer(Modifier.height(8.dp))
        FilterResultChip(filteredCount = state.filteredWorks.size, totalCount = state.allWorks.size)
      }
      Spacer(Modifier.height(8.dp))

      if (state.isOffline) {
        OfflineBanner(message = state.errorMessage)
      }

      PullToRefreshBox(
        isRefreshing = state.isRefreshing,
        onRefresh = viewModel::refresh,
        modifier = Modifier.fillMaxSize(),
      ) {
        when {
          state.isLoading -> LoadingState()
          state.filteredWorks.isEmpty() -> EmptyState(hasFilters = state.hasAnyFilter, onClear = viewModel::clearAllFilters)
          else ->
            LazyColumn(
              modifier = Modifier.fillMaxSize(),
              contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 96.dp),
              verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
              items(items = state.filteredWorks, key = { it.rowNum }) { work ->
                WorkCard(work = work, onClick = { onWorkClick(work.rowNum) })
              }
            }
        }
      }
    }
  }

  if (showFilterSheet) {
    FilterSheet(
      sheetState = filterSheetState,
      districtOptions = state.districtOptions,
      lacOptions = state.lacOptions,
      asStatusOptions = state.asStatusOptions,
      arStatusOptions = state.arStatusOptions,
      srStatusOptions = state.srStatusOptions,
      filters = state.filters,
      onApply = viewModel::applyFilters,
      onDismiss = { showFilterSheet = false },
    )
  }

  if (showProfileSheet) {
    ProfileSheet(
      sheetState = profileSheetState,
      activeProfile = state.activeProfile,
      defaultProfileId = state.defaultProfileId,
      onSelect = viewModel::selectProfile,
      onSetDefault = { profile ->
        viewModel.setDefaultProfile(profile)
        Toast.makeText(context, "${profileDisplayName(profile)} set as default on app launch", Toast.LENGTH_SHORT).show()
      },
      onDismiss = { showProfileSheet = false },
    )
  }

  if (showExportNameDialog) {
    ExportPdfNameDialog(
      designation = state.activeProfile.id,
      onDismiss = { showExportNameDialog = false },
      onConfirm = { engineerName ->
        showExportNameDialog = false
        exportPdf(
          context = context,
          state = state,
          viewModel = viewModel,
          pdfExporter = pdfExporter,
          engineerName = engineerName,
        )
      },
    )
  }
}

private fun countActiveDropdownFilters(filters: WorkFilters): Int =
  listOf(filters.district, filters.lac, filters.asStatus, filters.arStatus, filters.srStatus).count { it != null }

private fun exportPdf(
  context: android.content.Context,
  state: WorksUiState,
  viewModel: WorksViewModel,
  pdfExporter: PdfExporter,
  engineerName: String,
) {
  viewModel.setExporting(true)
  val html = viewModel.buildReportHtml(engineerName)
  pdfExporter.printReport(
    html = html,
    jobName = PdfExporter.jobName(state.activeProfile.id, engineerName),
    onStarted = { viewModel.setExporting(false) },
    onError = { message ->
      viewModel.setExporting(false)
      Toast.makeText(context, "Could not create PDF: $message", Toast.LENGTH_LONG).show()
    },
  )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchField(query: String, onQueryChange: (String) -> Unit) {
  TextField(
    value = query,
    onValueChange = onQueryChange,
    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
    placeholder = { Text("Search work, LAC or remarks\u2026") },
    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
    singleLine = true,
    shape = MaterialTheme.shapes.large,
    colors =
      TextFieldDefaults.colors(
        focusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainer,
        focusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
        unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
        disabledIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
      ),
  )
}

@Composable
private fun OfflineBanner(message: String?) {
  Row(
    modifier =
      Modifier.fillMaxWidth()
        .padding(horizontal = 16.dp, vertical = 4.dp)
        .background(MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.shapes.small)
        .padding(12.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(Icons.Filled.CloudOff, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
    Spacer(Modifier.width(8.dp))
    Text(
      text = message ?: "Showing saved data \u2014 pull down to retry the live sheet",
      style = MaterialTheme.typography.bodySmall,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
  }
}

@Composable
private fun LoadingState() {
  Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
  }
}

@Composable
private fun EmptyState(hasFilters: Boolean, onClear: () -> Unit) {
  Box(modifier = Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
      Text(
        text = if (hasFilters) "No works match your filters" else "No works found for this engineer",
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onSurface,
        textAlign = TextAlign.Center,
      )
      if (hasFilters) {
        Spacer(Modifier.height(8.dp))
        Text(
          text = "Tap to clear all filters",
          style = MaterialTheme.typography.labelLarge,
          color = MaterialTheme.colorScheme.primary,
          modifier = Modifier.clickable(onClick = onClear),
        )
      }
    }
  }
}
