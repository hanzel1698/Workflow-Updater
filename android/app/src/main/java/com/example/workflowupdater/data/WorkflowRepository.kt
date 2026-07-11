package com.example.workflowupdater.data

/** Outcome of a load attempt: the resolved list of works plus whether we had to fall back to
 *  cached or offline sample data because the live sheet couldn't be reached. */
data class WorkflowResult(
  val works: List<WorkItem>,
  val isOffline: Boolean,
  val errorMessage: String? = null,
  val lastSyncedAtMillis: Long? = null,
)

interface WorkflowRepository {
  /** Instantly returns the last good data from memory/disk (no network). */
  suspend fun loadCachedWorks(profile: EngineerProfile): WorkflowResult?

  /** Fetches the live sheet, persisting success; falls back to cache then sample on failure. */
  suspend fun loadWorks(profile: EngineerProfile): WorkflowResult
}

class DefaultWorkflowRepository(
  private val remote: SheetDataSource = SheetsRemoteDataSource(),
  private val localCache: WorksLocalCache? = null,
) : WorkflowRepository {

  private var lastGoodRows: List<Map<String, String>>? = null
  private var lastSyncedAtMillis: Long? = null
  private var diskWarmed = false

  override suspend fun loadCachedWorks(profile: EngineerProfile): WorkflowResult? {
    val rows = memoryOrDiskRows() ?: return null
    return WorkflowResult(
      works = filterAndNormalize(rows, profile),
      isOffline = true,
      lastSyncedAtMillis = lastSyncedAtMillis,
    )
  }

  override suspend fun loadWorks(profile: EngineerProfile): WorkflowResult {
    val scriptUrl = profile.scriptUrl.ifBlank { SheetConfig.SCRIPT_URL }

    val result = remote.fetchSheet(scriptUrl)
    val response = result.getOrNull()
    if (response != null) {
      val syncedAt = System.currentTimeMillis()
      rememberRows(response.rows, syncedAt)
      localCache?.save(response.rows, syncedAt)
      return WorkflowResult(
        works = filterAndNormalize(response.rows, profile),
        isOffline = false,
        lastSyncedAtMillis = syncedAt,
      )
    }

    val cachedRows = memoryOrDiskRows()
    if (cachedRows != null) {
      return WorkflowResult(
        works = filterAndNormalize(cachedRows, profile),
        isOffline = true,
        errorMessage = result.exceptionOrNull()?.message,
        lastSyncedAtMillis = lastSyncedAtMillis,
      )
    }

    val sample = filterAndNormalize(SheetConfig.MOCK_ROWS, profile)
    return WorkflowResult(
      works = sample,
      isOffline = true,
      errorMessage = result.exceptionOrNull()?.message ?: "Could not reach the live sheet",
      lastSyncedAtMillis = null,
    )
  }

  private suspend fun memoryOrDiskRows(): List<Map<String, String>>? {
    lastGoodRows?.let { return it }
    if (diskWarmed || localCache == null) return null
    diskWarmed = true
    val snapshot = localCache.load() ?: return null
    rememberRows(snapshot.rows, snapshot.syncedAtMillis)
    return snapshot.rows
  }

  private fun rememberRows(rows: List<Map<String, String>>, syncedAtMillis: Long) {
    lastGoodRows = rows
    lastSyncedAtMillis = syncedAtMillis
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
