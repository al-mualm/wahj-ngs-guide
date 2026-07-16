(function variantRealityCheckModule(globalScope) {
  "use strict";

  const PRESETS = {
    credible: {
      sampleType: "germline",
      variantType: "snv",
      context: "exon",
      build: "GRCh38",
      depth: 38,
      altReads: 18,
      baseQuality: 36,
      mappingQuality: 58,
      strandBalance: 50,
      readPosition: 82,
      duplicateFraction: 4,
      contamination: 0.3,
      tumorPurity: 65,
    },
    "low-depth": {
      sampleType: "germline",
      variantType: "snv",
      context: "exon",
      build: "GRCh38",
      depth: 8,
      altReads: 3,
      baseQuality: 31,
      mappingQuality: 52,
      strandBalance: 67,
      readPosition: 65,
      duplicateFraction: 5,
      contamination: 0.4,
      tumorPurity: 65,
    },
    "strand-bias": {
      sampleType: "germline",
      variantType: "snv",
      context: "exon",
      build: "GRCh38",
      depth: 42,
      altReads: 16,
      baseQuality: 35,
      mappingQuality: 55,
      strandBalance: 94,
      readPosition: 77,
      duplicateFraction: 6,
      contamination: 0.5,
      tumorPurity: 65,
    },
    mosaic: {
      sampleType: "mosaic",
      variantType: "snv",
      context: "exon",
      build: "GRCh38",
      depth: 80,
      altReads: 9,
      baseQuality: 35,
      mappingQuality: 56,
      strandBalance: 56,
      readPosition: 78,
      duplicateFraction: 5,
      contamination: 0.4,
      tumorPurity: 65,
    },
    "tumor-purity": {
      sampleType: "somatic",
      variantType: "snv",
      context: "exon",
      build: "GRCh38",
      depth: 72,
      altReads: 12,
      baseQuality: 34,
      mappingQuality: 54,
      strandBalance: 58,
      readPosition: 73,
      duplicateFraction: 8,
      contamination: 1.2,
      tumorPurity: 24,
    },
    pseudogene: {
      sampleType: "germline",
      variantType: "snv",
      context: "pseudogene",
      build: "GRCh38",
      depth: 58,
      altReads: 24,
      baseQuality: 36,
      mappingQuality: 18,
      strandBalance: 54,
      readPosition: 72,
      duplicateFraction: 10,
      contamination: 0.5,
      tumorPurity: 65,
    },
    homopolymer: {
      sampleType: "germline",
      variantType: "deletion",
      context: "homopolymer",
      build: "GRCh38",
      depth: 44,
      altReads: 13,
      baseQuality: 24,
      mappingQuality: 49,
      strandBalance: 69,
      readPosition: 28,
      duplicateFraction: 7,
      contamination: 0.4,
      tumorPurity: 65,
    },
    dropout: {
      sampleType: "germline",
      variantType: "snv",
      context: "exon",
      build: "GRCh38",
      depth: 0,
      altReads: 0,
      baseQuality: 5,
      mappingQuality: 0,
      strandBalance: 50,
      readPosition: 50,
      duplicateFraction: 0,
      contamination: 0,
      tumorPurity: 65,
    },
  };

  const CONTEXT_LABELS = {
    exon: "Unique coding exon",
    intron: "Intronic region",
    homopolymer: "Homopolymer tract",
    pseudogene: "Pseudogene homology",
    repetitive: "Repetitive / low-mappability region",
  };

  const BUILD_COORDINATES = {
    GRCh38: "chr7:117,559,593",
    GRCh37: "chr7:117,199,644",
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toPercent(value, digits) {
    return `${(value * 100).toFixed(digits)}%`;
  }

  function calculateVaf(depth, altReads) {
    return depth > 0 ? altReads / depth : 0;
  }

  function splitStrandSupport(altReads, forwardPercent) {
    const forward = clamp(Math.round(altReads * (forwardPercent / 100)), 0, altReads);
    return {
      forward,
      reverse: altReads - forward,
    };
  }

  function evaluateEvidence(input) {
    const depth = Number(input.depth);
    const altReads = clamp(Number(input.altReads), 0, depth);
    const vaf = calculateVaf(depth, altReads);
    const severe = [];
    const review = [];

    if (depth === 0) {
      severe.push("No usable reads cover this position; the locus cannot be evaluated.");
    } else if (depth < 10) {
      severe.push("Read depth is too low for this illustrative review threshold.");
    } else if (depth < 20) {
      review.push("Depth is limited and should be assessed against the validated assay threshold.");
    }

    if (depth > 0 && altReads < 2) {
      severe.push("Fewer than two alternate-supporting reads are present.");
    } else if (altReads > 0 && altReads < 5) {
      review.push("Alternate support is sparse and may not be independent.");
    }

    if (Number(input.baseQuality) < 15) {
      severe.push("Alternate base quality is very low.");
    } else if (Number(input.baseQuality) < 30) {
      review.push("Alternate base quality is below the illustrative Q30 teaching target.");
    }

    if (Number(input.mappingQuality) < 10) {
      severe.push("Read placement is highly uncertain.");
    } else if (Number(input.mappingQuality) < 40) {
      review.push("Mapping quality indicates uncertain genomic placement.");
    }

    const strandBalance = Number(input.strandBalance);
    if (altReads >= 4 && (strandBalance < 15 || strandBalance > 85)) {
      review.push("Alternate support is strongly imbalanced between read orientations.");
    }

    if (altReads >= 4 && Number(input.readPosition) < 35) {
      review.push("Alternate observations cluster near read ends.");
    }

    if (Number(input.duplicateFraction) > 25) {
      review.push("A substantial fraction of support may come from duplicate molecules.");
    }

    if (Number(input.contamination) > 5) {
      review.push("Estimated contamination may distort allele fractions and weak calls.");
    } else if (Number(input.contamination) > 2) {
      review.push("Low-level mixture should be reviewed with sample-identity evidence.");
    }

    if (input.context === "pseudogene") {
      review.push("Pseudogene homology can create convincing but misplaced reads.");
    } else if (input.context === "repetitive") {
      review.push("The locus lies in a repetitive or low-mappability context.");
    } else if (input.context === "homopolymer" && input.variantType !== "snv") {
      review.push("Small indels in homopolymers are vulnerable to alignment and sequencing artifacts.");
    }

    if (depth > 0 && altReads > 0) {
      if (input.sampleType === "germline" && (vaf < 0.3 || vaf > 0.7)) {
        review.push("Allele fraction is outside a typical heterozygous germline range.");
      }

      if (input.sampleType === "mosaic") {
        review.push("Possible mosaic calls require assay-specific validation and confirmation.");
        if (vaf < 0.03) {
          review.push("The observed allele fraction is near a low-level detection boundary.");
        }
      }

      if (input.sampleType === "somatic") {
        if (vaf < 0.05) {
          review.push("Low somatic allele fraction requires a validated limit of detection.");
        }
        if (Number(input.tumorPurity) < 30) {
          review.push("Low tumor purity can dilute somatic allele fraction and complicate interpretation.");
        }
      }
    }

    if (severe.length > 0) {
      return {
        level: "stop",
        status: "Insufficient technical evidence",
        concerns: severe.concat(review),
        eligibility: "Do not interpret as a confident variant",
        action: "Resolve coverage or quality limitations, repeat the assay, or use an appropriate orthogonal method.",
      };
    }

    if (review.length > 0) {
      return {
        level: "review",
        status: "Manual review required",
        concerns: review,
        eligibility: "Hold before clinical interpretation",
        action: "Inspect the read evidence, assay validation, genomic context, and confirmation requirements.",
      };
    }

    return {
      level: "pass",
      status: "Pass for interpretation review",
      concerns: ["No major concern detected in this synthetic scenario."],
      eligibility: "Suitable for annotation review",
      action: "Continue to annotation and disease-specific interpretation.",
    };
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return function random() {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function buildPileupReads(input) {
    const depth = Number(input.depth);
    const altReads = clamp(Number(input.altReads), 0, depth);
    const visibleCount = Math.min(depth, 18);
    const visibleAlt = depth > 0 ? Math.round((altReads / depth) * visibleCount) : 0;
    const strand = splitStrandSupport(visibleAlt, Number(input.strandBalance));
    const duplicateCount = Math.round(visibleCount * (Number(input.duplicateFraction) / 100));
    const random = seededRandom(
      depth * 31 +
        altReads * 17 +
        Number(input.mappingQuality) * 11 +
        Number(input.readPosition) * 7
    );
    const reads = [];

    for (let index = 0; index < visibleCount; index += 1) {
      const alt = index < visibleAlt;
      let orientation;

      if (alt) {
        orientation = index < strand.forward ? "forward" : "reverse";
      } else {
        orientation = random() > 0.5 ? "forward" : "reverse";
      }

      const centrality = Number(input.readPosition) / 100;
      let relativePosition = 0.15 + random() * 0.7;
      if (alt) {
        const nearEnd = random() > 0.5 ? 0.08 : 0.92;
        relativePosition = nearEnd * (1 - centrality) + (0.42 + random() * 0.16) * centrality;
      }

      reads.push({
        alt,
        orientation,
        relativePosition,
        duplicate: index >= visibleCount - duplicateCount,
        softClip:
          (input.context === "homopolymer" || input.context === "repetitive") &&
          random() < 0.28,
        mixture: Number(input.contamination) > 2 && random() < Number(input.contamination) / 35,
      });
    }

    return reads;
  }

  function escapeXml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function alternateLabel(variantType) {
    if (variantType === "insertion") {
      return "+A";
    }
    if (variantType === "deletion") {
      return "-A";
    }
    return "T";
  }

  function renderPileupSvg(svg, input) {
    if (!svg) {
      return;
    }

    const reads = buildPileupReads(input);
    const variantX = 520;
    const rowStart = 132;
    const rowGap = 15.4;
    const readWidth = 330;
    const mapQuality = Number(input.mappingQuality);
    const baseQuality = Number(input.baseQuality);
    const readOpacity = 0.32 + (mapQuality / 60) * 0.68;
    const baseOpacity = 0.22 + (baseQuality / 40) * 0.78;
    const dash = mapQuality < 30 ? "7 5" : "0";
    const buildCoordinate = BUILD_COORDINATES[input.build] || BUILD_COORDINATES.GRCh38;
    const coordinateNumber = Number(buildCoordinate.split(":")[1].replaceAll(",", ""));
    const referenceBases = "TCCAGGCTGACCTGAGGCTGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC";
    const baseStartX = 218;
    const baseSpacing = 11;
    const variantBaseIndex = Math.round((variantX - baseStartX) / baseSpacing);
    let markup = `
      <rect x="0" y="0" width="920" height="430" rx="18" fill="transparent"></rect>
      <text x="34" y="35" fill="#57697d" font-size="12" font-weight="800">GENOMIC POSITION</text>
      <line x1="185" y1="58" x2="852" y2="58" stroke="#9aabba" stroke-width="2"></line>
    `;

    for (let tick = 0; tick <= 6; tick += 1) {
      const x = 210 + tick * 105;
      const coordinate = coordinateNumber - 30 + tick * 10;
      markup += `
        <line x1="${x}" y1="52" x2="${x}" y2="66" stroke="#708396" stroke-width="1.5"></line>
        <text x="${x}" y="83" text-anchor="middle" fill="#718294" font-size="10">${coordinate.toLocaleString("en-US")}</text>
      `;
    }

    markup += `
      <line x1="${variantX}" y1="48" x2="${variantX}" y2="395" stroke="#d56555" stroke-width="2" stroke-dasharray="5 5" opacity="0.55"></line>
      <rect x="175" y="94" width="690" height="25" rx="8" fill="#eaf1f5" stroke="#b8c6d1"></rect>
      <text x="34" y="111" fill="#57697d" font-size="12" font-weight="800">REFERENCE</text>
    `;

    for (let index = 0; index < referenceBases.length; index += 1) {
      const x = baseStartX + index * baseSpacing;
      if (x > 850) {
        break;
      }
      const isVariant = index === variantBaseIndex;
      markup += `
        <text x="${x}" y="111" text-anchor="middle" fill="${isVariant ? "#d56555" : "#28465f"}" font-size="10" font-weight="${isVariant ? "900" : "700"}">${referenceBases[index]}</text>
      `;
    }

    markup += `
      <text x="34" y="142" fill="#57697d" font-size="12" font-weight="800">READS</text>
    `;

    if (reads.length === 0) {
      markup += `
        <rect x="175" y="145" width="690" height="170" rx="18" fill="#f9e9e5" stroke="#d56555" stroke-dasharray="7 6"></rect>
        <text x="520" y="215" text-anchor="middle" fill="#8a3d32" font-size="19" font-weight="900">0x coverage</text>
        <text x="520" y="246" text-anchor="middle" fill="#71473f" font-size="13">No read-level evidence is available at this locus.</text>
      `;
    } else {
      reads.forEach((read, index) => {
        const y = rowStart + index * rowGap;
        const relativePosition = clamp(read.relativePosition, 0.05, 0.95);
        const start = variantX - readWidth * relativePosition;
        const end = start + readWidth;
        const color = read.orientation === "forward" ? "#3f78b5" : "#705f9d";
        const direction = read.orientation === "forward" ? 1 : -1;
        const arrowX = direction === 1 ? end : start;
        const arrowPoints =
          direction === 1
            ? `${arrowX},${y} ${arrowX - 8},${y - 4.5} ${arrowX - 8},${y + 4.5}`
            : `${arrowX},${y} ${arrowX + 8},${y - 4.5} ${arrowX + 8},${y + 4.5}`;
        const base = read.alt ? alternateLabel(input.variantType) : "G";
        const baseFill = read.alt ? "#d56555" : "#3e8f79";
        const baseRadius = input.variantType === "snv" ? 7.3 : 10;

        if (read.softClip) {
          const clipStart = direction === 1 ? start - 25 : end;
          const clipEnd = direction === 1 ? start : end + 25;
          markup += `
            <line x1="${clipStart}" y1="${y}" x2="${clipEnd}" y2="${y}" stroke="#bd8d35" stroke-width="5" stroke-dasharray="3 3" opacity="0.78"></line>
          `;
        }

        markup += `
          <line
            x1="${start.toFixed(1)}"
            y1="${y}"
            x2="${end.toFixed(1)}"
            y2="${y}"
            stroke="${color}"
            stroke-width="6"
            stroke-linecap="round"
            stroke-dasharray="${dash}"
            opacity="${readOpacity.toFixed(2)}"
          ></line>
          <polygon points="${arrowPoints}" fill="${color}" opacity="${readOpacity.toFixed(2)}"></polygon>
          <circle cx="${variantX}" cy="${y}" r="${baseRadius}" fill="${baseFill}" stroke="white" stroke-width="2" opacity="${read.alt ? baseOpacity.toFixed(2) : "0.88"}"></circle>
          <text x="${variantX}" y="${y + 3.2}" text-anchor="middle" fill="white" font-size="${input.variantType === "snv" ? "8" : "6.5"}" font-weight="900">${escapeXml(base)}</text>
        `;

        if (read.duplicate) {
          markup += `
            <rect x="${Math.min(end + 8, 870)}" y="${y - 6}" width="18" height="12" rx="4" fill="#bd8d35"></rect>
            <text x="${Math.min(end + 17, 879)}" y="${y + 3}" text-anchor="middle" fill="white" font-size="7" font-weight="900">D</text>
          `;
        }

        if (read.mixture) {
          markup += `
            <circle cx="${variantX + 38}" cy="${y}" r="4.5" fill="#bd8d35" stroke="white" stroke-width="1.5"></circle>
          `;
        }
      });
    }

    const hiddenReads = Math.max(0, Number(input.depth) - reads.length);
    markup += `
      <rect x="175" y="374" width="690" height="31" rx="10" fill="#edf4f7"></rect>
      <text x="195" y="394" fill="#28465f" font-size="11" font-weight="800">
        ${Number(input.depth)} usable reads at the locus
        ${hiddenReads > 0 ? `; ${hiddenReads} additional reads compressed from view` : ""}
      </text>
      <text x="850" y="394" text-anchor="end" fill="#57697d" font-size="10">schematic, not to scale</text>
    `;

    svg.innerHTML = markup;
  }

  function normalSamples(count, mean, standardDeviation, seed) {
    const random = seededRandom(seed);
    const values = [];

    while (values.length < count) {
      const u1 = Math.max(random(), 1e-9);
      const u2 = Math.max(random(), 1e-9);
      const magnitude = Math.sqrt(-2 * Math.log(u1));
      const z0 = magnitude * Math.cos(2 * Math.PI * u2);
      const z1 = magnitude * Math.sin(2 * Math.PI * u2);
      values.push(clamp(mean + z0 * standardDeviation, 0, 100));
      if (values.length < count) {
        values.push(clamp(mean + z1 * standardDeviation, 0, 100));
      }
    }

    return values;
  }

  const BENCHMARK_DATA = {
    easy: {
      truth: normalSamples(800, 82, 10, 101),
      falseCalls: normalSamples(600, 24, 14, 202),
    },
    difficult: {
      truth: normalSamples(200, 59, 18, 303),
      falseCalls: normalSamples(400, 46, 19, 404),
    },
  };

  function combineBenchmarkData() {
    return {
      truth: BENCHMARK_DATA.easy.truth.concat(BENCHMARK_DATA.difficult.truth),
      falseCalls: BENCHMARK_DATA.easy.falseCalls.concat(BENCHMARK_DATA.difficult.falseCalls),
    };
  }

  function calculateBenchmarkMetrics(threshold, region) {
    const source =
      region === "easy" || region === "difficult"
        ? BENCHMARK_DATA[region]
        : combineBenchmarkData();
    const numericThreshold = Number(threshold);
    const truePositives = source.truth.filter((score) => score >= numericThreshold).length;
    const falseNegatives = source.truth.length - truePositives;
    const falsePositives = source.falseCalls.filter((score) => score >= numericThreshold).length;
    const precision =
      truePositives + falsePositives > 0
        ? truePositives / (truePositives + falsePositives)
        : 0;
    const recall = source.truth.length > 0 ? truePositives / source.truth.length : 0;
    const f1 =
      precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      threshold: numericThreshold,
      region,
      truthVariants: source.truth.length,
      truePositives,
      falsePositives,
      falseNegatives,
      precision,
      recall,
      f1,
    };
  }

  function pathFromPoints(points) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(" ");
  }

  function renderBenchmarkChart(svg, threshold, region) {
    if (!svg) {
      return;
    }

    const left = 62;
    const top = 30;
    const width = 650;
    const height = 250;
    const thresholds = Array.from({ length: 51 }, (_, index) => index * 2);
    const precisionPoints = thresholds.map((value) => {
      const metrics = calculateBenchmarkMetrics(value, region);
      return {
        x: left + (value / 100) * width,
        y: top + height - metrics.precision * height,
      };
    });
    const recallPoints = thresholds.map((value) => {
      const metrics = calculateBenchmarkMetrics(value, region);
      return {
        x: left + (value / 100) * width,
        y: top + height - metrics.recall * height,
      };
    });
    const selectedX = left + (Number(threshold) / 100) * width;
    const selected = calculateBenchmarkMetrics(threshold, region);
    const selectedPrecisionY = top + height - selected.precision * height;
    const selectedRecallY = top + height - selected.recall * height;
    let markup = `
      <rect x="0" y="0" width="760" height="350" rx="18" fill="#fbfdfe"></rect>
    `;

    for (let index = 0; index <= 4; index += 1) {
      const ratio = index / 4;
      const y = top + height - ratio * height;
      markup += `
        <line x1="${left}" y1="${y}" x2="${left + width}" y2="${y}" stroke="#dbe5eb" stroke-width="1"></line>
        <text x="${left - 12}" y="${y + 4}" text-anchor="end" fill="#718294" font-size="10">${Math.round(ratio * 100)}%</text>
      `;
    }

    for (let value = 0; value <= 100; value += 20) {
      const x = left + (value / 100) * width;
      markup += `
        <line x1="${x}" y1="${top}" x2="${x}" y2="${top + height}" stroke="#edf2f5" stroke-width="1"></line>
        <text x="${x}" y="${top + height + 24}" text-anchor="middle" fill="#718294" font-size="10">${value}</text>
      `;
    }

    markup += `
      <path d="${pathFromPoints(precisionPoints)}" fill="none" stroke="#2e9bb5" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="${pathFromPoints(recallPoints)}" fill="none" stroke="#d56555" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
      <line x1="${selectedX}" y1="${top}" x2="${selectedX}" y2="${top + height}" stroke="#14283c" stroke-width="2" stroke-dasharray="6 5"></line>
      <circle cx="${selectedX}" cy="${selectedPrecisionY}" r="7" fill="#2e9bb5" stroke="white" stroke-width="3"></circle>
      <circle cx="${selectedX}" cy="${selectedRecallY}" r="7" fill="#d56555" stroke="white" stroke-width="3"></circle>
      <rect x="${clamp(selectedX - 47, left, left + width - 94)}" y="${top + 6}" width="94" height="28" rx="9" fill="#14283c"></rect>
      <text x="${clamp(selectedX, left + 47, left + width - 47)}" y="${top + 25}" text-anchor="middle" fill="white" font-size="11" font-weight="900">threshold ${Number(threshold)}</text>
      <text x="${left + width / 2}" y="330" text-anchor="middle" fill="#28465f" font-size="12" font-weight="800">Variant-quality threshold</text>
    `;

    svg.innerHTML = markup;
  }

  function getEvidenceInput(elements) {
    return {
      sampleType: elements.sampleType.value,
      variantType: elements.variantType.value,
      context: elements.context.value,
      build: elements.build.value,
      depth: Number(elements.depth.value),
      altReads: Number(elements.altReads.value),
      baseQuality: Number(elements.baseQuality.value),
      mappingQuality: Number(elements.mappingQuality.value),
      strandBalance: Number(elements.strandBalance.value),
      readPosition: Number(elements.readPosition.value),
      duplicateFraction: Number(elements.duplicateFraction.value),
      contamination: Number(elements.contamination.value),
      tumorPurity: Number(elements.tumorPurity.value),
    };
  }

  function setEvidenceInput(elements, preset) {
    elements.sampleType.value = preset.sampleType;
    elements.variantType.value = preset.variantType;
    elements.context.value = preset.context;
    elements.build.value = preset.build;
    elements.depth.value = preset.depth;
    elements.altReads.max = preset.depth;
    elements.altReads.value = preset.altReads;
    elements.baseQuality.value = preset.baseQuality;
    elements.mappingQuality.value = preset.mappingQuality;
    elements.strandBalance.value = preset.strandBalance;
    elements.readPosition.value = preset.readPosition;
    elements.duplicateFraction.value = preset.duplicateFraction;
    elements.contamination.value = preset.contamination;
    elements.tumorPurity.value = preset.tumorPurity;
  }

  function updateEvidenceDisplay(elements) {
    const input = getEvidenceInput(elements);
    if (input.altReads > input.depth) {
      elements.altReads.value = input.depth;
      input.altReads = input.depth;
    }
    elements.altReads.max = input.depth;

    const vaf = calculateVaf(input.depth, input.altReads);
    const strands = splitStrandSupport(input.altReads, input.strandBalance);
    const evaluation = evaluateEvidence(input);
    const contextLabel = CONTEXT_LABELS[input.context] || CONTEXT_LABELS.exon;
    const coordinate = BUILD_COORDINATES[input.build] || BUILD_COORDINATES.GRCh38;
    const change =
      input.variantType === "snv"
        ? "G>T"
        : input.variantType === "insertion"
          ? "insA"
          : "delA";

    elements.depthOutput.textContent = `${input.depth}x`;
    elements.altReadsOutput.textContent = `${input.altReads} / ${input.depth}`;
    elements.baseQualityOutput.textContent = `Q${input.baseQuality}`;
    elements.mappingQualityOutput.textContent = `MQ${input.mappingQuality}`;
    elements.strandBalanceOutput.textContent = `${input.strandBalance}%`;
    elements.readPositionOutput.textContent = `${input.readPosition}%`;
    elements.duplicateFractionOutput.textContent = `${input.duplicateFraction}%`;
    elements.contaminationOutput.textContent = `${input.contamination.toFixed(1)}%`;
    elements.tumorPurityOutput.textContent = `${input.tumorPurity}%`;

    elements.tumorPurityControl.classList.toggle(
      "is-visible",
      input.sampleType === "somatic"
    );
    elements.pileupContext.dataset.context = input.context;
    elements.contextLabel.textContent = contextLabel;
    elements.locusBuild.textContent = `${input.build} synthetic locus`;
    elements.locusCoordinate.textContent = `${coordinate} ${change}`;

    elements.metricDepth.textContent = `${input.depth}x`;
    elements.metricAlt.textContent = `${input.altReads} / ${input.depth}`;
    elements.metricVaf.textContent = toPercent(vaf, 1);
    elements.metricStrand.textContent = `${strands.forward} F / ${strands.reverse} R`;

    elements.technicalStatus.textContent = evaluation.status;
    elements.technicalStatus.className = `status-badge status-${evaluation.level}`;
    elements.qualityConcerns.innerHTML = evaluation.concerns
      .map((concern) => `<li>${escapeXml(concern)}</li>`)
      .join("");
    elements.interpretationEligibility.textContent = evaluation.eligibility;
    elements.recommendedAction.textContent = evaluation.action;

    renderPileupSvg(elements.pileupSvg, input);
  }

  function regionLabel(region) {
    if (region === "easy") {
      return "Easy / high-confidence regions";
    }
    if (region === "difficult") {
      return "Difficult genomic regions";
    }
    return "All benchmark regions";
  }

  function thresholdMessage(threshold) {
    if (threshold < 40) {
      return "A sensitive threshold recovers more truth variants but retains more false calls.";
    }
    if (threshold > 65) {
      return "A specific threshold removes many false calls but increases false negatives.";
    }
    return "A balanced threshold retains most true variants while removing many false calls.";
  }

  function benchmarkRow(label, metrics) {
    return `
      <tr>
        <th scope="row">${escapeXml(label)}</th>
        <td>${metrics.truthVariants}</td>
        <td>${metrics.truePositives}</td>
        <td>${metrics.falsePositives}</td>
        <td>${metrics.falseNegatives}</td>
        <td>${toPercent(metrics.precision, 1)}</td>
        <td>${toPercent(metrics.recall, 1)}</td>
        <td>${metrics.f1.toFixed(3)}</td>
      </tr>
    `;
  }

  function updateBenchmarkDisplay(elements) {
    const threshold = Number(elements.threshold.value);
    const region = elements.region.value;
    const metrics = calculateBenchmarkMetrics(threshold, region);
    const easy = calculateBenchmarkMetrics(threshold, "easy");
    const difficult = calculateBenchmarkMetrics(threshold, "difficult");

    elements.thresholdOutput.textContent = String(threshold);
    elements.thresholdMessage.textContent = thresholdMessage(threshold);
    elements.scope.textContent = regionLabel(region);
    elements.truePositives.textContent = String(metrics.truePositives);
    elements.falsePositives.textContent = String(metrics.falsePositives);
    elements.falseNegatives.textContent = String(metrics.falseNegatives);
    elements.precision.textContent = toPercent(metrics.precision, 1);
    elements.recall.textContent = toPercent(metrics.recall, 1);
    elements.f1.textContent = metrics.f1.toFixed(3);
    elements.tableBody.innerHTML =
      benchmarkRow("Easy / high-confidence", easy) +
      benchmarkRow("Difficult regions", difficult);

    elements.thresholdPresets.forEach((button) => {
      button.classList.toggle("is-active", Number(button.dataset.threshold) === threshold);
    });

    renderBenchmarkChart(elements.chart, threshold, region);
  }

  function benchmarkCsv(threshold) {
    const rows = [
      [
        "Region group",
        "Threshold",
        "Truth variants",
        "True positives",
        "False positives",
        "False negatives",
        "Precision",
        "Recall",
        "F1 score",
      ],
    ];

    [
      ["All benchmark regions", "all"],
      ["Easy / high-confidence regions", "easy"],
      ["Difficult genomic regions", "difficult"],
    ].forEach(([label, region]) => {
      const metrics = calculateBenchmarkMetrics(threshold, region);
      rows.push([
        label,
        metrics.threshold,
        metrics.truthVariants,
        metrics.truePositives,
        metrics.falsePositives,
        metrics.falseNegatives,
        metrics.precision.toFixed(4),
        metrics.recall.toFixed(4),
        metrics.f1.toFixed(4),
      ]);
    });

    return rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");
  }

  function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function initializeTabs() {
    const tabs = Array.from(document.querySelectorAll("[data-lab-tab]"));
    const panels = Array.from(document.querySelectorAll("[data-lab-panel]"));

    function activate(tab) {
      const target = tab.dataset.labTab;
      tabs.forEach((candidate) => {
        const active = candidate === tab;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-selected", String(active));
        candidate.tabIndex = active ? 0 : -1;
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.labPanel !== target;
      });
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
          return;
        }
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const next = tabs[(index + direction + tabs.length) % tabs.length];
        activate(next);
        next.focus();
      });
    });

    const requestedTab = new URLSearchParams(globalScope.location.search).get("tab");
    const initialTab = tabs.find((tab) => tab.dataset.labTab === requestedTab);
    if (initialTab) {
      activate(initialTab);
    }
  }

  function initializeEvidenceLab() {
    const elements = {
      sampleType: document.querySelector("#sample-type"),
      variantType: document.querySelector("#variant-type"),
      context: document.querySelector("#genomic-context"),
      build: document.querySelector("#reference-build"),
      depth: document.querySelector("#read-depth"),
      altReads: document.querySelector("#alt-reads"),
      baseQuality: document.querySelector("#base-quality"),
      mappingQuality: document.querySelector("#mapping-quality"),
      strandBalance: document.querySelector("#strand-balance"),
      readPosition: document.querySelector("#read-position"),
      duplicateFraction: document.querySelector("#duplicate-fraction"),
      contamination: document.querySelector("#contamination"),
      tumorPurity: document.querySelector("#tumor-purity"),
      depthOutput: document.querySelector("#read-depth-output"),
      altReadsOutput: document.querySelector("#alt-reads-output"),
      baseQualityOutput: document.querySelector("#base-quality-output"),
      mappingQualityOutput: document.querySelector("#mapping-quality-output"),
      strandBalanceOutput: document.querySelector("#strand-balance-output"),
      readPositionOutput: document.querySelector("#read-position-output"),
      duplicateFractionOutput: document.querySelector("#duplicate-fraction-output"),
      contaminationOutput: document.querySelector("#contamination-output"),
      tumorPurityOutput: document.querySelector("#tumor-purity-output"),
      tumorPurityControl: document.querySelector("#tumor-purity-control"),
      pileupContext: document.querySelector("#pileup-context"),
      pileupFrame: document.querySelector(".pileup-frame"),
      contextLabel: document.querySelector(".context-label"),
      locusBuild: document.querySelector("#locus-build"),
      locusCoordinate: document.querySelector("#locus-coordinate"),
      pileupSvg: document.querySelector("#pileup-svg"),
      technicalStatus: document.querySelector("#technical-status"),
      metricDepth: document.querySelector("#metric-depth"),
      metricAlt: document.querySelector("#metric-alt"),
      metricVaf: document.querySelector("#metric-vaf"),
      metricStrand: document.querySelector("#metric-strand"),
      qualityConcerns: document.querySelector("#quality-concerns"),
      interpretationEligibility: document.querySelector("#interpretation-eligibility"),
      recommendedAction: document.querySelector("#recommended-action"),
    };

    const interactiveInputs = [
      elements.sampleType,
      elements.variantType,
      elements.context,
      elements.build,
      elements.depth,
      elements.altReads,
      elements.baseQuality,
      elements.mappingQuality,
      elements.strandBalance,
      elements.readPosition,
      elements.duplicateFraction,
      elements.contamination,
      elements.tumorPurity,
    ];

    interactiveInputs.forEach((input) => {
      input.addEventListener("input", () => {
        document.querySelectorAll("[data-preset]").forEach((button) => {
          button.classList.remove("is-active");
        });
        updateEvidenceDisplay(elements);
      });
      input.addEventListener("change", () => updateEvidenceDisplay(elements));
    });

    document.querySelectorAll("[data-preset]").forEach((button) => {
      button.addEventListener("click", () => {
        const preset = PRESETS[button.dataset.preset];
        if (!preset) {
          return;
        }
        setEvidenceInput(elements, preset);
        document.querySelectorAll("[data-preset]").forEach((candidate) => {
          candidate.classList.toggle("is-active", candidate === button);
        });
        updateEvidenceDisplay(elements);
      });
    });

    document.querySelector("#reset-evidence").addEventListener("click", () => {
      setEvidenceInput(elements, PRESETS.credible);
      document.querySelectorAll("[data-preset]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.preset === "credible");
      });
      updateEvidenceDisplay(elements);
    });

    updateEvidenceDisplay(elements);

    if (
      globalScope.matchMedia &&
      globalScope.matchMedia("(max-width: 780px)").matches &&
      elements.pileupFrame
    ) {
      globalScope.requestAnimationFrame(() => {
        elements.pileupFrame.scrollLeft =
          (elements.pileupFrame.scrollWidth - elements.pileupFrame.clientWidth) * 0.58;
      });
    }
  }

  function initializeBenchmarkLab() {
    const elements = {
      threshold: document.querySelector("#quality-threshold"),
      thresholdOutput: document.querySelector("#threshold-output"),
      thresholdMessage: document.querySelector("#threshold-message"),
      thresholdPresets: Array.from(document.querySelectorAll("[data-threshold]")),
      region: document.querySelector("#benchmark-region"),
      chart: document.querySelector("#benchmark-chart"),
      scope: document.querySelector("#benchmark-scope"),
      truePositives: document.querySelector("#benchmark-tp"),
      falsePositives: document.querySelector("#benchmark-fp"),
      falseNegatives: document.querySelector("#benchmark-fn"),
      precision: document.querySelector("#benchmark-precision"),
      recall: document.querySelector("#benchmark-recall"),
      f1: document.querySelector("#benchmark-f1"),
      tableBody: document.querySelector("#benchmark-table-body"),
    };

    elements.threshold.addEventListener("input", () => updateBenchmarkDisplay(elements));
    elements.region.addEventListener("change", () => updateBenchmarkDisplay(elements));
    elements.thresholdPresets.forEach((button) => {
      button.addEventListener("click", () => {
        elements.threshold.value = button.dataset.threshold;
        updateBenchmarkDisplay(elements);
      });
    });

    document.querySelector("#export-benchmark").addEventListener("click", () => {
      const threshold = Number(elements.threshold.value);
      downloadTextFile(
        benchmarkCsv(threshold),
        `wahj_variant_benchmark_threshold_${threshold}.csv`,
        "text/csv;charset=utf-8"
      );
    });

    updateBenchmarkDisplay(elements);
  }

  function initializeEmbedResize() {
    const embedded =
      new URLSearchParams(globalScope.location.search).get("embed") === "1" &&
      globalScope.parent !== globalScope;
    if (!embedded) {
      return;
    }

    let lastHeight = 0;
    let frame = null;
    const reportHeight = () => {
      if (frame) {
        globalScope.cancelAnimationFrame(frame);
      }
      frame = globalScope.requestAnimationFrame(() => {
        // documentElement.scrollHeight is never shorter than the iframe viewport,
        // so it cannot shrink a generous fallback height. The body tracks the
        // rendered laboratory content and still grows when a tab becomes taller.
        const height = Math.ceil(document.body.scrollHeight);
        if (Math.abs(height - lastHeight) < 2) {
          return;
        }
        lastHeight = height;
        globalScope.parent.postMessage(
          {
            source: "wahj-variant-reality",
            type: "resize",
            height,
          },
          "*"
        );
      });
    };

    if ("ResizeObserver" in globalScope) {
      const observer = new ResizeObserver(reportHeight);
      observer.observe(document.body);
    }
    globalScope.addEventListener("load", reportHeight);
    document.addEventListener("click", reportHeight);
    reportHeight();
  }

  function initialize() {
    initializeTabs();
    initializeEvidenceLab();
    initializeBenchmarkLab();
    initializeEmbedResize();
  }

  const publicApi = {
    PRESETS,
    calculateVaf,
    splitStrandSupport,
    evaluateEvidence,
    buildPileupReads,
    calculateBenchmarkMetrics,
    benchmarkCsv,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = publicApi;
  }

  globalScope.VariantRealityCheck = publicApi;

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initialize);
    } else {
      initialize();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
