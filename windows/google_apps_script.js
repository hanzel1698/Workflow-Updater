/**
 * Workflow Updater - Google Apps Script Backend (Standalone Project)
 *
 * SETUP (standalone script in Google Drive):
 * 1. Create/open your Apps Script project at script.google.com
 * 2. Paste this entire file into Code.gs
 * 3. Confirm SPREADSHEET_ID below matches your Google Sheet
 * 4. Run "authorizeSpreadsheetAccess" once from the editor and approve permissions
 * 5. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy the Web App URL into config.js → SCRIPT_URL in the frontend
 */

// Required for standalone scripts — getActiveSpreadsheet() does not work in web apps
var SPREADSHEET_ID = "1tDBZGfYmtEQLwepDHDVwd2pAT_-qvIoJxVYG8Ub6vI8";

// Run this once from the Apps Script editor to grant spreadsheet access before deploying
function authorizeSpreadsheetAccess() {
  var ss = getSpreadsheet({});
  Logger.log("Connected to spreadsheet: " + ss.getName());
  Logger.log("Sheet tabs: " + ss.getSheets().map(function(s) { return s.getName(); }).join(", "));
}

function getSpreadsheetIdFromSource(source) {
  if (!source) return "";
  if (source.parameter && source.parameter.spreadsheetId) {
    return source.parameter.spreadsheetId.toString().trim();
  }
  if (source.spreadsheetId) {
    return source.spreadsheetId.toString().trim();
  }
  return "";
}

function getSpreadsheet(source) {
  var id = getSpreadsheetIdFromSource(source);
  if (!id && typeof SPREADSHEET_ID !== "undefined" && SPREADSHEET_ID) {
    id = SPREADSHEET_ID.toString().trim();
  }
  if (!id) {
    id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || "";
  }

  // Standalone web apps must open by ID — getActiveSpreadsheet() is always null
  if (id) {
    return SpreadsheetApp.openById(id);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    return ss;
  }

  throw new Error(
    "SPREADSHEET_ID is not configured. Set SPREADSHEET_ID at the top of this file " +
    "or pass spreadsheetId from the frontend config.js."
  );
}

// Custom CORS handling wrapper
function makeJsonResponse(object, status) {
  var output = ContentService.createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// Automatically finds the header row index (0-based)
function getHeaderRowIndex(values) {
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row.indexOf("e-Office File Number") !== -1 || row.indexOf("Name of Work") !== -1) {
      return i;
    }
  }
  return 0; // Fallback to first row
}

// Smartly finds the correct sheet for data tracking
function getTargetSheet(ss, source) {
  if (!ss) {
    throw new Error("Spreadsheet reference is null");
  }

  // 1. Try to get sheet name from parameter or payload if provided
  var sheetName = "";
  if (source) {
    if (source.parameter && source.parameter.sheet) {
      sheetName = source.parameter.sheet;
    } else if (source.sheet) {
      sheetName = source.sheet;
    } else if (source.data && source.data.sheet) {
      sheetName = source.data.sheet;
    }
  }
  
  if (sheetName) {
    var s = ss.getSheetByName(sheetName);
    if (s) return s;
  }
  
  // 2. Scan all sheets for the data header ("e-Office File Number" or "Name of Work")
  var sheets = ss.getSheets();
  for (var k = 0; k < sheets.length; k++) {
    var s = sheets[k];
    
    // Proactively ignore any old/archived tabs
    if (s.getName().toUpperCase().indexOf("OLD") !== -1) {
      continue;
    }
    
    var data = s.getDataRange().getValues();
    var checkRows = Math.min(data.length, 10);
    for (var i = 0; i < checkRows; i++) {
      var row = data[i];
      if (row.indexOf("e-Office File Number") !== -1 || row.indexOf("Name of Work") !== -1) {
        return s;
      }
    }
  }
  
  // 3. Fallback to active sheet
  return ss.getActiveSheet();
}

