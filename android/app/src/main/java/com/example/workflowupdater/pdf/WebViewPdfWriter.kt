package com.example.workflowupdater.pdf

import android.graphics.Color
import android.graphics.pdf.PdfDocument
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max

/** Writes a loaded [WebView] to a multi-page A3 landscape PDF without the system print UI. */
object WebViewPdfWriter {

  private const val MIN_PDF_BYTES = 2_048L

  fun writeA3Landscape(webView: WebView, outputFile: File) {
    WebView.enableSlowWholeDocumentDraw()

    val pageWidthPx = PdfPageSpec.a3LandscapeWidthPx()
    val pageHeightPx = PdfPageSpec.a3LandscapeHeightPx()

    webView.setLayerType(WebView.LAYER_TYPE_SOFTWARE, null)
    webView.layoutParams = ViewGroup.LayoutParams(pageWidthPx, ViewGroup.LayoutParams.WRAP_CONTENT)

    webView.measure(
      View.MeasureSpec.makeMeasureSpec(pageWidthPx, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
    )

    val scaledContentHeight = (webView.contentHeight * webView.scale).toInt()
    val contentHeightPx =
      max(max(webView.measuredHeight, scaledContentHeight), pageHeightPx)

    webView.layout(0, 0, pageWidthPx, contentHeightPx)

    val document = PdfDocument()
    var pageNumber = 1
    var yOffset = 0

    try {
      while (yOffset < contentHeightPx) {
        val pageInfo = PdfDocument.PageInfo.Builder(pageWidthPx, pageHeightPx, pageNumber).create()
        val page = document.startPage(pageInfo)
        page.canvas.apply {
          drawColor(Color.WHITE)
          save()
          translate(0f, -yOffset.toFloat())
          webView.draw(this)
          restore()
        }
        document.finishPage(page)
        yOffset += pageHeightPx
        pageNumber++
      }

      FileOutputStream(outputFile).use { document.writeTo(it) }
    } finally {
      document.close()
    }

    if (!outputFile.exists() || outputFile.length() < MIN_PDF_BYTES) {
      outputFile.delete()
      throw IllegalStateException("Generated PDF was empty — report content did not render")
    }
  }
}
