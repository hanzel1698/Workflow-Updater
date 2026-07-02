package com.example.workflowupdater.pdf

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/** Returns a [PdfExporter] that creates a temporary off-screen WebView for each export. */
@Composable
fun rememberPdfExporter(): PdfExporter {
  val context = LocalContext.current
  return remember(context) { PdfExporter(context) }
}
