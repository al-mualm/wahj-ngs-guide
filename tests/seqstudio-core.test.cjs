const assert = require("node:assert/strict");
const { File } = require("node:buffer");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../seqstudio/seqstudio-core.js");

function buildSample(sequence, qualities) {
  return {
    sampleName: "sample-1",
    trimmedSequence: sequence,
    trimmedQualities: qualities || new Array(sequence.length).fill(30),
    secondaryPeaks: new Array(sequence.length).fill(null).map(() => ({
      secondaryBase: "",
      secondaryRatio: 0,
      heterozygousCandidate: false,
      iupacCall: "",
    })),
    trimStart: 0,
    trimEnd: sequence.length,
    chromatogram: {
      basePos: sequence.split("").map((_, index) => index * 12),
      aTrace: new Array(sequence.length * 20).fill(0),
      cTrace: new Array(sequence.length * 20).fill(0),
      gTrace: new Array(sequence.length * 20).fill(0),
      tTrace: new Array(sequence.length * 20).fill(0),
    },
  };
}

async function run() {
  assert.equal(core.reverseComplement("ATGCR"), "YGCAT");

  const trim = core.trimByQuality(
    "AACCGGTTAACC",
    [5, 8, 24, 28, 30, 30, 31, 29, 28, 8, 6, 4],
    { minQuality: 20, windowSize: 3, minLength: 4 }
  );
  assert.equal(trim.sequence, "CCGGTTA");
  assert.equal(trim.start, 2);
  assert.equal(trim.end, 9);

  const reference = {
    sequence: "AAATTTCCCGGG",
    features: [],
    cdsParts: [],
  };
  const forwardAlignment = core.alignSampleToReference(
    buildSample("TTTCCC"),
    reference,
    {}
  );
  assert.equal(forwardAlignment.orientation, "forward");
  assert.equal(forwardAlignment.refStart, 3);

  const reverseAlignment = core.alignSampleToReference(
    buildSample("GGGAAA"),
    reference,
    {}
  );
  assert.equal(reverseAlignment.orientation, "reverse-complement");

  const codingReference = {
    sequence: "ATGGAA",
    features: [
      { type: "cds", label: "CDS", start: 1, end: 6, strand: 1, metadata: {} },
    ],
    cdsParts: [{ start: 1, end: 6, strand: 1 }],
    geneName: "TEST",
  };

  const analyzed = core.analyzeSamplesAgainstReference(
    [buildSample("ATGAAA")],
    codingReference,
    {}
  );
  assert.equal(analyzed.length, 1);
  assert.equal(analyzed[0].variants.length, 1);
  assert.equal(analyzed[0].variants[0].codingEffect, "Missense");
  assert.equal(analyzed[0].variants[0].aminoAcidChange, "E2K");

  const deletionVariant = core.annotateVariant(
    {
      referencePosition: 4,
      referenceBase: "G",
      queryBase: "-",
      type: "deletion",
    },
    codingReference,
    null
  );
  assert.equal(deletionVariant.codingEffect, "Frameshift candidate");

  const frequencies = core.calculateVariantFrequencies(analyzed);
  assert.equal(frequencies.length, 1);
  assert.equal(frequencies[0].sampleCount, 1);

  const ab1Path = path.join(__dirname, "../seqstudio/demo-data/310.ab1");
  const ab1Buffer = fs.readFileSync(ab1Path);
  const parsedAb1 = await core.parseAb1Data(ab1Buffer);
  assert.equal(typeof parsedAb1.parsedSequence.sequence, "string");
  assert.ok(parsedAb1.parsedSequence.sequence.length > 500);
  assert.ok(parsedAb1.parsedSequence.chromatogramData.basePos.length > 500);
  assert.ok(parsedAb1.parsedSequence.chromatogramData.aTrace.length > 1000);

  const parsedAb1FromFile = await core.parseAb1Data(new File([ab1Buffer], "310.ab1"));
  assert.equal(
    parsedAb1FromFile.parsedSequence.sequence.length,
    parsedAb1.parsedSequence.sequence.length
  );

  const normalizedAb1Sample = core.normalizeAb1SampleData(parsedAb1, "310.ab1", {
    minQuality: 20,
    minLength: 80,
    windowSize: 12,
  });
  assert.equal(normalizedAb1Sample.sampleName, "310");
  assert.ok(normalizedAb1Sample.rawLength > 500);
  assert.ok(normalizedAb1Sample.trimmedLength > 500);
  assert.equal(normalizedAb1Sample.reportedQualityScores, false);
  assert.equal(normalizedAb1Sample.status, "warning");

  const selfReference = {
    sequence: normalizedAb1Sample.trimmedSequence,
    features: [],
    cdsParts: [],
  };
  const selfAnalysis = core.analyzeSamplesAgainstReference([normalizedAb1Sample], selfReference, {});
  assert.equal(selfAnalysis.length, 1);
  assert.equal(selfAnalysis[0].variants.length, 0);

  console.log("seqstudio-core tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
