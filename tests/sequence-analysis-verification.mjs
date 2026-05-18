import fs from "fs";
import vm from "vm";
import { execFileSync } from "child_process";
import { chromium } from "playwright";

const repoRoot = "/Users/mahmoodalmoalm/Documents/New project/wahj-ngs-guide";
const sequencePageUrl =
  process.env.SEQUENCE_ANALYSIS_URL || "http://127.0.0.1:8000/sequence-analysis/";
const il1Sequence = `TACCTGAGCTCGCCAGTGAAATGATGGCTTATTACAGGTCAGTGGAGACGCTGAGACCAGTAACATGAGC
AGGTCTCCTCTTTCAAGAGTAGAGTGTTATCTGTGCTTGGAGACCAGATTTTTCCCCTAAATTGCCTCTT
TCAGTGGCAAACAGGGTGCCAAGTAAATCTGATTTAAAGACTACTTTCCCATTACAAGTCCCTCCAGCCT
TGGGACCTGGAGGCTATCCAGATGTGTTGTTGCAAGGGCTTCCTGCAGAGGCAAATGGGGAGAAAAGACT
CCAAGCCCACAATACAAGGAATCCCTTTGCAAAGTGTGGCTTGGAGGGAGAGGGAGAGCTCAGATTTTAG
CTGACTCTGCTGGGCTAGAGGTTAGGCCTCAAGATCCAACAGGGAGCACCCAGGGTGCCCACCTGCCAGG
CCTAGAATCTGCCTTCTGGACTGTTCTGCGCATATCACTGTGAAACTTGCCAGGTGTTTCAGGCAGCTTT
GAGAGGCAGGCTGTTTGCAGTTTCTTATGAACAGTCAAGTCTTGTACACAGGGAAGGAAAAATAAACCTG
TTTAGAAGACATAATTGAGACATGTCCCTGTTTTTATTACAGTGGCAATGAGGATGACTTGTTCTTTGAA
GCTGATGGCCCTAAACAGATGAAGGTAAGACTATGGGTTTAACTCCCAACCCAAGGAAGGGCTCTAACAC
AGGGAAAGCTCAAAGAAGGGAGTTCTGGGCCACTTTGATGCCATGGTATTTTGTTTTAGAAAGACTTTAA
CCTCTTCCAGTGAGACACAGGCTGCACCACTTGCTGACCTGGCCACTTGGTCATCATATCACCACAGTCA
CTCACTAACGTTGGTGGTGGTGGCCACACTTGGTGGTGACAGGGGAGGAGTAGTGATAATGTTTCCCATT
TCATAGTAGGAAGACAACCAAGTCTTCAACATAAATTTGATTATCCTTTTAAGAGATGGATTCAGCCTAT
GCCAATCACTTGAGTTAAACTCTGAAACCAAGAGATGATCTTGAGAACTAACATATGTCTACCCCTTTTG
AGTAGAATAGTTTTTTGCTACCTGGGGTGAAGCTTATAACAACAAGACATAGATGATATAAACAAAAAGA
TGAATTGAGACTTGAAAGAAAACCATTCACTTGCTGTTTGACCTTGACAAGTCATTTTACCCGCTTTGGA
CCTCATCTGAAAAATAAAGGGCTGAGCTGGATGATCTCTGAGATTCCAGCATCCTGCAACCTCCAGTTCT
GAAATATTTTCAGTTGTAGCTAAGGGCATTTGGGCAGCAAATGGTCATTTTTCAGACTCATCCTTACAAA`;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readConfiguredApiUrl() {
  const configText = fs.readFileSync(`${repoRoot}/config.js`, "utf8");
  const match = configText.match(/sequenceAnalysisApiUrl:\s*"([^"]*)"/);
  return match ? match[1] : "";
}

