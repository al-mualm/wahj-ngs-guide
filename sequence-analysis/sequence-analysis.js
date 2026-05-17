const sequenceConfig = window.WAHJ_NGS_CONFIG || {};
const demoEnabled = sequenceConfig.sequenceAnalysisDemoEnabled !== false;
const sequenceApiUrl = (sequenceConfig.sequenceAnalysisApiUrl || "").trim();

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
  sampleNumber: "5",
  wahjSampleId: "S5",
  sequenceTitle: "Bacterial isolate 5 forward read",
  organismName: "Bacillus pumilus",
  geneMarker: "16S rRNA",
  accession: "KF475848.1",
  source: "Bacillus pumilus strain IHB B 2692 16S ribosomal RNA gene, partial sequence",
  sequenceLength: 417,
  matchCount: 402,
  range: "28 to 442",
  score: "706 bits (382)",
  expect: "0.0",
  identities: "402/417 (96%)",
  gaps: "2/417 (0%)",
  percentIdentity: 96,
  queryCoverage: 95,
  eValue: "0.0",
  genbankUrl: "https://www.ncbi.nlm.nih.gov/nuccore/KF475848.1",
  graphicsUrl:
    "https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Web&PAGE_TYPE=BlastSearch&ALIGNMENT_VIEW=Pairwise",
  interpretation:
    "Probable match to a Bacillus pumilus-group 16S sequence. High identity supports a close relationship, but 16S alone should not be used as definitive species proof.",
  alignmentRows: [
    {
      queryStart: 28,
      query: "AGAGTTTGATCCTGGCTCAGGATGAACGCTGGCGGCGTGCCTAATACATGCAAGT",
      subjectStart: 26,
      subject: "AGAGTTTGATCCTGGCTCAGGATGAACGCTGGCGGCGTGCCTAATACATGCAAGT",
    },
    {
      queryStart: 88,
      query: "CGAGCGAAAGCGTGGGGAGCAAACAGGATTAGATACCCTGGTAGTCCACGCCGTA",
      subjectStart: 86,
      subject: "CGAGCGAAAGCGTGGGGAGCAAACAGGATTAGATACCCTGGTAGTCCACGCCGTA",
    },
    {
      queryStart: 148,
      query: "AACGATGAGTGCTAAGTGTTAGAGGGTTTCCGCCCTTTAGTGCTGAAGTTAACGC",
      subjectStart: 146,
      subject: "AACGATGAGTGCTAAGTGTTAGAGGGTTTCCGCCCTTCAGTGCTGAAGTTAACGC",
    },
    {
      queryStart: 208,
      query: "GTAACGTTGAGGTGCGGCTGGATCACCTCCTTTCTAAGGTTGGGCACTTAATGAT",
      subjectStart: 206,
      subject: "GTAACGTTGAGGTGCGGCTGGATCACCTCCTTTCTAAGGTTGGGCACTTAATGAT",
    },
    {
      queryStart: 268,
      query: "GGTAGTCCACGCCGTAAACGATGTCGACTTGGAGGTTGTGCCCTTGAGGCGTGGA",
      subjectStart: 266,
      subject: "GGTAGTCCACGCCGTAAACGATGTCGACTTGGAGGTTGTGCCCTTGAGGCGTGGA",
    },
    {
      queryStart: 328,
      query: "CTTAATACCGCATACGCCCTACGGGGGAAAGATTTATCGGAGATGGATGCCCGCG",
      subjectStart: 326,
      subject: "CTTAATACCGCATACGCCCTACGGGGGAAAGATTTATCGGAGATGGATGCCCGCG",
    },
    {
      queryStart: 388,
      query: "TGTGTACAAGGCCCGGGAACGTATTCACCGCGGCATGCTGATCCGCGATTACTAG",
      subjectStart: 386,
      subject: "TGTGTACAAGGCCCGGGAACGTATTCACCGCGGCATGCTGATCCGCGATTACTAG",
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
const analysisStatus = document.querySelector("#analysis-status");
const qualityBadge = document.querySelector("#quality-badge");
const qualityMessage = document.querySelector("#quality-message");
const fastaPreview = document.querySelector("#fasta-preview");
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
  fastaPreview: "",
  lastResult: null,
};

function setStatus(message, tone = "") {
  if (!analysisStatus) {
    return;
  }

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

function formatSequence(sequence) {
  return sequence.replace(/(.{60})/g, "$1\n").trim();
}

function buildFastaHeader() {
  const title = sequenceTitleInput.value.trim();
  const sampleNumber = sampleNumberInput.value.trim();
  const wahjSampleId = wahjSampleIdInput.value.trim();
  const organismName = organismNameInput.value.trim();
  const geneMarker = geneMarkerInput.value.trim();
  const headerParts = [];

  if (title) {
    headerParts.push(title);
  }
  if (sampleNumber) {
    headerParts.push(`Sample ${sampleNumber}`);
  }
  if (wahjSampleId) {
    headerParts.push(`Wahj ${wahjSampleId}`);
  }
  if (organismName) {
    headerParts.push(organismName);
  }
  if (geneMarker) {
    headerParts.push(geneMarker);
  }

  return `>${headerParts.join(" | ") || "Cleaned Sanger read"}`;
}

function sanitizeSequence(rawInput) {
  const rawLines = String(rawInput || "").split(/\r?\n/);
  const payloadLines = rawLines.filter((line) => !line.trim().startsWith(">"));
  let cleaned = payloadLines.join("");
  cleaned = cleaned.replace(/[\s0-9]+/g, "");
  cleaned = cleaned.toUpperCase().replace(/U/g, "T");

  if (!cleaned) {
    return {
      ok: false,
      error: "The sequence is empty after removing FASTA headers and formatting characters.",
    };
  }

  const invalidCharacters = Array.from(new Set(cleaned.replace(/[ACGTRYSWKMBDHVN]/g, "").split("")))
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
    setQualityBadge("Awaiting sequence", "is-pending");
    setQualityMessage(
      "No cleaned sequence yet. The panel will update after you clean the input."
    );
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
  state.fastaPreview = fastaText;
  return summary;
}

function cleanCurrentSequence(showSuccessMessage = true) {
  const organismName = organismNameInput.value.trim();
  if (!organismName) {
    setStatus(
      "Enter the organism name before cleaning the sequence so the FASTA preview and teaching context stay informative.",
      "error"
    );
    organismNameInput.focus();
    return null;
  }

  const result = sanitizeSequence(sequenceInput.value);
  if (!result.ok) {
    setStatus(result.error, "error");
    setQualityBadge("Needs correction", "is-short");
    setQualityMessage(result.error, "error");
    return null;
  }

  state.cleanedSequence = result.sequence;
  sequenceInput.value = formatSequence(result.sequence);
  updateQualityPanel(result.sequence);

  if (showSuccessMessage) {
    setStatus(
      "Sequence cleaned successfully. Review the quality panel, then inspect the demo or live result workflow.",
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

function formatAlignmentRows(rows) {
  return rows
    .map((row) => {
      const queryEnd = row.queryStart + row.query.replace(/-/g, "").length - 1;
      const subjectEnd = row.subjectStart + row.subject.replace(/-/g, "").length - 1;
      const matchLine = Array.from(row.query)
        .map((base, index) => {
          const subjectBase = row.subject[index];
          return base === subjectBase && base !== "-" ? "|" : " ";
        })
        .join("");

      return [
        `Query ${String(row.queryStart).padStart(5, " ")}  ${row.query}  ${String(queryEnd).padStart(5, " ")}`,
        `             ${matchLine}`,
        `Sbjct ${String(row.subjectStart).padStart(5, " ")}  ${row.subject}  ${String(subjectEnd).padStart(5, " ")}`,
      ].join("\n");
    })
    .join("\n\n");
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

function renderResults(result) {
  state.lastResult = result;
  const interpretation = classifyInterpretation(result);

  resultsNote.textContent =
    "The table below uses the same interpretation language that the alignment card uses.";

  resultsBody.innerHTML = `
    <tr>
      <td>${result.sampleNumber || "—"}</td>
      <td>${result.wahjSampleId || "—"}</td>
      <td>
        <a class="result-link" href="${result.genbankUrl}" target="_blank" rel="noreferrer">${result.accession}</a>
      </td>
      <td>${result.source}</td>
      <td>${result.identities}</td>
      <td>${result.eValue}</td>
      <td>${result.gaps}</td>
      <td>
        <span class="interpretation-tag ${interpretation.className}">${interpretation.label}</span>
        <p>${result.interpretation}</p>
      </td>
    </tr>
  `;

  alignmentTitle.textContent = `SAMPLE ${result.sampleNumber || "—"} | ${result.source}`;
  alignmentStatus.textContent = interpretation.label;
  alignmentStatus.className = `alignment-status interpretation-tag ${interpretation.className}`;

  alignmentMeta.innerHTML = `
    <article>
      <span>Sequence ID</span>
      <strong>${result.accession}</strong>
    </article>
    <article>
      <span>Length</span>
      <strong>${result.sequenceLength} bp</strong>
    </article>
    <article>
      <span>Number of Matches</span>
      <strong>${result.matchCount}</strong>
    </article>
    <article>
      <span>Range</span>
      <strong>${result.range}</strong>
    </article>
    <article>
      <span>Score</span>
      <strong>${result.score}</strong>
    </article>
    <article>
      <span>Expect</span>
      <strong>${result.expect}</strong>
    </article>
    <article>
      <span>Identities</span>
      <strong>${result.identities}</strong>
    </article>
    <article>
      <span>Gaps</span>
      <strong>${result.gaps}</strong>
    </article>
    <article>
      <span>Coverage</span>
      <strong>${result.queryCoverage}%</strong>
    </article>
  `;

  alignmentLinks.innerHTML = `
    <a href="${result.genbankUrl}" target="_blank" rel="noreferrer">GenBank link</a>
    <a href="${result.graphicsUrl}" target="_blank" rel="noreferrer">Graphics link</a>
  `;

  alignmentBlock.textContent = formatAlignmentRows(result.alignmentRows);
  interpretationCallout.textContent = interpretation.description;
}

function populateDemoSequence() {
  sampleNumberInput.value = demoResult.sampleNumber;
  wahjSampleIdInput.value = demoResult.wahjSampleId;
  sequenceTitleInput.value = demoResult.sequenceTitle;
  organismNameInput.value = demoResult.organismName;
  geneMarkerInput.value = demoResult.geneMarker;
  sequenceInput.value = formatSequence(
    demoResult.alignmentRows.map((row) => row.query).join("").slice(0, 420)
  );
}

function clearResults() {
  state.lastResult = null;
  resultsNote.textContent = "Load the demo result to see a complete educational example.";
  resultsBody.innerHTML = `
    <tr>
      <td colspan="8" class="placeholder-row">
        No result loaded yet. Use <strong>Load demo result</strong> to render the example
        table and alignment card.
      </td>
    </tr>
  `;
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
    "Load the demo result to see how the tool translates alignment metrics into a careful educational interpretation.";
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
  if (!state.fastaPreview || state.fastaPreview === ">") {
    setStatus("Clean a sequence first so there is a FASTA preview to copy.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(state.fastaPreview);
    setStatus("FASTA preview copied to the clipboard.", "success");
  } catch (error) {
    setStatus("Clipboard access failed. You can still copy the FASTA preview manually.", "error");
  }
});

demoButton?.addEventListener("click", () => {
  if (!demoEnabled) {
    setStatus("Demo mode is disabled in the site configuration.", "error");
    return;
  }

  populateDemoSequence();
  cleanCurrentSequence(false);
  renderResults(demoResult);
  setStatus(
    sequenceApiUrl
      ? "Demo result loaded. The frontend is ready for the later backend integration stage."
      : "Demo result loaded. Live backend integration has not been configured on this page yet.",
    "success"
  );
});

clearFormButton?.addEventListener("click", () => {
  window.setTimeout(() => {
    state.cleanedSequence = "";
    state.fastaPreview = "";
    updateQualityPanel("");
    clearResults();
    setStatus("The form was cleared. Enter a new sequence or load the demo result.");
  }, 0);
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
});

updateQualityPanel("");
clearResults();
