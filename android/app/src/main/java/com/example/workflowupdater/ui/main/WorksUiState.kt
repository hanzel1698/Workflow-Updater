package com.example.workflowupdater.ui.main

import com.example.workflowupdater.data.EngineerProfile
import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.data.WorkItem

/** Active filter selections. `null` means "no restriction" (i.e. "All"). */
data class WorkFilters(
  val district: String? = null,
  val lac: String? = null,
  val se: String? = null,
  val asStatus: String? = null,
  val arStatus: String? = null,
  val srStatus: String? = null,
  val statusCode: String? = null,
) {
  val hasDropdownFilters: Boolean
    get() = district != null || lac != null || se != null || asStatus != null || arStatus != null || srStatus != null
}

data class WorksUiState(
  val isLoading: Boolean = true,
  val isRefreshing: Boolean = false,
  val activeProfile: EngineerProfile = SheetConfig.profileById(SheetConfig.DEFAULT_PROFILE_ID),
  val defaultProfileId: String = SheetConfig.DEFAULT_PROFILE_ID,
  val allWorks: List<WorkItem> = emptyList(),
  val filteredWorks: List<WorkItem> = emptyList(),
  val searchQuery: String = "",
  val filters: WorkFilters = WorkFilters(),
  val districtOptions: List<String> = emptyList(),
  val lacOptions: List<String> = emptyList(),
  val seOptions: List<String> = emptyList(),
  val asStatusOptions: List<String> = emptyList(),
  val arStatusOptions: List<String> = emptyList(),
  val srStatusOptions: List<String> = emptyList(),
  val statusCounts: Map<String, Int> = emptyMap(),
  /** Persisted display order for design-status filter chips (two-digit codes, 01…09). */
  val statusChipOrder: List<String> = SheetConfig.STATUS_SHORT_LABELS.keys.toList(),
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

  fun WorkItem.matchesSearch(): Boolean =
    query.isBlank() ||
      workName.lowercase().contains(query) ||
      fileNumber.lowercase().contains(query) ||
      lac.lowercase().contains(query) ||
      remarks.lowercase().contains(query)

  fun filterWorks(
    district: String? = filters.district,
    lac: String? = filters.lac,
    se: String? = filters.se,
    asStatus: String? = filters.asStatus,
    arStatus: String? = filters.arStatus,
    srStatus: String? = filters.srStatus,
    statusCode: String? = filters.statusCode,
  ): List<WorkItem> =
    allWorks.filter { work ->
      work.matchesSearch() &&
        (district == null || work.district == district) &&
        (lac == null || work.lac == lac) &&
        (se == null || work.se == se) &&
        (asStatus == null || work.asStatus == asStatus) &&
        (arStatus == null || work.arStatus == arStatus) &&
        (srStatus == null || work.srStatus == srStatus) &&
        (statusCode == null || work.statusCode == statusCode)
    }

  fun distinctOptions(works: List<WorkItem>, selector: (WorkItem) -> String): List<String> =
    works.map(selector).filter { it.isNotBlank() }.distinct().sorted()

  val districtOptions = distinctOptions(filterWorks(district = null)) { it.district }
  val lacOptions = distinctOptions(filterWorks(lac = null)) { it.lac }
  val seOptions = distinctOptions(filterWorks(se = null)) { it.se }
  val asStatusOptions = distinctOptions(filterWorks(asStatus = null)) { it.asStatus }
  val arStatusOptions = distinctOptions(filterWorks(arStatus = null)) { it.arStatus }
  val srStatusOptions = distinctOptions(filterWorks(srStatus = null)) { it.srStatus }

  val sanitizedFilters =
    filters.copy(
      district = filters.district?.takeIf { it in districtOptions },
      lac = filters.lac?.takeIf { it in lacOptions },
      se = filters.se?.takeIf { it in seOptions },
      asStatus = filters.asStatus?.takeIf { it in asStatusOptions },
      arStatus = filters.arStatus?.takeIf { it in arStatusOptions },
      srStatus = filters.srStatus?.takeIf { it in srStatusOptions },
    )

  val filtered =
    allWorks.filter { work ->
      work.matchesSearch() &&
        (sanitizedFilters.district == null || work.district == sanitizedFilters.district) &&
        (sanitizedFilters.lac == null || work.lac == sanitizedFilters.lac) &&
        (sanitizedFilters.se == null || work.se == sanitizedFilters.se) &&
        (sanitizedFilters.asStatus == null || work.asStatus == sanitizedFilters.asStatus) &&
        (sanitizedFilters.arStatus == null || work.arStatus == sanitizedFilters.arStatus) &&
        (sanitizedFilters.srStatus == null || work.srStatus == sanitizedFilters.srStatus) &&
        (sanitizedFilters.statusCode == null || work.statusCode == sanitizedFilters.statusCode)
    }

  val poolForStatusChips =
    allWorks.filter { work ->
      work.matchesSearch() &&
        (sanitizedFilters.district == null || work.district == sanitizedFilters.district) &&
        (sanitizedFilters.lac == null || work.lac == sanitizedFilters.lac) &&
        (sanitizedFilters.se == null || work.se == sanitizedFilters.se) &&
        (sanitizedFilters.asStatus == null || work.asStatus == sanitizedFilters.asStatus) &&
        (sanitizedFilters.arStatus == null || work.arStatus == sanitizedFilters.arStatus) &&
        (sanitizedFilters.srStatus == null || work.srStatus == sanitizedFilters.srStatus)
    }

  return copy(
    filters = sanitizedFilters,
    filteredWorks = filtered,
    districtOptions = districtOptions,
    lacOptions = lacOptions,
    seOptions = seOptions,
    asStatusOptions = asStatusOptions,
    arStatusOptions = arStatusOptions,
    srStatusOptions = srStatusOptions,
    statusCounts = poolForStatusChips.groupingBy { it.statusCode }.eachCount(),
  )
}
