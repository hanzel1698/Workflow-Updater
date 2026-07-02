package com.example.workflowupdater.pdf

import com.example.workflowupdater.data.EngineerProfile
import com.example.workflowupdater.data.SheetConfig
import com.example.workflowupdater.data.SheetDateFormatter
import com.example.workflowupdater.data.WorkItem
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Renders the same grouped, print-ready A3 report as the Windows dashboard's
 * "Download PDF Report" action (see windows/app.js `downloadPdfReport`), so a work handled by
 * an engineer looks identical whether it was exported from the desktop or from this phone.
 */
object PdfReportBuilder {

  fun reportTitle(designation: String, engineerName: String, date: String = todayFormatted()): String =
    "PROGRESS REPORT - ${designation.trim().uppercase(Locale.ROOT)} - ${engineerName.trim()} - AS ON $date."

  fun buildReportHtml(works: List<WorkItem>, profile: EngineerProfile, engineerName: String): String {
    val title = reportTitle(profile.id, engineerName)
    val grouped = SheetConfig.STATUS_OPTIONS.associateWith { status -> works.filter { it.status == status } }

    val bodyRows = buildString {
      SheetConfig.STATUS_OPTIONS.forEach { status ->
        val groupWorks = grouped[status].orEmpty()
        val suffix = if (groupWorks.size == 1) "WORK" else "WORKS"
        append("<tr class=\"status-group-row\"><td colspan=\"14\">")
        append(escapeHtml("${status.uppercase(Locale.ROOT)} : ${groupWorks.size} $suffix"))
        append("</td></tr>")

        if (groupWorks.isEmpty()) {
          append(
            "<tr class=\"nil-row\"><td style=\"color:#94a3b8;font-style:italic;font-weight:500;font-size:8.5pt;padding:8px;\">NIL</td>" +
              "<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>",
          )
          return@forEach
        }

        groupWorks.forEach { work -> append(taskRow(work)) }
      }
    }

    return """
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=${PdfPageSpec.a3LandscapeWidthPx()}, initial-scale=1.0">
        <title>${escapeHtml(title)}</title>
        <style>
          body {
            font-family: 'Segoe UI', Roboto, sans-serif;
            color: #1e293b;
            background: white;
            margin: 1cm;
            font-size: 10.5pt;
            line-height: 1.35;
          }
          .header-container {
            text-align: center;
            margin-bottom: 25px;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
          }
          h1 {
            font-size: 16pt;
            margin: 0;
            color: #0f172a;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .total-works-summary {
            text-align: left;
            font-size: 10pt;
            font-weight: 600;
            color: #334155;
            margin: 10px 0 0 0;
          }
          table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            page-break-inside: auto;
            margin-top: 10px;
          }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          th {
            background-color: #f1f5f9;
            border: 1px solid #000000;
            color: #0f172a;
            font-weight: 600;
            text-align: left;
            padding: 6px 8px;
            font-size: 9.5pt;
            text-transform: uppercase;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          td {
            border: 1px solid #000000;
            padding: 6px 8px;
            font-size: 9.8pt;
            vertical-align: top;
            word-wrap: break-word;
          }
          .status-group-row {
            background-color: #e2e8f0 !important;
            font-weight: 700;
            color: #0f172a;
            font-size: 10.5pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            page-break-after: avoid !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .status-group-row td { border: 1px solid #000000; padding: 8px 10px; }
          .center { text-align: center; }
          th.date-col { font-size: 8.5pt; line-height: 1.2; text-align: center; }
          .remarks-cell { font-size: 9.5pt; color: #334155; }
          @media print {
            body { margin: 1cm; }
            th, td { border-color: #000000 !important; }
            th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .status-group-row { background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          @page { size: 420mm 297mm; margin: 1cm; }
        </style>
      </head>
      <body>
        <div class="header-container"><h1>${escapeHtml(title)}</h1></div>
        <p class="total-works-summary">Total number of works: ${works.size}</p>
        <table>
          <colgroup>
            <col style="width: 350px" /><col style="width: 120px" /><col style="width: 100px" />
            <col style="width: 80px" /><col style="width: 80px" /><col style="width: 80px" />
            <col style="width: 90px" /><col style="width: 110px" /><col style="width: 80px" />
            <col style="width: 395px" /><col style="width: 105px" /><col style="width: 105px" />
            <col style="width: 115px" /><col style="width: 115px" />
          </colgroup>
          <thead>
            <tr>
              <th>Name of Work</th>
              <th>District</th>
              <th>LAC</th>
              <th>AS Status</th>
              <th>AR Status</th>
              <th>SR Status</th>
              <th>No. of Floors</th>
              <th class="center">Total Area (m&sup2;)</th>
              <th>SE</th>
              <th>Remarks by Building Design Unit</th>
              <th class="date-col">Target Date</th>
              <th class="date-col">Tentative Issued Date</th>
              <th class="date-col">Detailed Design Last Issued Date</th>
              <th class="date-col">Detailed Design Complete Issued Date</th>
            </tr>
          </thead>
          <tbody>
            $bodyRows
          </tbody>
        </table>
      </body>
      </html>
    """.trimIndent()
  }

  private fun taskRow(work: WorkItem): String =
    buildString {
      append("<tr>")
      append("<td>${cell(work.workName)}</td>")
      append("<td>${cell(work.district)}</td>")
      append("<td>${cell(work.lac)}</td>")
      append("<td class=\"center\">${cell(work.asStatus)}</td>")
      append("<td class=\"center\">${cell(work.arStatus)}</td>")
      append("<td class=\"center\">${cell(work.srStatus)}</td>")
      append("<td class=\"center\">${cell(work.floors)}</td>")
      append("<td class=\"center\">${cell(work.area)}</td>")
      append("<td class=\"center\">${cell(work.se)}</td>")
      append("<td class=\"remarks-cell\">${cell(work.remarks)}</td>")
      append("<td class=\"center\">${cell(formatDate(work.targetDate))}</td>")
      append("<td class=\"center\">${cell(formatDate(work.tentativeIssuedDate))}</td>")
      append("<td class=\"center\">${cell(formatDate(work.detailedLastIssuedDate))}</td>")
      append("<td class=\"center\">${cell(formatDate(work.detailedCompleteIssuedDate))}</td>")
      append("</tr>")
    }

  private fun cell(value: String): String = escapeHtml(value.trim().ifBlank { "-" })

  private fun formatDate(value: String): String = SheetDateFormatter.format(value).ifBlank { "-" }

  private fun todayFormatted(): String = SimpleDateFormat("dd-MM-yyyy", Locale.ROOT).format(Date())

  private fun escapeHtml(text: String): String =
    text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
}
