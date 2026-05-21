const assert = require("assert");
const engine = require("../elisa-tool/elisa-engine.js");

function approxEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} not within ${epsilon} of ${expected}`);
}

const linearPoints = [
  { x: 0, y: 0 },
  { x: 50, y: 0.5 },
  { x: 100, y: 1.0 },
  { x: 150, y: 1.5 },
];

const linearFit = engine.fitCurve(linearPoints, {
  curveChoice: "linear",
  direction: "increasing",
});

assert.strictEqual(linearFit.model, "linear");
approxEqual(linearFit.slope, 0.01, 1e-9);
approxEqual(linearFit.intercept, 0, 1e-9);

const interpolation = engine.interpolateConcentration(0.75, linearFit, linearPoints);
approxEqual(interpolation.concentration, 75, 1e-6);
assert.strictEqual(interpolation.rangeFlag, "In range");

const unknownResults = engine.calculateUnknownConcentrations(
  [
    { sampleId: "A", dilutionFactor: 2, correctedOds: [0.49, 0.51] },
    { sampleId: "B", dilutionFactor: 1, correctedOds: [1.48, 1.52] },
  ],
  linearFit,
  linearPoints
);

approxEqual(unknownResults[0].interpolatedConcentration, 50, 0.6);
approxEqual(unknownResults[0].finalConcentration, 100, 1.2);
approxEqual(unknownResults[1].interpolatedConcentration, 150, 0.6);

assert.strictEqual(engine.chooseStatisticsMethod(2, false), "independent-t-test");
assert.strictEqual(engine.chooseStatisticsMethod(2, true), "paired-t-test");
assert.strictEqual(engine.chooseStatisticsMethod(3, false), "one-way-anova");
assert.strictEqual(engine.chooseStatisticsMethod(3, true), "repeated-measures-anova");

const independentResult = engine.runStatisticsAnalysis({
  groups: [
    { name: "Control", values: [10, 11, 12] },
    { name: "Treated", values: [18, 19, 20] },
  ],
  isDependent: false,
});

assert.strictEqual(independentResult.testName, "Independent t-test (Welch)");
assert.ok(independentResult.pValue < 0.05);

const methodsText = engine.buildStatisticsMethodsText({
  curveModel: "4pl",
  blankCorrection: true,
  statisticsResult: independentResult,
});

assert.ok(methodsText.includes("Wahj ELISA Learning and Analysis Suite"));
assert.ok(methodsText.includes("four-parameter logistic"));

console.log("ELISA engine tests passed.");
