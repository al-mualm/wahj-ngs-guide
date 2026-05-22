const assert = require("assert");
const core = require("../genetics-tools-core.js");

function closeTo(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

{
  const result = core.computeHardyWeinberg({
    genotype1Label: "AA",
    genotype2Label: "AG",
    genotype3Label: "GG",
    genotype1Count: 48,
    genotype2Count: 44,
    genotype3Count: 8,
  });

  assert.strictEqual(result.totalSamples, 100);
  closeTo(result.alleleFrequencyP, 0.7);
  closeTo(result.alleleFrequencyQ, 0.3);
  closeTo(result.rows[0].expectedCount, 49);
  closeTo(result.rows[1].expectedCount, 42);
  closeTo(result.rows[2].expectedCount, 9);
  assert.ok(result.pValue > 0.05);
  assert.strictEqual(result.agreement, true);
}

{
  const result = core.computeHardyWeinberg({
    genotype1Label: "AA",
    genotype2Label: "AG",
    genotype3Label: "GG",
    genotype1Count: 40,
    genotype2Count: 5,
    genotype3Count: 40,
  });

  assert.ok(result.pValue < 0.05);
  assert.strictEqual(result.agreement, false);
}

{
  const result = core.computeSnpStatistics({
    genotype1Label: "AA",
    genotype2Label: "AG",
    genotype3Label: "GG",
    patientGenotype1Count: 42,
    patientGenotype2Count: 36,
    patientGenotype3Count: 12,
    controlGenotype1Count: 25,
    controlGenotype2Count: 41,
    controlGenotype3Count: 24,
  });

  assert.strictEqual(result.totalPatients, 90);
  assert.strictEqual(result.totalControls, 90);
  assert.strictEqual(result.rows.length, 3);
  assert.ok(result.rows[0].oddsRatio > 1);
  assert.ok(Number.isFinite(result.rows[0].fisherPValue));
  assert.ok(result.rows[0].confidenceInterval.lower > 0);
  assert.strictEqual(
    result.comparisonNote,
    "Each genotype odds ratio compares the listed genotype against the combined other genotypes."
  );
}

{
  const result = core.computeSnpStatistics({
    genotype1Label: "AA",
    genotype2Label: "AG",
    genotype3Label: "GG",
    patientGenotype1Count: 0,
    patientGenotype2Count: 8,
    patientGenotype3Count: 12,
    controlGenotype1Count: 10,
    controlGenotype2Count: 5,
    controlGenotype3Count: 5,
  });

  assert.ok(Number.isFinite(result.rows[0].oddsRatio));
  assert.strictEqual(result.rows[0].correctionApplied, true);
}

console.log("Genetics tools core tests passed.");