/**
 * Reads validated dropdown lists from the "Dropdown Details" reference sheet.
 * Each column header holds the allowed values for the corresponding workflow column.
 */
function getDropdownOptions(ss) {
  if (!ss) return {};

  var dropdownSheet = ss.getSheetByName("Dropdown Details");
  if (!dropdownSheet) return {};

  var data = dropdownSheet.getDataRange().getValues();
  if (data.length === 0) return {};

  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var raw = {};

  for (var j = 0; j < headers.length; j++) {
    var headerName = headers[j];
    if (!headerName) continue;

    var values = [];
    var seen = {};
    for (var i = 1; i < data.length; i++) {
      var val = data[i][j] !== undefined ? data[i][j].toString().trim() : "";
      if (val && !seen[val]) {
        seen[val] = true;
        values.push(val);
      }
    }
    raw[headerName] = values;
  }

  // Map reference-sheet column names to workflow sheet column names
  return {
    "District": raw["Districts"] || [],
    "LAC": raw["LAC List"] || [],
    "AS Status": raw["AS Status"] || [],
    "AR Status": raw["AR Status"] || [],
    "SR Status": raw["SR Status"] || [],
    "Design Office": raw["Design Office"] || [],
    "Design Status": raw["Design Status"] || [],
    "ASE": raw["ASE"] || [],
    "SE": raw["SE"] || []
  };
}

// Returns true when a data row contains actual work content (ignores blank table rows)
function isPopulatedDataRow(row, headers) {
  if (!row) return false;

  var workNameIdx = headers.indexOf("Name of Work");
  if (workNameIdx === -1) workNameIdx = headers.indexOf("Work Name");

  // A row only counts as work data when Name of Work is filled.
  // Formatted table rows may contain FALSE/defaults in other columns — ignore those.
  if (workNameIdx !== -1) {
    var workName = row[workNameIdx];
    return workName !== undefined && workName !== null && workName.toString().trim() !== "";
  }

  return row.join("").trim() !== "";
}

// Finds the 1-based sheet row number of the last row that contains work data
function getLastPopulatedRowNum(data, headerRowIndex, headers) {
  var lastIdx = headerRowIndex; // 0-based; defaults to header if sheet has no data yet

  for (var i = headerRowIndex + 1; i < data.length; i++) {
    if (isPopulatedDataRow(data[i], headers)) {
      lastIdx = i;
    }
  }

  return lastIdx + 1; // convert to 1-based row number
}

/**
 * Handle GET requests: Fetch all rows from the target sheet (or debug sheets info)
 */
function doGet(e) {
  try {
    var ss = getSpreadsheet(e);
    
    // Debug mode to inspect spreadsheet structure
    if (e && e.parameter && e.parameter.debug === "true") {
      var debugInfo = [];
      var sheets = ss.getSheets();
      for (var k = 0; k < sheets.length; k++) {
        var s = sheets[k];
        var data = s.getDataRange().getValues();
        var headers = data.length > 0 ? data[0] : [];
        // Scan first 10 rows for headers
        var checkRows = Math.min(data.length, 10);
        var foundHeaders = [];
        for (var i = 0; i < checkRows; i++) {
          if (data[i].indexOf("Name of Work") !== -1 || data[i].indexOf("e-Office File Number") !== -1) {
            foundHeaders = data[i];
            break;
          }
        }
        if (foundHeaders.length === 0 && data.length > 0) {
          foundHeaders = data[0];
        }
        debugInfo.push({
          index: k,
          name: s.getName(),
          rowCount: data.length,
          colCount: data.length > 0 ? data[0].length : 0,
          detectedHeaders: foundHeaders.map(function(h) { return h.toString().trim(); }).slice(0, 15)
        });
      }
      return makeJsonResponse({ success: true, debug: true, sheets: debugInfo });
    }
    
    var sheet = getTargetSheet(ss, e);
    var data = sheet.getDataRange().getValues();
    
    if (data.length === 0) {
      return makeJsonResponse({ headers: [], rows: [] });
    }
    
    var headerRowIndex = getHeaderRowIndex(data);
    var headers = data[headerRowIndex].map(function(h) { return h.toString().trim(); });
    
    var rows = [];
    // Data rows start immediately after the header row
    for (var i = headerRowIndex + 1; i < data.length; i++) {
      var rowData = data[i];
      if (!isPopulatedDataRow(rowData, headers)) continue;
      
      var row = {};
      row["_rowNum"] = i + 1; // 1-based sheet row index for fast updates
      
      for (var j = 0; j < headers.length; j++) {
        var headerName = headers[j];
        if (headerName) {
          row[headerName] = rowData[j] !== undefined ? rowData[j] : "";
        }
      }
      rows.push(row);
    }
    
    return makeJsonResponse({
      success: true,
      headers: headers,
      rows: rows,
      dropdowns: getDropdownOptions(ss)
    });
    
  } catch (error) {
    return makeJsonResponse({ success: false, error: error.toString() }, 500);
  }
}

