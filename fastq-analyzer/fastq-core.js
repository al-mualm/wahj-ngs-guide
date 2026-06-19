(function exposeFastqCore(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FastqAnalyzerCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function buildFastqCore() {
  const ADAPTERS = [
    {
      name: "Illumina universal adapter",
      sequence: "AGATCGGAAGAGC",
      minimumMatch: 12,
    },
    {
      name: "Nextera transposase adapter",
      sequence: "CTGTCTCTTATACACATCT",
      minimumMatch: 14,
    },
    {
      name: "Illumina P5 flow-cell sequence",
      sequence: "AATGATACGGCGACCACCGAGATCTACAC",
      minimumMatch: 16,
    },
    {
      name: "Illumina P7 flow-cell sequence",
      sequence: "CAAGCAGAAGACGGCATACGAGAT",
      minimumMatch: 16,
    },
    {
      name: "Poly-G tail warning",
      sequence: "GGGGGGGGGGGGGGGGGGGG",
      minimumMatch: 18,
    },
  ];

  const BASE_KEYS = ["A", "C", "G", "T", "N", "other"];

  function round(value, digits = 2) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function percent(part, total, digits = 2) {
    if (!total) {
      return 0;
    }
    return round((part / total) * 100, digits);
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) {
      return "0";
    }
    return String(round(value, 2));
  }

  function createCycleStat(position) {
    return {
      position,
      count: 0,
      qSum: 0,
      q20: 0,
      q30: 0,
      baseCounts: {
        A: 0,
        C: 0,
        G: 0,
        T: 0,
        N: 0,
        other: 0,
      },
    };
  }

  function createAggregate(label) {
    return {
      label,
      reads: 0,
      bases: 0,
      canonicalBases: 0,
      gcBases: 0,
      nBases: 0,
      otherBases: 0,
      qSum: 0,
      q20Bases: 0,
      q30Bases: 0,
      lowQualityReads: 0,
      readsWithN: 0,
      readsWithAdapter: 0,
      readLengthSum: 0,
      readLengthSquaredSum: 0,
      minReadLength: Infinity,
      maxReadLength: 0,
      minAscii: Infinity,
      maxAscii: 0,
      qualityCharCount: 0,
      negativeQualityCount: 0,
      highQualityOutlierCount: 0,
      invalidBaseReads: 0,
      sequenceCounts: new Map(),
      sequenceTrackingLimitReached: false,
      adapterHits: new Map(),
      lengthBins: new Map(),
      gcBins: new Map(),
      readQualityBins: new Map(),
      cycles: [],
      parseErrors: [],
      parseWarnings: [],
      encoding: null,
    };
  }

  function incrementMap(map, key, amount = 1, start = 0) {
    const existing = map.get(key) || { label: key, start, count: 0 };
    existing.count += amount;
    map.set(key, existing);
  }

  function makeRangeBin(value, width, maximum = null) {
    const numericValue = Number(value) || 0;
    const capped = maximum === null ? numericValue : Math.min(maximum, numericValue);
    const start = Math.floor(capped / width) * width;
    const end = maximum !== null && start + width >= maximum ? maximum : start + width - 1;
    return {
      label: start === end ? String(start) : `${start}-${end}`,
      start,
    };
  }

  function sequenceHash(sequence) {
    let hash = 5381;
    for (let index = 0; index < sequence.length; index += 1) {
      hash = ((hash << 5) + hash + sequence.charCodeAt(index)) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  function makeSequenceKey(sequence) {
    if (sequence.length <= 120) {
      return sequence;
    }
    return `${sequence.slice(0, 72)}...${sequence.slice(-24)}#${sequenceHash(sequence)}`;
  }

  function normalizeQualityOffset(value) {
    if (value === 64 || value === "64" || value === "phred64") {
      return 64;
    }
    if (value === 33 || value === "33" || value === "phred33") {
      return 33;
    }
    return "auto";
  }

  function estimateQualityOffsetFromAggregate(aggregate, requestedOffset) {
    const normalized = normalizeQualityOffset(requestedOffset);
    if (normalized === 33 || normalized === 64) {
      return {
        offset: normalized,
        label: `Phred+${normalized}`,
        confidence: "manual",
        minAscii: aggregate.minAscii === Infinity ? 0 : aggregate.minAscii,
        maxAscii: aggregate.maxAscii,
      };
    }

    if (!aggregate.qualityCharCount) {
      return {
        offset: 33,
        label: "Phred+33",
        confidence: "empty",
        minAscii: 0,
        maxAscii: 0,
      };
    }

    const minAscii = aggregate.minAscii;
    const maxAscii = aggregate.maxAscii;
    if (minAscii >= 64 && maxAscii > 74) {
      return {
        offset: 64,
        label: "Possible Phred+64",
        confidence: "estimated",
        minAscii,
        maxAscii,
      };
    }

    return {
      offset: 33,
      label: minAscii >= 64 ? "Phred+33 assumed; encoding is ambiguous" : "Phred+33",
      confidence: minAscii >= 64 ? "ambiguous" : "estimated",
      minAscii,
      maxAscii,
    };
  }

  function scanQualityAscii(records, aggregate) {
    records.forEach((record) => {
      for (let index = 0; index < record.quality.length; index += 1) {
        const code = record.quality.charCodeAt(index);
        aggregate.minAscii = Math.min(aggregate.minAscii, code);
        aggregate.maxAscii = Math.max(aggregate.maxAscii, code);
        aggregate.qualityCharCount += 1;
      }
    });
  }

  function getBaseKey(base) {
    if (base === "A" || base === "C" || base === "G" || base === "T" || base === "N") {
      return base;
    }
    if (base === "U") {
      return "T";
    }
    return "other";
  }

  function getAdapterMatches(sequence) {
    const matches = [];
    ADAPTERS.forEach((adapter) => {
      const probeLength = Math.min(adapter.sequence.length, adapter.minimumMatch);
      const probe = adapter.sequence.slice(0, probeLength);
      if (sequence.includes(probe)) {
        matches.push(adapter.name);
      }
    });
    return matches;
  }

  function updateAggregateWithRecord(aggregate, record, qualityOffset, options) {
    const sequence = record.sequence;
    const quality = record.quality;
    const readLength = sequence.length;
    const readQualityScores = [];
    const baseCounts = {
      A: 0,
      C: 0,
      G: 0,
      T: 0,
      N: 0,
      other: 0,
    };
    let readQSum = 0;

    aggregate.reads += 1;
    aggregate.bases += readLength;
    aggregate.readLengthSum += readLength;
    aggregate.readLengthSquaredSum += readLength * readLength;
    aggregate.minReadLength = Math.min(aggregate.minReadLength, readLength);
    aggregate.maxReadLength = Math.max(aggregate.maxReadLength, readLength);

    for (let index = 0; index < readLength; index += 1) {
      const base = getBaseKey(sequence[index]);
      const qScore = Math.max(0, quality.charCodeAt(index) - qualityOffset);
      const cycleStat = aggregate.cycles[index] || createCycleStat(index + 1);

      if (!aggregate.cycles[index]) {
        aggregate.cycles[index] = cycleStat;
      }

      if (quality.charCodeAt(index) - qualityOffset < 0) {
        aggregate.negativeQualityCount += 1;
      }
      if (qScore > 62) {
        aggregate.highQualityOutlierCount += 1;
      }

      baseCounts[base] += 1;
      cycleStat.count += 1;
      cycleStat.qSum += qScore;
      cycleStat.q20 += qScore >= 20 ? 1 : 0;
      cycleStat.q30 += qScore >= 30 ? 1 : 0;
      cycleStat.baseCounts[base] += 1;

      readQSum += qScore;
      readQualityScores.push(qScore);
      aggregate.qSum += qScore;
      aggregate.q20Bases += qScore >= 20 ? 1 : 0;
      aggregate.q30Bases += qScore >= 30 ? 1 : 0;
    }

    aggregate.gcBases += baseCounts.G + baseCounts.C;
    aggregate.canonicalBases += baseCounts.A + baseCounts.C + baseCounts.G + baseCounts.T;
    aggregate.nBases += baseCounts.N;
    aggregate.otherBases += baseCounts.other;
    aggregate.readsWithN += baseCounts.N > 0 ? 1 : 0;
    aggregate.invalidBaseReads += baseCounts.other > 0 ? 1 : 0;

    const meanReadQuality = readLength ? readQSum / readLength : 0;
    aggregate.lowQualityReads += meanReadQuality < 20 ? 1 : 0;

    const lengthBin = makeRangeBin(readLength, options.lengthBinWidth || 25);
    incrementMap(aggregate.lengthBins, lengthBin.label, 1, lengthBin.start);

    const readGcPercent = percent(baseCounts.G + baseCounts.C, baseCounts.A + baseCounts.C + baseCounts.G + baseCounts.T);
    const gcBin = makeRangeBin(readGcPercent, options.gcBinWidth || 5, 100);
    incrementMap(aggregate.gcBins, gcBin.label, 1, gcBin.start);

    const qualityBin = makeRangeBin(meanReadQuality, options.qualityBinWidth || 5, 60);
    incrementMap(aggregate.readQualityBins, qualityBin.label, 1, qualityBin.start);

    if (!aggregate.sequenceTrackingLimitReached || aggregate.sequenceCounts.has(makeSequenceKey(sequence))) {
      const sequenceKey = makeSequenceKey(sequence);
      if (!aggregate.sequenceCounts.has(sequenceKey) && aggregate.sequenceCounts.size >= options.maxTrackedSequences) {
        aggregate.sequenceTrackingLimitReached = true;
      } else {
        const existing = aggregate.sequenceCounts.get(sequenceKey) || {
          sequence: sequenceKey,
          length: readLength,
          count: 0,
        };
        existing.count += 1;
        aggregate.sequenceCounts.set(sequenceKey, existing);
      }
    }

    const adapterMatches = getAdapterMatches(sequence);
    if (adapterMatches.length) {
      aggregate.readsWithAdapter += 1;
      adapterMatches.forEach((adapterName) => {
        const existing = aggregate.adapterHits.get(adapterName) || {
          name: adapterName,
          count: 0,
        };
        existing.count += 1;
        aggregate.adapterHits.set(adapterName, existing);
      });
    }
  }

  function rowsFromMap(map) {
    return Array.from(map.values()).sort((a, b) => a.start - b.start || a.label.localeCompare(b.label));
  }

  function summarizeCycles(cycles) {
    return cycles
      .filter(Boolean)
      .map((cycle) => {
        const row = {
          cycle: cycle.position,
          count: cycle.count,
          meanQ: round(cycle.qSum / cycle.count),
          q20Pct: percent(cycle.q20, cycle.count),
          q30Pct: percent(cycle.q30, cycle.count),
        };
        BASE_KEYS.forEach((base) => {
          row[`${base}Pct`] = percent(cycle.baseCounts[base], cycle.count);
          row[base] = cycle.baseCounts[base];
        });
        return row;
      });
  }

  function summarizeOverrepresentedSequences(aggregate) {
    return Array.from(aggregate.sequenceCounts.values())
      .filter((row) => row.count > 1)
      .sort((a, b) => b.count - a.count || a.sequence.localeCompare(b.sequence))
      .slice(0, 20)
      .map((row) => ({
        sequence: row.sequence,
        length: row.length,
        count: row.count,
        pct: percent(row.count, aggregate.reads),
      }));
  }

  function summarizeAdapters(aggregate) {
    return Array.from(aggregate.adapterHits.values())
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .map((row) => ({
        name: row.name,
        count: row.count,
        pct: percent(row.count, aggregate.reads),
      }));
  }

  function buildWarnings(aggregate, metrics) {
    const warnings = [];
    const add = (severity, message) => warnings.push({ severity, message });

    aggregate.parseErrors.forEach((message) => add("fail", message));
    aggregate.parseWarnings.forEach((message) => add("warn", message));

    if (!aggregate.reads) {
      add("fail", "No complete FASTQ records were detected.");
      return warnings;
    }

    if (metrics.meanQuality < 20) {
      add("fail", `Mean read quality is low (Q${formatNumber(metrics.meanQuality)}).`);
    } else if (metrics.meanQuality < 25) {
      add("warn", `Mean read quality is moderate (Q${formatNumber(metrics.meanQuality)}).`);
    }

    if (metrics.q30Pct < 60) {
      add("warn", `Q30 base percentage is below 60% (${formatNumber(metrics.q30Pct)}%).`);
    }

    if (metrics.nPct > 5) {
      add("warn", `N content is above 5% (${formatNumber(metrics.nPct)}%).`);
    }

    if (metrics.otherBasePct > 0) {
      add("warn", `Unexpected non-ACGTN bases were found (${formatNumber(metrics.otherBasePct)}%).`);
    }

    if (metrics.readsWithAdapterPct > 1) {
      add("warn", `Adapter-like sequence was detected in ${formatNumber(metrics.readsWithAdapterPct)}% of reads.`);
    }

    if (metrics.readLengthCvPct > 20 && aggregate.reads > 20) {
      add("warn", `Read lengths vary substantially (CV ${formatNumber(metrics.readLengthCvPct)}%).`);
    }

    if (aggregate.negativeQualityCount > 0) {
      add("warn", "Some quality characters produced negative scores with the selected encoding.");
    }

    if (aggregate.highQualityOutlierCount > 0) {
      add("warn", "Some quality scores are unusually high; check whether the encoding is correct.");
    }

    if (aggregate.sequenceTrackingLimitReached) {
      add("warn", "The overrepresented-sequence table was capped to limit browser memory use.");
    }

    return warnings;
  }

  function statusFromWarnings(warnings) {
    if (warnings.some((warning) => warning.severity === "fail")) {
      return "fail";
    }
    if (warnings.length) {
      return "warn";
    }
    return "pass";
  }

  function summarizeAggregate(aggregate) {
    const reads = aggregate.reads;
    const meanReadLength = reads ? aggregate.readLengthSum / reads : 0;
    const variance =
      reads > 1 ? aggregate.readLengthSquaredSum / reads - meanReadLength * meanReadLength : 0;
    const readLengthSd = Math.sqrt(Math.max(0, variance));
    const metrics = {
      reads,
      bases: aggregate.bases,
      meanReadLength: round(meanReadLength),
      minReadLength: reads ? aggregate.minReadLength : 0,
      maxReadLength: aggregate.maxReadLength,
      readLengthSd: round(readLengthSd),
      readLengthCvPct: meanReadLength ? round((readLengthSd / meanReadLength) * 100) : 0,
      gcPct: percent(aggregate.gcBases, aggregate.canonicalBases),
      nPct: percent(aggregate.nBases, aggregate.bases),
      otherBasePct: percent(aggregate.otherBases, aggregate.bases),
      meanQuality: round(aggregate.qSum / aggregate.bases),
      q20Pct: percent(aggregate.q20Bases, aggregate.bases),
      q30Pct: percent(aggregate.q30Bases, aggregate.bases),
      lowQualityReadsPct: percent(aggregate.lowQualityReads, reads),
      readsWithNPct: percent(aggregate.readsWithN, reads),
      readsWithAdapterPct: percent(aggregate.readsWithAdapter, reads),
    };
    const warnings = buildWarnings(aggregate, metrics);
    return {
      label: aggregate.label,
      metrics,
      status: statusFromWarnings(warnings),
      encoding: aggregate.encoding || {
        offset: 33,
        label: "Phred+33",
        confidence: "default",
        minAscii: 0,
        maxAscii: 0,
      },
      warnings,
      perCycle: summarizeCycles(aggregate.cycles),
      lengthDistribution: rowsFromMap(aggregate.lengthBins),
      gcDistribution: rowsFromMap(aggregate.gcBins),
      readQualityDistribution: rowsFromMap(aggregate.readQualityBins),
      overrepresentedSequences: summarizeOverrepresentedSequences(aggregate),
      adapterHits: summarizeAdapters(aggregate),
    };
  }

  function parseFastq(text, options = {}) {
    const fileName = options.fileName || "input.fastq";
    const maxRecords = Number(options.maxRecords || 0);
    const records = [];
    const errors = [];
    const warnings = [];
    const normalizedText = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalizedText.split("\n");
    let index = 0;
    let recordNumber = 0;

    while (index < lines.length) {
      while (index < lines.length && lines[index].trim() === "") {
        index += 1;
      }

      if (index >= lines.length) {
        break;
      }

      const headerLineNumber = index + 1;
      const header = lines[index];
      if (!header.startsWith("@")) {
        errors.push(`${fileName}: expected FASTQ header starting with @ at line ${headerLineNumber}.`);
        break;
      }

      index += 1;
      const sequenceParts = [];
      while (index < lines.length && !lines[index].startsWith("+")) {
        const sequenceLine = lines[index].trim();
        if (sequenceLine) {
          sequenceParts.push(sequenceLine);
        }
        index += 1;
      }

      if (index >= lines.length) {
        errors.push(`${fileName}: missing + separator after record starting at line ${headerLineNumber}.`);
        break;
      }

      const plusLine = lines[index];
      if (!plusLine.startsWith("+")) {
        errors.push(`${fileName}: invalid + separator near line ${index + 1}.`);
        break;
      }

      index += 1;
      const sequence = sequenceParts.join("").replace(/\s+/g, "").toUpperCase();
      const qualityParts = [];
      let qualityLength = 0;

      while (index < lines.length && qualityLength < sequence.length) {
        const qualityLine = lines[index];
        qualityParts.push(qualityLine);
        qualityLength += qualityLine.length;
        index += 1;
      }

      const quality = qualityParts.join("");
      if (!sequence.length) {
        errors.push(`${fileName}: empty sequence in record starting at line ${headerLineNumber}.`);
        continue;
      }

      if (quality.length !== sequence.length) {
        errors.push(
          `${fileName}: sequence and quality lengths differ in record starting at line ${headerLineNumber} (${sequence.length} bases vs ${quality.length} qualities).`
        );
        continue;
      }

      recordNumber += 1;
      records.push({
        header: header.slice(1).trim() || `record_${recordNumber}`,
        sequence,
        quality,
        lineNumber: headerLineNumber,
      });

      if (maxRecords && records.length >= maxRecords) {
        warnings.push(`${fileName}: analysis stopped after ${maxRecords.toLocaleString()} records by user limit.`);
        break;
      }
    }

    return {
      fileName,
      records,
      errors,
      warnings,
    };
  }

  function analyzeParsedFastq(parsed, options, overallAggregate) {
    const fileAggregate = createAggregate(parsed.fileName);
    const maxTrackedSequences = Number(options.maxTrackedSequences || 20000);
    const analysisOptions = {
      lengthBinWidth: Number(options.lengthBinWidth || 25),
      gcBinWidth: Number(options.gcBinWidth || 5),
      qualityBinWidth: Number(options.qualityBinWidth || 5),
      maxTrackedSequences,
    };

    fileAggregate.parseErrors.push(...parsed.errors);
    fileAggregate.parseWarnings.push(...parsed.warnings);
    scanQualityAscii(parsed.records, fileAggregate);
    const encoding = estimateQualityOffsetFromAggregate(fileAggregate, options.qualityOffset);
    fileAggregate.encoding = encoding;

    parsed.records.forEach((record) => {
      updateAggregateWithRecord(fileAggregate, record, encoding.offset, analysisOptions);
      if (overallAggregate) {
        updateAggregateWithRecord(overallAggregate, record, encoding.offset, analysisOptions);
      }
    });

    if (overallAggregate) {
      overallAggregate.parseErrors.push(...parsed.errors);
      overallAggregate.parseWarnings.push(...parsed.warnings);
      overallAggregate.minAscii = Math.min(overallAggregate.minAscii, fileAggregate.minAscii);
      overallAggregate.maxAscii = Math.max(overallAggregate.maxAscii, fileAggregate.maxAscii);
      overallAggregate.qualityCharCount += fileAggregate.qualityCharCount;
    }

    return summarizeAggregate(fileAggregate);
  }

  function analyzeFastqTexts(inputs, options = {}) {
    const normalizedInputs = Array.isArray(inputs) ? inputs : [];
    const overallAggregate = createAggregate("All FASTQ files");
    const files = normalizedInputs.map((input, index) => {
      const parsed = parseFastq(input.text, {
        fileName: input.fileName || `input-${index + 1}.fastq`,
        maxRecords: options.maxRecords,
      });
      return analyzeParsedFastq(parsed, options, overallAggregate);
    });

    overallAggregate.encoding = estimateQualityOffsetFromAggregate(
      overallAggregate,
      options.qualityOffset
    );

    const overall = summarizeAggregate(overallAggregate);
    return {
      generatedAt: new Date().toISOString(),
      options: {
        qualityOffset: normalizeQualityOffset(options.qualityOffset),
        maxRecords: Number(options.maxRecords || 0),
      },
      overall,
      files,
    };
  }

  function analyzeFastqText(text, options = {}) {
    return analyzeFastqTexts(
      [
        {
          fileName: options.fileName || "input.fastq",
          text,
        },
      ],
      options
    );
  }

  function buildSummaryCsv(result) {
    const rows = [
      [
        "file",
        "status",
        "reads",
        "bases",
        "mean_read_length",
        "min_read_length",
        "max_read_length",
        "gc_percent",
        "n_percent",
        "mean_quality",
        "q20_percent",
        "q30_percent",
        "reads_with_adapter_percent",
        "encoding",
      ],
    ];

    result.files.forEach((file) => {
      const metrics = file.metrics;
      rows.push([
        file.label,
        file.status,
        metrics.reads,
        metrics.bases,
        metrics.meanReadLength,
        metrics.minReadLength,
        metrics.maxReadLength,
        metrics.gcPct,
        metrics.nPct,
        metrics.meanQuality,
        metrics.q20Pct,
        metrics.q30Pct,
        metrics.readsWithAdapterPct,
        file.encoding.label,
      ]);
    });

    return rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");
            return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
          })
          .join(",")
      )
      .join("\n");
  }

  function buildTextReport(result) {
    const metrics = result.overall.metrics;
    const warningLines = result.overall.warnings.length
      ? result.overall.warnings.map((warning) => `- ${warning.severity.toUpperCase()}: ${warning.message}`)
      : ["- No major FASTQ QC warnings were detected."];

    return [
      "FASTQ QC Analysis Report",
      `Generated: ${result.generatedAt}`,
      "",
      "Overall summary",
      `Reads: ${metrics.reads.toLocaleString()}`,
      `Bases: ${metrics.bases.toLocaleString()}`,
      `Mean read length: ${formatNumber(metrics.meanReadLength)} bp`,
      `GC content: ${formatNumber(metrics.gcPct)}%`,
      `N content: ${formatNumber(metrics.nPct)}%`,
      `Mean base quality: Q${formatNumber(metrics.meanQuality)}`,
      `Q20 bases: ${formatNumber(metrics.q20Pct)}%`,
      `Q30 bases: ${formatNumber(metrics.q30Pct)}%`,
      `Reads with adapter-like sequence: ${formatNumber(metrics.readsWithAdapterPct)}%`,
      "",
      "Warnings",
      ...warningLines,
      "",
      "File summaries",
      ...result.files.map((file) => {
        const fileMetrics = file.metrics;
        return `${file.label}: ${fileMetrics.reads.toLocaleString()} reads, ${formatNumber(
          fileMetrics.gcPct
        )}% GC, Q${formatNumber(fileMetrics.meanQuality)}, ${formatNumber(fileMetrics.q30Pct)}% Q30`;
      }),
    ].join("\n");
  }

  return {
    ADAPTERS,
    parseFastq,
    analyzeFastqText,
    analyzeFastqTexts,
    buildSummaryCsv,
    buildTextReport,
    round,
    percent,
  };
});
