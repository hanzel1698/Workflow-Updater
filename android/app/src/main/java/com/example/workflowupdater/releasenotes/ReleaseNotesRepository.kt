package com.example.workflowupdater.releasenotes

import android.content.Context
import androidx.core.content.pm.PackageInfoCompat
import kotlinx.serialization.json.Json

object ReleaseNotesRepository {
    private const val PREFS_NAME = "release_notes_prefs"
    private const val KEY_LAST_SEEN_VERSION_CODE = "last_seen_version_code"
    private const val ASSET_FILE = "release_notes.json"

    private val json = Json { ignoreUnknownKeys = true }

    fun load(context: Context): ReleaseNotes? {
        return runCatching {
            context.assets.open(ASSET_FILE).bufferedReader().use { reader ->
                json.decodeFromString(ReleaseNotes.serializer(), reader.readText())
            }
        }.getOrNull()
    }

    fun shouldShow(context: Context, notes: ReleaseNotes): Boolean {
        if (notes.versionCode <= 0 || notes.features.isEmpty()) {
            return false
        }
        val currentVersionCode = currentAppVersionCode(context)
        if (notes.versionCode != currentVersionCode) {
            return false
        }
        return notes.versionCode > lastSeenVersionCode(context)
    }

    fun markSeen(context: Context, versionCode: Int) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_LAST_SEEN_VERSION_CODE, versionCode)
            .apply()
    }

    private fun lastSeenVersionCode(context: Context): Int {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getInt(KEY_LAST_SEEN_VERSION_CODE, 0)
    }

    private fun currentAppVersionCode(context: Context): Int {
        val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
        return PackageInfoCompat.getLongVersionCode(packageInfo).toInt()
    }
}
