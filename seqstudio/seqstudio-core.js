(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  root.SeqStudioCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const IUPAC_MAP = {
    A: ["A"],
    C: ["C"],
    G: ["G"],
    T: ["T"],
    U: ["T"],
    R: ["A", "G"],
    Y: ["C", "T"],
    S: ["G", "C"],
    W: ["A", "T"],
    K: ["G", "T"],
    M: ["A", "C"],
    B: ["C", "G", "T"],
    D: ["A", "G", "T"],
    H: ["A", "C", "T"],
    V: ["A", "C", "G"],
    N: ["A", "C", "G", "T"],
    "-": ["-"],
  };

  const COMPLEMENT_MAP = {
    A: "T",
    T: "A",
    C: "G",
    G: "C",
    U: "A",
    R: "Y",
    Y: "R",
    S: "S",
    W: "W",
    K: "M",
    M: "K",
    B: "V",
    D: "H",
    H: "D",
    V: "B",
    N: "N",
    "-": "-",
  };

  const CODON_TABLE = {
    TTT: "F",
    TTC: "F",
    TTA: "L",
    TTG: "L",
    TCT: "S",
    TCC: "S",
    TCA: "S",
    TCG: "S",
    TAT: "Y",
    TAC: "Y",
    TAA: "*",
    TAG: "*",
    TGT: "C",
    TGC: "C",
    TGA: "*",
    TGG: "W",
    CTT: "L",
    CTC: "L",
    CTA: "L",
    CTG: "L",
    CCT: "P",
    CCC: "P",
    CCA: "P",
    CCG: "P",
    CAT: "H",
    CAC: "H",
    CAA: "Q",
    CAG: "Q",
    CGT: "R",
    CGC: "R",
    CGA: "R",
    CGG: "R",
    ATT: "I",
    ATC: "I",
    ATA: "I",
    ATG: "M",
    ACT: "T",
    ACC: "T",
    ACA: "T",
    ACG: "T",
    AAT: "N",
    AAC: "N",
    AAA: "K",
    AAG: "K",
    AGT: "S",
    AGC: "S",
    AGA: "R",
    AGG: "R",
    GTT: "V",
    GTC: "V",
    GTA: "V",
    GTG: "V",
    GCT: "A",
    GCC: "A",
    GCA: "A",
    GCG: "A",
    GAT: "D",
    GAC: "D",
    GAA: "E",
    GAG: "E",
    GGT: "G",
    GGC: "G",
    GGA: "G",
    GGG: "G",
  };

  function round(value, decimals) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const places = Number.isFinite(decimals) ? decimals : 2;
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
  }

  function mean(values) {
    const filtered = Array.isArray(values)
      ? values.map(Number).filter((value) => Number.isFinite(value))
      : [];

    if (!filtered.length) {
      return 0;
    }

    return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
  }

  function stdDev(values) {
    const filtered = Array.isArray(values)
      ? values.map(Number).filter((value) => Number.isFinite(value))
      : [];

    if (filtered.length < 2) {
      return 0;
    }

    const center = mean(filtered);
    const variance =
      filtered.reduce((sum, value) => sum + (value - center) ** 2, 0) /
      (filtered.length - 1);
    return Math.sqrt(variance);
  }

  function sem(values) {
    const filtered = Array.isArray(values)
      ? values.map(Number).filter((value) => Number.isFinite(value))
      : [];
    if (!filtered.length) {
      return 0;
    }
    return stdDev(filtered) / Math.sqrt(filtered.length);
  }

  function normalizeBase(base) {
    const normalized = String(base || "")
      .trim()
      .toUpperCase();
    return normalized === "U" ? "T" : normalized;
  }

  function normalizeSequence(sequence) {
    return String(sequence || "")
      .toUpperCase()
      .replace(/[^ACGTURYSWKMBDHVN-]/g, "")
      .replace(/U/g, "T");
  }

  function extractSequenceResponse(responseText, contentType) {
    const raw = String(responseText || "").trim();
    const type = String(contentType || "").toLowerCase();
    if (!raw) {
      throw new Error("The reference service returned an empty sequence response.");
    }

    let sequenceText = raw;
    if (type.includes("json") || raw.startsWith("{")) {
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch (error) {
        throw new Error("The reference service returned malformed JSON instead of a sequence.");
      }
      sequenceText = payload?.seq || payload?.sequence || "";
      if (typeof sequenceText !== "string" || !sequenceText.trim()) {
        throw new Error("The reference service JSON response did not contain a sequence field.");
      }
    } else if (raw.startsWith(">")) {
      sequenceText = raw
        .split(/\r?\n/u)
        .filter((line) => !line.trim().startsWith(">"))
        .join("");
    }

    const compact = String(sequenceText).replace(/\s+/gu, "").toUpperCase();
    if (!compact || /[^ACGTURYSWKMBDHVN-]/u.test(compact)) {
      throw new Error("The reference service response contained non-sequence content.");
    }
    return compact.replace(/U/g, "T");
  }

  function reverseComplement(sequence) {
    return normalizeSequence(sequence)
      .split("")
      .reverse()
      .map((base) => COMPLEMENT_MAP[base] || "N")
      .join("");
  }

  function reverseSecondaryInfo(entry) {
    if (!entry) {
      return {
        secondaryBase: "",
        secondaryRatio: 0,
        heterozygousCandidate: false,
        iupacCall: "",
      };
    }

    return {
      primaryBase: COMPLEMENT_MAP[entry.primaryBase] || entry.primaryBase || "",
      secondaryBase: COMPLEMENT_MAP[entry.secondaryBase] || entry.secondaryBase || "",
      secondaryRatio: Number(entry.secondaryRatio || 0),
      heterozygousCandidate: Boolean(entry.heterozygousCandidate),
      iupacCall: reverseComplement(entry.iupacCall || ""),
    };
  }

  function toArray(values) {
    return Array.isArray(values) ? values.slice() : [];
  }

  async function toArrayBuffer(input) {
    if (input instanceof ArrayBuffer) {
      return input;
    }

    if (ArrayBuffer.isView(input)) {
      return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    }

    if (input && typeof input.arrayBuffer === "function") {
      return input.arrayBuffer();
    }

    throw new Error("Unsupported AB1 input. Use a File, Blob, ArrayBuffer, or Uint8Array.");
  }

  function readAscii(bytes, start, length) {
    const characters = [];
    for (let index = 0; index < length; index += 1) {
      characters.push(String.fromCharCode(bytes[start + index] || 0));
    }
    return characters.join("");
  }

  function parseAbifDirectoryEntry(view, bytes, offset) {
    const dataSize = view.getInt32(offset + 16, false);
    const rawDataOffset = view.getInt32(offset + 20, false);
    return {
      name: readAscii(bytes, offset, 4),
      number: view.getInt32(offset + 4, false),
      elementType: view.getInt16(offset + 8, false),
      elementSize: view.getInt16(offset + 10, false),
      numElements: view.getInt32(offset + 12, false),
      dataSize,
      dataOffset: dataSize <= 4 ? offset + 20 : rawDataOffset,
    };
  }

  function readByteArray(bytes, offset, count) {
    const values = [];
    for (let index = 0; index < count; index += 1) {
      values.push(bytes[offset + index] || 0);
    }
    return values;
  }

  function readShortArray(view, offset, count) {
    const values = [];
    for (let index = 0; index < count; index += 1) {
      values.push(view.getInt16(offset + index * 2, false));
    }
    return values;
  }

  function readLongArray(view, offset, count) {
    const values = [];
    for (let index = 0; index < count; index += 1) {
      values.push(view.getInt32(offset + index * 4, false));
    }
    return values;
  }

  function readPString(bytes, offset) {
    const size = bytes[offset] || 0;
    return readAscii(bytes, offset + 1, size);
  }

  function readCString(bytes, offset, count) {
    const characters = [];
    for (let index = 0; index < count; index += 1) {
      const code = bytes[offset + index] || 0;
      if (!code) {
        break;
      }
      characters.push(String.fromCharCode(code));
    }
    return characters.join("");
  }

  function getAbifEntry(entries, name, number) {
    return entries.find((entry) => entry.name === name && entry.number === number) || null;
  }

  function getAbifData(view, bytes, entries, name, number, mode) {
    const entry = getAbifEntry(entries, name, number);
    if (!entry) {
      return null;
    }

    if (mode === "bytes") {
      return readByteArray(bytes, entry.dataOffset, entry.numElements);
    }

    if (mode === "chars") {
      return readAscii(bytes, entry.dataOffset, entry.numElements).split("");
    }

    if (mode === "string") {
      return readAscii(bytes, entry.dataOffset, entry.numElements).replace(/\0+$/u, "");
    }

    if (mode === "pstring") {
      return readPString(bytes, entry.dataOffset);
    }

    if (mode === "cstring") {
      return readCString(bytes, entry.dataOffset, entry.numElements);
    }

    if (mode === "shorts") {
      return readShortArray(view, entry.dataOffset, entry.numElements);
    }

    if (mode === "longs") {
      return readLongArray(view, entry.dataOffset, entry.numElements);
    }

    throw new Error(`Unsupported ABIF data mode: ${mode}`);
  }

  function normalizeQualityArray(values, expectedLength) {
    const numericValues = toArray(values).map((value) => Number(value));
    if (numericValues.length !== expectedLength) {
      return null;
    }

    const hasSignal = numericValues.some((value) => value > 1);
    return hasSignal ? numericValues : null;
  }

  async function parseAb1Data(input) {
    const arrayBuffer = await toArrayBuffer(input);
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);

    if (readAscii(bytes, 0, 4) !== "ABIF") {
      throw new Error("The uploaded file is not a valid AB1 / ABIF trace file.");
    }

    const rootEntry = parseAbifDirectoryEntry(view, bytes, 6);
    const entries = [];
    for (let index = 0; index < rootEntry.numElements; index += 1) {
      entries.push(parseAbifDirectoryEntry(view, bytes, rootEntry.dataOffset + index * 28));
    }

    const channelOrder = getAbifData(view, bytes, entries, "FWO_", 1, "string") || "GATC";
    const dataTagMap = {};
    channelOrder.split("").forEach((base, index) => {
      dataTagMap[normalizeBase(base)] = 9 + index;
    });

    const sequence = (getAbifData(view, bytes, entries, "PBAS", 2, "chars") || []).join("");
    const qualityValues =
      normalizeQualityArray(
        getAbifData(view, bytes, entries, "PCON", 2, "bytes") ||
          getAbifData(view, bytes, entries, "PCON", 1, "bytes"),
        sequence.length
      ) || [];
    const peakLocations =
      getAbifData(view, bytes, entries, "PLOC", 2, "shorts") ||
      getAbifData(view, bytes, entries, "PLOC", 1, "shorts") ||
      [];

    const chromatogramData = {
      basePos: peakLocations,
      qualNums: qualityValues,
      aTrace: getAbifData(view, bytes, entries, "DATA", dataTagMap.A || 10, "shorts") || [],
      cTrace: getAbifData(view, bytes, entries, "DATA", dataTagMap.C || 12, "shorts") || [],
      gTrace: getAbifData(view, bytes, entries, "DATA", dataTagMap.G || 9, "shorts") || [],
      tTrace: getAbifData(view, bytes, entries, "DATA", dataTagMap.T || 11, "shorts") || [],
      channelOrder,
    };

    const sampleName =
      getAbifData(view, bytes, entries, "SMPL", 1, "pstring") ||
      getAbifData(view, bytes, entries, "SMPL", 1, "cstring") ||
      "";

    return {
      parsedSequence: {
        name: sampleName,
        sequence,
        chromatogramData,
      },
    };
  }

  function trimByQuality(sequence, qualities, options) {
    const normalizedSequence = normalizeSequence(sequence);
    const qualityValues = toArray(qualities).map((value) => Number(value));
    const minQuality = Number(options?.minQuality || 20);
    const windowSize = Math.max(3, Number(options?.windowSize || 12));
    const minLength = Math.max(40, Number(options?.minLength || 80));

    if (!normalizedSequence.length) {
      return {
        start: 0,
        end: 0,
        sequence: "",
        qualities: [],
        meanQuality: 0,
        status: "fail",
      };
    }

    if (!qualityValues.length || qualityValues.length !== normalizedSequence.length) {
      const fallbackMean = mean(qualityValues);
      return {
        start: 0,
        end: normalizedSequence.length,
        sequence: normalizedSequence,
        qualities:
          qualityValues.length === normalizedSequence.length
            ? qualityValues
            : new Array(normalizedSequence.length).fill(Number.isFinite(fallbackMean) ? fallbackMean : 20),
        meanQuality: round(fallbackMean || 20, 2),
        status: normalizedSequence.length >= minLength ? "pass" : "warning",
      };
    }

    let start = 0;
    let end = qualityValues.length;

    while (start <= end - windowSize) {
      const windowMean = mean(qualityValues.slice(start, start + windowSize));
      if (windowMean >= minQuality) {
        break;
      }
      start += 1;
    }

    while (end - windowSize >= start) {
      const windowMean = mean(qualityValues.slice(end - windowSize, end));
      if (windowMean >= minQuality) {
        break;
      }
      end -= 1;
    }

    while (start < end && Number(qualityValues[start]) < minQuality) {
      start += 1;
    }

    while (end > start && Number(qualityValues[end - 1]) < minQuality) {
      end -= 1;
    }

    const trimmedSequence = normalizedSequence.slice(start, end);
    const trimmedQualities = qualityValues.slice(start, end);
    const trimmedMean = round(mean(trimmedQualities), 2);

    let status = "fail";
    if (trimmedSequence.length >= 350 && trimmedMean >= 20) {
      status = "pass";
    } else if (trimmedSequence.length >= minLength && trimmedMean >= 16) {
      status = "warning";
    }

    return {
      start,
      end,
      sequence: trimmedSequence,
      qualities: trimmedQualities,
      meanQuality: trimmedMean,
      status,
    };
  }

  function getIupacSet(base) {
    return IUPAC_MAP[normalizeBase(base)] || ["N"];
  }

  function getIupacLabel(base) {
    const normalized = normalizeBase(base);
    const set = getIupacSet(base);
    return normalized && set.length ? `${normalized} (${set.join("/")})` : "—";
  }

  function getIupacForPair(baseA, baseB) {
    const setA = new Set(getIupacSet(baseA));
    const setB = new Set(getIupacSet(baseB));
    const union = [...new Set([...setA, ...setB])]
      .filter((base) => base !== "-")
      .sort()
      .join("");

    const entries = Object.entries(IUPAC_MAP);
    const match = entries.find(([code, values]) => {
      const joined = [...new Set(values)]
        .filter((value) => value !== "-")
        .sort()
        .join("");
      return joined === union;
    });

    return match ? match[0] : "N";
  }

  function getTraceIntensityForBase(base, traceData, positionIndex) {
    const pos = Array.isArray(traceData?.basePos) ? traceData.basePos[positionIndex] : undefined;
    if (!Number.isFinite(pos)) {
      return 0;
    }

    switch (normalizeBase(base)) {
      case "A":
        return Number(traceData?.aTrace?.[pos] || 0);
      case "C":
        return Number(traceData?.cTrace?.[pos] || 0);
      case "G":
        return Number(traceData?.gTrace?.[pos] || 0);
      case "T":
        return Number(traceData?.tTrace?.[pos] || 0);
      default:
        return 0;
    }
  }

  function buildSecondaryPeakCalls(sequence, chromatogramData, qualities, options) {
    const ratioThreshold = Number(options?.secondaryRatioThreshold || 0.35);
    const qualityThreshold = Number(options?.secondaryQualityThreshold || 18);
    const normalizedSequence = normalizeSequence(sequence);

    return normalizedSequence.split("").map((base, index) => {
      const channels = ["A", "C", "G", "T"].map((channelBase) => ({
        base: channelBase,
        intensity: getTraceIntensityForBase(channelBase, chromatogramData, index),
      }));
      channels.sort((left, right) => right.intensity - left.intensity);

      const normalizedBase = normalizeBase(base);
      const calledChannel = /^[ACGT]$/u.test(normalizedBase)
        ? channels.find((channel) => channel.base === normalizedBase)
        : null;
      const primary = calledChannel?.intensity > 0 ? calledChannel : channels[0] || {
        base: "",
        intensity: 0,
      };
      const secondary = channels.find((channel) => channel.base !== primary.base) || {
        base: "",
        intensity: 0,
      };

      const ratio = primary.intensity > 0 ? secondary.intensity / primary.intensity : 0;
      const quality = Number(qualities?.[index] || 0);
      const heterozygousCandidate =
        primary.intensity > 0 && quality >= qualityThreshold && ratio >= ratioThreshold;

      return {
        primaryBase: primary.base,
        secondaryBase: secondary.base,
        secondaryRatio: round(ratio, 3),
        heterozygousCandidate,
        iupacCall: heterozygousCandidate
          ? getIupacForPair(primary.base, secondary.base)
          : normalizedBase,
      };
    });
  }

  function normalizeAb1SampleData(parsedRecord, fileName, options) {
    const parsedSequence = parsedRecord?.parsedSequence || parsedRecord || {};
    const chromatogramData = parsedSequence.chromatogramData || {};
    const rawSequence = normalizeSequence(parsedSequence.sequence);
    const reportedQualityScores =
      Array.isArray(chromatogramData.qualNums) &&
      chromatogramData.qualNums.length === rawSequence.length &&
      chromatogramData.qualNums.some((value) => Number(value) > 1);
    const qualities = reportedQualityScores
      ? chromatogramData.qualNums.map((value) => Number(value))
      : new Array(rawSequence.length).fill(20);

    const trimResult = trimByQuality(rawSequence, qualities, options);
    const sampleName = String(fileName || parsedSequence.name || "sample")
      .replace(/\.[^.]+$/u, "")
      .trim();
    const fullSecondary = buildSecondaryPeakCalls(rawSequence, chromatogramData, qualities, options);
    const resolvedStatus = reportedQualityScores
      ? trimResult.status
      : trimResult.sequence.length >= Math.max(40, Number(options?.minLength || 80))
        ? "warning"
        : "fail";
    const meanQuality = reportedQualityScores ? trimResult.meanQuality : null;

    return {
      sampleName,
      fileName: fileName || sampleName,
      rawSequence,
      rawLength: rawSequence.length,
      trimmedSequence: trimResult.sequence,
      trimmedLength: trimResult.sequence.length,
      trimStart: trimResult.start,
      trimEnd: trimResult.end,
      rawMeanQuality: reportedQualityScores ? round(mean(qualities), 2) : null,
      meanQuality,
      reportedQualityScores,
      status: resolvedStatus,
      qualities,
      trimmedQualities: qualities.slice(trimResult.start, trimResult.end),
      chromatogram: chromatogramData,
      secondaryPeaks: fullSecondary.slice(trimResult.start, trimResult.end),
      messages: [
        !reportedQualityScores
          ? "Instrument quality scores were not available in this AB1 file; trimming and review used conservative fallback handling."
          : trimResult.status === "pass"
            ? "Trimmed read passed the default quality threshold."
            : trimResult.status === "warning"
              ? "Trimmed read is usable with caution; inspect low-quality positions."
              : "Trimmed read failed the default quality threshold and should be reviewed carefully.",
      ],
    };
  }

  function smithWaterman(referenceSequence, querySequence, options) {
    const reference = normalizeSequence(referenceSequence);
    const query = normalizeSequence(querySequence);
    const matchScore = Number(options?.matchScore || 2);
    const mismatchScore = Number(options?.mismatchScore || -1);
    const gapPenalty = Number(options?.gapPenalty || -2);

    const rows = query.length + 1;
    const cols = reference.length + 1;
    const scores = Array.from({ length: rows }, () => new Int32Array(cols));
    const trace = Array.from({ length: rows }, () => new Uint8Array(cols));

    let bestScore = 0;
    let bestRow = 0;
    let bestCol = 0;

    for (let row = 1; row < rows; row += 1) {
      const queryBase = query[row - 1];
      for (let col = 1; col < cols; col += 1) {
        const referenceBase = reference[col - 1];
        const diagonal =
          scores[row - 1][col - 1] + (queryBase === referenceBase ? matchScore : mismatchScore);
        const up = scores[row - 1][col] + gapPenalty;
        const left = scores[row][col - 1] + gapPenalty;

        let best = 0;
        let direction = 0;

        if (diagonal > best) {
          best = diagonal;
          direction = 1;
        }
        if (up > best) {
          best = up;
          direction = 2;
        }
        if (left > best) {
          best = left;
          direction = 3;
        }

        scores[row][col] = best;
        trace[row][col] = direction;

        if (best > bestScore) {
          bestScore = best;
          bestRow = row;
          bestCol = col;
        }
      }
    }

    let row = bestRow;
    let col = bestCol;
    const alignedReference = [];
    const alignedQuery = [];

    while (row > 0 && col > 0 && scores[row][col] > 0) {
      const direction = trace[row][col];
      if (direction === 1) {
        alignedReference.push(reference[col - 1]);
        alignedQuery.push(query[row - 1]);
        row -= 1;
        col -= 1;
      } else if (direction === 2) {
        alignedReference.push("-");
        alignedQuery.push(query[row - 1]);
        row -= 1;
      } else if (direction === 3) {
        alignedReference.push(reference[col - 1]);
        alignedQuery.push("-");
        col -= 1;
      } else {
        break;
      }
    }

    alignedReference.reverse();
    alignedQuery.reverse();

    const refStart = col;
    const refEnd = bestCol;
    const queryStart = row;
    const queryEnd = bestRow;
    const alignedRefString = alignedReference.join("");
    const alignedQueryString = alignedQuery.join("");

    let matches = 0;
    let gaps = 0;
    for (let index = 0; index < alignedRefString.length; index += 1) {
      if (alignedRefString[index] === alignedQueryString[index]) {
        matches += 1;
      }
      if (alignedRefString[index] === "-" || alignedQueryString[index] === "-") {
        gaps += 1;
      }
    }

    return {
      score: bestScore,
      refStart,
      refEnd,
      queryStart,
      queryEnd,
      alignedReference: alignedRefString,
      alignedQuery: alignedQueryString,
      matches,
      gaps,
      alignedLength: alignedRefString.length,
      identity:
        alignedRefString.length > 0 ? (matches / alignedRefString.length) * 100 : 0,
    };
  }

  function alignSampleToReference(sample, reference, options) {
    const referenceSequence = normalizeSequence(reference?.sequence);
    const forward = smithWaterman(referenceSequence, sample.trimmedSequence, options);
    const reverseSequence = reverseComplement(sample.trimmedSequence);
    const reverse = smithWaterman(referenceSequence, reverseSequence, options);
    const useReverse =
      reverse.score > forward.score ||
      (reverse.score === forward.score && reverse.identity > forward.identity);
    const chosen = useReverse ? reverse : forward;
    const chosenQualities = useReverse
      ? sample.trimmedQualities.slice().reverse()
      : sample.trimmedQualities.slice();
    const chosenSecondary = useReverse
      ? sample.secondaryPeaks.slice().reverse().map(reverseSecondaryInfo)
      : sample.secondaryPeaks.slice();

    return {
      sampleName: sample.sampleName,
      sample,
      reference,
      orientation: useReverse ? "reverse-complement" : "forward",
      score: chosen.score,
      refStart: chosen.refStart,
      refEnd: chosen.refEnd,
      queryStart: chosen.queryStart,
      queryEnd: chosen.queryEnd,
      alignedReference: chosen.alignedReference,
      alignedQuery: chosen.alignedQuery,
      alignedLength: chosen.alignedLength,
      identity: round(chosen.identity, 2),
      gaps: chosen.gaps,
      querySequence: useReverse ? reverseSequence : sample.trimmedSequence,
      queryQualities: chosenQualities,
      secondaryPeaks: chosenSecondary,
    };
  }

  function getAlignmentColumns(alignmentResult) {
    const columns = [];
    const referenceAlignment = alignmentResult.alignedReference;
    const queryAlignment = alignmentResult.alignedQuery;
    let referenceIndex = alignmentResult.refStart;
    let queryIndex = alignmentResult.queryStart;
    let previousReferencePosition = referenceIndex;
    let previousQueryPosition = queryIndex;

    for (let index = 0; index < referenceAlignment.length; index += 1) {
      const referenceBase = referenceAlignment[index];
      const queryBase = queryAlignment[index];
      const hasReferenceBase = referenceBase !== "-";
      const hasQueryBase = queryBase !== "-";
      const referencePosition = hasReferenceBase ? referenceIndex + 1 : null;
      const queryPosition = hasQueryBase ? queryIndex + 1 : null;
      const quality = hasQueryBase ? Number(alignmentResult.queryQualities[queryIndex] || 0) : 0;
      const secondary = hasQueryBase ? alignmentResult.secondaryPeaks[queryIndex] || null : null;

      columns.push({
        alignmentIndex: index,
        referenceBase,
        queryBase,
        referencePosition,
        queryPosition,
        previousReferencePosition,
        previousQueryPosition,
        quality,
        secondary,
      });

      if (hasReferenceBase) {
        previousReferencePosition = referencePosition;
        referenceIndex += 1;
      }

      if (hasQueryBase) {
        previousQueryPosition = queryPosition;
        queryIndex += 1;
      }
    }

    return columns;
  }

  function classifyVariant(referenceBase, queryBase, secondary) {
    const normalizedReference = normalizeBase(referenceBase);
    const normalizedQuery = normalizeBase(queryBase);

    if (normalizedReference === normalizedQuery) {
      return {
        type: "match",
        label: "Match",
      };
    }

    if (normalizedReference === "-") {
      return {
        type: "insertion",
        label: "Insertion",
      };
    }

    if (normalizedQuery === "-") {
      return {
        type: "deletion",
        label: "Deletion",
      };
    }

    const referenceSet = getIupacSet(normalizedReference);
    const querySet = getIupacSet(normalizedQuery);
    const exactSimple =
      referenceSet.length === 1 &&
      querySet.length === 1 &&
      referenceSet[0] !== "-" &&
      querySet[0] !== "-";

    if (!exactSimple || normalizedQuery === "N" || normalizedReference === "N") {
      const overlap = querySet.filter((base) => referenceSet.includes(base));
      return {
        type: "ambiguous",
        label: overlap.length ? "Ambiguous compatible" : "Ambiguous possible mismatch",
      };
    }

    const pair = [referenceSet[0], querySet[0]].sort().join("");
    const transitionPairs = new Set(["AG", "CT"]);
    const changeType = transitionPairs.has(pair) ? "transition" : "transversion";

    if (secondary?.heterozygousCandidate) {
      return {
        type: "heterozygous-candidate",
        label: "Possible heterozygous peak",
        changeType,
      };
    }

    return {
      type: "substitution",
      label: "Substitution",
      changeType,
    };
  }

  function buildContextString(columns, centerIndex, radius) {
    const start = Math.max(0, centerIndex - radius);
    const end = Math.min(columns.length, centerIndex + radius + 1);
    const left = [];
    const right = [];

    for (let index = start; index < centerIndex; index += 1) {
      if (columns[index].referenceBase !== "-") {
        left.push(columns[index].referenceBase);
      }
    }

    for (let index = centerIndex + 1; index < end; index += 1) {
      if (columns[index].referenceBase !== "-") {
        right.push(columns[index].referenceBase);
      }
    }

    return `${left.join("").slice(-5) || "—"} [${
      columns[centerIndex].referenceBase
    }/${columns[centerIndex].queryBase}] ${right.join("").slice(0, 5) || "—"}`;
  }

  function referencePositionToGenomic(reference, localPosition) {
    const coordinateSystem = reference?.coordinateSystem;
    const position = Number(localPosition);
    if (
      coordinateSystem?.type !== "genomic" ||
      !Number.isFinite(position) ||
      !Number.isFinite(Number(coordinateSystem.regionStart)) ||
      !Number.isFinite(Number(coordinateSystem.regionEnd))
    ) {
      return null;
    }

    return Number(coordinateSystem.strand || 1) >= 0
      ? Number(coordinateSystem.regionStart) + position - 1
      : Number(coordinateSystem.regionEnd) - position + 1;
  }

  function getRawTraceIndexForVariant(sample, orientation, variant) {
    const queryPosition = Number(
      variant?.samplePosition || variant?.previousQueryPosition || 0
    );
    if (
      !queryPosition ||
      !Number.isFinite(Number(sample?.trimStart)) ||
      !Number.isFinite(Number(sample?.trimEnd))
    ) {
      return null;
    }

    return orientation === "reverse-complement"
      ? Number(sample.trimEnd) - queryPosition
      : Number(sample.trimStart) + queryPosition - 1;
  }

  function formatReferencePosition(reference, localPosition) {
    const genomicPosition = referencePositionToGenomic(reference, localPosition);
    if (!Number.isFinite(genomicPosition)) {
      return String(localPosition || "—");
    }

    const chromosome = String(reference?.coordinateSystem?.chromosome || "").replace(
      /^chr/iu,
      ""
    );
    return `chr${chromosome}:${genomicPosition}`;
  }

  function detectVariants(alignmentResult, reference, options) {
    const columns = getAlignmentColumns(alignmentResult);
    const qualityThreshold = Number(options?.qualityThreshold || 20);
    const variants = [];
    let variantNumber = 0;

    function getConservativeColumnQuality(columnIndex) {
      const column = columns[columnIndex];
      if (column.queryBase !== "-") {
        return Number(column.quality || 0);
      }

      const flankingQualities = [];
      for (let offset = 1; offset <= 2; offset += 1) {
        const left = columns[columnIndex - offset];
        const right = columns[columnIndex + offset];
        if (left?.queryBase && left.queryBase !== "-") {
          flankingQualities.push(Number(left.quality || 0));
        }
        if (right?.queryBase && right.queryBase !== "-") {
          flankingQualities.push(Number(right.quality || 0));
        }
        if (flankingQualities.length >= 2) {
          break;
        }
      }

      return flankingQualities.length ? Math.min(...flankingQualities) : 0;
    }

    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      const classification = classifyVariant(
        column.referenceBase,
        column.queryBase,
        column.secondary
      );

      if (classification.type === "match") {
        continue;
      }

      variantNumber += 1;
      const qualityUnavailable = alignmentResult.sample?.reportedQualityScores === false;
      const evidenceQuality = getConservativeColumnQuality(index);
      const isIndel = classification.type === "insertion" || classification.type === "deletion";
      const lowQuality =
        !qualityUnavailable &&
        evidenceQuality < qualityThreshold;
      const referencePositionLabel =
        column.referenceBase === "-"
          ? `after ${formatReferencePosition(reference, column.previousReferencePosition)}`
          : formatReferencePosition(reference, column.referencePosition);
      const samplePositionLabel =
        column.queryBase === "-"
          ? `after ${column.previousQueryPosition || 0}`
          : String(column.queryPosition || "—");

      variants.push({
        id: `${alignmentResult.sampleName}-${variantNumber}`,
        number: variantNumber,
        sampleName: alignmentResult.sampleName,
        type: classification.type,
        label: classification.label,
        changeType:
          classification.type === "substitution" || classification.type === "heterozygous-candidate"
            ? classification.changeType || "substitution"
            : classification.type,
        referencePosition: column.referencePosition,
        referenceLocalPosition: column.referencePosition,
        genomicPosition: referencePositionToGenomic(reference, column.referencePosition),
        samplePosition: column.queryPosition,
        previousReferencePosition: column.previousReferencePosition,
        previousQueryPosition: column.previousQueryPosition,
        referencePositionLabel,
        samplePositionLabel,
        referenceBase: column.referenceBase,
        queryBase: column.queryBase,
        quality: qualityUnavailable ? null : round(evidenceQuality, 2),
        qualityBasis: column.queryBase === "-" ? "flanking bases" : "called base",
        qualityThreshold,
        qualityReported: !qualityUnavailable,
        lowQuality,
        manualReviewRequired: lowQuality || qualityUnavailable || isIndel,
        secondaryBase: column.secondary?.secondaryBase || "",
        secondaryRatio: round(column.secondary?.secondaryRatio || 0, 3),
        heterozygousCandidate: Boolean(column.secondary?.heterozygousCandidate),
        iupacCall: column.secondary?.iupacCall || column.queryBase,
        context: buildContextString(columns, index, 5),
        status: lowQuality
          ? "Candidate low-quality difference"
          : qualityUnavailable
            ? "Candidate variant (quality scores unavailable)"
            : isIndel
              ? "Candidate indel requiring manual review"
              : "Candidate variant",
        candidateReason: lowQuality
          ? column.queryBase === "-"
            ? "Low base quality in the trace flanking this alignment gap."
            : "Low base quality at the called difference position."
          : qualityUnavailable
            ? "The AB1 file did not report usable quality scores, so this candidate requires manual chromatogram review."
          : isIndel
            ? "An alignment gap requires manual chromatogram review and confirmation with an independent or opposite-direction read."
          : classification.type === "heterozygous-candidate"
            ? "Secondary peak ratio suggests a mixed or heterozygous signal."
            : "Single-read difference requires bidirectional or repeat confirmation.",
      });
    }

    return {
      columns,
      variants,
    };
  }

  function assessAlignmentReliability(alignmentResult, sample, reference, options) {
    const sampleLength = Math.max(0, Number(sample?.trimmedSequence?.length || 0));
    const referenceLength = Math.max(0, Number(reference?.sequence?.length || 0));
    const queryCoverage =
      sampleLength > 0
        ? round(((alignmentResult.queryEnd - alignmentResult.queryStart) / sampleLength) * 100, 2)
        : 0;
    const referenceCoverage =
      referenceLength > 0
        ? round(((alignmentResult.refEnd - alignmentResult.refStart) / referenceLength) * 100, 2)
        : 0;
    const minimumIdentity = Number(options?.minimumAlignmentIdentity ?? 95);
    const minimumQueryCoverage = Number(options?.minimumQueryCoverage ?? 70);
    const minimumAlignedLength = Math.min(
      sampleLength,
      Math.max(1, Number(options?.minimumAlignedLength ?? 40))
    );
    const reasons = [];

    if (!alignmentResult.alignedLength || alignmentResult.alignedLength < minimumAlignedLength) {
      reasons.push(
        `Aligned length ${alignmentResult.alignedLength || 0} bp is below ${minimumAlignedLength} bp.`
      );
    }
    if (Number(alignmentResult.identity || 0) < minimumIdentity) {
      reasons.push(
        `Identity ${round(alignmentResult.identity || 0, 2)}% is below ${minimumIdentity}%.`
      );
    }
    if (queryCoverage < minimumQueryCoverage) {
      reasons.push(`Query coverage ${queryCoverage}% is below ${minimumQueryCoverage}%.`);
    }

    return {
      passed: reasons.length === 0,
      status: reasons.length ? "reference-mismatch" : "pass",
      reasons,
      identity: round(alignmentResult.identity || 0, 2),
      queryCoverage,
      referenceCoverage,
      thresholds: {
        minimumIdentity,
        minimumQueryCoverage,
        minimumAlignedLength,
      },
    };
  }

  function cloneFeature(feature) {
    return {
      type: String(feature?.type || feature?.featureType || "").toLowerCase(),
      label: feature?.label || feature?.name || feature?.gene || feature?.type || "Feature",
      start: Number(feature?.start || 0),
      end: Number(feature?.end || 0),
      strand: Number(feature?.strand || 1) >= 0 ? 1 : -1,
      metadata: feature?.metadata || feature?.notes || {},
    };
  }

  function sortFeatures(features) {
    return toArray(features)
      .map(cloneFeature)
      .filter((feature) => Number.isFinite(feature.start) && Number.isFinite(feature.end))
      .sort((left, right) => left.start - right.start || left.end - right.end);
  }

  function buildCdsModel(reference) {
    const sourceParts = Array.isArray(reference?.cdsParts) && reference.cdsParts.length
      ? reference.cdsParts
      : sortFeatures(reference?.features).filter((feature) => feature.type === "cds");

    if (!sourceParts.length) {
      return null;
    }

    const strand = Number(sourceParts[0].strand || 1) >= 0 ? 1 : -1;
    const orderedParts = sourceParts
      .map((part) => ({
        start: Number(part.start),
        end: Number(part.end),
        strand,
      }))
      .sort((left, right) => {
        if (strand >= 0) {
          return left.start - right.start;
        }
        return right.end - left.end;
      });

    const positionMap = [];
    orderedParts.forEach((part) => {
      if (strand >= 0) {
        for (let position = part.start; position <= part.end; position += 1) {
          positionMap.push(position);
        }
      } else {
        for (let position = part.end; position >= part.start; position -= 1) {
          positionMap.push(position);
        }
      }
    });

    const codingSequence = positionMap
      .map((position) => {
        const base = normalizeBase(reference.sequence?.[position - 1] || "N");
        return strand >= 0 ? base : COMPLEMENT_MAP[base] || "N";
      })
      .join("");

    return {
      strand,
      parts: orderedParts,
      positionMap,
      codingSequence,
    };
  }

  function getFeatureAtPosition(reference, position) {
    const features = sortFeatures(reference?.features);
    if (!Number.isFinite(position)) {
      return null;
    }

    const overlapping = features.filter(
      (feature) => position >= feature.start && position <= feature.end
    );

    if (!overlapping.length) {
      return null;
    }

    const priorities = ["cds", "exon", "utr", "intron", "mrna", "gene", "source"];
    overlapping.sort((left, right) => {
      const leftIndex = priorities.indexOf(left.type);
      const rightIndex = priorities.indexOf(right.type);
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    });
    return overlapping[0];
  }

  function getRegionLabel(feature) {
    if (!feature) {
      return "Annotation unavailable";
    }

    switch (feature.type) {
      case "cds":
        return "Coding region";
      case "exon":
        return "Exon / noncoding";
      case "utr":
      case "5'utr":
      case "3'utr":
        return "UTR";
      case "intron":
        return "Intron / noncoding";
      case "rrna":
        return "rRNA gene";
      case "trna":
        return "tRNA gene";
      case "gene":
      case "mrna":
        return "Gene region";
      default:
        return feature.label || feature.type || "Annotated feature";
    }
  }

  function translateCodon(codon) {
    const normalized = normalizeSequence(codon);
    return CODON_TABLE[normalized] || "?";
  }

  function computeCodingEffect(variant, reference) {
    const cdsModel = buildCdsModel(reference);
    if (!cdsModel || !Number.isFinite(variant.referencePosition)) {
      return {
        codingStatus: "Annotation unavailable",
        effectType: "Not assessed",
        codonChange: "—",
        aminoAcidChange: "—",
      };
    }

    const cdsIndex = cdsModel.positionMap.indexOf(variant.referencePosition);
    if (cdsIndex === -1) {
      return {
        codingStatus: "Noncoding",
        effectType: "Not applicable",
        codonChange: "—",
        aminoAcidChange: "—",
      };
    }

    if (variant.type === "insertion" || variant.type === "deletion") {
      const changedBases =
        variant.type === "insertion"
          ? String(variant.queryBase || "").replace(/-/g, "").length
          : String(variant.referenceBase || "").replace(/-/g, "").length;
      return {
        codingStatus: "Coding",
        effectType: changedBases % 3 === 0 ? "In-frame indel" : "Frameshift candidate",
        codonChange: "—",
        aminoAcidChange: "—",
      };
    }

    if (variant.queryBase.length !== 1 || !/^[ACGT]$/u.test(normalizeBase(variant.queryBase))) {
      return {
        codingStatus: "Coding",
        effectType: "Coding change requires an unambiguous base call",
        codonChange: "—",
        aminoAcidChange: "—",
      };
    }

    const codonIndex = Math.floor(cdsIndex / 3);
    const codonStart = codonIndex * 3;
    const referenceCodon = cdsModel.codingSequence.slice(codonStart, codonStart + 3);
    if (referenceCodon.length !== 3) {
      return {
        codingStatus: "Coding",
        effectType: "Incomplete codon at alignment edge",
        codonChange: "—",
        aminoAcidChange: "—",
      };
    }

    const altCodingBase =
      cdsModel.strand >= 0
        ? normalizeBase(variant.queryBase)
        : COMPLEMENT_MAP[normalizeBase(variant.queryBase)] || "N";
    const codonOffset = cdsIndex % 3;
    const alternateCodon =
      referenceCodon.slice(0, codonOffset) +
      altCodingBase +
      referenceCodon.slice(codonOffset + 1);
    const referenceAa = translateCodon(referenceCodon);
    const alternateAa = translateCodon(alternateCodon);

    let effectType = "Missense";
    if (referenceAa === alternateAa) {
      effectType = "Synonymous";
    } else if (alternateAa === "*") {
      effectType = "Nonsense";
    }

    return {
      codingStatus: "Coding",
      effectType,
      codonChange: `${referenceCodon} > ${alternateCodon}`,
      aminoAcidChange: `${referenceAa}${codonIndex + 1}${alternateAa}`,
    };
  }

  function annotateVariant(variant, reference, extraAnnotations) {
    const feature = getFeatureAtPosition(reference, Number(variant.referencePosition));
    const coding = computeCodingEffect(variant, reference);
    return Object.assign({}, variant, {
      geneName: reference?.geneName || reference?.label || "—",
      featureLabel: feature?.label || "—",
      regionLabel: getRegionLabel(feature),
      featureType: feature?.type || "annotation-unavailable",
      codingStatus: coding.codingStatus,
      codingEffect: coding.effectType,
      codonChange: coding.codonChange,
      aminoAcidChange: coding.aminoAcidChange,
      clinical: extraAnnotations?.clinical || null,
    });
  }

  function analyzeSamplesAgainstReference(samples, reference, options) {
    return toArray(samples).map((sample) => {
      const alignment = alignSampleToReference(sample, reference, options);
      const variantData = detectVariants(alignment, reference, options);
      const alignmentQc = assessAlignmentReliability(
        alignment,
        sample,
        reference,
        options
      );
      const withholdUnreliableVariants = Boolean(options?.withholdUnreliableVariants);
      const candidateVariants =
        withholdUnreliableVariants && !alignmentQc.passed ? [] : variantData.variants;
      const annotatedVariants = candidateVariants.map((variant) =>
        annotateVariant(variant, reference, null)
      );
      return Object.assign({}, alignment, {
        columns: variantData.columns,
        variants: annotatedVariants,
        withheldVariants:
          withholdUnreliableVariants && !alignmentQc.passed ? variantData.variants : [],
        candidateCallingWithheld: withholdUnreliableVariants && !alignmentQc.passed,
        alignmentQc,
        queryCoverage: alignmentQc.queryCoverage,
        referenceCoverage: alignmentQc.referenceCoverage,
      });
    });
  }

  function calculateVariantFrequencies(results) {
    const frequencyMap = new Map();
    toArray(results).forEach((result) => {
      toArray(result.variants).forEach((variant) => {
        const key = `${variant.referencePositionLabel}|${variant.referenceBase}|${variant.queryBase}|${variant.codingEffect}`;
        const existing = frequencyMap.get(key) || {
          locus: variant.referencePositionLabel,
          referenceBase: variant.referenceBase,
          queryBase: variant.queryBase,
          codingEffect: variant.codingEffect,
          samples: [],
        };
        existing.samples.push(variant.sampleName);
        frequencyMap.set(key, existing);
      });
    });

    return [...frequencyMap.values()].map((entry, index) => ({
      number: index + 1,
      locus: entry.locus,
      referenceBase: entry.referenceBase,
      queryBase: entry.queryBase,
      codingEffect: entry.codingEffect,
      sampleCount: entry.samples.length,
      frequency: results.length ? round((entry.samples.length / results.length) * 100, 2) : 0,
      sampleList: entry.samples.join(", "),
    }));
  }

  function tableRowsToTsv(columns, rows) {
    const header = columns.join("\t");
    const body = rows
      .map((row) =>
        columns
          .map((column) => String(row[column] ?? "").replace(/\s*\n\s*/g, " | "))
          .join("\t")
      )
      .join("\n");
    return `${header}\n${body}`.trim();
  }

  function tableRowsToCsv(columns, rows) {
    function escapeCell(value) {
      const text = String(value ?? "").replace(/\r?\n/g, " | ");
      if (/[",]/u.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    }

    const header = columns.map(escapeCell).join(",");
    const body = rows
      .map((row) => columns.map((column) => escapeCell(row[column])).join(","))
      .join("\n");
    return `${header}\n${body}`.trim();
  }

  return {
    IUPAC_MAP,
    mean,
    stdDev,
    sem,
    round,
    normalizeBase,
    normalizeSequence,
    extractSequenceResponse,
    reverseComplement,
    parseAb1Data,
    trimByQuality,
    buildSecondaryPeakCalls,
    normalizeAb1SampleData,
    smithWaterman,
    alignSampleToReference,
    getAlignmentColumns,
    detectVariants,
    referencePositionToGenomic,
    getRawTraceIndexForVariant,
    assessAlignmentReliability,
    buildCdsModel,
    getFeatureAtPosition,
    annotateVariant,
    analyzeSamplesAgainstReference,
    calculateVariantFrequencies,
    getIupacSet,
    getIupacLabel,
    tableRowsToTsv,
    tableRowsToCsv,
  };
});
