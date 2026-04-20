const SPREADSHEET_ID = "1bF4CgbdG_0K34i9yM9gZl3yweLBwli_XLeARUMeJqFo";
const REGISTRATIONS_SHEET = "Registrations";
const START_ROW = 3;

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || "stats";

  if (action === "stats") {
    return jsonOutput_({
      ok: true,
      stats: getStats_(),
    });
  }

  return jsonOutput_({
    ok: false,
    error: "Unsupported action.",
  });
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

  if (payload.action !== "register") {
    return jsonOutput_({
      ok: false,
      error: "Unsupported action.",
    });
  }

  const fullName = sanitizeText_(payload.fullName);
  const emailAddress = sanitizeEmail_(payload.emailAddress);
  const phoneNumber = normalizePhone_(payload.phoneNumber);
  const affiliation = sanitizeText_(payload.affiliation);
  const preferredLanguage = sanitizeLanguage_(payload.preferredLanguage);
  const sessionId = sanitizeText_(payload.sessionId);
  const pageUrl = sanitizeText_(payload.pageUrl);
  const userAgent = truncateText_(sanitizeText_(payload.userAgent), 500);

  if (!fullName || !emailAddress || !phoneNumber || !affiliation || !preferredLanguage) {
    return jsonOutput_({
      ok: false,
      error: "Missing required fields.",
    });
  }

  const sheet = getRegistrationsSheet_();
  const existingPhones = getExistingPhones_(sheet);
  const duplicate = existingPhones.has(phoneNumber);

  sheet.appendRow([
    new Date().toISOString(),
    fullName,
    emailAddress,
    phoneNumber,
    affiliation,
    preferredLanguage,
    duplicate ? "repeat_register" : "register",
    sessionId,
    pageUrl,
    userAgent,
  ]);

  SpreadsheetApp.flush();

  return jsonOutput_({
    ok: true,
    duplicate: duplicate,
    stats: getStats_(),
    profile: {
      fullName: fullName,
      emailAddress: emailAddress,
      phoneNumber: phoneNumber,
      affiliation: affiliation,
      preferredLanguage: preferredLanguage,
    },
  });
}

function getRegistrationsSheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(REGISTRATIONS_SHEET);
}

function getExistingPhones_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < START_ROW) {
    return new Set();
  }

  const values = sheet
    .getRange(START_ROW, 4, lastRow - START_ROW + 1, 1)
    .getDisplayValues()
    .flat()
    .map(normalizePhone_)
    .filter(Boolean);

  return new Set(values);
}

function getStats_() {
  const sheet = getRegistrationsSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < START_ROW) {
    return {
      totalSubmissions: 0,
      uniqueVisitors: 0,
      lastUpdatedUtc: "",
    };
  }

  const rows = sheet
    .getRange(START_ROW, 1, lastRow - START_ROW + 1, 9)
    .getDisplayValues()
    .filter(function (row) {
      return row[0];
    });

  const uniquePhones = new Set(
    rows
      .map(function (row) {
        return normalizePhone_(row[3]);
      })
      .filter(Boolean)
  );

  const lastUpdatedUtc = rows.length ? rows[rows.length - 1][0] : "";

  return {
    totalSubmissions: rows.length,
    uniqueVisitors: uniquePhones.size,
    lastUpdatedUtc: lastUpdatedUtc,
  };
}

function sanitizeText_(value) {
  return String(value || "").trim();
}

function truncateText_(value, maxLength) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function normalizePhone_(value) {
  const raw = sanitizeText_(value);
  if (!raw) {
    return "";
  }

  const hasPlus = raw.charAt(0) === "+";
  const digits = raw.replace(/\D+/g, "");
  return hasPlus ? "+" + digits : digits;
}

function sanitizeLanguage_(value) {
  const language = sanitizeText_(value).toLowerCase();
  return language === "ar" ? "ar" : language === "en" ? "en" : "";
}

function sanitizeEmail_(value) {
  const email = sanitizeText_(value).toLowerCase();
  if (!email) {
    return "";
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
