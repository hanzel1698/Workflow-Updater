package com.example.workflowupdater.releasenotes

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext

@Composable
fun WhatsNewGate(content: @Composable () -> Unit) {
    val context = LocalContext.current
    var notes by remember { mutableStateOf<ReleaseNotes?>(null) }
    var showWhatsNew by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val loaded = ReleaseNotesRepository.load(context)
        notes = loaded
        showWhatsNew = loaded?.let { ReleaseNotesRepository.shouldShow(context, it) } == true
    }

    if (showWhatsNew && notes != null) {
        WhatsNewScreen(
            notes = notes!!,
            onContinue = {
                ReleaseNotesRepository.markSeen(context, notes!!.versionCode)
                showWhatsNew = false
            },
        )
    } else {
        content()
    }
}
