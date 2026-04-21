const SPREADSHEET_ID = "1bF4CgbdG_0K34i9yM9gZl3yweLBwli_XLeARUMeJqFo";
const READERS_SHEET = "Readers";
const READER_HEADERS = [
  "visitor_id",
  "first_seen_utc",
  "last_seen_utc",
  "visit_count",
  "first_page_url",
  "last_page_url",
  "site_label",
];

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = sanitizeText_(params.action || "stats").toLowerCase();
  let payload;

  if (action === "visit") {
    payload = registerReaderVisit_(params);
  } else if (action === "stats") {
    payload = {
      ok: true,
      stats: getStats_(),
    };
  } else {
    payload = {
      ok: false,
      error: "Unsupported action.",
    };
  }

  return outputResponse_(payload, params.callback);
}

function doPost(e) {
  let payload = {};

  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (error) {
    return jsonOutput_({
      ok: false,
      error: "Invalid JSON payload.",
    });
  }

  const action = sanitizeText_(payload.action).toLowerCase();
  if (action !== "visit") {
    return jsonOutput_({
      ok: false,
      error: "Unsupported action.",
    });
  }

  return jsonOutput_(registerReaderVisit_(payload));
}

function setupReaderCounter() {
  const sheet = getReadersSheet_();
  return {
    ok: true,
    sheetName: sheet.getName(),
    spreadsheetUrl: SpreadsheetApp.openById(SPREADSHEET_ID).getUrl(),
    stats: getStatsFromSheet_(sheet),
  };
}

function deleteReaderByVisitorId(visitorId) {
  const safeVisitorId = sanitizeVisitorId_(visitorId);
  if (!safeVisitorId) {
    return {
      ok: false,
      error: "Missing visitorId.",
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheet = getReadersSheet_();
    const readerRow = findReaderRow_(sheet, safeVisitorId);

    if (readerRow) {
      sheet.deleteRow(readerRow);
      SpreadsheetApp.flush();
    }

    return {
      ok: true,
      deleted: Boolean(readerRow),
      stats: getStatsFromSheet_(sheet),
    };
  } finally {
    lock.releaseLock();
  }
}

function registerReaderVisit_(input) {
  const visitorId = sanitizeVisitorId_(input.visitorId);
  const pageUrl = sanitizeUrl_(input.pageUrl);
  const siteLabel = sanitizeSiteLabel_(input.siteLabel || input.site);

  if (!visitorId) {
    return {
      ok: false,
      error: "Missing visitorId.",
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheet = getReadersSheet_();
    const readerRow = findReaderRow_(sheet, visitorId);
    const now = new Date().toISOString();
    let duplicate = false;

    if (readerRow) {
      duplicate = true;
      const currentVisitCount = Number(sheet.getRange(readerRow, 4).getValue()) || 0;
      const firstPageUrl = sanitizeUrl_(sheet.getRange(readerRow, 5).getDisplayValue()) || pageUrl;
      const lastKnownSite = sanitizeSiteLabel_(sheet.getRange(readerRow, 7).getDisplayValue());

      sheet
        .getRange(readerRow, 3, 1, 5)
        .setValues([
          [
            now,
            currentVisitCount + 1,
            firstPageUrl,
            pageUrl || firstPageUrl,
            siteLabel || lastKnownSite,
          ],
        ]);
    } else {
      sheet.appendRow([
        visitorId,
        now,
        now,
        1,
        pageUrl,
        pageUrl,
        siteLabel,
      ]);
    }

    SpreadsheetApp.flush();

    return {
      ok: true,
      duplicate: duplicate,
      stats: getStatsFromSheet_(sheet),
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error && error.message ? error.message : error),
    };
  } finally {
    lock.releaseLock();
  }
}

function getReadersSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(READERS_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(READERS_SHEET);
  }

  ensureReaderHeaders_(sheet);
  return sheet;
}

function ensureReaderHeaders_(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, READER_HEADERS.length);
  const currentHeaders = headerRange.getDisplayValues()[0];
  const headersMatch = READER_HEADERS.every(function (header, index) {
    return currentHeaders[index] === header;
  });

  if (!headersMatch) {
    headerRange.setValues([READER_HEADERS]);
  }

  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, READER_HEADERS.length);
}

function findReaderRow_(sheet, visitorId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  const visitorIds = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < visitorIds.length; index += 1) {
    if (sanitizeVisitorId_(visitorIds[index][0]) === visitorId) {
      return index + 2;
    }
  }

  return 0;
}

function getStats_() {
  return getStatsFromSheet_(getReadersSheet_());
}

function getStatsFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return emptyStats_();
  }

  const rows = sheet
    .getRange(2, 1, lastRow - 1, READER_HEADERS.length)
    .getDisplayValues()
    .filter(function (row) {
      return sanitizeVisitorId_(row[0]);
    });

  if (!rows.length) {
    return emptyStats_();
  }

  let totalVisits = 0;
  let lastUpdatedUtc = "";

  rows.forEach(function (row) {
    totalVisits += Number(row[3]) || 0;
    if (row[2] && row[2] > lastUpdatedUtc) {
      lastUpdatedUtc = row[2];
    }
  });

  return {
    totalSubmissions: totalVisits,
    totalVisits: totalVisits,
    uniqueVisitors: rows.length,
    lastUpdatedUtc: lastUpdatedUtc,
  };
}

function emptyStats_() {
  return {
    totalSubmissions: 0,
    totalVisits: 0,
    uniqueVisitors: 0,
    lastUpdatedUtc: "",
  };
}

function outputResponse_(payload, callback) {
  const safeCallback = sanitizeCallback_(callback);
  if (!safeCallback) {
    return jsonOutput_(payload);
  }

  return ContentService.createTextOutput(
    safeCallback + "(" + JSON.stringify(payload) + ");"
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function sanitizeText_(value) {
  return String(value || "").trim();
}

function truncateText_(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function sanitizeVisitorId_(value) {
  const visitorId = truncateText_(sanitizeText_(value), 128);
  return /^[A-Za-z0-9._-]+$/.test(visitorId) ? visitorId : "";
}

function sanitizeUrl_(value) {
  const rawValue = truncateText_(sanitizeText_(value), 500);
  if (!rawValue) {
    return "";
  }

  if (/^https?:\/\//i.test(rawValue)) {
    return rawValue;
  }

  return "";
}

function sanitizeSiteLabel_(value) {
  return truncateText_(sanitizeText_(value) || "Wahj NGS Guide", 120);
}

function sanitizeCallback_(value) {
  const callback = truncateText_(sanitizeText_(value), 80);
  return /^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(callback) ? callback : "";
}
