package com.example.workflowupdater.data

import android.content.Context

/** Persists engineer profile choices: default on cold start, last session selection, and setup completion. */
class ProfilePrefs(context: Context) {
  private val prefs = context.getSharedPreferences("workflow_updater_prefs", Context.MODE_PRIVATE)

  var activeProfileId: String
    get() = prefs.getString(KEY_ACTIVE_PROFILE, SheetConfig.DEFAULT_PROFILE_ID) ?: SheetConfig.DEFAULT_PROFILE_ID
    set(value) = prefs.edit().putString(KEY_ACTIVE_PROFILE, value).apply()

  var defaultProfileId: String
    get() = prefs.getString(KEY_DEFAULT_PROFILE, SheetConfig.DEFAULT_PROFILE_ID) ?: SheetConfig.DEFAULT_PROFILE_ID
    private set(value) = prefs.edit().putString(KEY_DEFAULT_PROFILE, value).apply()

  val isDefaultProfileSetupComplete: Boolean
    get() = prefs.getBoolean(KEY_DEFAULT_PROFILE_SETUP_COMPLETE, false)

  /** Profile id used when the app opens after setup (default engineer or All). */
  fun launchProfileId(): String =
    if (isDefaultProfileSetupComplete) defaultProfileId else activeProfileId

  fun completeDefaultProfileSetup(profileId: String) {
    prefs
      .edit()
      .putString(KEY_DEFAULT_PROFILE, profileId)
      .putString(KEY_ACTIVE_PROFILE, profileId)
      .putBoolean(KEY_DEFAULT_PROFILE_SETUP_COMPLETE, true)
      .apply()
  }

  fun setDefaultProfile(profileId: String) {
    defaultProfileId = profileId
  }

  companion object {
    private const val KEY_ACTIVE_PROFILE = "active_profile_id"
    private const val KEY_DEFAULT_PROFILE = "default_profile_id"
    private const val KEY_DEFAULT_PROFILE_SETUP_COMPLETE = "default_profile_setup_complete"
  }
}
