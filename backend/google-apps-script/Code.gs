const SPREADSHEET_ID = "1bF4CgbdG_0K34i9yM9gZl3yweLBwli_XLeARUMeJqFo";
const READERS_SHEET = "Readers";
const COMMENTS_SHEET = "Comments";
const NCBI_ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const NCBI_ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
const NCBI_BLAST_URL = "https://blast.ncbi.nlm.nih.gov/Blast.cgi";
const NCBI_MIN_ACTION_INTERVAL_MS = 10000;
const NCBI_MIN_RID_POLL_INTERVAL_MS = 60000;
const BLAST_CACHE_SECONDS = 21600;
const BLAST_DEFAULT_DATABASE = "core_nt";
const BLAST_DEFAULT_HITLIST_SIZE = 10;
const BLAST_MAX_SEQUENCE_LENGTH = 2000;

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
  const action = normalizeActionName_(params.action || "stats");
  return outputResponse_(dispatchAction_(action, params), params.callback);
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

  const action = normalizeActionName_(payload.action);
  return jsonOutput_(dispatchAction_(action, payload));
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

function dispatchAction_(action, params) {
  try {
    if (action === "visit") {
      return registerReaderVisit_(params);
    }

    if (action === "stats") {
      return {
        ok: true,
        stats: getStats_(),
      };
    }

    if (action === "comments") {
      return {
        ok: true,
        comments: getComments_(params.limit),
      };
    }

    if (action === "comment") {
      return registerComment_(params);
    }

    if (action === "sequenceAnalysisHealth") {
      return sequenceAnalysisHealth_();
    }

    if (action === "taxonomySearch") {
      return taxonomySearch_(params);
    }

    if (action === "blastSubmit") {
      return blastSubmit_(params);
    }

    if (action === "blastStatus") {
      return blastStatus_(params);
    }

    if (action === "blastResult") {
      return blastResult_(params);
    }

    return {
      ok: false,
      error: "Unsupported action.",
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error && error.message ? error.message : error),
    };
  }
}

