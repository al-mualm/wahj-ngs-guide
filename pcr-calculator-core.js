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

  return {
    calculateStats,
    buildSampleRows,
    calculateComparativeCtResult,
  };
});
