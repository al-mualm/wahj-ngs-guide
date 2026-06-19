(function initializeFastqAnalyzer() {
  const core = window.FastqAnalyzerCore;
  if (!core) {
    return;
  }

  const elements = {
    fileInput: document.querySelector("#fastq-files"),
    dropzone: document.querySelector("#fastq-dropzone"),
    fileList: document.querySelector("#fastq-file-list"),
    qualityOffset: document.querySelector("#quality-offset"),
    maxRecords: document.querySelector("#max-records"),
    analyzeButton: document.querySelector("#analyze-fastq-button"),
    demoButton: document.querySelector("#load-demo-button"),
    resetButton: document.querySelector("#reset-fastq-button"),
    status: document.querySelector("#fastq-status"),
    metricGrid: document.querySelector("#fastq-metric-grid"),
    warningList: document.querySelector("#fastq-warning-list"),
    fileSummaryBody: document.querySelector("#fastq-file-summary-body"),
    overrepresentedBody: document.querySelector("#overrepresented-body"),
    adapterBody: document.querySelector("#adapter-body"),
    reportPreview: document.querySelector("#fastq-report-preview"),
    csvButton: document.querySelector("#download-csv-button"),
    jsonButton: document.querySelector("#download-json-button"),
    reportButton: document.querySelector("#download-report-button"),
    qualityCycleChart: document.querySelector("#quality-cycle-chart"),
    baseCompositionChart: document.querySelector("#base-composition-chart"),
    lengthDistributionChart: document.querySelector("#length-distribution-chart"),
    gcDistributionChart: document.querySelector("#gc-distribution-chart"),
  };

  let currentResult = null;

  function formatInteger(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatDecimal(value, digits = 2) {
    return Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: digits,
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setStatus(message, tone = "") {
    elements.status.textContent = message;
    elements.status.classList.remove("is-success", "is-warning", "is-error");
    if (tone) {
      elements.status.classList.add(`is-${tone}`);
    }
  }

  function setBusy(isBusy) {
    elements.analyzeButton.disabled = isBusy;
    elements.demoButton.disabled = isBusy;
    elements.resetButton.disabled = isBusy;
    elements.analyzeButton.textContent = isBusy ? "Analyzing..." : "Analyze FASTQ";
  }

  function setExportEnabled(enabled) {
    elements.csvButton.disabled = !enabled;
    elements.jsonButton.disabled = !enabled;
    elements.reportButton.disabled = !enabled;
  }

  function updateFileList() {
    const files = Array.from(elements.fileInput.files || []);
    if (!files.length) {
      elements.fileList.textContent = "No FASTQ files selected.";
      return;
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    elements.fileList.innerHTML = `${files.length} file${files.length === 1 ? "" : "s"} selected, ${formatInteger(
      totalBytes
    )} bytes total:<br>${files.map((file) => escapeHtml(file.name)).join("<br>")}`;
  }

  function isGzipBuffer(file, buffer) {
    const bytes = new Uint8Array(buffer.slice(0, 2));
    return /\.gz$/i.test(file.name) || (bytes[0] === 0x1f && bytes[1] === 0x8b);
  }

  async function readFileAsText(file) {
    const buffer = await file.arrayBuffer();
    if (isGzipBuffer(file, buffer)) {
      if (typeof DecompressionStream !== "function") {
        throw new Error(
          `${file.name} appears to be gzip-compressed, but this browser does not support built-in gzip decompression.`
        );
      }
      const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
      return new Response(stream).text();
    }
    return new TextDecoder().decode(buffer);
  }

  function getAnalysisOptions() {
    const maxRecordsValue = Number(elements.maxRecords.value || 0);
    return {
      qualityOffset: elements.qualityOffset.value,
      maxRecords: Number.isFinite(maxRecordsValue) && maxRecordsValue > 0 ? maxRecordsValue : 0,
      maxTrackedSequences: 20000,
    };
  }

  async function analyzeSelectedFiles() {
    const files = Array.from(elements.fileInput.files || []);
    if (!files.length) {
      setStatus("Select at least one FASTQ file or load the demo data.", "warning");
      return;
    }

    setBusy(true);
    setStatus(`Reading ${files.length} FASTQ file${files.length === 1 ? "" : "s"}...`);

    try {
      const inputs = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setStatus(`Reading ${file.name} (${index + 1}/${files.length})...`);
        inputs.push({
          fileName: file.name,
          text: await readFileAsText(file),
        });
      }

      setStatus("Calculating FASTQ QC metrics...");
      currentResult = core.analyzeFastqTexts(inputs, getAnalysisOptions());
      renderResults(currentResult);
      setStatus("FASTQ analysis complete.", currentResult.overall.status === "fail" ? "error" : currentResult.overall.status === "warn" ? "warning" : "success");
    } catch (error) {
      console.error(error);
      setStatus(error.message || "FASTQ analysis failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  function makeDemoFastq(fileName, readCount, options = {}) {
    const reads = [];
    const adapter = "AGATCGGAAGAGC";
    const template =
      options.template ||
      "ACGTGCTAGCTAGGCTAATCGGATCGTACCGATGCTAGCATCGATCGGCTAGCTAAGCTTGATCGATGCTA";
    for (let index = 0; index < readCount; index += 1) {
      const shift = index % 17;
      const length = 68 + (index % 12);
      let sequence = (template.slice(shift) + template.slice(0, shift)).slice(0, length);
      if (index % 31 === 0) {
        sequence = `${sequence.slice(0, Math.max(0, length - adapter.length))}${adapter}`;
      }
      if (index % 43 === 0) {
        sequence = `${sequence.slice(0, 12)}NNN${sequence.slice(15)}`;
      }
      const qualities = Array.from(sequence).map((_, cycle) => {
        const baseQ = options.quality || 34;
        const q = Math.max(8, Math.min(40, baseQ - Math.floor(cycle / 30) - (index % 9 === 0 ? 10 : 0)));
        return String.fromCharCode(33 + q);
      });
      reads.push(`@${fileName}_read_${index + 1}`, sequence, "+", qualities.join(""));
    }
    return reads.join("\n");
  }

  function loadDemoData() {
    currentResult = core.analyzeFastqTexts(
      [
        {
          fileName: "demo_sample_R1.fastq",
          text: makeDemoFastq("demo_R1", 180, { quality: 35 }),
        },
        {
          fileName: "demo_sample_R2.fastq",
          text: makeDemoFastq("demo_R2", 180, {
            quality: 31,
            template:
              "TGCAGGATCCGATCGATTCGATGGCATCGATCGTAGGCTAGCTAGCTACCGATCGATGCTAGCTAGCAT",
          }),
        },
      ],
      getAnalysisOptions()
    );
    renderResults(currentResult);
    setStatus("Demo FASTQ analysis loaded.", "success");
  }

  function renderMetricCards(result) {
    const metrics = result.overall.metrics;
    const cards = [
      {
        label: "Reads",
        value: formatInteger(metrics.reads),
        note: `${result.files.length} file${result.files.length === 1 ? "" : "s"}`,
      },
      {
        label: "Bases",
        value: formatInteger(metrics.bases),
        note: `Mean length ${formatDecimal(metrics.meanReadLength)} bp`,
      },
      {
        label: "Mean Q",
        value: `Q${formatDecimal(metrics.meanQuality)}`,
        note: `${formatDecimal(metrics.q20Pct)}% Q20 bases`,
      },
      {
        label: "Q30 bases",
        value: `${formatDecimal(metrics.q30Pct)}%`,
        note: `${formatDecimal(metrics.gcPct)}% GC, ${formatDecimal(metrics.nPct)}% N`,
      },
      {
        label: "Read length",
        value: `${formatInteger(metrics.minReadLength)}-${formatInteger(metrics.maxReadLength)}`,
        note: `SD ${formatDecimal(metrics.readLengthSd)} bp`,
      },
      {
        label: "Adapter signal",
        value: `${formatDecimal(metrics.readsWithAdapterPct)}%`,
        note: "Reads with adapter-like sequence",
      },
      {
        label: "Encoding",
        value: result.overall.encoding.label,
        note: `ASCII ${result.overall.encoding.minAscii}-${result.overall.encoding.maxAscii}`,
      },
      {
        label: "Status",
        value: result.overall.status.toUpperCase(),
        note: "Overall QC flag",
      },
    ];

    elements.metricGrid.innerHTML = cards
      .map(
        (card) => `
          <article class="fastq-metric-card">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.value)}</strong>
            <small>${escapeHtml(card.note)}</small>
          </article>
        `
      )
      .join("");
  }

  function renderWarnings(result) {
    const warnings = result.overall.warnings;
    if (!warnings.length) {
      elements.warningList.innerHTML =
        '<li data-severity="pass">No major FASTQ QC warnings were detected.</li>';
      return;
    }

    elements.warningList.innerHTML = warnings
      .map(
        (warning) =>
          `<li data-severity="${escapeHtml(warning.severity)}">${escapeHtml(warning.message)}</li>`
      )
      .join("");
  }

  function renderFileSummary(result) {
    if (!result.files.length) {
      elements.fileSummaryBody.innerHTML = '<tr><td colspan="7">No FASTQ files were analyzed.</td></tr>';
      return;
    }

    elements.fileSummaryBody.innerHTML = result.files
      .map((file) => {
        const metrics = file.metrics;
        return `
          <tr>
            <td>${escapeHtml(file.label)}</td>
            <td><span class="fastq-status-pill" data-status="${escapeHtml(file.status)}">${escapeHtml(
          file.status.toUpperCase()
        )}</span></td>
            <td>${formatInteger(metrics.reads)}</td>
            <td>${formatDecimal(metrics.meanReadLength)}</td>
            <td>${formatDecimal(metrics.gcPct)}</td>
            <td>Q${formatDecimal(metrics.meanQuality)}</td>
            <td>${formatDecimal(metrics.q30Pct)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderOverrepresented(result) {
    const rows = result.overall.overrepresentedSequences;
    if (!rows.length) {
      elements.overrepresentedBody.innerHTML =
        '<tr><td colspan="4">No repeated sequence exceeded the reporting threshold.</td></tr>';
      return;
    }

    elements.overrepresentedBody.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td><code>${escapeHtml(row.sequence)}</code></td>
            <td>${formatInteger(row.length)}</td>
            <td>${formatInteger(row.count)}</td>
            <td>${formatDecimal(row.pct)}</td>
          </tr>
        `
      )
      .join("");
  }

  function renderAdapters(result) {
    const rows = result.overall.adapterHits;
    if (!rows.length) {
      elements.adapterBody.innerHTML =
        '<tr><td colspan="3">No adapter-like sequence was detected.</td></tr>';
      return;
    }

    elements.adapterBody.innerHTML = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.name)}</td>
            <td>${formatInteger(row.count)}</td>
            <td>${formatDecimal(row.pct)}</td>
          </tr>
        `
      )
      .join("");
  }

  function setupCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width || canvas.width);
    const height = Math.max(220, rect.height || canvas.height);
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    const context = canvas.getContext("2d");
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    return {
      context,
      width,
      height,
      plot: {
        left: 48,
        right: width - 18,
        top: 20,
        bottom: height - 38,
      },
    };
  }

  function drawAxes(context, plot, yLabel, maxY) {
    context.strokeStyle = "#d5e0e7";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(plot.left, plot.top);
    context.lineTo(plot.left, plot.bottom);
    context.lineTo(plot.right, plot.bottom);
    context.stroke();
    context.fillStyle = "#60758a";
    context.font = "12px Avenir Next, Segoe UI, sans-serif";
    context.fillText(yLabel, plot.left, 13);
    context.fillText(String(maxY), 8, plot.top + 4);
    context.fillText("0", 24, plot.bottom);
  }

  function drawEmptyChart(canvas, message) {
    const { context, width, height } = setupCanvas(canvas);
    context.fillStyle = "#60758a";
    context.font = "14px Avenir Next, Segoe UI, sans-serif";
    context.textAlign = "center";
    context.fillText(message, width / 2, height / 2);
  }

  function drawLineChart(canvas, rows, series, options = {}) {
    if (!rows.length) {
      drawEmptyChart(canvas, "Run an analysis to draw this chart.");
      return;
    }

    const { context, width, plot } = setupCanvas(canvas);
    const maxY = options.maxY || Math.max(...rows.flatMap((row) => series.map((item) => Number(row[item.key] || 0))), 1);
    const minX = rows[0].cycle || 1;
    const maxX = rows[rows.length - 1].cycle || rows.length;
    const xScale = (value) =>
      plot.left + ((value - minX) / Math.max(1, maxX - minX)) * (plot.right - plot.left);
    const yScale = (value) => plot.bottom - (Number(value || 0) / maxY) * (plot.bottom - plot.top);

    drawAxes(context, plot, options.yLabel || "", maxY);
    context.textAlign = "left";

    series.forEach((item) => {
      context.strokeStyle = item.color;
      context.lineWidth = 2;
      context.beginPath();
      rows.forEach((row, index) => {
        const x = xScale(row.cycle || index + 1);
        const y = yScale(row[item.key]);
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.stroke();
    });

    let legendX = plot.left;
    series.forEach((item) => {
      context.fillStyle = item.color;
      context.fillRect(legendX, plot.bottom + 18, 10, 10);
      context.fillStyle = "#365168";
      context.font = "12px Avenir Next, Segoe UI, sans-serif";
      context.fillText(item.label, legendX + 14, plot.bottom + 27);
      legendX += Math.min(120, item.label.length * 8 + 34);
      if (legendX > width - 100) {
        legendX = plot.left;
      }
    });
  }

  function drawBarChart(canvas, rows, options = {}) {
    if (!rows.length) {
      drawEmptyChart(canvas, "Run an analysis to draw this chart.");
      return;
    }

    const { context, plot } = setupCanvas(canvas);
    const maxY = Math.max(...rows.map((row) => row.count), 1);
    const barGap = 3;
    const barWidth = Math.max(3, (plot.right - plot.left) / rows.length - barGap);
    drawAxes(context, plot, options.yLabel || "Reads", maxY);

    rows.forEach((row, index) => {
      const x = plot.left + index * (barWidth + barGap);
      const height = (row.count / maxY) * (plot.bottom - plot.top);
      context.fillStyle = options.color || "#2f95b8";
      context.fillRect(x, plot.bottom - height, barWidth, height);
    });

    context.fillStyle = "#60758a";
    context.font = "11px Avenir Next, Segoe UI, sans-serif";
    context.textAlign = "left";
    context.fillText(rows[0].label, plot.left, plot.bottom + 24);
    context.textAlign = "right";
    context.fillText(rows[rows.length - 1].label, plot.right, plot.bottom + 24);
  }

  function renderCharts(result) {
    const cycleRows = result.overall.perCycle;
    drawLineChart(
      elements.qualityCycleChart,
      cycleRows,
      [
        {
          key: "meanQ",
          label: "Mean Q",
          color: "#184f67",
        },
      ],
      {
        maxY: 45,
        yLabel: "Q score",
      }
    );

    drawLineChart(
      elements.baseCompositionChart,
      cycleRows,
      [
        { key: "APct", label: "A", color: "#2f95b8" },
        { key: "CPct", label: "C", color: "#3f8968" },
        { key: "GPct", label: "G", color: "#c7a860" },
        { key: "TPct", label: "T", color: "#c96a58" },
        { key: "NPct", label: "N", color: "#6b7280" },
      ],
      {
        maxY: 100,
        yLabel: "% bases",
      }
    );

    drawBarChart(elements.lengthDistributionChart, result.overall.lengthDistribution, {
      yLabel: "Reads",
      color: "#3f8968",
    });

    drawBarChart(elements.gcDistributionChart, result.overall.gcDistribution, {
      yLabel: "Reads",
      color: "#c96a58",
    });
  }

  function renderReport(result) {
    elements.reportPreview.textContent = core.buildTextReport(result);
  }

  function renderResults(result) {
    renderMetricCards(result);
    renderWarnings(result);
    renderFileSummary(result);
    renderOverrepresented(result);
    renderAdapters(result);
    renderCharts(result);
    renderReport(result);
    setExportEnabled(true);
  }

  function resetResults() {
    currentResult = null;
    elements.fileInput.value = "";
    updateFileList();
    elements.metricGrid.innerHTML = `
      <article class="fastq-metric-card"><span>Reads</span><strong>—</strong></article>
      <article class="fastq-metric-card"><span>Bases</span><strong>—</strong></article>
      <article class="fastq-metric-card"><span>Mean Q</span><strong>—</strong></article>
      <article class="fastq-metric-card"><span>Q30 bases</span><strong>—</strong></article>
    `;
    elements.warningList.innerHTML = "<li>No analysis has been run yet.</li>";
    elements.fileSummaryBody.innerHTML = '<tr><td colspan="7">Run an analysis to populate the table.</td></tr>';
    elements.overrepresentedBody.innerHTML = '<tr><td colspan="4">No analysis has been run yet.</td></tr>';
    elements.adapterBody.innerHTML = '<tr><td colspan="3">No analysis has been run yet.</td></tr>';
    elements.reportPreview.textContent = "Run an analysis to generate a report.";
    setExportEnabled(false);
    drawEmptyChart(elements.qualityCycleChart, "Run an analysis to draw this chart.");
    drawEmptyChart(elements.baseCompositionChart, "Run an analysis to draw this chart.");
    drawEmptyChart(elements.lengthDistributionChart, "Run an analysis to draw this chart.");
    drawEmptyChart(elements.gcDistributionChart, "Run an analysis to draw this chart.");
    setStatus("Waiting for FASTQ files.");
  }

  function downloadText(filename, mimeType, text) {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function bindEvents() {
    elements.fileInput.addEventListener("change", updateFileList);
    elements.analyzeButton.addEventListener("click", analyzeSelectedFiles);
    elements.demoButton.addEventListener("click", loadDemoData);
    elements.resetButton.addEventListener("click", resetResults);

    elements.dropzone.addEventListener("dragover", (event) => {
      event.preventDefault();
      elements.dropzone.classList.add("is-dragover");
    });

    elements.dropzone.addEventListener("dragleave", () => {
      elements.dropzone.classList.remove("is-dragover");
    });

    elements.dropzone.addEventListener("drop", (event) => {
      event.preventDefault();
      elements.dropzone.classList.remove("is-dragover");
      if (event.dataTransfer.files.length) {
        elements.fileInput.files = event.dataTransfer.files;
        updateFileList();
      }
    });

    elements.csvButton.addEventListener("click", () => {
      if (!currentResult) {
        return;
      }
      downloadText("fastq_qc_summary.csv", "text/csv", core.buildSummaryCsv(currentResult));
    });

    elements.jsonButton.addEventListener("click", () => {
      if (!currentResult) {
        return;
      }
      downloadText(
        "fastq_qc_analysis.json",
        "application/json",
        JSON.stringify(currentResult, null, 2)
      );
    });

    elements.reportButton.addEventListener("click", () => {
      if (!currentResult) {
        return;
      }
      downloadText("fastq_qc_report.txt", "text/plain", core.buildTextReport(currentResult));
    });

    window.addEventListener("resize", () => {
      if (currentResult) {
        renderCharts(currentResult);
      } else {
        drawEmptyChart(elements.qualityCycleChart, "Run an analysis to draw this chart.");
        drawEmptyChart(elements.baseCompositionChart, "Run an analysis to draw this chart.");
        drawEmptyChart(elements.lengthDistributionChart, "Run an analysis to draw this chart.");
        drawEmptyChart(elements.gcDistributionChart, "Run an analysis to draw this chart.");
      }
    });
  }

  bindEvents();
  resetResults();
})();
