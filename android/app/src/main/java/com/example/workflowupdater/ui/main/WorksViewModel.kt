package com.example.workflowupdater.ui.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.workflowupdater.data.EngineerProfile
import com.example.workflowupdater.data.ProfilePrefs
import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.data.StatusChipOrder
import com.example.workflowupdater.data.WorkflowRepository
import com.example.workflowupdater.pdf.PdfReportBuilder
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class WorksViewModel(private val repository: WorkflowRepository, private val profilePrefs: ProfilePrefs) :
  ViewModel() {

  private val _uiState =
    MutableStateFlow(
      WorksUiState(
        activeProfile = SheetConfig.profileById(profilePrefs.launchProfileId()),
        defaultProfileId = profilePrefs.defaultProfileId,
        statusChipOrder = profilePrefs.statusChipOrder,
      ),
    )
  val uiState: StateFlow<WorksUiState> = _uiState.asStateFlow()

  init {
    // Show the last saved sheet immediately (works with no internet), then refresh from the network.
    viewModelScope.launch {
      val profile = _uiState.value.activeProfile
      val cached = repository.loadCachedWorks(profile)
      if (cached != null && cached.works.isNotEmpty()) {
        _uiState.update { state ->
          state
            .copy(
              isLoading = false,
              allWorks = cached.works,
              isOffline = true,
              lastSyncedAtMillis = cached.lastSyncedAtMillis,
            )
            .recomputeDerived()
        }
      }
      refresh()
    }
  }

  fun refresh() {
    viewModelScope.launch {
      val hasData = _uiState.value.allWorks.isNotEmpty()
      _uiState.update { it.copy(isLoading = !hasData, isRefreshing = hasData) }

      val profile = _uiState.value.activeProfile
      val result = repository.loadWorks(profile)

      _uiState.update { state ->
        state
          .copy(
            isLoading = false,
            isRefreshing = false,
            allWorks = result.works,
            isOffline = result.isOffline,
            errorMessage = result.errorMessage?.takeIf { result.works.isEmpty() },
            lastSyncedAtMillis = result.lastSyncedAtMillis ?: state.lastSyncedAtMillis,
          )
          .recomputeDerived()
      }
    }
  }

  fun selectProfile(profile: EngineerProfile) {
    if (profile.id == _uiState.value.activeProfile.id) return
    profilePrefs.activeProfileId = profile.id
    _uiState.update { it.copy(activeProfile = profile, allWorks = emptyList(), filters = WorkFilters()).recomputeDerived() }
    viewModelScope.launch {
      val cached = repository.loadCachedWorks(profile)
      if (cached != null && cached.works.isNotEmpty()) {
        _uiState.update { state ->
          state
            .copy(
              isLoading = false,
              allWorks = cached.works,
              isOffline = true,
              lastSyncedAtMillis = cached.lastSyncedAtMillis ?: state.lastSyncedAtMillis,
            )
            .recomputeDerived()
        }
      }
      refresh()
    }
  }

  fun setDefaultProfile(profile: EngineerProfile) {
    if (profile.id == _uiState.value.defaultProfileId) return
    profilePrefs.setDefaultProfile(profile.id)
    _uiState.update { it.copy(defaultProfileId = profile.id) }
  }

  fun onSearchQueryChange(query: String) {
    _uiState.update { it.copy(searchQuery = query).recomputeDerived() }
  }

  fun onStatusChipSelected(code: String?) {
    _uiState.update {
      val newCode = if (it.filters.statusCode == code) null else code
      it.copy(filters = it.filters.copy(statusCode = newCode)).recomputeDerived()
    }
  }

  /** Persists a new design-status chip order after the user long-presses and reorders chips. */
  fun onStatusChipOrderChange(order: List<String>) {
    val normalized = StatusChipOrder.normalize(order)
    if (normalized == _uiState.value.statusChipOrder) return
    profilePrefs.statusChipOrder = normalized
    _uiState.update { it.copy(statusChipOrder = normalized) }
  }

  fun applyFilters(filters: WorkFilters) {
    _uiState.update { it.copy(filters = filters.copy(statusCode = it.filters.statusCode)).recomputeDerived() }
  }

  fun clearAllFilters() {
    _uiState.update { it.copy(filters = WorkFilters(), searchQuery = "").recomputeDerived() }
  }

  fun setExporting(exporting: Boolean) {
    _uiState.update { it.copy(isExporting = exporting) }
  }

  fun buildReportHtml(engineerName: String): String {
    val state = _uiState.value
    return PdfReportBuilder.buildReportHtml(state.filteredWorks, state.activeProfile, engineerName)
  }

  fun findWork(rowNum: Int): com.example.workflowupdater.data.WorkItem? =
    _uiState.value.allWorks.find { it.rowNum == rowNum }
}
