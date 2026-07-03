package com.example.workflowupdater.ui.main

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.example.workflowupdater.data.ProfilePrefs

/** One-time gate shown after install or update until the user picks a default engineer profile. */
@Composable
fun DefaultProfileGate(content: @Composable () -> Unit) {
  val context = LocalContext.current
  val profilePrefs = remember { ProfilePrefs(context.applicationContext) }
  var setupComplete by remember { mutableStateOf(profilePrefs.isDefaultProfileSetupComplete) }

  if (setupComplete) {
    content()
  } else {
    DefaultProfileSetupScreen(
      onContinue = { profile ->
        profilePrefs.completeDefaultProfileSetup(profile.id)
        setupComplete = true
      },
    )
  }
}
