package com.example.workflowupdater.ui.main

import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.data.StatusMapper
import com.example.workflowupdater.data.WorkItem
import org.junit.Assert.assertEquals
import org.junit.Test

class WorkflowLogicTest {

  @Test
  fun statusMapper_mapsCategoryCodes() {
    assertEquals("04 Detailed Design Ongoing", StatusMapper.mapCategoryToStatus("DDO", "", ""))
    assertEquals("07 File Not Yet Opened", StatusMapper.mapCategoryToStatus("FNO", "", ""))
  }

  @Test
  fun statusMapper_infersFromRemarksWhenBlank() {
    assertEquals("06 Detailed Design Issued", StatusMapper.mapCategoryToStatus("", "Design completed and issued", ""))
    assertEquals("07 File Not Yet Opened", StatusMapper.mapCategoryToStatus("", "Awaiting AR drawing", ""))
  }

  @Test
  fun statusMapper_passesThroughNumberedStatus() {
    assertEquals("02 Tentative Design On Hold", StatusMapper.mapCategoryToStatus("02 Tentative Design On Hold", "", ""))
  }

  @Test
  fun recomputeDerived_filtersBySearchAndStatus() {
    val works =
      SheetConfig.MOCK_ROWS.map(WorkItem::fromRow)
    val base = WorksUiState(isLoading = false, allWorks = works)

    val bySearch = base.copy(searchQuery = "family court").recomputeDerived()
    assertEquals(1, bySearch.filteredWorks.size)
    assertEquals("Construction of Family Court - Kasargod", bySearch.filteredWorks.first().workName)

    val byStatus = base.copy(filters = WorkFilters(statusCode = "07")).recomputeDerived()
    assertEquals(1, byStatus.filteredWorks.size)
  }

  @Test
  fun recomputeDerived_buildsDynamicFilterOptionsFromWorks() {
    val works = SheetConfig.MOCK_ROWS.map(WorkItem::fromRow)
    val state = WorksUiState(isLoading = false, allWorks = works).recomputeDerived()

    assert(state.districtOptions.isNotEmpty())
    assert(state.asStatusOptions.isNotEmpty())
    assert(state.asStatusOptions.all { option -> works.any { it.asStatus == option } })
    assert(state.arStatusOptions.all { option -> works.any { it.arStatus == option } })
    assert(state.srStatusOptions.all { option -> works.any { it.srStatus == option } })
  }

  @Test
  fun recomputeDerived_cascadesFilterOptionsWhenDistrictSelected() {
    val works = SheetConfig.MOCK_ROWS.map(WorkItem::fromRow)
    val district = works.first().district
    val state =
      WorksUiState(isLoading = false, allWorks = works, filters = WorkFilters(district = district))
        .recomputeDerived()

    val lacsInDistrict =
      works.filter { it.district == district }.map { it.lac }.filter { it.isNotBlank() }.distinct().sorted()
    assertEquals(lacsInDistrict, state.lacOptions)
  }

  @Test
  fun recomputeDerived_clearsInvalidFilterSelections() {
    val works = SheetConfig.MOCK_ROWS.map(WorkItem::fromRow)
    val state =
      WorksUiState(isLoading = false, allWorks = works, filters = WorkFilters(district = "Nonexistent District"))
        .recomputeDerived()

    assertEquals(null, state.filters.district)
  }

  @Test
  fun recomputeDerived_countsStatusesFromFilteredPool() {
    val works = SheetConfig.MOCK_ROWS.map(WorkItem::fromRow)
    val state = WorksUiState(isLoading = false, allWorks = works).recomputeDerived()
    val total = state.statusCounts.values.sum()
    assertEquals(works.size, total)

    val district = works.first().district
    val narrowed =
      WorksUiState(isLoading = false, allWorks = works, filters = WorkFilters(district = district))
        .recomputeDerived()
    val expectedPool = works.filter { it.district == district }
    val expectedTotal = expectedPool.size
    assertEquals(expectedTotal, narrowed.statusCounts.values.sum())
    assert(narrowed.statusCounts.keys.all { code -> expectedPool.any { it.statusCode == code } })
  }
}
