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
      `<text x="${width / 2}" y="24" text-anchor="middle" class="calc-chart-title">Well-level normalized expression</text>`,
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