function normalizeActionName_(actionValue) {
  const normalized = sanitizeText_(actionValue).toLowerCase();
  const aliases = {
    visit: "visit",
    stats: "stats",
    comments: "comments",
    comment: "comment",
    sequenceanalysishealth: "sequenceAnalysisHealth",
    taxonomysearch: "taxonomySearch",
    blastsubmit: "blastSubmit",
    blaststatus: "blastStatus",
    blastresult: "blastResult",
  };

  return aliases[normalized] || sanitizeText_(actionValue);
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

function sequenceAnalysisHealth_() {
  return {
    ok: true,
    feature: "sequence-analysis",
    supportedActions: [
      "sequenceAnalysisHealth",
      "taxonomySearch",
      "blastSubmit",
      "blastStatus",
      "blastResult",
    ],
    message: "Sequence Analysis backend is available.",
  };
}

function taxonomySearch_(input) {
  const organismName = truncateText_(sanitizeText_(input.organismName), 160);
  if (!organismName) {
    return {
      ok: false,
      error: "Missing organismName.",
    };
  }

  const cacheKey = "taxonomy:" + organismName.toLowerCase();
  const cached = readCacheJson_(cacheKey);
  if (cached) {
    return {
      ok: true,
      organismName: organismName,
      candidates: cached,
      cached: true,
    };
  }

  const ncbiSettings = getNcbiSettings_();
  const rateLimit = reserveNcbiActionSlot_();
  if (!rateLimit.ok) {
    return {
      ok: false,
      error: rateLimit.message,
      nextAllowedPollSeconds: rateLimit.nextAllowedPollSeconds,
    };
  }

  const searchUrl = buildUrl_(NCBI_ESEARCH_URL, {
    db: "taxonomy",
    term: organismName + "[All Names]",
    retmax: "8",
    retmode: "json",
    tool: ncbiSettings.toolName,
    email: ncbiSettings.contactEmail,
  });
  const searchData = fetchJson_(searchUrl);
  const idList =
    (searchData &&
      searchData.esearchresult &&
      searchData.esearchresult.idlist) ||
    [];

  if (!idList.length) {
    cacheJson_(cacheKey, [], 1800);
    return {
      ok: true,
      organismName: organismName,
      candidates: [],
      cached: false,
    };
  }

  const summaryUrl = buildUrl_(NCBI_ESUMMARY_URL, {
    db: "taxonomy",
    id: idList.join(","),
    retmode: "json",
    tool: ncbiSettings.toolName,
    email: ncbiSettings.contactEmail,
  });
  const summaryData = fetchJson_(summaryUrl);
  const summaryRoot = summaryData && summaryData.result ? summaryData.result : {};
  const candidates = idList
    .map(function (taxId) {
      const item = summaryRoot[taxId] || {};
      return {
        taxId: String(item.uid || taxId || ""),
        scientificName: sanitizeText_(item.scientificname || item.title),
        rank: sanitizeText_(item.rank),
        commonName: sanitizeText_(item.commonname),
        lineage: sanitizeText_(item.lineage),
      };
    })
    .filter(function (item) {
      return item.taxId && item.scientificName;
    });

  cacheJson_(cacheKey, candidates, 1800);
  return {
    ok: true,
    organismName: organismName,
    candidates: candidates,
    cached: false,
  };
}

function blastSubmit_(input) {
  const settings = getNcbiSettings_();
  if (!settings.contactEmail) {
    return {
      ok: false,
      error:
        "Sequence Analysis setup is incomplete. Add Script Property NCBI_CONTACT_EMAIL before submitting BLAST searches.",
    };
  }

  const cleaned = cleanSequenceInput_(input.sequence);
  if (!cleaned.ok) {
    return cleaned;
  }

  if (cleaned.sequence.length < 50) {
    return {
      ok: false,
      error: "Sequence must be at least 50 bp after cleaning.",
    };
  }

  if (cleaned.sequence.length > BLAST_MAX_SEQUENCE_LENGTH) {
    return {
      ok: false,
      error:
        "Sequence is longer than the teaching safety limit of 2000 bp. Shorten or trim the query before BLAST submission.",
    };
  }

  const rateLimit = reserveNcbiActionSlot_();
  if (!rateLimit.ok) {
    return {
      ok: false,
      error: rateLimit.message,
      nextAllowedPollSeconds: rateLimit.nextAllowedPollSeconds,
    };
  }

  const organismName = truncateText_(sanitizeText_(input.organismName), 160);
  const sampleNumber = truncateText_(sanitizeText_(input.sampleNumber), 60);
  const wahjSampleId = truncateText_(sanitizeText_(input.wahjSampleId), 60);
  const sequenceTitle = truncateText_(sanitizeText_(input.sequenceTitle), 160);
  const geneMarker = truncateText_(sanitizeText_(input.geneMarker), 120);
  const taxId = sanitizeTaxId_(input.taxId);
  const database = sanitizeBlastDatabase_(input.database);
  const hitlistSize = sanitizeHitlistSize_(input.hitlistSize);
  const fastaQuery = buildBlastFasta_(sampleNumber, wahjSampleId, sequenceTitle, organismName, geneMarker, cleaned.sequence);

  const responseText = fetchText_(NCBI_BLAST_URL, {
    method: "post",
    payload: {
      CMD: "Put",
      PROGRAM: "blastn",
      DATABASE: database,
      QUERY: fastaQuery,
      MEGABLAST: "on",
      HITLIST_SIZE: String(hitlistSize),
      EXPECT: "10",
      tool: settings.toolName,
      email: settings.contactEmail,
    },
    muteHttpExceptions: true,
    followRedirects: true,
  });

  const rid = extractMatch_(responseText, /RID\s*=\s*([A-Z0-9-]+)/i);
  const rtoe = Number(extractMatch_(responseText, /RTOE\s*=\s*(\d+)/i) || 0);

  if (!rid) {
    return {
      ok: false,
      error:
        "NCBI did not return a BLAST RID. Review the input sequence and server response before trying again.",
      serverResponsePreview: truncateText_(sanitizeText_(responseText), 300),
    };
  }

  cacheJson_(
    "blast-metadata:" + rid,
    {
      sampleNumber: sampleNumber,
      wahjSampleId: wahjSampleId,
      sequenceTitle: sequenceTitle,
      organismName: organismName,
      geneMarker: geneMarker,
      taxId: taxId,
      database: database,
      queryLength: cleaned.sequence.length,
    },
    BLAST_CACHE_SECONDS
  );

  return {
    ok: true,
    rid: rid,
    rtoe: rtoe,
    submittedAt: new Date().toISOString(),
    nextAllowedPollSeconds: Math.max(60, rtoe || 60),
    message:
      "BLAST search submitted to NCBI. Wait before checking status so the public service is not polled too frequently.",
  };
}

function blastStatus_(input) {
  const rid = sanitizeBlastRid_(input.rid);
  if (!rid) {
    return {
      ok: false,
      error: "Missing or invalid RID.",
    };
  }

  const cachedResult = readCacheJson_("blast-result:" + rid + ":all");
  if (cachedResult) {
    return {
      ok: true,
      status: "READY",
      nextAllowedPollSeconds: 0,
      message: "A cached BLAST result is already available for this RID.",
    };
  }

  const ridWindow = reserveRidPollSlot_(rid);
  if (!ridWindow.ok) {
    return {
      ok: true,
      status: "WAITING",
      nextAllowedPollSeconds: ridWindow.nextAllowedPollSeconds,
      message: ridWindow.message,
    };
  }

  const rateLimit = reserveNcbiActionSlot_();
  if (!rateLimit.ok) {
    return {
      ok: true,
      status: "WAITING",
      nextAllowedPollSeconds: Math.max(60, rateLimit.nextAllowedPollSeconds),
      message: rateLimit.message,
    };
  }

  const statusText = fetchText_(
    buildUrl_(NCBI_BLAST_URL, {
      CMD: "Get",
      RID: rid,
    }),
    {
      muteHttpExceptions: true,
      followRedirects: true,
    }
  );
  const parsedStatus = parseBlastStatusText_(statusText);
  if (parsedStatus.status === "READY") {
    cacheJson_(
      "blast-ready:" + rid,
      {
        readyAt: new Date().toISOString(),
      },
      900
    );
  }
  return {
    ok: true,
    status: parsedStatus.status,
    nextAllowedPollSeconds: parsedStatus.status === "READY" ? 0 : 60,
    message: parsedStatus.message,
  };
}

function blastResult_(input) {
  const rid = sanitizeBlastRid_(input.rid);
  if (!rid) {
    return {
      ok: false,
      error: "Missing or invalid RID.",
    };
  }

  const selectedTaxId = sanitizeTaxId_(input.selectedTaxId);
  const selectedOrganismName = truncateText_(sanitizeText_(input.selectedOrganismName), 160);
  const cachedAllResult = readCacheJson_("blast-result:" + rid + ":all");
  if (cachedAllResult) {
    return buildFilteredBlastResult_(cachedAllResult, selectedTaxId, selectedOrganismName, true);
  }

  if (!readCacheJson_("blast-ready:" + rid)) {
    const ridWindow = reserveRidPollSlot_(rid);
    if (!ridWindow.ok) {
      return {
        ok: true,
        status: "WAITING",
        nextAllowedPollSeconds: ridWindow.nextAllowedPollSeconds,
        message: ridWindow.message,
      };
    }
  }

  const rateLimit = reserveNcbiActionSlot_();
  if (!rateLimit.ok) {
    return {
      ok: true,
      status: "WAITING",
      nextAllowedPollSeconds: Math.max(60, rateLimit.nextAllowedPollSeconds),
      message: rateLimit.message,
    };
  }

  const jsonText = fetchText_(
    buildUrl_(NCBI_BLAST_URL, {
      CMD: "Get",
      RID: rid,
      FORMAT_TYPE: "JSON2",
      DESCRIPTIONS: String(BLAST_DEFAULT_HITLIST_SIZE),
      ALIGNMENTS: String(BLAST_DEFAULT_HITLIST_SIZE),
    }),
    {
      muteHttpExceptions: true,
      followRedirects: true,
    }
  );

  let blastData;
  try {
    blastData = JSON.parse(jsonText);
  } catch (error) {
    const waitingStatus = parseBlastStatusText_(jsonText);
    return {
      ok: true,
      status: waitingStatus.status,
      nextAllowedPollSeconds: waitingStatus.status === "READY" ? 0 : 60,
      message: waitingStatus.message,
    };
  }

  const metadata = readCacheJson_("blast-metadata:" + rid) || {};
  const parsedJson = parseBlastJsonResult_(blastData);
  const textReport = fetchText_(
    buildUrl_(NCBI_BLAST_URL, {
      CMD: "Get",
      RID: rid,
      FORMAT_TYPE: "Text",
      DESCRIPTIONS: String(BLAST_DEFAULT_HITLIST_SIZE),
      ALIGNMENTS: String(BLAST_DEFAULT_HITLIST_SIZE),
    }),
    {
      muteHttpExceptions: true,
      followRedirects: true,
    }
  );
  const parsedTextHits = parseBlastTextHits_(textReport);
  const mergedHits = mergeBlastHits_(parsedJson.hits, parsedTextHits);
  const fullPayload = {
    ok: true,
    status: "READY",
    rid: rid,
    queryLength: parsedJson.queryLength || metadata.queryLength || 0,
    queryTitle: parsedJson.queryTitle || metadata.sequenceTitle || "",
    sampleNumber: metadata.sampleNumber || "",
    wahjSampleId: metadata.wahjSampleId || "",
    organismName: metadata.organismName || "",
    geneMarker: metadata.geneMarker || "",
    taxId: metadata.taxId || "",
    results: mergedHits,
    resultCount: mergedHits.length,
    message:
      mergedHits.length > 0
        ? "BLAST result is ready."
        : "BLAST completed, but no teaching result rows were parsed from the returned report.",
  };

  cacheJson_("blast-result:" + rid + ":all", fullPayload, BLAST_CACHE_SECONDS);
  return buildFilteredBlastResult_(fullPayload, selectedTaxId, selectedOrganismName, false);
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

function getNcbiSettings_() {
  const properties = PropertiesService.getScriptProperties();
  const contactEmail = truncateText_(sanitizeText_(properties.getProperty("NCBI_CONTACT_EMAIL")), 200);
  const configuredToolName = truncateText_(
    sanitizeText_(properties.getProperty("NCBI_TOOL_NAME")),
    120
  );

  return {
    contactEmail: contactEmail,
    toolName: configuredToolName || "WahjSequenceAnalysis",
  };
}

function reserveNcbiActionSlot_() {
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const now = new Date().getTime();
    const lastActionAt = Number(cache.get("ncbi:last-action-at") || 0);
    if (lastActionAt && now - lastActionAt < NCBI_MIN_ACTION_INTERVAL_MS) {
      const waitSeconds = Math.ceil(
        (NCBI_MIN_ACTION_INTERVAL_MS - (now - lastActionAt)) / 1000
      );
      return {
        ok: false,
        nextAllowedPollSeconds: waitSeconds,
        message:
          "NCBI usage guard is active. Wait " +
          waitSeconds +
          " more seconds before sending another server request.",
      };
    }

    cache.put("ncbi:last-action-at", String(now), 3600);
    return {
      ok: true,
    };
  } finally {
    lock.releaseLock();
  }
}

function reserveRidPollSlot_(rid) {
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  const cacheKey = "ncbi:last-rid-poll:" + rid;
  lock.waitLock(10000);

  try {
    const now = new Date().getTime();
    const lastPollAt = Number(cache.get(cacheKey) || 0);
    if (lastPollAt && now - lastPollAt < NCBI_MIN_RID_POLL_INTERVAL_MS) {
      const waitSeconds = Math.ceil(
        (NCBI_MIN_RID_POLL_INTERVAL_MS - (now - lastPollAt)) / 1000
      );
      return {
        ok: false,
        nextAllowedPollSeconds: waitSeconds,
        message:
          "This RID was checked recently. Wait " +
          waitSeconds +
          " more seconds before polling the same BLAST request again.",
      };
    }

    cache.put(cacheKey, String(now), 3600);
    return {
      ok: true,
    };
  } finally {
    lock.releaseLock();
  }
}

function buildUrl_(baseUrl, params) {
  const pairs = Object.keys(params || {})
    .filter(function (key) {
      return params[key] !== undefined && params[key] !== null && params[key] !== "";
    })
    .map(function (key) {
      return (
        encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key]))
      );
    });

  return baseUrl + (pairs.length ? "?" + pairs.join("&") : "");
}

