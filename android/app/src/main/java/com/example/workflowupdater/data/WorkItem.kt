package com.example.workflowupdater.data

/** Looks up [keys] (in priority order) inside [row], matching header names case-insensitively. */
fun rowValue(row: Map<String, String>, keys: List<String>): String {
  for (key in keys) {
    row[key]?.let { if (it.isNotBlank()) return it }
    for ((k, v) in row) {
      if (k.equals(key, ignoreCase = true) && v.isNotBlank()) return v
    }
  }
  return ""
}

/** Maps a raw category code (e.g. "TDO") or free-text status to one of the nine canonical
 *  design-status strings. Ported from `mapCategoryToStatus` in windows/app.js. */
object StatusMapper {
  fun mapCategoryToStatus(category: String, remarks: String, presentStatus: String): String {
    val cat = category.trim()
    if (cat.isEmpty()) {
      return inferFromText(remarks, presentStatus)
    }

    return when (cat.uppercase()) {
      "TDO" -> SheetConfig.STATUS_OPTIONS[0]
      "TDOH" -> SheetConfig.STATUS_OPTIONS[1]
      "TDI" -> SheetConfig.STATUS_OPTIONS[2]
      "DDO" -> SheetConfig.STATUS_OPTIONS[3]
      "DDOH" -> SheetConfig.STATUS_OPTIONS[4]
      "DDI" -> SheetConfig.STATUS_OPTIONS[5]
      "FNO" -> SheetConfig.STATUS_OPTIONS[6]
      "DISCARDED" -> SheetConfig.STATUS_OPTIONS[7]
      "RETURNED" -> SheetConfig.STATUS_OPTIONS[8]
      else -> {
        SheetConfig.STATUS_OPTIONS.find { it.equals(cat, ignoreCase = true) }?.let { return it }
        if (cat.length >= 2 && cat.take(2).all { it.isDigit() }) {
          SheetConfig.STATUS_OPTIONS.find { it.startsWith(cat.take(2)) }?.let { return it }
        }
        inferFromText(remarks, presentStatus)
      }
    }
  }

  private fun inferFromText(remarks: String, presentStatus: String): String {
    val text = "$remarks $presentStatus".lowercase()
    return if ("complete" in text || "despatched" in text || "issued" in text) {
      SheetConfig.STATUS_OPTIONS[5]
    } else {
      SheetConfig.STATUS_OPTIONS[6]
    }
  }

  /** The two-digit prefix ("01".."09") used for KPI counters and quick filter chips. */
  fun codeOf(status: String): String = status.trim().take(2).ifBlank { "07" }
}

/**
 * A single row from the live workflow sheet, normalized against [SheetConfig.Columns] so the UI
 * never has to worry about the sheet's exact header spelling.
 */
data class WorkItem(val rowNum: Int, val raw: Map<String, String>) {
  val fileNumber: String get() = rowValue(raw, SheetConfig.Columns.FILE_NUMBER)
  val workName: String get() = rowValue(raw, SheetConfig.Columns.WORK_NAME).ifBlank { "Untitled Work" }
  val district: String get() = rowValue(raw, SheetConfig.Columns.DISTRICT)
  val lac: String get() = rowValue(raw, SheetConfig.Columns.LAC)
  val asStatus: String get() = rowValue(raw, SheetConfig.Columns.AS_STATUS)
  val arStatus: String get() = rowValue(raw, SheetConfig.Columns.AR_STATUS)
  val srStatus: String get() = rowValue(raw, SheetConfig.Columns.SR_STATUS)
  val designOffice: String get() = rowValue(raw, SheetConfig.Columns.DESIGN_OFFICE)
  val floors: String get() = rowValue(raw, SheetConfig.Columns.FLOORS)
  val area: String get() = rowValue(raw, SheetConfig.Columns.AREA)
  val ase: String get() = rowValue(raw, SheetConfig.Columns.ASE)
  val se: String get() = rowValue(raw, SheetConfig.Columns.SE)
  val remarks: String get() = rowValue(raw, SheetConfig.Columns.REMARKS)
  val shortRemarks: String get() = rowValue(raw, SheetConfig.Columns.SHORT_REMARKS)
  val targetDate: String get() = rowValue(raw, SheetConfig.Columns.TARGET_DATE)
  val clientDept: String get() = rowValue(raw, SheetConfig.Columns.CLIENT_DEPT)
  val tentativeIssuedDate: String get() = rowValue(raw, SheetConfig.Columns.TENTATIVE_ISSUED_DATE)
  val detailedLastIssuedDate: String get() = rowValue(raw, SheetConfig.Columns.DETAILED_LAST_ISSUED_DATE)
  val detailedCompleteIssuedDate: String get() = rowValue(raw, SheetConfig.Columns.DETAILED_COMPLETE_ISSUED_DATE)
  val asOrder: String get() = rowValue(raw, SheetConfig.Columns.AS_ORDER)
  val asDate: String get() = rowValue(raw, SheetConfig.Columns.AS_DATE)
  val tsOrder: String get() = rowValue(raw, SheetConfig.Columns.TS_ORDER)
  val tsDate: String get() = rowValue(raw, SheetConfig.Columns.TS_DATE)
  val eeRiqclRemarks: String get() = rowValue(raw, SheetConfig.Columns.EE_RIQCL_REMARKS)
  val architectureRemarks: String get() = rowValue(raw, SheetConfig.Columns.ARCHITECTURE_REMARKS)

  /** Normalized full status string, e.g. "06 Detailed Design Issued". */
  val status: String by lazy {
    StatusMapper.mapCategoryToStatus(rowValue(raw, SheetConfig.Columns.STATUS), remarks, rowValue(raw, SheetConfig.Columns.PRESENT_STATUS))
  }

  val statusCode: String get() = StatusMapper.codeOf(status)

  /** Any populated column that isn't part of the known schema, for the detail screen's
   *  "Additional Information" section. Keeps the app resilient to sheet columns we don't know about. */
  val extraFields: List<Pair<String, String>> by lazy {
    val knownNames = SheetConfig.Columns.ALL_KNOWN.flatten().map { it.lowercase() }.toSet()
    raw.entries
      .filter { (k, v) -> k != "_rowNum" && v.isNotBlank() && k.lowercase() !in knownNames }
      .map { it.key to it.value }
  }

  companion object {
    fun fromRow(row: Map<String, String>): WorkItem {
      val rowNum = row["_rowNum"]?.toDoubleOrNull()?.toInt() ?: -1
      return WorkItem(rowNum = rowNum, raw = row)
    }
  }
}
