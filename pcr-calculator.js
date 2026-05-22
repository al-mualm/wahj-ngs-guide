(function (windowObject) {
  const tool = document.querySelector("#pcr-expression-tool");
  const core = windowObject.WahjPcrCalculatorCore;
  if (!tool || !core) {
    return;
  }

  const plateGrid = tool.querySelector("#plate-grid");
  const plateSummary = tool.querySelector("#plate-summary");
  const assignmentButtons = Array.from(tool.querySelectorAll("[data-assignment-key]"));
  const exampleLayoutButton = tool.querySelector("#plate-example-layout");
  const clearPlateButton = tool.querySelector("#plate-clear-all");
  const fileInput = tool.querySelector("#ct-file");
  const tableTextarea = tool.querySelector("#ct-table-text");
  const loadExampleDataButton = tool.querySelector("#load-example-data");
  const calculateButton = tool.querySelector("#calculate-expression");
  const uploadStatus = tool.querySelector("#ct-upload-status");
  const resultsSection = tool.querySelector("#calculator-results");
  const resultsContainer = tool.querySelector("#calculator-output");
  const controlLabelInput = tool.querySelector("#control-label");
  const treatedLabelInput = tool.querySelector("#treated-label");
  const referenceGeneLabelInput = tool.querySelector("#reference-gene-label");
  const targetGeneLabelInput = tool.querySelector("#target-gene-label");
  const analysisModeInputs = Array.from(
    tool.querySelectorAll('input[name="analysis-mode"]')
  );
  const sampleMetadataBody = tool.querySelector("#sample-metadata-body");
  const sampleMetadataHint = tool.querySelector("#sample-metadata-hint");

  const rowLetters = "ABCDEFGH".split("");
  const colNumbers = Array.from({ length: 12 }, (_, index) => String(index + 1));

  const assignmentMeta = {
    "control-reference": {
      short: "C/Ref",
      sampleKey: "control",
      assayKey: "reference",
      color: "#5fa7dc",
    },
    "control-target": {
      short: "C/Tgt",
      sampleKey: "control",
      assayKey: "target",
      color: "#0f70c1",
    },
    "treated-reference": {
      short: "S/Ref",
      sampleKey: "treated",
      assayKey: "reference",
      color: "#d6b671",
    },
    "treated-target": {
      short: "S/Tgt",
      sampleKey: "treated",
      assayKey: "target",
      color: "#d64033",
    },
  };

  const exampleAssignments = {
    A1: "control-reference",
    A2: "control-reference",
    A3: "control-reference",
    A4: "control-target",
    A5: "control-target",
    A6: "control-target",
    B1: "treated-reference",
    B2: "treated-reference",
    B3: "treated-reference",
    B4: "treated-target",
    B5: "treated-target",
    B6: "treated-target",
  };

  const exampleCtTable = [
    "Well,Ct",
    "A1,18.10",
    "A2,18.22",
    "A3,18.05",
    "A4,23.80",
    "A5,23.91",
    "A6,23.76",
    "B1,18.09",
    "B2,18.31",
    "B3,18.15",
    "B4,21.45",
    "B5,21.61",
    "B6,21.52",
  ].join("\n");

  const state = {
    activeAssignmentKey: "control-reference",
    assignments: {},
    sampleMetadataByWell: {},
    loadedText: "",
    sourceLabel: "",
    lastWarnings: [],
    analysisMode: "group-control-mean",
  };

  function labels() {
    return {
      control: controlLabelInput.value.trim() || "Control",
      treated: treatedLabelInput.value.trim() || "Treated",
      reference: referenceGeneLabelInput.value.trim() || "Reference gene",
      target: targetGeneLabelInput.value.trim() || "Target gene",
    };
  }

  function getAnalysisMode() {
    return (
      analysisModeInputs.find((input) => input.checked)?.value ||
      state.analysisMode ||
      "group-control-mean"
    );
  }

  function formatNumber(value, decimals = 3) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }

    return Number(value).toFixed(decimals);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeHeader(value) {
    return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function normalizeWell(value) {
    const cleaned = String(value).trim().toUpperCase().replace(/\s+/g, "");
    const match = cleaned.match(/^([A-H])0?([1-9]|1[0-2])$/);
    if (!match) {
      return null;
    }

    return `${match[1]}${Number(match[2])}`;
  }

  function wellSortValue(well) {
    const letter = well.charCodeAt(0) - 65;
    const number = Number(well.slice(1));
    return letter * 100 + number;
  }

  function sortWells(a, b) {
    return wellSortValue(a.well || a) - wellSortValue(b.well || b);
  }

  function buildDefaultSampleMetadata() {
    const defaults = {};
    const groupWells = {
      control: { reference: [], target: [] },
      treated: { reference: [], target: [] },
    };

    Object.entries(state.assignments)
      .filter(([, assignmentKey]) => Boolean(assignmentKey))
      .forEach(([well, assignmentKey]) => {
        const meta = assignmentMeta[assignmentKey];
        if (!meta) {
          return;
        }
        groupWells[meta.sampleKey][meta.assayKey].push(well);
      });

    Object.values(groupWells).forEach((assays) => {
      assays.reference.sort((left, right) => sortWells(left, right));
      assays.target.sort((left, right) => sortWells(left, right));
    });

    const currentLabels = labels();
    const groupPrefixes = {
      control: currentLabels.control,
      treated: currentLabels.treated,
    };

    ["control", "treated"].forEach((sampleKey) => {
      const refs = groupWells[sampleKey].reference;
      const tgts = groupWells[sampleKey].target;
      const sampleCount = Math.max(refs.length, tgts.length);
      for (let index = 0; index < sampleCount; index += 1) {
        const sampleId = `${groupPrefixes[sampleKey]} ${index + 1}`;
        const pairId = `Pair ${index + 1}`;
        [refs[index], tgts[index]].forEach((well) => {
          if (!well) {
            return;
          }
          defaults[well] = {
            sampleId,
            pairId,
          };
        });
      }
    });

    return defaults;
  }

  function syncSampleMetadata() {
    const next = {};
    const defaults = buildDefaultSampleMetadata();
    const assignedWells = Object.entries(state.assignments)
      .filter(([, assignmentKey]) => Boolean(assignmentKey))
      .map(([well]) => well)
      .sort(sortWells);

    assignedWells.forEach((well) => {
      const existing = state.sampleMetadataByWell[well] || {};
      const fallback = defaults[well] || {};
      next[well] = {
        sampleId:
          existing.sampleId !== undefined ? existing.sampleId : fallback.sampleId || "",
        pairId: existing.pairId !== undefined ? existing.pairId : fallback.pairId || "",
      };
    });

    state.sampleMetadataByWell = next;
  }

  function renderSampleMetadataTable() {
    syncSampleMetadata();
    const mode = getAnalysisMode();
    const currentLabels = labels();
    const assignedRows = Object.entries(state.assignments)
      .filter(([, assignmentKey]) => Boolean(assignmentKey))
      .sort((left, right) => sortWells(left[0], right[0]));

    if (!assignedRows.length) {
      sampleMetadataBody.innerHTML = `
        <tr>
          <td colspan="5">Assign wells on the plate first.</td>
        </tr>
      `;
      sampleMetadataHint.textContent =
        "Use the same sample ID for the target and reference wells from the same biological sample.";
      return;
    }

    sampleMetadataHint.textContent =
      mode === "paired-matched-control"
        ? "Use the same sample ID for target and reference wells from the same sample, and use the same pair ID for each matched control and treated sample."
        : "Use the same sample ID for the target and reference wells from the same biological sample. Pair ID is optional in this mode.";

    sampleMetadataBody.innerHTML = assignedRows
      .map(([well, assignmentKey]) => {
        const assignment = assignmentMeta[assignmentKey];
        const metadata = state.sampleMetadataByWell[well] || { sampleId: "", pairId: "" };
        return `
          <tr>
            <td>${well}</td>
            <td>${assignment.sampleKey === "control" ? currentLabels.control : currentLabels.treated}</td>
            <td>${assignment.assayKey === "reference" ? currentLabels.reference : currentLabels.target}</td>
            <td>
              <input
                type="text"
                class="sample-metadata-input"
                data-metadata-well="${well}"
                data-metadata-field="sampleId"
                value="${escapeHtml(metadata.sampleId)}"
                placeholder="Sample ID"
              />
            </td>
            <td>
              <input
                type="text"
                class="sample-metadata-input"
                data-metadata-well="${well}"
                data-metadata-field="pairId"
                value="${escapeHtml(metadata.pairId)}"
                placeholder="${mode === "paired-matched-control" ? "Pair ID" : "Optional"}"
              />
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function calculateStats(values) {
    return core.calculateStats(values);
  }

  function parseDelimitedLine(line, delimiter) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === delimiter && !inQuotes) {
        values.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    values.push(current);
    return values.map((value) => value.trim());
  }

  function detectDelimiter(text) {
    const sampleLine = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (!sampleLine) {
      return ",";
    }

    const candidates = ["\t", ";", ","];
    let bestDelimiter = ",";
    let bestCount = -1;

    candidates.forEach((candidate) => {
      const count = sampleLine.split(candidate).length - 1;
      if (count > bestCount) {
        bestCount = count;
        bestDelimiter = candidate;
      }
    });

    return bestDelimiter;
  }

  function parseCtValue(rawValue, delimiter) {
    const cleaned = String(rawValue).trim();
    if (!cleaned) {
      return { value: NaN, ignored: true, reason: "blank Ct value" };
    }

    if (/^(undetermined|undet|na|n\/a|null)$/i.test(cleaned)) {
      return { value: NaN, ignored: true, reason: `ignored nonnumeric Ct value "${cleaned}"` };
    }

    const normalized = delimiter === ";" ? cleaned.replace(",", ".") : cleaned;
    const numeric = Number(normalized);

    if (!Number.isFinite(numeric)) {
      return { value: NaN, ignored: true, reason: `ignored nonnumeric Ct value "${cleaned}"` };
    }

    return { value: numeric, ignored: false };
  }

  function parseCtTable(text) {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("Please upload or paste a Ct table first.");
    }

    const delimiter = detectDelimiter(trimmed);
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      throw new Error("The Ct table appears to be empty.");
    }

    const rows = lines.map((line) => parseDelimitedLine(line, delimiter));
    const headerRow = rows[0].map(normalizeHeader);
    const wellHeaderCandidates = [
      "well",
      "wellposition",
      "wellname",
      "position",
      "samplewell",
    ];
    const ctHeaderCandidates = [
      "ct",
      "cq",
      "ctmean",
      "ctvalue",
      "cqvalue",
      "meanct",
      "meancq",
      "ctavg",
    ];

    let wellIndex = headerRow.findIndex((header) => wellHeaderCandidates.includes(header));
    let ctIndex = headerRow.findIndex((header) => ctHeaderCandidates.includes(header));
    let dataRows = rows.slice(1);

    if (wellIndex === -1 || ctIndex === -1) {
      const firstDataRow = rows[0];
      const inferredWell = normalizeWell(firstDataRow[0]);
      const parsedCt = parseCtValue(firstDataRow[1], delimiter);
      if (inferredWell && !parsedCt.ignored) {
        wellIndex = 0;
        ctIndex = 1;
        dataRows = rows;
      } else {
        throw new Error(
          "Could not find Ct table columns. Include at least a Well column and a Ct or Cq column."
        );
      }
    }

    const parsedRows = [];
    const warnings = [];

    dataRows.forEach((columns, rowIndex) => {
      const well = normalizeWell(columns[wellIndex] || "");
      if (!well) {
        warnings.push(`Row ${rowIndex + 2}: ignored because the well name was not recognized.`);
        return;
      }

      const ctResult = parseCtValue(columns[ctIndex], delimiter);
      if (ctResult.ignored) {
        warnings.push(`Row ${rowIndex + 2} (${well}): ${ctResult.reason}.`);
        return;
      }

      parsedRows.push({
        well,
        ct: ctResult.value,
        sourceRow: rowIndex + 2,
      });
    });

    return { parsedRows, warnings };
  }

  function updateUploadStatus(message, tone) {
    uploadStatus.textContent = message;
    uploadStatus.classList.remove("is-error", "is-success");
    if (tone === "error") {
      uploadStatus.classList.add("is-error");
    }
    if (tone === "success") {
      uploadStatus.classList.add("is-success");
    }
  }

  function createWellButton(well) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "plate-well";
    button.dataset.well = well;
    button.addEventListener("click", () => {
      if (state.activeAssignmentKey === "clear") {
        delete state.assignments[well];
      } else {
        state.assignments[well] = state.activeAssignmentKey;
      }
      renderWellButton(button);
      renderPlateSummary();
    });
    renderWellButton(button);
    return button;
  }

  function renderWellButton(button) {
    const well = button.dataset.well;
    const assignmentKey = state.assignments[well];
    const meta = assignmentKey ? assignmentMeta[assignmentKey] : null;

    button.className = "plate-well";
    button.dataset.assignment = assignmentKey || "";
    button.style.setProperty("--well-accent", meta ? meta.color : "#d9e2eb");
    button.innerHTML = `
      <span class="plate-well-id">${well}</span>
      <span class="plate-well-assignment">${meta ? meta.short : "Unused"}</span>
    `;
  }

  function renderPlate() {
    if (plateGrid.childElementCount) {
      return;
    }

    const headerCorner = document.createElement("div");
    headerCorner.className = "plate-axis plate-axis-corner";
    plateGrid.append(headerCorner);

    colNumbers.forEach((col) => {
      const cell = document.createElement("div");
      cell.className = "plate-axis";
      cell.textContent = col;
      plateGrid.append(cell);
    });

    rowLetters.forEach((row) => {
      const rowLabel = document.createElement("div");
      rowLabel.className = "plate-axis";
      rowLabel.textContent = row;
      plateGrid.append(rowLabel);

      colNumbers.forEach((col) => {
        plateGrid.append(createWellButton(`${row}${col}`));
      });
    });
  }

  function renderPlateSummary() {
    const labelSet = labels();
    const counts = Object.keys(assignmentMeta).reduce((summary, key) => {
      summary[key] = Object.values(state.assignments).filter((value) => value === key).length;
      return summary;
    }, {});

    plateSummary.innerHTML = `
      <div class="plate-summary-grid">
        <div class="plate-summary-chip"><strong>${labelSet.control} + ${labelSet.reference}:</strong> ${counts["control-reference"]}</div>
        <div class="plate-summary-chip"><strong>${labelSet.control} + ${labelSet.target}:</strong> ${counts["control-target"]}</div>
        <div class="plate-summary-chip"><strong>${labelSet.treated} + ${labelSet.reference}:</strong> ${counts["treated-reference"]}</div>
        <div class="plate-summary-chip"><strong>${labelSet.treated} + ${labelSet.target}:</strong> ${counts["treated-target"]}</div>
      </div>
    `;
    renderSampleMetadataTable();
  }

  function setActiveAssignment(key) {
    state.activeAssignmentKey = key;
    assignmentButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.assignmentKey === key);
    });
  }

  function clearPlate() {
    state.assignments = {};
    state.sampleMetadataByWell = {};
    Array.from(plateGrid.querySelectorAll(".plate-well")).forEach((button) => {
      renderWellButton(button);
    });
    renderPlateSummary();
  }

  function loadExampleLayout() {
    clearPlate();
    state.assignments = { ...exampleAssignments };
    Array.from(plateGrid.querySelectorAll(".plate-well")).forEach((button) => {
      renderWellButton(button);
    });
    renderPlateSummary();
  }

  function readLoadedTableText() {
    const manualText = tableTextarea.value.trim();
    if (manualText) {
      state.loadedText = manualText;
      state.sourceLabel = state.sourceLabel || "pasted text";
    }
    return state.loadedText.trim();
  }

  async function loadCtFile(file) {
    const text = await file.text();
    state.loadedText = text;
    state.sourceLabel = file.name;
    tableTextarea.value = text;
    updateUploadStatus(`Loaded Ct table from ${file.name}.`, "success");
  }

  function buildCtMap(parsedRows) {
    const warnings = [];
    const grouped = new Map();

    parsedRows.forEach((row) => {
      if (!grouped.has(row.well)) {
        grouped.set(row.well, []);
      }
      grouped.get(row.well).push(row);
    });

    const ctMap = new Map();
    grouped.forEach((rows, well) => {
      rows.sort((a, b) => a.sourceRow - b.sourceRow);
      if (rows.length > 1) {
        warnings.push(`Multiple Ct rows were found for ${well}. The first numeric value was used.`);
      }
      ctMap.set(well, rows[0]);
    });

    return { ctMap, warnings };
  }

  function computeResults() {
    const tableText = readLoadedTableText();
    if (!tableText) {
      throw new Error("Please upload or paste a Ct table before running the calculator.");
    }

    const usedAssignments = Object.entries(state.assignments)
      .filter(([, value]) => Boolean(value))
      .sort((a, b) => sortWells(a[0], b[0]));

    if (!usedAssignments.length) {
      throw new Error("Please assign plate wells before calculating expression.");
    }

    const parsed = parseCtTable(tableText);
    const ctMapResult = buildCtMap(parsed.parsedRows);
    const ctMap = ctMapResult.ctMap;
    const warnings = [...parsed.warnings, ...ctMapResult.warnings];

    const matchedRows = [];
    usedAssignments.forEach(([well, assignmentKey]) => {
      const ctRow = ctMap.get(well);
      if (!ctRow) {
        warnings.push(`Assigned well ${well} has no Ct value in the imported table.`);
        return;
      }

      const meta = assignmentMeta[assignmentKey];
      matchedRows.push({
        well,
        ct: ctRow.ct,
        assignmentKey,
        sampleKey: meta.sampleKey,
        assayKey: meta.assayKey,
      });
    });

    const ignoredWells = Array.from(ctMap.keys()).filter(
      (well) => !Object.prototype.hasOwnProperty.call(state.assignments, well)
    );
    if (ignoredWells.length) {
      warnings.push(
        `${ignoredWells.length} Ct rows were ignored because their wells were not assigned on the plate.`
      );
    }

    const bucketRows = {
      "control-reference": matchedRows.filter((row) => row.assignmentKey === "control-reference"),
      "control-target": matchedRows.filter((row) => row.assignmentKey === "control-target"),
      "treated-reference": matchedRows.filter((row) => row.assignmentKey === "treated-reference"),
      "treated-target": matchedRows.filter((row) => row.assignmentKey === "treated-target"),
    };

    const missingBuckets = Object.entries(bucketRows)
      .filter(([, rows]) => rows.length === 0)
      .map(([key]) => key);

    if (missingBuckets.length) {
      throw new Error(
        "The calculator needs at least one Ct value in each of the four categories: control/reference, control/target, treated/reference, and treated/target."
      );
    }

    const bucketStats = Object.fromEntries(
      Object.entries(bucketRows).map(([key, rows]) => [key, calculateStats(rows.map((row) => row.ct))])
    );
    const analysisMode = getAnalysisMode();
    const rowsWithSampleMetadata = matchedRows.map((row) => {
      const metadata = state.sampleMetadataByWell[row.well] || { sampleId: "", pairId: "" };
      return {
        ...row,
        sampleId: String(metadata.sampleId || "").trim(),
        pairId: String(metadata.pairId || "").trim(),
      };
    });

    const comparativeResult = core.calculateComparativeCtResult({
      matchedRows: rowsWithSampleMetadata,
      analysisMode,
    });

    return {
      labels: labels(),
      matchedRows: rowsWithSampleMetadata,
      bucketRows,
      bucketStats,
      controlDeltaCt: comparativeResult.controlDeltaCt,
      treatedDeltaCt: comparativeResult.treatedDeltaCt,
      controlDeltaCtSem: comparativeResult.controlDeltaCtSem,
      treatedDeltaCtSem: comparativeResult.treatedDeltaCtSem,
      deltaDeltaCt: comparativeResult.deltaDeltaCt,
      deltaDeltaCtSem: comparativeResult.deltaDeltaCtSem,
      foldChange: comparativeResult.foldChange,
      log2FoldChange: comparativeResult.log2FoldChange,
      foldChangeCI: comparativeResult.foldChangeCI,
      sampleRows: comparativeResult.sampleRows,
      expressionStats: comparativeResult.expressionStats,
      analysisMode,
      warnings,
      sourceLabel: state.sourceLabel || "pasted text",
    };
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function makeSummaryCsv(result) {
    const rows = [
      ["Metric", "Value"],
      ["Analysis mode", result.analysisMode === "paired-matched-control" ? "Paired / matched control method" : "Group control mean method"],
      ["Control deltaCt", formatNumber(result.controlDeltaCt, 4)],
      ["Treated deltaCt", formatNumber(result.treatedDeltaCt, 4)],
      ["DeltaDeltaCt", formatNumber(result.deltaDeltaCt, 4)],
      ["Fold change", formatNumber(result.foldChange, 4)],
      ["log2 fold change", formatNumber(result.log2FoldChange, 4)],
      ["Fold change 95% CI lower", formatNumber(result.foldChangeCI[0], 4)],
      ["Fold change 95% CI upper", formatNumber(result.foldChangeCI[1], 4)],
      [],
      ["Bucket", "n", "Mean Ct", "SD Ct", "SEM Ct"],
    ];

    Object.entries(result.bucketStats).forEach(([bucketKey, stats]) => {
      rows.push([
        bucketKey,
        String(stats.n),
        formatNumber(stats.mean, 4),
        formatNumber(stats.sd, 4),
        formatNumber(stats.sem, 4),
      ]);
    });

    return rows.map((row) => row.join(",")).join("\n");
  }

  function makeSampleLevelCsv(result) {
    const rows = [
      [
        "Sample ID",
        "Group",
        "Target Ct",
        "Reference Ct",
        "DeltaCt",
        "Control DeltaCt used",
        "DeltaDeltaCt",
        "Fold change",
        "Regulation status",
      ],
      ...result.sampleRows.map((row) => [
        row.sampleId,
        row.sampleKey === "control" ? result.labels.control : result.labels.treated,
        formatNumber(row.targetCt, 4),
        formatNumber(row.referenceCt, 4),
        formatNumber(row.deltaCt, 4),
        formatNumber(row.controlDeltaCtUsed, 4),
        formatNumber(row.deltaDeltaCt, 4),
        formatNumber(row.foldChange, 6),
        row.regulationStatus,
      ]),
    ];

    return rows.map((row) => row.join(",")).join("\n");
  }

  function dataTypeLabel(dataType) {
    const labelMap = {
      deltaCt: "DeltaCt values",
      deltaDeltaCt: "DeltaDeltaCt values",
      foldChange: "Fold change values",
      log2FoldChange: "log2 fold change values",
    };
    return labelMap[dataType] || "Sample-level values";
  }

  function studyDesignLabel(studyDesign) {
    const labelMap = {
      "two-independent": "Two independent groups",
      "two-paired": "Two paired groups",
      "multi-independent": "More than two independent groups",
      "multi-paired": "More than two paired or repeated groups",
    };
    return labelMap[studyDesign] || studyDesign;
  }

  function getSampleValue(row, dataType) {
    if (dataType === "deltaCt") {
      return row.deltaCt;
    }
    if (dataType === "deltaDeltaCt") {
      return row.deltaDeltaCt;
    }
    if (dataType === "foldChange") {
      return row.foldChange;
    }
    if (dataType === "log2FoldChange") {
      return -row.deltaDeltaCt;
    }
    return NaN;
  }

  function formatPValue(value) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }
    if (value < 0.0001) {
      return "< 0.0001";
    }
    return value.toFixed(4);
  }

  function statsSampleKey(row) {
    return `${row.sampleKey}::${row.sampleId}`;
  }

  function buildInitialStatisticsState(result) {
    return {
      visible: false,
      studyDesign:
        result.analysisMode === "paired-matched-control"
          ? "two-paired"
          : "two-independent",
      dataType: "deltaCt",
      autoNormality: true,
      annotationMode: "pvalue",
      errorBarMode: "sd",
      groupCount: 2,
      groupNames: [result.labels.control, result.labels.treated],
      assignments: result.sampleRows.map((row) => ({
        key: statsSampleKey(row),
        sampleKey: row.sampleKey,
        sampleId: row.sampleId,
        originalGroup: row.sampleKey === "control" ? result.labels.control : result.labels.treated,
        groupIndex: row.sampleKey === "control" ? 0 : 1,
        pairId: row.pairId || row.sampleId,
      })),
      output: null,
    };
  }

  function normalizeStatisticsState(result, statsState) {
    const isTwoGroup =
      statsState.studyDesign === "two-independent" ||
      statsState.studyDesign === "two-paired";
    const minimumGroups = isTwoGroup ? 2 : 3;
    statsState.groupCount = Math.max(minimumGroups, Number(statsState.groupCount) || minimumGroups);

    const targetNames = [];
    for (let index = 0; index < statsState.groupCount; index += 1) {
      if (isTwoGroup && index === 0) {
        targetNames.push(result.labels.control);
        continue;
      }
      if (isTwoGroup && index === 1) {
        targetNames.push(result.labels.treated);
        continue;
      }
      targetNames.push(statsState.groupNames[index] || `Group ${index + 1}`);
    }
    statsState.groupNames = targetNames;

    statsState.assignments.forEach((assignment) => {
      if (assignment.groupIndex >= statsState.groupCount) {
        assignment.groupIndex = statsState.groupCount - 1;
      }
      if (isTwoGroup) {
        assignment.groupIndex = assignment.sampleKey === "control" ? 0 : 1;
      }
      if (!assignment.pairId) {
        assignment.pairId = assignment.sampleId;
      }
    });
  }

  function buildStatisticsGroups(result, statsState) {
    normalizeStatisticsState(result, statsState);
    const paired =
      statsState.studyDesign === "two-paired" ||
      statsState.studyDesign === "multi-paired";
    const groupMap = statsState.groupNames.map((name) => ({
      name,
      values: [],
    }));
    const rowLookup = new Map(result.sampleRows.map((row) => [statsSampleKey(row), row]));

    statsState.assignments.forEach((assignment) => {
      const row = rowLookup.get(assignment.key);
      if (!row) {
        return;
      }
      const value = getSampleValue(row, statsState.dataType);
      if (!Number.isFinite(value)) {
        return;
      }
      if (paired) {
        groupMap[assignment.groupIndex].values.push({
          pairId: String(assignment.pairId || assignment.sampleId || "").trim(),
          sampleId: assignment.sampleId,
          value,
        });
      } else {
        groupMap[assignment.groupIndex].values.push(value);
      }
    });

    if (groupMap.some((group) => group.values.length === 0)) {
      throw new Error(
        "Each selected statistical group must contain at least one analyzable sample-level value."
      );
    }

    return groupMap;
  }

  function buildStatisticsComparisonLabel(groupNames, studyDesign) {
    if (studyDesign === "two-independent" || studyDesign === "two-paired") {
      return `${groupNames[0]} vs ${groupNames[1]}`;
    }
    return `Overall comparison across ${groupNames.join(", ")}`;
  }

  function buildStatisticsInterpretation(output) {
    if (!Number.isFinite(output.testResult.pValue)) {
      return "The selected test did not produce a valid p-value.";
    }
    if (output.testResult.pValue < 0.05) {
      return `A statistically significant difference was detected in the selected ${dataTypeLabel(
        output.statsState.dataType
      ).toLowerCase()}.`;
    }
    return `No statistically significant difference was detected in the selected ${dataTypeLabel(
      output.statsState.dataType
    ).toLowerCase()} at alpha = 0.05.`;
  }

  function percentile(sortedValues, probability) {
    if (!sortedValues.length) {
      return NaN;
    }
    if (sortedValues.length === 1) {
      return sortedValues[0];
    }
    const position = (sortedValues.length - 1) * probability;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) {
      return sortedValues[lower];
    }
    const weight = position - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  function boxSummary(values) {
    const clean = values.filter((value) => Number.isFinite(value)).slice().sort((a, b) => a - b);
    return {
      min: clean[0],
      q1: percentile(clean, 0.25),
      median: percentile(clean, 0.5),
      q3: percentile(clean, 0.75),
      max: clean[clean.length - 1],
    };
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  async function downloadSvgAsPng(fileName, svgMarkup, width, height) {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = "async";
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
      image.src = url;
      await loaded;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const pngUrl = canvas.toDataURL("image/png");
      const anchor = document.createElement("a");
      anchor.href = pngUrl;
      anchor.download = fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function buildStatisticsTableCsv(output) {
    const rows = [
      [
        "Comparison",
        "Data used",
        "Test selected",
        "Test statistic",
        "p-value",
        "Significance level",
        "Interpretation",
      ],
      [
        output.comparisonLabel,
        dataTypeLabel(output.statsState.dataType),
        output.testResult.testSelected,
        `${output.testResult.statisticLabel} = ${formatNumber(output.testResult.statistic, 4)}`,
        formatPValue(output.testResult.pValue),
        output.testResult.significance,
        output.interpretation,
      ],
    ];
    return rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");
            return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
          })
          .join(",")
      )
      .join("\n");
  }

  function buildStatisticsMethodsText(output) {
    const normalityLine = output.statsState.autoNormality
      ? output.normalitySummary
      : "Automatic normality testing was disabled, so the default parametric test for the selected design was used.";
    return [
      `Statistical analysis was generated with the Wahj Al-DNA RT-qPCR gene expression calculator on the Wahj website.`,
      `Sample-level ${dataTypeLabel(output.statsState.dataType).toLowerCase()} were used for hypothesis testing.`,
      normalityLine,
      `The selected study design was ${studyDesignLabel(output.statsState.studyDesign).toLowerCase()}, so the calculator applied ${output.testResult.testSelected}.`,
      `Graphs were generated in-browser as SVG figures with mean ± ${output.statsState.errorBarMode.toUpperCase()} for the bar chart, plus a box plot with individual points${output.showPairedPlot ? ", and a paired dot plot with matched lines" : ""}.`,
      `Mean Ct bars are descriptive only and were not used alone for hypothesis testing.`,
    ].join(" ");
  }

  function buildStatisticsFigureLegend(output) {
    const annotation =
      output.statsState.annotationMode === "stars"
        ? `${output.testResult.significance}`
        : `p = ${formatPValue(output.testResult.pValue)}`;
    return `Figure. Sample-level ${dataTypeLabel(
      output.statsState.dataType
    ).toLowerCase()} are shown for ${output.comparisonLabel}. The bar chart displays mean ± ${output.statsState.errorBarMode.toUpperCase()}, the box plot shows the distribution with individual points, and paired or repeated designs also show matched-sample lines. Statistical testing was performed with ${output.testResult.testSelected}; ${annotation}.`;
  }

  function buildAnnotationLabel(output) {
    return output.statsState.annotationMode === "stars"
      ? output.testResult.significance
      : `p = ${formatPValue(output.testResult.pValue)}`;
  }

  function buildStatisticsFigure(output) {
    const groups = output.groupSummaries;
    const showPairedPlot = output.showPairedPlot;
    const width = 1120;
    const panelHeight = showPairedPlot ? 280 : 0;
    const height = 680 + panelHeight;
    const margin = { left: 78, right: 40 };
    const sections = {
      bar: { top: 46, height: 220 },
      box: { top: 338, height: 220 },
      paired: { top: 620, height: 220 },
    };
    const chartLeft = margin.left;
    const chartRight = width - margin.right;
    const chartWidth = chartRight - chartLeft;
    const centers = groups.map(
      (_, index) => chartLeft + (chartWidth / groups.length) * (index + 0.5)
    );
    const barWidth = Math.min(120, chartWidth / Math.max(groups.length * 2, 3));
    const allValues = groups.flatMap((group) => group.values);
    const maxValue = Math.max(
      1,
      ...groups.flatMap((group) => {
        const errorAmount =
          output.statsState.errorBarMode === "sem" ? group.stats.sem : group.stats.sd;
        return [group.stats.mean + errorAmount, ...group.values];
      })
    );
    const minValue = Math.min(0, ...allValues);
    const valueScale = (value, top, sectionHeight) => {
      const span = maxValue - minValue || 1;
      return top + sectionHeight - ((value - minValue) / span) * sectionHeight;
    };
    const annotationLabel = buildAnnotationLabel(output);

    const svg = [
      `<svg viewBox="0 0 ${width} ${height}" class="calc-chart-svg" role="img" aria-label="Statistical analysis figure">`,
      `<rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="#ffffff" stroke="#d7e4ef"/>`,
      `<text x="${width / 2}" y="24" text-anchor="middle" class="calc-chart-title">Statistical analysis figure</text>`,
    ];

    function drawAxes(top, sectionHeight, title) {
      svg.push(
        `<text x="${chartLeft}" y="${top - 14}" class="calc-chart-subtitle">${escapeXml(title)}</text>`
      );
      svg.push(
        `<line x1="${chartLeft}" y1="${top + sectionHeight}" x2="${chartRight}" y2="${top + sectionHeight}" class="calc-axis"/>`
      );
      svg.push(
        `<line x1="${chartLeft}" y1="${top}" x2="${chartLeft}" y2="${top + sectionHeight}" class="calc-axis"/>`
      );
      for (let tick = 0; tick <= 5; tick += 1) {
        const tickValue = minValue + ((maxValue - minValue) * tick) / 5;
        const y = valueScale(tickValue, top, sectionHeight);
        svg.push(`<line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" class="calc-grid"/>`);
        svg.push(
          `<text x="${chartLeft - 12}" y="${y + 5}" text-anchor="end" class="calc-tick">${tickValue.toFixed(2)}</text>`
        );
      }
    }

    drawAxes(sections.bar.top, sections.bar.height, "Bar chart with mean and error bars");
    drawAxes(sections.box.top, sections.box.height, "Box plot with individual points");
    if (showPairedPlot) {
      drawAxes(sections.paired.top, sections.paired.height, "Paired or repeated dot plot");
    }

    groups.forEach((group, index) => {
      const center = centers[index];
      const x = center - barWidth / 2;
      const errorAmount =
        output.statsState.errorBarMode === "sem" ? group.stats.sem : group.stats.sd;
      const y = valueScale(group.stats.mean, sections.bar.top, sections.bar.height);
      const errorTop = valueScale(group.stats.mean + errorAmount, sections.bar.top, sections.bar.height);
      const errorBottom = valueScale(
        group.stats.mean - errorAmount,
        sections.bar.top,
        sections.bar.height
      );
      const baseY = valueScale(minValue, sections.bar.top, sections.bar.height);
      svg.push(`<rect x="${x}" y="${Math.min(y, baseY)}" width="${barWidth}" height="${Math.abs(baseY - y)}" rx="14" fill="${group.color}" opacity="0.84"/>`);
      svg.push(`<line x1="${center}" y1="${errorTop}" x2="${center}" y2="${errorBottom}" class="calc-error"/>`);
      svg.push(`<line x1="${center - 12}" y1="${errorTop}" x2="${center + 12}" y2="${errorTop}" class="calc-error"/>`);
      svg.push(`<line x1="${center - 12}" y1="${errorBottom}" x2="${center + 12}" y2="${errorBottom}" class="calc-error"/>`);
      svg.push(`<text x="${center}" y="${y - 10}" text-anchor="middle" class="calc-value">${formatNumber(group.stats.mean, 2)}</text>`);
      svg.push(`<text x="${center}" y="${sections.bar.top + sections.bar.height + 26}" text-anchor="middle" class="calc-label">${escapeXml(group.name)}</text>`);

      const box = group.box;
      const boxTop = valueScale(box.q3, sections.box.top, sections.box.height);
      const boxBottom = valueScale(box.q1, sections.box.top, sections.box.height);
      const medianY = valueScale(box.median, sections.box.top, sections.box.height);
      const whiskerTop = valueScale(box.max, sections.box.top, sections.box.height);
      const whiskerBottom = valueScale(box.min, sections.box.top, sections.box.height);
      svg.push(`<line x1="${center}" y1="${whiskerTop}" x2="${center}" y2="${whiskerBottom}" class="calc-error"/>`);
      svg.push(`<rect x="${x}" y="${boxTop}" width="${barWidth}" height="${Math.max(2, boxBottom - boxTop)}" rx="12" fill="${group.color}" opacity="0.20" stroke="${group.color}" stroke-width="2"/>`);
      svg.push(`<line x1="${x}" y1="${medianY}" x2="${x + barWidth}" y2="${medianY}" class="calc-error"/>`);
      svg.push(`<line x1="${center - 12}" y1="${whiskerTop}" x2="${center + 12}" y2="${whiskerTop}" class="calc-error"/>`);
      svg.push(`<line x1="${center - 12}" y1="${whiskerBottom}" x2="${center + 12}" y2="${whiskerBottom}" class="calc-error"/>`);
      group.values.forEach((value, pointIndex) => {
        const jitter = (pointIndex - (group.values.length - 1) / 2) * 12;
        const cx = center + jitter;
        const cy = valueScale(value, sections.box.top, sections.box.height);
        svg.push(`<circle cx="${cx}" cy="${cy}" r="5.4" fill="#ffffff" stroke="${group.color}" stroke-width="2.6"/>`);
      });

      if (showPairedPlot) {
        const pairPoints = output.pairedSeries[index];
        pairPoints.forEach((entry) => {
          const cy = valueScale(entry.value, sections.paired.top, sections.paired.height);
          svg.push(`<circle cx="${center + entry.offset}" cy="${cy}" r="5.4" fill="#ffffff" stroke="${group.color}" stroke-width="2.6"/>`);
        });
        svg.push(`<text x="${center}" y="${sections.paired.top + sections.paired.height + 26}" text-anchor="middle" class="calc-label">${escapeXml(group.name)}</text>`);
      } else {
        svg.push(`<text x="${center}" y="${sections.box.top + sections.box.height + 26}" text-anchor="middle" class="calc-label">${escapeXml(group.name)}</text>`);
      }
    });

    if (showPairedPlot) {
      output.pairedPaths.forEach((path) => {
        svg.push(
          `<polyline fill="none" stroke="#6f8191" stroke-width="1.8" points="${path.points
            .map(
              (point) =>
                `${centers[point.groupIndex] + point.offset},${valueScale(
                  point.value,
                  sections.paired.top,
                  sections.paired.height
                )}`
            )
            .join(" ")}"/>`
        );
      });
    }

    function drawBracket(top, sectionHeight) {
      const startX = centers[0];
      const endX = centers[groups.length - 1];
      const y = top + 18;
      svg.push(`<path d="M ${startX} ${y + 10} V ${y} H ${endX} V ${y + 10}" class="calc-error" fill="none"/>`);
      svg.push(`<text x="${(startX + endX) / 2}" y="${y - 6}" text-anchor="middle" class="calc-value">${escapeXml(annotationLabel)}</text>`);
    }

    drawBracket(sections.bar.top, sections.bar.height);
    drawBracket(sections.box.top, sections.box.height);
    if (showPairedPlot) {
      drawBracket(sections.paired.top, sections.paired.height);
    }

    svg.push(`<text x="24" y="${sections.bar.top + sections.bar.height / 2}" transform="rotate(-90 24 ${sections.bar.top + sections.bar.height / 2})" class="calc-axis-label">${escapeXml(dataTypeLabel(output.statsState.dataType))}</text>`);
    svg.push(`<text x="24" y="${sections.box.top + sections.box.height / 2}" transform="rotate(-90 24 ${sections.box.top + sections.box.height / 2})" class="calc-axis-label">${escapeXml(dataTypeLabel(output.statsState.dataType))}</text>`);
    if (showPairedPlot) {
      svg.push(`<text x="24" y="${sections.paired.top + sections.paired.height / 2}" transform="rotate(-90 24 ${sections.paired.top + sections.paired.height / 2})" class="calc-axis-label">${escapeXml(dataTypeLabel(output.statsState.dataType))}</text>`);
    }
    svg.push("</svg>");

    return {
      svg: svg.join(""),
      width,
      height,
    };
  }

  function buildStatisticsOutput(result, statsState) {
    const groups = buildStatisticsGroups(result, statsState);
    const numericGroups = groups.map((group) => ({
      name: group.name,
      values:
        statsState.studyDesign === "two-paired" || statsState.studyDesign === "multi-paired"
          ? group.values
          : group.values,
    }));
    const testResult = core.runStatisticalTest({
      studyDesign: statsState.studyDesign,
      autoNormality: statsState.autoNormality,
      groups: numericGroups,
    });
    const groupSummaries = groups.map((group, index) => {
      const values =
        statsState.studyDesign === "two-paired" || statsState.studyDesign === "multi-paired"
          ? group.values.map((entry) => entry.value)
          : group.values;
      return {
        name: group.name,
        color:
          index === 0
            ? assignmentMeta["control-target"].color
            : index === 1
              ? assignmentMeta["treated-target"].color
              : ["#7f5af0", "#2cb67d", "#ef8354", "#5fa7dc"][index % 4],
        values,
        stats: calculateStats(values),
        box: boxSummary(values),
      };
    });
    const showPairedPlot =
      statsState.studyDesign === "two-paired" || statsState.studyDesign === "multi-paired";
    const pairedSeries = groupSummaries.map(() => []);
    const pairedPaths = [];
    if (showPairedPlot) {
      const pairIdMap = new Map();
      groups.forEach((group, groupIndex) => {
        group.values.forEach((entry, entryIndex) => {
          if (!pairIdMap.has(entry.pairId)) {
            pairIdMap.set(entry.pairId, []);
          }
          const offset = (entryIndex % 5) * 4 - 8;
          pairIdMap.get(entry.pairId).push({
            groupIndex,
            pairId: entry.pairId,
            value: entry.value,
            offset,
          });
          pairedSeries[groupIndex].push({ value: entry.value, offset });
        });
      });
      pairIdMap.forEach((points) => {
        if (points.length > 1) {
          pairedPaths.push({ pairId: points[0].pairId, points });
        }
      });
    }

    const comparisonLabel = buildStatisticsComparisonLabel(
      groupSummaries.map((group) => group.name),
      statsState.studyDesign
    );
    const normalitySummary = statsState.autoNormality
      ? `${testResult.normalityResult.note} ${testResult.normalityResult.details
          .filter((detail) => detail.available)
          .map((detail) => `${detail.label}: W = ${formatNumber(detail.statistic, 4)}, p = ${formatPValue(detail.pValue)}`)
          .join("; ")}`
      : "Automatic normality testing was disabled.";
    const output = {
      statsState: { ...statsState },
      testResult,
      groupSummaries,
      comparisonLabel,
      interpretation: "",
      showPairedPlot,
      pairedSeries,
      pairedPaths,
      normalitySummary,
    };
    output.interpretation = buildStatisticsInterpretation(output);
    output.tableCsv = buildStatisticsTableCsv(output);
    output.methodsText = buildStatisticsMethodsText(output);
    output.figureLegend = buildStatisticsFigureLegend(output);
    output.figure = buildStatisticsFigure(output);
    return output;
  }

  function renderStatisticsPanelOutput(output) {
    return `
      <article class="figure-card calc-table-card">
        <div class="figure-heading">
          <p class="figure-label">Statistical result</p>
          <h3>Selected statistical test outcome</h3>
        </div>
        <div class="plate-actions calc-download-actions">
          <button type="button" class="secondary-action" data-stats-action="copy-table">Copy statistical table</button>
          <button type="button" class="secondary-action" data-stats-action="download-table">Download table as CSV</button>
          <button type="button" class="secondary-action" data-stats-action="download-graph">Download graph as PNG</button>
          <button type="button" class="secondary-action" data-stats-action="copy-legend">Copy figure legend</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Comparison</th>
                <th>Data used</th>
                <th>Test selected</th>
                <th>Test statistic</th>
                <th>p-value</th>
                <th>Significance level</th>
                <th>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtml(output.comparisonLabel)}</td>
                <td>${escapeHtml(dataTypeLabel(output.statsState.dataType))}</td>
                <td>${escapeHtml(output.testResult.testSelected)}</td>
                <td>${escapeHtml(
                  `${output.testResult.statisticLabel} = ${formatNumber(output.testResult.statistic, 4)}`
                )}</td>
                <td>${escapeHtml(formatPValue(output.testResult.pValue))}</td>
                <td>${escapeHtml(output.testResult.significance)}</td>
                <td>${escapeHtml(output.interpretation)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="calc-notice">
        <h4>Normality and test-selection note</h4>
        <ul>
          <li>${escapeHtml(output.normalitySummary)}</li>
          <li>Statistical analysis was performed on sample-level normalized values, not on mean Ct bars.</li>
        </ul>
      </article>

      <article class="figure-card calc-chart-card">
        <div class="figure-heading">
          <p class="figure-label">Graphs</p>
          <h3>Statistical summary graphs</h3>
        </div>
        ${output.figure.svg}
      </article>

      <article class="figure-card calc-table-card">
        <div class="figure-heading">
          <p class="figure-label">Methods text</p>
          <h3>Statistical analysis methods text</h3>
        </div>
        <div class="plate-actions calc-download-actions">
          <button type="button" class="secondary-action" data-stats-action="copy-methods">Copy methods text</button>
        </div>
        <div class="calc-methods-card">
          <p>${escapeHtml(output.methodsText)}</p>
        </div>
      </article>
    `;
  }

  function setupStatisticsPanel(statsShell, result) {
    const statsState = buildInitialStatisticsState(result);

    function render() {
      normalizeStatisticsState(result, statsState);
      const isMulti =
        statsState.studyDesign === "multi-independent" ||
        statsState.studyDesign === "multi-paired";
      statsShell.innerHTML = `
        <article class="figure-card calc-table-card">
          <div class="figure-heading">
            <p class="figure-label">Step 4</p>
            <h3>Statistical analysis</h3>
          </div>
          <article class="calc-notice">
            <h4>Important warning</h4>
            <ul>
              <li>Statistical analysis should be performed on sample-level normalized values. Mean Ct bars are descriptive only and should not be used alone for hypothesis testing.</li>
              <li>Recommended data for hypothesis testing: DeltaCt or log2 fold change, rather than raw fold change.</li>
            </ul>
          </article>
          <div class="plate-actions calc-download-actions">
            <button type="button" class="primary-action" data-stats-action="toggle-panel">${
              statsState.visible ? "Hide Statistical Analysis" : "Run Statistical Analysis"
            }</button>
          </div>
          ${
            statsState.visible
              ? `
                <div class="calculator-stats-shell">
                  <div class="calculator-labels">
                    <label class="field">
                      <span>Study design</span>
                      <select id="stats-study-design">
                        <option value="two-independent" ${
                          statsState.studyDesign === "two-independent" ? "selected" : ""
                        }>Two independent groups, e.g. control vs patient</option>
                        <option value="two-paired" ${
                          statsState.studyDesign === "two-paired" ? "selected" : ""
                        }>Two paired groups, e.g. same isolate untreated vs treated</option>
                        <option value="multi-independent" ${
                          statsState.studyDesign === "multi-independent" ? "selected" : ""
                        }>More than two independent groups</option>
                        <option value="multi-paired" ${
                          statsState.studyDesign === "multi-paired" ? "selected" : ""
                        }>More than two paired / repeated groups</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>Data type to analyze</span>
                      <select id="stats-data-type">
                        <option value="deltaCt" ${
                          statsState.dataType === "deltaCt" ? "selected" : ""
                        }>DeltaCt values</option>
                        <option value="deltaDeltaCt" ${
                          statsState.dataType === "deltaDeltaCt" ? "selected" : ""
                        }>DeltaDeltaCt values</option>
                        <option value="foldChange" ${
                          statsState.dataType === "foldChange" ? "selected" : ""
                        }>Fold change values</option>
                        <option value="log2FoldChange" ${
                          statsState.dataType === "log2FoldChange" ? "selected" : ""
                        }>log2 fold change values</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>Normality check</span>
                      <select id="stats-auto-normality">
                        <option value="yes" ${statsState.autoNormality ? "selected" : ""}>Automatically test normality</option>
                        <option value="no" ${!statsState.autoNormality ? "selected" : ""}>Skip automatic normality test</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>Graph annotation style</span>
                      <select id="stats-annotation-mode">
                        <option value="pvalue" ${
                          statsState.annotationMode === "pvalue" ? "selected" : ""
                        }>Show exact p-value</option>
                        <option value="stars" ${
                          statsState.annotationMode === "stars" ? "selected" : ""
                        }>Show significance stars</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>Bar-chart error bars</span>
                      <select id="stats-error-bar-mode">
                        <option value="sd" ${statsState.errorBarMode === "sd" ? "selected" : ""}>Mean ± SD</option>
                        <option value="sem" ${statsState.errorBarMode === "sem" ? "selected" : ""}>Mean ± SEM</option>
                      </select>
                    </label>
                    ${
                      isMulti
                        ? `
                          <label class="field">
                            <span>Number of groups</span>
                            <input id="stats-group-count" type="number" min="3" max="8" value="${statsState.groupCount}" />
                          </label>
                        `
                        : ""
                    }
                  </div>

                  ${
                    isMulti
                      ? `
                        <div class="calculator-labels">
                          ${statsState.groupNames
                            .map(
                              (name, index) => `
                                <label class="field">
                                  <span>Group ${index + 1} name</span>
                                  <input
                                    type="text"
                                    data-stats-group-name="${index}"
                                    value="${escapeHtml(name)}"
                                  />
                                </label>
                              `
                            )
                            .join("")}
                        </div>
                      `
                      : ""
                  }

                  <div class="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Sample ID</th>
                          <th>Original group</th>
                          <th>Statistical group</th>
                          <th>Pair / subject ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${statsState.assignments
                          .map(
                            (assignment, index) => `
                              <tr>
                                <td>${escapeHtml(assignment.sampleId)}</td>
                                <td>${escapeHtml(assignment.originalGroup)}</td>
                                <td>
                                  <select data-stats-assignment-group="${index}">
                                    ${statsState.groupNames
                                      .map(
                                        (groupName, groupIndex) => `
                                          <option value="${groupIndex}" ${
                                            assignment.groupIndex === groupIndex ? "selected" : ""
                                          }>${escapeHtml(groupName)}</option>
                                        `
                                      )
                                      .join("")}
                                  </select>
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    data-stats-assignment-pair="${index}"
                                    value="${escapeHtml(assignment.pairId)}"
                                    placeholder="${
                                      statsState.studyDesign === "two-paired" ||
                                      statsState.studyDesign === "multi-paired"
                                        ? "Required for paired designs"
                                        : "Optional"
                                    }"
                                  />
                                </td>
                              </tr>
                            `
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </div>

                  <div class="plate-actions calc-download-actions">
                    <button type="button" class="primary-action" data-stats-action="run-analysis">Calculate statistical test</button>
                  </div>
                  ${
                    statsState.output ? renderStatisticsPanelOutput(statsState.output) : ""
                  }
                </div>
              `
              : ""
          }
        </article>
      `;
    }

    statsShell.addEventListener("click", async (event) => {
      const actionTarget = event.target.closest("[data-stats-action]");
      if (!actionTarget) {
        return;
      }
      const action = actionTarget.dataset.statsAction;
      if (action === "toggle-panel") {
        statsState.visible = !statsState.visible;
        render();
        return;
      }
      if (action === "run-analysis") {
        try {
          statsState.output = buildStatisticsOutput(result, statsState);
        } catch (error) {
          statsState.output = {
            statsState: { ...statsState },
            testResult: {
              testSelected: "Not completed",
              statisticLabel: "—",
              statistic: NaN,
              pValue: NaN,
              significance: "ns",
            },
            comparisonLabel: "Statistical analysis could not be completed",
            interpretation: error.message || "Statistical analysis failed.",
            normalitySummary: error.message || "Statistical analysis failed.",
            groupSummaries: [],
            showPairedPlot: false,
            pairedSeries: [],
            pairedPaths: [],
            figure: { svg: "", width: 0, height: 0 },
            methodsText: error.message || "Statistical analysis failed.",
            figureLegend: "",
            tableCsv: "",
          };
        }
        render();
        return;
      }
      if (!statsState.output) {
        return;
      }
      if (action === "copy-table") {
        await copyText(
          [
            "Comparison\tData used\tTest selected\tTest statistic\tp-value\tSignificance level\tInterpretation",
            [
              statsState.output.comparisonLabel,
              dataTypeLabel(statsState.output.statsState.dataType),
              statsState.output.testResult.testSelected,
              `${statsState.output.testResult.statisticLabel} = ${formatNumber(
                statsState.output.testResult.statistic,
                4
              )}`,
              formatPValue(statsState.output.testResult.pValue),
              statsState.output.testResult.significance,
              statsState.output.interpretation,
            ].join("\t"),
          ].join("\n")
        );
      } else if (action === "download-table") {
        downloadTextFile("qpcr-statistical-analysis.csv", statsState.output.tableCsv);
      } else if (action === "download-graph") {
        await downloadSvgAsPng(
          "qpcr-statistical-analysis.png",
          statsState.output.figure.svg,
          statsState.output.figure.width,
          statsState.output.figure.height
        );
      } else if (action === "copy-legend") {
        await copyText(statsState.output.figureLegend);
      } else if (action === "copy-methods") {
        await copyText(statsState.output.methodsText);
      }
    });

    statsShell.addEventListener("change", (event) => {
      const target = event.target;
      let shouldRender = false;
      if (target.id === "stats-study-design") {
        statsState.studyDesign = target.value;
        statsState.output = null;
        shouldRender = true;
      } else if (target.id === "stats-data-type") {
        statsState.dataType = target.value;
        statsState.output = null;
      } else if (target.id === "stats-auto-normality") {
        statsState.autoNormality = target.value === "yes";
        statsState.output = null;
      } else if (target.id === "stats-annotation-mode") {
        statsState.annotationMode = target.value;
        if (statsState.output) {
          statsState.output = buildStatisticsOutput(result, statsState);
        }
      } else if (target.id === "stats-error-bar-mode") {
        statsState.errorBarMode = target.value;
        if (statsState.output) {
          statsState.output = buildStatisticsOutput(result, statsState);
        }
      } else if (target.id === "stats-group-count") {
        statsState.groupCount = Number(target.value || 3);
        statsState.output = null;
        shouldRender = true;
      } else if (target.dataset.statsGroupName !== undefined) {
        statsState.groupNames[Number(target.dataset.statsGroupName)] =
          target.value || `Group ${Number(target.dataset.statsGroupName) + 1}`;
        statsState.output = null;
      } else if (target.dataset.statsAssignmentGroup) {
        const index = Number(target.dataset.statsAssignmentGroup);
        statsState.assignments[index].groupIndex = Number(target.value || 0);
        statsState.output = null;
      }
      render();
      if (shouldRender) {
        return;
      }
    });

    statsShell.addEventListener("input", (event) => {
      const target = event.target;
      if (target.dataset.statsAssignmentPair !== undefined) {
        statsState.assignments[Number(target.dataset.statsAssignmentPair)].pairId = target.value;
        statsState.output = null;
      }
    });

    render();
  }

  function renderCtChart(result) {
    const items = [
      {
        label: `${result.labels.control}\n${result.labels.reference}`,
        short: "C Ref",
        stats: result.bucketStats["control-reference"],
        color: assignmentMeta["control-reference"].color,
      },
      {
        label: `${result.labels.control}\n${result.labels.target}`,
        short: "C Tgt",
        stats: result.bucketStats["control-target"],
        color: assignmentMeta["control-target"].color,
      },
      {
        label: `${result.labels.treated}\n${result.labels.reference}`,
        short: "S Ref",
        stats: result.bucketStats["treated-reference"],
        color: assignmentMeta["treated-reference"].color,
      },
      {
        label: `${result.labels.treated}\n${result.labels.target}`,
        short: "S Tgt",
        stats: result.bucketStats["treated-target"],
        color: assignmentMeta["treated-target"].color,
      },
    ];

    const width = 900;
    const height = 390;
    const margin = { top: 36, right: 24, bottom: 84, left: 78 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const maxValue = Math.max(...items.map((item) => item.stats.mean + item.stats.sd), 1);
    const scaleY = (value) => margin.top + chartHeight - (value / (maxValue * 1.18)) * chartHeight;
    const barWidth = chartWidth / items.length / 1.8;

    const svg = [
      `<svg viewBox="0 0 ${width} ${height}" class="calc-chart-svg" role="img" aria-label="Ct mean chart">`,
      `<rect x="0" y="0" width="${width}" height="${height}" rx="22" fill="#ffffff" stroke="#d7e4ef"/>`,
      `<text x="${width / 2}" y="24" text-anchor="middle" class="calc-chart-title">Mean Ct by plate category</text>`,
      `<line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" class="calc-axis"/>`,
      `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" class="calc-axis"/>`,
    ];

    for (let tick = 0; tick <= 5; tick += 1) {
      const tickValue = (maxValue * 1.18 * tick) / 5;
      const y = scaleY(tickValue);
      svg.push(`<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="calc-grid"/>`);
      svg.push(`<text x="${margin.left - 12}" y="${y + 5}" text-anchor="end" class="calc-tick">${tickValue.toFixed(1)}</text>`);
    }

    items.forEach((item, index) => {
      const center = margin.left + (chartWidth / items.length) * (index + 0.5);
      const x = center - barWidth / 2;
      const y = scaleY(item.stats.mean);
      const barHeight = margin.top + chartHeight - y;
      const errorTop = scaleY(item.stats.mean + item.stats.sd);
      const errorBottom = scaleY(Math.max(item.stats.mean - item.stats.sd, 0));

      svg.push(`<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="14" fill="${item.color}" opacity="0.88"/>`);
      svg.push(`<line x1="${center}" y1="${errorTop}" x2="${center}" y2="${errorBottom}" class="calc-error"/>`);
      svg.push(`<line x1="${center - 12}" y1="${errorTop}" x2="${center + 12}" y2="${errorTop}" class="calc-error"/>`);
      svg.push(`<line x1="${center - 12}" y1="${errorBottom}" x2="${center + 12}" y2="${errorBottom}" class="calc-error"/>`);
      svg.push(`<text x="${center}" y="${y - 10}" text-anchor="middle" class="calc-value">${formatNumber(item.stats.mean, 2)}</text>`);
      svg.push(`<text x="${center}" y="${height - 46}" text-anchor="middle" class="calc-label">${item.short}</text>`);
      svg.push(`<text x="${center}" y="${height - 24}" text-anchor="middle" class="calc-small-label">${item.label.replace("\n", " / ")}</text>`);
    });

    svg.push(`<text x="26" y="${margin.top + chartHeight / 2}" transform="rotate(-90 26 ${margin.top + chartHeight / 2})" class="calc-axis-label">Ct</text>`);
    svg.push("</svg>");
    return svg.join("");
  }

  function renderExpressionChart(result) {
    const controlRows = result.sampleRows.filter((row) => row.sampleKey === "control");
    const treatedRows = result.sampleRows.filter((row) => row.sampleKey === "treated");
    const groups = [
      {
        label: result.labels.control,
        stats: result.expressionStats.control,
        rows: controlRows,
        color: assignmentMeta["control-target"].color,
      },
      {
        label: result.labels.treated,
        stats: result.expressionStats.treated,
        rows: treatedRows,
        color: assignmentMeta["treated-target"].color,
      },
    ];

    const width = 900;
    const height = 390;
    const margin = { top: 36, right: 24, bottom: 74, left: 78 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const dataMax = Math.max(
      1.2,
      ...groups.flatMap((group) => [
        group.stats.mean + group.stats.sd,
        ...group.rows.map((row) => row.foldChange),
      ])
    );
    const scaleY = (value) => margin.top + chartHeight - (value / (dataMax * 1.16)) * chartHeight;
    const barWidth = 150;
    const centers = [
      margin.left + chartWidth * 0.28,
      margin.left + chartWidth * 0.72,
    ];

    const svg = [
      `<svg viewBox="0 0 ${width} ${height}" class="calc-chart-svg" role="img" aria-label="Relative expression chart">`,
      `<rect x="0" y="0" width="${width}" height="${height}" rx="22" fill="#ffffff" stroke="#d7e4ef"/>`,
      `<text x="${width / 2}" y="24" text-anchor="middle" class="calc-chart-title">Sample-level normalized expression</text>`,
      `<line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" class="calc-axis"/>`,
      `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" class="calc-axis"/>`,
    ];

    for (let tick = 0; tick <= 5; tick += 1) {
      const tickValue = (dataMax * 1.16 * tick) / 5;
      const y = scaleY(tickValue);
      svg.push(`<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="calc-grid"/>`);
      svg.push(`<text x="${margin.left - 12}" y="${y + 5}" text-anchor="end" class="calc-tick">${tickValue.toFixed(1)}</text>`);
    }

    const baselineY = scaleY(1);
    svg.push(`<line x1="${margin.left}" y1="${baselineY}" x2="${width - margin.right}" y2="${baselineY}" class="calc-baseline"/>`);
    svg.push(`<text x="${width - margin.right}" y="${baselineY - 8}" text-anchor="end" class="calc-small-label">Control baseline = 1</text>`);

    groups.forEach((group, index) => {
      const center = centers[index];
      const x = center - barWidth / 2;
      const y = scaleY(group.stats.mean);
      const barHeight = margin.top + chartHeight - y;
      const errorTop = scaleY(group.stats.mean + group.stats.sd);
      const errorBottom = scaleY(Math.max(group.stats.mean - group.stats.sd, 0));
      svg.push(`<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="14" fill="${group.color}" opacity="0.84"/>`);
      svg.push(`<line x1="${center}" y1="${errorTop}" x2="${center}" y2="${errorBottom}" class="calc-error"/>`);
      svg.push(`<line x1="${center - 12}" y1="${errorTop}" x2="${center + 12}" y2="${errorTop}" class="calc-error"/>`);
      svg.push(`<line x1="${center - 12}" y1="${errorBottom}" x2="${center + 12}" y2="${errorBottom}" class="calc-error"/>`);
      svg.push(`<text x="${center}" y="${y - 12}" text-anchor="middle" class="calc-value">${formatNumber(group.stats.mean, 2)}</text>`);
      svg.push(`<text x="${center}" y="${height - 28}" text-anchor="middle" class="calc-label">${group.label}</text>`);

      group.rows.forEach((row, pointIndex) => {
        const jitter = (pointIndex - (group.rows.length - 1) / 2) * 18;
        const cx = center + jitter;
        const cy = scaleY(row.foldChange);
        svg.push(`<circle cx="${cx}" cy="${cy}" r="6.5" fill="#ffffff" stroke="${group.color}" stroke-width="3"/>`);
      });
    });

    svg.push(`<text x="26" y="${margin.top + chartHeight / 2}" transform="rotate(-90 26 ${margin.top + chartHeight / 2})" class="calc-axis-label">Relative expression</text>`);
    svg.push("</svg>");
    return svg.join("");
  }

  function renderWarnings(warnings) {
    if (!warnings.length) {
      return "";
    }

    return `
      <article class="calc-notice">
        <h4>Review notes</h4>
        <ul>
          ${warnings.map((warning) => `<li>${warning}</li>`).join("")}
        </ul>
      </article>
    `;
  }

  function renderResults(result) {
    const summaryCsv = makeSummaryCsv(result);
    const sampleCsv = makeSampleLevelCsv(result);
    const bucketRows = [
      {
        label: `${result.labels.control} + ${result.labels.reference}`,
        stats: result.bucketStats["control-reference"],
      },
      {
        label: `${result.labels.control} + ${result.labels.target}`,
        stats: result.bucketStats["control-target"],
      },
      {
        label: `${result.labels.treated} + ${result.labels.reference}`,
        stats: result.bucketStats["treated-reference"],
      },
      {
        label: `${result.labels.treated} + ${result.labels.target}`,
        stats: result.bucketStats["treated-target"],
      },
    ];
    const analysisModeLabel =
      result.analysisMode === "paired-matched-control"
        ? "Paired / matched control method"
        : "Group control mean method";
    const analysisModeExplanation =
      result.analysisMode === "paired-matched-control"
        ? "Each treated sample is compared only with its matched control sample."
        : `Each sample first gets its own DeltaCt, then the mean DeltaCt of the ${result.labels.control} group is used as the calibrator baseline.`;

    resultsContainer.innerHTML = `
      <div class="calc-card-grid">
        <article class="calc-summary-card">
          <p class="calc-summary-label">Mean DeltaCt (${result.labels.control})</p>
          <h4>${formatNumber(result.controlDeltaCt, 3)}</h4>
          <p>SEM ${formatNumber(result.controlDeltaCtSem, 3)}</p>
        </article>
        <article class="calc-summary-card">
          <p class="calc-summary-label">Mean DeltaCt (${result.labels.treated})</p>
          <h4>${formatNumber(result.treatedDeltaCt, 3)}</h4>
          <p>SEM ${formatNumber(result.treatedDeltaCtSem, 3)}</p>
        </article>
        <article class="calc-summary-card">
          <p class="calc-summary-label">DeltaDeltaCt</p>
          <h4>${formatNumber(result.deltaDeltaCt, 3)}</h4>
          <p>SEM ${formatNumber(result.deltaDeltaCtSem, 3)}</p>
        </article>
        <article class="calc-summary-card calc-summary-card-accent">
          <p class="calc-summary-label">2^-DeltaDeltaCt</p>
          <h4>${formatNumber(result.foldChange, 3)}x</h4>
          <p>95% CI ${formatNumber(result.foldChangeCI[0], 3)} to ${formatNumber(result.foldChangeCI[1], 3)}</p>
        </article>
      </div>

      <div class="plate-actions calc-download-actions">
        <button type="button" class="secondary-action" id="download-summary-csv">Download summary CSV</button>
        <button type="button" class="secondary-action" id="download-sample-csv">Download sample-level CSV</button>
      </div>

      ${renderWarnings(result.warnings)}

      <article class="calc-notice">
        <h4>Applied analysis mode</h4>
        <ul>
          <li><strong>${analysisModeLabel}.</strong> ${analysisModeExplanation}</li>
          <li>The reference gene Ct is never averaged before DeltaCt calculation for any biological sample.</li>
        </ul>
      </article>

      <div class="calc-chart-grid">
        <article class="calc-chart-card">
          <h4>Mean Ct values by category</h4>
          ${renderCtChart(result)}
        </article>
        <article class="calc-chart-card">
          <h4>Sample-level normalized expression</h4>
          ${renderExpressionChart(result)}
          <p class="calc-chart-note">
            Dots show sample-level fold changes calculated after each biological sample first
            receives its own DeltaCt value.
          </p>
        </article>
      </div>

      <article class="figure-card calc-table-card">
        <div class="figure-heading">
          <p class="figure-label">Statistics</p>
          <h3>Descriptive Ct statistics by plate category</h3>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>n</th>
                <th>Mean Ct</th>
                <th>SD Ct</th>
                <th>SEM Ct</th>
                <th>Min Ct</th>
                <th>Max Ct</th>
              </tr>
            </thead>
            <tbody>
              ${bucketRows
                .map(
                  (row) => `
                    <tr>
                      <td>${row.label}</td>
                      <td>${row.stats.n}</td>
                      <td>${formatNumber(row.stats.mean, 4)}</td>
                      <td>${formatNumber(row.stats.sd, 4)}</td>
                      <td>${formatNumber(row.stats.sem, 4)}</td>
                      <td>${formatNumber(row.stats.min, 4)}</td>
                      <td>${formatNumber(row.stats.max, 4)}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </article>

      <article class="figure-card calc-table-card">
        <div class="figure-heading">
          <p class="figure-label">Calculation trace</p>
          <h3>Comparative Ct result table</h3>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Derived quantity</th>
                <th>Value</th>
                <th>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Analysis mode</td>
                <td>${analysisModeLabel}</td>
                <td>${analysisModeExplanation}</td>
              </tr>
              <tr>
                <td>Mean DeltaCt (${result.labels.control})</td>
                <td>${formatNumber(result.controlDeltaCt, 4)}</td>
                <td>Mean of sample-level DeltaCt values in the calibrator group</td>
              </tr>
              <tr>
                <td>Mean DeltaCt (${result.labels.treated})</td>
                <td>${formatNumber(result.treatedDeltaCt, 4)}</td>
                <td>Mean of sample-level DeltaCt values in the treated or patient group</td>
              </tr>
              <tr>
                <td>DeltaDeltaCt</td>
                <td>${formatNumber(result.deltaDeltaCt, 4)}</td>
                <td>Difference between the treated comparison DeltaCt and the selected control baseline</td>
              </tr>
              <tr>
                <td>2^-DeltaDeltaCt</td>
                <td>${formatNumber(result.foldChange, 6)}</td>
                <td>Fold change relative to the control baseline</td>
              </tr>
              <tr>
                <td>log2 fold change</td>
                <td>${formatNumber(result.log2FoldChange, 4)}</td>
                <td>Positive values indicate higher expression than control</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="figure-card calc-table-card">
        <div class="figure-heading">
          <p class="figure-label">Sample list</p>
          <h3>Sample-level DeltaCt and fold-change table</h3>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sample ID</th>
                <th>Group</th>
                <th>Target Ct</th>
                <th>Reference Ct</th>
                <th>DeltaCt</th>
                <th>Control DeltaCt used</th>
                <th>DeltaDeltaCt</th>
                <th>Fold change</th>
                <th>Regulation status</th>
              </tr>
            </thead>
            <tbody>
              ${result.sampleRows
                .map(
                  (row) => `
                    <tr>
                      <td>${escapeHtml(row.sampleId)}</td>
                      <td>${row.sampleKey === "control" ? result.labels.control : result.labels.treated}</td>
                      <td>${formatNumber(row.targetCt, 4)}</td>
                      <td>${formatNumber(row.referenceCt, 4)}</td>
                      <td>${formatNumber(row.deltaCt, 4)}</td>
                      <td>${formatNumber(row.controlDeltaCtUsed, 4)}</td>
                      <td>${formatNumber(row.deltaDeltaCt, 4)}</td>
                      <td>${formatNumber(row.foldChange, 6)}</td>
                      <td>${row.regulationStatus}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </article>

      <div id="stats-analysis-shell"></div>
    `;

    resultsSection.hidden = false;

    const summaryButton = resultsContainer.querySelector("#download-summary-csv");
    const sampleButton = resultsContainer.querySelector("#download-sample-csv");

    summaryButton.addEventListener("click", () => {
      downloadTextFile("qpcr-ddct-summary.csv", summaryCsv);
    });

    sampleButton.addEventListener("click", () => {
      downloadTextFile("qpcr-ddct-sample-level-results.csv", sampleCsv);
    });

    const statsShell = resultsContainer.querySelector("#stats-analysis-shell");
    setupStatisticsPanel(statsShell, result);
  }

  assignmentButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveAssignment(button.dataset.assignmentKey);
    });
  });

  exampleLayoutButton.addEventListener("click", () => {
    loadExampleLayout();
    updateUploadStatus("Example plate layout loaded.", "success");
  });

  clearPlateButton.addEventListener("click", () => {
    clearPlate();
    updateUploadStatus("Plate assignments cleared.", "");
  });

  fileInput.addEventListener("change", async () => {
    if (!fileInput.files || !fileInput.files[0]) {
      return;
    }

    try {
      await loadCtFile(fileInput.files[0]);
    } catch (error) {
      updateUploadStatus(error.message || "Could not read the uploaded Ct file.", "error");
    }
  });

  tableTextarea.addEventListener("input", () => {
    state.loadedText = tableTextarea.value;
    if (tableTextarea.value.trim()) {
      state.sourceLabel = "pasted text";
      updateUploadStatus("Ct table pasted. Ready to calculate.", "success");
    } else {
      updateUploadStatus("No Ct table loaded yet.", "");
    }
  });

  [controlLabelInput, treatedLabelInput, referenceGeneLabelInput, targetGeneLabelInput].forEach(
    (input) => {
      input.addEventListener("input", () => {
        renderPlateSummary();
      });
    }
  );

  analysisModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      state.analysisMode = getAnalysisMode();
      renderSampleMetadataTable();
    });
  });

  sampleMetadataBody.addEventListener("input", (event) => {
    const input = event.target.closest("[data-metadata-well]");
    if (!input) {
      return;
    }

    const well = input.dataset.metadataWell;
    const field = input.dataset.metadataField;
    if (!well || !field) {
      return;
    }

    if (!state.sampleMetadataByWell[well]) {
      state.sampleMetadataByWell[well] = { sampleId: "", pairId: "" };
    }
    state.sampleMetadataByWell[well][field] = input.value;
  });

  loadExampleDataButton.addEventListener("click", () => {
    tableTextarea.value = exampleCtTable;
    state.loadedText = exampleCtTable;
    state.sourceLabel = "example Ct table";
    updateUploadStatus("Example Ct table loaded.", "success");
  });

  calculateButton.addEventListener("click", () => {
    try {
      const result = computeResults();
      renderResults(result);
      updateUploadStatus(
        `Calculation completed using ${result.sourceLabel}.`,
        "success"
      );
    } catch (error) {
      resultsSection.hidden = true;
      resultsContainer.replaceChildren();
      updateUploadStatus(error.message || "The calculator could not complete the analysis.", "error");
    }
  });

  renderPlate();
  renderPlateSummary();
  setActiveAssignment(state.activeAssignmentKey);
  state.analysisMode = getAnalysisMode();
})(window);