function fetchText_(url, options) {
  const response = UrlFetchApp.fetch(url, options || {});
  const statusCode = response.getResponseCode();
  const body = response.getContentText();
  if (statusCode >= 400) {
    throw new Error(
      "NCBI request failed with HTTP " + statusCode + ". Response preview: " + body.slice(0, 300)
    );
  }

  return body;
}

function fetchJson_(url) {
  return JSON.parse(
    fetchText_(url, {
      muteHttpExceptions: true,
      followRedirects: true,
    })
  );
}

function cleanSequenceInput_(sequenceInput) {
  const payloadLines = String(sequenceInput || "")
    .split(/\r?\n/)
    .filter(function (line) {
      return !/^>/.test(sanitizeText_(line));
    });
  const cleanedSequence = payloadLines
    .join("")
    .replace(/[\s0-9]+/g, "")
    .toUpperCase()
    .replace(/U/g, "T");

  if (!cleanedSequence) {
    return {
      ok: false,
      error:
        "Sequence is empty after removing FASTA headers, spaces, numbers, and line breaks.",
    };
  }

  const invalidCharacters = cleanedSequence
    .replace(/[ACGTRYSWKMBDHVN]/g, "")
    .split("")
    .filter(function (character, index, array) {
      return character && array.indexOf(character) === index;
    });

  if (invalidCharacters.length) {
    return {
      ok: false,
      error:
        "Invalid sequence characters detected: " +
        invalidCharacters.join(", ") +
        ". Allowed codes are A C G T U R Y S W K M B D H V N.",
    };
  }

  return {
    ok: true,
    sequence: cleanedSequence,
  };
}

