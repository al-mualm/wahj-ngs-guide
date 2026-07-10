(function initializeLocalNgsWorkbench() {
  const config = window.WAHJ_NGS_CONFIG || {};
  const apiUrl = (config.localNgsApiUrl || "http://127.0.0.1:8787").replace(/\/$/, "");
  const elements = {
    apiUrlLabel: document.querySelector("#api-url-label"),
    checkServerButton: document.querySelector("#check-server-button"),
    serverStatus: document.querySelector("#server-status"),
    organismSelect: document.querySelector("#organism-select"),
    referenceDetail: document.querySelector("#reference-detail"),
    uploadDropzone: document.querySelector("#upload-dropzone"),
    fastqFiles: document.querySelector("#fastq-files"),
    selectedFiles: document.querySelector("#selected-files"),
    read1Path: document.querySelector("#read1-path"),
    read2Path: document.querySelector("#read2-path"),
    submitJobButton: document.querySelector("#submit-job-button"),
    jobId: document.querySelector("#job-id"),
    refreshJobButton: document.querySelector("#refresh-job-button"),
    loadReportButton: document.querySelector("#load-report-button"),
    jobStatus: document.querySelector("#job-status"),
  };
  let organisms = [];
  let selectedRead1File = null;
  let selectedRead2File = null;
  let pollTimer = null;

  function pretty(value) {
    return JSON.stringify(value, null, 2);
  }

  function setText(element, value) {
    element.textContent = typeof value === "string" ? value : pretty(value);
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes > 1024 * 1024 * 1024) {
      return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GiB`;
    }
    if (bytes > 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
    }
    return `${bytes.toLocaleString()} bytes`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizePathInput(value) {
    let text = String(value || "").trim();
    while (
      text.length >= 2 &&
      text[0] === text[text.length - 1] &&
      (text[0] === "'" || text[0] === '"')
    ) {
      text = text.slice(1, -1).trim();
    }
    return text;
  }

  function isRead2Name(name) {
    return /(^|[._-])r?2([._-]|$)/i.test(name) || /_2\.f(ast)?q/i.test(name);
  }

  function isRead1Name(name) {
    return /(^|[._-])r?1([._-]|$)/i.test(name) || /_1\.f(ast)?q/i.test(name);
  }

  function renderSelectedFiles() {
    if (!selectedRead1File && !selectedRead2File) {
      elements.selectedFiles.textContent = "No FASTQ files selected.";
      return;
    }
    const lines = [];
    if (selectedRead1File) {
      lines.push(`Read 1: ${selectedRead1File.name} (${formatBytes(selectedRead1File.size)})`);
    }
    if (selectedRead2File) {
      lines.push(`Read 2: ${selectedRead2File.name} (${formatBytes(selectedRead2File.size)})`);
    }
    elements.selectedFiles.textContent = lines.join("\n");
  }

  function assignFastqFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) {
      return;
    }
    selectedRead1File = files.find((file) => isRead1Name(file.name)) || files[0];
    selectedRead2File =
      files.find((file) => file !== selectedRead1File && isRead2Name(file.name)) ||
      files.find((file) => file !== selectedRead1File) ||
      null;
    renderSelectedFiles();
  }

  async function request(path, options = {}) {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `Request failed with status ${response.status}`);
    }
    return payload;
  }

  function renderOrganisms() {
    elements.organismSelect.innerHTML =
      '<option value="">Select organism</option>' +
      organisms
        .map(
          (organism) =>
            `<option value="${escapeHtml(organism.id)}">${escapeHtml(
              organism.speciesName || organism.label
            )}</option>`
        )
        .join("");
  }

  function selectedOrganism() {
    return organisms.find((organism) => organism.id === elements.organismSelect.value);
  }

  function renderReferenceDetail() {
    const organism = selectedOrganism();
    if (!organism) {
      elements.referenceDetail.textContent = "Select an organism to see the chosen complete reference.";
      return;
    }
    const defaults = organism.analysisDefaults || {};
    elements.referenceDetail.innerHTML = `
      <strong>${escapeHtml(organism.speciesName || organism.label)}</strong><br>
      <span>Reference: ${escapeHtml(organism.referenceName || "complete genome")}</span><br>
      <span>Size: ${escapeHtml(formatBytes(organism.sizeBytes))}</span><br>
      <span>Workflow: ${escapeHtml(defaults.qualityControl || "fastp")} -> ${escapeHtml(
        defaults.aligner || "bwa mem"
      )} -> ${escapeHtml(defaults.postAlignment || "samtools statistics")}</span>
    `;
  }

  function renderServerStatus(health, loadedOrganisms) {
    const tools = health.tools || {};
    const availableTools = Object.keys(tools).filter((name) => tools[name]);
    setText(
      elements.serverStatus,
      `Local server ready.\nComplete organisms loaded: ${loadedOrganisms}\nAnalysis tools: ${availableTools.join(
        ", "
      )}\nJobs folder: ${health.jobRoot}`
    );
  }

  async function checkServer() {
    setText(elements.serverStatus, "Checking local server...");
    try {
      const health = await request("/api/health");
      const referencePayload = await request("/api/references");
      organisms = referencePayload.organisms || referencePayload.references || [];
      renderOrganisms();
      renderReferenceDetail();
      renderServerStatus(health, organisms.length);
    } catch (error) {
      setText(
        elements.serverStatus,
        `Could not reach ${apiUrl}.\n\nStart the backend with:\npython3 local-ngs-server/server.py\n\n${error.message}`
          + `\n\nIf this page is open from GitHub Pages, use the local workbench instead:\nhttp://127.0.0.1:8787/local-ngs-workbench/`
      );
    }
  }

  async function submitJob() {
    const organism = selectedOrganism();
    if (!organism) {
      setText(elements.jobStatus, "Select an organism first.");
      return;
    }
    if (selectedRead1File) {
      uploadAndSubmitJob(organism);
      return;
    }
    if (!elements.read1Path.value.trim()) {
      setText(elements.jobStatus, "Drop a FASTQ file or enter a FASTQ path.");
      return;
    }
    submitPathJob(organism);
  }

  async function submitPathJob(organism) {
    const read1Path = normalizePathInput(elements.read1Path.value);
    const read2Path = normalizePathInput(elements.read2Path.value);
    elements.read1Path.value = read1Path;
    elements.read2Path.value = read2Path;
    const payload = {
      organismId: organism.id,
      read1Path,
      read2Path,
    };
    setText(elements.jobStatus, "Submitting job...");
    try {
      const job = await request("/api/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      elements.jobId.value = job.jobId;
      setText(elements.jobStatus, job);
      startPolling(job.jobId);
    } catch (error) {
      setText(elements.jobStatus, `Job submission failed:\n${error.message}`);
    }
  }

  function uploadAndSubmitJob(organism) {
    const formData = new FormData();
    formData.append("organismId", organism.id);
    formData.append("read1File", selectedRead1File, selectedRead1File.name);
    if (selectedRead2File) {
      formData.append("read2File", selectedRead2File, selectedRead2File.name);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiUrl}/api/jobs/upload`);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = ((event.loaded / event.total) * 100).toFixed(1);
        setText(elements.jobStatus, `Uploading FASTQ files... ${percent}%`);
      } else {
        setText(elements.jobStatus, "Uploading FASTQ files...");
      }
    });
    xhr.addEventListener("load", () => {
      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch (error) {
        setText(elements.jobStatus, `Upload failed:\n${xhr.responseText || error.message}`);
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        setText(elements.jobStatus, `Upload failed:\n${payload.error || xhr.statusText}`);
        return;
      }
      elements.jobId.value = payload.jobId;
      setText(elements.jobStatus, payload);
      startPolling(payload.jobId);
    });
    xhr.addEventListener("error", () => {
      setText(elements.jobStatus, "Upload failed. Check that the local backend is still running.");
    });
    setText(elements.jobStatus, "Uploading FASTQ files...");
    xhr.send(formData);
  }

  async function refreshJob(loadReport = false) {
    const jobId = elements.jobId.value.trim();
    if (!jobId) {
      setText(elements.jobStatus, "Enter a job ID.");
      return;
    }
    try {
      const payload = await request(`/api/jobs/${encodeURIComponent(jobId)}${loadReport ? "?report=1" : ""}`);
      setText(elements.jobStatus, payload);
      if (payload.state === "completed" || payload.state === "failed") {
        stopPolling();
      }
    } catch (error) {
      setText(elements.jobStatus, `Could not load job:\n${error.message}`);
      stopPolling();
    }
  }

  function startPolling(jobId) {
    stopPolling();
    pollTimer = window.setInterval(() => {
      if (elements.jobId.value.trim() === jobId) {
        refreshJob(false);
      }
    }, 5000);
  }

  function stopPolling() {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  elements.apiUrlLabel.textContent = apiUrl;
  elements.checkServerButton.addEventListener("click", checkServer);
  elements.organismSelect.addEventListener("change", renderReferenceDetail);
  elements.fastqFiles.addEventListener("change", () => assignFastqFiles(elements.fastqFiles.files));
  elements.uploadDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.uploadDropzone.classList.add("is-dragging");
  });
  elements.uploadDropzone.addEventListener("dragleave", () => {
    elements.uploadDropzone.classList.remove("is-dragging");
  });
  elements.uploadDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.uploadDropzone.classList.remove("is-dragging");
    assignFastqFiles(event.dataTransfer.files);
  });
  elements.submitJobButton.addEventListener("click", submitJob);
  elements.refreshJobButton.addEventListener("click", () => refreshJob(false));
  elements.loadReportButton.addEventListener("click", () => refreshJob(true));
  checkServer();
})();
