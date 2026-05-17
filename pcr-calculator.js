(function () {
  const tool = document.querySelector("#pcr-expression-tool");
  if (!tool) {
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
    loadedText: "",
    sourceLabel: "",
    lastWarnings: [],
  };

  function labels() {
    return {
      control: controlLabelInput.value.trim() || "Control",
      treated: treatedLabelInput.value.trim() || "Treated",
      reference: referenceGeneLabelInput.value.trim() || "Reference gene",
      target: targetGeneLabelInput.value.trim() || "Target gene",
    };
  }

  function formatNumber(value, decimals = 3) {
    if (!Number.isFinite(value)) {
      return "N/A";
    }

    return Number(value).toFixed(decimals);
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

  function calculateStats(values) {
    const numericValues = values.filter((value) => Number.isFinite(value));
    const n = numericValues.length;

    if (!n) {
      return {
        n: 0,
        mean: NaN,
        sd: NaN,
        sem: NaN,
        min: NaN,
        max: NaN,
      };
    }

    const mean = numericValues.reduce((sum, value) => sum + value, 0) / n;
    const variance =
      n > 1
        ? numericValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
        : 0;
    const sd = Math.sqrt(variance);

    return {
      n,
      mean,
      sd,
      sem: sd / Math.sqrt(n),
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
    };
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
  }

  function setActiveAssignment(key) {
    state.activeAssignmentKey = key;
    assignmentButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.assignmentKey === key);
    });
  }

  function clearPlate() {
    state.assignments = {};
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

    const controlDeltaCt =
      bucketStats["control-target"].mean - bucketStats["control-reference"].mean;
    const treatedDeltaCt =
      bucketStats["treated-target"].mean - bucketStats["treated-reference"].mean;
    const controlDeltaCtSem = Math.sqrt(
      bucketStats["control-target"].sem ** 2 + bucketStats["control-reference"].sem ** 2
    );
    const treatedDeltaCtSem = Math.sqrt(
      bucketStats["treated-target"].sem ** 2 + bucketStats["treated-reference"].sem ** 2
    );
    const deltaDeltaCt = treatedDeltaCt - controlDeltaCt;
    const deltaDeltaCtSem = Math.sqrt(controlDeltaCtSem ** 2 + treatedDeltaCtSem ** 2);
    const foldChange = 2 ** -deltaDeltaCt;
    const log2FoldChange = -deltaDeltaCt;
    const ciA = 2 ** -(deltaDeltaCt + 1.96 * deltaDeltaCtSem);
    const ciB = 2 ** -(deltaDeltaCt - 1.96 * deltaDeltaCtSem);
    const foldChangeCI = [Math.min(ciA, ciB), Math.max(ciA, ciB)];

    const referenceMeans = {
      control: bucketStats["control-reference"].mean,
      treated: bucketStats["treated-reference"].mean,
    };

    const wellLevelRows = matchedRows
      .filter((row) => row.assayKey === "target")
      .map((row) => {
        const deltaCt = row.ct - referenceMeans[row.sampleKey];
        const relativeExpression = 2 ** -(deltaCt - controlDeltaCt);
        return {
          well: row.well,
          sampleKey: row.sampleKey,
          ct: row.ct,
          deltaCt,
          relativeExpression,
        };
      })
      .sort(sortWells);

    const expressionStats = {
      control: calculateStats(
        wellLevelRows
          .filter((row) => row.sampleKey === "control")
          .map((row) => row.relativeExpression)
      ),
      treated: calculateStats(
        wellLevelRows
          .filter((row) => row.sampleKey === "treated")
          .map((row) => row.relativeExpression)
      ),
    };

    return {
      labels: labels(),
      matchedRows,
      bucketRows,
      bucketStats,
      controlDeltaCt,
      treatedDeltaCt,
      controlDeltaCtSem,
      treatedDeltaCtSem,
      deltaDeltaCt,
      deltaDeltaCtSem,
      foldChange,
      log2FoldChange,
      foldChangeCI,
      wellLevelRows,
      expressionStats,
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

  function makeWellLevelCsv(result) {
    const rows = [
      ["Well", "Sample", "Target Ct", "DeltaCt", "Relative expression (2^-DeltaDeltaCt)"],
      ...result.wellLevelRows.map((row) => [
        row.well,
        row.sampleKey,
        formatNumber(row.ct, 4),
        formatNumber(row.deltaCt, 4),
        formatNumber(row.relativeExpression, 6),
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
    const controlRows = result.wellLevelRows.filter((row) => row.sampleKey === "control");
    const treatedRows = result.wellLevelRows.filter((row) => row.sampleKey === "treated");
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
        ...group.rows.map((row) => row.relativeExpression),
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
        const cy = scaleY(row.relativeExpression);
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
    const wellCsv = makeWellLevelCsv(result);
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

    resultsContainer.innerHTML = `
      <div class="calc-card-grid">
        <article class="calc-summary-card">
          <p class="calc-summary-label">DeltaCt (${result.labels.control})</p>
          <h4>${formatNumber(result.controlDeltaCt, 3)}</h4>
          <p>SEM ${formatNumber(result.controlDeltaCtSem, 3)}</p>
        </article>
        <article class="calc-summary-card">
          <p class="calc-summary-label">DeltaCt (${result.labels.treated})</p>
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
        <button type="button" class="secondary-action" id="download-well-csv">Download well-level CSV</button>
      </div>

      ${renderWarnings(result.warnings)}

      <div class="calc-chart-grid">
        <article class="calc-chart-card">
          <h4>Mean Ct values by category</h4>
          ${renderCtChart(result)}
        </article>
        <article class="calc-chart-card">
          <h4>Well-level normalized expression</h4>
          ${renderExpressionChart(result)}
          <p class="calc-chart-note">
            Dots show well-level target expression normalized against the mean reference Ct
            of the same sample group. The main comparative result remains the mean-based
            2^-DeltaDeltaCt calculation shown above.
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
                <td>DeltaCt (${result.labels.control})</td>
                <td>${formatNumber(result.controlDeltaCt, 4)}</td>
                <td>Target Ct minus reference Ct in the calibrator group</td>
              </tr>
              <tr>
                <td>DeltaCt (${result.labels.treated})</td>
                <td>${formatNumber(result.treatedDeltaCt, 4)}</td>
                <td>Target Ct minus reference Ct in the treated or patient group</td>
              </tr>
              <tr>
                <td>DeltaDeltaCt</td>
                <td>${formatNumber(result.deltaDeltaCt, 4)}</td>
                <td>Difference between treated DeltaCt and control DeltaCt</td>
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
          <p class="figure-label">Well list</p>
          <h3>Well-level normalized target expression</h3>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Well</th>
                <th>Sample group</th>
                <th>Target Ct</th>
                <th>DeltaCt</th>
                <th>Relative expression</th>
              </tr>
            </thead>
            <tbody>
              ${result.wellLevelRows
                .map(
                  (row) => `
                    <tr>
                      <td>${row.well}</td>
                      <td>${row.sampleKey === "control" ? result.labels.control : result.labels.treated}</td>
                      <td>${formatNumber(row.ct, 4)}</td>
                      <td>${formatNumber(row.deltaCt, 4)}</td>
                      <td>${formatNumber(row.relativeExpression, 6)}</td>
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
    const wellButton = resultsContainer.querySelector("#download-well-csv");

    summaryButton.addEventListener("click", () => {
      downloadTextFile("qpcr-ddct-summary.csv", summaryCsv);
    });

    wellButton.addEventListener("click", () => {
      downloadTextFile("qpcr-ddct-well-level-results.csv", wellCsv);
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
})();
