const SPREADSHEET_ID = "1bF4CgbdG_0K34i9yM9gZl3yweLBwli_XLeARUMeJqFo";
const REGISTRATIONS_SHEET = "Registrations";
const START_ROW = 3;
const CONFIG_SHEET = "Config";
const PUBLIC_STATS_SHEET = "Public Stats";
const REGISTRATION_FORM_TITLE = "Wahj NGS Guide Access Registration";
const REGISTRATION_FORM_DESCRIPTION =
  "Public access form for the Wahj Next-Generation Sequencing learning page.";
const SCRIPT_PROPERTY_FORM_ID = "registrationFormId";
const SCRIPT_PROPERTY_PUBLIC_STATS_ID = "publicStatsSpreadsheetId";
const SCRIPT_PROPERTY_RESPONSE_SHEET_NAME = "responseSheetName";

const FORM_FIELD_TITLES = {
  fullName: "Full name",
  emailAddress: "Email address",
  phoneNumber: "Phone number",
  affiliation: "Affiliation / workplace",
  preferredLanguage: "Preferred language",
};

function setupRegistrationInfrastructure() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const form = getOrCreateRegistrationForm_();

  shareFileByLink_(ScriptApp.getScriptId());
  rebuildRegistrationForm_(form);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, SPREADSHEET_ID);
  form.setAcceptingResponses(true);

  if (
    typeof form.supportsAdvancedResponderPermissions === "function" &&
    form.supportsAdvancedResponderPermissions()
  ) {
    form.setPublished(true);
  }

  const formFile = DriveApp.getFileById(form.getId());
  formFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const responseSheet = findResponseSheet_(spreadsheet);
  if (responseSheet) {
    PropertiesService.getScriptProperties().setProperty(
      SCRIPT_PROPERTY_RESPONSE_SHEET_NAME,
      responseSheet.getName()
    );
  }

  const publicStatsSpreadsheet = getOrCreatePublicStatsSpreadsheet_();
  const publicStatsSheet = preparePublicStatsSheet_(publicStatsSpreadsheet);
  ensureFormSubmitTrigger_();

  const stats = syncPublicStats();
  const config = buildRegistrationConfig_(form, responseSheet, publicStatsSpreadsheet, publicStatsSheet);

  writeConfigSheet_(spreadsheet, config, stats);
  return config;
}

function syncPublicStats() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const responseSheet = findResponseSheet_(spreadsheet);
  const publicStatsSpreadsheet = getOrCreatePublicStatsSpreadsheet_();
  const publicStatsSheet = preparePublicStatsSheet_(publicStatsSpreadsheet);
  const stats = responseSheet ? calculateResponseStats_(responseSheet) : emptyStats_();

  publicStatsSheet.clearContents();
  publicStatsSheet
    .getRange(1, 1, 4, 2)
    .setValues([
      ["metric", "value"],
      ["uniqueVisitors", stats.uniqueVisitors],
      ["totalSubmissions", stats.totalSubmissions],
      ["lastUpdatedUtc", stats.lastUpdatedUtc],
    ]);

  return stats;
}

function testRegistrationInfrastructure() {
  return {
    config: setupRegistrationInfrastructure(),
    stats: syncPublicStats(),
  };
}

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

function getOrCreateRegistrationForm_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(SCRIPT_PROPERTY_FORM_ID);

  if (existingId) {
    try {
      return FormApp.openById(existingId);
    } catch (error) {
      properties.deleteProperty(SCRIPT_PROPERTY_FORM_ID);
    }
  }

  const form = FormApp.create(REGISTRATION_FORM_TITLE);
  properties.setProperty(SCRIPT_PROPERTY_FORM_ID, form.getId());
  return form;
}

