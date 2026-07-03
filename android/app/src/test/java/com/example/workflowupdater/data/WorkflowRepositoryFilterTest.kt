package com.example.workflowupdater.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkflowRepositoryFilterTest {

  private fun filter(profile: EngineerProfile, rows: List<Map<String, String>> = sampleRows()): List<WorkItem> =
    filterRowsForProfile(rows, profile)

  @Test
  fun singleProfile_keepsRdoKkdAndMatchingAse() {
    val works = filter(SheetConfig.profileById("AD"))
    assertEquals(2, works.size)
    assertTrue(works.all { it.designOffice.contains("RDO KKD", ignoreCase = true) })
    assertTrue(works.all { it.ase.equals("AD", ignoreCase = true) })
  }

  @Test
  fun allProfile_keepsRdoKkdForEveryConfiguredEngineer() {
    val works = filter(SheetConfig.ALL_PROFILE)
    assertEquals(4, works.size)
    assertTrue(works.all { it.designOffice.contains("RDO KKD", ignoreCase = true) })
    assertTrue(works.map { it.ase.uppercase() }.toSet().containsAll(setOf("AD", "ASE01")))
  }

  @Test
  fun allProfile_excludesOtherOfficesAndUnknownAse() {
    val works = filter(SheetConfig.ALL_PROFILE)
    assertTrue(works.none { it.ase.equals("OTHER", ignoreCase = true) })
    assertTrue(works.none { it.designOffice.contains("RDO TCR", ignoreCase = true) })
  }

  private fun sampleRows(): List<Map<String, String>> =
    listOf(
      row(office = "RDO KKD", ase = "AD"),
      row(office = "RDO KKD", ase = "AD"),
      row(office = "RDO KKD", ase = "ASE01"),
      row(office = "RDO KKD", ase = "ASE01"),
      row(office = "RDO TCR", ase = "AD"),
      row(office = "RDO KKD", ase = "OTHER"),
    )

  private fun row(office: String, ase: String, rowNum: String = "1"): Map<String, String> =
    mapOf(
      "_rowNum" to rowNum,
      "Design Office" to office,
      "ASE" to ase,
      "Name of Work" to "Sample work",
      "Design Status" to "04 Detailed Design Ongoing",
    )
}
