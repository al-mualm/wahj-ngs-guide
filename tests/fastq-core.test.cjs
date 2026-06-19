const assert = require("node:assert/strict");
const core = require("../fastq-analyzer/fastq-core.js");

const fastq = [
  "@read_1",
  "ACGTACGT",
  "+",
  "IIIIIIII",
  "@read_2",
  "ACGTNNNN",
  "+",
  "!!!!!!!!",
  "@read_3",
  "AGATCGGAAGAGC",
  "+",
  "IIIIIIIIIIIII",
].join("\n");

const result = core.analyzeFastqText(fastq, {
  fileName: "unit.fastq",
  qualityOffset: 33,
});

assert.equal(result.overall.metrics.reads, 3);
assert.equal(result.overall.metrics.bases, 29);
assert.equal(result.overall.metrics.minReadLength, 8);
assert.equal(result.overall.metrics.maxReadLength, 13);
assert.equal(result.overall.metrics.q30Pct, core.round((21 / 29) * 100));
assert.equal(result.overall.metrics.nPct, core.round((4 / 29) * 100));
assert.equal(result.overall.adapterHits[0].name, "Illumina universal adapter");
assert.equal(result.overall.adapterHits[0].count, 1);
assert.ok(result.overall.warnings.some((warning) => warning.message.includes("Adapter-like")));

const parsed = core.parseFastq(
  [
    "@multi_line",
    "ACGT",
    "ACGT",
    "+",
    "IIII",
    "IIII",
  ].join("\n"),
  {
    fileName: "multiline.fastq",
  }
);

assert.equal(parsed.records.length, 1);
assert.equal(parsed.records[0].sequence, "ACGTACGT");
assert.equal(parsed.records[0].quality, "IIIIIIII");

const csv = core.buildSummaryCsv(result);
assert.ok(csv.includes("unit.fastq"));
assert.ok(csv.includes("q30_percent"));

console.log("FASTQ core tests passed.");
