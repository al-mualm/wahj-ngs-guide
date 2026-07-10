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

const samplingState = core.createFastqSamplingState({ maxRecords: 2 });
core.appendFastqSamplingChunk(
  samplingState,
  [
    "@read_1",
    "ACGT",
    "+",
    "IIII",
    "@read_2",
    "TGCA",
    "+",
    "HHHH",
    "@read_3",
    "NNNN",
    "+",
    "####",
  ].join("\n")
);
const sampled = core.finalizeFastqSamplingState(samplingState);
assert.equal(sampled.truncated, true);
assert.equal(sampled.recordCount, 2);
assert.ok(sampled.text.includes("@read_1"));
assert.ok(sampled.text.includes("@read_2"));
assert.ok(!sampled.text.includes("@read_3"));

const chunkedSamplingState = core.createFastqSamplingState({ maxRecords: 1 });
core.appendFastqSamplingChunk(chunkedSamplingState, "@read_a\r\nAC");
core.appendFastqSamplingChunk(chunkedSamplingState, "GT\r\n+\r\nII");
core.appendFastqSamplingChunk(chunkedSamplingState, "II\r\n@read_b\r\n");
const chunkedSample = core.finalizeFastqSamplingState(chunkedSamplingState);
assert.equal(chunkedSample.truncated, true);
assert.equal(chunkedSample.recordCount, 1);
assert.ok(chunkedSample.text.includes("@read_a"));
assert.ok(!chunkedSample.text.includes("@read_b"));

const streamingAggregate = core.createAggregate("streamed.fastq");
const streamingParser = core.createFastqRecordParser({
  fileName: "streamed.fastq",
  onRecord(record) {
    core.scanRecordQualityAscii(record, streamingAggregate);
    core.updateAggregateWithRecord(streamingAggregate, record, 33, {
      lengthBinWidth: 25,
      gcBinWidth: 5,
      qualityBinWidth: 5,
      maxTrackedSequences: 20000,
    });
  },
});
core.appendFastqRecordChunk(streamingParser, fastq.slice(0, 31));
core.appendFastqRecordChunk(streamingParser, fastq.slice(31, 67));
core.appendFastqRecordChunk(streamingParser, fastq.slice(67));
const streamedParsed = core.finalizeFastqRecordParser(streamingParser);
streamingAggregate.parseErrors.push(...streamedParsed.errors);
streamingAggregate.parseWarnings.push(...streamedParsed.warnings);
streamingAggregate.encoding = core.estimateQualityOffsetFromAggregate(streamingAggregate, 33);
const streamingSummary = core.summarizeAggregate(streamingAggregate);
assert.equal(streamedParsed.recordCount, 3);
assert.equal(streamingSummary.metrics.reads, result.overall.metrics.reads);
assert.equal(streamingSummary.metrics.bases, result.overall.metrics.bases);
assert.equal(streamingSummary.metrics.q30Pct, result.overall.metrics.q30Pct);

console.log("FASTQ core tests passed.");
