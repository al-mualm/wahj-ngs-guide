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

console.log("PCR calculator core tests passed.");
