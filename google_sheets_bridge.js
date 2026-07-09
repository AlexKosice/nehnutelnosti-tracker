/**
 * @OnlyCurrentDoc
 * Google Apps Script Web App Bridge
 * Paste this script into your Google Sheet's Apps Script editor (Extensions -> Apps Script).
 * Deploy it as a Web App:
 * 1. Click "Deploy" -> "New deployment"
 * 2. Select type: "Web app"
 * 3. Description: "Nehnutelnosti Scraper Bridge"
 * 4. Execute as: "Me" (your email)
 * 5. Who has access: "Anyone"
 * 6. Click "Deploy" and authorize the script.
 * 7. Copy the Web App URL and set it as a secret or variable in your scraper.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    
    // Initialize sheet layout if it's empty
    initializeLayout(sheet);
    
    var date = data.date;
    var metrics = data.metrics;
    
    // Find next empty column
    var lastColumn = sheet.getLastColumn();
    var nextColumn = lastColumn + 1;
    
    // Set date header in row 1
    sheet.getRange(1, nextColumn).setValue(date);
    
    // Helper to find row by label in column A
    function findRowByLabel(label) {
      var dataRange = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
      for (var i = 0; i < dataRange.length; i++) {
        if (dataRange[i][0].toString().trim() === label.trim()) {
          return i + 1; // 1-indexed
        }
      }
      return -1;
    }
    
    // Map basic metrics
    var mappings = {
      "Košický kraj, byty": metrics.kosicky_kraj_byty,
      "Košický kraj, domy": metrics.kosicky_kraj_domy,
      "Košice, byty": metrics.kosice_byty,
      "Košice, domy": metrics.kosice_domy,
      "Prešovský kraj, byty": metrics.presovsky_kraj_byty,
      "Prešovský kraj, domy": metrics.presovsky_kraj_domy,
      "Bratislava byty": metrics.bratislava_byty,
      "Bratislava domy": metrics.bratislava_domy,
      "Slovensko byty": metrics.slovensko_byty,
      "Slovensko domy": metrics.slovensko_domy
    };
    
    for (var label in mappings) {
      var row = findRowByLabel(label);
      if (row !== -1) {
        sheet.getRange(row, nextColumn).setValue(mappings[label]);
      }
    }
    
    // Map Median-based segments
    // 1. Košice
    var rowKeMedian = findRowByLabel("Košice, byty, medián");
    if (rowKeMedian !== -1) {
      sheet.getRange(rowKeMedian, 2).setValue(215000); // ensure median limit is in column B
      sheet.getRange(rowKeMedian + 1, nextColumn).setValue(metrics.kosice_byty_under_215k);
      sheet.getRange(rowKeMedian + 2, nextColumn).setValue(metrics.kosice_byty_over_215k);
    }
    
    // 2. Bratislava
    var rowBaMedian = findRowByLabel("Bratislava, byty, medián");
    if (rowBaMedian !== -1) {
      sheet.getRange(rowBaMedian, 2).setValue(300000); // ensure median limit is in column B
      sheet.getRange(rowBaMedian + 1, nextColumn).setValue(metrics.bratislava_byty_under_300k);
      sheet.getRange(rowBaMedian + 2, nextColumn).setValue(metrics.bratislava_byty_over_300k);
    }
    
    // 3. Slovensko (Combined byty & domy)
    var rowSkMedian = findRowByLabel("Slovensko, byty a domy, medián");
    if (rowSkMedian !== -1) {
      sheet.getRange(rowSkMedian, 2).setValue(215000); // ensure median limit is in column B
      sheet.getRange(rowSkMedian + 1, nextColumn).setValue(metrics.slovensko_byty_under_215k + metrics.slovensko_domy_under_215k);
      sheet.getRange(rowSkMedian + 2, nextColumn).setValue(metrics.slovensko_byty_over_215k + metrics.slovensko_domy_over_215k);
    }
    
    // Format the new column to look nice
    var range = sheet.getRange(1, nextColumn, sheet.getLastRow(), 1);
    range.setHorizontalAlignment("center");
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Data appended to column " + nextColumn }))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function initializeLayout(sheet) {
  // Check if sheet already has labels
  if (sheet.getRange(2, 1).getValue().toString().trim() !== "") {
    return; // Already initialized
  }
  
  var layout = [
    ["Dátum / Kategória", "Limit"],
    ["Košický kraj, byty"],
    ["Košický kraj, domy"],
    [""],
    ["Košice, byty"],
    ["Košice, domy"],
    [""],
    ["Prešovský kraj, byty"],
    ["Prešovský kraj, domy"],
    [""],
    ["Bratislava byty"],
    ["Bratislava domy"],
    [""],
    ["Slovensko byty"],
    ["Slovensko domy"],
    [""],
    ["Košice, byty, medián", 215000],
    ["menej ako medián"],
    ["viac ako medián"],
    [""],
    ["Bratislava, byty, medián", 300000],
    ["menej ako medián"],
    ["viac ako medián"],
    [""],
    ["Slovensko, byty a domy, medián", 215000],
    ["menej ako medián"],
    ["viac ako medián"]
  ];
  
  sheet.clear();
  sheet.getRange(1, 1, layout.length, 2).setValues(layout);
  
  // Format column A as bold for headers
  sheet.getRange("A1:B1").setFontWeight("bold").setBackground("#f3f3f3");
  sheet.getRange("A2:A3").setFontWeight("bold");
  sheet.getRange("A5:A6").setFontWeight("bold");
  sheet.getRange("A8:A9").setFontWeight("bold");
  sheet.getRange("A11:A12").setFontWeight("bold");
  sheet.getRange("A14:A15").setFontWeight("bold");
  
  sheet.getRange("A17").setFontWeight("bold");
  sheet.getRange("A21").setFontWeight("bold");
  sheet.getRange("A25").setFontWeight("bold");
  
  // Auto-resize columns
  sheet.autoResizeColumn(1);
  sheet.autoResizeColumn(2);
}