function shareFileByLink_(fileId) {
  try {
    DriveApp.getFileById(fileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) {
    Logger.log("Unable to update sharing for file " + fileId + ": " + error);
  }
}

function rebuildRegistrationForm_(form) {
  const items = form.getItems();
  for (let index = items.length - 1; index >= 0; index -= 1) {
    form.deleteItem(items[index]);
  }

  form.setTitle(REGISTRATION_FORM_TITLE);
  form.setDescription(REGISTRATION_FORM_DESCRIPTION);

  form
    .addTextItem()
    .setTitle(FORM_FIELD_TITLES.fullName)
    .setHelpText("Enter your full name.")
    .setRequired(true);

  const emailValidation = FormApp.createTextValidation()
    .requireTextIsEmail()
    .setHelpText("Enter a valid email address.")
    .build();

  form
    .addTextItem()
    .setTitle(FORM_FIELD_TITLES.emailAddress)
    .setHelpText("Enter your email address.")
    .setValidation(emailValidation)
    .setRequired(true);

  form
    .addTextItem()
    .setTitle(FORM_FIELD_TITLES.phoneNumber)
    .setHelpText("Enter your phone number, including country code if available.")
    .setRequired(true);

  form
    .addTextItem()
    .setTitle(FORM_FIELD_TITLES.affiliation)
    .setHelpText("Enter your university, company, laboratory, or hospital.")
    .setRequired(true);

  form
    .addListItem()
    .setTitle(FORM_FIELD_TITLES.preferredLanguage)
    .setChoiceValues(["English", "العربية"])
    .setHelpText("Choose the language you prefer for the page.")
    .setRequired(true);
}

function getOrCreatePublicStatsSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(SCRIPT_PROPERTY_PUBLIC_STATS_ID);

  if (existingId) {
    try {
      return SpreadsheetApp.openById(existingId);
    } catch (error) {
      properties.deleteProperty(SCRIPT_PROPERTY_PUBLIC_STATS_ID);
    }
  }

  const publicStatsSpreadsheet = SpreadsheetApp.create("Wahj NGS Guide Public Stats");
  properties.setProperty(SCRIPT_PROPERTY_PUBLIC_STATS_ID, publicStatsSpreadsheet.getId());

  const file = DriveApp.getFileById(publicStatsSpreadsheet.getId());
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return publicStatsSpreadsheet;
}

function preparePublicStatsSheet_(spreadsheet) {
  const sheet =
    spreadsheet.getSheetByName(PUBLIC_STATS_SHEET) || spreadsheet.getSheets()[0].setName(PUBLIC_STATS_SHEET);

  sheet.clear();
  sheet.getRange("A1:B1").setFontWeight("bold");
  return sheet;
}

