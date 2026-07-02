package com.example.workflowupdater.ui.main

import com.example.workflowupdater.data.EngineerProfile
import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.data.WorkItem

/** Active filter selections. `null` means "no restriction" (i.e. "All"). */
data class WorkFilters(
  val district: String? = null,
  val lac: String? = null,
  val asStatus: String? = null,
  val arStatus: String? = null,
  val srStatus: String? = null,
  val statusCode: String? = null,
) {
  val hasDropdownFilters: Boolean
    get() = district != null || lac != null || asStatus != null || arStatus != null || srStatus != null
}

data class WorksUiState(
  val isLoading: Boolean = true,
  val isRefreshing: Boolean = false,
  val activeProfile: EngineerProfile = SheetConfig.profileById(SheetConfig.DEFAULT_PROFILE_ID),
  val allWorks: List<WorkItem> = emptyList(),
  val filteredWorks: List<WorkItem> = emptyList(),
  val searchQuery: String = "",
  val filters: WorkFilters = WorkFilters(),
  val districtOptions: List<String> = emptyList(),
  val lacOptions: List<String> = emptyList(),
  val statusCounts: Map<String, Int> = emptyMap(),
  val isOffline: Boolean = false,
  val errorMessage: String? = null,
  val lastSyncedAtMillis: Long? = null,
  val isExporting: Boolean = false,
) {
  val hasAnyFilter: Boolean get() = filters.hasDropdownFilters || searchQuery.isNotBlank() || filters.statusCode != null
}

/** Recomputes everything derived from [WorksUiState.allWorks], [WorksUiState.searchQuery] and
 *  [WorksUiState.filters]. Call after any change to those three inputs. */
fun WorksUiState.recomputeDerived(): WorksUiState {
  val query = searchQuery.trim().lowercase()

  val filtered =
    allWorks.filter { work ->
      val matchesSearch =
        query.isBlank() ||
          work.workName.lowercase().contains(query) ||
          work.fileNumber.lowercase().contains(query) ||
          work.lac.lowercase().contains(query) ||
          work.remarks.lowercase().contains(query)

      matchesSearch &&
        (filters.district == null || work.district == filters.district) &&
        (filters.lac == null || work.lac == filters.lac) &&
        (filters.asStatus == null || work.asStatus == filters.asStatus) &&
        (filters.arStatus == null || work.arStatus == filters.arStatus) &&
        (filters.srStatus == null || work.srStatus == filters.srStatus) &&
        (filters.statusCode == null || work.statusCode == filters.statusCode)
    }

  return copy(
    filteredWorks = filtered,
    districtOptions = allWorks.map { it.district }.filter { it.isNotBlank() }.distinct().sorted(),
    lacOptions = allWorks.map { it.lac }.filter { it.isNotBlank() }.distinct().sorted(),
    statusCounts = allWorks.groupingBy { it.statusCode }.eachCount(),
  )
}
