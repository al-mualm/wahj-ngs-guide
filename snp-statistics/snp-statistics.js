(function (windowObject) {
  const core = windowObject.WahjGeneticsToolsCore;
  if (!core) {
    return;
  }

  function formatNumber(value, digits = 4) {
    if (!Number.isFinite(value)) {
      return "—";
    }
    return Number(value).toFixed(digits);
  }

  function formatFrequency(value) {
    if (!Number.isFinite(value)) {
      return "—";
    }
    return `${(value * 100).toFixed(2)}%`;
  }

  function formatPValue(value) {
    if (!Number.isFinite(value)) {
      return "—";
    }
    if (value < 0.0001) {
      return "< 0.0001";
    }
    return value.toFixed(4);
  }

  function setStatus(statusNode, message, tone) {
    statusNode.textContent = message || "";
    statusNode.classList.remove("is-error", "is-success");
    if (tone === "error") {
      statusNode.classList.add("is-error");
    }
    if (tone === "success") {
      statusNode.classList.add("is-success");
    }
  }

  function summaryCard(label, value, accent) {
    return `
      <article class="calc-summary-card${accent ? " calc-summary-card-accent" : ""}">
        <p class="calc-summary-label">${label}</p>
        <h4>${value}</h4>
      </article>
    `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const nodes = {
      label1: document.querySelector("#snp-label-1"),
      label2: document.querySelector("#snp-label-2"),
      label3: document.querySelector("#snp-label-3"),
      patient1: document.querySelector("#snp-patient-1"),
      patient2: document.querySelector("#snp-patient-2"),
      patient3: document.querySelector("#snp-patient-3"),
      control1: document.querySelector("#snp-control-1"),
      control2: document.querySelector("#snp-control-2"),
      control3: document.querySelector("#snp-control-3"),
      calculate: document.querySelector("#snp-calculate"),
      example: document.querySelector("#snp-example"),
      clear: document.querySelector("#snp-clear"),
      status: document.querySelector("#snp-status"),
      summary: document.querySelector("#snp-summary"),
      tableBody: document.querySelector("#snp-table-body"),
      note: document.querySelector("#snp-comparison-note"),
    };

    if (Object.values(nodes).some((node) => !node)) {
      return;
    }

    function renderEmpty() {
      nodes.summary.hidden = true;
      nodes.summary.innerHTML = "";
      nodes.tableBody.innerHTML =
        '<tr><td colspan="7">Run the calculator to show the SNP statistics table.</td></tr>';
      nodes.note.textContent =
        "Each genotype will be compared against the combined other genotypes.";
    }

    function readInputs() {
      return {
        genotype1Label: nodes.label1.value,
        genotype2Label: nodes.label2.value,
        genotype3Label: nodes.label3.value,
        patientGenotype1Count: nodes.patient1.value,
        patientGenotype2Count: nodes.patient2.value,
        patientGenotype3Count: nodes.patient3.value,
        controlGenotype1Count: nodes.control1.value,
        controlGenotype2Count: nodes.control2.value,
        controlGenotype3Count: nodes.control3.value,
      };
    }

    function loadExample() {
      nodes.label1.value = "AA";
      nodes.label2.value = "AG";
      nodes.label3.value = "GG";
      nodes.patient1.value = "42";
      nodes.patient2.value = "36";
      nodes.patient3.value = "12";
      nodes.control1.value = "25";
      nodes.control2.value = "41";
      nodes.control3.value = "24";
      setStatus(nodes.status, "Example counts loaded. Calculate when ready.", "success");
    }

    function renderResult(result) {
      nodes.summary.hidden = false;
      nodes.summary.innerHTML = [
        summaryCard("Total patients", String(result.totalPatients)),
        summaryCard("Total controls", String(result.totalControls)),
        summaryCard("Strongest OR genotype", result.strongestGenotype),
        summaryCard("Comparison model", "Genotype vs all others", true),
      ].join("");

      nodes.note.textContent = result.comparisonNote;

      nodes.tableBody.innerHTML = result.rows
        .map(
          (row) => `
            <tr>
              <td>${row.genotype}</td>
              <td>${formatNumber(row.patientCount, 0)} (${formatFrequency(row.patientFrequency)})</td>
              <td>${formatNumber(row.controlCount, 0)} (${formatFrequency(row.controlFrequency)})</td>
              <td>${formatNumber(row.oddsRatio, 4)}</td>
              <td>${formatPValue(row.fisherPValue)}</td>
              <td>${formatNumber(row.confidenceInterval.lower, 4)} to ${formatNumber(
                row.confidenceInterval.upper,
                4
              )}</td>
              <td>${row.note}${row.correctionApplied ? " (0.5 correction applied)" : ""}</td>
            </tr>
          `
        )
        .join("");
    }

    nodes.calculate.addEventListener("click", () => {
      try {
        const result = core.computeSnpStatistics(readInputs());
        renderResult(result);
        setStatus(nodes.status, "SNP statistics completed.", "success");
      } catch (error) {
        renderEmpty();
        setStatus(nodes.status, error.message || "Calculation failed.", "error");
      }
    });

    nodes.example.addEventListener("click", loadExample);
    nodes.clear.addEventListener("click", () => {
      nodes.label1.value = "AA";
      nodes.label2.value = "AG";
      nodes.label3.value = "GG";
      nodes.patient1.value = "";
      nodes.patient2.value = "";
      nodes.patient3.value = "";
      nodes.control1.value = "";
      nodes.control2.value = "";
      nodes.control3.value = "";
      renderEmpty();
      setStatus(nodes.status, "", "");
    });

    renderEmpty();
  });
})(window);
