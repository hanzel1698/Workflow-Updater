package com.example.workflowupdater

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.example.workflowupdater.releasenotes.WhatsNewGate
import com.example.workflowupdater.theme.WorkflowUpdaterTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      WorkflowUpdaterTheme {
        WhatsNewGate { MainNavigation() }
      }
    }
  }
}
