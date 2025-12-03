
/**
 * Google Apps Script for Ads Analytics Dashboard
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open your Google Sheet.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code into Code.gs (replace existing code).
 * 4. Click "Deploy" > "New deployment".
 * 5. Select type: "Web app".
 * 6. Description: "Dashboard API V3".
 * 7. Execute as: "Me" (your account).
 * 8. Who has access: "Anyone" (Essential for the fetch to work from the web app).
 * 9. Click "Deploy" and copy the Web App URL.
 * 10. Paste the URL into `constants.ts` as `GOOGLE_APPS_SCRIPT_URL`.
 */

// Configuration
// CRITICAL: This must match the sheet name used in App.tsx (executeSaveToSheet)
var SHEET_NAME = "Dashboard Data";

/**
 * Handle GET requests - Read data from Sheet
 */
function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10s

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    // If sheet doesn't exist, try to find "Data" as fallback, or return empty
    if (!sheet) {
      sheet = ss.getSheetByName("Data");
    }

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        data: [] // Return empty array so frontend handles it gracefully
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Get all data
    var range = sheet.getDataRange();
    var values = range.getValues();

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      data: values
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle POST requests - Write data to Sheet
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  
  try {
    // Wait for up to 30 seconds for other processes to finish
    lock.waitLock(30000); 
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: 'Server is busy, please try again.' 
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var postData = JSON.parse(e.postData.contents);
    var targetSheetName = postData.sheetTitle || SHEET_NAME;
    var rows = postData.values; // Expecting 2D array

    if (!rows || rows.length === 0) {
      throw new Error("No data provided");
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(targetSheetName);
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
    } else {
      // Clear existing data to avoid mixing old and new datasets
      sheet.clear();
    }

    // Write Data
    var numRows = rows.length;
    var numCols = rows[0].length;

    // Use setValues for batch writing (fastest method)
    sheet.getRange(1, 1, numRows, numCols).setValues(rows);

    // Formatting
    var headerRange = sheet.getRange(1, 1, 1, numCols);
    headerRange.setFontWeight("bold").setBackground("#f3f4f6");
    sheet.autoResizeColumns(1, numCols);

    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      message: 'Data saved successfully.' 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: error.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle CORS
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .append("Access-Control-Allow-Origin: *")
    .append("Access-Control-Allow-Methods: POST, GET, OPTIONS")
    .append("Access-Control-Allow-Headers: Content-Type, Authorization");
}