function ensureFormSubmitTrigger_() {
  const triggers = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === "syncPublicStats";
  });

  triggers.forEach(function (trigger, index) {
    if (index > 0) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  if (!triggers.length) {
    ScriptApp.newTrigger("syncPublicStats").forSpreadsheet(SPREADSHEET_ID).onFormSubmit().create();
  }
}

function buildRegistrationConfig_(form, responseSheet, publicStatsSpreadsheet, publicStatsSheet) {
  const publishedUrl = form.getPublishedUrl();
  const liveUrl = publishedUrl.split("?")[0];
  const responseUrl = liveUrl.replace(/viewform$/, "formResponse");
  const items = form.getItems();
  const itemMap = {};

  items.forEach(function (item) {
    itemMap[item.getTitle()] = "entry." + item.getId();
  });

  return {
    generatedAtUtc: new Date().toISOString(),
    formId: form.getId(),
    formPublishedUrl: publishedUrl,
    formResponseUrl: responseUrl,
    responseSheetName: responseSheet ? responseSheet.getName() : "",
    fullNameEntry: itemMap[FORM_FIELD_TITLES.fullName] || "",
    emailAddressEntry: itemMap[FORM_FIELD_TITLES.emailAddress] || "",
    phoneNumberEntry: itemMap[FORM_FIELD_TITLES.phoneNumber] || "",
    affiliationEntry: itemMap[FORM_FIELD_TITLES.affiliation] || "",
    preferredLanguageEntry: itemMap[FORM_FIELD_TITLES.preferredLanguage] || "",
    publicStatsSpreadsheetId: publicStatsSpreadsheet.getId(),
    publicStatsSheetId: String(publicStatsSheet.getSheetId()),
    publicStatsGvizUrl:
      "https://docs.google.com/spreadsheets/d/" +
      publicStatsSpreadsheet.getId() +
      "/gviz/tq?gid=" +
      publicStatsSheet.getSheetId() +
      "&tqx=out:json",
    publicStatsSheetUrl: publicStatsSpreadsheet.getUrl(),
  };
}

function writeConfigSheet_(spreadsheet, config, stats) {
  let sheet = spreadsheet.getSheetByName(CONFIG_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG_SHEET);
  }

  sheet.clear();
  sheet
    .getRange(1, 1, 1, 2)
    .setValues([["key", "value"]])
    .setFontWeight("bold");

  const rows = [
    ["generatedAtUtc", config.generatedAtUtc],
    ["formId", config.formId],
    ["formPublishedUrl", config.formPublishedUrl],
    ["formResponseUrl", config.formResponseUrl],
    ["responseSheetName", config.responseSheetName],
    ["fullNameEntry", config.fullNameEntry],
    ["emailAddressEntry", config.emailAddressEntry],
    ["phoneNumberEntry", config.phoneNumberEntry],
    ["affiliationEntry", config.affiliationEntry],
    ["preferredLanguageEntry", config.preferredLanguageEntry],
    ["publicStatsSpreadsheetId", config.publicStatsSpreadsheetId],
    ["publicStatsSheetId", config.publicStatsSheetId],
    ["publicStatsGvizUrl", config.publicStatsGvizUrl],
    ["publicStatsSheetUrl", config.publicStatsSheetUrl],
    ["currentUniqueVisitors", String(stats.uniqueVisitors)],
    ["currentTotalSubmissions", String(stats.totalSubmissions)],
    ["currentLastUpdatedUtc", stats.lastUpdatedUtc],
  ];

  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  sheet.autoResizeColumns(1, 2);
}

function findResponseSheet_(spreadsheet) {
  const properties = PropertiesService.getScriptProperties();
  const knownName = properties.getProperty(SCRIPT_PROPERTY_RESPONSE_SHEET_NAME);

  if (knownName) {
    const knownSheet = spreadsheet.getSheetByName(knownName);
    if (knownSheet) {
      return knownSheet;
    }
  }

  const titles = Object.keys(FORM_FIELD_TITLES).map(function (key) {
    return FORM_FIELD_TITLES[key];
  });

  const sheets = spreadsheet.getSheets();
  for (let index = 0; index < sheets.length; index += 1) {
    const sheet = sheets[index];
    const lastColumn = Math.max(sheet.getLastColumn(), 1);
    const header = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const hasAllFields = titles.every(function (title) {
      return header.indexOf(title) !== -1;
    });

    if (hasAllFields) {
      properties.setProperty(SCRIPT_PROPERTY_RESPONSE_SHEET_NAME, sheet.getName());
      return sheet;
    }
  }

  return null;
}

function calculateResponseStats_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return emptyStats_();
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  const header = values[0];
  const rows = values.slice(1).filter(function (row) {
    return row[0];
  });

  if (!rows.length) {
    return emptyStats_();
  }

  const phoneIndex = header.indexOf(FORM_FIELD_TITLES.phoneNumber);
  const uniquePhones = new Set();

  rows.forEach(function (row) {
    const phoneValue = phoneIndex === -1 ? "" : normalizePhone_(row[phoneIndex]);
    if (phoneValue) {
      uniquePhones.add(phoneValue);
    }
  });

  return {
    totalSubmissions: rows.length,
    uniqueVisitors: uniquePhones.size,
    lastUpdatedUtc: new Date().toISOString(),
  };
}

function emptyStats_() {
  return {
    totalSubmissions: 0,
    uniqueVisitors: 0,
    lastUpdatedUtc: "",
  };
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
