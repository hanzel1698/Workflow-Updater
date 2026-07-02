package com.example.workflowupdater.data

import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/** Raw response from the Apps Script Web App backing the live workflow sheet. */
data class RawSheetResponse(val headers: List<String>, val rows: List<Map<String, String>>)

/** Talks to the same Google Apps Script Web App the Windows dashboard uses (see
 *  windows/google_apps_script.js), so both clients always read the identical live data. */
class SheetsRemoteDataSource {

  suspend fun fetchSheet(scriptUrl: String): Result<RawSheetResponse> =
    withContext(Dispatchers.IO) {
      runCatching {
        val url = buildUrl(scriptUrl)
        val connection = (url.openConnection() as HttpURLConnection).apply {
          requestMethod = "GET"
          connectTimeout = 15_000
          readTimeout = 20_000
          instanceFollowRedirects = true
        }

        val responseCode = connection.responseCode
        val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
        val body = stream.bufferedReader().use(BufferedReader::readText)
        connection.disconnect()

        if (responseCode !in 200..299) {
          throw IllegalStateException("HTTP $responseCode")
        }

        parseResponse(body)
      }.onFailure { Log.w(TAG, "Failed to fetch sheet data", it) }
    }

  private fun buildUrl(scriptUrl: String): URL {
    val separator = if ("?" in scriptUrl) "&" else "?"
    val encodedSheet = URLEncoder.encode(SheetConfig.SHEET_NAME, "UTF-8")
    val encodedId = URLEncoder.encode(SheetConfig.SPREADSHEET_ID, "UTF-8")
    return URL("$scriptUrl${separator}sheet=$encodedSheet&spreadsheetId=$encodedId")
  }

  private fun parseResponse(body: String): RawSheetResponse {
    val json = JSONObject(body)
    if (!json.optBoolean("success", false)) {
      throw IllegalStateException(json.optString("error", "Unknown server error"))
    }

    val headers = json.optJSONArray("headers").toStringList()
    val rowsJson = json.optJSONArray("rows") ?: JSONArray()
    val rows = buildList {
      for (i in 0 until rowsJson.length()) {
        val rowObj = rowsJson.optJSONObject(i) ?: continue
        add(rowObj.toStringMap())
      }
    }
    return RawSheetResponse(headers = headers, rows = rows)
  }

  private fun JSONArray?.toStringList(): List<String> {
    if (this == null) return emptyList()
    return buildList { for (i in 0 until length()) add(optString(i, "")) }
  }

  private fun JSONObject.toStringMap(): Map<String, String> {
    val map = LinkedHashMap<String, String>()
    val it = keys()
    while (it.hasNext()) {
      val key = it.next()
      val value = get(key)
      map[key] = if (value == JSONObject.NULL) "" else value.toString()
    }
    return map
  }

  companion object {
    private const val TAG = "SheetsRemoteDataSource"
  }
}
