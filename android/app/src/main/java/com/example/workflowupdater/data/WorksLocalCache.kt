package com.example.workflowupdater.data

import android.content.Context
import android.util.Log
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Disk snapshot of the last successfully fetched workflow sheet. */
@Serializable
data class CachedSheetSnapshot(val syncedAtMillis: Long, val rows: List<Map<String, String>>)

/**
 * Persists the latest live sheet rows so the app can show real data after process death or when
 * the device has no internet. One shared snapshot covers every engineer profile — filtering still
 * happens at read time.
 */
interface WorksLocalCache {
  suspend fun save(rows: List<Map<String, String>>, syncedAtMillis: Long)

  suspend fun load(): CachedSheetSnapshot?
}

class FileWorksLocalCache(context: Context) : WorksLocalCache {
  private val cacheFile = File(context.applicationContext.filesDir, CACHE_RELATIVE_PATH)
  private val mutex = Mutex()
  private val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
  }

  override suspend fun save(rows: List<Map<String, String>>, syncedAtMillis: Long) {
    withContext(Dispatchers.IO) {
      mutex.withLock {
        runCatching {
          cacheFile.parentFile?.mkdirs()
          val snapshot = CachedSheetSnapshot(syncedAtMillis = syncedAtMillis, rows = rows)
          val temp = File(cacheFile.parentFile, "${cacheFile.name}.tmp")
          temp.writeText(json.encodeToString(CachedSheetSnapshot.serializer(), snapshot))
          if (!temp.renameTo(cacheFile)) {
            temp.copyTo(cacheFile, overwrite = true)
            temp.delete()
          }
        }
          .onFailure { Log.w(TAG, "Failed to persist offline sheet cache", it) }
      }
    }
  }

  override suspend fun load(): CachedSheetSnapshot? =
    withContext(Dispatchers.IO) {
      mutex.withLock {
        runCatching {
            if (!cacheFile.isFile || cacheFile.length() == 0L) return@runCatching null
            json.decodeFromString(CachedSheetSnapshot.serializer(), cacheFile.readText())
          }
          .onFailure { Log.w(TAG, "Failed to read offline sheet cache", it) }
          .getOrNull()
      }
    }

  companion object {
    private const val TAG = "WorksLocalCache"
    private const val CACHE_RELATIVE_PATH = "workflow_cache/sheet_snapshot.json"
  }
}
