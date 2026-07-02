package com.example.workflowupdater.data

import android.content.Context

/** Persists which engineer profile was last selected, so the app reopens on the same view. */
class ProfilePrefs(context: Context) {
  private val prefs = context.getSharedPreferences("workflow_updater_prefs", Context.MODE_PRIVATE)

  var activeProfileId: String
    get() = prefs.getString(KEY_ACTIVE_PROFILE, SheetConfig.DEFAULT_PROFILE_ID) ?: SheetConfig.DEFAULT_PROFILE_ID
    set(value) = prefs.edit().putString(KEY_ACTIVE_PROFILE, value).apply()

  companion object {
    private const val KEY_ACTIVE_PROFILE = "active_profile_id"
  }
}
