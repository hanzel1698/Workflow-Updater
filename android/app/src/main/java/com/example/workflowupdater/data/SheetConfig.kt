package com.example.workflowupdater.data

/** One engineer whose works can be viewed. Mirrors `PROFILES` in windows/config.js. */
data class EngineerProfile(val id: String, val name: String, val email: String = "", val scriptUrl: String = "")

/**
 * Central configuration for the live Google Sheet integration, ported from the desktop
 * app's `windows/config.js` so both clients stay pointed at the same spreadsheet, the same
 * engineer roster and the same column layout.
 */
object SheetConfig {

  /** Apps Script Web App URL used when a profile doesn't define its own. */
  const val SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbypzZxZAa0BdbsjA7hYXt02HStBrcwFsTLokgj_m9lHJfRuMGxRNOYZg8f1fstV2Fu5/exec"

  const val SPREADSHEET_ID = "1tDBZGfYmtEQLwepDHDVwd2pAT_-qvIoJxVYG8Ub6vI8"
  const val SHEET_NAME = "WORKFLOW MONITORING SHEET"
  const val DESIGN_OFFICE = "RDO KKD"
  const val DEFAULT_PROFILE_ID = "AD"

  val PROFILES =
    listOf(
      EngineerProfile(id = "AD", name = "Hanzel H. Fernandez (AD)", email = "ad.rdokk@gmail.com"),
      EngineerProfile(id = "ASE01", name = "ASE01"),
      EngineerProfile(id = "ASE02", name = "ASE02"),
      EngineerProfile(id = "ASE03", name = "ASE03"),
      EngineerProfile(id = "AHE01", name = "AHE01"),
      EngineerProfile(id = "AHE02", name = "AHE02"),
    )

  fun profileById(id: String): EngineerProfile = PROFILES.find { it.id == id } ?: PROFILES.first()

  /** The nine canonical design-status categories used for grouping, filtering and KPIs. */
  val STATUS_OPTIONS =
    listOf(
      "01 Tentative Design Ongoing",
      "02 Tentative Design On Hold",
      "03 Tentative Design Issued",
      "04 Detailed Design Ongoing",
      "05 Detailed Design On Hold",
      "06 Detailed Design Issued",
      "07 File Not Yet Opened",
      "08 Discarded Work",
      "09 Returned to Site",
    )

  /** Short human labels for the KPI chips, keyed by the two-digit status code. */
  val STATUS_SHORT_LABELS =
    mapOf(
      "01" to "Tentative Ongoing",
      "02" to "Tentative On Hold",
      "03" to "Tentative Issued",
      "04" to "Detailed Ongoing",
      "05" to "Detailed On Hold",
      "06" to "Detailed Issued",
      "07" to "File Not Opened",
      "08" to "Discarded",
      "09" to "Returned to Site",
    )

  /** Fallback dropdown option lists, mirrored from `MOCK_DROPDOWNS` in windows/config.js. */
  val FALLBACK_AS_STATUS = listOf("Yes", "No", "No Details Available", "Revised AS Awaited", "Budget Provision")
  val FALLBACK_AR_STATUS = listOf("Received", "Not Received", "Rev AR Awaited", "Rev AR Received", "Sketch AR Received")
  val FALLBACK_SR_STATUS = listOf("Received", "Not Received", "Rev SR Awaited", "Rev SR Received")

  /** Column name fallbacks. Sheets sometimes rename headers, so every logical field is
   *  resolved against a list of candidate header names, matched case-insensitively. */
  object Columns {
    val FILE_NUMBER = listOf("Sl. No.", "e-Office File Number")
    val WORK_NAME = listOf("Name of Work", "Work Name")
    val DISTRICT = listOf("Districts", "District")
    val LAC = listOf("LAC")
    val AS_STATUS = listOf("AS STATUS", "AS Status")
    val AR_STATUS = listOf("AR STATUS", "AR Status")
    val SR_STATUS = listOf("SR STATUS", "SR Status")
    val DESIGN_OFFICE = listOf("DESIGN OFFICE", "Design Office")
    val STATUS = listOf("CATEGORY", "Design Status")
    val FLOORS = listOf("No. of Floors", "Floors")
    val AREA = listOf("Total area in m2", "Area")
    val ASE = listOf("ASE")
    val SE = listOf("SE")
    val REMARKS = listOf("REMARKS OF DESIGN UNITS", "Remarks by Building Design Unit", "Remarks")
    val TARGET_DATE = listOf("Target dates", "Target Date")
    val CLIENT_DEPT = listOf("Client Department")
    val TENTATIVE_ISSUED_DATE = listOf("Tentative Issued Date")
    val DETAILED_LAST_ISSUED_DATE = listOf("Detailed Design Last Issued Date")
    val DETAILED_COMPLETE_ISSUED_DATE = listOf("Detailed Design Complete Issued Date")
    val PRESENT_STATUS = listOf("PRESENT STATUS OF WORK")
    val AS_ORDER = listOf("AS Order No & Date")
    val AS_DATE = listOf("AS Date")
    val TS_ORDER = listOf("TS Order No and date")
    val TS_DATE = listOf("TS Date")
    val SHORT_REMARKS = listOf("Remarks")
    val EE_RIQCL_REMARKS = listOf("Remarks of EE RIQCL")
    val ARCHITECTURE_REMARKS = listOf("REMARKS OF ARCHITECTURE WING")