// Write only the columns present in data — never touches protected/unrelated cells
function writeDataToRow(sheet, headers, rowNum, data, skipBlank) {
  var cellsWritten = 0;

  for (var key in data) {
    if (!data.hasOwnProperty(key)) continue;

    var value = data[key];
    if (skipBlank && (value === null || value === undefined || value.toString().trim() === "")) {
      continue;
    }

    var colIdx = headers.indexOf(key.trim());
    if (colIdx !== -1) {
      sheet.getRange(rowNum, colIdx + 1).setValue(value);
      cellsWritten++;
    }
  }

  return cellsWritten;
}

/**
 * Handle POST requests: Append or Update row data
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = getSpreadsheet(payload);
    var sheet = getTargetSheet(ss, payload);
    var data = sheet.getDataRange().getValues();
    var headerRowIndex = getHeaderRowIndex(data);
    var headers = data[headerRowIndex].map(function(h) { return h.toString().trim(); });
    
    var action = payload.action; // "append" or "update"
    
    if (action === "append") {
      var lastPopulatedRow = getLastPopulatedRowNum(data, headerRowIndex, headers);
      var targetRow = lastPopulatedRow + 1;

      // Write only the submitted columns individually — avoids overwriting
      // protected columns (e.g. I/C (ASE), I/C (SE)) or unrelated table fields.
      var cellsWritten = writeDataToRow(sheet, headers, targetRow, payload.data, true);

      if (cellsWritten === 0) {
        return makeJsonResponse({ success: false, error: "No field values provided to append" }, 400);
      }

      return makeJsonResponse({
        success: true,
        message: "Row successfully appended at row " + targetRow + " (" + cellsWritten + " cells)",
        rowNum: targetRow
      });
      
    } else if (action === "update") {
      var rowNum = parseInt(payload.rowNum);
      
      // Fallback: If rowNum is not provided, try to find row by "e-Office File Number"
      if (isNaN(rowNum) || rowNum <= headerRowIndex + 1) {
        var fileNumKey = "e-Office File Number";
        var fileNumVal = payload.fileNumber;
        if (fileNumVal) {
          var colIdx = headers.indexOf(fileNumKey);
          if (colIdx !== -1) {
            for (var i = headerRowIndex + 1; i < data.length; i++) {
              if (data[i][colIdx] === fileNumVal) {
                rowNum = i + 1;
                break;
              }
            }
          }
        }
      }
      
      if (isNaN(rowNum) || rowNum <= headerRowIndex + 1) {
        return makeJsonResponse({ success: false, error: "Row number or e-Office File Number not found" }, 400);
      }
      
      // Update only the submitted columns individually
      writeDataToRow(sheet, headers, rowNum, payload.data, false);
      
      return makeJsonResponse({ success: true, message: "Row successfully updated at row " + rowNum });
    }
    
    return makeJsonResponse({ success: false, error: "Invalid action" }, 400);
    
  } catch (error) {
    return makeJsonResponse({ success: false, error: error.toString() }, 500);
  }
}