function buildBlastFasta_(sampleNumber, wahjSampleId, sequenceTitle, organismName, geneMarker, sequence) {
  const headerParts = [sequenceTitle, sampleNumber ? "Sample " + sampleNumber : "", wahjSampleId ? "Wahj " + wahjSampleId : "", organismName, geneMarker]
    .map(function (value) {
      return sanitizeText_(value);
    })
    .filter(Boolean);

  return ">" + truncateText_(headerParts.join(" | ") || "Wahj Sequence Query", 220) + "\n" + sequence;
}

function sanitizeBlastDatabase_(value) {
  const database = truncateText_(sanitizeText_(value), 40);
  return /^[A-Za-z0-9_]+$/.test(database) ? database : BLAST_DEFAULT_DATABASE;
}

function sanitizeHitlistSize_(value) {
  const parsed = Number(value);
  if (!parsed || parsed < 1) {
    return BLAST_DEFAULT_HITLIST_SIZE;
  }

  return Math.min(parsed, BLAST_DEFAULT_HITLIST_SIZE);
}

function sanitizeBlastRid_(value) {
  const rid = truncateText_(sanitizeText_(value).toUpperCase(), 32);
  return /^[A-Z0-9-]+$/.test(rid) ? rid : "";
}

function sanitizeTaxId_(value) {
  const taxId = truncateText_(sanitizeText_(value), 24);
  return /^\d+$/.test(taxId) ? taxId : "";
}

