const SPREADSHEET_ID = "1bF4CgbdG_0K34i9yM9gZl3yweLBwli_XLeARUMeJqFo";
const READERS_SHEET = "Readers";
const COMMENTS_SHEET = "Comments";

const READER_HEADERS = [
  "visitor_id",
  "first_seen_utc",
  "last_seen_utc",
  "visit_count",
  "first_page_url",
  "last_page_url",
  "site_label",
];

const COMMENT_HEADERS = [
  "comment_id",
  "submitted_utc",
  "status",
  "display_name",
  "professional_title",
  "affiliation",
  "comment_text",
  "page_url",
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
  } else if (action === "comments") {
    payload = {
      ok: true,
      comments: getComments_(params.limit),
    };
  } else if (action === "comment") {
    payload = registerComment_(params);
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
  if (action === "visit") {
    return jsonOutput_(registerReaderVisit_(payload));
  }

  if (action === "comment") {
    return jsonOutput_(registerComment_(payload));
  }

  return jsonOutput_({
    ok: false,
    error: "Unsupported action.",
  });
}

function setupReaderCounter() {
  const readersSheet = getReadersSheet_();
  const commentsSheet = getCommentsSheet_();

  return {
    ok: true,
    readersSheetName: readersSheet.getName(),
    commentsSheetName: commentsSheet.getName(),
    spreadsheetUrl: SpreadsheetApp.openById(SPREADSHEET_ID).getUrl(),
    stats: getStatsFromSheet_(readersSheet),
    commentsCount: getComments_(10).length,
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
    const readerRow = findRowByValue_(sheet, 1, safeVisitorId);

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

function deleteCommentById(commentId) {
  const safeCommentId = sanitizeIdentifier_(commentId, 128);
  if (!safeCommentId) {
    return {
      ok: false,
      error: "Missing commentId.",
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheet = getCommentsSheet_();
    const commentRow = findRowByValue_(sheet, 1, safeCommentId);

    if (commentRow) {
      sheet.deleteRow(commentRow);
      SpreadsheetApp.flush();
    }

    return {
      ok: true,
      deleted: Boolean(commentRow),
      comments: getComments_(10),
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
    const readerRow = findRowByValue_(sheet, 1, visitorId);
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

function registerComment_(input) {
  const commentId = sanitizeIdentifier_(input.commentId, 128) || createServerId_("comment");
  const displayName = truncateText_(sanitizeText_(input.displayName), 120);
  const professionalTitle = truncateText_(sanitizeText_(input.professionalTitle), 120);
  const affiliation = truncateText_(sanitizeText_(input.affiliation), 180);
  const commentText = truncateText_(sanitizeText_(input.commentText), 500);
  const pageUrl = sanitizeUrl_(input.pageUrl);
  const siteLabel = sanitizeSiteLabel_(input.siteLabel || input.site);

  if (!displayName || !professionalTitle || !affiliation || !commentText) {
    return {
      ok: false,
      error: "Missing required comment fields.",
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const sheet = getCommentsSheet_();
    const submittedAt = new Date().toISOString();

    sheet.appendRow([
      commentId,
      submittedAt,
      "Published",
      displayName,
      professionalTitle,
      affiliation,
      commentText,
      pageUrl,
      siteLabel,
    ]);

    SpreadsheetApp.flush();

    return {
      ok: true,
      comments: getComments_(10),
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

  ensureHeaders_(sheet, READER_HEADERS);
  return sheet;
}

function getCommentsSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(COMMENTS_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(COMMENTS_SHEET);
  }

  ensureHeaders_(sheet, COMMENT_HEADERS);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const currentHeaders = headerRange.getDisplayValues()[0];
  const headersMatch = headers.every(function (header, index) {
    return currentHeaders[index] === header;
  });

  if (!headersMatch) {
    headerRange.setValues([headers]);
  }

  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function findRowByValue_(sheet, columnIndex, matchValue) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  const values = sheet.getRange(2, columnIndex, lastRow - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index += 1) {
    if (sanitizeText_(values[index][0]) === matchValue) {
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

function getComments_(limitValue) {
  const sheet = getCommentsSheet_();
  const lastRow = sheet.getLastRow();
  const limit = normalizeLimit_(limitValue, 6, 12);

  if (lastRow < 2) {
    return [];
  }

  const rows = sheet
    .getRange(2, 1, lastRow - 1, COMMENT_HEADERS.length)
    .getDisplayValues()
    .map(function (row) {
      return {
        id: sanitizeText_(row[0]),
        submittedAt: sanitizeText_(row[1]),
        status: sanitizeText_(row[2]).toLowerCase(),
        displayName: sanitizeText_(row[3]),
        professionalTitle: sanitizeText_(row[4]),
        affiliation: sanitizeText_(row[5]),
        commentText: sanitizeText_(row[6]),
        pageUrl: sanitizeText_(row[7]),
        siteLabel: sanitizeText_(row[8]),
      };
    })
    .filter(function (comment) {
      if (!comment.displayName || !comment.commentText) {
        return false;
      }

      return (
        comment.status === "" ||
        comment.status === "published" ||
        comment.status === "approve" ||
        comment.status === "approved"
      );
    })
    .sort(function (left, right) {
      return right.submittedAt.localeCompare(left.submittedAt);
    });

  return rows.slice(0, limit);
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

function createServerId_(prefix) {
  return prefix + "-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000000);
}

function normalizeLimit_(value, fallback, maxLimit) {
  const parsed = Number(value);
  if (!parsed || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maxLimit);
}

function sanitizeText_(value) {
  return String(value || "").trim();
}

function truncateText_(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function sanitizeIdentifier_(value, maxLength) {
  const identifier = truncateText_(sanitizeText_(value), maxLength);
  return /^[A-Za-z0-9._-]+$/.test(identifier) ? identifier : "";
}

function sanitizeVisitorId_(value) {
  return sanitizeIdentifier_(value, 128);
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
