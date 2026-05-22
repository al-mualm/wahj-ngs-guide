(function initPcrCalculatorCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.WahjPcrCalculatorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPcrCalculatorCore() {
  const EPSILON = 1e-9;

  function calculateStats(values) {
    const numericValues = values.filter((value) => Number.isFinite(value));
    const n = numericValues.length;

    if (!n) {
      return {
        n: 0,
        mean: NaN,
        sd: NaN,
        sem: NaN,
        min: NaN,
        max: NaN,
      };
    }

    const mean = numericValues.reduce((sum, value) => sum + value, 0) / n;
    const variance =
      n > 1
        ? numericValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
        : 0;
    const sd = Math.sqrt(variance);

    return {
      n,
      mean,
      sd,
      sem: sd / Math.sqrt(n),
      min: Math.min(...numericValues),
      max: Math.max(...numericValues),
    };
  }

  function sortSampleRows(left, right) {
    if (left.sampleKey !== right.sampleKey) {
      return left.sampleKey === "control" ? -1 : 1;
    }
    return left.sampleId.localeCompare(right.sampleId, undefined, { numeric: true });
  }

  function getPairKey(row) {
    return (row.pairId || row.sampleId || "").trim();
  }

  function classifyRegulationStatus(foldChange) {
    if (!Number.isFinite(foldChange)) {
      return "not calculated";
    }
    if (Math.abs(foldChange - 1) < EPSILON) {
      return "unchanged";
    }
    return foldChange > 1 ? "upregulated" : "downregulated";
  }

  function buildSampleRows(matchedRows) {
    const sampleMap = new Map();

    matchedRows.forEach((row) => {
      const sampleId = String(row.sampleId || "").trim();
      if (!sampleId) {
        throw new Error(
          `Assigned well ${row.well} needs a sample ID so the target Ct can be matched to the reference Ct from the same sample.`
        );
      }

      const sampleKey = `${row.sampleKey}::${sampleId}`;
      if (!sampleMap.has(sampleKey)) {
        sampleMap.set(sampleKey, {
          sampleKey: row.sampleKey,
          sampleId,
          pairIds: new Set(),
          wells: [],
          referenceRows: [],
          targetRows: [],
        });
      }

      const sample = sampleMap.get(sampleKey);
      sample.wells.push(row.well);
      if (row.pairId) {
        sample.pairIds.add(String(row.pairId).trim());
      }
      if (row.assayKey === "reference") {
        sample.referenceRows.push(row);
      } else if (row.assayKey === "target") {
        sample.targetRows.push(row);
      }
    });

    return Array.from(sampleMap.values())
      .map((sample) => {
        if (!sample.referenceRows.length || !sample.targetRows.length) {
          throw new Error(
            `Sample "${sample.sampleId}" is missing either target-gene wells or reference-gene wells. Each biological sample needs both before DeltaCt can be calculated.`
          );
        }
        if (sample.pairIds.size > 1) {
          throw new Error(
            `Sample "${sample.sampleId}" contains more than one pair ID. Use only one pair ID per biological sample.`
          );
        }

        const referenceStats = calculateStats(sample.referenceRows.map((row) => row.ct));
        const targetStats = calculateStats(sample.targetRows.map((row) => row.ct));

        return {
          sampleKey: sample.sampleKey,
          sampleId: sample.sampleId,
          pairId: Array.from(sample.pairIds)[0] || "",
          wells: sample.wells.slice().sort(),
          referenceCt: referenceStats.mean,
          targetCt: targetStats.mean,
          referenceStats,
          targetStats,
          deltaCt: targetStats.mean - referenceStats.mean,
        };
      })
      .sort(sortSampleRows);
  }

  function calculateGroupControlMeanResult(sampleRows) {
    const controlRows = sampleRows.filter((row) => row.sampleKey === "control");
    const treatedRows = sampleRows.filter((row) => row.sampleKey === "treated");
    if (!controlRows.length || !treatedRows.length) {
      throw new Error(
        "The calculator needs at least one complete control sample and one complete treated or patient sample."
      );
    }

    const controlDeltaStats = calculateStats(controlRows.map((row) => row.deltaCt));
    const treatedDeltaStats = calculateStats(treatedRows.map((row) => row.deltaCt));
    const controlDeltaCtUsed = controlDeltaStats.mean;

    const annotatedRows = sampleRows.map((row) => {
      const deltaDeltaCt = row.deltaCt - controlDeltaCtUsed;
      const foldChange = 2 ** -deltaDeltaCt;
      return {
        ...row,
        controlDeltaCtUsed,
        deltaDeltaCt,
        foldChange,
        regulationStatus: classifyRegulationStatus(foldChange),
      };
    });

    const deltaDeltaCt = treatedDeltaStats.mean - controlDeltaStats.mean;
    const deltaDeltaCtSem = Math.sqrt(controlDeltaStats.sem ** 2 + treatedDeltaStats.sem ** 2);
    const ciA = 2 ** -(deltaDeltaCt + 1.96 * deltaDeltaCtSem);
    const ciB = 2 ** -(deltaDeltaCt - 1.96 * deltaDeltaCtSem);

    return {
      analysisMode: "group-control-mean",
      sampleRows: annotatedRows,
      controlDeltaCt: controlDeltaStats.mean,
      treatedDeltaCt: treatedDeltaStats.mean,
      controlDeltaCtSem: controlDeltaStats.sem,
      treatedDeltaCtSem: treatedDeltaStats.sem,
      deltaDeltaCt,
      deltaDeltaCtSem,
      foldChange: 2 ** -deltaDeltaCt,
      log2FoldChange: -deltaDeltaCt,
      foldChangeCI: [Math.min(ciA, ciB), Math.max(ciA, ciB)],
      expressionStats: {
        control: calculateStats(
          annotatedRows
            .filter((row) => row.sampleKey === "control")
            .map((row) => row.foldChange)
        ),
        treated: calculateStats(
          annotatedRows
            .filter((row) => row.sampleKey === "treated")
            .map((row) => row.foldChange)
        ),
      },
    };
  }

  function calculatePairedResult(sampleRows) {
    const controlRows = sampleRows.filter((row) => row.sampleKey === "control");
    const treatedRows = sampleRows.filter((row) => row.sampleKey === "treated");
    if (!controlRows.length || !treatedRows.length) {
      throw new Error(
        "Paired analysis needs at least one complete control sample and one complete treated sample."
      );
    }

    const controlByPair = new Map();
    const treatedByPair = new Map();

    controlRows.forEach((row) => {
      const pairKey = getPairKey(row);
      if (!pairKey) {
        throw new Error(
          `Control sample "${row.sampleId}" needs a pair ID or a matching sample ID for paired analysis.`
        );
      }
      if (controlByPair.has(pairKey)) {
        throw new Error(
          `Paired analysis needs exactly one control sample per pair. Pair "${pairKey}" appears more than once in the control group.`
        );
      }
      controlByPair.set(pairKey, row);
    });

    treatedRows.forEach((row) => {
      const pairKey = getPairKey(row);
      if (!pairKey) {
        throw new Error(
          `Treated sample "${row.sampleId}" needs a pair ID or a matching sample ID for paired analysis.`
        );
      }
      if (treatedByPair.has(pairKey)) {
        throw new Error(
          `Paired analysis needs exactly one treated sample per pair. Pair "${pairKey}" appears more than once in the treated group.`
        );
      }
      treatedByPair.set(pairKey, row);
    });

    const unmatchedControls = controlRows.filter((row) => !treatedByPair.has(getPairKey(row)));
    const unmatchedTreated = treatedRows.filter((row) => !controlByPair.has(getPairKey(row)));
    if (unmatchedControls.length || unmatchedTreated.length) {
      const missingMessages = [];
      if (unmatchedControls.length) {
        missingMessages.push(
          `Unmatched control samples: ${unmatchedControls.map((row) => row.sampleId).join(", ")}`
        );
      }
      if (unmatchedTreated.length) {
        missingMessages.push(
          `Unmatched treated samples: ${unmatchedTreated.map((row) => row.sampleId).join(", ")}`
        );
      }
      throw new Error(
        `Paired analysis requires one matched control and one matched treated sample for each pair. ${missingMessages.join(". ")}.`
      );
    }

    const annotatedRows = sampleRows.map((row) => {
      if (row.sampleKey === "control") {
        return {
          ...row,
          controlDeltaCtUsed: row.deltaCt,
          deltaDeltaCt: 0,
          foldChange: 1,
          regulationStatus: "unchanged",
        };
      }

      const pairKey = getPairKey(row);
      const controlRow = controlByPair.get(pairKey);
      const deltaDeltaCt = row.deltaCt - controlRow.deltaCt;
      const foldChange = 2 ** -deltaDeltaCt;
      return {
        ...row,
        controlDeltaCtUsed: controlRow.deltaCt,
        deltaDeltaCt,
        foldChange,
        regulationStatus: classifyRegulationStatus(foldChange),
      };
    });

    const matchedControlRows = annotatedRows.filter((row) => row.sampleKey === "control");
    const matchedTreatedRows = annotatedRows.filter((row) => row.sampleKey === "treated");
    const controlDeltaStats = calculateStats(matchedControlRows.map((row) => row.deltaCt));
    const treatedDeltaStats = calculateStats(matchedTreatedRows.map((row) => row.deltaCt));
    const pairDeltaStats = calculateStats(matchedTreatedRows.map((row) => row.deltaDeltaCt));
    const ciA = 2 ** -(pairDeltaStats.mean + 1.96 * pairDeltaStats.sem);
    const ciB = 2 ** -(pairDeltaStats.mean - 1.96 * pairDeltaStats.sem);

    return {
      analysisMode: "paired-matched-control",
      sampleRows: annotatedRows,
      controlDeltaCt: controlDeltaStats.mean,
      treatedDeltaCt: treatedDeltaStats.mean,
      controlDeltaCtSem: controlDeltaStats.sem,
      treatedDeltaCtSem: treatedDeltaStats.sem,
      deltaDeltaCt: pairDeltaStats.mean,
      deltaDeltaCtSem: pairDeltaStats.sem,
      foldChange: 2 ** -pairDeltaStats.mean,
      log2FoldChange: -pairDeltaStats.mean,
      foldChangeCI: [Math.min(ciA, ciB), Math.max(ciA, ciB)],
      expressionStats: {
        control: calculateStats(matchedControlRows.map((row) => row.foldChange)),
        treated: calculateStats(matchedTreatedRows.map((row) => row.foldChange)),
      },
    };
  }

  function calculateComparativeCtResult(options) {
    const matchedRows = Array.isArray(options.matchedRows) ? options.matchedRows : [];
    const analysisMode = options.analysisMode || "group-control-mean";
    const sampleRows = buildSampleRows(matchedRows);

    if (analysisMode === "paired-matched-control") {
      return calculatePairedResult(sampleRows);
    }
    return calculateGroupControlMeanResult(sampleRows);
  }

  function gammaLn(value) {
    const cof = [
      76.18009172947146,
      -86.50532032941677,
      24.01409824083091,
      -1.231739572450155,
      0.001208650973866179,
      -0.000005395239384953,
    ];
    let x = value;
    let y = value;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let index = 0; index < cof.length; index += 1) {
      y += 1;
      ser += cof[index] / y;
    }
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  function betaContinuedFraction(a, b, x) {
    const maxIterations = 200;
    const epsilon = 3e-7;
    const fpmin = 1e-30;
    let qab = a + b;
    let qap = a + 1;
    let qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < fpmin) {
      d = fpmin;
    }
    d = 1 / d;
    let h = d;

    for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
      const m2 = 2 * iteration;
      let aa = (iteration * (b - iteration) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < fpmin) {
        d = fpmin;
      }
      c = 1 + aa / c;
      if (Math.abs(c) < fpmin) {
        c = fpmin;
      }
      d = 1 / d;
      h *= d * c;

      aa = (-(a + iteration) * (qab + iteration) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < fpmin) {
        d = fpmin;
      }
      c = 1 + aa / c;
      if (Math.abs(c) < fpmin) {
        c = fpmin;
      }
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < epsilon) {
        break;
      }
    }

    return h;
  }

  function regularizedIncompleteBeta(x, a, b) {
    if (x <= 0) {
      return 0;
    }
    if (x >= 1) {
      return 1;
    }

    const bt =
      Math.exp(
        gammaLn(a + b) -
          gammaLn(a) -
          gammaLn(b) +
          a * Math.log(x) +
          b * Math.log(1 - x)
      ) || 0;

    if (x < (a + 1) / (a + b + 2)) {
      return (bt * betaContinuedFraction(a, b, x)) / a;
    }
    return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
  }

  function regularizedGammaLower(a, x) {
    if (x <= 0) {
      return 0;
    }

    if (x < a + 1) {
      let sum = 1 / a;
      let delta = sum;
      let ap = a;
      for (let iteration = 1; iteration <= 200; iteration += 1) {
        ap += 1;
        delta *= x / ap;
        sum += delta;
        if (Math.abs(delta) < Math.abs(sum) * 1e-12) {
          break;
        }
      }
      return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a));
    }

    let b = x + 1 - a;
    let c = 1 / 1e-30;
    let d = 1 / b;
    let h = d;

    for (let iteration = 1; iteration <= 200; iteration += 1) {
      const an = -iteration * (iteration - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-30) {
        d = 1e-30;
      }
      c = b + an / c;
      if (Math.abs(c) < 1e-30) {
        c = 1e-30;
      }
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-12) {
        break;
      }
    }

    return 1 - h * Math.exp(-x + a * Math.log(x) - gammaLn(a));
  }

  function studentTCdf(tValue, degreesOfFreedom) {
    const t = Number(tValue);
    const v = Number(degreesOfFreedom);
    if (!Number.isFinite(v) || v <= 0) {
      return NaN;
    }
    if (!Number.isFinite(t)) {
      return t > 0 ? 1 : 0;
    }

    const x = v / (v + t * t);
    const ib = regularizedIncompleteBeta(x, v / 2, 0.5);
    return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
  }

  function fisherFCdf(fValue, df1, df2) {
    const f = Number(fValue);
    const leftDf = Number(df1);
    const rightDf = Number(df2);
    if (!Number.isFinite(leftDf) || !Number.isFinite(rightDf)) {
      return NaN;
    }
    if (!Number.isFinite(f)) {
      return f > 0 ? 1 : NaN;
    }
    if (f <= 0) {
      return 0;
    }
    const x = (leftDf * f) / (leftDf * f + rightDf);
    return regularizedIncompleteBeta(x, leftDf / 2, rightDf / 2);
  }

  function chiSquareCdf(value, degreesOfFreedom) {
    if (!Number.isFinite(degreesOfFreedom) || degreesOfFreedom <= 0) {
      return NaN;
    }
    if (!Number.isFinite(value)) {
      return value > 0 ? 1 : NaN;
    }
    return regularizedGammaLower(degreesOfFreedom / 2, value / 2);
  }

  function erf(value) {
    const sign = value < 0 ? -1 : 1;
    const absValue = Math.abs(value);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * absValue);
    const y =
      1 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
        t *
        Math.exp(-absValue * absValue);
    return sign * y;
  }

  function normalCdf(value) {
    return 0.5 * (1 + erf(value / Math.SQRT2));
  }

  function inverseNormalCdf(probability) {
    if (!(probability > 0 && probability < 1)) {
      return NaN;
    }

    const a = [
      -3.969683028665376e1,
      2.209460984245205e2,
      -2.759285104469687e2,
      1.38357751867269e2,
      -3.066479806614716e1,
      2.506628277459239,
    ];
    const b = [
      -5.447609879822406e1,
      1.615858368580409e2,
      -1.556989798598866e2,
      6.680131188771972e1,
      -1.328068155288572e1,
    ];
    const c = [
      -7.784894002430293e-3,
      -3.223964580411365e-1,
      -2.400758277161838,
      -2.549732539343734,
      4.374664141464968,
      2.938163982698783,
    ];
    const d = [
      7.784695709041462e-3,
      3.224671290700398e-1,
      2.445134137142996,
      3.754408661907416,
    ];

    const lowerTail = 0.02425;
    const upperTail = 1 - lowerTail;

    if (probability < lowerTail) {
      const q = Math.sqrt(-2 * Math.log(probability));
      return (
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }

    if (probability > upperTail) {
      const q = Math.sqrt(-2 * Math.log(1 - probability));
      return -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }

    const q = probability - 0.5;
    const r = q * q;
    return (
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  function canRunShapiro(values) {
    const clean = values.filter((value) => Number.isFinite(value));
    if (clean.length < 3 || clean.length > 5000) {
      return false;
    }
    return clean.some((value) => Math.abs(value - clean[0]) > EPSILON);
  }

  function shapiroWilkTest(values) {
    const clean = values.filter((value) => Number.isFinite(value)).slice().sort((a, b) => a - b);
    const n = clean.length;
    if (!canRunShapiro(clean)) {
      return {
        available: false,
        method: "Shapiro-Wilk",
        n,
        statistic: NaN,
        pValue: NaN,
      };
    }

    const mean = clean.reduce((sum, value) => sum + value, 0) / n;
    const denominator = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0);
    const expected = Array.from({ length: n }, (_, index) =>
      inverseNormalCdf((index + 1 - 0.375) / (n + 0.25))
    );
    const scale = Math.sqrt(expected.reduce((sum, value) => sum + value * value, 0));
    const weights = expected.map((value) => value / scale);
    const numerator =
      clean.reduce((sum, value, index) => sum + weights[index] * value, 0) ** 2;
    const statistic = Math.max(0, Math.min(0.999999, numerator / denominator));

    let z;
    if (n < 12) {
      const gamma = -2.273 + 0.459 * n;
      const y = -Math.log(gamma - Math.log(1 - statistic));
      const mu = -0.0006714 * n ** 3 + 0.025054 * n ** 2 - 0.39978 * n + 0.544;
      const sigma = Math.exp(-0.0020322 * n ** 3 + 0.062767 * n ** 2 - 0.77857 * n + 1.3822);
      z = (y - mu) / sigma;
    } else {
      const lnN = Math.log(n);
      const y = Math.log(1 - statistic);
      const mu = 0.0038915 * lnN ** 3 - 0.083751 * lnN ** 2 - 0.31082 * lnN - 1.5861;
      const sigma = Math.exp(0.0030302 * lnN ** 2 - 0.082676 * lnN - 0.4803);
      z = (y - mu) / sigma;
    }

    return {
      available: true,
      method: "Shapiro-Wilk",
      n,
      statistic,
      pValue: 1 - normalCdf(z),
    };
  }

  function rankValues(values) {
    const enriched = values
      .map((value, index) => ({ value, index }))
      .sort((left, right) => left.value - right.value);
    const ranks = new Array(values.length);
    let tieCorrection = 0;
    let cursor = 0;

    while (cursor < enriched.length) {
      let next = cursor + 1;
      while (next < enriched.length && Math.abs(enriched[next].value - enriched[cursor].value) < EPSILON) {
        next += 1;
      }
      const averageRank = (cursor + 1 + next) / 2;
      const tieSize = next - cursor;
      if (tieSize > 1) {
        tieCorrection += tieSize ** 3 - tieSize;
      }
      for (let index = cursor; index < next; index += 1) {
        ranks[enriched[index].index] = averageRank;
      }
      cursor = next;
    }

    return { ranks, tieCorrection };
  }

  function significanceLabel(pValue) {
    if (!Number.isFinite(pValue)) {
      return "ns";
    }
    if (pValue < 0.0001) {
      return "****";
    }
    if (pValue < 0.001) {
      return "***";
    }
    if (pValue < 0.01) {
      return "**";
    }
    if (pValue < 0.05) {
      return "*";
    }
    return "ns";
  }

  function independentTTest(groupA, groupB) {
    const statsA = calculateStats(groupA);
    const statsB = calculateStats(groupB);
    if (statsA.n < 2 || statsB.n < 2) {
      throw new Error("Independent t-test needs at least two values in each group.");
    }
    const pooledVariance =
      (((statsA.n - 1) * statsA.sd ** 2) + ((statsB.n - 1) * statsB.sd ** 2)) /
      (statsA.n + statsB.n - 2);
    const standardError = Math.sqrt(
      pooledVariance * (1 / statsA.n + 1 / statsB.n)
    );
    const meanDifference = statsA.mean - statsB.mean;
    const statistic =
      standardError <= EPSILON
        ? Math.abs(meanDifference) <= EPSILON
          ? 0
          : meanDifference > 0
            ? Infinity
            : -Infinity
        : meanDifference / standardError;
    const df = statsA.n + statsB.n - 2;
    const pValue = 2 * (1 - studentTCdf(Math.abs(statistic), df));
    return {
      testSelected: "Independent samples t-test",
      statisticLabel: "t",
      statistic,
      degreesOfFreedom: df,
      pValue,
    };
  }

  function pairedTTest(pairs) {
    const differences = pairs.map((pair) => pair.treated - pair.control);
    const stats = calculateStats(differences);
    if (stats.n < 2) {
      throw new Error("Paired t-test needs at least two matched pairs.");
    }
    const standardError = stats.sd / Math.sqrt(stats.n);
    const statistic =
      standardError <= EPSILON
        ? Math.abs(stats.mean) <= EPSILON
          ? 0
          : stats.mean > 0
            ? Infinity
            : -Infinity
        : stats.mean / standardError;
    const df = stats.n - 1;
    const pValue = 2 * (1 - studentTCdf(Math.abs(statistic), df));
    return {
      testSelected: "Paired t-test",
      statisticLabel: "t",
      statistic,
      degreesOfFreedom: df,
      pValue,
      differences,
    };
  }

  function mannWhitneyUTest(groupA, groupB) {
    const combined = groupA
      .map((value) => ({ value, group: "A" }))
      .concat(groupB.map((value) => ({ value, group: "B" })));
    const { ranks, tieCorrection } = rankValues(combined.map((entry) => entry.value));
    const n1 = groupA.length;
    const n2 = groupB.length;
    const rankSumA = combined.reduce(
      (sum, entry, index) => sum + (entry.group === "A" ? ranks[index] : 0),
      0
    );
    const u1 = rankSumA - (n1 * (n1 + 1)) / 2;
    const u2 = n1 * n2 - u1;
    const statistic = Math.min(u1, u2);
    const meanU = (n1 * n2) / 2;
    const sigma = Math.sqrt(
      (n1 * n2 / 12) *
        ((n1 + n2 + 1) -
          tieCorrection / ((n1 + n2) * (n1 + n2 - 1)))
    );
    const continuityAdjusted = statistic - meanU + 0.5 * Math.sign(meanU - statistic);
    const z =
      sigma <= EPSILON
        ? Math.abs(continuityAdjusted) <= EPSILON
          ? 0
          : continuityAdjusted > 0
            ? Infinity
            : -Infinity
        : continuityAdjusted / sigma;
    const pValue = 2 * (1 - normalCdf(Math.abs(z)));
    return {
      testSelected: "Mann-Whitney U test",
      statisticLabel: "U",
      statistic,
      degreesOfFreedom: NaN,
      pValue,
      zScore: z,
    };
  }

  function wilcoxonSignedRankTest(pairs) {
    const nonZeroDifferences = pairs
      .map((pair) => pair.treated - pair.control)
      .filter((value) => Math.abs(value) > EPSILON);
    if (nonZeroDifferences.length < 2) {
      throw new Error("Wilcoxon signed-rank test needs at least two non-zero paired differences.");
    }
    const absValues = nonZeroDifferences.map((value) => Math.abs(value));
    const { ranks, tieCorrection } = rankValues(absValues);
    let positiveRankSum = 0;
    let negativeRankSum = 0;
    nonZeroDifferences.forEach((value, index) => {
      if (value > 0) {
        positiveRankSum += ranks[index];
      } else {
        negativeRankSum += ranks[index];
      }
    });
    const statistic = Math.min(positiveRankSum, negativeRankSum);
    const n = nonZeroDifferences.length;
    const meanW = (n * (n + 1)) / 4;
    const varianceW =
      (n * (n + 1) * (2 * n + 1) - tieCorrection / 2) / 24;
    const sigma = Math.sqrt(varianceW);
    const delta = statistic - meanW;
    const z =
      sigma <= EPSILON
        ? Math.abs(delta) <= EPSILON
          ? 0
          : delta > 0
            ? Infinity
            : -Infinity
        : delta / sigma;
    const pValue = 2 * (1 - normalCdf(Math.abs(z)));
    return {
      testSelected: "Wilcoxon signed-rank test",
      statisticLabel: "W",
      statistic,
      degreesOfFreedom: NaN,
      pValue,
      zScore: z,
    };
  }

  function oneWayAnova(groups) {
    const cleanGroups = groups.map((group) => ({
      name: group.name,
      values: group.values.filter((value) => Number.isFinite(value)),
    }));
    const totalCount = cleanGroups.reduce((sum, group) => sum + group.values.length, 0);
    if (cleanGroups.length < 3) {
      throw new Error("One-way ANOVA needs at least three groups.");
    }
    if (cleanGroups.some((group) => group.values.length < 2)) {
      throw new Error("Each group needs at least two values for one-way ANOVA.");
    }
    const grandMean =
      cleanGroups.reduce(
        (sum, group) => sum + group.values.reduce((groupSum, value) => groupSum + value, 0),
        0
      ) / totalCount;
    const ssBetween = cleanGroups.reduce((sum, group) => {
      const stats = calculateStats(group.values);
      return sum + group.values.length * (stats.mean - grandMean) ** 2;
    }, 0);
    const ssWithin = cleanGroups.reduce((sum, group) => {
      const stats = calculateStats(group.values);
      return (
        sum +
        group.values.reduce((groupSum, value) => groupSum + (value - stats.mean) ** 2, 0)
      );
    }, 0);
    const dfBetween = cleanGroups.length - 1;
    const dfWithin = totalCount - cleanGroups.length;
    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;
    const statistic =
      msWithin <= EPSILON
        ? msBetween <= EPSILON
          ? 0
          : Infinity
        : msBetween / msWithin;
    const pValue = 1 - fisherFCdf(statistic, dfBetween, dfWithin);
    return {
      testSelected: "One-way ANOVA",
      statisticLabel: "F",
      statistic,
      degreesOfFreedom: `${dfBetween}, ${dfWithin}`,
      pValue,
    };
  }

  function kruskalWallisTest(groups) {
    const entries = [];
    groups.forEach((group) => {
      group.values.forEach((value) => {
        if (Number.isFinite(value)) {
          entries.push({ group: group.name, value });
        }
      });
    });
    if (groups.length < 3) {
      throw new Error("Kruskal-Wallis test needs at least three groups.");
    }
    const { ranks, tieCorrection } = rankValues(entries.map((entry) => entry.value));
    const groupRankSums = new Map();
    const groupCounts = new Map();
    entries.forEach((entry, index) => {
      groupRankSums.set(entry.group, (groupRankSums.get(entry.group) || 0) + ranks[index]);
      groupCounts.set(entry.group, (groupCounts.get(entry.group) || 0) + 1);
    });
    const totalCount = entries.length;
    let statistic =
      (12 / (totalCount * (totalCount + 1))) *
        groups.reduce((sum, group) => {
          const rankSum = groupRankSums.get(group.name) || 0;
          const n = groupCounts.get(group.name) || 0;
          if (!n) {
            throw new Error("Each group needs at least one value for Kruskal-Wallis.");
          }
          return sum + (rankSum ** 2) / n;
        }, 0) -
      3 * (totalCount + 1);
    if (tieCorrection > 0) {
      statistic /= 1 - tieCorrection / (totalCount ** 3 - totalCount);
    }
    const degreesOfFreedom = groups.length - 1;
    const pValue = 1 - chiSquareCdf(statistic, degreesOfFreedom);
    return {
      testSelected: "Kruskal-Wallis test",
      statisticLabel: "H",
      statistic,
      degreesOfFreedom,
      pValue,
    };
  }

  function buildRepeatedMatrix(groups) {
    const pairSets = groups.map((group) => {
      const map = new Map();
      group.values.forEach((entry) => {
        if (!entry || !entry.pairId || !Number.isFinite(entry.value)) {
          return;
        }
        map.set(entry.pairId, entry.value);
      });
      return map;
    });
    const commonPairs = Array.from(pairSets[0].keys()).filter((pairId) =>
      pairSets.every((map) => map.has(pairId))
    );
    if (commonPairs.length < 2) {
      throw new Error(
        "Repeated or paired analysis needs at least two complete matched subjects across all selected groups."
      );
    }
    return {
      pairIds: commonPairs,
      matrix: commonPairs.map((pairId) => pairSets.map((map) => map.get(pairId))),
    };
  }

  function repeatedMeasuresAnova(groups) {
    if (groups.length < 3) {
      throw new Error("Repeated-measures ANOVA needs at least three groups.");
    }
    const { matrix } = buildRepeatedMatrix(groups);
    const n = matrix.length;
    const k = groups.length;
    const grandMean =
      matrix.reduce((sum, row) => sum + row.reduce((rowSum, value) => rowSum + value, 0), 0) /
      (n * k);
    const groupMeans = Array.from({ length: k }, (_, groupIndex) =>
      matrix.reduce((sum, row) => sum + row[groupIndex], 0) / n
    );
    const subjectMeans = matrix.map(
      (row) => row.reduce((sum, value) => sum + value, 0) / k
    );
    const ssTotal = matrix.reduce(
      (sum, row) =>
        sum + row.reduce((rowSum, value) => rowSum + (value - grandMean) ** 2, 0),
      0
    );
    const ssTreatment =
      n * groupMeans.reduce((sum, value) => sum + (value - grandMean) ** 2, 0);
    const ssSubjects =
      k * subjectMeans.reduce((sum, value) => sum + (value - grandMean) ** 2, 0);
    const ssError = ssTotal - ssTreatment - ssSubjects;
    const dfTreatment = k - 1;
    const dfError = (n - 1) * (k - 1);
    const msTreatment = ssTreatment / dfTreatment;
    const msError = ssError / dfError;
    const statistic =
      msError <= EPSILON
        ? msTreatment <= EPSILON
          ? 0
          : Infinity
        : msTreatment / msError;
    const pValue = 1 - fisherFCdf(statistic, dfTreatment, dfError);
    return {
      testSelected: "Repeated-measures one-way ANOVA",
      statisticLabel: "F",
      statistic,
      degreesOfFreedom: `${dfTreatment}, ${dfError}`,
      pValue,
    };
  }

  function friedmanTest(groups) {
    if (groups.length < 3) {
      throw new Error("Friedman test needs at least three groups.");
    }
    const { matrix } = buildRepeatedMatrix(groups);
    const n = matrix.length;
    const k = groups.length;
    const rankSums = new Array(k).fill(0);

    matrix.forEach((row) => {
      const { ranks } = rankValues(row);
      ranks.forEach((rank, index) => {
        rankSums[index] += rank;
      });
    });

    const statistic =
      (12 / (n * k * (k + 1))) * rankSums.reduce((sum, value) => sum + value ** 2, 0) -
      3 * n * (k + 1);
    const degreesOfFreedom = k - 1;
    const pValue = 1 - chiSquareCdf(statistic, degreesOfFreedom);
    return {
      testSelected: "Friedman test",
      statisticLabel: "Q",
      statistic,
      degreesOfFreedom,
      pValue,
    };
  }

  function runNormalityScreen(config) {
    const { studyDesign, groups } = config;
    if (studyDesign === "two-paired") {
      const { matrix } = buildRepeatedMatrix(groups);
      const differences = matrix.map((row) => row[1] - row[0]);
      const result = shapiroWilkTest(differences);
      return {
        available: result.available,
        method: "Shapiro-Wilk",
        normal: result.available ? result.pValue >= 0.05 : null,
        details: [
          {
            label: "Paired differences",
            ...result,
          },
        ],
        note: result.available
          ? "Normality was screened on paired differences."
          : "Normality check was unavailable for paired differences because too few non-constant observations were available.",
      };
    }

    const details = groups.map((group) => ({
      label: group.name,
      ...shapiroWilkTest(group.values.map((entry) => (typeof entry === "object" ? entry.value : entry))),
    }));
    const available = details.every((detail) => detail.available);
    return {
      available,
      method: "Shapiro-Wilk",
      normal: available ? details.every((detail) => detail.pValue >= 0.05) : null,
      details,
      note: available
        ? "Normality was screened on sample-level values for each group."
        : "Normality check was unavailable for one or more groups because too few non-constant observations were available.",
    };
  }

  function chooseStatisticalMethod(studyDesign, options) {
    const defaults = {
      "two-independent": "Independent samples t-test",
      "two-paired": "Paired t-test",
      "multi-independent": "One-way ANOVA",
      "multi-paired": "Repeated-measures one-way ANOVA",
    };
    const nonParametric = {
      "two-independent": "Mann-Whitney U test",
      "two-paired": "Wilcoxon signed-rank test",
      "multi-independent": "Kruskal-Wallis test",
      "multi-paired": "Friedman test",
    };

    if (!options.autoNormality) {
      return defaults[studyDesign];
    }
    if (!options.normalityResult.available) {
      return defaults[studyDesign];
    }
    return options.normalityResult.normal ? defaults[studyDesign] : nonParametric[studyDesign];
  }

  function runStatisticalTest(config) {
    const studyDesign = config.studyDesign;
    const groups = config.groups;
    const autoNormality = Boolean(config.autoNormality);
    const normalityResult = autoNormality
      ? runNormalityScreen({ studyDesign, groups })
      : {
          available: false,
          method: "Shapiro-Wilk",
          normal: null,
          details: [],
          note: "Automatic normality testing was disabled.",
        };
    const method = chooseStatisticalMethod(studyDesign, {
      autoNormality,
      normalityResult,
    });

    let testResult;
    if (method === "Independent samples t-test") {
      testResult = independentTTest(groups[0].values, groups[1].values);
    } else if (method === "Paired t-test") {
      const { matrix } = buildRepeatedMatrix(groups);
      testResult = pairedTTest(matrix.map((row) => ({ control: row[0], treated: row[1] })));
    } else if (method === "Mann-Whitney U test") {
      testResult = mannWhitneyUTest(groups[0].values, groups[1].values);
    } else if (method === "Wilcoxon signed-rank test") {
      const { matrix } = buildRepeatedMatrix(groups);
      testResult = wilcoxonSignedRankTest(
        matrix.map((row) => ({ control: row[0], treated: row[1] }))
      );
    } else if (method === "One-way ANOVA") {
      testResult = oneWayAnova(groups);
    } else if (method === "Kruskal-Wallis test") {
      testResult = kruskalWallisTest(groups);
    } else if (method === "Repeated-measures one-way ANOVA") {
      testResult = repeatedMeasuresAnova(groups);
    } else if (method === "Friedman test") {
      testResult = friedmanTest(groups);
    } else {
      throw new Error(`Unsupported statistical method: ${method}`);
    }

    return {
      ...testResult,
      studyDesign,
      normalityResult,
      significance: significanceLabel(testResult.pValue),
      significant: Number.isFinite(testResult.pValue) && testResult.pValue < 0.05,
    };
  }

  return {
    calculateStats,
    buildSampleRows,
    calculateComparativeCtResult,
    significanceLabel,
    shapiroWilkTest,
    runNormalityScreen,
    chooseStatisticalMethod,
    runStatisticalTest,
  };
});
