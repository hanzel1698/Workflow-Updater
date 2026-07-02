package com.example.workflowupdater.pdf

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.ContextWrapper
import android.content.Intent
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.core.content.FileProvider
import java.io.File

/**
 * Renders the HTML report in a temporary off-screen [WebView], writes it to a fixed A3 landscape
 * PDF, then opens it in the device's default PDF viewer.
 */
class PdfExporter(private val context: Context) {

  private var exportInProgress = false

  /** Loads [html], writes a PDF named from [jobName], and opens it when ready. */
  fun exportReport(html: String, jobName: String, onComplete: () -> Unit, onError: (String) -> Unit) {
    if (exportInProgress) return

    val activity = context.findActivity()
    if (activity == null) {
      onError("PDF export requires an active screen")
      return
    }

    exportInProgress = true

    val pageWidthPx = PdfPageSpec.a3LandscapeWidthPx()

    val container =
      FrameLayout(activity).apply {
        layoutParams =
          FrameLayout.LayoutParams(
            pageWidthPx,
            ViewGroup.LayoutParams.WRAP_CONTENT,
          ).apply {
            leftMargin = -pageWidthPx * 2
            topMargin = 0
          }
        alpha = 0.01f
        importantForAccessibility = FrameLayout.IMPORTANT_FOR_ACCESSIBILITY_NO
      }

    val webView =
      WebView(activity).apply {
        settings.apply {
          javaScriptEnabled = false
          useWideViewPort = true
          loadWithOverviewMode = false
          defaultTextEncodingName = "utf-8"
        }
        setInitialScale(100)
        setLayerType(WebView.LAYER_TYPE_SOFTWARE, null)
      }

    container.addView(
      webView,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT),
    )

    val root = activity.window.decorView as ViewGroup
    root.addView(container)

    fun cleanup() {
      exportInProgress = false
      root.removeView(container)
      webView.destroy()
    }

    webView.webViewClient =
      object : WebViewClient() {
        override fun onPageFinished(loadedView: WebView, url: String?) {
          loadedView.postDelayed({
            try {
              val pdfFile = pdfOutputFile(jobName)
              WebViewPdfWriter.writeA3Landscape(loadedView, pdfFile)
              openPdf(pdfFile)
              onComplete()
            } catch (e: Exception) {
              onError(e.message ?: "Could not create the PDF")
            } finally {
              cleanup()
            }
          }, 450)
        }

        @Suppress("DEPRECATION")
        override fun onReceivedError(
          view: WebView?,
          errorCode: Int,
          description: String?,
          failingUrl: String?,
        ) {
          cleanup()
          onError(description ?: "Could not render the report")
        }
      }

    webView.loadDataWithBaseURL("about:blank", html, "text/html", "UTF-8", null)
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

private fun Context.findActivity(): Activity? {
  var current: Context? = this
  while (current is ContextWrapper) {
    if (current is Activity) return current
    current = current.baseContext
  }
  return null
}
