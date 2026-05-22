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
    const label1 = document.querySelector("#hwe-label-1");
    const label2 = document.querySelector("#hwe-label-2");
    const label3 = document.querySelector("#hwe-label-3");
    const count1 = document.querySelector("#hwe-count-1");
    const count2 = document.querySelector("#hwe-count-2");
    const count3 = document.querySelector("#hwe-count-3");
    const calculateButton = document.querySelector("#hwe-calculate");
    const exampleButton = document.querySelector("#hwe-example");
    const clearButton = document.querySelector("#hwe-clear");
    const statusNode = document.querySelector("#hwe-status");
    const tableBody = document.querySelector("#hwe-table-body");
    const summaryNode = document.querySelector("#hwe-summary");
    const summaryTableNode = document.querySelector("#hwe-summary-table");

    if (
      !label1 ||
      !label2 ||
      !label3 ||
      !count1 ||
      !count2 ||
      !count3 ||
      !calculateButton ||
      !exampleButton ||
      !clearButton ||
      !statusNode ||
      !tableBody ||
      !summaryNode ||
      !summaryTableNode
    ) {
      return;
    }

    function renderEmpty() {
      summaryNode.hidden = true;
      summaryNode.innerHTML = "";
      summaryTableNode.hidden = true;
      summaryTableNode.innerHTML = "";
      tableBody.innerHTML =
        '<tr><td colspan="6">Run the calculator to show the Hardy-Weinberg table.</td></tr>';
    }

    function loadExample() {
      label1.value = "AA";
      label2.value = "AG";
      label3.value = "GG";
      count1.value = "48";
      count2.value = "44";
      count3.value = "8";
      setStatus(statusNode, "Example counts loaded. Calculate when ready.", "success");
    }

    function readInputs() {
      return {
        genotype1Label: label1.value,
        genotype2Label: label2.value,
        genotype3Label: label3.value,
        genotype1Count: count1.value,
        genotype2Count: count2.value,
        genotype3Count: count3.value,
      };
    }

    function renderResult(result) {
      summaryNode.hidden = false;
      summaryNode.innerHTML = [
        summaryCard("Total samples", String(result.totalSamples)),
        summaryCard("Allele p", formatNumber(result.alleleFrequencyP, 4)),
        summaryCard("Allele q", formatNumber(result.alleleFrequencyQ, 4)),
        summaryCard("HWE p-value", formatPValue(result.pValue), true),
      ].join("");

      tableBody.innerHTML = result.rows
        .map(
          (row) => `
            <tr>
              <td>${row.genotype}</td>
              <td>${formatNumber(row.observedCount, 0)}</td>
              <td>${formatNumber(row.observedFrequency, 4)}</td>
              <td>${formatNumber(row.expectedCount, 4)}</td>
              <td>${formatNumber(row.expectedFrequency, 4)}</td>
              <td>${formatNumber(row.chiSquareContribution, 4)}</td>
            </tr>
          `
        )
        .join("");

      summaryTableNode.hidden = false;
      summaryTableNode.innerHTML = `
        <table>
          <caption class="genetics-table-caption">Hardy-Weinberg test summary</caption>
          <thead>
            <tr>
              <th>Hardy-Weinberg chi-square</th>
              <th>P-value</th>
              <th>Agreement</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${formatNumber(result.chiSquare, 4)}</td>
              <td>${formatPValue(result.pValue)}</td>
              <td>${result.agreementText}</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    calculateButton.addEventListener("click", () => {
      try {
        const result = core.computeHardyWeinberg(readInputs());
        renderResult(result);
        setStatus(statusNode, "Hardy-Weinberg calculation completed.", "success");
      } catch (error) {
        renderEmpty();
        setStatus(statusNode, error.message || "Calculation failed.", "error");
      }
    });

    exampleButton.addEventListener("click", loadExample);
    clearButton.addEventListener("click", () => {
      label1.value = "AA";
      label2.value = "AG";
      label3.value = "GG";
      count1.value = "";
      count2.value = "";
      count3.value = "";
      renderEmpty();
      setStatus(statusNode, "", "");
    });

    renderEmpty();
  });
})(window);
