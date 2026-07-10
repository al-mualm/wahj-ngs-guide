(function () {
  const thresholdSlider = document.getElementById("ct-threshold-slider");
  const shiftSlider = document.getElementById("ct-shift-slider");
  const linearSvg = document.getElementById("ct-linear-svg");
  const logSvg = document.getElementById("ct-log-svg");
  const cycleSlider = document.getElementById("qpcr-cycle-slider");
  const cycleSvg = document.getElementById("qpcr-cycle-svg");

  if (!thresholdSlider || !shiftSlider || !linearSvg || !logSvg || !cycleSlider || !cycleSvg) {
    return;
  }

  const thresholdOutput = document.getElementById("ct-threshold-output");
  const shiftOutput = document.getElementById("ct-shift-output");
  const assignedCtReadout = document.getElementById("ct-assigned-readout");
  const thresholdEffectReadout = document.getElementById("ct-threshold-effect");
  const shiftEffectReadout = document.getElementById("ct-shift-effect");
  const ctResetButton = document.getElementById("ct-reset-button");

  const cycleOutput = document.getElementById("qpcr-cycle-output");
  const phaseReadout = document.getElementById("qpcr-phase-readout");
  const copyReadout = document.getElementById("qpcr-copy-readout");
  const signalReadout = document.getElementById("qpcr-signal-readout");
  const reactionAlert = document.getElementById("qpcr-reaction-alert");
  const tubeLiquid = document.getElementById("qpcr-tube-liquid");
  const dnaCluster = document.getElementById("qpcr-dna-cluster");
  const cycleResetButton = document.getElementById("qpcr-cycle-reset-button");

  const CT_DEFAULTS = {
    threshold: 0.42,
    shift: 0,
  };

  const CT_PLOT = {
    left: 74,
    top: 28,
    width: 398,
    height: 224,
    maxCycle: 45,
  };

  const CYCLE_PLOT = {
    left: 74,
    top: 28,
    width: 398,
    height: 224,
    maxCycle: 40,
  };

  const DNA_POSITIONS = [
    [24, 18, -18, 0.92],
    [58, 16, 14, 0.9],
    [78, 22, -8, 0.84],
    [18, 34, 8, 0.82],
    [44, 30, -14, 0.95],
    [72, 36, 18, 0.88],
    [30, 48, 10, 0.84],
    [58, 46, -16, 0.9],
    [82, 52, 12, 0.8],
    [20, 62, -10, 0.82],
    [44, 64, 16, 0.94],
    [70, 66, -18, 0.88],
    [16, 76, 12, 0.8],
    [36, 82, -14, 0.86],
    [62, 80, 10, 0.92],
    [82, 84, -12, 0.82],
    [24, 92, 14, 0.84],
    [50, 94, -10, 0.88],
    [74, 94, 18, 0.82],
    [14, 108, -16, 0.78],
    [38, 110, 10, 0.84],
    [62, 110, -12, 0.88],
    [84, 110, 16, 0.8],
    [48, 124, -8, 0.82],
  ];

  let activeDragView = null;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatNumber(value, digits) {
    return Number(value).toFixed(digits);
  }

  function asScientific(value) {
    if (value < 1000) {
      return `${Math.round(value)} copies`;
    }

    const exponent = Math.floor(Math.log10(value));
    const mantissa = value / 10 ** exponent;
    return `${mantissa.toFixed(1)} × 10^${exponent} copies`;
  }

  function xToPx(cycle, plot) {
    return plot.left + (cycle / plot.maxCycle) * plot.width;
  }

  function yToPx(value, plot) {
    return plot.top + plot.height - value * plot.height;
  }

  function logTransform(value) {
    return Math.log10(1 + value * 18) / Math.log10(19);
  }

  function logInverse(value) {
    return (19 ** value - 1) / 18;
  }

  function amplificationSignal(cycle, shift) {
    const midpoint = 36 - shift * 1.12;
    const baseline = 0.015;
    const plateau = 0.95;
    const steepness = 0.37;
    return baseline + (plateau - baseline) / (1 + Math.exp(-steepness * (cycle - midpoint)));
  }

  function findCt(threshold, shift) {
    const step = 0.05;
    let previousX = 0;
    let previousY = amplificationSignal(previousX, shift);

    for (let cycle = step; cycle <= CT_PLOT.maxCycle; cycle += step) {
      const signal = amplificationSignal(cycle, shift);

      if (previousY <= threshold && signal >= threshold) {
        const fraction = (threshold - previousY) / (signal - previousY || 1);
        return previousX + fraction * (cycle - previousX);
      }

      previousX = cycle;
      previousY = signal;
    }

    return null;
  }

  function ctThresholdEffect(threshold) {
    if (threshold <= 0.3) {
      return "Threshold is too close to baseline and can be distorted by background noise.";
    }
    if (threshold >= 0.56) {
      return "Threshold is drifting into later signal territory and will push Ct artificially higher.";
    }
    return "Threshold sits in the log-linear rise, where Ct is usually assigned.";
  }

  function shiftDescriptor(shift) {
    if (shift >= 4) {
      return "Much more starting target";
    }
    if (shift > 0) {
      return "More starting target";
    }
    if (shift <= -4) {
      return "Much less starting target";
    }
    if (shift < 0) {
      return "Less starting target";
    }
    return "Reference amount";
  }

  function ctShiftEffect(shift) {
    if (shift > 0) {
      return "Higher starting copy number shifts the curve left and lowers Ct.";
    }
    if (shift < 0) {
      return "Lower starting copy number shifts the curve right and raises Ct.";
    }
    return "Use this slider to see how starting quantity changes Ct.";
  }

  function buildGrid(plot) {
    const vertical = [];
    const horizontal = [];

    for (let cycle = 0; cycle <= plot.maxCycle; cycle += 5) {
      const x = xToPx(cycle, plot);
      vertical.push(
        `<line class="plot-grid" x1="${x}" y1="${plot.top}" x2="${x}" y2="${plot.top + plot.height}"></line>`,
      );
    }

    for (let i = 0; i <= 5; i += 1) {
      const y = plot.top + (plot.height / 5) * i;
      horizontal.push(
        `<line class="plot-grid" x1="${plot.left}" y1="${y}" x2="${plot.left + plot.width}" y2="${y}"></line>`,
      );
    }

    return vertical.join("") + horizontal.join("");
  }

  function buildAxisLabels(plot, axisTitleY, captionText) {
    const labels = [];

    for (let cycle = 0; cycle <= plot.maxCycle; cycle += 5) {
      labels.push(
        `<text class="plot-label" x="${xToPx(cycle, plot)}" y="${plot.top + plot.height + 24}" text-anchor="middle">${cycle}</text>`,
      );
    }

    labels.push(
      `<text class="plot-axis-title" x="${plot.left + plot.width / 2}" y="${plot.top + plot.height + 48}" text-anchor="middle">Cycle number</text>`,
    );
    labels.push(
      `<text class="plot-axis-title" x="24" y="${plot.top + plot.height / 2}" transform="rotate(-90 24 ${plot.top + plot.height / 2})" text-anchor="middle">${axisTitleY}</text>`,
    );
    labels.push(
      `<text class="plot-caption" x="${plot.left + plot.width}" y="${plot.top - 8}" text-anchor="end">${captionText}</text>`,
    );

    return labels.join("");
  }

  function buildPath(plot, points, transform) {
    return points
      .map((cycle, index) => {
        const x = xToPx(cycle, plot);
        const y = yToPx(transform(cycle), plot);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }

  function buildFilledPath(plot, points, transform) {
    const line = buildPath(plot, points, transform);
    const lastX = xToPx(points[points.length - 1], plot);
    const baseY = plot.top + plot.height;
    return `${line} L ${lastX.toFixed(2)} ${baseY.toFixed(2)} L ${plot.left.toFixed(2)} ${baseY.toFixed(2)} Z`;
  }

  function zonePill(x, y, width, height, label) {
    return [
      `<rect class="plot-zone-pill" x="${x}" y="${y}" width="${width}" height="${height}" rx="16"></rect>`,
      `<text class="plot-zone-text" x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle">${label}</text>`,
    ].join("");
  }

  function renderCtPlot(svg, mode, threshold, shift, ctValue) {
    const transform =
      mode === "linear"
        ? (cycle) => amplificationSignal(cycle, shift)
        : (cycle) => logTransform(amplificationSignal(cycle, shift));
    const thresholdYValue = mode === "linear" ? threshold : logTransform(threshold);
    const thresholdY = yToPx(thresholdYValue, CT_PLOT);
    const ctX = xToPx(ctValue, CT_PLOT);
    const curvePoints = Array.from({ length: 451 }, (_, index) => (index / 450) * CT_PLOT.maxCycle);
    const path = buildPath(CT_PLOT, curvePoints, transform);
    const filledPath = buildFilledPath(CT_PLOT, curvePoints, transform);
    const baselineTop = yToPx(mode === "linear" ? 0.15 : logTransform(0.15), CT_PLOT);
    const baselineHeight = yToPx(0, CT_PLOT) - baselineTop;
    const intersectionY = yToPx(thresholdYValue, CT_PLOT);
    const thresholdLabelX = CT_PLOT.left + CT_PLOT.width - 4;
    const ctValueLabelX = ctX > CT_PLOT.left + CT_PLOT.width * 0.68 ? ctX - 18 : ctX + 10;
    const ctValueLabelAnchor = ctValueLabelX < ctX ? "end" : "start";
    const axisTitle = mode === "linear" ? "DeltaRn" : "log(DeltaRn)";
    const caption = mode === "linear" ? "Drag or slide the threshold" : "Same curve in a compressed display";

    svg.innerHTML = `
      <defs>
        <linearGradient id="plot-surface-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.96)"></stop>
          <stop offset="100%" stop-color="rgba(236,245,250,0.96)"></stop>
        </linearGradient>
      </defs>
      <rect class="plot-panel-fill" x="${CT_PLOT.left}" y="${CT_PLOT.top}" width="${CT_PLOT.width}" height="${CT_PLOT.height}" rx="18"></rect>
      ${buildGrid(CT_PLOT)}
      <rect class="plot-baseline-band" x="${CT_PLOT.left}" y="${baselineTop}" width="${xToPx(16, CT_PLOT) - CT_PLOT.left}" height="${baselineHeight}" rx="18"></rect>
      <rect class="plot-threshold-zone" x="${CT_PLOT.left}" y="${thresholdY - 9}" width="${CT_PLOT.width}" height="18" rx="10"></rect>
      <line class="plot-axis" x1="${CT_PLOT.left}" y1="${CT_PLOT.top}" x2="${CT_PLOT.left}" y2="${CT_PLOT.top + CT_PLOT.height}"></line>
      <line class="plot-axis" x1="${CT_PLOT.left}" y1="${CT_PLOT.top + CT_PLOT.height}" x2="${CT_PLOT.left + CT_PLOT.width}" y2="${CT_PLOT.top + CT_PLOT.height}"></line>
      <path class="plot-curve-fill" d="${filledPath}"></path>
      <path class="plot-curve" d="${path}"></path>
      <line class="plot-threshold" x1="${CT_PLOT.left}" y1="${thresholdY}" x2="${CT_PLOT.left + CT_PLOT.width}" y2="${thresholdY}"></line>
      <line class="plot-ct-line" x1="${ctX}" y1="${intersectionY}" x2="${ctX}" y2="${CT_PLOT.top + CT_PLOT.height}"></line>
      <circle class="plot-active-halo" cx="${ctX}" cy="${intersectionY}" r="14"></circle>
      <circle class="plot-dot" cx="${ctX}" cy="${intersectionY}" r="7"></circle>
      <circle class="plot-threshold-dot" cx="${CT_PLOT.left + 14}" cy="${thresholdY}" r="5"></circle>
      ${buildAxisLabels(CT_PLOT, axisTitle, caption)}
      <text class="plot-label" x="${thresholdLabelX}" y="${thresholdY - 10}" text-anchor="end">Threshold</text>
      <text class="plot-label" x="${ctX}" y="${CT_PLOT.top + CT_PLOT.height + 18}" text-anchor="middle">Ct</text>
      <text class="plot-label" x="${ctValueLabelX}" y="${intersectionY - 14}" text-anchor="${ctValueLabelAnchor}">${formatNumber(ctValue, 1)}</text>
      ${zonePill(CT_PLOT.left + 30, CT_PLOT.top + CT_PLOT.height - 46, 124, 30, "Baseline region")}
      ${zonePill(CT_PLOT.left + 198, CT_PLOT.top + CT_PLOT.height - 118, 136, 30, mode === "linear" ? "Useful threshold zone" : "Geometric rise")}
      ${zonePill(CT_PLOT.left + 280, CT_PLOT.top + 54, 122, 30, "Plateau phase")}
    `;
  }

  function pointerToThreshold(event, svg, mode) {
    const matrix = svg.getScreenCTM();

    if (!matrix) {
      return null;
    }

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    const normalized = clamp((CT_PLOT.top + CT_PLOT.height - local.y) / CT_PLOT.height, 0.18, 0.74);

    return clamp(mode === "linear" ? normalized : logInverse(normalized), 0.18, 0.74);
  }

  function renderCtInteractive() {
    const threshold = Number(thresholdSlider.value);
    const shift = Number(shiftSlider.value);
    const ctValue = findCt(threshold, shift) || 0;

    thresholdOutput.textContent = `${formatNumber(threshold, 2)} ΔRn`;
    shiftOutput.textContent = shiftDescriptor(shift);
    assignedCtReadout.textContent = `${formatNumber(ctValue, 1)} cycles`;
    thresholdEffectReadout.textContent = ctThresholdEffect(threshold);
    shiftEffectReadout.textContent = ctShiftEffect(shift);

    renderCtPlot(linearSvg, "linear", threshold, shift, ctValue);
    renderCtPlot(logSvg, "log", threshold, shift, ctValue);
  }

  function cycleSignal(cycle) {
    if (cycle <= 23) {
      return 0.02 + cycle * 0.002;
    }
    if (cycle < 35) {
      const progress = (cycle - 23) / 12;
      const smooth = progress * progress * (3 - 2 * progress);
      return 0.066 + smooth * 0.82;
    }
    return 0.91;
  }

  function cyclePhase(cycle) {
    if (cycle === 0) {
      return "Reaction set-up";
    }
    if (cycle < 23) {
      return "Baseline / early doubling";
    }
    if (cycle < 35) {
      return "Exponential signal rise";
    }
    return "Plateau / reagent-limited";
  }

  function cycleSignalText(cycle) {
    if (cycle < 12) {
      return "Fluorescence still near baseline.";
    }
    if (cycle < 23) {
      return "Product is accumulating, but detection is still close to background.";
    }
    if (cycle < 35) {
      return "Signal is climbing through the informative amplification phase.";
    }
    return "Plateau reached: amplification efficiency is falling as reagents become limiting.";
  }

  function cycleAlertText(cycle) {
    if (cycle < 23) {
      return "Baseline phase: target molecules are increasing, but fluorescence is still close to background.";
    }
    if (cycle < 35) {
      return "Exponential phase: enough product has accumulated for the instrument to detect a rapidly rising signal.";
    }
    return "Plateau phase: reaction components and polymerase activity are becoming limiting, so ideal doubling no longer continues.";
  }

  function cycleCopies(cycle) {
    const startingFragments = 3;

    if (cycle <= 23) {
      return startingFragments * 2 ** cycle;
    }

    const copiesAt23 = startingFragments * 2 ** 23;
    const plateauCopies = startingFragments * 2 ** 35;

    if (cycle >= 35) {
      return plateauCopies;
    }

    const progress = (cycle - 23) / 12;
    const smooth = progress * progress * (3 - 2 * progress);
    return copiesAt23 + (plateauCopies - copiesAt23) * smooth;
  }

  function buildCycleGrid() {
    const vertical = [];
    const horizontal = [];

    for (let cycle = 0; cycle <= CYCLE_PLOT.maxCycle; cycle += 5) {
      const x = xToPx(cycle, CYCLE_PLOT);
      vertical.push(
        `<line class="plot-grid" x1="${x}" y1="${CYCLE_PLOT.top}" x2="${x}" y2="${CYCLE_PLOT.top + CYCLE_PLOT.height}"></line>`,
      );
    }

    for (let i = 0; i <= 5; i += 1) {
      const y = CYCLE_PLOT.top + (CYCLE_PLOT.height / 5) * i;
      horizontal.push(
        `<line class="plot-grid" x1="${CYCLE_PLOT.left}" y1="${y}" x2="${CYCLE_PLOT.left + CYCLE_PLOT.width}" y2="${y}"></line>`,
      );
    }

    return vertical.join("") + horizontal.join("");
  }

  function renderCyclePlot(cycle) {
    const curvePoints = Array.from({ length: 401 }, (_, index) => (index / 400) * CYCLE_PLOT.maxCycle);
    const path = buildPath(CYCLE_PLOT, curvePoints, cycleSignal);
    const filledPath = buildFilledPath(CYCLE_PLOT, curvePoints, cycleSignal);
    const baselineTop = yToPx(0.11, CYCLE_PLOT);
    const currentX = xToPx(cycle, CYCLE_PLOT);
    const currentY = yToPx(cycleSignal(cycle), CYCLE_PLOT);

    cycleSvg.innerHTML = `
      <defs>
        <linearGradient id="plot-surface-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.96)"></stop>
          <stop offset="100%" stop-color="rgba(236,245,250,0.96)"></stop>
        </linearGradient>
      </defs>
      <rect class="plot-panel-fill" x="${CYCLE_PLOT.left}" y="${CYCLE_PLOT.top}" width="${CYCLE_PLOT.width}" height="${CYCLE_PLOT.height}" rx="18"></rect>
      ${buildCycleGrid()}
      <rect class="plot-baseline-band" x="${CYCLE_PLOT.left}" y="${baselineTop}" width="${xToPx(23, CYCLE_PLOT) - CYCLE_PLOT.left}" height="${yToPx(0, CYCLE_PLOT) - baselineTop}" rx="18"></rect>
      <rect class="plot-rise-zone" x="${xToPx(23, CYCLE_PLOT)}" y="${CYCLE_PLOT.top + 42}" width="${xToPx(35, CYCLE_PLOT) - xToPx(23, CYCLE_PLOT)}" height="${CYCLE_PLOT.height - 42}" rx="18"></rect>
      <rect class="plot-threshold-zone" x="${xToPx(35, CYCLE_PLOT)}" y="${CYCLE_PLOT.top + 18}" width="${xToPx(40, CYCLE_PLOT) - xToPx(35, CYCLE_PLOT)}" height="${CYCLE_PLOT.height - 18}" rx="18"></rect>
      <line class="plot-axis" x1="${CYCLE_PLOT.left}" y1="${CYCLE_PLOT.top}" x2="${CYCLE_PLOT.left}" y2="${CYCLE_PLOT.top + CYCLE_PLOT.height}"></line>
      <line class="plot-axis" x1="${CYCLE_PLOT.left}" y1="${CYCLE_PLOT.top + CYCLE_PLOT.height}" x2="${CYCLE_PLOT.left + CYCLE_PLOT.width}" y2="${CYCLE_PLOT.top + CYCLE_PLOT.height}"></line>
      <path class="plot-curve-fill" d="${filledPath}"></path>
      <path class="plot-curve" d="${path}"></path>
      <line class="plot-guide-line" x1="${currentX}" y1="${CYCLE_PLOT.top}" x2="${currentX}" y2="${CYCLE_PLOT.top + CYCLE_PLOT.height}"></line>
      <circle class="plot-active-halo" cx="${currentX}" cy="${currentY}" r="14"></circle>
      <circle class="plot-dot" cx="${currentX}" cy="${currentY}" r="7"></circle>
      <line class="plot-ct-line" x1="${xToPx(23, CYCLE_PLOT)}" y1="${CYCLE_PLOT.top}" x2="${xToPx(23, CYCLE_PLOT)}" y2="${CYCLE_PLOT.top + CYCLE_PLOT.height}"></line>
      <line class="plot-ct-line" x1="${xToPx(35, CYCLE_PLOT)}" y1="${CYCLE_PLOT.top}" x2="${xToPx(35, CYCLE_PLOT)}" y2="${CYCLE_PLOT.top + CYCLE_PLOT.height}"></line>
      ${buildAxisLabels(CYCLE_PLOT, "Fluorescence", "Signal stays low before rising")}
      <text class="plot-label" x="${currentX + 8}" y="${currentY - 12}">Cycle ${cycle}</text>
      <text class="plot-label" x="${xToPx(23, CYCLE_PLOT) + 8}" y="${CYCLE_PLOT.top + CYCLE_PLOT.height - 10}">~23</text>
      <text class="plot-label" x="${xToPx(35, CYCLE_PLOT) + 8}" y="${CYCLE_PLOT.top + CYCLE_PLOT.height - 10}">~35</text>
      ${zonePill(CYCLE_PLOT.left + 24, CYCLE_PLOT.top + CYCLE_PLOT.height - 46, 150, 30, "Below detection")}
      ${zonePill(CYCLE_PLOT.left + 210, CYCLE_PLOT.top + CYCLE_PLOT.height - 120, 120, 30, "Steep rise")}
      ${zonePill(CYCLE_PLOT.left + 286, CYCLE_PLOT.top + 46, 122, 30, "Plateau")}
    `;
  }

  function renderDnaFragments(cycle) {
    const visibleCount = Math.min(DNA_POSITIONS.length, cycle === 0 ? 3 : 3 + Math.floor(cycle * 0.65));

    dnaCluster.innerHTML = DNA_POSITIONS.slice(0, visibleCount)
      .map(([left, top, rotation, scale], index) => {
        const opacity = Math.min(0.95, 0.52 + index * 0.015);
        return `<span class="dna-fragment" style="left:${left}%; top:${top}%; opacity:${opacity}; transform: translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg);"></span>`;
      })
      .join("");
  }

  function renderCycleInteractive() {
    const cycle = Number(cycleSlider.value);
    const copies = cycleCopies(cycle);
    const phase = cyclePhase(cycle);
    const glow = 0.08 + Math.min(0.28, cycle / 140);
    const fillLevel = 0.48 + Math.min(0.16, cycle / 220);

    cycleOutput.textContent = `${cycle} cycles`;
    phaseReadout.textContent = phase;
    copyReadout.textContent = cycle === 0 ? "3 starting fragments" : `~${asScientific(copies)}`;
    signalReadout.textContent = cycleSignalText(cycle);
    reactionAlert.textContent = cycleAlertText(cycle);
    reactionAlert.classList.toggle("alert-plateau", cycle >= 35);

    tubeLiquid.style.setProperty("--glow-level", glow.toFixed(2));
    tubeLiquid.style.setProperty("--fill-level", fillLevel.toFixed(2));

    renderDnaFragments(cycle);
    renderCyclePlot(cycle);
  }

  function bindCtDragging(svg, mode) {
    svg.classList.add("ct-draggable");

    svg.addEventListener("pointerdown", (event) => {
      activeDragView = { svg, mode };
      const nextThreshold = pointerToThreshold(event, svg, mode);

      if (nextThreshold !== null) {
        thresholdSlider.value = formatNumber(nextThreshold, 2);
        renderCtInteractive();
      }
    });
  }

  thresholdSlider.addEventListener("input", renderCtInteractive);
  shiftSlider.addEventListener("input", renderCtInteractive);
  ctResetButton.addEventListener("click", () => {
    thresholdSlider.value = String(CT_DEFAULTS.threshold);
    shiftSlider.value = String(CT_DEFAULTS.shift);
    renderCtInteractive();
  });

  cycleSlider.addEventListener("input", renderCycleInteractive);
  cycleResetButton.addEventListener("click", () => {
    cycleSlider.value = "0";
    renderCycleInteractive();
  });

  bindCtDragging(linearSvg, "linear");
  bindCtDragging(logSvg, "log");

  window.addEventListener("pointermove", (event) => {
    if (!activeDragView) {
      return;
    }

    const nextThreshold = pointerToThreshold(event, activeDragView.svg, activeDragView.mode);

    if (nextThreshold !== null) {
      thresholdSlider.value = formatNumber(nextThreshold, 2);
      renderCtInteractive();
    }
  });

  window.addEventListener("pointerup", () => {
    activeDragView = null;
  });

  renderCtInteractive();
  renderCycleInteractive();
})();
