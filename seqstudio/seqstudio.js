(function () {
  "use strict";

  const bioParsers = window.bioParsers;
  const core = window.SeqStudioCore;

  if (!bioParsers || !core) {
    console.error("SeqStudio dependencies are not available.");
    return;
  }

  const state = {
    referenceMode: "gene",
    samples: [],
    reference: null,
    results: [],
    knownVariantsByPosition: new Map(),
    publicationTables: {},
    activePublicationTab: "qc",
    browserWindowStart: 1,
    browserWindowSize: 90,
    report: null,
  };

  const elements = {
    fileInput: document.querySelector("#ab1-files"),
    uploadStatus: document.querySelector("#upload-status"),
    sampleQcBody: document.querySelector("#sample-qc-body"),
    referenceButtons: Array.from(document.querySelectorAll("[data-reference-mode]")),
    referencePanels: {
      gene: document.querySelector("#reference-mode-gene"),
      accession: document.querySelector("#reference-mode-accession"),
      fasta: document.querySelector("#reference-mode-fasta"),
    },
    geneSymbol: document.querySelector("#reference-gene-symbol"),
    organism: document.querySelector("#reference-organism"),
    sequenceType: document.querySelector("#reference-sequence-type"),
    accession: document.querySelector("#reference-accession"),
    fasta: document.querySelector("#reference-fasta"),
    loadReferenceButton: document.querySelector("#load-reference-button"),
    referenceStatus: document.querySelector("#reference-status"),
    referenceLabel: document.querySelector("#reference-label"),
    referenceLength: document.querySelector("#reference-length"),
    referenceFeatures: document.querySelector("#reference-features"),
    referenceSource: document.querySelector("#reference-source"),
    referenceSystem: document.querySelector("#reference-system"),
    runAnalysisButton: document.querySelector("#run-analysis-button"),
    analysisStatus: document.querySelector("#analysis-status"),
    generateReportButton: document.querySelector("#generate-report-button"),
    metrics: {
      samples: document.querySelector("#metric-samples"),
      reference: document.querySelector("#metric-reference"),
      variants: document.querySelector("#metric-variants"),
    },
    browserSampleFilter: document.querySelector("#browser-sample-filter"),
    browserVariantFilter: document.querySelector("#browser-variant-filter"),
    browserRegionFilter: document.querySelector("#browser-region-filter"),
    browserKnownFilter: document.querySelector("#browser-known-filter"),
    browserVariantJump: document.querySelector("#browser-variant-jump"),
    browserPrev: document.querySelector("#browser-prev"),
    browserNext: document.querySelector("#browser-next"),
    browserWindowLabel: document.querySelector("#browser-window-label"),
    alignmentBrowser: document.querySelector("#alignment-browser"),
    knownVariantNote: document.querySelector("#known-variant-note"),
    variantSummaryBody: document.querySelector("#variant-summary-body"),
    chromatogramSample: document.querySelector("#chromatogram-sample"),
    chromatogramVariant: document.querySelector("#chromatogram-variant"),
    chromatogramZoom: document.querySelector("#chromatogram-zoom"),
    chromatogramExport: document.querySelector("#chromatogram-export"),
    chromatogramCanvas: document.querySelector("#chromatogram-canvas"),
    chromatogramNote: document.querySelector("#chromatogram-note"),
    annotationBody: document.querySelector("#annotation-body"),
    publicationStatus: document.querySelector("#publication-status"),
    publicationTabs: Array.from(document.querySelectorAll("[data-publication-tab]")),
    publicationShell: document.querySelector("#publication-table-shell"),
    copyPublicationTable: document.querySelector("#copy-publication-table"),
    copyAllPublicationTables: document.querySelector("#copy-all-publication-tables"),
    downloadPublicationCsv: document.querySelector("#download-publication-csv"),
    copyReportButton: document.querySelector("#copy-report-button"),
    reportFields: {
      methods: document.querySelector("#report-methods"),
      results: document.querySelector("#report-results"),
      interpretation: document.querySelector("#report-interpretation"),
      figureLegend: document.querySelector("#report-figure-legend"),
      evidence: document.querySelector("#report-evidence"),
      limitations: document.querySelector("#report-limitations"),
    },
  };

  const displayLabels = {
    qc: "Sample QC table",
    alignment: "Alignment summary",
    variants: "Variant summary",
    clinical: "ClinVar / dbSNP",
    coding: "Coding effect",
    frequency: "Variant frequency",
  };

  const knownSpeciesMap = {
    human: "homo_sapiens",
    "homo sapiens": "homo_sapiens",
    mouse: "mus_musculus",
    "mus musculus": "mus_musculus",
    rat: "rattus_norvegicus",
    "rattus norvegicus": "rattus_norvegicus",
    zebrafish: "danio_rerio",
    "danio rerio": "danio_rerio",
    chicken: "gallus_gallus",
    "gallus gallus": "gallus_gallus",
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function setStatus(element, message, tone) {
    if (!element) {
      return;
    }
    element.textContent = message;
    element.classList.remove("is-success", "is-warning", "is-error");
    if (tone) {
      element.classList.add(`is-${tone}`);
    }
  }

  function formatNumber(value, decimals) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    if (!Number.isFinite(Number(value))) {
      return "—";
    }
    const numeric = Number(value);
    if (typeof decimals === "number") {
      return numeric.toFixed(decimals);
    }
    return numeric.toLocaleString();
  }

  function slugify(value) {
    return String(value || "wahj")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function copyHtmlAndText(html, text) {
    if (!navigator.clipboard) {
      throw new Error("Clipboard access is not available in this browser.");
    }

    if (window.ClipboardItem) {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return;
    }

    await navigator.clipboard.writeText(text);
  }

  function downloadBlob(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function fetchText(url) {
    const response = await fetch(url, {
      headers: {
        Accept: "text/plain, text/x-fasta, application/json;q=0.8, */*;q=0.5",
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.text();
  }

  async function fetchSequenceText(url) {
    const response = await fetch(url, {
      headers: {
        Accept: "text/plain, text/x-fasta, application/json;q=0.9",
        "Content-Type": "text/plain",
      },
    });
    if (!response.ok) {
      throw new Error(`Reference sequence request failed: ${response.status}`);
    }
    const body = await response.text();
    return core.extractSequenceResponse(body, response.headers.get("content-type"));
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  }

  function normalizeSpeciesName(input) {
    const cleaned = String(input || "")
      .trim()
      .toLowerCase();
    if (!cleaned) {
      return "";
    }
    return knownSpeciesMap[cleaned] || cleaned.replace(/[^a-z0-9]+/g, "_");
  }

  function stripVersion(identifier) {
    return String(identifier || "").split(".")[0];
  }

  function pickCanonicalTranscript(geneRecord) {
    if (geneRecord?.canonical_transcript) {
      return stripVersion(geneRecord.canonical_transcript);
    }

    const transcripts = Array.isArray(geneRecord?.Transcript) ? geneRecord.Transcript : [];
    const proteinCoding = transcripts.find(
      (transcript) => transcript.biotype === "protein_coding"
    );
    return stripVersion(proteinCoding?.id || transcripts[0]?.id || "");
  }

  function genomicToCdnaPosition(transcriptExons, genomicPosition, strand) {
    const numericPosition = Number(genomicPosition);
    if (!Number.isFinite(numericPosition)) {
      return null;
    }

    const matchingExon = transcriptExons.find(
      (exon) => numericPosition >= exon.genomicStart && numericPosition <= exon.genomicEnd
    );
    if (!matchingExon) {
      return null;
    }

    if (strand >= 0) {
      return matchingExon.cdnaStart + (numericPosition - matchingExon.genomicStart);
    }

    return matchingExon.cdnaStart + (matchingExon.genomicEnd - numericPosition);
  }

  function buildEnsemblTranscriptReference(geneRecord, transcriptRecord, cdnaSequence, organismInput) {
    const strand = Number(transcriptRecord?.strand || 1) >= 0 ? 1 : -1;
    const exonList = Array.isArray(transcriptRecord?.Exon) ? transcriptRecord.Exon.slice() : [];
    const orderedExons = exonList.sort((left, right) => {
      if (strand >= 0) {
        return left.start - right.start;
      }
      return right.end - left.end;
    });

    let cursor = 1;
    const transcriptExons = orderedExons.map((exon, index) => {
      const length = Number(exon.end) - Number(exon.start) + 1;
      const mapped = {
        rank: index + 1,
        genomicStart: Number(exon.start),
        genomicEnd: Number(exon.end),
        cdnaStart: cursor,
        cdnaEnd: cursor + length - 1,
        strand,
      };
      cursor += length;
      return mapped;
    });

    const features = transcriptExons.map((exon) => ({
      type: "exon",
      label: `Exon ${exon.rank}`,
      start: exon.cdnaStart,
      end: exon.cdnaEnd,
      strand: 1,
      metadata: {
        genomicStart: exon.genomicStart,
        genomicEnd: exon.genomicEnd,
      },
    }));

    const translation = transcriptRecord?.Translation || null;
    const cdsParts = [];
    if (translation) {
      const cdsStart = genomicToCdnaPosition(transcriptExons, translation.start, strand);
      const cdsEnd = genomicToCdnaPosition(transcriptExons, translation.end, strand);
      if (cdsStart && cdsEnd) {
        const normalizedStart = Math.min(cdsStart, cdsEnd);
        const normalizedEnd = Math.max(cdsStart, cdsEnd);
        cdsParts.push({
          start: normalizedStart,
          end: normalizedEnd,
          strand: 1,
        });
        features.push({
          type: "cds",
          label: "Coding sequence",
          start: normalizedStart,
          end: normalizedEnd,
          strand: 1,
          metadata: {
            proteinId: translation.id || "",
          },
        });

        if (normalizedStart > 1) {
          features.push({
            type: "utr",
            label: "5' UTR",
            start: 1,
            end: normalizedStart - 1,
            strand: 1,
            metadata: {},
          });
        }
        if (normalizedEnd < cdnaSequence.length) {
          features.push({
            type: "utr",
            label: "3' UTR",
            start: normalizedEnd + 1,
            end: cdnaSequence.length,
            strand: 1,
            metadata: {},
          });
        }
      }
    }

    return {
      sequence: core.normalizeSequence(cdnaSequence),
      label: `${geneRecord.display_name || transcriptRecord.display_name || "Reference"} (${stripVersion(
        transcriptRecord.id
      )})`,
      accession: stripVersion(transcriptRecord.id),
      sourceLabel: geneRecord.description || transcriptRecord.display_name || "Ensembl transcript reference",
      annotationSource: "Ensembl canonical transcript",
      geneName: geneRecord.display_name || transcriptRecord.display_name || "—",
      organism: organismInput || geneRecord.species || "—",
      features,
      cdsParts,
      transcriptId: stripVersion(transcriptRecord.id),
      transcriptExons,
      strand: 1,
      sourceKind: "ensembl-transcript",
      sequenceKind: "cdna",
      links: {
        ensemblGene: `https://www.ensembl.org/${
          (geneRecord.species || "homo_sapiens").replace(/(^|_)([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
        }/Gene/Summary?g=${stripVersion(geneRecord.id)}`,
      },
    };
  }

  function genomicToReferencePosition(coordinateSystem, genomicPosition) {
    const position = Number(genomicPosition);
    if (
      !Number.isFinite(position) ||
      !Number.isFinite(Number(coordinateSystem?.regionStart)) ||
      !Number.isFinite(Number(coordinateSystem?.regionEnd))
    ) {
      return null;
    }

    return Number(coordinateSystem.strand || 1) >= 0
      ? position - Number(coordinateSystem.regionStart) + 1
      : Number(coordinateSystem.regionEnd) - position + 1;
  }

  function buildEnsemblGenomicReference(
    geneRecord,
    transcriptRecord,
    genomicSequence,
    organismInput,
    flankSize
  ) {
    const flank = Math.max(0, Number(flankSize || 0));
    const geneStart = Number(geneRecord.start);
    const geneEnd = Number(geneRecord.end);
    const strand = Number(geneRecord.strand || 1) >= 0 ? 1 : -1;
    const coordinateSystem = {
      type: "genomic",
      assembly: geneRecord.assembly_name || transcriptRecord.assembly_name || "—",
      chromosome: geneRecord.seq_region_name || transcriptRecord.seq_region_name || "—",
      regionStart: Math.max(1, geneStart - flank),
      regionEnd: geneEnd + flank,
      strand,
      flank,
    };
    const toLocalRange = (start, end) => {
      const first = genomicToReferencePosition(coordinateSystem, start);
      const second = genomicToReferencePosition(coordinateSystem, end);
      return {
        start: Math.min(first, second),
        end: Math.max(first, second),
      };
    };
    const features = [];
    const cdsParts = [];
    const geneRange = toLocalRange(geneStart, geneEnd);
    features.push({
      type: "gene",
      label: geneRecord.display_name || "Gene locus",
      start: geneRange.start,
      end: geneRange.end,
      strand: 1,
      metadata: {
        genomicStart: geneStart,
        genomicEnd: geneEnd,
      },
    });

    const exonList = Array.isArray(transcriptRecord?.Exon)
      ? transcriptRecord.Exon.slice()
      : [];
    exonList.sort((left, right) =>
      strand >= 0 ? left.start - right.start : right.end - left.end
    );
    const translation = transcriptRecord?.Translation || null;
    const codingStart = translation ? Math.min(translation.start, translation.end) : null;
    const codingEnd = translation ? Math.max(translation.start, translation.end) : null;
    const transcriptExons = [];

    exonList.forEach((exon, index) => {
      const exonRange = toLocalRange(exon.start, exon.end);
      transcriptExons.push({
        rank: index + 1,
        genomicStart: Number(exon.start),
        genomicEnd: Number(exon.end),
        cdnaStart: exonRange.start,
        cdnaEnd: exonRange.end,
        strand,
      });
      features.push({
        type: "exon",
        label: `Canonical transcript exon ${index + 1}`,
        start: exonRange.start,
        end: exonRange.end,
        strand: 1,
        metadata: {
          exonId: exon.id || "",
          genomicStart: Number(exon.start),
          genomicEnd: Number(exon.end),
        },
      });

      if (!Number.isFinite(codingStart) || !Number.isFinite(codingEnd)) {
        return;
      }
      const overlapStart = Math.max(Number(exon.start), codingStart);
      const overlapEnd = Math.min(Number(exon.end), codingEnd);
      if (overlapStart <= overlapEnd) {
        const cdsRange = toLocalRange(overlapStart, overlapEnd);
        const cdsPart = {
          start: cdsRange.start,
          end: cdsRange.end,
          strand: 1,
        };
        cdsParts.push(cdsPart);
        features.push({
          type: "cds",
          label: `Coding sequence, exon ${index + 1}`,
          ...cdsPart,
          metadata: {
            proteinId: translation.id || "",
            genomicStart: overlapStart,
            genomicEnd: overlapEnd,
          },
        });
      }
    });

    for (let index = 0; index < transcriptExons.length - 1; index += 1) {
      const intronStart = transcriptExons[index].cdnaEnd + 1;
      const intronEnd = transcriptExons[index + 1].cdnaStart - 1;
      if (intronStart <= intronEnd) {
        features.push({
          type: "intron",
          label: `Canonical transcript intron ${index + 1}`,
          start: intronStart,
          end: intronEnd,
          strand: 1,
          metadata: {},
        });
      }
    }

    return {
      sequence: core.normalizeSequence(genomicSequence),
      label: `${geneRecord.display_name || "Gene"} genomic locus (${
        coordinateSystem.assembly
      } chr${coordinateSystem.chromosome})`,
      accession: stripVersion(geneRecord.id),
      sourceLabel: geneRecord.description || "Ensembl genomic gene locus",
      annotationSource: `Ensembl genomic locus with ${flank} bp flanks`,
      geneName: geneRecord.display_name || transcriptRecord.display_name || "—",
      organism: organismInput || geneRecord.species || "—",
      features,
      cdsParts,
      geneId: stripVersion(geneRecord.id),
      transcriptId: stripVersion(transcriptRecord.id),
      transcriptExons,
      strand: 1,
      coordinateSystem,
      sourceKind: "ensembl-genomic",
      sequenceKind: "genomic-dna",
      links: {
        ensemblGene: `https://www.ensembl.org/${
          (geneRecord.species || "homo_sapiens").replace(
            /(^|_)([a-z])/g,
            (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`
          )
        }/Gene/Summary?g=${stripVersion(geneRecord.id)}`,
      },
    };
  }

  function convertGenbankFeatures(parsedSequence) {
    const features = Array.isArray(parsedSequence?.features) ? parsedSequence.features : [];
    return features.map((feature) => ({
      type: String(feature.type || "").toLowerCase(),
      label: feature.name || feature.type || "Feature",
      start: Number(feature.start) + 1,
      end: Number(feature.end) + 1,
      strand: Number(feature.strand || 1) >= 0 ? 1 : -1,
      metadata: feature.notes || {},
    }));
  }

  function extractGeneNameFromReference(features, fallbackTitle) {
    const geneFeature = features.find((feature) => feature.type === "gene");
    if (geneFeature?.label) {
      return geneFeature.label;
    }

    const cdsFeature = features.find((feature) => feature.type === "cds");
    if (cdsFeature?.label) {
      return cdsFeature.label;
    }

    const match = String(fallbackTitle || "").match(/\b([A-Z0-9]{2,})\b/);
    return match ? match[1] : "—";
  }

  function extractOrganismFromReference(features, fallbackTitle) {
    const sourceFeature = features.find((feature) => feature.type === "source");
    if (sourceFeature?.metadata?.organism?.[0]) {
      return sourceFeature.metadata.organism[0];
    }
    if (sourceFeature?.label) {
      return sourceFeature.label;
    }
    return fallbackTitle || "—";
  }

  function buildGenbankReference(parsedSequence, accessionInput) {
    const sequence = core.normalizeSequence(parsedSequence?.sequence);
    const features = convertGenbankFeatures(parsedSequence);
    const cdsParts = features
      .filter((feature) => feature.type === "cds")
      .map((feature) => ({
        start: feature.start,
        end: feature.end,
        strand: feature.strand,
      }));

    return {
      sequence,
      label: parsedSequence?.definition || accessionInput,
      accession: parsedSequence?.accession || accessionInput,
      sourceLabel: parsedSequence?.definition || parsedSequence?.description || accessionInput,
      annotationSource: "NCBI GenBank",
      geneName: extractGeneNameFromReference(features, parsedSequence?.definition),
      organism: extractOrganismFromReference(features, parsedSequence?.definition),
      features,
      cdsParts,
      sourceKind: "accession",
      sequenceKind: parsedSequence?.type || "genbank",
    };
  }

  function buildFastaReference(text) {
    let sequence = "";
    let label = "Manual FASTA reference";

    try {
      const parsed = bioParsers.fastaToJson(text);
      const first = parsed?.[0]?.parsedSequence;
      if (first?.sequence) {
        sequence = core.normalizeSequence(first.sequence);
        label = first.name || label;
      }
    } catch (error) {
      const lines = String(text || "")
        .trim()
        .split(/\r?\n/);
      if (lines[0]?.startsWith(">")) {
        label = lines[0].slice(1).trim() || label;
        lines.shift();
      }
      sequence = core.normalizeSequence(lines.join(""));
    }

    if (!sequence) {
      throw new Error("The FASTA reference could not be parsed.");
    }

    return {
      sequence,
      label,
      accession: label,
      sourceLabel: label,
      annotationSource: "Manual FASTA",
      geneName: "—",
      organism: "—",
      features: [],
      cdsParts: [],
      sourceKind: "fasta",
      sequenceKind: "manual-fasta",
    };
  }

  async function loadReferenceFromGene() {
    const geneSymbol = String(elements.geneSymbol?.value || "").trim();
    const organism = String(elements.organism?.value || "").trim();
    const species = normalizeSpeciesName(organism);

    if (!geneSymbol || !species) {
      throw new Error("Enter both a gene symbol and an organism name.");
    }

    const geneLookupUrl = `https://rest.ensembl.org/lookup/symbol/${encodeURIComponent(
      species
    )}/${encodeURIComponent(geneSymbol)}?expand=1;content-type=application/json`;
    const geneRecord = await fetchJson(geneLookupUrl);
    const transcriptId = pickCanonicalTranscript(geneRecord);
    if (!transcriptId) {
      throw new Error("No canonical transcript could be identified for this gene.");
    }

    const transcriptLookupUrl = `https://rest.ensembl.org/lookup/id/${encodeURIComponent(
      transcriptId
    )}?expand=1;content-type=application/json`;
    const transcriptRecord = await fetchJson(transcriptLookupUrl);
    const requestedSequenceType = elements.sequenceType?.value || "genomic";
    if (requestedSequenceType === "cdna") {
      const cdnaSequence = await fetchSequenceText(
        `https://rest.ensembl.org/sequence/id/${encodeURIComponent(
          transcriptId
        )}?type=cdna;content-type=text/plain`
      );
      return buildEnsemblTranscriptReference(
        geneRecord,
        transcriptRecord,
        cdnaSequence,
        organism
      );
    }

    const flankSize = 500;
    const genomicSequence = await fetchSequenceText(
      `https://rest.ensembl.org/sequence/id/${encodeURIComponent(
        stripVersion(geneRecord.id)
      )}?type=genomic;expand_5prime=${flankSize};expand_3prime=${flankSize};content-type=text/plain`
    );
    return buildEnsemblGenomicReference(
      geneRecord,
      transcriptRecord,
      genomicSequence,
      organism,
      flankSize
    );
  }

  async function loadReferenceFromAccession() {
    const accession = String(elements.accession?.value || "").trim();
    if (!accession) {
      throw new Error("Enter an accession number.");
    }

    try {
      const genbankText = await fetchText(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nucleotide&id=${encodeURIComponent(
          accession
        )}&rettype=gb&retmode=text`
      );
      const parsed = bioParsers.genbankToJson(genbankText);
      const first = parsed?.[0]?.parsedSequence;
      if (first?.sequence) {
        return buildGenbankReference(first, accession);
      }
    } catch (error) {
      console.warn("GenBank lookup failed, falling back to FASTA only.", error);
    }

    const fastaText = await fetchText(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nucleotide&id=${encodeURIComponent(
        accession
      )}&rettype=fasta&retmode=text`
    );
    const reference = buildFastaReference(fastaText);
    reference.accession = accession;
    reference.annotationSource = "NCBI FASTA (feature annotation unavailable)";
    reference.sourceKind = "accession-fasta";
    return reference;
  }

  async function loadReferenceFromFasta() {
    const text = String(elements.fasta?.value || "");
    if (!text.trim()) {
      throw new Error("Paste a FASTA reference before loading it.");
    }
    return buildFastaReference(text);
  }

  function renderSampleQcTable() {
    if (!elements.sampleQcBody) {
      return;
    }

    if (!state.samples.length) {
      elements.sampleQcBody.innerHTML =
        '<tr><td colspan="5">Load one or more AB1 files to inspect the read quality.</td></tr>';
      return;
    }

    elements.sampleQcBody.innerHTML = state.samples
      .map(
        (sample) => `
          <tr>
            <td>${escapeHtml(sample.sampleName)}</td>
            <td>${formatNumber(sample.rawLength)}</td>
            <td>${formatNumber(sample.trimmedLength)}</td>
            <td>${formatNumber(sample.meanQuality, 2)}</td>
            <td>${escapeHtml(sample.status.toUpperCase())}</td>
          </tr>
        `
      )
      .join("");
  }

  function renderReferenceSummary() {
    const reference = state.reference;
    elements.referenceLabel.textContent = reference ? reference.label : "—";
    elements.referenceLength.textContent = reference ? formatNumber(reference.sequence.length) : "—";
    elements.referenceFeatures.textContent = reference
      ? `${reference.features.length || 0} feature(s)`
      : "—";
    elements.referenceSource.textContent = reference ? reference.annotationSource : "—";
    if (elements.referenceSystem) {
      elements.referenceSystem.textContent = reference?.coordinateSystem
        ? `${reference.coordinateSystem.assembly} chr${reference.coordinateSystem.chromosome}:${reference.coordinateSystem.regionStart}-${reference.coordinateSystem.regionEnd} (${reference.coordinateSystem.strand >= 0 ? "+" : "−"} strand)`
        : reference
          ? reference.sequenceKind || "Sequence coordinates"
          : "—";
    }
    elements.metrics.reference.textContent = reference ? "Yes" : "No";
  }

  function updateMetrics() {
    elements.metrics.samples.textContent = formatNumber(state.samples.length);
    elements.metrics.reference.textContent = state.reference ? "Yes" : "No";
    const totalVariants = state.results.reduce(
      (sum, result) => sum + (Array.isArray(result.variants) ? result.variants.length : 0),
      0
    );
    elements.metrics.variants.textContent = formatNumber(totalVariants);
  }

  function buildKnownVariantLinks(reference, variant) {
    const links = [];
    const rsId = variant.rsId || "";
    const geneName = reference?.geneName || "";
    const organism = reference?.organism || "";
    if (rsId) {
      links.push({
        label: "dbSNP",
        href: `https://www.ncbi.nlm.nih.gov/snp/${encodeURIComponent(rsId)}`,
      });
      links.push({
        label: "ClinVar",
        href: `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(rsId)}`,
      });
      links.push({
        label: "Ensembl",
        href: `https://www.ensembl.org/Multi/Search/Results?q=${encodeURIComponent(rsId)}`,
      });
      links.push({
        label: "PubMed",
        href: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(
          [geneName, rsId].filter(Boolean).join(" ")
        )}`,
      });
    }

    if (geneName && geneName !== "—") {
      links.push({
        label: "UniProt",
        href: `https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(geneName)}`,
      });
      links.push({
        label: "KEGG",
        href: `https://www.genome.jp/dbget-bin/www_bfind_sub?mode=bfind&dbkey=genes&keywords=${encodeURIComponent(
          `${geneName} ${organism}`
        )}`,
      });
      links.push({
        label: "STRING",
        href: `https://string-db.org/cgi/network?identifiers=${encodeURIComponent(geneName)}`,
      });
    }

    return links;
  }

  function mapKnownVariationsToCdna(variations, reference) {
    const mapped = new Map();
    const strand = Array.isArray(reference.transcriptExons) && reference.transcriptExons[0]?.strand
      ? reference.transcriptExons[0].strand
      : 1;

    variations.forEach((variation) => {
      const position = genomicToCdnaPosition(
        reference.transcriptExons || [],
        variation.start,
        strand
      );
      if (!position) {
        return;
      }

      const entry = {
        position,
        id: variation.id || "",
        source: variation.source || "",
        clinicalSignificance: Array.isArray(variation.clinical_significance)
          ? variation.clinical_significance.join("; ")
          : "—",
        consequence: Array.isArray(variation.consequence_type)
          ? variation.consequence_type.join("; ")
          : "—",
        alleles: Array.isArray(variation.alleles) ? variation.alleles : [],
      };

      const current = mapped.get(position) || [];
      current.push(entry);
      mapped.set(position, current);
    });

    return mapped;
  }

  function mapKnownVariationsToGenomicReference(variations, reference) {
    const mapped = new Map();
    const coordinateSystem = reference?.coordinateSystem;
    const reverseReference = Number(coordinateSystem?.strand || 1) < 0;

    variations.forEach((variation) => {
      const position = genomicToReferencePosition(coordinateSystem, variation.start);
      if (!position || position < 1 || position > reference.sequence.length) {
        return;
      }
      const alleles = Array.isArray(variation.alleles)
        ? variation.alleles.map((allele) => {
            const normalized = String(allele || "").toUpperCase();
            return reverseReference && /^[ACGT]+$/u.test(normalized)
              ? core.reverseComplement(normalized)
              : normalized;
          })
        : [];
      const entry = {
        position,
        genomicPosition: Number(variation.start),
        id: variation.id || "",
        source: variation.source || "",
        clinicalSignificance: Array.isArray(variation.clinical_significance)
          ? variation.clinical_significance.join("; ")
          : "—",
        consequence: Array.isArray(variation.consequence_type)
          ? variation.consequence_type.join("; ")
          : "—",
        alleles,
      };
      const current = mapped.get(position) || [];
      current.push(entry);
      mapped.set(position, current);
    });

    return mapped;
  }

  function chooseKnownMatch(variant, knownEntries) {
    if (!Array.isArray(knownEntries) || !knownEntries.length) {
      return null;
    }

    const queryBase = String(variant.queryBase || "");
    const referenceBase = String(variant.referenceBase || "");
    const preferred = knownEntries.find((entry) => {
      const joined = entry.alleles.join("/");
      return joined.includes(queryBase) && joined.includes(referenceBase);
    });

    return preferred || knownEntries[0];
  }

  async function enrichAnnotations() {
    state.knownVariantsByPosition = new Map();

    const transcriptReference =
      state.reference?.sourceKind === "ensembl-transcript" && state.reference?.transcriptId;
    const genomicReference =
      state.reference?.sourceKind === "ensembl-genomic" && state.reference?.coordinateSystem;
    if (!transcriptReference && !genomicReference) {
      state.results = state.results.map((result) => ({
        ...result,
        variants: result.variants.map((variant) => ({
          ...variant,
          isKnown: false,
          rsId: "",
          clinicalSignificance: "—",
          consequenceSummary: "—",
          externalLinks: buildKnownVariantLinks(state.reference, variant),
        })),
      }));
      return;
    }

    try {
      const coordinateSystem = state.reference.coordinateSystem;
      const species = normalizeSpeciesName(state.reference.organism);
      const variationUrl = genomicReference
        ? `https://rest.ensembl.org/overlap/region/${encodeURIComponent(
            species
          )}/${encodeURIComponent(
            `${coordinateSystem.chromosome}:${coordinateSystem.regionStart}-${coordinateSystem.regionEnd}`
          )}?feature=variation;content-type=application/json`
        : `https://rest.ensembl.org/overlap/id/${encodeURIComponent(
            state.reference.transcriptId
          )}?feature=variation;content-type=application/json`;
      const variations = await fetchJson(variationUrl);
      const mapped = genomicReference
        ? mapKnownVariationsToGenomicReference(variations, state.reference)
        : mapKnownVariationsToCdna(variations, state.reference);
      state.knownVariantsByPosition = mapped;
      state.results = state.results.map((result) => ({
        ...result,
        variants: result.variants.map((variant) => {
          const match = chooseKnownMatch(
            variant,
            mapped.get(Number(variant.referencePosition)) || []
          );
          const rsId = match?.id || "";
          return {
            ...variant,
            isKnown: Boolean(match),
            rsId,
            clinicalSignificance: match?.clinicalSignificance || "—",
            consequenceSummary: match?.consequence || "—",
            externalLinks: buildKnownVariantLinks(state.reference, {
              ...variant,
              rsId,
            }),
          };
        }),
      }));

      setStatus(
        elements.knownVariantNote,
        genomicReference
          ? "Known-variant markers were loaded from Ensembl/dbSNP records across the selected genomic locus."
          : "Known-variant markers were loaded from Ensembl/dbSNP overlap records for the selected transcript.",
        "success"
      );
    } catch (error) {
      console.error(error);
      state.results = state.results.map((result) => ({
        ...result,
        variants: result.variants.map((variant) => ({
          ...variant,
          isKnown: false,
          rsId: "",
          clinicalSignificance: "Lookup unavailable",
          consequenceSummary: "Lookup unavailable",
          externalLinks: buildKnownVariantLinks(state.reference, variant),
        })),
      }));
      setStatus(
        elements.knownVariantNote,
        "Known-variant lookup could not be completed for this reference. Core alignment and candidate-variant calling still ran successfully.",
        "warning"
      );
    }
  }

  function prepareResultMaps(result) {
    const positionMap = new Map();
    const insertionMap = new Map();

    result.columns.forEach((column) => {
      if (Number.isFinite(column.referencePosition)) {
        positionMap.set(column.referencePosition, {
          referenceBase: column.referenceBase,
          queryBase: column.queryBase,
          quality: column.quality,
        });
      }

      if (column.referenceBase === "-" && column.queryBase !== "-") {
        const anchor = Number(column.previousReferencePosition || 0);
        const existing = insertionMap.get(anchor) || [];
        existing.push(column.queryBase);
        insertionMap.set(anchor, existing);
      }
    });

    return Object.assign({}, result, {
      positionMap,
      insertionMap,
    });
  }

  function flattenVariants() {
    return state.results
      .flatMap((result) => result.variants || [])
      .sort((left, right) => {
        const leftPosition = Number(left.referencePosition || 0);
        const rightPosition = Number(right.referencePosition || 0);
        if (left.sampleName !== right.sampleName) {
          return left.sampleName.localeCompare(right.sampleName);
        }
        return leftPosition - rightPosition;
      });
  }

  function renderVariantSummaryTable() {
    const variants = flattenVariants();
    if (!variants.length) {
      const withheld = state.results.filter((result) => result.candidateCallingWithheld);
      const message = withheld.length
        ? `Candidate calling was withheld for ${withheld.length} sample(s) because the selected reference did not pass alignment QC.`
        : state.results.length
          ? "No candidate nucleotide differences were detected in the reliable aligned region."
          : "Run the analysis to detect candidate variants.";
      elements.variantSummaryBody.innerHTML =
        `<tr><td colspan="8">${escapeHtml(message)}</td></tr>`;
      return;
    }

    elements.variantSummaryBody.innerHTML = variants
      .map(
        (variant) => {
          const result = getResultForSample(variant.sampleName);
          const rawIndex = result ? getRawIndexForVariant(result, variant) : null;
          const traceBase = Number.isFinite(rawIndex) ? rawIndex + 1 : "—";
          return `
          <tr>
            <td>${escapeHtml(variant.sampleName)}</td>
            <td>${escapeHtml(variant.referencePositionLabel)}</td>
            <td>${escapeHtml(traceBase)}</td>
            <td>${escapeHtml(`${variant.referenceBase} / ${variant.queryBase}`)}</td>
            <td>${escapeHtml(variant.label)}</td>
            <td>${formatNumber(variant.quality, 2)}</td>
            <td>${escapeHtml(variant.status)}</td>
            <td>${escapeHtml(variant.context)}</td>
          </tr>
        `;
        }
      )
      .join("");
  }

  function renderAnnotationTable() {
    const variants = flattenVariants();
    if (!variants.length) {
      const withheld = state.results.some((result) => result.candidateCallingWithheld);
      elements.annotationBody.innerHTML =
        `<tr><td colspan="8">${escapeHtml(
          withheld
            ? "Annotation was not attempted because candidate calling was withheld by alignment QC."
            : state.results.length
              ? "No candidate variants are available for annotation."
              : "Run the analysis to populate candidate variant annotations."
        )}</td></tr>`;
      return;
    }

    elements.annotationBody.innerHTML = variants
      .map((variant) => {
        const dbLabel = variant.rsId
          ? `${variant.rsId}${variant.clinicalSignificance && variant.clinicalSignificance !== "—" ? ` (${variant.clinicalSignificance})` : ""}`
          : "Novel / not linked";

        const linksMarkup = (variant.externalLinks || [])
          .map(
            (link) =>
              `<a href="${escapeHtml(link.href)}" target="_blank" rel="noreferrer">${escapeHtml(
                link.label
              )}</a>`
          )
          .join(" · ");

        return `
          <tr>
            <td>${escapeHtml(variant.sampleName)}</td>
            <td>${escapeHtml(variant.geneName || state.reference?.geneName || "—")}</td>
            <td>${escapeHtml(variant.regionLabel || "Annotation unavailable")}</td>
            <td>${escapeHtml(variant.codingEffect || "—")}</td>
            <td>${escapeHtml(variant.codonChange || "—")}</td>
            <td>${escapeHtml(variant.aminoAcidChange || "—")}</td>
            <td>${escapeHtml(dbLabel)}</td>
            <td>${linksMarkup || "—"}</td>
          </tr>
        `;
      })
      .join("");
  }

  function populateBrowserSelectors() {
    const sampleOptions = [
      '<option value="all">All samples</option>',
      ...state.results.map(
        (result) =>
          `<option value="${escapeHtml(result.sampleName)}">${escapeHtml(result.sampleName)}</option>`
      ),
    ];
    elements.browserSampleFilter.innerHTML = sampleOptions.join("");

    const variantOptions = [
      '<option value="">Choose a variant</option>',
      ...flattenVariants().map(
        (variant) =>
          `<option value="${escapeHtml(variant.id)}">${escapeHtml(
            `${variant.sampleName} | ${variant.referencePositionLabel} | ${variant.referenceBase}>${variant.queryBase}`
          )}</option>`
      ),
    ];
    elements.browserVariantJump.innerHTML = variantOptions.join("");
  }

  function populateChromatogramSelectors() {
    const sampleOptions = [
      '<option value="">Select a sample</option>',
      ...state.results.map(
        (result) =>
          `<option value="${escapeHtml(result.sampleName)}">${escapeHtml(result.sampleName)}</option>`
      ),
    ];
    elements.chromatogramSample.innerHTML = sampleOptions.join("");
    elements.chromatogramVariant.innerHTML =
      '<option value="">Select a candidate variant</option>';
  }

  function getFilteredVariants() {
    const sampleFilter = elements.browserSampleFilter.value;
    const typeFilter = elements.browserVariantFilter.value;
    const regionFilter = elements.browserRegionFilter.value;
    const knownFilter = elements.browserKnownFilter.value;

    return flattenVariants().filter((variant) => {
      if (sampleFilter !== "all" && variant.sampleName !== sampleFilter) {
        return false;
      }
      if (typeFilter !== "all" && variant.type !== typeFilter) {
        return false;
      }
      if (regionFilter === "coding" && variant.codingStatus !== "Coding") {
        return false;
      }
      if (regionFilter === "noncoding" && variant.codingStatus === "Coding") {
        return false;
      }
      if (knownFilter === "known" && !variant.isKnown) {
        return false;
      }
      if (knownFilter === "novel" && variant.isKnown) {
        return false;
      }
      return true;
    });
  }

  function clampBrowserWindow(startPosition) {
    const maxStart = Math.max(1, state.reference.sequence.length - state.browserWindowSize + 1);
    state.browserWindowStart = Math.min(Math.max(1, startPosition), maxStart);
  }

  function getBrowserWindowRange() {
    const start = state.browserWindowStart;
    const end = Math.min(state.reference.sequence.length, start + state.browserWindowSize - 1);
    return { start, end };
  }

  function renderReferenceTrack(windowStart, windowEnd) {
    const bases = [];
    for (let position = windowStart; position <= windowEnd; position += 1) {
      bases.push(
        `<span class="browser-base is-match">${escapeHtml(
          state.reference.sequence[position - 1] || " "
        )}</span>`
      );
    }
    return bases.join("");
  }

  function renderFeatureTrack(windowStart, windowEnd) {
    const parts = [];
    const features = Array.isArray(state.reference.features) ? state.reference.features : [];
    for (let position = windowStart; position <= windowEnd; position += 1) {
      const feature = features.find((item) => position >= item.start && position <= item.end);
      let className = "browser-feature";
      if (feature?.type === "exon") {
        className += " is-exon";
      } else if (feature?.type === "cds") {
        className += " is-cds";
      } else if (feature?.type === "utr") {
        className += " is-utr";
      }
      parts.push(
        `<span class="${className}" title="${escapeHtml(feature?.label || "No feature")}"></span>`
      );
    }
    return parts.join("");
  }

  function renderKnownVariantTrack(windowStart, windowEnd) {
    const parts = [];
    for (let position = windowStart; position <= windowEnd; position += 1) {
      const known = state.knownVariantsByPosition.get(position);
      parts.push(
        `<span class="browser-variant-marker" title="${escapeHtml(
          known?.[0]?.id ? `${known[0].id} ${known[0].clinicalSignificance || ""}` : "No known variant"
        )}" style="opacity:${known ? "1" : "0.08"}"></span>`
      );
    }
    return parts.join("");
  }

  function getVisibleBrowserRows() {
    const sampleFilter = elements.browserSampleFilter.value;
    if (sampleFilter === "all") {
      return state.results;
    }
    return state.results.filter((result) => result.sampleName === sampleFilter);
  }

  function renderSampleTrack(result, filteredVariantIds, windowStart, windowEnd) {
    const cells = [];
    for (let position = windowStart; position <= windowEnd; position += 1) {
      const refBase = state.reference.sequence[position - 1] || " ";
      const event = result.positionMap.get(position);
      const insertion = result.insertionMap.get(position);
      let character = " ";
      let className = "browser-base";
      let title = `${position}`;

      if (event) {
        if (event.queryBase === refBase) {
          character = "·";
          className += " is-match";
        } else if (event.queryBase === "-") {
          character = "-";
          className += " is-deletion";
        } else if (/[RYSWKMBDHVN]/u.test(event.queryBase)) {
          character = event.queryBase;
          className += " is-ambiguous";
        } else {
          character = event.queryBase;
          className += " is-mismatch";
        }
      } else if (insertion?.length) {
        character = "+";
        className += " is-insertion";
      } else {
        className += " is-match";
      }

      const variant = result.variants.find((candidate) => {
        if (candidate.referencePosition === position && filteredVariantIds.has(candidate.id)) {
          return true;
        }
        if (
          candidate.type === "insertion" &&
          Number(candidate.previousReferencePosition || 0) === position &&
          filteredVariantIds.has(candidate.id)
        ) {
          return true;
        }
        return false;
      });

      if (variant) {
        title = `${position} | ${variant.referenceBase}/${variant.queryBase} | ${variant.label}`;
        if (variant.type === "heterozygous-candidate") {
          className = "browser-base is-ambiguous";
        } else if (variant.type === "insertion") {
          className = "browser-base is-insertion";
        } else if (variant.type === "deletion") {
          className = "browser-base is-deletion";
        } else if (variant.type === "ambiguous") {
          className = "browser-base is-ambiguous";
        } else {
          className = "browser-base is-mismatch";
        }
      }

      cells.push(
        `<span class="${className}" title="${escapeHtml(title)}">${escapeHtml(character)}</span>`
      );
    }
    return cells.join("");
  }

  function renderAlignmentBrowser() {
    if (!state.reference || !state.results.length) {
      elements.alignmentBrowser.textContent =
        "Run the analysis to populate the reference and sample alignment browser.";
      elements.browserWindowLabel.textContent = "Window not available yet.";
      return;
    }

    const filteredVariants = getFilteredVariants();
    const filteredVariantIds = new Set(filteredVariants.map((variant) => variant.id));
    const visibleRows = getVisibleBrowserRows();
    const window = getBrowserWindowRange();
    elements.browserWindowLabel.textContent = `Reference positions ${window.start} to ${window.end}`;

    const positionTicks = [];
    for (let position = window.start; position <= window.end; position += 1) {
      positionTicks.push(
        `<span class="browser-base is-match">${position % 10 === 0 ? "|" : "·"}</span>`
      );
    }

    const html = [
      `<div class="browser-line"><div class="browser-label">Position</div><div class="browser-track">${positionTicks.join(
        ""
      )}</div></div>`,
      `<div class="browser-line"><div class="browser-label">Features</div><div class="browser-track">${renderFeatureTrack(
        window.start,
        window.end
      )}</div></div>`,
      `<div class="browser-line"><div class="browser-label">Known SNP / ClinVar</div><div class="browser-track">${renderKnownVariantTrack(
        window.start,
        window.end
      )}</div></div>`,
      `<div class="browser-line"><div class="browser-label">Reference</div><div class="browser-track">${renderReferenceTrack(
        window.start,
        window.end
      )}</div></div>`,
      ...visibleRows.map(
        (result) =>
          `<div class="browser-line"><div class="browser-label">${escapeHtml(
            result.sampleName
          )} <span>${escapeHtml(result.orientation)}</span></div><div class="browser-track">${renderSampleTrack(
            result,
            filteredVariantIds,
            window.start,
            window.end
          )}</div></div>`
      ),
    ].join("");

    elements.alignmentBrowser.innerHTML = html;
  }

  function getResultForSample(sampleName) {
    return state.results.find((result) => result.sampleName === sampleName) || null;
  }

  function handleChromatogramSampleChange() {
    const result = getResultForSample(elements.chromatogramSample.value);
    if (!result) {
      elements.chromatogramVariant.innerHTML =
        '<option value="">Select a candidate variant</option>';
      renderChromatogram();
      return;
    }

    const options = [
      '<option value="">Select a candidate variant</option>',
      ...result.variants.map(
        (variant) => {
          const rawIndex = getRawIndexForVariant(result, variant);
          const traceLabel = Number.isFinite(rawIndex) ? `trace base ${rawIndex + 1}` : "trace base —";
          return (
          `<option value="${escapeHtml(variant.id)}">${escapeHtml(
              `${variant.referencePositionLabel} | ${traceLabel} | ${variant.referenceBase}>${variant.queryBase} | ${variant.label}`
            )}</option>`
          );
        }
      ),
    ];
    elements.chromatogramVariant.innerHTML = options.join("");
    renderChromatogram();
  }

  function getRawIndexForVariant(result, variant) {
    return core.getRawTraceIndexForVariant(result.sample, result.orientation, variant);
  }

  function renderChromatogram() {
    const canvas = elements.chromatogramCanvas;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const result = getResultForSample(elements.chromatogramSample.value);
    const variantId = elements.chromatogramVariant.value;
    const variant = result?.variants.find((entry) => entry.id === variantId) || null;

    if (!result || !variant) {
      context.fillStyle = "#334d67";
      context.font = "22px sans-serif";
      context.fillText(
        "Choose a sample and a candidate variant to inspect the chromatogram.",
        34,
        64
      );
      elements.chromatogramNote.textContent =
        "Choose a sample and a detected candidate variant to view chromatogram evidence.";
      return;
    }

    const rawIndex = getRawIndexForVariant(result, variant);
    const basePositions = result.sample.chromatogram.basePos || [];
    if (!Number.isFinite(rawIndex) || !Number.isFinite(basePositions[rawIndex])) {
      context.fillStyle = "#334d67";
      context.font = "22px sans-serif";
      context.fillText("Chromatogram data could not be positioned for this candidate site.", 34, 64);
      elements.chromatogramNote.textContent =
        "Chromatogram indexing was not available for the selected candidate site.";
      return;
    }

    const zoomBases = Number(elements.chromatogramZoom.value || 18);
    const leftBase = Math.max(0, rawIndex - zoomBases);
    const rightBase = Math.min(basePositions.length - 1, rawIndex + zoomBases);
    const leftTraceIndex = Math.max(0, basePositions[leftBase] - 18);
    const rightTraceIndex = Math.min(
      result.sample.chromatogram.aTrace.length - 1,
      basePositions[rightBase] + 18
    );

    const traces = [
      { key: "aTrace", color: "#21a76b", label: "A" },
      { key: "cTrace", color: "#2f7ae5", label: "C" },
      { key: "gTrace", color: "#333333", label: "G" },
      { key: "tTrace", color: "#e24a5c", label: "T" },
    ];
    const plotWidth = canvas.width - 80;
    const plotHeight = canvas.height - 110;
    const baseline = canvas.height - 60;
    const traceSpan = Math.max(1, rightTraceIndex - leftTraceIndex);
    const maxHeight = Math.max(
      10,
      ...traces.flatMap((trace) =>
        (result.sample.chromatogram[trace.key] || []).slice(leftTraceIndex, rightTraceIndex + 1)
      )
    );

    context.strokeStyle = "#d7e1ed";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(40, baseline);
    context.lineTo(canvas.width - 30, baseline);
    context.stroke();

    traces.forEach((trace) => {
      const values = result.sample.chromatogram[trace.key] || [];
      context.beginPath();
      context.lineWidth = 2;
      context.strokeStyle = trace.color;
      for (let index = leftTraceIndex; index <= rightTraceIndex; index += 1) {
        const x = 40 + ((index - leftTraceIndex) / traceSpan) * plotWidth;
        const y = baseline - ((values[index] || 0) / maxHeight) * plotHeight;
        if (index === leftTraceIndex) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.stroke();
    });

    for (let index = leftBase; index <= rightBase; index += 1) {
      const peakIndex = basePositions[index];
      if (!Number.isFinite(peakIndex)) {
        continue;
      }
      const x = 40 + ((peakIndex - leftTraceIndex) / traceSpan) * plotWidth;
      const isTarget = index === rawIndex;
      context.strokeStyle = isTarget ? "#f39b31" : "rgba(24, 55, 83, 0.14)";
      context.lineWidth = isTarget ? 2 : 1;
      context.beginPath();
      context.moveTo(x, baseline + 3);
      context.lineTo(x, baseline + 12);
      context.stroke();

      context.fillStyle = isTarget ? "#d86c00" : "#415c77";
      context.font = isTarget ? "bold 16px sans-serif" : "13px sans-serif";
      context.fillText(result.sample.rawSequence[index] || "", x - 4, baseline + 28);
    }

    const targetPeakX =
      40 + ((basePositions[rawIndex] - leftTraceIndex) / traceSpan) * plotWidth;
    context.strokeStyle = "#f39b31";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(targetPeakX, 24);
    context.lineTo(targetPeakX, baseline - 6);
    context.stroke();

    context.fillStyle = "#173753";
    context.font = "bold 17px sans-serif";
    context.fillText(
      `${result.sampleName} | reference ${variant.referencePositionLabel} | AB1 trace base ${rawIndex + 1} | ${variant.referenceBase}>${variant.queryBase}`,
      34,
      28
    );

    const peakInterpretation = variant.lowQuality
      ? `The evidence quality (Q${formatNumber(
          variant.quality,
          0
        )}) is below the analysis threshold. Treat this as low-quality or ambiguous trace evidence, not a reportable variant, unless an independent or opposite-direction read confirms it.`
      : variant.heterozygousCandidate
        ? "Secondary-peak evidence suggests a possible mixed or heterozygous signal that still requires independent confirmation."
        : variant.type === "ambiguous"
          ? "The IUPAC call represents overlapping base possibilities and must not be converted into a definite substitution without confirmation."
          : variant.type === "substitution"
            ? `A single dominant ${variant.queryBase} peak supports the base call, but does not by itself establish homozygosity; review the opposite-direction read and exclude allele dropout.`
            : "An alignment gap requires manual chromatogram review and confirmation with an independent or opposite-direction read.";
    elements.chromatogramNote.textContent = `Reference ${variant.referencePositionLabel} maps to 1-based AB1 trace base ${
      rawIndex + 1
    }. Secondary peak ratio: ${formatNumber(variant.secondaryRatio, 3)}. ${peakInterpretation}`;
  }

  function buildPublicationTables() {
    const variants = flattenVariants();
    const qcRows = state.samples.map((sample) => ({
      Sample: sample.sampleName,
      "Raw length": sample.rawLength,
      "Trimmed length": sample.trimmedLength,
      "Mean Q": formatNumber(sample.meanQuality, 2),
      Status: sample.status.toUpperCase(),
    }));
    const alignmentRows = state.results.map((result) => ({
      Sample: result.sampleName,
      Orientation: result.orientation,
      "Reference range": `${result.refStart + 1}-${result.refEnd}`,
      "Query range": `${result.queryStart + 1}-${result.queryEnd}`,
      "Aligned length": result.alignedLength,
      "Identity (%)": formatNumber(result.identity, 2),
      "Reference coverage (%)": formatNumber(result.referenceCoverage, 2),
      "Query coverage (%)": formatNumber(result.queryCoverage, 2),
      "Alignment QC": result.alignmentQc?.passed ? "Pass" : "Reference mismatch",
      "Alignment QC note": result.alignmentQc?.reasons?.join(" ") || "—",
      "Candidate variants": result.variants.length,
    }));
    const variantRows = variants.map((variant) => ({
      Sample: variant.sampleName,
      "Reference position": variant.referencePositionLabel,
      "Sample position": variant.samplePositionLabel,
      "Reference / sample": `${variant.referenceBase}/${variant.queryBase}`,
      Type: variant.label,
      "Quality score": formatNumber(variant.quality, 2),
      "Secondary ratio": formatNumber(variant.secondaryRatio, 3),
      Status: variant.status,
      Context: variant.context,
    }));
    const clinicalRows = variants.map((variant) => ({
      Sample: variant.sampleName,
      "Reference position": variant.referencePositionLabel,
      rsID: variant.rsId || "—",
      "Clinical significance": variant.clinicalSignificance || "—",
      "Consequence summary": variant.consequenceSummary || "—",
      "Known / novel": variant.isKnown ? "Known" : "Novel / not linked",
    }));
    const codingRows = variants.map((variant) => ({
      Sample: variant.sampleName,
      Gene: variant.geneName || state.reference?.geneName || "—",
      Region: variant.regionLabel || "Annotation unavailable",
      "Coding status": variant.codingStatus || "Annotation unavailable",
      "Coding effect": variant.codingEffect || "—",
      "Codon change": variant.codonChange || "—",
      "Amino acid change": variant.aminoAcidChange || "—",
    }));
    const frequencyRows = core.calculateVariantFrequencies(state.results).map((entry) => ({
      Locus: entry.locus,
      "Reference / sample": `${entry.referenceBase}/${entry.queryBase}`,
      "Coding effect": entry.codingEffect,
      "Sample count": entry.sampleCount,
      "Frequency (%)": formatNumber(entry.frequency, 2),
      Samples: entry.sampleList,
    }));

    state.publicationTables = {
      qc: {
        caption: "Sample QC table for uploaded AB1 reads",
        columns: ["Sample", "Raw length", "Trimmed length", "Mean Q", "Status"],
        rows: qcRows,
      },
      alignment: {
        caption: "Alignment summary table for pairwise sample-to-reference analysis",
        columns: [
          "Sample",
          "Orientation",
          "Reference range",
          "Query range",
          "Aligned length",
          "Identity (%)",
          "Reference coverage (%)",
          "Query coverage (%)",
          "Alignment QC",
          "Alignment QC note",
          "Candidate variants",
        ],
        rows: alignmentRows,
      },
      variants: {
        caption: "Variant summary table for candidate sample-level differences",
        columns: [
          "Sample",
          "Reference position",
          "Sample position",
          "Reference / sample",
          "Type",
          "Quality score",
          "Secondary ratio",
          "Status",
          "Context",
        ],
        rows: variantRows,
      },
      clinical: {
        caption: "ClinVar and dbSNP context table for candidate variants",
        columns: [
          "Sample",
          "Reference position",
          "rsID",
          "Clinical significance",
          "Consequence summary",
          "Known / novel",
        ],
        rows: clinicalRows,
      },
      coding: {
        caption: "Coding-effect table for candidate variants when trusted annotation is available",
        columns: [
          "Sample",
          "Gene",
          "Region",
          "Coding status",
          "Coding effect",
          "Codon change",
          "Amino acid change",
        ],
        rows: codingRows,
      },
      frequency: {
        caption: "Variant frequency table across uploaded samples",
        columns: ["Locus", "Reference / sample", "Coding effect", "Sample count", "Frequency (%)", "Samples"],
        rows: frequencyRows,
      },
    };
  }

  function renderPublicationTable() {
    const table = state.publicationTables[state.activePublicationTab];
    if (!table) {
      elements.publicationShell.textContent =
        "Run the analysis to generate the publication tables.";
      return;
    }

    if (!table.rows.length) {
      elements.publicationShell.innerHTML = `
        <div class="publication-copy-source">
          <table class="data-table">
            <caption>${escapeHtml(table.caption)}</caption>
            <thead>
              <tr>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              <tr><td colspan="${table.columns.length}">No rows available for this table.</td></tr>
            </tbody>
          </table>
        </div>
      `;
      return;
    }

    elements.publicationShell.innerHTML = `
      <div class="publication-copy-source">
        <table class="data-table">
          <caption>${escapeHtml(table.caption)}</caption>
          <thead>
            <tr>${table.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${table.rows
              .map(
                (row) => `
                  <tr>
                    ${table.columns
                      .map((column) => `<td>${escapeHtml(row[column] ?? "—")}</td>`)
                      .join("")}
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function getPublicationCopyPayload(keys) {
    const selectedKeys = Array.isArray(keys) ? keys : [keys];
    const html = selectedKeys
      .map((key) => {
        const table = state.publicationTables[key];
        if (!table) {
          return "";
        }
        const header = `<caption>${escapeHtml(table.caption)}</caption>`;
        const thead = `<thead><tr>${table.columns
          .map((column) => `<th>${escapeHtml(column)}</th>`)
          .join("")}</tr></thead>`;
        const tbody = `<tbody>${table.rows
          .map(
            (row) =>
              `<tr>${table.columns
                .map((column) => `<td>${escapeHtml(row[column] ?? "—")}</td>`)
                .join("")}</tr>`
          )
          .join("")}</tbody>`;
        return `<table>${header}${thead}${tbody}</table>`;
      })
      .filter(Boolean)
      .join("<br /><br />");

    const text = selectedKeys
      .map((key) => {
        const table = state.publicationTables[key];
        if (!table) {
          return "";
        }
        return `${table.caption}\n${core.tableRowsToTsv(table.columns, table.rows)}`;
      })
      .filter(Boolean)
      .join("\n\n");

    return { html, text };
  }

  function buildReport() {
    const variants = flattenVariants();
    const highQualityVariants = variants.filter(
      (variant) => !variant.lowQuality && variant.qualityReported !== false
    );
    const knownVariants = variants.filter((variant) => variant.isKnown);
    const codingVariants = variants.filter((variant) => variant.codingStatus === "Coding");
    const sampleCount = state.results.length;
    const referenceName = state.reference?.label || "the selected reference";
    const withheldResults = state.results.filter((result) => result.candidateCallingWithheld);
    const resultSummary = withheldResults.length
      ? `${withheldResults.length} of ${sampleCount} sample alignment(s) failed the predefined reference-concordance gate, so candidate calling and downstream annotation were withheld for those samples. This is not a negative variant result.`
      : `${sampleCount} uploaded sample(s) generated ${variants.length} candidate difference row(s), of which ${highQualityVariants.length} passed the default quality threshold at the candidate site. ${knownVariants.length} candidate difference row(s) overlapped a known dbSNP / ClinVar-linked record, while ${codingVariants.length} row(s) fell inside annotated coding sequence regions.`;

    state.report = {
      methods: `AB1 chromatogram files from ${sampleCount} sample(s) were analyzed in SeqStudio / Sanger Smart Analyzer within the Wahj NGS Guide website. Base calls, quality scores, and chromatogram traces were read directly from the uploaded AB1 files. Each read was quality-trimmed and aligned individually to ${referenceName} using sample-level pairwise local alignment. Candidate calling required at least 95% alignment identity and 70% query coverage. Substitutions, insertions, deletions, ambiguous calls, and secondary-peak evidence were reviewed only after the reference-concordance gate passed.`,
      results: resultSummary,
      interpretation: `The observed differences should be interpreted as candidate variants until confirmed by bidirectional sequencing or repeat PCR. Low-quality positions were retained as evidence rows but were not presented as confident calls. Database context was used to summarize known records and published relevance only; no diagnostic statement was generated.`,
      figureLegend: `Representative chromatogram evidence from SeqStudio / Sanger Smart Analyzer showing the selected candidate site, local peak pattern, and the aligned reference versus sample base call. Candidate substitutions, insertions, deletions, ambiguous calls, and secondary-peak evidence were highlighted in the alignment browser and chromatogram view.`,
      evidence: `Chromatogram evidence was reviewed at each selected candidate position using the raw AB1 peak traces. When a secondary-peak ratio crossed the default threshold, the site was flagged as a possible mixed or heterozygous signal rather than promoted to a confident variant on peak shape alone.`,
      limitations: `This analysis is based on individual Sanger reads and is not a validated diagnostic assay. A clean single peak does not establish homozygosity because primer-site variation or allele dropout can suppress one allele. Callable intervals, primer-binding regions, reference assembly, transcript, assay limitations, and opposite-direction confirmation must be reviewed. Coding-effect interpretation depends on trusted reference features, and external database links are descriptive resources only.`,
    };

    Object.entries(elements.reportFields).forEach(([key, element]) => {
      element.textContent = state.report[key];
    });
  }

  async function handleAb1Files(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) {
      return;
    }

    setStatus(elements.uploadStatus, "Parsing AB1 files...", "");
    try {
      const samples = [];
      const failedFiles = [];
      for (const file of files) {
        try {
          const parsed = await core.parseAb1Data(file);
          const sample = core.normalizeAb1SampleData(parsed, file.name, {
            minQuality: 20,
            minLength: 80,
            windowSize: 12,
          });
          samples.push(sample);
        } catch (error) {
          console.error(`AB1 parse failed for ${file.name}`, error);
          failedFiles.push(file.name);
        }
      }

      if (!samples.length) {
        throw new Error("None of the uploaded AB1 files could be parsed.");
      }

      state.samples = samples;
      resetAnalysisOutputs();
      renderSampleQcTable();
      updateMetrics();
      if (failedFiles.length) {
        setStatus(
          elements.uploadStatus,
          `${samples.length} AB1 file(s) were parsed successfully. ${failedFiles.length} file(s) failed: ${failedFiles.join(", ")}.`,
          "warning"
        );
      } else {
        setStatus(
          elements.uploadStatus,
          `${samples.length} AB1 file(s) were parsed successfully.`,
          "success"
        );
      }
    } catch (error) {
      console.error(error);
      setStatus(
        elements.uploadStatus,
        error.message || "At least one AB1 file could not be parsed. Use standard ABI/AB1 trace files.",
        "error"
      );
    }
  }

  function resetAnalysisOutputs() {
    state.results = [];
    state.publicationTables = {};
    state.knownVariantsByPosition = new Map();
    renderVariantSummaryTable();
    renderAnnotationTable();
    renderAlignmentBrowser();
    populateBrowserSelectors();
    populateChromatogramSelectors();
    elements.publicationStatus.textContent =
      "Run the analysis to generate the publication tables.";
    elements.publicationShell.textContent =
      "Select a publication table tab after the analysis is complete.";
    Object.values(elements.reportFields).forEach((element) => {
      element.textContent = "Generate the report after running the analysis.";
    });
    updateMetrics();
  }

  async function handleReferenceLoad() {
    setStatus(elements.referenceStatus, "Loading the selected reference...", "");
    try {
      let reference = null;
      if (state.referenceMode === "gene") {
        reference = await loadReferenceFromGene();
      } else if (state.referenceMode === "accession") {
        reference = await loadReferenceFromAccession();
      } else {
        reference = await loadReferenceFromFasta();
      }

      state.reference = reference;
      renderReferenceSummary();
      resetAnalysisOutputs();
      setStatus(
        elements.referenceStatus,
        `${reference.label} loaded successfully.`,
        "success"
      );
    } catch (error) {
      console.error(error);
      setStatus(
        elements.referenceStatus,
        error.message || "The reference could not be loaded.",
        "error"
      );
    }
  }

  async function runAnalysis() {
    if (!state.samples.length) {
      setStatus(elements.analysisStatus, "Load one or more AB1 files first.", "error");
      return;
    }

    if (!state.reference?.sequence) {
      setStatus(elements.analysisStatus, "Load a reference before running the analysis.", "error");
      return;
    }

    setStatus(elements.analysisStatus, "Running sample-level alignments and candidate-variant calling...", "");
    try {
      state.results = core
        .analyzeSamplesAgainstReference(state.samples, state.reference, {
          qualityThreshold: 20,
          matchScore: 2,
          mismatchScore: -1,
          gapPenalty: -2,
          minimumAlignmentIdentity: 95,
          minimumQueryCoverage: 70,
          minimumAlignedLength: 40,
          withholdUnreliableVariants: true,
        })
        .map(prepareResultMaps);

      await enrichAnnotations();
      renderVariantSummaryTable();
      renderAnnotationTable();
      populateBrowserSelectors();
      populateChromatogramSelectors();
      buildPublicationTables();
      renderPublicationTable();
      updateMetrics();

      const firstVariant = flattenVariants()[0];
      if (firstVariant?.referencePosition) {
        clampBrowserWindow(Number(firstVariant.referencePosition) - Math.floor(state.browserWindowSize / 2));
      } else {
        clampBrowserWindow(1);
      }
      renderAlignmentBrowser();
      renderChromatogram();

      elements.publicationStatus.textContent =
        "Publication tables were generated from the current sample-level analysis.";
      const withheldResults = state.results.filter((result) => result.candidateCallingWithheld);
      if (withheldResults.length) {
        const details = withheldResults
          .map(
            (result) =>
              `${result.sampleName}: ${result.alignmentQc.reasons.join(" ")}`
          )
          .join(" ");
        setStatus(
          elements.analysisStatus,
          `Analysis stopped before candidate calling for ${withheldResults.length} sample(s). The reference and read are not sufficiently concordant. Check genomic DNA versus cDNA, gene/accession, assembly, and amplicon scope. ${details}`,
          "error"
        );
      } else {
        setStatus(
          elements.analysisStatus,
          `Analysis complete for ${state.results.length} sample(s). Candidate differences remain unconfirmed until opposite-direction or repeat laboratory confirmation.`,
          "success"
        );
      }
    } catch (error) {
      console.error(error);
      setStatus(
        elements.analysisStatus,
        error.message || "The analysis could not be completed.",
        "error"
      );
    }
  }

  function updatePublicationTab(tabKey) {
    state.activePublicationTab = tabKey;
    elements.publicationTabs.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.publicationTab === tabKey);
    });
    renderPublicationTable();
  }

  async function copyActivePublicationTable() {
    const table = state.publicationTables[state.activePublicationTab];
    if (!table) {
      setStatus(elements.analysisStatus, "Run the analysis first.", "warning");
      return;
    }

    try {
      const payload = getPublicationCopyPayload([state.activePublicationTab]);
      await copyHtmlAndText(payload.html, payload.text);
      setStatus(
        elements.analysisStatus,
        `${displayLabels[state.activePublicationTab]} copied to the clipboard.`,
        "success"
      );
    } catch (error) {
      console.error(error);
      setStatus(elements.analysisStatus, "The publication table could not be copied.", "error");
    }
  }

  async function copyAllPublicationTables() {
    const keys = Object.keys(state.publicationTables);
    if (!keys.length) {
      setStatus(elements.analysisStatus, "Run the analysis first.", "warning");
      return;
    }

    try {
      const payload = getPublicationCopyPayload(keys);
      await copyHtmlAndText(payload.html, payload.text);
      setStatus(elements.analysisStatus, "All publication tables were copied.", "success");
    } catch (error) {
      console.error(error);
      setStatus(elements.analysisStatus, "The publication tables could not be copied.", "error");
    }
  }

  function downloadActivePublicationCsv() {
    const table = state.publicationTables[state.activePublicationTab];
    if (!table) {
      setStatus(elements.analysisStatus, "Run the analysis first.", "warning");
      return;
    }

    const filename = `wahj_seqstudio_${slugify(state.activePublicationTab)}_${slugify(
      state.reference?.accession || state.reference?.label || "reference"
    )}.csv`;
    downloadBlob(filename, core.tableRowsToCsv(table.columns, table.rows), "text/csv");
  }

  function copyReport() {
    if (!state.report) {
      setStatus(elements.analysisStatus, "Generate the report first.", "warning");
      return;
    }

    const text = [
      "Methods paragraph",
      state.report.methods,
      "",
      "Results paragraph",
      state.report.results,
      "",
      "Variant interpretation",
      state.report.interpretation,
      "",
      "Figure legend",
      state.report.figureLegend,
      "",
      "Chromatogram evidence note",
      state.report.evidence,
      "",
      "Limitations paragraph",
      state.report.limitations,
    ].join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setStatus(elements.analysisStatus, "The report text was copied.", "success");
      })
      .catch((error) => {
        console.error(error);
        setStatus(elements.analysisStatus, "The report text could not be copied.", "error");
      });
  }

  function exportChromatogramPng() {
    const dataUrl = elements.chromatogramCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `wahj_seqstudio_chromatogram_${slugify(
      elements.chromatogramSample.value || "sample"
    )}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function handleBrowserVariantJump() {
    const variantId = elements.browserVariantJump.value;
    if (!variantId) {
      return;
    }
    const variant = flattenVariants().find((entry) => entry.id === variantId);
    if (!variant?.referencePosition) {
      return;
    }
    clampBrowserWindow(Number(variant.referencePosition) - Math.floor(state.browserWindowSize / 2));
    renderAlignmentBrowser();
  }

  function initializeReferenceModeSwitch() {
    elements.referenceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.referenceMode || "gene";
        state.referenceMode = mode;
        elements.referenceButtons.forEach((entry) => {
          entry.classList.toggle("is-active", entry === button);
        });
        Object.entries(elements.referencePanels).forEach(([key, panel]) => {
          const isActive = key === mode;
          panel.classList.toggle("is-active", isActive);
          panel.hidden = !isActive;
        });
      });
    });
  }

  function initializePublicationTabs() {
    elements.publicationTabs.forEach((button) => {
      button.addEventListener("click", () => {
        updatePublicationTab(button.dataset.publicationTab || "qc");
      });
    });
  }

  function initializeEventHandlers() {
    elements.fileInput?.addEventListener("change", (event) => {
      handleAb1Files(event.target.files);
    });
    elements.loadReferenceButton?.addEventListener("click", handleReferenceLoad);
    elements.runAnalysisButton?.addEventListener("click", runAnalysis);
    elements.generateReportButton?.addEventListener("click", () => {
      if (!state.results.length) {
        setStatus(elements.analysisStatus, "Run the analysis first.", "warning");
        return;
      }
      buildReport();
      setStatus(elements.analysisStatus, "The thesis/paper report text was generated.", "success");
    });
    elements.browserPrev?.addEventListener("click", () => {
      clampBrowserWindow(state.browserWindowStart - state.browserWindowSize);
      renderAlignmentBrowser();
    });
    elements.browserNext?.addEventListener("click", () => {
      clampBrowserWindow(state.browserWindowStart + state.browserWindowSize);
      renderAlignmentBrowser();
    });
    elements.browserSampleFilter?.addEventListener("change", renderAlignmentBrowser);
    elements.browserVariantFilter?.addEventListener("change", renderAlignmentBrowser);
    elements.browserRegionFilter?.addEventListener("change", renderAlignmentBrowser);
    elements.browserKnownFilter?.addEventListener("change", renderAlignmentBrowser);
    elements.browserVariantJump?.addEventListener("change", handleBrowserVariantJump);
    elements.chromatogramSample?.addEventListener("change", handleChromatogramSampleChange);
    elements.chromatogramVariant?.addEventListener("change", renderChromatogram);
    elements.chromatogramZoom?.addEventListener("input", renderChromatogram);
    elements.chromatogramExport?.addEventListener("click", exportChromatogramPng);
    elements.copyPublicationTable?.addEventListener("click", copyActivePublicationTable);
    elements.copyAllPublicationTables?.addEventListener("click", copyAllPublicationTables);
    elements.downloadPublicationCsv?.addEventListener("click", downloadActivePublicationCsv);
    elements.copyReportButton?.addEventListener("click", copyReport);
  }

  function initializePage() {
    initializeReferenceModeSwitch();
    initializePublicationTabs();
    initializeEventHandlers();
    renderSampleQcTable();
    renderReferenceSummary();
    resetAnalysisOutputs();
    setStatus(
      elements.knownVariantNote,
      "Known-variant markers appear here after supported annotation lookups complete.",
      ""
    );
  }

  initializePage();
})();
