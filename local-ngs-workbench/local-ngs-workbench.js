(function initializeLocalNgsWorkbench() {
  const config = window.WAHJ_NGS_CONFIG || {};
  const apiUrl = (config.localNgsApiUrl || "http://127.0.0.1:8787").replace(/\/$/, "");
  const elements = {
    apiUrlLabel: document.querySelector("#api-url-label"),
    checkServerButton: document.querySelector("#check-server-button"),
    serverStatus: document.querySelector("#server-status"),
    referenceSelect: document.querySelector("#reference-select"),
    referenceDetail: document.querySelector("#reference-detail"),
    read1Path: document.querySelector("#read1-path"),
    read2Path: document.querySelector("#read2-path"),
    runFastp: document.querySelector("#run-fastp"),
    threads: document.querySelector("#threads"),
    submitJobButton: document.querySelector("#submit-job-button"),
    jobId: document.querySelector("#job-id"),
    refreshJobButton: document.querySelector("#refresh-job-button"),
    loadReportButton: document.querySelector("#load-report-button"),
    jobStatus: document.querySelector("#job-status"),
  };
  let references = [];
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

  function renderReferences() {
    elements.referenceSelect.innerHTML =
      '<option value="">Select a reference genome</option>' +
      references
        .map(
          (reference) =>
            `<option value="${escapeHtml(reference.id)}">${escapeHtml(reference.kind)}: ${escapeHtml(
              reference.label
            )}</option>`
        )
        .join("");
  }

  function selectedReference() {
    return references.find((reference) => reference.id === elements.referenceSelect.value);
  }

  function renderReferenceDetail() {
    const reference = selectedReference();
    if (!reference) {
      elements.referenceDetail.textContent = "No reference selected.";
      return;
    }
    elements.referenceDetail.innerHTML = `
      <strong>${escapeHtml(reference.label)}</strong><br>
      <span>Size: ${escapeHtml(formatBytes(reference.sizeBytes))}</span><br>
      <span>BWA index: ${reference.bwaIndexReady ? "ready" : "missing"}</span><br>
      <span>FAI: ${reference.faiReady ? "ready" : "will be created if needed"}</span><br>
      <span>Annotation: ${escapeHtml(reference.annotationPath || "not detected")}</span><br>
      <code>${escapeHtml(reference.path)}</code>
    `;
  }

  async function checkServer() {
    setText(elements.serverStatus, "Checking local server...");
    try {
      const health = await request("/api/health");
      const referencePayload = await request("/api/references");
      references = referencePayload.references || [];
      renderReferences();
      setText(elements.serverStatus, {
        ...health,
        loadedReferences: references.length,
      });
    } catch (error) {
      setText(
        elements.serverStatus,
        `Could not reach ${apiUrl}.\n\nStart the backend with:\npython3 local-ngs-server/server.py\n\n${error.message}`
          + `\n\nIf this page is open from GitHub Pages, use the local workbench instead:\nhttp://127.0.0.1:8787/local-ngs-workbench/`
      );
    }
  }

  async function submitJob() {
    const reference = selectedReference();
    if (!reference) {
      setText(elements.jobStatus, "Select a reference first.");
      return;
    }
    if (!elements.read1Path.value.trim()) {
      setText(elements.jobStatus, "Enter the Read 1 FASTQ path.");
      return;
    }
    const payload = {
      referenceId: reference.id,
      read1Path: elements.read1Path.value.trim(),
      read2Path: elements.read2Path.value.trim(),
      runFastp: elements.runFastp.checked,
      threads: Number(elements.threads.value || 4),
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
  elements.referenceSelect.addEventListener("change", renderReferenceDetail);
  elements.submitJobButton.addEventListener("click", submitJob);
  elements.refreshJobButton.addEventListener("click", () => refreshJob(false));
  elements.loadReportButton.addEventListener("click", () => refreshJob(true));
  checkServer();
})();
