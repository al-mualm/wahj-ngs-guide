(function initPublicationTables(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.WahjPublicationTables = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPublicationTablesApi() {
  const IUPAC_MAP = {
    A: ["A"],
    C: ["C"],
    G: ["G"],
    T: ["T"],
    U: ["T"],
    R: ["A", "G"],
    Y: ["C", "T"],
    S: ["G", "C"],
    W: ["A", "T"],
    K: ["G", "T"],
    M: ["A", "C"],
    B: ["C", "G", "T"],
    D: ["A", "G", "T"],
    H: ["A", "C", "T"],
    V: ["A", "C", "G"],
    N: ["A", "C", "G", "T"],
  };

  const TRANSITIONS = new Set(["AG", "GA", "CT", "TC"]);

  function normalizeBase(base) {
    const normalized = String(base || "").trim().toUpperCase();
    if (!normalized) {
      return "";
    }
    if (normalized === ".") {
      return "-";
    }
    return normalized === "U" ? "T" : normalized;
  }

  function getIupacSet(base) {
    const normalized = normalizeBase(base);
    return new Set(IUPAC_MAP[normalized] || []);
  }

  function describeIupac(base) {
    const normalized = normalizeBase(base);
    if (!normalized) {
      return "—";
    }
    if (normalized === "-") {
      return "Gap";
    }
    const values = IUPAC_MAP[normalized];
    return values ? values.join("/") : normalized;
  }

  function isUnambiguousBase(base) {
    return ["A", "C", "G", "T"].includes(normalizeBase(base));
  }

  function hasSetOverlap(leftSet, rightSet) {
    for (const value of leftSet) {
      if (rightSet.has(value)) {
        return true;
      }
    }
    return false;
  }

  function classifyDifference(subjectBase, queryBase) {
    const normalizedSubject = normalizeBase(subjectBase);
    const normalizedQuery = normalizeBase(queryBase);

    if (!normalizedSubject && !normalizedQuery) {
      return {
        isDifference: false,
        status: "—",
        differenceType: "—",
      };
    }

    if (normalizedSubject === normalizedQuery && normalizedSubject !== "-") {
      return {
        isDifference: false,
        status: "Match",
        differenceType: "—",
      };
    }

    if (normalizedSubject === "-" && normalizedQuery && normalizedQuery !== "-") {
      return {
        isDifference: true,
        status: "Insertion in query",
        differenceType: "Insertion",
      };
    }

    if (normalizedQuery === "-" && normalizedSubject && normalizedSubject !== "-") {
      return {
        isDifference: true,
        status: "Deletion in query",
        differenceType: "Deletion",
      };
    }

    if (isUnambiguousBase(normalizedSubject) && isUnambiguousBase(normalizedQuery)) {
      return {
        isDifference: true,
        status: "Definite mismatch",
        differenceType: TRANSITIONS.has(normalizedSubject + normalizedQuery)
          ? "Transition"
          : "Transversion",
      };
    }

    const subjectSet = getIupacSet(normalizedSubject);
    const querySet = getIupacSet(normalizedQuery);
    return {
      isDifference: true,
      status: hasSetOverlap(subjectSet, querySet)
        ? "Ambiguous compatible"
        : "Ambiguous possible mismatch",
      differenceType: "Ambiguous",
    };
  }

  function parseFraction(text) {
    const match = String(text || "").match(/(\d+)\s*\/\s*(\d+)/);
    if (!match) {
      return null;
    }
    return {
      numerator: Number(match[1]) || 0,
      denominator: Number(match[2]) || 0,
    };
  }

  function parseAlignmentText(alignmentText) {
    const lines = String(alignmentText || "").split(/\r?\n/);
    const segments = [];

    for (let index = 0; index < lines.length; index += 1) {
      const queryMatch = lines[index].match(
        /^Query\s+(-?\d+)\s+([A-Za-z-]+)\s+(-?\d+)\s*$/
      );
      if (!queryMatch) {
        continue;
      }

      let matchBars = "";
      let subjectLineIndex = index + 1;
      if (lines[index + 1] && !/^Sbjct\s+/i.test(lines[index + 1])) {
        matchBars = lines[index + 1].replace(/^\s+/, "");
        subjectLineIndex = index + 2;
      }

      const subjectMatch =
        lines[subjectLineIndex] &&
        lines[subjectLineIndex].match(/^Sbjct\s+(-?\d+)\s+([A-Za-z-]+)\s+(-?\d+)\s*$/i);

      if (!subjectMatch) {
        continue;
      }

      const querySequence = queryMatch[2].toUpperCase().replace(/U/g, "T");
      const subjectSequence = subjectMatch[2].toUpperCase().replace(/U/g, "T");
      const normalizedMatchBars = String(matchBars || "")
        .slice(0, querySequence.length)
        .padEnd(querySequence.length, " ");

      segments.push({
        queryStart: Number(queryMatch[1]) || 0,
        queryEnd: Number(queryMatch[3]) || 0,
        querySequence,
        subjectStart: Number(subjectMatch[1]) || 0,
        subjectEnd: Number(subjectMatch[3]) || 0,
        subjectSequence,
        matchBars: normalizedMatchBars,
      });

      index = subjectLineIndex;
    }

    return segments;
  }

  function buildIupacInterpretation(subjectBase, queryBase, difference) {
    if (!difference.isDifference) {
      return "—";
    }

    if (difference.differenceType === "Insertion" || difference.differenceType === "Deletion") {
      return "Gap relative to the selected subject/reference";
    }

    if (isUnambiguousBase(subjectBase) && isUnambiguousBase(queryBase)) {
      return "Unambiguous A/C/G/T comparison";
    }

    return `Subject ${normalizeBase(subjectBase)} = ${describeIupac(subjectBase)}; Query ${normalizeBase(queryBase)} = ${describeIupac(queryBase)}`;
  }

  function buildPositionLabel(currentValue, previousValue, isGap) {
    if (!isGap) {
      return currentValue ? String(currentValue) : "—";
    }
    return previousValue ? `after ${previousValue}` : "—";
  }

  function formatRange(start, end) {
    if (!start || !end) {
      return "—";
    }
    return `${start} to ${end}`;
  }

  function formatStrand(start, end) {
    if (!start || !end) {
      return "—";
    }
    return end >= start ? "Forward (+)" : "Reverse (-)";
  }

  function buildFlankingContext(subjectBases, subjectIndex, subjectBase, queryBase) {
    if (!subjectBases.length) {
      return "—";
    }

    const anchorIndex = Number(subjectIndex);
    if (!Number.isFinite(anchorIndex) || anchorIndex < 0) {
      const rightOnly = subjectBases.slice(0, 5).join("");
      return rightOnly ? `— [${subjectBase}/${queryBase}] ${rightOnly}` : "—";
    }

    const left =
      subjectBase === "-"
        ? subjectBases.slice(Math.max(0, anchorIndex - 4), anchorIndex + 1).join("")
        : subjectBases.slice(Math.max(0, anchorIndex - 5), anchorIndex).join("");
    const right = subjectBases.slice(anchorIndex + 1, anchorIndex + 6).join("");

    return `${left || "—"} [${subjectBase}/${queryBase}] ${right || "—"}`;
  }

  function buildDifferenceRows(alignmentSource) {
    const alignmentText =
      typeof alignmentSource === "string"
        ? alignmentSource
        : alignmentSource && alignmentSource.alignmentText
          ? alignmentSource.alignmentText
          : "";
    const segments = parseAlignmentText(alignmentText);

    const emptyMetrics = {
      alignedLength: 0,
      gapOpenings: 0,
      gapBases: 0,
      definiteSubstitutions: 0,
      transitions: 0,
      transversions: 0,
      ambiguousCompatible: 0,
      ambiguousPossibleMismatch: 0,
      insertionsInQuery: 0,
      deletionsInQuery: 0,
      totalReportedDifferenceRows: 0,
      queryRange: "—",
      subjectRange: "—",
      strand: "—",
    };

    if (!segments.length) {
      return {
        rows: [
          {
            number: 1,
            queryPosition: "—",
            subjectPosition: "—",
            subjectBase: "—",
            queryBase: "—",
            iupacInterpretation: "—",
            status: "Detailed alignment unavailable for this hit",
            differenceType: "—",
            flankingContext: "—",
          },
        ],
        metrics: emptyMetrics,
        available: false,
      };
    }

    const subjectUngappedBases = [];
    segments.forEach((segment) => {
      Array.from(segment.subjectSequence).forEach((base) => {
        const normalized = normalizeBase(base);
        if (normalized && normalized !== "-") {
          subjectUngappedBases.push(normalized);
        }
      });
    });

    const differenceRows = [];
    const metrics = {
      alignedLength: 0,
      gapOpenings: 0,
      gapBases: 0,
      definiteSubstitutions: 0,
      transitions: 0,
      transversions: 0,
      ambiguousCompatible: 0,
      ambiguousPossibleMismatch: 0,
      insertionsInQuery: 0,
      deletionsInQuery: 0,
      totalReportedDifferenceRows: 0,
      queryRange: formatRange(segments[0].queryStart, segments[segments.length - 1].queryEnd),
      subjectRange: formatRange(
        segments[0].subjectStart,
        segments[segments.length - 1].subjectEnd
      ),
      strand: formatStrand(
        segments[0].subjectStart,
        segments[segments.length - 1].subjectEnd
      ),
    };

    let rowNumber = 1;
    let previousQueryCoord = null;
    let previousSubjectCoord = null;
    let subjectUngappedIndex = -1;
    let activeGapType = "";

    segments.forEach((segment) => {
      const queryStep = segment.queryEnd >= segment.queryStart ? 1 : -1;
      const subjectStep = segment.subjectEnd >= segment.subjectStart ? 1 : -1;
      let queryCoord = segment.queryStart;
      let subjectCoord = segment.subjectStart;

      for (let index = 0; index < segment.querySequence.length; index += 1) {
        const queryBase = normalizeBase(segment.querySequence[index]);
        const subjectBase = normalizeBase(segment.subjectSequence[index]);
        const currentQueryCoord = queryBase === "-" ? null : queryCoord;
        const currentSubjectCoord = subjectBase === "-" ? null : subjectCoord;
        const currentSubjectIndex =
          subjectBase === "-" ? subjectUngappedIndex : subjectUngappedIndex + 1;
        const difference = classifyDifference(subjectBase, queryBase);

        metrics.alignedLength += 1;

        if (difference.differenceType === "Insertion" || difference.differenceType === "Deletion") {
          if (activeGapType !== difference.differenceType) {
            metrics.gapOpenings += 1;
          }
          activeGapType = difference.differenceType;
        } else {
          activeGapType = "";
        }

        if (difference.isDifference) {
          const subjectPosition = buildPositionLabel(
            currentSubjectCoord,
            previousSubjectCoord,
            subjectBase === "-"
          );
          const queryPosition = buildPositionLabel(
            currentQueryCoord,
            previousQueryCoord,
            queryBase === "-"
          );

          if (difference.status === "Definite mismatch") {
            metrics.definiteSubstitutions += 1;
          } else if (difference.status === "Ambiguous compatible") {
            metrics.ambiguousCompatible += 1;
          } else if (difference.status === "Ambiguous possible mismatch") {
            metrics.ambiguousPossibleMismatch += 1;
          } else if (difference.status === "Insertion in query") {
            metrics.insertionsInQuery += 1;
          } else if (difference.status === "Deletion in query") {
            metrics.deletionsInQuery += 1;
          }

          if (difference.differenceType === "Transition") {
            metrics.transitions += 1;
          } else if (difference.differenceType === "Transversion") {
            metrics.transversions += 1;
          } else if (
            difference.differenceType === "Insertion" ||
            difference.differenceType === "Deletion"
          ) {
            metrics.gapBases += 1;
          }

          differenceRows.push({
            number: rowNumber,
            queryPosition,
            subjectPosition,
            subjectBase: subjectBase || "—",
            queryBase: queryBase || "—",
            iupacInterpretation: buildIupacInterpretation(subjectBase, queryBase, difference),
            status: difference.status,
            differenceType: difference.differenceType,
            flankingContext: buildFlankingContext(
              subjectUngappedBases,
              currentSubjectIndex,
              subjectBase || "—",
              queryBase || "—"
            ),
          });
          rowNumber += 1;
        }

        if (queryBase !== "-") {
          previousQueryCoord = queryCoord;
          queryCoord += queryStep;
        }

        if (subjectBase !== "-") {
          subjectUngappedIndex += 1;
          previousSubjectCoord = subjectCoord;
          subjectCoord += subjectStep;
        }
      }
    });

    metrics.totalReportedDifferenceRows = differenceRows.length;

    if (!differenceRows.length) {
      return {
        rows: [
          {
            number: 1,
            queryPosition: "—",
            subjectPosition: "—",
            subjectBase: "—",
            queryBase: "—",
            iupacInterpretation: "—",
            status: "No nucleotide differences detected in the aligned region",
            differenceType: "—",
            flankingContext: "—",
          },
        ],
        metrics,
        available: true,
      };
    }

    return {
      rows: differenceRows,
      metrics,
      available: true,
    };
  }

  function getSourceValue(hit) {
    const source = String(hit && (hit.source || hit.title || hit.organism) || "").trim();
    const organism = String(hit && hit.organism || "").trim();
    if (!source && !organism) {
      return "—";
    }
    if (source && organism && source.toLowerCase().indexOf(organism.toLowerCase()) === -1) {
      return `${source} | ${organism}`;
    }
    return source || organism;
  }

  function buildAlignmentSummaryRows(hit, queryMetadata) {
    const metadata = queryMetadata || {};
    const differences = buildDifferenceRows(hit);
    const identities = parseFraction(hit && hit.identities);
    const gaps = parseFraction(hit && hit.gaps);
    const alignedLength =
      (identities && identities.denominator) || differences.metrics.alignedLength || 0;
    const gapBases = (gaps && gaps.numerator) || differences.metrics.gapBases || 0;
    const mismatches =
      identities && identities.denominator
        ? Math.max(0, identities.denominator - identities.numerator - gapBases)
        : differences.metrics.definiteSubstitutions + differences.metrics.ambiguousPossibleMismatch;

    return [
      ["Sample no.", metadata.sampleNumber || "—"],
      ["Lab ID", metadata.wahjSampleId || "—"],
      ["Query name", metadata.queryTitle || metadata.sequenceTitle || "—"],
      ["Selected accession", (hit && hit.accession) || "—"],
      ["Source / organism", getSourceValue(hit)],
      ["Gene or marker", metadata.geneMarker || "—"],
      ["Strand", differences.metrics.strand || "—"],
      ["Query range", differences.metrics.queryRange || "—"],
      ["Subject range", differences.metrics.subjectRange || "—"],
      ["Aligned length (bp)", alignedLength ? String(alignedLength) : "—"],
      [
        "Query coverage (%)",
        hit && Number.isFinite(Number(hit.queryCoverage)) ? String(hit.queryCoverage) : "—",
      ],
      [
        "Percent identity (%)",
        hit && Number.isFinite(Number(hit.percentIdentity)) ? String(hit.percentIdentity) : "—",
      ],
      ["Identities", (hit && hit.identities) || "—"],
      ["Mismatches", Number.isFinite(mismatches) ? String(mismatches) : "—"],
      ["Gap openings", String(differences.metrics.gapOpenings || 0)],
      ["Gap bases", String(gapBases)],
      ["E-value", (hit && (hit.eValue || hit.expect)) || "—"],
      ["Bit score", (hit && hit.score) || "—"],
      ["Match interpretation", metadata.matchInterpretation || "—"],
    ];
  }

  function buildDifferenceCountRows(differenceBundle) {
    const metrics = differenceBundle && differenceBundle.metrics ? differenceBundle.metrics : {};
    return [
      ["Definite substitutions", String(metrics.definiteSubstitutions || 0)],
      ["Transitions", String(metrics.transitions || 0)],
      ["Transversions", String(metrics.transversions || 0)],
      ["Ambiguous compatible base calls", String(metrics.ambiguousCompatible || 0)],
      ["Ambiguous possible mismatches", String(metrics.ambiguousPossibleMismatch || 0)],
      ["Insertions in query relative to subject", String(metrics.insertionsInQuery || 0)],
      ["Deletions in query relative to subject", String(metrics.deletionsInQuery || 0)],
      ["Total gap bases", String(metrics.gapBases || 0)],
      ["Total reported difference rows", String(metrics.totalReportedDifferenceRows || 0)],
    ];
  }

  function buildTopHitComparisonRows(hits, selectedHit, queryMetadata) {
    const rankedHits = Array.isArray(hits) ? hits.slice() : [];
    const selectedAccession = selectedHit && selectedHit.accession ? selectedHit.accession : "";
    const selectedIndex = rankedHits.findIndex((hit) => hit.accession === selectedAccession);
    const selected = selectedIndex >= 0 ? rankedHits[selectedIndex] : selectedHit;
    const remaining = rankedHits.filter((hit) => hit.accession !== selectedAccession).slice(0, 4);
    const visibleHits = [selected].concat(remaining).filter(Boolean);
    const geneMarker = (queryMetadata && queryMetadata.geneMarker) || "—";

    return visibleHits.map((hit) => {
      const originalRank = rankedHits.findIndex((candidate) => candidate.accession === hit.accession) + 1;
      let note = "Lower-ranked hit";
      if (hit.accession === selectedAccession) {
        note = originalRank === 1 ? "Top selected hit" : "Selected hit";
      } else if (
        Number(hit.percentIdentity || 0) === Number(selectedHit.percentIdentity || 0)
      ) {
        note = "Same identity as selected hit";
      } else if (
        Number(hit.queryCoverage || 0) >= Number(selectedHit.queryCoverage || 0) - 5 ||
        Number(hit.percentIdentity || 0) >= Number(selectedHit.percentIdentity || 0) - 1
      ) {
        note = "Close alternative";
      }

      return [
        String(originalRank || "—"),
        hit.accession || "—",
        getSourceValue(hit),
        geneMarker,
        Number.isFinite(Number(hit.queryCoverage)) ? String(hit.queryCoverage) : "—",
        Number.isFinite(Number(hit.percentIdentity)) ? String(hit.percentIdentity) : "—",
        hit.identities || "—",
        hit.gaps || "—",
        hit.eValue || hit.expect || "—",
        hit.score || "—",
        note,
      ];
    });
  }

  function extractGeneOrFeatureLabel(hit, queryMetadata) {
    const metadataValue = String(
      (queryMetadata && queryMetadata.geneMarker) || ""
    ).trim();
    if (metadataValue) {
      return metadataValue;
    }

    const source = String((hit && (hit.source || hit.title || "")) || "").trim();
    if (!source) {
      return "—";
    }

    const parentheticalMatch = source.match(/\(([A-Za-z0-9._-]{2,30})\)/);
    if (parentheticalMatch) {
      return parentheticalMatch[1];
    }

    const descriptiveMatch = source.match(
      /\b([A-Za-z0-9._-]{2,40})\s+(gene|mRNA|rRNA|tRNA|transcript|cds)\b/i
    );
    if (descriptiveMatch) {
      return descriptiveMatch[1];
    }

    return "—";
  }

  function getReferenceAnnotationAtPosition(subjectPosition, optionalFeatureAnnotations) {
    if (!optionalFeatureAnnotations || !Array.isArray(optionalFeatureAnnotations.features)) {
      return null;
    }

    const numericPosition = Number(subjectPosition);
    if (!Number.isFinite(numericPosition)) {
      return null;
    }

    return (
      optionalFeatureAnnotations.features.find((feature) => {
        const start = Number(feature.start);
        const end = Number(feature.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
          return false;
        }
        const lower = Math.min(start, end);
        const upper = Math.max(start, end);
        return numericPosition >= lower && numericPosition <= upper;
      }) || null
    );
  }

  function classifyRegionType(feature) {
    if (!feature || !feature.type) {
      return "Annotation unavailable";
    }

    const normalizedType = String(feature.type).trim().toLowerCase();
    if (normalizedType === "cds") {
      return "Coding region";
    }
    if (normalizedType === "rrna") {
      return "rRNA gene";
    }
    if (normalizedType === "trna") {
      return "tRNA gene";
    }
    return feature.type || "Annotated feature";
  }

  function formatReferenceChangeType(row) {
    if (!row) {
      return "—";
    }
    if (row.differenceType === "Transition" || row.differenceType === "Transversion") {
      return row.differenceType;
    }
    if (row.status === "Ambiguous compatible") {
      return "Ambiguous compatible";
    }
    if (row.status === "Ambiguous possible mismatch") {
      return "Ambiguous possible mismatch";
    }
    if (row.differenceType === "Insertion") {
      return "Insertion";
    }
    if (row.differenceType === "Deletion") {
      return "Deletion";
    }
    return row.differenceType || row.status || "—";
  }

  function buildReferenceBasedChangeTableRows(
    selectedHit,
    differenceRows,
    queryMetadata,
    optionalFeatureAnnotations
  ) {
    const metadata = queryMetadata || {};
    const rows = Array.isArray(differenceRows) ? differenceRows : [];
    const geneOrFeature = extractGeneOrFeatureLabel(selectedHit, metadata);
    const percentIdentity =
      selectedHit && Number.isFinite(Number(selectedHit.percentIdentity))
        ? `${selectedHit.percentIdentity}%`
        : "—";
    const source = getSourceValue(selectedHit);

    const unavailableRow = rows.find(
      (row) => row.status === "Detailed alignment unavailable for this hit"
    );
    if (unavailableRow) {
      return [
        [
          metadata.sampleNumber || "—",
          metadata.wahjSampleId || "—",
          (selectedHit && selectedHit.accession) || "—",
          source,
          "Annotation unavailable",
          geneOrFeature,
          "—",
          "—",
          "—",
          percentIdentity,
          "Detailed alignment unavailable for this hit",
        ],
      ];
    }

    const noDifferenceRow = rows.find(
      (row) => row.status === "No nucleotide differences detected in the aligned region"
    );
    if (noDifferenceRow) {
      return [
        [
          metadata.sampleNumber || "—",
          metadata.wahjSampleId || "—",
          (selectedHit && selectedHit.accession) || "—",
          source,
          optionalFeatureAnnotations ? "Intergenic / noncoding" : "Annotation unavailable",
          geneOrFeature,
          "—",
          "—",
          "—",
          percentIdentity,
          optionalFeatureAnnotations
            ? "No nucleotide differences detected in the aligned region."
            : "No nucleotide differences detected in the aligned region. Region classification requires annotated reference features.",
        ],
      ];
    }

    const annotatedFeatures = rows.map((row) =>
      getReferenceAnnotationAtPosition(row.subjectPosition, optionalFeatureAnnotations)
    );
    const regionTypeValues = annotatedFeatures.map((feature) => classifyRegionType(feature));
    const featureValues = annotatedFeatures.map((feature) => {
      const explicitGene =
        feature && (feature.gene || feature.locusTag || feature.product || feature.type);
      return explicitGene || geneOrFeature;
    });

    const regionType =
      optionalFeatureAnnotations && regionTypeValues.some((value) => value !== "Annotation unavailable")
        ? regionTypeValues.join("\n")
        : "Annotation unavailable";
    const featureLabel =
      optionalFeatureAnnotations && featureValues.some((value) => value && value !== "—")
        ? featureValues.join("\n")
        : geneOrFeature;

    const annotationComment = optionalFeatureAnnotations
      ? "Nucleotide-level changes only; coding/protein effect not assessed."
      : "Region classification requires annotated reference features.";

    return [
      [
        metadata.sampleNumber || "—",
        metadata.wahjSampleId || "—",
        (selectedHit && selectedHit.accession) || "—",
        source,
        regionType,
        featureLabel || "—",
        rows.map((row) => row.subjectPosition || "—").join("\n"),
        rows.map((row) => `${row.subjectBase || "—"}/${row.queryBase || "—"}`).join("\n"),
        rows.map((row) => formatReferenceChangeType(row)).join("\n"),
        percentIdentity,
        annotationComment,
      ],
    ];
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function tableToTsv(rows) {
    return (rows || [])
      .map((row) =>
        row
          .map((value) => String(value == null ? "" : value).replace(/\t/g, " ").replace(/\r?\n/g, " "))
          .join("\t")
      )
      .join("\n");
  }

  function tableToCsv(rows) {
    return (rows || [])
      .map((row) =>
        row
          .map((value) => `"${String(value == null ? "" : value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
  }

  function sanitizeFilenamePart(value) {
    const normalized = String(value || "selected_hit")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return normalized || "selected_hit";
  }

  function buildCopyPayloadFromTableData(tableData) {
    const headerRows = [tableData.columns].concat(tableData.rows || []);
    const formatCellHtml = (cell) =>
      escapeHtml(cell == null ? "" : cell)
        .split("\n")
        .join("<br />");
    const htmlRows = (tableData.rows || [])
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${formatCellHtml(cell)}</td>`).join("")}</tr>`
      )
      .join("");
    const html = [
      `<p><strong>${escapeHtml(tableData.caption)}</strong></p>`,
      "<table>",
      `<caption>${escapeHtml(tableData.caption)}</caption>`,
      `<thead><tr>${tableData.columns
        .map((column) => `<th>${escapeHtml(column)}</th>`)
        .join("")}</tr></thead>`,
      `<tbody>${htmlRows}</tbody>`,
      "</table>",
    ].join("");

    return {
      html,
      text: `${tableData.caption}\n${tableToTsv(headerRows)}`,
    };
  }

  async function writeClipboardPayload(payload) {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === "function" &&
      typeof ClipboardItem !== "undefined"
    ) {
      const item = new ClipboardItem({
        "text/html": new Blob([payload.html], { type: "text/html" }),
        "text/plain": new Blob([payload.text], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return;
    }

    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(payload.text);
      return;
    }

    throw new Error("Clipboard access is not available in this browser.");
  }

  async function copyTableElement(tableElement) {
    if (!tableElement) {
      throw new Error("No table element was available to copy.");
    }

    const caption = tableElement.querySelector("caption");
    const headers = Array.from(tableElement.querySelectorAll("thead th")).map((cell) =>
      cell.textContent.trim()
    );
    const rows = Array.from(tableElement.querySelectorAll("tbody tr")).map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) => cell.textContent.trim())
    );

    await writeClipboardPayload(
      buildCopyPayloadFromTableData({
        caption: caption ? caption.textContent.trim() : "Publication table",
        columns: headers,
        rows,
      })
    );
  }

  async function copyTableData(tableData) {
    await writeClipboardPayload(buildCopyPayloadFromTableData(tableData));
  }

  async function copyTableCollection(tableDataList) {
    const tables = Array.isArray(tableDataList) ? tableDataList : [];
    const html = tables
      .map((tableData) => buildCopyPayloadFromTableData(tableData).html)
      .join("<br />");
    const text = tables
      .map((tableData) => buildCopyPayloadFromTableData(tableData).text)
      .join("\n\n");
    await writeClipboardPayload({ html, text });
  }

  function downloadCsv(rows, filename) {
    if (typeof document === "undefined") {
      throw new Error("CSV download is only available in the browser.");
    }

    const blob = new Blob([tableToCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }

  function buildPublicationTables(options) {
    const hit = options && options.hit ? options.hit : null;
    const hits = options && Array.isArray(options.hits) ? options.hits : [];
    const queryMetadata = options && options.queryMetadata ? options.queryMetadata : {};
    const optionalFeatureAnnotations =
      options && options.optionalFeatureAnnotations ? options.optionalFeatureAnnotations : null;
    const differenceBundle = buildDifferenceRows(hit);
    const accessionKey = sanitizeFilenamePart(hit && hit.accession ? hit.accession : "selected_hit");

    // Coding/protein-effect prediction is intentionally not implemented here.
    // A BLAST nucleotide alignment alone is not enough for safe CDS/codon/HGVS inference.
    // That requires trusted CDS/transcript annotation and reference feature tables.
    return [
      {
        id: "alignment-summary",
        label: "Alignment summary",
        caption: "Alignment summary for the selected BLAST hit",
        columns: ["Parameter", "Value"],
        rows: buildAlignmentSummaryRows(hit, queryMetadata),
        filename: `wahj_alignment_summary_${accessionKey}.csv`,
      },
      {
        id: "difference-counts",
        label: "Difference counts",
        caption: "Summary of nucleotide differences in the selected alignment",
        columns: ["Difference category", "Count"],
        rows: buildDifferenceCountRows(differenceBundle),
        filename: `wahj_difference_counts_${accessionKey}.csv`,
      },
      {
        id: "nucleotide-differences",
        label: "Nucleotide differences",
        caption: "Nucleotide differences between the query sequence and the selected BLAST hit",
        columns: [
          "No.",
          "Query position",
          "Subject position",
          "Subject base",
          "Query base",
          "IUPAC interpretation",
          "Status",
          "Difference type",
          "Flanking context",
        ],
        rows: differenceBundle.rows.map((row) => [
          String(row.number),
          row.queryPosition,
          row.subjectPosition,
          row.subjectBase,
          row.queryBase,
          row.iupacInterpretation,
          row.status,
          row.differenceType,
          row.flankingContext,
        ]),
        filename: `wahj_difference_table_${accessionKey}.csv`,
      },
      {
        id: "reference-based-change-table",
        label: "Reference-based change table",
        caption: "Reference-based nucleotide change table for the selected BLAST hit",
        columns: [
          "Sample No.",
          "Lab ID",
          "Sequence ID / Compare",
          "Source",
          "Region type",
          "Gene / feature",
          "Location of change",
          "Nucleotide Subject/Query",
          "Type of change",
          "Identity (%)",
          "Comment",
        ],
        rows: buildReferenceBasedChangeTableRows(
          hit,
          differenceBundle.rows,
          queryMetadata,
          optionalFeatureAnnotations
        ),
        filename: `wahj_reference_change_table_${accessionKey}.csv`,
      },
      {
        id: "top-hit-comparison",
        label: "Top-hit comparison",
        caption: "Comparison of top BLAST hits for the query sequence",
        columns: [
          "Rank",
          "Accession",
          "Source / organism",
          "Gene or marker",
          "Query coverage (%)",
          "Percent identity (%)",
          "Identities",
          "Gaps",
          "E-value",
          "Bit score",
          "Note",
        ],
        rows: buildTopHitComparisonRows(hits, hit, queryMetadata),
        filename: `wahj_top_hits_${accessionKey}.csv`,
      },
    ];
  }

  return {
    normalizeBase,
    getIupacSet,
    describeIupac,
    classifyDifference,
    buildDifferenceRows,
    buildAlignmentSummaryRows,
    buildDifferenceCountRows,
    buildReferenceBasedChangeTableRows,
    buildTopHitComparisonRows,
    buildPublicationTables,
    tableToTsv,
    copyTableElement,
    copyTableData,
    copyTableCollection,
    buildCopyPayloadFromTableData,
    downloadCsv,
  };
});
