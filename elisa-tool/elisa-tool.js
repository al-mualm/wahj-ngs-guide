(function initElisaTool(windowObject) {
  const engine = windowObject.WahjElisaEngine;
  if (!engine) {
    return;
  }

  const state = {
    standards: [],
    unknowns: [],
    results: null,
    statsUi: null,
  };

  const element = {
    standardsBody: document.querySelector("#standards-body"),
    unknownsBody: document.querySelector("#unknowns-body"),
    unknownsPaste: document.querySelector("#unknowns-paste"),
    importUnknownsPaste: document.querySelector("#import-unknowns-paste"),
    addStandardRow: document.querySelector("#add-standard-row"),
    addSampleRow: document.querySelector("#add-sample-row"),
    calculateButton: document.querySelector("#calculate-elisa"),
    clearButton: document.querySelector("#clear-elisa"),
    loadExampleButton: document.querySelector("#load-example"),
    status: document.querySelector("#elisa-status"),
    concentrationUnit: document.querySelector("#concentration-unit"),
    blankOd: document.querySelector("#blank-od"),
    assayName: document.querySelector("#assay-name"),
    resultsSection: document.querySelector("#results"),
    statisticsSection: document.querySelector("#statistics"),
    showStatisticsButton: document.querySelector("#show-statistics"),
    standardsSummaryBody: document.querySelector("#standards-summary-body"),
    unknownResultsBody: document.querySelector("#unknown-results-body"),
    curveChoiceLabel: document.querySelector("#curve-choice-label"),
    curveModelLabel: document.querySelector("#curve-model-label"),
    curveR2: document.querySelector("#curve-r2"),
    standardsUsed: document.querySelector("#standards-used"),
    curveEquation: document.querySelector("#curve-equation"),
    curvePlot: document.querySelector("#curve-plot"),
    curveCaption: document.querySelector("#curve-caption"),
    copyStandardsTable: document.querySelector("#copy-standards-table"),
    exportStandardsTable: document.querySelector("#export-standards-table"),
    copyResultsTable: document.querySelector("#copy-results-table"),
    exportResultsTable: document.querySelector("#export-results-table"),
    statsGroupCount: document.querySelector("#stats-group-count"),
    statsDependent: document.querySelector("#stats-dependent"),
    statsGroupNames: document.querySelector("#stats-group-names"),
    statsAssignmentBody: document.querySelector("#stats-assignment-body"),
    statsMethodPreview: document.querySelector("#stats-method-preview"),
    pairColumnHeader: document.querySelector("#pair-column-header"),
    runStatistics: document.querySelector("#run-statistics"),
    statsStatus: document.querySelector("#stats-status"),
    statsTestName: document.querySelector("#stats-test-name"),
    statsStatistic: document.querySelector("#stats-statistic"),
    statsDf: document.querySelector("#stats-df"),
    statsPvalue: document.querySelector("#stats-pvalue"),
    statsSummaryBody: document.querySelector("#stats-summary-body"),
    copyStatsTable: document.querySelector("#copy-stats-table"),
    exportStatsTable: document.querySelector("#export-stats-table"),
    methodsText: document.querySelector("#methods-text"),
    copyMethodsText: document.querySelector("#copy-methods-text"),
  };

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNumber(value, digits = 3) {
    if (!Number.isFinite(value)) {
      return "—";
    }
    return Number(value).toFixed(digits);
  }

  function splitPastedGrid(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.trim())
      .map((line) => {
        const delimiter = line.includes("\t") ? "\t" : ",";
        return line.split(delimiter).map((cell) => cell.trim());
      });
  }

  function normalizeHeaderKey(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function detectHeaderMap(cells, mode) {
    const fieldMap = {};
    cells.forEach((cell, index) => {
      const key = normalizeHeaderKey(cell);
      if (!key) {
        return;
      }
      if (!fieldMap.concentration && (key === "conc" || key.includes("concentration"))) {
        fieldMap.concentration = index;
        return;
      }
      if (!fieldMap.sampleId && (key === "sample" || key === "sample id" || key === "id")) {
        fieldMap.sampleId = index;
        return;
      }
      if (!fieldMap.dilutionFactor && key.includes("dilution")) {
        fieldMap.dilutionFactor = index;
        return;
      }
      if (!fieldMap.label && mode === "standards" && (key === "standard" || key === "label" || key === "name")) {
        fieldMap.label = index;
        return;
      }
      if (!fieldMap.od1 && /(^od ?1$)|(^rep(licate)? ?1$)|(^well ?1$)/.test(key)) {
        fieldMap.od1 = index;
        return;
      }
      if (!fieldMap.od2 && /(^od ?2$)|(^rep(licate)? ?2$)|(^well ?2$)/.test(key)) {
        fieldMap.od2 = index;
        return;
      }
      if (!fieldMap.od3 && /(^od ?3$)|(^rep(licate)? ?3$)|(^well ?3$)/.test(key)) {
        fieldMap.od3 = index;
      }
    });

    if (!Object.keys(fieldMap).length) {
      return null;
    }
    if (mode === "standards" && fieldMap.concentration !== undefined && fieldMap.od1 !== undefined) {
      return fieldMap;
    }
    if (mode === "unknowns" && fieldMap.sampleId !== undefined && fieldMap.od1 !== undefined) {
      return fieldMap;
    }
    return null;
  }

  function getMappedValue(cells, fieldMap, fieldName) {
    const index = fieldMap?.[fieldName];
    if (index === undefined) {
      return "";
    }
    return cells[index] ?? "";
  }

  function parseUnknownsPaste(text) {
    const rows = splitPastedGrid(text);
    if (!rows.length) {
      throw new Error("Paste at least one unknown-sample row copied from Excel.");
    }
    if (looksLikePlateMatrix(rows)) {
      return parseUnknownPlateMatrix(rows);
    }
    const headerMap = detectHeaderMap(rows[0], "unknowns");
    const dataRows = headerMap ? rows.slice(1) : rows;

    const imported = dataRows
      .map((cells, index) => {
        if (!cells.some((cell) => String(cell || "").trim())) {
          return null;
        }

        if (headerMap) {
          return {
            id: createId("sample"),
            sampleId: getMappedValue(cells, headerMap, "sampleId") || `Sample ${index + 1}`,
            dilutionFactor: getMappedValue(cells, headerMap, "dilutionFactor") || "1",
            od1: getMappedValue(cells, headerMap, "od1"),
            od2: getMappedValue(cells, headerMap, "od2"),
            od3: getMappedValue(cells, headerMap, "od3"),
          };
        }

        if (cells.length >= 5) {
          return {
            id: createId("sample"),
            sampleId: cells[0] || `Sample ${index + 1}`,
            dilutionFactor: cells[1] || "1",
            od1: cells[2] || "",
            od2: cells[3] || "",
            od3: cells[4] || "",
          };
        }

        return {
          id: createId("sample"),
          sampleId: cells[0] || `Sample ${index + 1}`,
          dilutionFactor: "1",
          od1: cells[1] || "",
          od2: cells[2] || "",
          od3: cells[3] || "",
        };
      })
      .filter((row) => row && String(row.sampleId || "").trim());

    if (!imported.length) {
      throw new Error("No valid unknown-sample rows were found in the pasted block.");
    }
    return imported;
  }

  function looksLikePlateMatrix(rows) {
    const maxColumns = Math.max(...rows.map((row) => row.length));
    if (rows.length < 2 || rows.length > 8 || maxColumns < 2 || maxColumns > 12) {
      return false;
    }
    if (detectHeaderMap(rows[0], "unknowns")) {
      return false;
    }
    return rows.every((row) =>
      row.every((cell) => !String(cell || "").trim() || Number.isFinite(Number(cell)))
    );
  }

  function parseUnknownPlateMatrix(rows) {
    const rowLabels = "ABCDEFGH".split("");
    const imported = [];

    rows.forEach((cells, rowIndex) => {
      cells.forEach((cell, columnIndex) => {
        if (!String(cell || "").trim()) {
          return;
        }
        imported.push({
          id: createId("sample"),
          sampleId: `${rowLabels[rowIndex] || `R${rowIndex + 1}`}${columnIndex + 1}`,
          dilutionFactor: "1",
          od1: cell,
          od2: "",
          od3: "",
        });
      });
    });

    if (!imported.length) {
      throw new Error("No valid OD values were found in the pasted plate matrix.");
    }
    return imported;
  }

  function setStatus(message, tone) {
    if (!element.status) {
      return;
    }
    element.status.textContent = message;
    element.status.classList.remove("is-error", "is-success");
    if (tone) {
      element.status.classList.add(tone === "error" ? "is-error" : "is-success");
    }
  }

  function setStatsStatus(message, tone) {
    if (!element.statsStatus) {
      return;
    }
    element.statsStatus.textContent = message;
    element.statsStatus.classList.remove("is-error", "is-success");
    if (tone) {
      element.statsStatus.classList.add(tone === "error" ? "is-error" : "is-success");
    }
  }

  function defaultStandardConcentrations() {
    return ["0", "31.25", "62.5", "125", "250", "500"];
  }

  function resetState() {
    state.standards = defaultStandardConcentrations().map((concentration, index) => ({
      id: createId("standard"),
      label: `S${index + 1}`,
      concentration,
      od1: "",
      od2: "",
      od3: "",
    }));
    state.unknowns = [
      { id: createId("sample"), sampleId: "Sample 1", dilutionFactor: "1", od1: "", od2: "", od3: "" },
      { id: createId("sample"), sampleId: "Sample 2", dilutionFactor: "1", od1: "", od2: "", od3: "" },
    ];
    state.results = null;
    state.statsUi = null;
  }

  function loadPracticeExample() {
    element.assayName.value = "Human IL-6 teaching example";
    element.concentrationUnit.value = "ng/L";
    element.blankOd.value = "0.000";
    const directionInput = document.querySelector('input[name="signal-direction"][value="increasing"]');
    if (directionInput) {
      directionInput.checked = true;
    }
    const curveInput = document.querySelector('input[name="curve-preset"][value="linear"]');
    if (curveInput) {
      curveInput.checked = true;
    }
    const fiveParameterInput = document.querySelector("#use-five-parameter");
    if (fiveParameterInput) {
      fiveParameterInput.checked = false;
    }

    state.standards = [
      { id: createId("standard"), label: "S1", concentration: "0", od1: "0.01", od2: "0.00", od3: "" },
      { id: createId("standard"), label: "S2", concentration: "15", od1: "0.18", od2: "0.20", od3: "" },
      { id: createId("standard"), label: "S3", concentration: "30", od1: "0.39", od2: "0.42", od3: "" },
      { id: createId("standard"), label: "S4", concentration: "75", od1: "0.73", od2: "0.77", od3: "" },
      { id: createId("standard"), label: "S5", concentration: "150", od1: "1.24", od2: "1.29", od3: "" },
      { id: createId("standard"), label: "S6", concentration: "320", od1: "2.17", od2: "2.21", od3: "" },
    ];
    state.unknowns = [
      { id: createId("sample"), sampleId: "Control 1", dilutionFactor: "1", od1: "0.54", od2: "0.57", od3: "" },
      { id: createId("sample"), sampleId: "Control 2", dilutionFactor: "1", od1: "0.60", od2: "0.58", od3: "" },
      { id: createId("sample"), sampleId: "Treated 1", dilutionFactor: "1", od1: "1.48", od2: "1.44", od3: "" },
      { id: createId("sample"), sampleId: "Treated 2", dilutionFactor: "1", od1: "1.54", od2: "1.50", od3: "" },
    ];
    state.results = null;
    state.statsUi = null;
    renderInputTables();
    hideOutputs();
    setStatus("Practice example loaded. Generate the curve to calculate concentrations.", "success");
  }

  function renderInputTables() {
    element.standardsBody.innerHTML = state.standards
      .map(
        (row) => `
          <tr data-standard-row="${row.id}">
            <td><input type="text" data-standard-field="label" value="${escapeHtml(row.label)}" /></td>
            <td><input type="number" step="any" data-standard-field="concentration" value="${escapeHtml(row.concentration)}" /></td>
            <td><input type="number" step="any" data-standard-field="od1" value="${escapeHtml(row.od1)}" /></td>
            <td><input type="number" step="any" data-standard-field="od2" value="${escapeHtml(row.od2)}" /></td>
            <td><input type="number" step="any" data-standard-field="od3" value="${escapeHtml(row.od3)}" /></td>
            <td><button type="button" class="secondary-action table-row-action" data-remove-standard="${row.id}">Remove</button></td>
          </tr>
        `
      )
      .join("");

    element.unknownsBody.innerHTML = state.unknowns
      .map(
        (row) => `
          <tr data-sample-row="${row.id}">
            <td><input type="text" data-sample-field="sampleId" value="${escapeHtml(row.sampleId)}" /></td>
            <td><input type="number" min="0.0001" step="any" data-sample-field="dilutionFactor" value="${escapeHtml(row.dilutionFactor)}" /></td>
            <td><input type="number" step="any" data-sample-field="od1" value="${escapeHtml(row.od1)}" /></td>
            <td><input type="number" step="any" data-sample-field="od2" value="${escapeHtml(row.od2)}" /></td>
            <td><input type="number" step="any" data-sample-field="od3" value="${escapeHtml(row.od3)}" /></td>
            <td><button type="button" class="secondary-action table-row-action" data-remove-sample="${row.id}">Remove</button></td>
          </tr>
        `
      )
      .join("");
  }

  function hideOutputs() {
    element.resultsSection.classList.add("is-hidden");
    element.statisticsSection.classList.add("is-hidden");
    state.results = null;
    state.statsUi = null;
    renderStatsPreview();
  }

  function parseFinite(value) {
    const next = Number(value);
    return Number.isFinite(next) ? next : null;
  }

  function collectReplicateValues(record) {
    return ["od1", "od2", "od3"]
      .map((field) => parseFinite(record[field]))
      .filter((value) => Number.isFinite(value));
  }

  function getSignalDirection() {
    return (
      document.querySelector('input[name="signal-direction"]:checked')?.value || "increasing"
    );
  }

  function getCurvePreset() {
    return document.querySelector('input[name="curve-preset"]:checked')?.value || "curved";
  }

  function getCurveOptions() {
    const preset = getCurvePreset();
    const useFiveParameter = Boolean(document.querySelector("#use-five-parameter")?.checked);
    return {
      curveChoice: preset,
      useFiveParameter: preset === "curved" && useFiveParameter,
      direction: getSignalDirection(),
    };
  }

  function buildStandardDataset(blankOd) {
    const summaries = [];
    const points = [];

    state.standards.forEach((row) => {
      const concentration = parseFinite(row.concentration);
      const correctedValues = collectReplicateValues(row).map((value) => value - blankOd);
      const summary = engine.calculateSummary(correctedValues);
      summaries.push({
        label: row.label || "Standard",
        concentration,
        correctedValues,
        meanOd: summary.mean,
        sd: summary.sd,
        cvPercent: summary.cvPercent,
      });
      if (Number.isFinite(concentration) && Number.isFinite(summary.mean)) {
        points.push({ x: concentration, y: summary.mean, label: row.label || "Standard" });
      }
    });

    points.sort((left, right) => left.x - right.x);
    return { summaries, points };
  }

  function buildUnknownDataset(blankOd) {
    return state.unknowns.map((row) => ({
      sampleId: row.sampleId || "Sample",
      dilutionFactor: parseFinite(row.dilutionFactor) || 1,
      correctedOds: collectReplicateValues(row).map((value) => value - blankOd),
    }));
  }

  function curveChoiceLabel() {
    const preset = getCurvePreset();
    if (preset === "linear") {
      return "Straight or nearly straight plot";
    }
    if (document.querySelector("#use-five-parameter")?.checked) {
      return "Curved plot with advanced asymmetric option";
    }
    return "Curved ELISA plot";
  }

  function modelLabel(modelName) {
    if (modelName === "linear") {
      return "Linear model";
    }
    if (modelName === "5pl") {
      return "Asymmetric 5-parameter logistic model";
    }
    return "4-parameter logistic model";
  }

  function createTableTsv(headers, rows) {
    return [headers.join("\t")]
      .concat(rows.map((row) => row.map((cell) => String(cell ?? "—").replace(/\n/g, " | ")).join("\t")))
      .join("\n");
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }

  function downloadCsv(headers, rows, fileName) {
    const csvLines = [headers, ...rows].map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(",")
    );
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function renderCurvePlot(fittedCurve, standardPoints, assayName, unit) {
    if (!standardPoints.length) {
      element.curvePlot.innerHTML = "";
      element.curveCaption.textContent =
        "The plot will appear after enough valid standards have been entered.";
      return;
    }

    const series = engine.generateCurveSeries(fittedCurve, standardPoints, 120);
    const plotPoints = standardPoints.concat(series).filter(
      (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
    );
    const maxX = Math.max(...plotPoints.map((point) => point.x));
    const maxY = Math.max(...plotPoints.map((point) => point.y));
    const minX = Math.min(...plotPoints.map((point) => point.x));
    const minY = Math.min(0, ...plotPoints.map((point) => point.y));
    const width = 720;
    const height = 380;
    const margin = { top: 28, right: 26, bottom: 56, left: 78 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    function scaleX(x) {
      const span = maxX - minX || 1;
      return margin.left + ((x - minX) / span) * innerWidth;
    }

    function scaleY(y) {
      const span = maxY - minY || 1;
      return margin.top + innerHeight - ((y - minY) / span) * innerHeight;
    }

    const path = series
      .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.x).toFixed(2)} ${scaleY(point.y).toFixed(2)}`)
      .join(" ");

    const yTicks = Array.from({ length: 5 }, (_, index) => minY + ((maxY - minY) * index) / 4);
    const xTicks = Array.from({ length: 5 }, (_, index) => minX + ((maxX - minX) * index) / 4);

    element.curvePlot.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="ELISA standard curve plot">
        ${yTicks
          .map(
            (tick) => `
              <line class="curve-plot-grid" x1="${margin.left}" y1="${scaleY(tick)}" x2="${width - margin.right}" y2="${scaleY(tick)}"></line>
              <text class="curve-plot-note" x="${margin.left - 10}" y="${scaleY(tick) + 4}" text-anchor="end">${formatNumber(
                tick,
                2
              )}</text>
            `
          )
          .join("")}
        ${xTicks
          .map(
            (tick) => `
              <line class="curve-plot-grid" x1="${scaleX(tick)}" y1="${margin.top}" x2="${scaleX(tick)}" y2="${height - margin.bottom}"></line>
              <text class="curve-plot-note" x="${scaleX(tick)}" y="${height - margin.bottom + 22}" text-anchor="middle">${formatNumber(
                tick,
                0
              )}</text>
            `
          )
          .join("")}
        <line class="curve-plot-axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
        <line class="curve-plot-axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
        <path class="curve-plot-line" d="${path}"></path>
        ${standardPoints
          .map(
            (point) => `
              <circle class="curve-plot-point" cx="${scaleX(point.x)}" cy="${scaleY(point.y)}" r="5.4"></circle>
            `
          )
          .join("")}
        <text class="curve-plot-text" x="${width / 2}" y="22" text-anchor="middle">${
          escapeHtml(assayName || "ELISA standard curve")
        }</text>
        <text class="curve-plot-text" x="${width / 2}" y="${height - 12}" text-anchor="middle">Standard concentration (${escapeHtml(
          unit
        )})</text>
        <text class="curve-plot-text" transform="translate(20 ${height / 2}) rotate(-90)" text-anchor="middle">Optical density (OD)</text>
      </svg>
    `;
    element.curveCaption.textContent =
      "The plotted line is the fitted standard curve used for interpolation. The dots are the entered standards after averaging and blank correction.";
  }

  function renderResults(resultPackage) {
    const { fittedCurve, standardSummaries, standardPoints, unknownResults, unit, curveOptions, blankOd } =
      resultPackage;
    element.resultsSection.classList.remove("is-hidden");
    element.curveChoiceLabel.textContent = curveChoiceLabel();
    element.curveModelLabel.textContent = modelLabel(fittedCurve.model);
    element.curveR2.textContent = Number.isFinite(fittedCurve.r2) ? fittedCurve.r2.toFixed(4) : "—";
    element.standardsUsed.textContent = String(standardPoints.length);
    element.curveEquation.textContent = fittedCurve.equation;
    renderCurvePlot(fittedCurve, standardPoints, element.assayName.value.trim(), unit);

    element.standardsSummaryBody.innerHTML = standardSummaries
      .filter((row) => Number.isFinite(row.concentration) && Number.isFinite(row.meanOd))
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${formatNumber(row.concentration, 3)} ${escapeHtml(unit)}</td>
            <td>${formatNumber(row.meanOd, 3)}</td>
            <td>${formatNumber(row.sd, 3)}</td>
            <td>${formatNumber(row.cvPercent, 2)}</td>
          </tr>
        `
      )
      .join("");

    element.unknownResultsBody.innerHTML = unknownResults
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.sampleId)}</td>
            <td>${formatNumber(row.meanOd, 3)}</td>
            <td>${Number.isFinite(row.interpolatedConcentration) ? `${formatNumber(row.interpolatedConcentration, 3)} ${escapeHtml(unit)}` : "—"}</td>
            <td>${formatNumber(row.dilutionFactor, 2)}</td>
            <td>${Number.isFinite(row.finalConcentration) ? `${formatNumber(row.finalConcentration, 3)} ${escapeHtml(unit)}` : "—"}</td>
            <td>${escapeHtml(row.rangeFlag || "—")}</td>
          </tr>
        `
      )
      .join("");

    state.results = {
      standardSummaries,
      standardPoints,
      unknownResults,
      unit,
      fittedCurve,
      blankOd,
      curveOptions,
      assayName: element.assayName.value.trim(),
    };
    initializeStatisticsUi();
  }

  function analyzeElisa() {
    try {
      const blankOd = parseFinite(element.blankOd.value) || 0;
      const unit = (element.concentrationUnit.value || "pg/mL").trim() || "pg/mL";
      const curveOptions = getCurveOptions();
      const { summaries, points } = buildStandardDataset(blankOd);
      const fittedCurve = engine.fitCurve(points, curveOptions);
      const unknownDataset = buildUnknownDataset(blankOd);
      const unknownResults = engine.calculateUnknownConcentrations(
        unknownDataset,
        fittedCurve,
        points
      );

      renderResults({
        fittedCurve,
        standardSummaries: summaries,
        standardPoints: points,
        unknownResults,
        unit,
        curveOptions,
        blankOd,
      });
      setStatus("Standard curve generated and unknown concentrations calculated.", "success");
      element.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setStatus(error.message || "The ELISA analysis could not be generated.", "error");
    }
  }

  function initializeStatisticsUi() {
    const analyzableRows = (state.results?.unknownResults || []).map((row) => ({
      sampleId: row.sampleId,
      concentration: row.finalConcentration,
      rangeFlag: row.rangeFlag,
    }));
    state.statsUi = {
      visible: false,
      groupCount: Number(element.statsGroupCount.value || 2),
      dependent: element.statsDependent.value === "yes",
      groupNames: Array.from({ length: Number(element.statsGroupCount.value || 2) }, (_, index) => `Group ${index + 1}`),
      assignments: analyzableRows.map((row) => ({
        sampleId: row.sampleId,
        concentration: row.concentration,
        rangeFlag: row.rangeFlag,
        groupIndex: 0,
        pairId: "",
      })),
    };
    renderStatsPreview();
  }

  function renderStatsPreview() {
    const current = state.statsUi;
    if (!current) {
      element.statsMethodPreview.textContent =
        "The chosen design will determine whether the suite uses a t-test or ANOVA.";
      return;
    }
    const method = engine.chooseStatisticsMethod(current.groupCount, current.dependent);
    const labelMap = {
      "independent-t-test": "Current design: independent t-test",
      "paired-t-test": "Current design: paired t-test",
      "one-way-anova": "Current design: one-way ANOVA",
      "repeated-measures-anova": "Current design: repeated-measures one-way ANOVA",
      "No comparison": "At least two groups are required for comparison.",
    };
    element.statsMethodPreview.textContent = labelMap[method] || method;
  }

  function ensureGroupNamesLength(groupCount) {
    while (state.statsUi.groupNames.length < groupCount) {
      state.statsUi.groupNames.push(`Group ${state.statsUi.groupNames.length + 1}`);
    }
    state.statsUi.groupNames = state.statsUi.groupNames.slice(0, groupCount);
  }

  function renderStatisticsConfig() {
    if (!state.statsUi) {
      return;
    }
    const { groupCount, dependent } = state.statsUi;
    ensureGroupNamesLength(groupCount);
    element.pairColumnHeader.textContent = dependent ? "Pair / subject ID" : "Pair / subject ID (not used)";
    element.statsGroupNames.innerHTML = state.statsUi.groupNames
      .map(
        (name, index) => `
          <label class="field">
            <span>Group ${index + 1} name</span>
            <input type="text" data-group-name-index="${index}" value="${escapeHtml(name)}" />
          </label>
        `
      )
      .join("");

    element.statsAssignmentBody.innerHTML = state.statsUi.assignments
      .map(
        (assignment, index) => `
          <tr>
            <td>${escapeHtml(assignment.sampleId)}</td>
            <td>${Number.isFinite(assignment.concentration) ? formatNumber(assignment.concentration, 3) + " " + escapeHtml(state.results.unit) : "—"}</td>
            <td>
              <select data-assignment-group="${index}" ${!Number.isFinite(assignment.concentration) ? "disabled" : ""}>
                ${state.statsUi.groupNames
                  .map(
                    (groupName, optionIndex) => `
                      <option value="${optionIndex}" ${assignment.groupIndex === optionIndex ? "selected" : ""}>
                        ${escapeHtml(groupName)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </td>
            <td>
              <input
                type="text"
                data-assignment-pair="${index}"
                value="${escapeHtml(assignment.pairId)}"
                placeholder="${dependent ? "Subject 1" : "Optional"}"
                ${!dependent || !Number.isFinite(assignment.concentration) ? "disabled" : ""}
              />
            </td>
          </tr>
        `
      )
      .join("");

    renderStatsPreview();
  }

  function showStatistics() {
    if (!state.results) {
      return;
    }
    element.statisticsSection.classList.remove("is-hidden");
    state.statsUi.visible = true;
    renderStatisticsConfig();
    element.statisticsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildStatisticsGroups() {
    const current = state.statsUi;
    const groups = current.groupNames.map((name) => ({ name, values: [] }));
    current.assignments.forEach((assignment) => {
      if (!Number.isFinite(assignment.concentration)) {
        return;
      }
      if (current.dependent) {
        if (!assignment.pairId.trim()) {
          throw new Error("Each dependent sample needs a pair / subject ID.");
        }
        groups[assignment.groupIndex].values.push({
          pairId: assignment.pairId.trim(),
          value: assignment.concentration,
        });
      } else {
        groups[assignment.groupIndex].values.push(assignment.concentration);
      }
    });

    if (groups.some((group) => !group.values.length)) {
      throw new Error("Each group must contain at least one analyzable sample.");
    }
    return groups;
  }

  function renderStatsResult(statisticsResult) {
    element.statsTestName.textContent = statisticsResult.testName || "—";
    element.statsStatistic.textContent = `${statisticsResult.statisticLabel || ""} = ${formatNumber(statisticsResult.statistic, 4)}`;
    element.statsDf.textContent = statisticsResult.degreesOfFreedom ?? "—";
    element.statsPvalue.textContent = engine.formatPValue(statisticsResult.pValue);

    element.statsSummaryBody.innerHTML = (statisticsResult.summary || [])
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.n)}</td>
            <td>${formatNumber(row.mean, 3)}</td>
            <td>${formatNumber(row.sd, 3)}</td>
            <td>${formatNumber(row.sem, 3)}</td>
          </tr>
        `
      )
      .join("");

    element.methodsText.textContent = engine.buildStatisticsMethodsText({
      curveModel: state.results.fittedCurve.model,
      blankCorrection: Boolean(parseFinite(element.blankOd.value)),
      statisticsResult,
    });
  }

  function runStatistics() {
    try {
      const statisticsResult = engine.runStatisticsAnalysis({
        groups: buildStatisticsGroups(),
        isDependent: state.statsUi.dependent,
      });
      renderStatsResult(statisticsResult);
      setStatsStatus("Statistical analysis completed.", "success");
    } catch (error) {
      setStatsStatus(error.message || "Statistical analysis could not be completed.", "error");
    }
  }

  function standardsSummaryRows() {
    return (state.results?.standardSummaries || [])
      .filter((row) => Number.isFinite(row.concentration) && Number.isFinite(row.meanOd))
      .map((row) => [
        row.label,
        `${formatNumber(row.concentration, 3)} ${state.results.unit}`,
        formatNumber(row.meanOd, 3),
        formatNumber(row.sd, 3),
        formatNumber(row.cvPercent, 2),
      ]);
  }

  function unknownResultsRows() {
    return (state.results?.unknownResults || []).map((row) => [
      row.sampleId,
      formatNumber(row.meanOd, 3),
      Number.isFinite(row.interpolatedConcentration)
        ? `${formatNumber(row.interpolatedConcentration, 3)} ${state.results.unit}`
        : "—",
      formatNumber(row.dilutionFactor, 2),
      Number.isFinite(row.finalConcentration)
        ? `${formatNumber(row.finalConcentration, 3)} ${state.results.unit}`
        : "—",
      row.rangeFlag || "—",
    ]);
  }

  function statsSummaryRows() {
    return Array.from(element.statsSummaryBody.querySelectorAll("tr")).map((row) =>
      Array.from(row.children).map((cell) => cell.textContent.trim())
    );
  }

  function bindTableEditing() {
    element.standardsBody.addEventListener("input", (event) => {
      const input = event.target;
      const rowId = input.closest("tr")?.dataset.standardRow;
      if (!rowId) {
        return;
      }
      const row = state.standards.find((item) => item.id === rowId);
      if (!row) {
        return;
      }
      const field = input.dataset.standardField;
      if (field) {
        row[field] = input.value;
      }
    });

    element.unknownsBody.addEventListener("input", (event) => {
      const input = event.target;
      const rowId = input.closest("tr")?.dataset.sampleRow;
      if (!rowId) {
        return;
      }
      const row = state.unknowns.find((item) => item.id === rowId);
      if (!row) {
        return;
      }
      const field = input.dataset.sampleField;
      if (field) {
        row[field] = input.value;
      }
    });

    element.standardsBody.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-standard]");
      if (!button) {
        return;
      }
      state.standards = state.standards.filter((row) => row.id !== button.dataset.removeStandard);
      renderInputTables();
    });

    element.unknownsBody.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-sample]");
      if (!button) {
        return;
      }
      state.unknowns = state.unknowns.filter((row) => row.id !== button.dataset.removeSample);
      renderInputTables();
    });
  }

  function bindPasteImports() {
    const importUnknowns = () => {
      try {
        state.unknowns = parseUnknownsPaste(element.unknownsPaste.value);
        renderInputTables();
        hideOutputs();
        setStatus(`Imported ${state.unknowns.length} unknown sample row(s) from the pasted Excel block.`, "success");
      } catch (error) {
        setStatus(error.message || "The pasted unknown-sample block could not be imported.", "error");
      }
    };

    element.importUnknownsPaste.addEventListener("click", importUnknowns);
    element.unknownsPaste.addEventListener("paste", () => {
      window.setTimeout(() => {
        if (!element.unknownsPaste.value.trim()) {
          return;
        }
        importUnknowns();
      }, 0);
    });
  }

  function bindStatisticsEditing() {
    element.statsGroupCount.addEventListener("change", () => {
      if (!state.statsUi) {
        return;
      }
      state.statsUi.groupCount = Number(element.statsGroupCount.value || 2);
      ensureGroupNamesLength(state.statsUi.groupCount);
      state.statsUi.assignments.forEach((assignment) => {
        if (assignment.groupIndex >= state.statsUi.groupCount) {
          assignment.groupIndex = state.statsUi.groupCount - 1;
        }
      });
      renderStatisticsConfig();
    });

    element.statsDependent.addEventListener("change", () => {
      if (!state.statsUi) {
        return;
      }
      state.statsUi.dependent = element.statsDependent.value === "yes";
      renderStatisticsConfig();
    });

    element.statsGroupNames.addEventListener("input", (event) => {
      const input = event.target;
      const index = Number(input.dataset.groupNameIndex);
      if (!Number.isFinite(index) || !state.statsUi) {
        return;
      }
      state.statsUi.groupNames[index] = input.value || `Group ${index + 1}`;
    });

    element.statsGroupNames.addEventListener("change", (event) => {
      const input = event.target;
      const index = Number(input.dataset.groupNameIndex);
      if (!Number.isFinite(index) || !state.statsUi) {
        return;
      }
      state.statsUi.groupNames[index] = input.value || `Group ${index + 1}`;
      renderStatisticsConfig();
    });

    element.statsAssignmentBody.addEventListener("change", (event) => {
      const target = event.target;
      if (!state.statsUi) {
        return;
      }
      if (target.dataset.assignmentGroup) {
        const index = Number(target.dataset.assignmentGroup);
        state.statsUi.assignments[index].groupIndex = Number(target.value || 0);
      }
      if (target.dataset.assignmentPair) {
        const index = Number(target.dataset.assignmentPair);
        state.statsUi.assignments[index].pairId = target.value;
      }
    });

    element.statsAssignmentBody.addEventListener("input", (event) => {
      const target = event.target;
      if (!state.statsUi || !target.dataset.assignmentPair) {
        return;
      }
      const index = Number(target.dataset.assignmentPair);
      state.statsUi.assignments[index].pairId = target.value;
    });
  }

  function bindExports() {
    element.copyStandardsTable.addEventListener("click", async () => {
      await copyText(createTableTsv(
        ["Standard", "Concentration", "Mean corrected OD", "SD", "CV (%)"],
        standardsSummaryRows()
      ));
    });

    element.exportStandardsTable.addEventListener("click", () => {
      downloadCsv(
        ["Standard", "Concentration", "Mean corrected OD", "SD", "CV (%)"],
        standardsSummaryRows(),
        "wahj_elisa_standards.csv"
      );
    });

    element.copyResultsTable.addEventListener("click", async () => {
      await copyText(createTableTsv(
        [
          "Sample ID",
          "Mean corrected OD",
          "Interpolated concentration",
          "Dilution factor",
          "Final concentration",
          "Range flag",
        ],
        unknownResultsRows()
      ));
    });

    element.exportResultsTable.addEventListener("click", () => {
      downloadCsv(
        [
          "Sample ID",
          "Mean corrected OD",
          "Interpolated concentration",
          "Dilution factor",
          "Final concentration",
          "Range flag",
        ],
        unknownResultsRows(),
        "wahj_elisa_unknown_results.csv"
      );
    });

    element.copyStatsTable.addEventListener("click", async () => {
      await copyText(createTableTsv(["Group", "n", "Mean", "SD", "SEM"], statsSummaryRows()));
    });

    element.exportStatsTable.addEventListener("click", () => {
      downloadCsv(
        ["Group", "n", "Mean", "SD", "SEM"],
        statsSummaryRows(),
        "wahj_elisa_statistics_summary.csv"
      );
    });

    element.copyMethodsText.addEventListener("click", async () => {
      await copyText(element.methodsText.textContent.trim());
    });
  }

  function addStandardRow() {
    state.standards.push({
      id: createId("standard"),
      label: `S${state.standards.length + 1}`,
      concentration: "",
      od1: "",
      od2: "",
      od3: "",
    });
    renderInputTables();
  }

  function addSampleRow() {
    state.unknowns.push({
      id: createId("sample"),
      sampleId: `Sample ${state.unknowns.length + 1}`,
      dilutionFactor: "1",
      od1: "",
      od2: "",
      od3: "",
    });
    renderInputTables();
  }

  function clearAll() {
    resetState();
    renderInputTables();
    hideOutputs();
    element.unknownsPaste.value = "";
    element.assayName.value = "";
    element.blankOd.value = "";
    element.concentrationUnit.value = "pg/mL";
    document.querySelector('input[name="signal-direction"][value="increasing"]').checked = true;
    document.querySelector('input[name="curve-preset"][value="curved"]').checked = true;
    document.querySelector("#use-five-parameter").checked = false;
    setStatus("The ELISA tables were reset.", "success");
  }

  function init() {
    resetState();
    renderInputTables();
    bindTableEditing();
    bindPasteImports();
    bindStatisticsEditing();
    bindExports();

    element.addStandardRow.addEventListener("click", addStandardRow);
    element.addSampleRow.addEventListener("click", addSampleRow);
    element.calculateButton.addEventListener("click", analyzeElisa);
    element.clearButton.addEventListener("click", clearAll);
    element.loadExampleButton.addEventListener("click", loadPracticeExample);
    element.showStatisticsButton.addEventListener("click", showStatistics);
    element.runStatistics.addEventListener("click", runStatistics);

    renderStatsPreview();
  }

  init();
})(window);