function extractMatch_(value, expression) {
  const match = String(value || "").match(expression);
  return match && match[1] ? match[1] : "";
}

function parseBlastStatusText_(statusText) {
  const normalizedText = String(statusText || "");

  if (/Status=WAITING/i.test(normalizedText)) {
    return {
      status: "WAITING",
      message: "NCBI is still processing this BLAST RID.",
    };
  }

  if (/Status=FAILED/i.test(normalizedText)) {
    return {
      status: "FAILED",
      message: "NCBI reported that the BLAST search failed.",
    };
  }

  if (/Status=UNKNOWN/i.test(normalizedText)) {
    return {
      status: "UNKNOWN",
      message: "NCBI could not confirm this RID yet.",
    };
  }

  if (/ThereAreHits=yes/i.test(normalizedText) || /ThereAreNoHits=yes/i.test(normalizedText) || /Status=READY/i.test(normalizedText)) {
    return {
      status: "READY",
      message: /ThereAreNoHits=yes/i.test(normalizedText)
        ? "BLAST completed with no hits returned."
        : "BLAST results are ready.",
    };
  }

  return {
    status: "UNKNOWN",
    message: "BLAST status could not be interpreted from the NCBI response.",
  };
}

function parseBlastJsonResult_(blastData) {
  const outputArray = blastData && blastData.BlastOutput2 ? blastData.BlastOutput2 : [];
  const report = outputArray.length && outputArray[0].report ? outputArray[0].report : {};
  const search = report.results && report.results.search ? report.results.search : {};
  const hits = Array.isArray(search.hits) ? search.hits : [];

  return {
    queryTitle: sanitizeText_(search.query_title),
    queryLength: Number(search.query_len) || 0,
    hits: hits.map(function (hit) {
      const description = hit.description && hit.description.length ? hit.description[0] : {};
      const hsp = hit.hsps && hit.hsps.length ? hit.hsps[0] : {};
      const alignLength = Number(hsp.align_len) || 0;
      const identityCount = Number(hsp.identity) || 0;
      const gapCount = Number(hsp.gaps) || 0;
      const accession = sanitizeText_(description.accession || description.id || "");

      return {
        accession: accession,
        title: sanitizeText_(description.title),
        organism: sanitizeText_(description.sciname),
        taxId: String(description.taxid || ""),
        sequenceLength: Number(hit.len) || 0,
        score: Number(hsp.score) || 0,
        bitScore: Number(hsp.bit_score) || 0,
        eValue: hsp.evalue !== undefined ? String(hsp.evalue) : "",
        identitiesNumerator: identityCount,
        identitiesDenominator: alignLength,
        percentIdentity: alignLength ? roundNumber_((identityCount / alignLength) * 100, 1) : 0,
        gapsNumerator: gapCount,
        gapsDenominator: alignLength,
        percentGaps: alignLength ? roundNumber_((gapCount / alignLength) * 100, 1) : 0,
        queryCoverage:
          search.query_len && alignLength
            ? roundNumber_((alignLength / Number(search.query_len)) * 100, 1)
            : 0,
        range:
          hsp.query_from && hsp.query_to
            ? String(hsp.query_from) + " to " + String(hsp.query_to)
            : "",
        queryFrom: Number(hsp.query_from) || 0,
        queryTo: Number(hsp.query_to) || 0,
        subjectFrom: Number(hsp.hit_from) || 0,
        subjectTo: Number(hsp.hit_to) || 0,
        querySequence: sanitizeText_(hsp.qseq),
        subjectSequence: sanitizeText_(hsp.hseq),
        matchBars: sanitizeText_(hsp.midline),
        numberOfMatches: identityCount,
        genbankUrl: accession
          ? "https://www.ncbi.nlm.nih.gov/nuccore/" + encodeURIComponent(accession)
          : "",
      };
    }),
  };
}

