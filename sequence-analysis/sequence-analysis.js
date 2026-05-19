const sequenceConfig = window.WAHJ_NGS_CONFIG || {};
const demoEnabled = sequenceConfig.sequenceAnalysisDemoEnabled !== false;
const sequenceApiUrl = (sequenceConfig.sequenceAnalysisApiUrl || "").trim();
const requiredSequenceActions = [
  "sequenceAnalysisHealth",
  "taxonomySearch",
  "blastSubmit",
  "blastStatus",
  "blastResult",
];

const allowedSequencePattern = /^[ACGTRYSWKMBDHVN]+$/;
const allowedSequenceCharacters = new Set("ACGTRYSWKMBDHVN".split(""));
const complementMap = {
  A: "T",
  C: "G",
  G: "C",
  T: "A",
  R: "Y",
  Y: "R",
  S: "S",
  W: "W",
  K: "M",
  M: "K",
  B: "V",
  D: "H",
  H: "D",
  V: "B",
  N: "N",
};

const demoResult = {
  ok: true,
  status: "READY",
  rid: "DEMO-RID-0001",
  sampleNumber: "5",
  wahjSampleId: "S5",
  sequenceTitle: "Bacterial isolate 5 forward read",
  organismName: "Bacillus pumilus",
  geneMarker: "16S rRNA",
  queryLength: 417,
  queryTitle: "Bacterial isolate 5 forward read | Bacillus pumilus | 16S rRNA",
  results: [
    {
      accession: "KF475848.1",
      title: "Bacillus pumilus strain IHB B 2692 16S ribosomal RNA gene, partial sequence",
      source: "Bacillus pumilus strain IHB B 2692 16S ribosomal RNA gene, partial sequence",
      organism: "Bacillus pumilus",
      taxId: "1408",
      sequenceLength: 417,
      score: "706 bits (382)",
      expect: "0.0",
      identities: "402/417 (96%)",
      gaps: "2/417 (0%)",
      percentIdentity: 96,
      queryCoverage: 95,
      eValue: "0.0",
      range: "28 to 442",
      numberOfMatches: 402,
      genbankUrl: "https://www.ncbi.nlm.nih.gov/nuccore/KF475848.1",
      graphicsUrl:
        "https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Get&RID=DEMO-RID-0001",
      sameOrganism: true,
      alignmentText: [
        "Query    28  AGAGTTTGATCCTGGCTCAGGATGAACGCTGGCGGCGTGCCTAATACATGCAAGT   87",
        "             ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||",
        "Sbjct    26  AGAGTTTGATCCTGGCTCAGGATGAACGCTGGCGGCGTGCCTAATACATGCAAGT   85",
        "",
        "Query    88  CGAGCGAAAGCGTGGGGAGCAAACAGGATTAGATACCCTGGTAGTCCACGCCGTA  147",
        "             ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||",
        "Sbjct    86  CGAGCGAAAGCGTGGGGAGCAAACAGGATTAGATACCCTGGTAGTCCACGCCGTA  145",
        "",
        "Query   148  AACGATGAGTGCTAAGTGTTAGAGGGTTTCCGCCCTTTAGTGCTGAAGTTAACGC  207",
        "             |||||||||||||||||||||||||||||||||||||||||||||||||| |||||||||",
        "Sbjct   146  AACGATGAGTGCTAAGTGTTAGAGGGTTTCCGCCCTTCAGTGCTGAAGTTAACGC  205",
        "",
        "Query   208  GTAACGTTGAGGTGCGGCTGGATCACCTCCTTTCTAAGGTTGGGCACTTAATGAT  267",
        "             ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||",
        "Sbjct   206  GTAACGTTGAGGTGCGGCTGGATCACCTCCTTTCTAAGGTTGGGCACTTAATGAT  265",
      ].join("\n"),
    },
  ],
};

const form = document.querySelector("#sequence-form-panel");
const sampleNumberInput = document.querySelector("#sample-number");
const wahjSampleIdInput = document.querySelector("#wahj-sample-id");
const sequenceTitleInput = document.querySelector("#sequence-title");
const organismNameInput = document.querySelector("#organism-name");
const geneMarkerInput = document.querySelector("#gene-marker");
const sequenceInput = document.querySelector("#sequence-input");

const cleanButton = document.querySelector("#clean-sequence");
const reverseComplementButton = document.querySelector("#reverse-complement");
const copyFastaButton = document.querySelector("#copy-fasta");
const clearFormButton = document.querySelector("#clear-form");
const demoButton = document.querySelector("#load-demo-result");
const findOrganismButton = document.querySelector("#find-organism");
const runBlastButton = document.querySelector("#run-blast");
const checkStatusButton = document.querySelector("#check-blast-status");
const loadResultButton = document.querySelector("#load-blast-result");

const analysisStatus = document.querySelector("#analysis-status");
const qualityBadge = document.querySelector("#quality-badge");
const qualityMessage = document.querySelector("#quality-message");
const fastaPreview = document.querySelector("#fasta-preview");
const taxonomyStatus = document.querySelector("#taxonomy-status");
const taxonomyBadge = document.querySelector("#taxonomy-badge");
const taxonomyCandidates = document.querySelector("#taxonomy-candidates");
const blastBadge = document.querySelector("#blast-badge");
const blastSessionStatus = document.querySelector("#blast-session-status");
const blastRid = document.querySelector("#blast-rid");
const selectedTaxid = document.querySelector("#selected-taxid");
const nextStatusCheck = document.querySelector("#next-status-check");
const backendUrlState = document.querySelector("#backend-url-state");
const resultsNote = document.querySelector("#results-note");
const resultsBody = document.querySelector("#blast-results-body");
const alignmentTitle = document.querySelector("#alignment-title");
const alignmentStatus = document.querySelector("#alignment-status");
const alignmentMeta = document.querySelector("#alignment-meta");
const alignmentLinks = document.querySelector("#alignment-links");
const alignmentBlock = document.querySelector("#alignment-block");
const interpretationCallout = document.querySelector("#interpretation-callout");

const metricElements = {
  length: document.querySelector("#metric-length"),
  a: document.querySelector("#metric-a"),
  t: document.querySelector("#metric-t"),
  g: document.querySelector("#metric-g"),
  c: document.querySelector("#metric-c"),
  n: document.querySelector("#metric-n"),
  ambiguous: document.querySelector("#metric-ambiguous"),
  gc: document.querySelector("#metric-gc"),
};

