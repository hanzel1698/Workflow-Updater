package com.example.workflowupdater.data

/** Outcome of a load attempt: the resolved list of works plus whether we had to fall back to
 *  cached or offline sample data because the live sheet couldn't be reached. */
data class WorkflowResult(val works: List<WorkItem>, val isOffline: Boolean, val errorMessage: String? = null)

interface WorkflowRepository {
  suspend fun loadWorks(profile: EngineerProfile): WorkflowResult
}

class DefaultWorkflowRepository(private val remote: SheetsRemoteDataSource = SheetsRemoteDataSource()) :
  WorkflowRepository {

  private val lastGoodByProfile = mutableMapOf<String, List<WorkItem>>()

  override suspend fun loadWorks(profile: EngineerProfile): WorkflowResult {
    val scriptUrl = profile.scriptUrl.ifBlank { SheetConfig.SCRIPT_URL }

    val result = remote.fetchSheet(scriptUrl)
    val response = result.getOrNull()
    if (response != null) {
      val works = filterAndNormalize(response.rows, profile)
      lastGoodByProfile[profile.id] = works
      return WorkflowResult(works = works, isOffline = false)
    }

    val cached = lastGoodByProfile[profile.id]
    if (cached != null) {
      return WorkflowResult(
        works = cached,
        isOffline = true,
        errorMessage = result.exceptionOrNull()?.message,
      )
    }

    val sample = filterAndNormalize(SheetConfig.MOCK_ROWS, profile)
    return WorkflowResult(
      works = sample,
      isOffline = true,
      errorMessage = result.exceptionOrNull()?.message ?: "Could not reach the live sheet",
    )
  }
}

/** Filters sheet rows to RDO KKD works for one engineer or all configured engineers. */
internal fun filterRowsForProfile(rows: List<Map<String, String>>, profile: EngineerProfile): List<WorkItem> {
  val targetOffice = SheetConfig.DESIGN_OFFICE.lowercase()
  val allowedAseIds =
    if (SheetConfig.isAllProfile(profile)) {
      SheetConfig.ENGINEER_PROFILE_IDS.map { it.lowercase() }.toSet()
    } else {
      setOf(profile.id.lowercase())
    }

  return rows
    .filter { row ->
      val office = rowValue(row, SheetConfig.Columns.DESIGN_OFFICE).lowercase()
      val ase = rowValue(row, SheetConfig.Columns.ASE).lowercase().trim()
      office.contains(targetOffice) && ase in allowedAseIds
    }
    .map(WorkItem::fromRow)
}

private fun DefaultWorkflowRepository.filterAndNormalize(rows: List<Map<String, String>>, profile: EngineerProfile): List<WorkItem> =
  filterRowsForProfile(rows, profile)
