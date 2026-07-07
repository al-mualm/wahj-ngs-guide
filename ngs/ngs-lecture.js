(function initializeNgsLecturePage() {
  const page = document.querySelector(".ngs-lecture-page");
  if (!page) {
    return;
  }

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function animateRangeInput(input, targetValue, onUpdate) {
    const target = Number(targetValue);
    if (reduceMotionQuery.matches) {
      input.value = String(target);
      onUpdate(target);
      return;
    }

    const startValue = Number(input.value);
    const delta = target - startValue;
    const duration = 900;
    let frameId = 0;
    let startTime = 0;

    function step(timestamp) {
      if (!startTime) {
        startTime = timestamp;
      }

      const progress = clamp((timestamp - startTime) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + delta * eased;
      input.value = String(nextValue);
      onUpdate(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
        return;
      }

      window.cancelAnimationFrame(frameId);
    }

    window.requestAnimationFrame(step);
  }

  function setupSelectableGroup(groupSelector, buttonSelector, panelSelector, activeClass) {
    document.querySelectorAll(groupSelector).forEach((group) => {
      const buttons = Array.from(group.querySelectorAll(buttonSelector));
      const panels = Array.from(group.querySelectorAll(panelSelector));
      if (!buttons.length || !panels.length) {
        return;
      }

      function activate(targetId) {
        buttons.forEach((button) => {
          const isActive = button.dataset.target === targetId;
          button.classList.toggle(activeClass, isActive);
          button.setAttribute("aria-selected", isActive ? "true" : "false");
          button.setAttribute("tabindex", isActive ? "0" : "-1");
        });

        panels.forEach((panel) => {
          const isActive = panel.id === targetId;
          panel.classList.toggle(activeClass, isActive);
          panel.hidden = !isActive;
        });
      }

      buttons.forEach((button) => {
        button.addEventListener("click", () => activate(button.dataset.target));
        button.addEventListener("keydown", (event) => {
          const index = buttons.indexOf(button);
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            buttons[(index + 1) % buttons.length].focus();
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            buttons[(index - 1 + buttons.length) % buttons.length].focus();
          }
          if (event.key === "Home") {
            event.preventDefault();
            buttons[0].focus();
          }
          if (event.key === "End") {
            event.preventDefault();
            buttons[buttons.length - 1].focus();
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate(button.dataset.target);
          }
        });
      });

      const initialButton = buttons.find((button) => button.classList.contains(activeClass)) || buttons[0];
      activate(initialButton.dataset.target);
    });
  }

  function initializeCoverageDemo() {
    const slider = document.querySelector("#coverage-progress");
    const sweepButton = document.querySelector("#coverage-sweep");
    const readLayer = document.querySelector("#coverage-read-layer");
    const depthLayer = document.querySelector("#coverage-depth-layer");
    const kpiAligned = document.querySelector("#coverage-kpi-aligned");
    const kpiPeak = document.querySelector("#coverage-kpi-peak");
    const kpiBreadth = document.querySelector("#coverage-kpi-breadth");
    const kpiGap = document.querySelector("#coverage-kpi-gap");

    if (
      !slider ||
      !sweepButton ||
      !readLayer ||
      !depthLayer ||
      !kpiAligned ||
      !kpiPeak ||
      !kpiBreadth ||
      !kpiGap
    ) {
      return;
    }

    const finalCounts = [8, 8, 16, 16, 20, 20, 12, 12, 4, 4, 0, 0, 0, 0, 0, 0];
    const reads = [
      { startBin: 1, endBin: 6 },
      { startBin: 1, endBin: 6 },
      { startBin: 1, endBin: 6 },
      { startBin: 1, endBin: 6 },
      { startBin: 1, endBin: 6 },
      { startBin: 1, endBin: 6 },
      { startBin: 1, endBin: 6 },
      { startBin: 1, endBin: 6 },
      { startBin: 3, endBin: 8 },
      { startBin: 3, endBin: 8 },
      { startBin: 3, endBin: 8 },
      { startBin: 3, endBin: 8 },
      { startBin: 3, endBin: 8 },
      { startBin: 3, endBin: 8 },
      { startBin: 3, endBin: 8 },
      { startBin: 3, endBin: 8 },
      { startBin: 5, endBin: 10 },
      { startBin: 5, endBin: 10 },
      { startBin: 5, endBin: 10 },
      { startBin: 5, endBin: 10 },
    ];

    const referenceLeft = 7;
    const referenceWidth = 86;
    const binWidth = referenceWidth / finalCounts.length;
    const finalReadWidthBins = 6;
    const readRows = 5;

    const readElements = reads.map((read, index) => {
      const element = document.createElement("div");
      element.className = "ngs-coverage-read";
      const poolColumn = index % 4;
      const poolRow = Math.floor(index / 4);
      const poolX = 4 + poolColumn * 4.2;
      const poolY = 3.2 + poolRow * 1.55;
      const finalX = referenceLeft + (read.startBin - 1) * binWidth;
      const finalY = 10.1 - (index % readRows) * 1.35 - Math.floor(index / readRows) * 0.1;
      const finalWidth = finalReadWidthBins * binWidth - 0.4;

      element.dataset.poolX = String(poolX);
      element.dataset.poolY = String(poolY);
      element.dataset.finalX = String(finalX);
      element.dataset.finalY = String(finalY);
      element.dataset.finalWidth = String(finalWidth);
      readLayer.appendChild(element);
      return element;
    });

    const depthElements = finalCounts.map((count, index) => {
      const column = document.createElement("div");
      column.className = "ngs-depth-column";
      if (count === 0) {
        column.classList.add("is-gap");
      }
      column.style.left = `${referenceLeft + index * binWidth}%`;

      const bar = document.createElement("div");
      bar.className = "ngs-depth-bar";
      const value = document.createElement("strong");
      const label = document.createElement("span");

      label.textContent = `L${index + 1}`;
      column.appendChild(bar);
      column.appendChild(value);
      column.appendChild(label);
      depthLayer.appendChild(column);

      return { count, column, bar, value };
    });

    function updateCoverageScene(progressPercent) {
      const progress = clamp(progressPercent / 100, 0, 1);

      readElements.forEach((element) => {
        const poolX = Number(element.dataset.poolX);
        const poolY = Number(element.dataset.poolY);
        const finalX = Number(element.dataset.finalX);
        const finalY = Number(element.dataset.finalY);
        const finalWidth = Number(element.dataset.finalWidth);
        const currentX = poolX + (finalX - poolX) * progress;
        const currentY = poolY + (finalY - poolY) * progress;
        const currentWidth = 2.6 + (finalWidth - 2.6) * progress;

        element.style.left = `${currentX}%`;
        element.style.top = `${currentY}rem`;
        element.style.width = `${currentWidth}%`;
        element.style.opacity = String(0.42 + progress * 0.58);
      });

      const scaledCounts = finalCounts.map((count) => Math.round(count * progress));
      const peak = Math.max(...scaledCounts);
      const uncovered = scaledCounts.filter((count) => count === 0).length;
      const breadth20 = (
        (scaledCounts.filter((count) => count >= 20).length / scaledCounts.length) *
        100
      ).toFixed(1);

      depthElements.forEach(({ count, bar, value, column }) => {
        const scaled = Math.round(count * progress);
        const height = Math.max(0.4, (scaled / 20) * 9.2);
        bar.style.height = `${height}rem`;
        value.textContent = `${scaled}x`;
        column.classList.toggle("is-gap", scaled === 0);
      });

      kpiAligned.textContent = `${Math.round(readElements.length * progress)} / ${readElements.length}`;
      kpiPeak.textContent = `${peak}x`;
      kpiBreadth.textContent = `${breadth20}% at 20x`;
      kpiGap.textContent = `${uncovered} loci`;
    }

    slider.addEventListener("input", () => updateCoverageScene(Number(slider.value)));
    sweepButton.addEventListener("click", () => {
      const target = Number(slider.value) >= 100 ? 0 : 100;
      animateRangeInput(slider, target, updateCoverageScene);
    });

    updateCoverageScene(Number(slider.value));
  }

  function initializeDropoutDemo() {
    const slider = document.querySelector("#dropout-severity");
    const button = document.querySelector("#dropout-sweep");
    const track = document.querySelector("#dropout-track");
    const kpiMean = document.querySelector("#dropout-kpi-mean");
    const kpiLowest = document.querySelector("#dropout-kpi-lowest");
    const kpiFailed = document.querySelector("#dropout-kpi-failed");
    const kpiCall = document.querySelector("#dropout-kpi-call");

    if (!slider || !button || !track || !kpiMean || !kpiLowest || !kpiFailed || !kpiCall) {
      return;
    }

    const ideal = [138, 132, 126, 122, 118, 124, 128, 134];
    const severe = [124, 103, 78, 38, 6, 16, 56, 92];
    const warningThreshold = 60;
    const failThreshold = 20;
    const focusIndex = 4;

    function render(severityValue) {
      const severity = clamp(severityValue / 100, 0, 1);
      track.replaceChildren();

      const depths = ideal.map((value, index) =>
        Math.round(value + (severe[index] - value) * severity)
      );

      depths.forEach((depth, index) => {
        const exon = document.createElement("article");
        const isGap = depth < failThreshold;
        const isRisk = !isGap && depth < warningThreshold;

        exon.className = "ngs-dropout-exon";
        if (index === focusIndex) {
          exon.classList.add("is-focus");
        }

        const head = document.createElement("div");
        head.className = "ngs-dropout-exon-head";

        const title = document.createElement("strong");
        title.textContent = `Exon ${index + 1}`;

        const status = document.createElement("span");
        status.className = "ngs-dropout-status";
        status.textContent = isGap ? "Dropout" : isRisk ? "Low" : "Strong";
        if (isGap) {
          status.classList.add("is-gap");
        } else if (isRisk) {
          status.classList.add("is-risk");
        }

        head.append(title, status);

        const gene = document.createElement("div");
        gene.className = "ngs-dropout-gene";

        const barWrap = document.createElement("div");
        barWrap.className = "ngs-dropout-bar-wrap";

        const bar = document.createElement("div");
        bar.className = "ngs-dropout-bar";
        bar.style.height = `${Math.max(1.2, (depth / 140) * 8.6)}rem`;
        if (isGap) {
          bar.classList.add("is-gap");
        } else if (isRisk) {
          bar.classList.add("is-risk");
        }

        const value = document.createElement("div");
        value.className = "ngs-dropout-value";

        const depthStrong = document.createElement("strong");
        depthStrong.textContent = `${depth}x`;
        const depthLabel = document.createElement("span");
        depthLabel.textContent = isGap
          ? "below validated threshold"
          : isRisk
            ? "review locally"
            : "callable";

        value.append(depthStrong, depthLabel);
        barWrap.append(bar, value);
        exon.append(head, gene, barWrap);
        track.appendChild(exon);
      });

      const meanDepth = Math.round(depths.reduce((sum, value) => sum + value, 0) / depths.length);
      const lowest = Math.min(...depths);
      const failed = depths.filter((value) => value < failThreshold).length;

      kpiMean.textContent = `${meanDepth}x`;
      kpiLowest.textContent = `${lowest}x`;
      kpiFailed.textContent = String(failed);
      kpiCall.textContent =
        failed > 0 ? "Gap present" : lowest < warningThreshold ? "Local review" : "Callable";
    }

    slider.addEventListener("input", () => render(Number(slider.value)));
    button.addEventListener("click", () => {
      const target = Number(slider.value) >= 85 ? 10 : 100;
      animateRangeInput(slider, target, render);
    });

    render(Number(slider.value));
  }

  function initializeFilterDemo() {
    const slider = document.querySelector("#filter-stage");
    const button = document.querySelector("#filter-next");
    const funnel = document.querySelector("#filter-funnel");
    const title = document.querySelector("#filter-title");
    const description = document.querySelector("#filter-description");
    const count = document.querySelector("#filter-count");
    const rule = document.querySelector("#filter-rule");
    const removed = document.querySelector("#filter-removed");
    const caution = document.querySelector("#filter-caution");

    if (
      !slider ||
      !button ||
      !funnel ||
      !title ||
      !description ||
      !count ||
      !rule ||
      !removed ||
      !caution
    ) {
      return;
    }

    const steps = [
      {
        name: "Raw variant universe",
        countLabel: "4.2M candidate positions",
        shortLabel: "4.2M raw",
        width: 100,
        description:
          "Start with every technically detected site before clinical relevance logic is applied.",
        rule: "No clinical filtering yet.",
        removed: "Nothing removed yet.",
        caution: "A large raw list is normal before QC and biological context are applied.",
      },
      {
        name: "High-quality callable set",
        countLabel: "78k callable sites",
        shortLabel: "78k callable",
        width: 55,
        description:
          "Remove poor-quality, low-depth, low-mapping, or technically unsupported calls first.",
        rule: "Apply QC, depth, genotype-quality, allele-balance, and callability filters.",
        removed: "Low-quality noise, weak evidence sites, and off-threshold calls.",
        caution: "A site that fails local coverage review should not move forward just because the gene is relevant.",
      },
      {
        name: "Rare or assay-relevant subset",
        countLabel: "860 rare or high-priority sites",
        shortLabel: "860 rare",
        width: 28,
        description:
          "Use population frequency, tumor relevance, or assay scope to remove common or irrelevant findings.",
        rule: "Keep rare germline candidates or predefined somatic targets that match the assay intent.",
        removed: "Common polymorphisms and variants outside the reportable aim.",
        caution: "Frequency filtering differs between rare disease, carrier screening, and oncology use cases.",
      },
      {
        name: "Gene and phenotype shortlist",
        countLabel: "18 biologically plausible sites",
        shortLabel: "18 shortlist",
        width: 14,
        description:
          "Now match the remaining variants to phenotype, inheritance, mechanism, and transcript context.",
        rule: "Prioritize genes, transcripts, zygosity, segregation, and variant consequence that fit the case.",
        removed: "Biologically implausible hits, wrong transcripts, and poor phenotype matches.",
        caution: "A variant can look severe in isolation and still fail the clinical fit test.",
      },
      {
        name: "Review-ready candidates",
        countLabel: "3 candidates for final evidence review",
        shortLabel: "3 candidates",
        width: 8,
        description:
          "Only a very small set should reach the final evidence board or variant-review meeting.",
        rule: "Move forward only the candidates that survive QC, filtering, phenotype fit, and transcript checks.",
        removed: "Candidates lacking sufficient support for detailed classification work.",
        caution: "Even this short list can still end as VUS, benign, or non-reportable after evidence review.",
      },
    ];

    const stepElements = steps.map((step, index) => {
      const item = document.createElement("article");
      item.className = "ngs-filter-step";

      const head = document.createElement("div");
      head.className = "ngs-filter-step-head";

      const stepTitle = document.createElement("h4");
      stepTitle.textContent = step.name;
      const stepCount = document.createElement("p");
      stepCount.textContent = step.shortLabel;
      head.append(stepTitle, stepCount);

      const bar = document.createElement("div");
      bar.className = "ngs-filter-bar";
      const fill = document.createElement("div");
      fill.className = "ngs-filter-bar-fill";
      fill.style.width = `${step.width}%`;
      bar.appendChild(fill);

      const note = document.createElement("small");
      note.textContent =
        index === 0
          ? "All detected sites before filtering."
          : index === steps.length - 1
            ? "Still not classified until evidence review."
            : "Checkpoint before moving deeper into review.";

      item.append(head, bar, note);
      funnel.appendChild(item);
      return item;
    });

    function update(stepValue) {
      const index = clamp(Math.round(stepValue), 0, steps.length - 1);
      const step = steps[index];

      slider.value = String(index);
      title.textContent = step.name;
      description.textContent = step.description;
      count.textContent = step.countLabel;
      rule.textContent = step.rule;
      removed.textContent = step.removed;
      caution.textContent = step.caution;

      stepElements.forEach((element, elementIndex) => {
        element.classList.toggle("is-active", elementIndex === index);
        element.classList.toggle("is-passed", elementIndex < index);
      });
    }

    slider.addEventListener("input", () => update(Number(slider.value)));
    button.addEventListener("click", () => {
      const current = Math.round(Number(slider.value));
      const next = current >= steps.length - 1 ? 0 : current + 1;
      animateRangeInput(slider, next, update);
    });

    update(Number(slider.value));
  }

  function initializeVafDemo() {
    const slider = document.querySelector("#vaf-slider");
    const readGrid = document.querySelector("#vaf-reads");
    const altCount = document.querySelector("#vaf-alt-count");
    const vafPercent = document.querySelector("#vaf-percent");

    if (!slider || !readGrid || !altCount || !vafPercent) {
      return;
    }

    const totalDepth = 100;
    const reads = Array.from({ length: totalDepth }, () => {
      const read = document.createElement("span");
      read.className = "ngs-vaf-read";
      readGrid.appendChild(read);
      return read;
    });

    function update(mutantReads) {
      const altReads = clamp(Math.round(mutantReads), 0, totalDepth);
      slider.value = String(altReads);
      altCount.textContent = String(altReads);
      vafPercent.textContent = `${altReads}%`;

      reads.forEach((read, index) => {
        read.classList.toggle("is-alt", index < altReads);
      });
    }

    slider.addEventListener("input", () => update(Number(slider.value)));
    update(Number(slider.value));
  }

  function initializeChromatograms() {
    const chromatograms = Array.from(document.querySelectorAll(".ngs-chromatogram"));
    if (!chromatograms.length) {
      return;
    }

    const sequence = ["A", "C", "T", "G", "A", "G", "T", "C", "A", "T", "G", "C"];
    const baseClass = {
      A: "base-a",
      C: "base-c",
      G: "base-g",
      T: "base-t",
    };

    function addPeak(column, base, height, className = "") {
      const peak = document.createElement("span");
      peak.className = `ngs-peak ${baseClass[base]} ${className}`.trim();
      peak.style.height = `${height}%`;
      column.appendChild(peak);
    }

    chromatograms.forEach((chromatogram) => {
      const pattern = chromatogram.dataset.pattern || "heterozygous";
      chromatogram.replaceChildren();

      sequence.forEach((base, index) => {
        const column = document.createElement("div");
        column.className = "ngs-chrom-base";
        column.dataset.base = base;

        if (pattern === "heterozygous" && index === 5) {
          column.dataset.base = "G/A";
          addPeak(column, "G", 86);
          addPeak(column, "A", 62, "is-secondary");
        } else if (pattern === "homozygous" && index === 5) {
          column.dataset.base = "A";
          addPeak(column, "A", 88);
        } else if (pattern === "noisy") {
          const noiseBase = sequence[(index + 2) % sequence.length];
          addPeak(column, base, index === 5 ? 46 : 58 + ((index * 7) % 24));
          addPeak(column, noiseBase, 16 + ((index * 5) % 22), "is-noise");
          if (index === 5) {
            addPeak(column, "A", 24, "is-secondary");
          }
        } else {
          addPeak(column, base, 54 + ((index * 9) % 34));
        }

        chromatogram.appendChild(column);
      });
    });
  }

  setupSelectableGroup("[data-stage-explorer]", ".ngs-stage-tab", ".ngs-stage-panel", "is-active");
  setupSelectableGroup("[data-file-tabs]", ".ngs-file-tab", ".ngs-file-panel", "is-active");
  setupSelectableGroup("[data-variant-tabs]", ".ngs-file-tab", ".ngs-file-panel", "is-active");
  setupSelectableGroup("[data-tier-tabs]", ".ngs-tier-tab", ".ngs-tier-panel", "is-active");
  setupSelectableGroup("[data-report-lab]", ".ngs-file-tab", ".ngs-file-panel", "is-active");
  setupSelectableGroup("[data-sanger-tabs]", ".ngs-file-tab", ".ngs-file-panel", "is-active");
  initializeCoverageDemo();
  initializeDropoutDemo();
  initializeFilterDemo();
  initializeVafDemo();
  initializeChromatograms();
})();
