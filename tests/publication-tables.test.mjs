import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const publicationApi = require("../sequence-analysis/publication-tables.js");

const {
  classifyDifference,
  buildDifferenceRows,
  buildReferenceBasedChangeTableRows,
  buildPublicationTables,
  buildCopyPayloadFromTableData,
} = publicationApi;

function testDifferenceClassification() {
  assert.deepEqual(classifyDifference("G", "T"), {
    isDifference: true,
    status: "Definite mismatch",
    differenceType: "Transversion",
  });

  assert.deepEqual(classifyDifference("A", "G"), {
    isDifference: true,
    status: "Definite mismatch",
    differenceType: "Transition",
  });

  assert.deepEqual(classifyDifference("G", "R"), {
    isDifference: true,
    status: "Ambiguous compatible",
    differenceType: "Ambiguous",
  });

  assert.deepEqual(classifyDifference("T", "W"), {
    isDifference: true,
    status: "Ambiguous compatible",
    differenceType: "Ambiguous",
  });

  assert.deepEqual(classifyDifference("C", "M"), {
    isDifference: true,
    status: "Ambiguous compatible",
    differenceType: "Ambiguous",
  });

  assert.deepEqual(classifyDifference("G", "Y"), {
    isDifference: true,
    status: "Ambiguous possible mismatch",
    differenceType: "Ambiguous",
  });

  assert.deepEqual(classifyDifference("A", "-"), {
    isDifference: true,
    status: "Deletion in query",
    differenceType: "Deletion",
  });

  assert.deepEqual(classifyDifference("-", "T"), {
    isDifference: true,
    status: "Insertion in query",
    differenceType: "Insertion",
  });
}

function testReverseCoordinateHandling() {
  const reverseBundle = buildDifferenceRows({
    alignmentText: [
      "Query    1  AGGT  4",
      "            | ||",
      "Sbjct   10  ATGT  7",
    ].join("\n"),
  });

  assert.equal(reverseBundle.available, true);
  assert.equal(reverseBundle.metrics.strand, "Reverse (-)");
  assert.equal(reverseBundle.rows[0].queryPosition, "2");
  assert.equal(reverseBundle.rows[0].subjectPosition, "9");
  assert.equal(reverseBundle.rows[0].differenceType, "Transversion");
}

function testNoDifferences() {
  const noDifferenceBundle = buildDifferenceRows({
    alignmentText: [
      "Query    1  ACGT  4",
      "            ||||",
      "Sbjct    5  ACGT  8",
    ].join("\n"),
  });

  assert.equal(noDifferenceBundle.available, true);
  assert.equal(noDifferenceBundle.rows.length, 1);
  assert.equal(
    noDifferenceBundle.rows[0].status,
    "No nucleotide differences detected in the aligned region"
  );
}

function testPublicationTables() {
  const hit = {
    accession: "KF475848.1",
    source: "Bacillus pumilus strain IHB B 2692 16S ribosomal RNA gene, partial sequence",
    organism: "Bacillus pumilus",
    identities: "402/417 (96%)",
    gaps: "2/417 (0%)",
    percentIdentity: 96,
    queryCoverage: 95,
    eValue: "0.0",
    score: "706 bits (382)",
    alignmentText: [
      "Query    28  AGAGTTTGATCCTGGCTCAGGATGAACGCTGGCGGCGTGCCTAATACATGCAAGT   87",
      "             ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||",
      "Sbjct    26  AGAGTTTGATCCTGGCTCAGGATGAACGCTGGCGGCGTGCCTAATACATGCAAGT   85",
      "Query    88  CGAGCGAAAGCGTGGGGAGCAAACAGGATTAGATACCCTGGTAGTCCACGCCGTA  147",
      "             ||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||",
      "Sbjct    86  CGAGCGAAAGCGTGGGGAGCAAACAGGATTAGATACCCTGGTAGTCCACGCCGTA  145",
    ].join("\n"),
  };

  const tables = buildPublicationTables({
    hit,
    hits: [hit],
    queryMetadata: {
      sampleNumber: "5",
      wahjSampleId: "S5",
      sequenceTitle: "Bacterial isolate 5 forward read",
      queryTitle: "Bacterial isolate 5 forward read",
      geneMarker: "16S rRNA",
      matchInterpretation: "Strong match",
    },
  });

  assert.equal(tables.length, 5);
  assert.equal(tables[0].caption, "Alignment summary for the selected BLAST hit");
  assert.equal(
    tables[3].caption,
    "Reference-based nucleotide change table for the selected BLAST hit"
  );
  assert.equal(tables[4].rows.length, 1);
  assert.equal(tables[4].rows[0][10], "Top selected hit");
}

function testReferenceBasedChangeTableRows() {
  const differenceRows = [
    {
      subjectPosition: "1139",
      subjectBase: "G",
      queryBase: "T",
      status: "Definite mismatch",
      differenceType: "Transversion",
    },
    {
      subjectPosition: "1135",
      subjectBase: "A",
      queryBase: "G",
      status: "Definite mismatch",
      differenceType: "Transition",
    },
  ];

  const rows = buildReferenceBasedChangeTableRows(
    {
      accession: "MK476070.1",
      source:
        "Homo sapiens voucher Bakota_2_1 hemoglobin subunit beta (HBB) gene, complete cds",
      percentIdentity: 97,
    },
    differenceRows,
    {
      sampleNumber: "C3",
      wahjSampleId: "C3",
      geneMarker: "",
    },
    null
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], "C3");
  assert.equal(rows[0][4], "Annotation unavailable");
  assert.equal(rows[0][5], "HBB");
  assert.equal(rows[0][6], "1139\n1135");
  assert.equal(rows[0][7], "G/T\nA/G");
  assert.equal(rows[0][8], "Transversion\nTransition");
  assert.equal(rows[0][9], "97%");
  assert.match(rows[0][10], /Region classification requires annotated reference features/);
}

function testCopyPayloadIsClean() {
  const payload = buildCopyPayloadFromTableData({
    caption: "Alignment summary for the selected BLAST hit",
    columns: ["Parameter", "Value"],
    rows: [["Sample no.", "5"]],
  });

  assert.match(payload.html, /<table>/);
  assert.match(payload.text, /Alignment summary for the selected BLAST hit/);
  assert.doesNotMatch(payload.html, /Copy table/i);
  assert.doesNotMatch(payload.text, /Copy table/i);
}

testDifferenceClassification();
testReverseCoordinateHandling();
testNoDifferences();
testPublicationTables();
testReferenceBasedChangeTableRows();
testCopyPayloadIsClean();

console.log("publication-tables tests passed");
