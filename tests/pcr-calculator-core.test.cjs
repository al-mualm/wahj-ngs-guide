const assert = require("assert");
const core = require("../pcr-calculator-core.js");

function makeRow(well, ct, sampleKey, assayKey, sampleId, pairId = "") {
  return {
    well,
    ct,
    sampleKey,
    assayKey,
    sampleId,
    pairId,
  };
}

function closeTo(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

{
  const matchedRows = [
    makeRow("A1", 10, "control", "reference", "C1"),
    makeRow("A2", 15, "control", "target", "C1"),
    makeRow("A3", 30, "control", "reference", "C2"),
    makeRow("A4", 33, "control", "target", "C2"),
    makeRow("B1", 11, "treated", "reference", "T1"),
    makeRow("B2", 13, "treated", "target", "T1"),
    makeRow("B3", 31, "treated", "reference", "T2"),
    makeRow("B4", 35, "treated", "target", "T2"),
  ];

  const result = core.calculateComparativeCtResult({
    matchedRows,
    analysisMode: "group-control-mean",
  });

  const sampleRows = Object.fromEntries(result.sampleRows.map((row) => [row.sampleId, row]));
  closeTo(sampleRows.C1.deltaCt, 5);
  closeTo(sampleRows.C2.deltaCt, 3);
  closeTo(sampleRows.T1.deltaCt, 2);
  closeTo(sampleRows.T2.deltaCt, 4);
  closeTo(result.controlDeltaCt, 4);
  closeTo(result.treatedDeltaCt, 3);
  closeTo(result.deltaDeltaCt, -1);
  closeTo(result.foldChange, 2);
}

{
  const matchedRows = [
    makeRow("A1", 18, "control", "reference", "Isolate 1", "Pair 1"),
    makeRow("A2", 23, "control", "target", "Isolate 1", "Pair 1"),
    makeRow("A3", 17, "control", "reference", "Isolate 2", "Pair 2"),
    makeRow("A4", 21, "control", "target", "Isolate 2", "Pair 2"),
    makeRow("B1", 18, "treated", "reference", "Isolate 1 treated", "Pair 1"),
    makeRow("B2", 21, "treated", "target", "Isolate 1 treated", "Pair 1"),
    makeRow("B3", 17, "treated", "reference", "Isolate 2 treated", "Pair 2"),
    makeRow("B4", 21, "treated", "target", "Isolate 2 treated", "Pair 2"),
  ];

  const result = core.calculateComparativeCtResult({
    matchedRows,
    analysisMode: "paired-matched-control",
  });

  const sampleRows = Object.fromEntries(result.sampleRows.map((row) => [row.sampleId, row]));
  closeTo(sampleRows["Isolate 1 treated"].controlDeltaCtUsed, 5);
  closeTo(sampleRows["Isolate 1 treated"].deltaDeltaCt, -2);
  closeTo(sampleRows["Isolate 1 treated"].foldChange, 4);
  closeTo(sampleRows["Isolate 2 treated"].deltaDeltaCt, 0);
  closeTo(sampleRows["Isolate 2 treated"].foldChange, 1);
  closeTo(result.deltaDeltaCt, -1);
  closeTo(result.foldChange, 2);
}

{
  const matchedRows = [];
  for (let index = 1; index <= 10; index += 1) {
    matchedRows.push(
      makeRow(`A${index}`, 18 + index / 10, "control", "reference", `Control ${index}`),
      makeRow(`B${index}`, 23 + index / 10, "control", "target", `Control ${index}`),
      makeRow(`C${index}`, 18 + index / 10, "treated", "reference", `Patient ${index}`),
      makeRow(`D${index}`, 21 + index / 10, "treated", "target", `Patient ${index}`)
    );
  }

  const result = core.calculateComparativeCtResult({
    matchedRows,
    analysisMode: "group-control-mean",
  });

  assert.strictEqual(result.sampleRows.length, 20);
  closeTo(result.controlDeltaCt, 5);
  closeTo(result.treatedDeltaCt, 3);
  closeTo(result.foldChange, 4);
}

{
  const significance = core.significanceLabel(0.00009);
  assert.strictEqual(significance, "****");
  assert.strictEqual(core.significanceLabel(0.02), "*");
  assert.strictEqual(core.significanceLabel(0.2), "ns");
}

{
  const method = core.chooseStatisticalMethod("two-independent", {
    autoNormality: true,
    normalityResult: { available: true, normal: false },
  });
  assert.strictEqual(method, "Mann-Whitney U test");
}

{
  const method = core.chooseStatisticalMethod("two-paired", {
    autoNormality: true,
    normalityResult: { available: true, normal: true },
  });
  assert.strictEqual(method, "Paired t-test");
}

{
  const stats = core.runStatisticalTest({
    studyDesign: "two-independent",
    autoNormality: false,
    groups: [
      { name: "Control", values: [5.1, 4.9, 5.0, 5.2] },
      { name: "Patient", values: [3.1, 3.0, 3.3, 2.9] },
    ],
  });
  assert.strictEqual(stats.testSelected, "Independent samples t-test");
  assert.ok(stats.pValue < 0.001);
}

{
  const stats = core.runStatisticalTest({
    studyDesign: "two-paired",
    autoNormality: false,
    groups: [
      {
        name: "Untreated",
        values: [
          { pairId: "P1", value: 5.0 },
          { pairId: "P2", value: 4.0 },
          { pairId: "P3", value: 6.0 },
        ],
      },
      {
        name: "Treated",
        values: [
          { pairId: "P1", value: 3.0 },
          { pairId: "P2", value: 3.5 },
          { pairId: "P3", value: 5.0 },
        ],
      },
    ],
  });
  assert.strictEqual(stats.testSelected, "Paired t-test");
  assert.ok(Number.isFinite(stats.pValue));
}

{
  const shapiro = core.shapiroWilkTest([1, 1.2, 0.9, 1.1, 1.05]);
  assert.strictEqual(shapiro.available, true);
  assert.ok(Number.isFinite(shapiro.pValue));
}

{
  const stats = core.runStatisticalTest({
    studyDesign: "multi-independent",
    autoNormality: false,
    groups: [
      { name: "Group 1", values: [1, 2, 3] },
      { name: "Group 2", values: [4, 5, 6] },
      { name: "Group 3", values: [7, 8, 9] },
    ],
  });
  assert.strictEqual(stats.testSelected, "One-way ANOVA");
  assert.ok(Number.isFinite(stats.pValue));
}

{
  const stats = core.runStatisticalTest({
    studyDesign: "multi-paired",
    autoNormality: false,
    groups: [
      {
        name: "Time 1",
        values: [
          { pairId: "P1", value: 1 },
          { pairId: "P2", value: 2 },
          { pairId: "P3", value: 3 },
        ],
      },
      {
        name: "Time 2",
        values: [
          { pairId: "P1", value: 2 },
          { pairId: "P2", value: 3 },
          { pairId: "P3", value: 4 },
        ],
      },
      {
        name: "Time 3",
        values: [
          { pairId: "P1", value: 3 },
          { pairId: "P2", value: 4 },
          { pairId: "P3", value: 5 },
        ],
      },
    ],
  });
  assert.strictEqual(stats.testSelected, "Repeated-measures one-way ANOVA");
  assert.ok(Number.isFinite(stats.pValue));
  assert.ok(stats.pValue <= 0.0001);
}

console.log("PCR calculator core tests passed.");
