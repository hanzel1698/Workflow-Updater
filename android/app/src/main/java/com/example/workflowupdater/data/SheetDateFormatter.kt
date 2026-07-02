package com.example.workflowupdater.data

import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Formats raw date values from the live Google Sheet exactly as Google Sheets shows them: DD/MM/YYYY.
 *
 * The sheet delivers date cells as ISO-8601 instants (e.g. "2025-01-06T18:30:00.000Z"), which are
 * midnight in India Standard Time. They must be converted to Asia/Kolkata before extracting the
 * day/month/year, otherwise the displayed day is off by one. Non-date free text (e.g. a Target Date
 * like "After getting intimation from field officials") passes through unchanged.
 */
object SheetDateFormatter {
  private val KOLKATA: ZoneId = ZoneId.of("Asia/Kolkata")
  private val OUTPUT: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ROOT)

  /** Plain day/month/year already in the sheet's DD/MM/YYYY convention, e.g. "07/01/2025" or "7-1-2025". */
  private val DAY_MONTH_YEAR = Regex("""^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$""")

  /** ISO date without a time component, e.g. "2025-01-07". */
  private val ISO_DATE_ONLY = Regex("""^(\d{4})-(\d{1,2})-(\d{1,2})$""")

  fun format(raw: String): String {
    val str = raw.trim()
    if (str.isEmpty()) return ""

    // ISO-8601 timestamp (has a time component): parse as an instant and convert to Asia/Kolkata.
    if (str.contains('T')) {
      parseInstant(str)?.let { return it.atZone(KOLKATA).format(OUTPUT) }
    }

    // ISO date only ("2025-01-07"): no timezone shifting.
    ISO_DATE_ONLY.matchEntire(str)?.let { match ->
      val (year, month, day) = match.destructured
      return format(day.toInt(), month.toInt(), year.toInt())
    }

    // Plain day/month/year with "/" or "-": normalize/zero-pad, keep DD/MM/YYYY order.
    DAY_MONTH_YEAR.matchEntire(str)?.let { match ->
      val (day, month, year) = match.destructured
      return format(day.toInt(), month.toInt(), year.toInt())
    }

    // Anything else (free text like "After getting intimation from field officials"): unchanged.
    return str
  }

  private fun parseInstant(str: String): Instant? {
    runCatching { return OffsetDateTime.parse(str).toInstant() }
    runCatching { return Instant.parse(str) }
    return null
  }

  private fun format(day: Int, month: Int, year: Int): String =
    "%02d/%02d/%04d".format(Locale.ROOT, day, month, year)
}
