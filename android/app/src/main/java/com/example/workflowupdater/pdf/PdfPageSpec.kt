package com.example.workflowupdater.pdf

import kotlin.math.roundToInt

/** Fixed A3 landscape page dimensions for Android PDF export. */
object PdfPageSpec {
  private const val A3_WIDTH_MM = 297.0
  private const val A3_HEIGHT_MM = 420.0
  private const val A3_LANDSCAPE_WIDTH_MM = A3_HEIGHT_MM
  private const val A3_LANDSCAPE_HEIGHT_MM = A3_WIDTH_MM
  private const val LAYOUT_DPI = 96

  fun a3LandscapeWidthPx(): Int = mmToPx(A3_LANDSCAPE_WIDTH_MM)

  fun a3LandscapeHeightPx(): Int = mmToPx(A3_LANDSCAPE_HEIGHT_MM)

  /** Printable width inside 1 cm side margins on an A3 landscape page. */
  fun contentWidthPx(): Int = a3LandscapeWidthPx() - (2 * marginPx())

  private fun marginPx(): Int = mmToPx(10.0)

  private fun mmToPx(mm: Double, dpi: Int = LAYOUT_DPI): Int = (mm / 25.4 * dpi).roundToInt()
}