function runLocalBackendVerification() {
  const code = fs.readFileSync(
    `${repoRoot}/backend/google-apps-script/Code.gs`,
    "utf8"
  );

  const context = {
    console,
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Array,
    Object,
    RegExp,
    encodeURIComponent,
    decodeURIComponent,
    CacheService: {
      getScriptCache() {
        return {
          get() {
            return null;
          },
          put() {},
          remove() {},
        };
      },
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() {},
          releaseLock() {},
        };
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(name) {
            if (name === "NCBI_CONTACT_EMAIL") {
              return "training@example.org";
            }
            if (name === "NCBI_TOOL_NAME") {
              return "WahjSequenceAnalysis";
            }
            return "";
          },
        };
      },
    },
    UrlFetchApp: {
      fetch(url) {
        const body = execFileSync("curl", ["-sL", url], { encoding: "utf8" });
        return {
          getResponseCode() {
            return 200;
          },
          getContentText() {
            return body;
          },
        };
      },
    },
    ContentService: {
      MimeType: {
        JSON: "application/json",
        JAVASCRIPT: "application/javascript",
      },
      createTextOutput(text) {
        return {
          text,
          mimeType: "",
          setMimeType(mimeType) {
            this.mimeType = mimeType;
            return this;
          },
        };
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(code, context);

  const health = context.dispatchAction_(
    context.normalizeActionName_("sequenceAnalysisHealth"),
    {}
  );
  const homo = context.dispatchAction_(
    context.normalizeActionName_("taxonomySearch"),
    { organismName: "Homo sapiens" }
  );
  const bacillus = context.dispatchAction_(
    context.normalizeActionName_("taxonomySearch"),
    { organismName: "Bacillus pumilus" }
  );
  const unsupported = context.dispatchAction_(
    context.normalizeActionName_("unknownAction"),
    {}
  );

  assert(health.ok === true, "Local backend health check failed.");
  assert(
    JSON.stringify(health.supportedActions) ===
      JSON.stringify([
        "sequenceAnalysisHealth",
        "taxonomySearch",
        "blastSubmit",
        "blastStatus",
        "blastResult",
      ]),
    "Local backend supportedActions list is incorrect."
  );
  assert(
    homo.candidates?.[0]?.taxId === "9606",
    "Local backend taxonomySearch did not resolve Homo sapiens to TaxId 9606."
  );
  assert(
    bacillus.candidates?.[0]?.taxId === "1408",
    "Local backend taxonomySearch did not resolve Bacillus pumilus to TaxId 1408."
  );
  assert(
    unsupported.supportedActions?.includes("sequenceAnalysisHealth"),
    "Unsupported action response did not include supportedActions."
  );

  return {
    health,
    homoFirst: homo.candidates[0],
    bacillusFirst: bacillus.candidates[0],
    unsupported,
  };
}

async function runUiVerification() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  await page.goto(sequencePageUrl, { waitUntil: "networkidle" });

  const initial = {
    analysisStatus: await page.locator("#analysis-status").textContent(),
    taxonomyStatus: await page.locator("#taxonomy-status").textContent(),
    blastStatus: await page.locator("#blast-session-status").textContent(),
    findDisabled: await page.locator("#find-organism").isDisabled(),
    runDisabled: await page.locator("#run-blast").isDisabled(),
  };

  await page.locator("#sequence-input").fill("ACGTACGT");
  await page.locator("#clean-sequence").click();
  const simple = {
    length: await page.locator("#metric-length").textContent(),
    fasta: await page.locator("#fasta-preview").textContent(),
  };

  await page.locator("#clear-form").click();
  await page.locator("#sequence-input").fill(">test\nacgtu 123");
  await page.locator("#clean-sequence").click();
  const fastaLower = {
    length: await page.locator("#metric-length").textContent(),
    fasta: await page.locator("#fasta-preview").textContent(),
  };

  await page.locator("#clear-form").click();
  await page.locator("#sequence-input").fill(il1Sequence);
  await page.locator("#clean-sequence").click();
  const il1 = {
    length: await page.locator("#metric-length").textContent(),
    gc: await page.locator("#metric-gc").textContent(),
    taxonomyStatus: await page.locator("#taxonomy-status").textContent(),
    resultsNote: await page.locator("#results-note").textContent(),
  };

  await page.locator("#load-demo-result").click();
  const demo = {
    blastBadge: await page.locator("#blast-badge").textContent(),
    taxonomyBadge: await page.locator("#taxonomy-badge").textContent(),
    alignmentStatus: await page.locator("#alignment-status").textContent(),
    selectedTaxId: await page.locator("#selected-taxid").textContent(),
  };

  await page.locator("#sequence-input").fill("TTTTGGGG");
  const afterEdit = {
    length: await page.locator("#metric-length").textContent(),
    resultsNote: await page.locator("#results-note").textContent(),
    blastBadge: await page.locator("#blast-badge").textContent(),
    alignmentTitle: await page.locator("#alignment-title").textContent(),
  };

  await browser.close();

  assert(
    initial.findDisabled === true && initial.runDisabled === true,
    "Live taxonomy/BLAST buttons should be disabled when backend health fails."
  );
  assert(simple.length === "8 bp", "Simple sequence clean expected 8 bp.");
  assert(simple.fasta.includes("ACGTACGT"), "Simple FASTA preview is incorrect.");
  assert(fastaLower.length === "5 bp", "FASTA lower/U cleaning expected 5 bp.");
  assert(fastaLower.fasta.includes("ACGTT"), "FASTA lower/U cleaning expected ACGTT.");
  assert(il1.length === "1330 bp", "IL-1 cleaned length expected 1330 bp.");
  assert(il1.gc === "44.7%", "IL-1 GC% expected 44.7%.");
  assert(
    !/Bacillus/i.test(il1.resultsNote),
    "Bacillus demo data leaked into the non-demo IL-1 state."
  );
  assert(
    demo.blastBadge === "DEMO RESULT — not from NCBI",
    "Demo blast badge is incorrect."
  );
  assert(demo.taxonomyBadge === "Demo candidate", "Demo taxonomy badge is incorrect.");
  assert(demo.selectedTaxId === "1408", "Demo TaxId expected 1408.");
  assert(afterEdit.length === "0 bp", "Editing the sequence after demo should clear the summary.");
  assert(
    afterEdit.blastBadge === "Backend not ready",
    "Editing the sequence after demo should clear the demo BLAST state."
  );

  return { initial, simple, fastaLower, il1, demo, afterEdit };
}

function testConfiguredBackend() {
  const apiUrl = readConfiguredApiUrl();
  if (!apiUrl) {
    return {
      configured: false,
      message: "sequenceAnalysisApiUrl is not configured.",
    };
  }

  const healthText = execFileSync("curl", ["-sL", `${apiUrl}?action=sequenceAnalysisHealth`], {
    encoding: "utf8",
  }).trim();
  const homoText = execFileSync(
    "curl",
    ["-sL", `${apiUrl}?action=taxonomySearch&organismName=Homo%20sapiens`],
    { encoding: "utf8" }
  ).trim();

  let health;
  let homo;
  try {
    health = JSON.parse(healthText);
  } catch (error) {
    health = { ok: false, error: `Invalid JSON: ${healthText}` };
  }

  try {
    homo = JSON.parse(homoText);
  } catch (error) {
    homo = { ok: false, error: `Invalid JSON: ${homoText}` };
  }

  return {
    configured: true,
    apiUrl,
    health,
    homo,
  };
}

const summary = {
  sequencePageUrl,
  ui: await runUiVerification(),
  localBackend: runLocalBackendVerification(),
  configuredBackend: testConfiguredBackend(),
};

console.log(JSON.stringify(summary, null, 2));
