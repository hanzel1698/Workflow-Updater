package com.example.workflowupdater.data

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class WorkflowRepositoryOfflineCacheTest {

  @Test
  fun loadWorks_persistsSuccessfulFetchAndServesItOffline() = runTest {
    val cache = InMemoryWorksLocalCache()
    val liveRows =
      listOf(
        row(office = "RDO KKD", ase = "AD", name = "Live Bridge Work", rowNum = "11"),
        row(office = "RDO KKD", ase = "ASE01", name = "Other Engineer Work", rowNum = "12"),
      )
    val remote = FakeSheetDataSource(Result.success(RawSheetResponse(headers = emptyList(), rows = liveRows)))
    val repository = DefaultWorkflowRepository(remote = remote, localCache = cache)

    val online = repository.loadWorks(SheetConfig.profileById("AD"))
    assertFalse(online.isOffline)
    assertEquals(1, online.works.size)
    assertEquals("Live Bridge Work", online.works.first().workName)
    assertNotNull(online.lastSyncedAtMillis)
    assertNotNull(cache.load())

    remote.next = Result.failure(IllegalStateException("offline"))
    val offline = repository.loadWorks(SheetConfig.profileById("AD"))
    assertTrue(offline.isOffline)
    assertEquals(1, offline.works.size)
    assertEquals("Live Bridge Work", offline.works.first().workName)
    assertEquals(online.lastSyncedAtMillis, offline.lastSyncedAtMillis)
  }

  @Test
  fun loadWorks_readsDiskCacheWhenMemoryIsCold() = runTest {
    val syncedAt = 1_700_000_000_000L
    val cache =
      InMemoryWorksLocalCache(
        CachedSheetSnapshot(
          syncedAtMillis = syncedAt,
          rows = listOf(row(office = "RDO KKD", ase = "AD", name = "Cached Road Work", rowNum = "21")),
        ),
      )
    val remote = FakeSheetDataSource(Result.failure(IllegalStateException("no network")))
    val repository = DefaultWorkflowRepository(remote = remote, localCache = cache)

    val result = repository.loadWorks(SheetConfig.profileById("AD"))
    assertTrue(result.isOffline)
    assertEquals(1, result.works.size)
    assertEquals("Cached Road Work", result.works.first().workName)
    assertEquals(syncedAt, result.lastSyncedAtMillis)
  }

  @Test
  fun loadCachedWorks_returnsNullWhenNothingSaved() = runTest {
    val repository =
      DefaultWorkflowRepository(
        remote = FakeSheetDataSource(Result.failure(IllegalStateException("offline"))),
        localCache = InMemoryWorksLocalCache(),
      )
    assertNull(repository.loadCachedWorks(SheetConfig.profileById("AD")))
  }

  @Test
  fun loadCachedWorks_filtersSharedSnapshotForSelectedProfile() = runTest {
    val cache =
      InMemoryWorksLocalCache(
        CachedSheetSnapshot(
          syncedAtMillis = 42L,
          rows =
            listOf(
              row(office = "RDO KKD", ase = "AD", name = "AD Work", rowNum = "1"),
              row(office = "RDO KKD", ase = "ASE01", name = "ASE01 Work", rowNum = "2"),
            ),
        ),
      )
    val repository =
      DefaultWorkflowRepository(
        remote = FakeSheetDataSource(Result.failure(IllegalStateException("offline"))),
        localCache = cache,
      )

    val ad = repository.loadCachedWorks(SheetConfig.profileById("AD"))
    assertNotNull(ad)
    assertEquals(listOf("AD Work"), ad!!.works.map { it.workName })

    val ase = repository.loadCachedWorks(SheetConfig.profileById("ASE01"))
    assertNotNull(ase)
    assertEquals(listOf("ASE01 Work"), ase!!.works.map { it.workName })
  }

  @Test
  fun loadWorks_fallsBackToSampleOnlyWhenNoCacheExists() = runTest {
    val repository =
      DefaultWorkflowRepository(
        remote = FakeSheetDataSource(Result.failure(IllegalStateException("offline"))),
        localCache = InMemoryWorksLocalCache(),
      )

    val result = repository.loadWorks(SheetConfig.profileById("AD"))
    assertTrue(result.isOffline)
    assertTrue(result.works.isNotEmpty())
    assertNull(result.lastSyncedAtMillis)
    // Sample/mock data, not a previously synced live snapshot.
    assertTrue(result.works.any { it.workName.contains("Family Court", ignoreCase = true) })
  }

  private fun row(office: String, ase: String, name: String, rowNum: String): Map<String, String> =
    mapOf(
      "_rowNum" to rowNum,
      "Design Office" to office,
      "ASE" to ase,
      "Name of Work" to name,
      "Design Status" to "04 Detailed Design Ongoing",
    )

  private class FakeSheetDataSource(var next: Result<RawSheetResponse>) : SheetDataSource {
    override suspend fun fetchSheet(scriptUrl: String): Result<RawSheetResponse> = next
  }

  private class InMemoryWorksLocalCache(initial: CachedSheetSnapshot? = null) : WorksLocalCache {
    private var snapshot: CachedSheetSnapshot? = initial

    override suspend fun save(rows: List<Map<String, String>>, syncedAtMillis: Long) {
      snapshot = CachedSheetSnapshot(syncedAtMillis = syncedAtMillis, rows = rows)
    }

    override suspend fun load(): CachedSheetSnapshot? = snapshot
  }
}