function parseBlastTextHits_(textReport) {
  const lines = String(textReport || "").split(/\r?\n/);
  const hits = [];
  let current = null;
  let currentLines = [];

  function pushCurrent_() {
    if (!current) {
      return;
    }

    current.alignmentText = currentLines.join("\n").trim();
    hits.push(current);
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^>/.test(line)) {
      pushCurrent_();
      current = {
        title: sanitizeText_(line.replace(/^>/, "")),
        accession: sanitizeText_(line.replace(/^>\s*/, "").split(/\s+/)[0]),
      };
      currentLines = [];
      continue;
    }

    if (!current) {
      continue;
    }

    if (!current.length && /^Length=/.test(line)) {
      current.length = sanitizeText_(line.replace(/^Length=/, ""));
      continue;
    }

    if (!current.scoreLine && /\bScore =/.test(line)) {
      current.scoreLine = sanitizeText_(line);
      continue;
    }

    if (!current.identitiesLine && /\bIdentities =/.test(line)) {
      current.identitiesLine = sanitizeText_(line);
      continue;
    }

    if (/^Query\s+\d+/.test(line) && /^Sbjct\s+\d+/.test(lines[index + 2] || "")) {
      currentLines.push(line);
      currentLines.push(lines[index + 1] || "");
      currentLines.push(lines[index + 2] || "");
      currentLines.push("");
      index += 2;
    }
  }

  pushCurrent_();
  return hits;
}

function mergeBlastHits_(jsonHits, textHits) {
  const textMap = {};
  textHits.forEach(function (hit) {
    if (hit.accession) {
      textMap[hit.accession] = hit;
    }
  });

  return jsonHits.map(function (hit, index) {
    const textHit = textMap[hit.accession] || textHits[index] || {};
    return {
      accession: hit.accession,
      title: hit.title || textHit.title || "",
      organism: hit.organism || "",
      taxId: hit.taxId || "",
      sequenceLength: hit.sequenceLength,
      score: hit.bitScore ? String(hit.bitScore) + " bits (" + String(hit.score) + ")" : String(hit.score),
      expect: hit.eValue,
      identities: String(hit.identitiesNumerator) + "/" + String(hit.identitiesDenominator) + " (" + String(hit.percentIdentity) + "%)",
      gaps: String(hit.gapsNumerator) + "/" + String(hit.gapsDenominator) + " (" + String(hit.percentGaps) + "%)",
      percentIdentity: hit.percentIdentity,
      queryCoverage: hit.queryCoverage,
      eValue: hit.eValue,
      range: hit.range,
      numberOfMatches: hit.numberOfMatches,
      genbankUrl: hit.genbankUrl,
      graphicsUrl: "",
      alignmentText:
        textHit.alignmentText ||
        buildAlignmentTextFromJson_(hit.queryFrom, hit.querySequence, hit.matchBars, hit.subjectFrom, hit.subjectSequence),
      sameOrganism: false,
      source: hit.title || textHit.title || "",
      taxIdString: hit.taxId || "",
    };
  });
}

