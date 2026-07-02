package com.example.workflowupdater.pdf

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Renders an HTML report through the platform print pipeline via [PrintManager].
 *
 * Going through the print framework (rather than drawing to a canvas) means the report's print
 * CSS — A3 landscape `@page`, table borders and `page-break` rules — is honoured, so the output
 * is a pixel-faithful match for the Windows dashboard's print preview. The resulting preview lets
 * the user "Save as PDF" and immediately share it to other apps.
 */
class PdfExporter(private val context: Context) {

  private var webView: WebView? = null

  fun attach(view: WebView) {
    webView = view
  }

  fun detach() {
    webView?.destroy()
    webView = null
  }

  /** Loads [html] and, once ready, opens the print preview for the report. [onStarted] fires as
   *  soon as the preview has been requested so the caller can clear any loading state. */
  fun printReport(html: String, jobName: String, onStarted: () -> Unit, onError: (String) -> Unit) {
    val view = webView
    if (view == null) {
      onError("PDF renderer not ready")
      return
    }

    view.webViewClient =
      object : WebViewClient() {
        override fun onPageFinished(loadedView: WebView, url: String?) {
          try {
            val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager
            if (printManager == null) {
              onError("Printing is not supported on this device")
              return
            }
            val adapter = loadedView.createPrintDocumentAdapter(jobName)
            val attributes =
              PrintAttributes.Builder()
                .setMediaSize(PrintAttributes.MediaSize.ISO_A3.asLandscape())
                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                .build()
            printManager.print(jobName, adapter, attributes)
            onStarted()
          } catch (e: Exception) {
            onError(e.message ?: "Could not open the PDF preview")
          }
        }
      }
    view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
  }

  companion object {
    fun jobName(profileId: String): String = "Workflow Report ($profileId)"
  }
}
