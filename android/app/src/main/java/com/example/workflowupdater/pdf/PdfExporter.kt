package com.example.workflowupdater.pdf

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.FileProvider
import java.io.File

/**
 * Renders the HTML report in a hidden [WebView], writes it to a fixed A3 landscape PDF, then opens
 * it in the device's default PDF viewer.
 */
class PdfExporter(private val context: Context) {

  private var webView: WebView? = null
  private var exportInProgress = false

  fun attach(view: WebView) {
    webView = view
  }

  fun detach() {
    webView?.destroy()
    webView = null
  }

  /** Loads [html], writes a PDF named from [jobName], and opens it when ready. */
  fun exportReport(html: String, jobName: String, onComplete: () -> Unit, onError: (String) -> Unit) {
    val view = webView
    if (view == null) {
      onError("PDF renderer not ready")
      return
    }
    if (exportInProgress) return

    exportInProgress = true
    view.webViewClient =
      object : WebViewClient() {
        override fun onPageFinished(loadedView: WebView, url: String?) {
          loadedView.post {
            try {
              val pdfFile = pdfOutputFile(jobName)
              WebViewPdfWriter.writeA3Landscape(loadedView, pdfFile)
              openPdf(pdfFile)
              exportInProgress = false
              onComplete()
            } catch (e: Exception) {
              exportInProgress = false
              onError(e.message ?: "Could not create the PDF")
            }
          }
        }

        @Suppress("DEPRECATION")
        override fun onReceivedError(
          view: WebView?,
          errorCode: Int,
          description: String?,
          failingUrl: String?,
        ) {
          exportInProgress = false
          onError(description ?: "Could not render the report")
        }
      }
    view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
  }

  private fun pdfOutputFile(jobName: String): File {
    val reportsDir = File(context.cacheDir, "reports").apply { mkdirs() }
    val pdfFile = File(reportsDir, "${safeFileName(jobName)}.pdf")
    if (pdfFile.exists()) pdfFile.delete()
    return pdfFile
  }

  private fun openPdf(file: File) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent =
      Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/pdf")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        if (context !is Activity) {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      }
    try {
      context.startActivity(intent)
    } catch (_: ActivityNotFoundException) {
      throw IllegalStateException("No PDF viewer app found on this device")
    }
  }

  companion object {
    fun jobName(designation: String, engineerName: String): String =
      PdfReportBuilder.reportTitle(designation, engineerName)

    private fun safeFileName(jobName: String): String =
      jobName.replace(Regex("[\\\\/:*?\"<>|]"), "-").trim().ifBlank { "report" }
  }
}
