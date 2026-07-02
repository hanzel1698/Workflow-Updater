package com.example.workflowupdater.pdf

import android.webkit.WebView
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

/** Hosts an invisible, zero-size [WebView] that backs [PdfExporter], since a WebView must be
 *  attached to the window to reliably render the report HTML before it is written to PDF. Place
 *  this once near the root of the composition and reuse the returned [PdfExporter] for every export. */
@Composable
fun rememberPdfExporter(): PdfExporter {
  val context = LocalContext.current
  val exporter = remember { PdfExporter(context) }

  AndroidView(
    modifier = Modifier.size(0.dp),
    factory = { ctx ->
      WebView(ctx).also { webView ->
        webView.settings.apply {
          javaScriptEnabled = false
          useWideViewPort = true
          loadWithOverviewMode = false
        }
        exporter.attach(webView)
      }
    },
  )

  DisposableEffect(Unit) { onDispose { exporter.detach() } }

  return exporter
}