    /** Every column considered "known" — anything else found on a row is shown as extra info. */
    val ALL_KNOWN: List<List<String>> =
      listOf(
        FILE_NUMBER,
        WORK_NAME,
        DISTRICT,
        LAC,
        AS_STATUS,
        AR_STATUS,
        SR_STATUS,
        DESIGN_OFFICE,
        STATUS,
        FLOORS,
        AREA,
        ASE,
        SE,
        REMARKS,
        TARGET_DATE,
        CLIENT_DEPT,
        TENTATIVE_ISSUED_DATE,
        DETAILED_LAST_ISSUED_DATE,
        DETAILED_COMPLETE_ISSUED_DATE,
        PRESENT_STATUS,
        AS_ORDER,
        AS_DATE,
        TS_ORDER,
        TS_DATE,
        SHORT_REMARKS,
        EE_RIQCL_REMARKS,
        ARCHITECTURE_REMARKS,
      )
  }

  /** A small, high-fidelity offline sample so the app remains useful without network access. */
  val MOCK_ROWS: List<Map<String, String>> =
    listOf(
      mapOf(
        "_rowNum" to "588",
        "Name of Work" to "PWD Rest house at Vadakkanchery",
        "District" to "09 Palakkad",
        "LAC" to "Tarur",
        "AS Status" to "Yes",
        "AR Status" to "Received",
        "SR Status" to "Received",
        "Design Office" to "RDO KKD",
        "Design Status" to "06 Detailed Design Issued",
        "No. of Floors" to "G+1",
        "Total area in m2" to "1015",
        "ASE" to "AD",
        "SE" to "SE",
        "Remarks by Building Design Unit" to "Complete detailed design drawing despatched. Design completed.",
        "Remarks" to "Work Completed",
        "AS Order No & Date" to "GO(Rt) No.625/2018/PWD",
        "AS Date" to "31/03/2018",
      ),
      mapOf(
        "_rowNum" to "623",
        "Name of Work" to "Construction of building for Govt. Fisheries UP School, Kadavanad, Malappuram",
        "District" to "10 Malappuram",
        "LAC" to "Ponnani",
        "AS Status" to "Yes",
        "AR Status" to "Received",
        "SR Status" to "Received",
        "Design Office" to "RDO KKD",
        "Design Status" to "04 Detailed Design Ongoing",
        "No. of Floors" to "G+2",
        "Total area in m2" to "939",
        "ASE" to "AD",
        "SE" to "SE",
        "Remarks by Building Design Unit" to
          "Revised AR and clarification from EE received on 31-07-2023. DD of first floor issued on 11.02.2026.",
        "Remarks" to "Finishing work is in progress",
        "Tentative Issued Date" to "24/01/2024",
        "Detailed Design Last Issued Date" to "11/02/2026",
      ),
      mapOf(
        "_rowNum" to "678",
        "Name of Work" to "Mini Civil Station, Balusserry, Kozhikode",
        "District" to "11 Kozhikode",
        "LAC" to "Balusseri",
        "AS Status" to "Yes",
        "AR Status" to "Received",
        "SR Status" to "Received",
        "Design Office" to "RDO KKD",
        "Design Status" to "04 Detailed Design Ongoing",
        "No. of Floors" to "B1+B2+G+3",
        "Total area in m2" to "5805",
        "ASE" to "AD",
        "SE" to "SE",
        "Remarks by Building Design Unit" to "DD of Ground floor issued on 27-01-2026. DD of FF issued on 21/04/2026.",
        "Remarks" to "FF floor slab design obtained. Centering and shuttering work started.",
        "Tentative Issued Date" to "07/01/2025",
        "Detailed Design Last Issued Date" to "21/04/2026",
      ),
      mapOf(
        "_rowNum" to "850",
        "Name of Work" to "Construction of Family Court - Kasargod",
        "District" to "14 Kasargod",
        "LAC" to "Kasaragod",
        "AS Status" to "Yes",
        "AR Status" to "Received",
        "SR Status" to "Received",
        "Design Office" to "RDO KKD",
        "Design Status" to "06 Detailed Design Issued",
        "No. of Floors" to "G+2",
        "Total area in m2" to "1451",
        "ASE" to "AD",
        "SE" to "SE",
        "Remarks by Building Design Unit" to "Final DD issued on 19-01-2026",
        "Remarks" to "",
        "Tentative Issued Date" to "10/11/2022",
        "Detailed Design Last Issued Date" to "19/01/2026",
        "Detailed Design Complete Issued Date" to "19/01/2026",
      ),
      mapOf(
        "_rowNum" to "720",
        "Name of Work" to "Construction of New Rest House Block in PWD Rest House Compound, Balussery, Kozhikode",
        "District" to "11 Kozhikode",
        "LAC" to "Balusseri",
        "AS Status" to "No Details Available",
        "AR Status" to "Not Received",
        "SR Status" to "Not Received",
        "Design Office" to "RDO KKD",
        "Design Status" to "07 File Not Yet Opened",
        "ASE" to "AD",
        "SE" to "DD",
        "Remarks by Building Design Unit" to
          "AR drawing, Soil investigation report and feasibility report awaited from Buildings wing.",
        "Remarks" to "",
      ),
    )
}