function buildFilteredBlastResult_(payload, selectedTaxId, selectedOrganismName, cachedFlag) {
  const normalizedOrganismName = selectedOrganismName.toLowerCase();
  const results = (payload.results || []).map(function (hit) {
    const sameOrganism =
      (selectedTaxId && String(hit.taxIdString || hit.taxId || "") === selectedTaxId) ||
      (normalizedOrganismName &&
        sanitizeText_(hit.source || hit.title || "")
          .toLowerCase()
          .indexOf(normalizedOrganismName) !== -1);

    return {
      accession: hit.accession,
      title: hit.title || hit.source || "",
      source: hit.source || hit.title || "",
      organism: hit.organism || "",
      taxId: hit.taxIdString || hit.taxId || "",
      sequenceLength: hit.sequenceLength,
      score: hit.score,
      expect: hit.expect || hit.eValue,
      identities: hit.identities,
      gaps: hit.gaps,
      percentIdentity: hit.percentIdentity,
      queryCoverage: hit.queryCoverage,
      eValue: hit.eValue,
      range: hit.range,
      numberOfMatches: hit.numberOfMatches,
      genbankUrl: hit.genbankUrl,
      graphicsUrl: "https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Get&RID=" + encodeURIComponent(payload.rid),
      alignmentText: hit.alignmentText,
      sameOrganism: sameOrganism,
    };
  });

  return {
    ok: true,
    cached: cachedFlag,
    status: payload.status || "READY",
    rid: payload.rid,
    queryLength: payload.queryLength || 0,
    queryTitle: payload.queryTitle || "",
    sampleNumber: payload.sampleNumber || "",
    wahjSampleId: payload.wahjSampleId || "",
    organismName: payload.organismName || "",
    geneMarker: payload.geneMarker || "",
    taxId: payload.taxId || "",
    selectedTaxId: selectedTaxId,
    selectedOrganismName: selectedOrganismName,
    results: results,
    resultCount: results.length,
    message: payload.message || "",
  };
}

function buildAlignmentTextFromJson_(queryFrom, querySequence, matchBars, subjectFrom, subjectSequence) {
  if (!querySequence || !subjectSequence) {
    return "";
  }

  const lines = [];
  let queryPosition = Number(queryFrom) || 1;
  let subjectPosition = Number(subjectFrom) || 1;

  for (let index = 0; index < querySequence.length; index += 60) {
    const queryChunk = querySequence.slice(index, index + 60);
    const matchChunk = matchBars.slice(index, index + 60);
    const subjectChunk = subjectSequence.slice(index, index + 60);
    const queryEnd =
      queryPosition + queryChunk.replace(/-/g, "").length - 1;
    const subjectEnd =
      subjectPosition + subjectChunk.replace(/-/g, "").length - 1;

    lines.push(
      "Query " +
        padNumber_(queryPosition, 5) +
        "  " +
        queryChunk +
        "  " +
        padNumber_(queryEnd, 5)
    );
    lines.push("             " + matchChunk);
    lines.push(
      "Sbjct " +
        padNumber_(subjectPosition, 5) +
        "  " +
        subjectChunk +
        "  " +
        padNumber_(subjectEnd, 5)
    );
    lines.push("");

    queryPosition = queryEnd + 1;
    subjectPosition = subjectEnd + 1;
  }

  return lines.join("\n").trim();
}

function roundNumber_(value, digits) {
  const scale = Math.pow(10, digits);
  return Math.round(Number(value || 0) * scale) / scale;
}

function padNumber_(value, width) {
  let text = String(value || 0);
  while (text.length < width) {
    text = " " + text;
  }
  return text;
}

function readCacheJson_(key) {
  const rawValue = CacheService.getScriptCache().get(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    return null;
  }
}

function cacheJson_(key, payload, seconds) {
  CacheService.getScriptCache().put(key, JSON.stringify(payload), seconds || 600);
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