const state = {
  cleanedSequence: "",
  fastaText: "",
  taxonomyCandidates: [],
  taxonomySource: "none",
  selectedTaxId: "",
  lastRid: "",
  lastPayload: null,
  resultSource: "none",
  selectedResultIndex: 0,
  nextAllowedStatusAt: 0,
  blastReady: false,
  backendReady: false,
  backendHealthChecked: false,
  backendStatusMessage: "",
  lastLiveError: "",
  activeButtons: new Map(),
  timerId: 0,
  autoResultTimerId: 0,
};

const AUTO_RESULT_DELAY_AFTER_READY_SECONDS = 11;

function getBackendLogLabel() {
  if (!sequenceApiUrl) {
    return "not-configured";
  }

  try {
    const parsed = new URL(sequenceApiUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch (error) {
    return "invalid-url";
  }
}

function logSequenceEvent(eventName, details = {}) {
  console.info("[SequenceAnalysis]", {
    event: eventName,
    backend: getBackendLogLabel(),
    mode: state.backendReady ? "live" : "demo-only",
    ...details,
  });
}

function getBackendNotReadyMessage() {
  return "Backend not ready. Demo mode is available. Deploy the updated Apps Script backend to enable live NCBI search.";
}

function getUnsupportedActionMessage() {
  return "The Apps Script backend is not updated or the action name does not match. Redeploy the backend and verify sequenceAnalysisHealth.";
}

function explainBackendError(error) {
  const rawMessage = String(error && error.message ? error.message : error || "").trim();

  if (!rawMessage) {
    return {
      rawMessage: "",
      userMessage: getBackendNotReadyMessage(),
      taxonomyMessage: "Live taxonomy search failed. Demo mode is still available.",
      isRoutingIssue: false,
      shouldDisableLiveMode: true,
    };
  }

  if (rawMessage.includes("Unsupported action")) {
    return {
      rawMessage,
      userMessage: getUnsupportedActionMessage(),
      taxonomyMessage: "Live taxonomy search failed. Demo mode is still available.",
      isRoutingIssue: true,
      shouldDisableLiveMode: true,
    };
  }

  if (rawMessage.includes("backend URL is not configured")) {
    return {
      rawMessage,
      userMessage: getBackendNotReadyMessage(),
      taxonomyMessage: "Live taxonomy search failed. Demo mode is still available.",
      isRoutingIssue: false,
      shouldDisableLiveMode: true,
    };
  }

  if (rawMessage.includes("could not be reached")) {
    return {
      rawMessage,
      userMessage:
        "The Sequence Analysis backend could not be reached. Demo mode is still available while the live backend is unavailable.",
      taxonomyMessage: "Live taxonomy search failed. Demo mode is still available.",
      isRoutingIssue: false,
      shouldDisableLiveMode: true,
    };
  }

  return {
    rawMessage,
    userMessage: rawMessage,
    taxonomyMessage: "Live taxonomy search failed. Demo mode is still available.",
    isRoutingIssue: false,
    shouldDisableLiveMode: false,
  };
}

function setStatus(message, tone = "") {
  analysisStatus.textContent = message;
  analysisStatus.classList.remove("is-error", "is-success");
  if (tone) {
    analysisStatus.classList.add(tone === "error" ? "is-error" : "is-success");
  }
}

function setQualityMessage(message, tone = "") {
  qualityMessage.textContent = message;
  qualityMessage.classList.remove("is-error", "is-success");
  if (tone) {
    qualityMessage.classList.add(tone === "error" ? "is-error" : "is-success");
  }
}

function setQualityBadge(label, toneClass) {
  qualityBadge.textContent = label;
  qualityBadge.classList.remove("is-pending", "is-good", "is-review", "is-short");
  qualityBadge.classList.add(toneClass);
}

function setInlineBadge(element, label, tone = "") {
  element.textContent = label;
  element.classList.remove("is-success", "is-error", "is-review");
  if (tone) {
    element.classList.add(tone);
  }
}

function formatSequence(sequence) {
  return sequence.replace(/(.{60})/g, "$1\n").trim();
}

function loadJsonp(url, callbackName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Backend request timed out."));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("The Sequence Analysis backend could not be reached."));
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

async function requestSequenceApi(action, params = {}) {
  if (!sequenceApiUrl) {
    throw new Error(
      "Sequence Analysis backend URL is not configured. Demo mode remains available."
    );
  }

  logSequenceEvent("request:start", {
    action,
  });

  const callbackName = `wahjSequenceAnalysis_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const url = new URL(sequenceApiUrl);
  url.searchParams.set("action", action);
  url.searchParams.set("callback", callbackName);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const payload = await loadJsonp(url.toString(), callbackName);
  if (!payload || !payload.ok) {
    logSequenceEvent("request:error", {
      action,
      ok: false,
      error: payload?.error || "Unknown backend error",
    });
    throw new Error(payload?.error || "Sequence Analysis backend request failed.");
  }

  logSequenceEvent("request:success", {
    action,
    ok: true,
  });
  return payload;
}

function setButtonBusy(button, busy, busyLabel = "Working...") {
  if (!button) {
    return;
  }

  if (busy) {
    if (!state.activeButtons.has(button)) {
      state.activeButtons.set(button, button.textContent);
    }
    button.disabled = true;
    button.textContent = busyLabel;
    return;
  }

  const original = state.activeButtons.get(button);
  if (original) {
    button.textContent = original;
    state.activeButtons.delete(button);
  }
  updateBlastControls();
}

function buildFastaHeader() {
  const title = sequenceTitleInput.value.trim();
  const sampleNumber = sampleNumberInput.value.trim();
  const wahjSampleId = wahjSampleIdInput.value.trim();
  const organismName = organismNameInput.value.trim();
  const geneMarker = geneMarkerInput.value.trim();
  const parts = [];

  if (title) {
    parts.push(title);
  }
  if (sampleNumber) {
    parts.push(`Sample ${sampleNumber}`);
  }
  if (wahjSampleId) {
    parts.push(`Wahj ${wahjSampleId}`);
  }
  if (organismName) {
    parts.push(organismName);
  }
  if (geneMarker) {
    parts.push(geneMarker);
  }

  return `>${parts.join(" | ") || "Cleaned Sanger read"}`;
}

function sanitizeSequence(rawInput) {
  const payloadLines = String(rawInput || "")
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(">"));
  let cleaned = payloadLines.join("");
  cleaned = cleaned.replace(/[^A-Za-z]+/g, "");
  cleaned = cleaned.toUpperCase().replace(/U/g, "T");

  if (!cleaned) {
    return {
      ok: false,
      error:
        "The sequence is empty after removing FASTA headers, spaces, numbers, and line breaks.",
    };
  }

  const invalidCharacters = Array.from(
    new Set(cleaned.replace(/[ACGTRYSWKMBDHVN]/g, "").split(""))
  )
    .filter(Boolean)
    .join(", ");

  if (invalidCharacters) {
    return {
      ok: false,
      error: `Invalid sequence characters detected: ${invalidCharacters}. Allowed codes are A C G T U R Y S W K M B D H V N.`,
    };
  }

  if (!allowedSequencePattern.test(cleaned)) {
    return {
      ok: false,
      error: "The sequence contains unsupported characters.",
    };
  }

  return {
    ok: true,
    sequence: cleaned,
  };
}

function analyseSequence(sequence) {
  const counts = {
    A: 0,
    T: 0,
    G: 0,
    C: 0,
    N: 0,
    ambiguous: 0,
  };

  Array.from(sequence).forEach((base) => {
    if (base === "A") {
      counts.A += 1;
    } else if (base === "T") {
      counts.T += 1;
    } else if (base === "G") {
      counts.G += 1;
    } else if (base === "C") {
      counts.C += 1;
    } else if (base === "N") {
      counts.N += 1;
    } else if (allowedSequenceCharacters.has(base)) {
      counts.ambiguous += 1;
    }
  });

  const gc = sequence.length ? ((counts.G + counts.C) / sequence.length) * 100 : 0;
  const nFraction = sequence.length ? counts.N / sequence.length : 0;
  const ambiguityFraction = sequence.length ? counts.ambiguous / sequence.length : 0;

  let badge = {
    label: "Good for teaching BLAST",
    tone: "is-good",
    message:
      "The cleaned sequence has a reasonable length and a manageable ambiguity level for a teaching BLAST example.",
  };

  if (sequence.length < 50) {
    badge = {
      label: "Too short",
      tone: "is-short",
      message:
        "This sequence is below 50 bp. It is too short for a meaningful teaching BLAST comparison.",
    };
  } else if (sequence.length < 100 || nFraction > 0.04 || ambiguityFraction > 0.08) {
    badge = {
      label: "Review sequence quality",
      tone: "is-review",
      message:
        "The sequence is usable for teaching, but the short length or ambiguity level means the result should be interpreted cautiously.",
    };
  }

  return {
    length: sequence.length,
    counts,
    gc,
    badge,
  };
}

function updateQualityPanel(sequence) {
  if (!sequence) {
    metricElements.length.textContent = "0 bp";
    metricElements.a.textContent = "0";
    metricElements.t.textContent = "0";
    metricElements.g.textContent = "0";
    metricElements.c.textContent = "0";
    metricElements.n.textContent = "0";
    metricElements.ambiguous.textContent = "0";
    metricElements.gc.textContent = "0.0%";
    fastaPreview.textContent = ">";
    state.fastaText = ">";
    if (copyFastaButton) {
      copyFastaButton.disabled = true;
    }
    setQualityBadge("Awaiting sequence", "is-pending");
    setQualityMessage(
      "No cleaned sequence yet. The panel will update after you clean the input."
    );
    updateBlastControls();
    return null;
  }

  const summary = analyseSequence(sequence);
  metricElements.length.textContent = `${summary.length} bp`;
  metricElements.a.textContent = String(summary.counts.A);
  metricElements.t.textContent = String(summary.counts.T);
  metricElements.g.textContent = String(summary.counts.G);
  metricElements.c.textContent = String(summary.counts.C);
  metricElements.n.textContent = String(summary.counts.N);
  metricElements.ambiguous.textContent = String(summary.counts.ambiguous);
  metricElements.gc.textContent = `${summary.gc.toFixed(1)}%`;
  setQualityBadge(summary.badge.label, summary.badge.tone);
  setQualityMessage(summary.badge.message);

  const fastaText = `${buildFastaHeader()}\n${formatSequence(sequence)}`;
  fastaPreview.textContent = fastaText;
  state.fastaText = fastaText;
  if (copyFastaButton) {
    copyFastaButton.disabled = false;
  }
  updateBlastControls();
  return summary;
}

function cleanCurrentSequence(showSuccessMessage = true) {
  const result = sanitizeSequence(sequenceInput.value);
  if (!result.ok) {
    state.cleanedSequence = "";
    updateQualityPanel("");
    setQualityBadge("Needs correction", "is-short");
    setQualityMessage(result.error, "error");
    setStatus(result.error, "error");
    return null;
  }

  state.cleanedSequence = result.sequence;
  sequenceInput.value = formatSequence(result.sequence);
  updateQualityPanel(result.sequence);

  if (showSuccessMessage) {
    setStatus(
      "Sequence cleaned successfully. Review the quality panel, then use taxonomy search, demo mode, or live BLAST.",
      "success"
    );
  }

  return result.sequence;
}

function reverseComplement(sequence) {
  return Array.from(sequence)
    .reverse()
    .map((base) => complementMap[base] || base)
    .join("");
}

function getDefaultTaxonomyState() {
  if (state.backendReady) {
    return {
      message: "Search for an organism to load possible taxonomy matches from NCBI.",
      badge: "Awaiting search",
      tone: "",
    };
  }

  return {
    message: getBackendNotReadyMessage(),
    badge: "Backend not ready",
    tone: "is-error",
  };
}

function getDefaultBlastState() {
  if (state.backendReady) {
    return {
      message:
        "No live BLAST request has been submitted yet. Clean a sequence, run BLAST, and the page will automatically load the result when NCBI is ready.",
      badge: "Live backend ready",
      tone: "is-success",
    };
  }

  return {
    message: getBackendNotReadyMessage(),
    badge: "Backend not ready",
    tone: "is-error",
  };
}

function classifyInterpretation(result) {
  const identity = Number(result.percentIdentity || 0);
  const coverage = Number(result.queryCoverage || 0);

  if (identity >= 98 && coverage >= 95) {
    return {
      label: "Strong match",
      className: "is-strong",
      description:
        "The alignment is strong for teaching purposes, but even a strong hit should still be interpreted in the context of marker choice and sequence quality.",
    };
  }

  if (identity >= 95 && coverage >= 85) {
    return {
      label: "Probable match",
      className: "is-probable",
      description:
        "This looks like a close match. For conserved targets such as 16S rRNA, it often supports a probable match rather than absolute species certainty.",
    };
  }

  if (identity >= 90 && coverage >= 70) {
    return {
      label: "Moderate match",
      className: "is-moderate",
      description:
        "The hit is informative, but the sequence may represent a broader group, partial read, or a result that needs more supporting evidence.",
    };
  }

  if (identity >= 80) {
    return {
      label: "Needs review",
      className: "is-review",
      description:
        "The alignment needs careful review. Check read quality, trimming, orientation, and whether the chosen marker is appropriate for the question.",
    };
  }

  return {
    label: "Weak or uncertain match",
    className: "is-weak",
    description:
      "The match is weak or uncertain. Students should review the sequence, consider contamination or poor trimming, and avoid over-interpreting the result.",
  };
}

function parseExpectationValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return Number.POSITIVE_INFINITY;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function parseScoreValue(value) {
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function compareBlastResults(left, right) {
  if (Boolean(left.sameOrganism) !== Boolean(right.sameOrganism)) {
    return Number(Boolean(right.sameOrganism)) - Number(Boolean(left.sameOrganism));
  }

  const coverageDelta = Number(right.queryCoverage || 0) - Number(left.queryCoverage || 0);
  if (coverageDelta) {
    return coverageDelta;
  }

  const identityDelta = Number(right.percentIdentity || 0) - Number(left.percentIdentity || 0);
  if (identityDelta) {
    return identityDelta;
  }

  const eValueDelta = parseExpectationValue(left.eValue || left.expect) - parseExpectationValue(right.eValue || right.expect);
  if (eValueDelta) {
    return eValueDelta;
  }

  return parseScoreValue(right.score) - parseScoreValue(left.score);
}

function clearAutoResultTimer() {
  if (!state.autoResultTimerId) {
    return;
  }

  window.clearTimeout(state.autoResultTimerId);
  state.autoResultTimerId = 0;
}

function scheduleAutoResultLoad(seconds) {
  clearAutoResultTimer();

  if (!state.lastRid || !state.backendReady) {
    return;
  }

  const delaySeconds = Math.max(1, Number(seconds || 60));
  state.autoResultTimerId = window.setTimeout(() => {
    state.autoResultTimerId = 0;
    handleLoadBlastResult({ automatic: true }).catch((error) => {
      console.error("[SequenceAnalysis] auto-result-load failed", error);
    });
  }, delaySeconds * 1000);
}

function normalizePayload(payload) {
  if (!payload) {
    return {
      sampleNumber: sampleNumberInput.value.trim(),
      wahjSampleId: wahjSampleIdInput.value.trim(),
      organismName: organismNameInput.value.trim(),
      geneMarker: geneMarkerInput.value.trim(),
      results: [],
    };
  }

  const results = Array.isArray(payload.results) ? payload.results.slice() : [];
  const rankedResults = results.sort(compareBlastResults);

  return {
    sampleNumber: payload.sampleNumber || sampleNumberInput.value.trim(),
    wahjSampleId: payload.wahjSampleId || wahjSampleIdInput.value.trim(),
    sequenceTitle: payload.sequenceTitle || sequenceTitleInput.value.trim(),
    organismName: payload.organismName || organismNameInput.value.trim(),
    geneMarker: payload.geneMarker || geneMarkerInput.value.trim(),
    queryLength: payload.queryLength || state.cleanedSequence.length,
    queryTitle: payload.queryTitle || sequenceTitleInput.value.trim(),
    sourceType: payload.sourceType || "live",
    rid: payload.rid || state.lastRid,
    results: rankedResults,
  };
}

function renderResultTable(payload) {
  const normalized = normalizePayload(payload);
  if (!normalized.results.length) {
    resultsBody.innerHTML = `
      <tr>
        <td colspan="10" class="placeholder-row">
          No BLAST rows are available yet. Run BLAST and let the page load the live result, or use the demo result if you only want the teaching example.
        </td>
      </tr>
    `;
    return;
  }

  resultsBody.innerHTML = normalized.results
    .map((result, index) => {
      const interpretation = classifyInterpretation(result);
      const sameOrganismLabel = result.sameOrganism
        ? `<div class="taxonomy-meta">Matches selected organism context</div>`
        : "";
      return `
        <tr data-result-index="${index}">
          <td>${normalized.sampleNumber || "—"}</td>
          <td>${normalized.wahjSampleId || "—"}</td>
          <td>
            <a class="result-link" href="${result.genbankUrl}" target="_blank" rel="noreferrer">${result.accession || "—"}</a>
            <button class="result-compare-button ${index === state.selectedResultIndex ? "is-active" : ""}" type="button" data-result-index="${index}">
              Show alignment
            </button>
            ${index === 0 ? `<div class="taxonomy-meta result-priority-note">Best combined hit by organism context, query coverage, identity, and E-value</div>` : ""}
          </td>
          <td>${result.source || "—"}${sameOrganismLabel}</td>
          <td>${result.queryCoverage ? `${result.queryCoverage}%` : "—"}</td>
          <td>${result.percentIdentity ? `${result.percentIdentity}%` : "—"}</td>
          <td>${result.identities || "—"}</td>
          <td>${result.eValue || result.expect || "—"}</td>
          <td>${result.gaps || "—"}</td>
          <td>
            <span class="interpretation-tag ${interpretation.className}">${interpretation.label}</span>
            <p>${interpretation.description}</p>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderAlignmentCard(payload, index = 0) {
  const normalized = normalizePayload(payload);
  const isDemoResult = normalized.sourceType === "demo";
  const result = normalized.results[index];
  if (!result) {
    alignmentTitle.textContent = "BLAST-style alignment card";
    alignmentStatus.textContent = "Demo or live result will appear here";
    alignmentStatus.className = "alignment-status";
    alignmentMeta.innerHTML = `
      <article><span>Sequence ID</span><strong>Not loaded</strong></article>
      <article><span>Length</span><strong>—</strong></article>
      <article><span>Score</span><strong>—</strong></article>
      <article><span>Expect</span><strong>—</strong></article>
      <article><span>Identities</span><strong>—</strong></article>
      <article><span>Gaps</span><strong>—</strong></article>
    `;
    alignmentLinks.innerHTML = "";
    alignmentBlock.textContent =
      "Query/Sbjct alignment block will appear here after a demo or live BLAST result is loaded.";
    interpretationCallout.textContent =
      "Run BLAST to load a live NCBI result automatically, or use the demo result to inspect the teaching layout without submitting a sequence.";
    return;
  }

  const interpretation = classifyInterpretation(result);
  alignmentTitle.textContent = `SAMPLE ${normalized.sampleNumber || "—"} | ${result.source || result.title || "BLAST result"}`;
  alignmentStatus.textContent = isDemoResult
    ? "DEMO RESULT — not from NCBI"
    : interpretation.label;
  alignmentStatus.className = `alignment-status interpretation-tag ${
    isDemoResult ? "is-review" : interpretation.className
  }`;

  alignmentMeta.innerHTML = `
    <article>
      <span>Sequence ID</span>
      <strong>${result.accession || "—"}</strong>
    </article>
    <article>
      <span>Length</span>
      <strong>${result.sequenceLength ? `${result.sequenceLength} bp` : "—"}</strong>
    </article>
    <article>
      <span>Number of Matches</span>
      <strong>${result.numberOfMatches || "—"}</strong>
    </article>
    <article>
      <span>Range</span>
      <strong>${result.range || "—"}</strong>
    </article>
    <article>
      <span>Score</span>
      <strong>${result.score || "—"}</strong>
    </article>
    <article>
      <span>Expect</span>
      <strong>${result.expect || result.eValue || "—"}</strong>
    </article>
    <article>
      <span>Identities</span>
      <strong>${result.identities || "—"}</strong>
    </article>
    <article>
      <span>Gaps</span>
      <strong>${result.gaps || "—"}</strong>
    </article>
    <article>
      <span>Query coverage</span>
      <strong>${result.queryCoverage ? `${result.queryCoverage}%` : "—"}</strong>
    </article>
  `;

  const graphicsLink = result.graphicsUrl
    ? `<a href="${result.graphicsUrl}" target="_blank" rel="noreferrer">Graphics link</a>`
    : "";
  alignmentLinks.innerHTML = `
    <a href="${result.genbankUrl}" target="_blank" rel="noreferrer">GenBank link</a>
    ${graphicsLink}
  `;

  alignmentBlock.textContent = result.alignmentText || "Alignment text was not available for this hit.";
  interpretationCallout.textContent = isDemoResult
    ? "This demo result is built into the page for teaching the table, alignment layout, and interpretation language. It was not retrieved from a live NCBI request."
    : `${interpretation.description} In practice, review query coverage first, then percent identity, then E-value and score. A short perfect fragment is usually weaker evidence than a nearly perfect match with broad query coverage.`;
}

function renderPayload(payload) {
  state.lastPayload = normalizePayload(payload);
  state.resultSource = state.lastPayload.sourceType;
  renderResultTable(state.lastPayload);
  renderAlignmentCard(state.lastPayload, state.selectedResultIndex);
  resultsNote.textContent =
    state.lastPayload.sourceType === "demo"
      ? "DEMO RESULT — not from NCBI. This example is built into the page for teaching the summary table and alignment card layout."
      : "Live NCBI BLAST result loaded. Rows are ranked by organism context, query coverage, percent identity, and E-value. Use Show alignment to switch the detailed panel between hits.";
}

function clearResults() {
  state.lastPayload = null;
  state.resultSource = "none";
  state.selectedResultIndex = 0;
  resultsNote.textContent = "Run BLAST and the page will load the live result automatically when NCBI is ready. Demo mode is optional.";
  renderAlignmentCard(null, 0);
  renderResultTable(null);
}

function clearTaxonomyCandidates(message, badgeLabel = "Awaiting search", tone = "") {
  state.taxonomyCandidates = [];
  state.taxonomySource = "none";
  state.selectedTaxId = "";
  taxonomyCandidates.innerHTML = "";
  selectedTaxid.textContent = "—";
  setInlineBadge(taxonomyBadge, badgeLabel, tone);
  taxonomyStatus.textContent =
    message ||
    "Search for an organism to load possible taxonomy matches from NCBI.";
}

function renderTaxonomyCandidates(candidates, options = {}) {
  const source = options.source || "live";
  state.taxonomyCandidates = candidates;
  state.taxonomySource = source;
  state.selectedTaxId = candidates.length ? String(candidates[0].taxId || "") : "";
  selectedTaxid.textContent = state.selectedTaxId || "—";

  if (!candidates.length) {
    clearTaxonomyCandidates(
      source === "demo"
        ? "No demo taxonomy candidates are available."
        : "No taxonomy candidates were returned. You can still use demo mode or try a broader organism name.",
      "No candidates",
      "is-review"
    );
    return;
  }

  taxonomyCandidates.innerHTML = candidates
    .map((candidate, index) => {
      const lineage = candidate.lineage
        ? `<div class="taxonomy-lineage">${candidate.lineage}</div>`
        : "";
      return `
        <label class="taxonomy-option">
          <input type="radio" name="taxonomy-candidate" value="${candidate.taxId}" ${
            index === 0 ? "checked" : ""
          } />
          <span class="taxonomy-option-card">
            <strong>${candidate.scientificName}</strong>
            <span class="taxonomy-meta">TaxId ${candidate.taxId} | ${candidate.rank || "unranked"}${
              candidate.commonName ? ` | ${candidate.commonName}` : ""
            }</span>
            ${lineage}
          </span>
        </label>
      `;
    })
    .join("");

  if (source === "demo") {
    setInlineBadge(taxonomyBadge, "Demo candidate", "is-review");
    taxonomyStatus.textContent =
      "Demo candidate shown for teaching. Live taxonomy search was not used for this card.";
    return;
  }

  setInlineBadge(taxonomyBadge, `${candidates.length} candidate(s)`, "is-success");
  taxonomyStatus.textContent =
    "Select the best taxonomy candidate before running BLAST if you want organism-aware interpretation hints.";
}

function getSelectedTaxonomy() {
  const checked = document.querySelector('input[name="taxonomy-candidate"]:checked');
  if (!checked) {
    return null;
  }

  const taxId = checked.value;
  const candidate = state.taxonomyCandidates.find((item) => String(item.taxId) === taxId);
  state.selectedTaxId = taxId;
  selectedTaxid.textContent = taxId || "—";
  return candidate || null;
}

function setBlastState(message, badgeLabel, tone = "", nextSeconds = 0) {
  blastSessionStatus.textContent = message;
  setInlineBadge(blastBadge, badgeLabel, tone);
  if (nextSeconds > 0) {
    state.nextAllowedStatusAt = Date.now() + nextSeconds * 1000;
  }
  updateBlastControls();
}

function updateBlastControls() {
  const busy =
    state.activeButtons.has(findOrganismButton) ||
    state.activeButtons.has(runBlastButton) ||
    state.activeButtons.has(checkStatusButton) ||
    state.activeButtons.has(loadResultButton);
  const liveDisabled = !state.backendReady;
  const now = Date.now();
  const secondsRemaining = Math.max(
    0,
    Math.ceil((state.nextAllowedStatusAt - now) / 1000)
  );
  const canCheckStatus =
    state.backendReady && Boolean(state.lastRid) && secondsRemaining <= 0 && !busy;
  const canLoadResult =
    state.backendReady &&
    Boolean(state.lastRid) &&
      (state.blastReady || secondsRemaining <= 0) &&
      !busy;
  const canRunBlast = state.backendReady && Boolean(state.cleanedSequence) && !busy;

  if (!state.activeButtons.has(checkStatusButton)) {
    checkStatusButton.disabled = !canCheckStatus;
  }
  if (!state.activeButtons.has(loadResultButton)) {
    loadResultButton.disabled = !canLoadResult;
  }
  if (!state.activeButtons.has(runBlastButton)) {
    runBlastButton.disabled = !canRunBlast;
  }
  if (!state.activeButtons.has(findOrganismButton)) {
    findOrganismButton.disabled = busy || liveDisabled;
  }

  nextStatusCheck.textContent = state.lastRid
    ? secondsRemaining > 0
      ? `${secondsRemaining}s`
      : state.blastReady
        ? "Result can be loaded"
        : "Ready to check"
    : "Not scheduled";
}

function resetSequenceOutputsForDirtyInput() {
  if (!state.cleanedSequence && state.fastaText === ">") {
    return;
  }

  state.cleanedSequence = "";
  state.fastaText = ">";
  updateQualityPanel("");
}

function resetDisplayedAnalysisOutputs(reason = "") {
  const hadDisplayedOutput =
    state.resultSource !== "none" ||
    state.taxonomySource !== "none" ||
    Boolean(state.lastRid) ||
    Boolean(state.lastPayload);

  if (!hadDisplayedOutput) {
    return;
  }

  const taxonomyState = getDefaultTaxonomyState();
  const blastState = getDefaultBlastState();

  state.taxonomyCandidates = [];
  state.selectedTaxId = "";
  state.lastRid = "";
  state.lastPayload = null;
  state.selectedResultIndex = 0;
  state.nextAllowedStatusAt = 0;
  state.blastReady = false;
  clearAutoResultTimer();
  clearTaxonomyCandidates(taxonomyState.message, taxonomyState.badge, taxonomyState.tone);
  blastRid.textContent = "—";
  selectedTaxid.textContent = "—";
  clearResults();
  setBlastState(blastState.message, blastState.badge, blastState.tone, 0);

  if (reason) {
    setStatus(reason);
  }
}

function ensureTimer() {
  if (state.timerId) {
    return;
  }

  state.timerId = window.setInterval(() => {
    updateBlastControls();
  }, 1000);
}

function setBackendMode(isReady, message, urlStateLabel) {
  state.backendReady = isReady;
  state.backendHealthChecked = true;
  state.backendStatusMessage = message;
  backendUrlState.textContent = urlStateLabel;

  if (isReady) {
    setBlastState(
      "Sequence Analysis backend is available. Live taxonomy search and BLAST actions are enabled.",
      "Live backend ready",
      "is-success",
      0
    );
    return;
  }

  state.blastReady = false;
  state.lastRid = "";
  state.nextAllowedStatusAt = 0;
  blastRid.textContent = "—";
  nextStatusCheck.textContent = "Not scheduled";
  setBlastState(message, "Backend not ready", "is-error", 0);
}

function ensureLiveBackendReady() {
  if (!sequenceApiUrl) {
    backendUrlState.textContent = "Not configured";
    throw new Error(getBackendNotReadyMessage());
  }

  if (!state.backendReady) {
    throw new Error(state.backendStatusMessage || getBackendNotReadyMessage());
  }
}

async function runBackendHealthCheck() {
  if (!sequenceApiUrl) {
    logSequenceEvent("health:missing-url");
    clearTaxonomyCandidates(getBackendNotReadyMessage(), "Backend not ready", "is-error");
    setBackendMode(false, getBackendNotReadyMessage(), "Not configured");
    setStatus(getBackendNotReadyMessage(), "error");
    return;
  }

  backendUrlState.textContent = "Checking";

  try {
    const payload = await requestSequenceApi("sequenceAnalysisHealth");
    const supportedActions = Array.isArray(payload.supportedActions)
      ? payload.supportedActions
      : [];
    const missingActions = requiredSequenceActions.filter(
      (actionName) => !supportedActions.includes(actionName)
    );

    if (!payload.ok || payload.feature !== "sequence-analysis" || missingActions.length) {
      throw new Error(getUnsupportedActionMessage());
    }

    clearTaxonomyCandidates();
    setBackendMode(true, payload.message || "Sequence Analysis backend is available.", "Ready");
    setStatus(payload.message || "Sequence Analysis backend is available.", "success");
    logSequenceEvent("health:ready", {
      supportedActions: supportedActions.join(","),
    });
  } catch (error) {
    const details = explainBackendError(error);
    clearTaxonomyCandidates(getBackendNotReadyMessage(), "Backend not ready", "is-error");
    setBackendMode(
      false,
      details.userMessage === getUnsupportedActionMessage()
        ? getBackendNotReadyMessage()
        : details.userMessage,
      details.isRoutingIssue ? "Old deployment" : "Unavailable"
    );
    setStatus(details.userMessage, "error");
    state.lastLiveError = details.rawMessage;
    logSequenceEvent("health:error", {
      error: details.rawMessage || details.userMessage,
    });
  }
}

async function handleFindOrganism() {
  const organismName = organismNameInput.value.trim();
  if (!organismName) {
    setStatus("Enter an organism name before searching NCBI Taxonomy.", "error");
    organismNameInput.focus();
    return;
  }

  try {
    ensureLiveBackendReady();
    setButtonBusy(findOrganismButton, true, "Searching organism...");
    setInlineBadge(taxonomyBadge, "Searching", "is-review");
    taxonomyStatus.textContent = "Searching NCBI Taxonomy for matching organism records...";
    const payload = await requestSequenceApi("taxonomySearch", { organismName });
    renderTaxonomyCandidates(payload.candidates || [], { source: "live" });
    setStatus(
      payload.candidates && payload.candidates.length
        ? "Taxonomy candidates loaded. Select the best match before BLAST if you want organism-aware interpretation."
        : "Taxonomy search completed, but no candidates were returned.",
      payload.candidates && payload.candidates.length ? "success" : ""
    );
  } catch (error) {
    const details = explainBackendError(error);
    clearTaxonomyCandidates(details.taxonomyMessage, "Search failed", "is-error");
    setStatus(details.userMessage, "error");
    if (details.shouldDisableLiveMode) {
      setBackendMode(false, getBackendNotReadyMessage(), details.isRoutingIssue ? "Old deployment" : "Unavailable");
    }
  } finally {
    setButtonBusy(findOrganismButton, false);
  }
}

async function handleRunBlast() {
  const sequence = cleanCurrentSequence(false);
  if (!sequence) {
    return;
  }

  try {
    ensureLiveBackendReady();
    const taxonomyCandidate = getSelectedTaxonomy();
    setButtonBusy(runBlastButton, true, "Submitting BLAST...");
    state.blastReady = false;
    const payload = await requestSequenceApi("blastSubmit", {
      sequence,
      sampleNumber: sampleNumberInput.value.trim(),
      wahjSampleId: wahjSampleIdInput.value.trim(),
      sequenceTitle: sequenceTitleInput.value.trim(),
      organismName: organismNameInput.value.trim(),
      taxId: taxonomyCandidate?.taxId || state.selectedTaxId || "",
      geneMarker: geneMarkerInput.value.trim(),
      database: "core_nt",
      hitlistSize: 10,
    });

    state.lastRid = payload.rid || "";
    blastRid.textContent = state.lastRid || "—";
    selectedTaxid.textContent = taxonomyCandidate?.taxId || state.selectedTaxId || "—";
    setBlastState(
      payload.message || "BLAST submitted. Wait before checking status.",
      "Waiting for BLAST",
      "is-review",
      Number(payload.nextAllowedPollSeconds || 60)
    );
    scheduleAutoResultLoad(Number(payload.nextAllowedPollSeconds || 60));
    setStatus(
      `BLAST submitted with RID ${payload.rid}. The page will automatically load the result after the required NCBI waiting period.`,
      "success"
    );
  } catch (error) {
    const details = explainBackendError(error);
    setBlastState(details.userMessage, "Submission failed", "is-error", 0);
    setStatus(details.userMessage, "error");
    if (details.shouldDisableLiveMode) {
      setBackendMode(false, getBackendNotReadyMessage(), details.isRoutingIssue ? "Old deployment" : "Unavailable");
    }
  } finally {
    setButtonBusy(runBlastButton, false);
  }
}

async function handleCheckBlastStatus(options = {}) {
  const automatic = Boolean(options.automatic);
  if (!state.lastRid) {
    setStatus("Submit a BLAST request first so there is a RID to check.", "error");
    return;
  }

  try {
    ensureLiveBackendReady();
    setButtonBusy(checkStatusButton, true, "Checking status...");
    const payload = await requestSequenceApi("blastStatus", { rid: state.lastRid });
    if (payload.status === "READY") {
      state.blastReady = true;
      setBlastState(
        payload.message || "BLAST results are ready.",
        "Result ready",
        "is-success",
        0
      );
      scheduleAutoResultLoad(AUTO_RESULT_DELAY_AFTER_READY_SECONDS);
      setStatus(
        automatic
          ? "BLAST status is READY. The page will load the parsed result automatically after a short NCBI-safe delay."
          : "BLAST status is READY. The page will load the parsed result automatically after a short NCBI-safe delay.",
        "success"
      );
      return;
    }

    if (payload.status === "FAILED" || payload.status === "UNKNOWN") {
      state.blastReady = false;
      setBlastState(
        payload.message || "The BLAST RID needs review before loading results.",
        payload.status,
        "is-error",
        Number(payload.nextAllowedPollSeconds || 60)
      );
      setStatus(payload.message || "BLAST status needs review.", "error");
      return;
    }

    state.blastReady = false;
    setBlastState(
      payload.message || "BLAST is still processing.",
      "Waiting for BLAST",
      "is-review",
      Number(payload.nextAllowedPollSeconds || 60)
    );
    scheduleAutoResultLoad(Number(payload.nextAllowedPollSeconds || 60));
    setStatus(
      automatic
        ? `${payload.message || "BLAST is still processing."} The page will check again automatically.`
        : `${payload.message || "BLAST is still processing."} The page will check again automatically.`,
      ""
    );
  } catch (error) {
    const details = explainBackendError(error);
    setBlastState(details.userMessage, "Status failed", "is-error", 0);
    setStatus(details.userMessage, "error");
    if (details.shouldDisableLiveMode) {
      setBackendMode(false, getBackendNotReadyMessage(), details.isRoutingIssue ? "Old deployment" : "Unavailable");
    }
  } finally {
    setButtonBusy(checkStatusButton, false);
  }
}

async function handleLoadBlastResult(options = {}) {
  const automatic = Boolean(options.automatic);
  if (!state.lastRid) {
    setStatus("Submit a BLAST request first so there is a RID to load.", "error");
    return;
  }

  try {
    ensureLiveBackendReady();
    const taxonomyCandidate = getSelectedTaxonomy();
    setButtonBusy(loadResultButton, true, "Loading result...");
    const payload = await requestSequenceApi("blastResult", {
      rid: state.lastRid,
      selectedTaxId: taxonomyCandidate?.taxId || state.selectedTaxId || "",
      selectedOrganismName: organismNameInput.value.trim(),
    });

    if (payload.status && payload.status !== "READY") {
      state.blastReady = payload.status === "READY";
      setBlastState(
        payload.message || "BLAST results are not ready yet.",
        payload.status === "WAITING" ? "Waiting for BLAST" : payload.status,
        payload.status === "WAITING" ? "is-review" : "is-error",
        Number(payload.nextAllowedPollSeconds || 60)
      );
      if (payload.status === "WAITING") {
        scheduleAutoResultLoad(Number(payload.nextAllowedPollSeconds || 60));
      }
      setStatus(
        automatic && payload.status === "WAITING"
          ? `${payload.message || "BLAST results are not ready yet."} The page will try again automatically.`
          : payload.message || "BLAST results are not ready yet.",
        ""
      );
      return;
    }

    state.blastReady = true;
    clearAutoResultTimer();
    state.selectedResultIndex = 0;
    renderPayload(payload);
    setBlastState(
      payload.cached ? "Cached result loaded." : "BLAST result loaded.",
      payload.cached ? "Cached result" : "Result ready",
      "is-success",
      0
    );
    setStatus(
      payload.cached
        ? "A cached BLAST result was loaded for this RID."
        : "BLAST result loaded and rendered in the table and alignment card.",
      "success"
    );
  } catch (error) {
    const details = explainBackendError(error);
    setBlastState(details.userMessage, "Load failed", "is-error", 0);
    setStatus(details.userMessage, "error");
    if (details.shouldDisableLiveMode) {
      setBackendMode(false, getBackendNotReadyMessage(), details.isRoutingIssue ? "Old deployment" : "Unavailable");
    }
  } finally {
    setButtonBusy(loadResultButton, false);
  }
}

cleanButton?.addEventListener("click", () => {
  cleanCurrentSequence();
});

reverseComplementButton?.addEventListener("click", () => {
  const sequence = cleanCurrentSequence(false);
  if (!sequence) {
    return;
  }

  const reversed = reverseComplement(sequence);
  state.cleanedSequence = reversed;
  sequenceInput.value = formatSequence(reversed);
  updateQualityPanel(reversed);
  setStatus(
    "Reverse complement generated from the cleaned sequence. Review the updated FASTA preview.",
    "success"
  );
});

copyFastaButton?.addEventListener("click", async () => {
  if (!state.fastaText || state.fastaText === ">") {
    setStatus("Clean a sequence first so there is a FASTA preview to copy.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(state.fastaText);
    setStatus("FASTA preview copied to the clipboard.", "success");
  } catch (error) {
    setStatus("Clipboard access failed. You can still copy the FASTA preview manually.", "error");
  }
});

findOrganismButton?.addEventListener("click", () => {
  handleFindOrganism();
});

runBlastButton?.addEventListener("click", () => {
  handleRunBlast();
});

checkStatusButton?.addEventListener("click", () => {
  handleCheckBlastStatus();
});

loadResultButton?.addEventListener("click", () => {
  handleLoadBlastResult();
});

demoButton?.addEventListener("click", () => {
  if (!demoEnabled) {
    setStatus("Demo mode is disabled in the site configuration.", "error");
    return;
  }

  state.lastRid = demoResult.rid;
  state.blastReady = true;
  blastRid.textContent = demoResult.rid;
  selectedTaxid.textContent = demoResult.results[0].taxId;
  state.selectedResultIndex = 0;
  renderTaxonomyCandidates([
    {
      taxId: demoResult.results[0].taxId,
      scientificName: demoResult.organismName,
      rank: "species",
      commonName: "",
      lineage: "Bacteria; Bacillota; Bacilli; Bacillales; Bacillaceae; Bacillus",
    },
  ], { source: "demo" });
  renderPayload({
    ...demoResult,
    sourceType: "demo",
  });
  const demoMessage = state.backendReady
    ? "Demo result loaded. Live backend controls are also available."
    : "Demo result loaded. Live backend is not ready, so only demo mode is available right now.";
  setBlastState(demoMessage, "DEMO RESULT — not from NCBI", "is-review", 0);
  setStatus("Demo result loaded successfully. Your current input was not submitted to NCBI.", "success");
});

clearFormButton?.addEventListener("click", () => {
  window.setTimeout(() => {
    state.cleanedSequence = "";
    state.fastaText = "";
    state.taxonomyCandidates = [];
    state.taxonomySource = "none";
    state.selectedTaxId = "";
    state.lastRid = "";
    state.lastPayload = null;
    state.resultSource = "none";
    state.selectedResultIndex = 0;
    state.nextAllowedStatusAt = 0;
    state.blastReady = false;
    clearAutoResultTimer();
    updateQualityPanel("");
    const taxonomyState = getDefaultTaxonomyState();
    const blastState = getDefaultBlastState();
    clearTaxonomyCandidates(taxonomyState.message, taxonomyState.badge, taxonomyState.tone);
    blastRid.textContent = "—";
    selectedTaxid.textContent = "—";
    setBlastState(blastState.message, blastState.badge, blastState.tone, 0);
    clearResults();
    setStatus("The form was cleared. Enter a new sequence or load the demo result.");
  }, 0);
});

resultsBody?.addEventListener("click", (event) => {
  const button = event.target.closest(".result-compare-button");
  if (!button || !state.lastPayload) {
    return;
  }

  const index = Number(button.dataset.resultIndex || 0);
  state.selectedResultIndex = index;
  renderPayload(state.lastPayload);
  setStatus(`Alignment card updated to show hit ${index + 1}.`);
});

taxonomyCandidates?.addEventListener("change", (event) => {
  const input = event.target.closest('input[name="taxonomy-candidate"]');
  if (!input) {
    return;
  }

  state.selectedTaxId = input.value;
  selectedTaxid.textContent = state.selectedTaxId || "—";
  setStatus(`Taxonomy candidate ${state.selectedTaxId} selected.`);
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
});

sequenceInput?.addEventListener("input", () => {
  resetSequenceOutputsForDirtyInput();
  resetDisplayedAnalysisOutputs(
    "Raw sequence changed. Clean the sequence again before running taxonomy search or BLAST."
  );
});

[sampleNumberInput, wahjSampleIdInput, sequenceTitleInput, organismNameInput, geneMarkerInput]
  .filter(Boolean)
  .forEach((input) => {
    input.addEventListener("input", () => {
      if (state.cleanedSequence) {
        updateQualityPanel(state.cleanedSequence);
      }
      resetDisplayedAnalysisOutputs(
        "Previous demo or live results were cleared because the form details changed."
      );
    });
  });

updateQualityPanel("");
clearResults();
ensureTimer();
updateBlastControls();
runBackendHealthCheck();
