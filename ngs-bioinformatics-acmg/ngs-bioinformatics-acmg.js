(function initializeNgsAcmgLecture() {
  const page = document.querySelector(".ngs-acmg-page");
  if (!page) {
    return;
  }

  const workflowStages = [
    {
      id: "accession",
      label: "Specimen receipt",
      fileType: "LIMS accession",
      count: "1 labeled specimen",
      question: "Is this the correct specimen for the correct clinical question?",
      input: "Labeled blood, tissue, extracted nucleic acid, or another validated specimen with a complete test request.",
      process: "Verify identifiers, specimen type, collection and transport conditions, indication, consent requirements, volume, and acceptance criteria before assigning a laboratory accession.",
      output: "Accepted specimen linked to a traceable LIMS record, or a documented rejection/request for replacement.",
      doctorWhy: "Excellent sequencing cannot rescue a mislabeled, unsuitable, contaminated, or clinically mismatched specimen.",
      metrics: ["Identifier concordance", "Specimen type and volume", "Transport and acceptance status"],
      failureModes: [
        "Patient or specimen identifiers do not agree",
        "Insufficient material or inappropriate container",
        "Clinical indication does not match the ordered assay",
      ],
      tools: ["LIMS", "Barcode tracking", "Accession checklist"],
      snippetLabel: "Accession record example",
      snippet:
        "ACCESSION: WAHJ-2026-0017\n" +
        "SPECIMEN: EDTA whole blood\n" +
        "INDICATION: inherited cardiomyopathy\n" +
        "IDENTIFIERS: concordant\n" +
        "STATUS: accepted",
    },
    {
      id: "extraction",
      label: "Extraction and QC",
      fileType: "DNA/RNA QC record",
      count: "1.62 ug extracted DNA",
      question: "Is there enough intact, amplifiable nucleic acid for this validated assay?",
      input: "An accepted specimen processed with a validated extraction method appropriate to the specimen type.",
      process: "Extract nucleic acid, quantify it with an appropriate method, assess purity and integrity when relevant, and retain identity throughout the workflow.",
      output: "Qualified DNA or RNA at a documented concentration, volume, purity, and integrity, or a failed/suboptimal QC decision.",
      doctorWhy: "Low quantity, fragmentation, inhibitors, or fixation damage can produce uneven coverage, high duplication, allele dropout, and false-negative results.",
      metrics: ["Fluorometric concentration and total yield", "Purity/inhibition assessment", "DIN/RIN or fragment integrity when applicable"],
      failureModes: [
        "Spectrophotometric concentration overestimates usable DNA",
        "FFPE damage or fragmentation reduces amplifiable template",
        "Extraction contamination or sample identity loss",
      ],
      tools: ["Qubit or validated fluorometry", "Spectrophotometry", "TapeStation/Bioanalyzer or validated integrity method"],
      snippetLabel: "Nucleic-acid QC example",
      snippet:
        "QUBIT: 32.4 ng/uL\n" +
        "VOLUME: 50 uL\n" +
        "TOTAL YIELD: 1.62 ug\n" +
        "A260/A280: 1.86\n" +
        "DIN: 8.7\n" +
        "QC DECISION: proceed",
    },
    {
      id: "library",
      label: "Library preparation",
      fileType: "Indexed library",
      count: "360 bp median library",
      question: "Has the sample been converted into sequenceable molecules without losing important regions?",
      input: "Qualified nucleic acid plus an assay-specific fragmentation, amplification, or capture strategy.",
      process: "Fragment or amplify targets, repair ends when required, add platform adapters and sample indexes, enrich intended regions, purify, quantify, and normalize libraries.",
      output: "A traceable indexed library pool with documented concentration, fragment distribution, and target-enrichment QC.",
      doctorWhy: "Uneven capture, primer-site variants, excessive PCR, or poor pooling can cause exon dropout, high duplication, and misleading allele fractions.",
      metrics: ["Library concentration or molarity", "Fragment-size distribution", "Library complexity and index balance"],
      failureModes: [
        "Allele dropout at an amplification primer site",
        "Low-complexity library dominated by duplicate molecules",
        "Unbalanced pooling causes one sample to be under-sequenced",
      ],
      tools: ["Validated library kit", "Hybrid capture or amplicon workflow", "Library quantification and sizing"],
      snippetLabel: "Library QC example",
      snippet:
        "LIBRARY: WAHJ-2026-0017-L1\n" +
        "MEDIAN FRAGMENT: 360 bp\n" +
        "CONCENTRATION: 12.8 nM\n" +
        "INDEX i7/i5: ATCACG / CGATGT\n" +
        "POOL STATUS: balanced",
    },
    {
      id: "sequencing",
      label: "Sequencing run",
      fileType: "Run folder / BCL",
      count: "2 x 151 cycles",
      question: "Did the instrument convert library molecules into a stable, high-quality signal?",
      input: "A normalized indexed library pool loaded at a validated concentration with appropriate run controls.",
      process: "Generate clusters or another platform-specific signal, perform sequencing cycles, image or measure each incorporation event, and monitor run-level quality.",
      output: "Raw instrument signal and base-call files with run metrics, index reads, and control performance.",
      doctorWhy: "Poor cluster density, low diversity, phasing, chemistry failure, or a weak control can affect every downstream result in the run.",
      metrics: ["Yield and reads passing filter", "Q30 by read and cycle", "Control and index performance"],
      failureModes: [
        "Over- or under-clustering reduces usable signal",
        "Quality declines late in the read",
        "Index imbalance or index hopping misassigns reads",
      ],
      tools: ["Sequencing instrument", "Run-control software", "Run metrics dashboard"],
      snippetLabel: "Sequencing run example",
      snippet:
        "READ STRUCTURE: 151 + 8 + 8 + 151 cycles\n" +
        "CLUSTERS PASSING FILTER: 82.4%\n" +
        "Q30 READ 1: 92.1%\n" +
        "Q30 READ 2: 89.8%\n" +
        "CONTROL: within validated range",
    },
    {
      id: "primary-analysis",
      label: "Primary analysis",
      fileType: "BCL -> FASTQ",
      count: "35M read pairs",
      question: "How does instrument signal become sample-specific bases and quality scores?",
      input: "Raw cycle-level instrument signal, run metadata, sample sheet, and i7/i5 index definitions.",
      process: "Call bases, assign Phred quality scores, apply instrument filters, and demultiplex clusters by sample index into read files.",
      output: "Per-sample FASTQ files containing sequence identifiers, called bases, and one quality character per base.",
      doctorWhy: "An incorrect sample sheet, index mismatch, or failed demultiplexing can mix, lose, or mislabel reads before alignment begins.",
      metrics: ["Reads assigned per sample", "Undetermined index fraction", "Per-cycle base quality"],
      failureModes: [
        "Sample-sheet or index orientation error",
        "Unexpectedly high undetermined reads",
        "Read and quality strings are truncated or mismatched",
      ],
      tools: ["Instrument base caller", "bcl-convert / DRAGEN", "Demultiplexing report"],
      snippetLabel: "Primary-analysis handoff",
      snippet:
        "RUN SIGNAL: cycle images / intensities\n" +
        "BASE CALLS: BCL\n" +
        "DEMULTIPLEX: i7 + i5 indexes\n" +
        "OUTPUT: WAHJ-0017_R1.fastq.gz\n" +
        "        WAHJ-0017_R2.fastq.gz",
    },
    {
      id: "fastq",
      label: "FASTQ QC",
      fileType: "FASTQ",
      count: "35M read pairs",
      question: "Can I trust the letters before alignment starts?",
      input: "Demultiplexed FASTQ files with base qualities.",
      process: "Inspect quality, adapter content, duplication, GC pattern, and read survival after trimming.",
      output: "Raw or cleaned FASTQ plus QC summary.",
      doctorWhy: "A negative result becomes unsafe if clinically important regions were never represented in high-quality reads.",
      metrics: ["Per-cycle quality", "Adapter contamination", "Read count after trimming"],
      failureModes: [
        "Low-quality tails that inflate false variant calls",
        "Adapter contamination that disrupts alignment",
        "Severe read loss that weakens coverage",
      ],
      tools: ["FastQC", "fastp", "MultiQC"],
      snippetLabel: "FASTQ example",
      snippet:
        "@A00519:145:H25FYDSX7:1:1101:1240:1000 1:N:0:ATCACG\n" +
        "ACCTGAGCTCGCCAGTGAAATGATGGCTTATTACAGGTCAGTGG\n" +
        "+\n" +
        "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    },
    {
      id: "alignment",
      label: "Alignment",
      fileType: "BAM/CRAM",
      count: "31.4M mapped pairs",
      question: "Where did each read come from in the reference genome?",
      input: "High-quality FASTQ reads and a chosen reference build such as GRCh37 or GRCh38.",
      process: "Map reads to the reference, assign coordinates, and mark alignment metadata.",
      output: "Sorted BAM or CRAM with indexing and mapping statistics.",
      doctorWhy: "A variant can look real in the wrong reference region if reads map poorly or if pseudogene context is ignored.",
      metrics: ["Mapped percentage", "Mapping quality", "Duplicate rate"],
      failureModes: [
        "Off-target mapping in homologous regions",
        "Reference build mismatch",
        "Transcript confusion when different builds annotate the region differently",
      ],
      tools: ["BWA-MEM2", "DRAGEN", "samtools"],
      snippetLabel: "Alignment record example",
      snippet:
        "A00519:145:H25FYDSX7:1:1101:1240:1000\t99\tchr7\t117199644\t60\t150M\t=\t117199799\t305\tACCTGAGCTCGC...\tFFFFFFFFFFFF...",
    },
    {
      id: "calling",
      label: "Variant calling",
      fileType: "VCF",
      count: "62,148 raw SNV/indel calls",
      question: "What differs from the reference sequence?",
      input: "Aligned BAM/CRAM, reference genome, and calling model.",
      process: "Identify candidate SNVs and indels with genotype and confidence fields.",
      output: "VCF or gVCF containing technical variant calls.",
      doctorWhy: "This stage detects candidates, not clinical meaning. A raw VCF is not a diagnosis and not a final interpretation list.",
      metrics: ["QUAL", "FORMAT/DP", "Allele balance"],
      failureModes: [
        "Low-depth calls that appear real because only one metric was reviewed",
        "Strand-biased artifacts",
        "Caller-specific representation differences",
      ],
      tools: ["GATK HaplotypeCaller", "DeepVariant", "bcftools"],
      snippetLabel: "VCF row example",
      snippet:
        "chr7\t117199646\t.\tG\tA\t412.7\tPASS\tAC=1;AN=2\tGT:AD:DP:GQ\t0/1:38,34:72:99",
    },
    {
      id: "annotation",
      label: "Annotation",
      fileType: "Annotated VCF / table",
      count: "4,200 protein-altering candidates",
      question: "What is already known about the affected gene, transcript, and variant?",
      input: "VCF plus transcript database, population database, and clinical knowledge resources.",
      process: "Attach gene name, transcript consequence, population frequency, ClinVar status, and predicted effect.",
      output: "Annotated table for downstream filtering and review.",
      doctorWhy: "The same genomic change can receive different transcript consequences. Reference build and transcript choice must be explicit in the report.",
      metrics: ["Transcript used", "Population frequency", "ClinVar review status"],
      failureModes: [
        "Wrong transcript selection",
        "Assuming ClinVar is equivalent to expert curation",
        "Ignoring coverage when a region looks negative",
      ],
      tools: ["VEP", "ANNOVAR", "snpEff"],
      snippetLabel: "Annotation example",
      snippet:
        "GENE=CFTR | TRANSCRIPT=NM_000492.4 | CONSEQUENCE=inframe_deletion | HGVSc=c.1521_1523delCTT | HGVSp=p.Phe508del | gnomAD_AF=0.006 | ClinVar=Pathogenic",
    },
    {
      id: "prioritization",
      label: "Prioritization",
      fileType: "Candidate shortlist",
      count: "28 reviewed candidates",
      question: "Which variants deserve expert review in this patient?",
      input: "Annotated variant set plus phenotype, inheritance model, and assay scope.",
      process: "Filter by frequency, consequence, gene-disease fit, inheritance, phenotype relevance, and reportable range.",
      output: "Shortlist for formal evidence review.",
      doctorWhy: "A rare variant outside the disease mechanism or outside the tested phenotype should not dominate the discussion merely because it looks interesting.",
      metrics: ["Phenotype match", "Inheritance consistency", "Reportable region"],
      failureModes: [
        "Over-prioritizing rarity alone",
        "Ignoring alternate molecular explanations",
        "Using gene panels without matching phenotype context",
      ],
      tools: ["Phenotype filters", "HPO-guided review", "Laboratory curation workflows"],
      snippetLabel: "Shortlist example",
      snippet:
        "1. CFTR p.Phe508del | recessive | phenotype fit: strong\n2. GENE-X missense | rare | phenotype fit: weak\n3. deep intronic CNV candidate | assay support: insufficient",
    },
    {
      id: "classification",
      label: "Classification",
      fileType: "Evidence matrix",
      count: "2 report-level findings",
      question: "What does the total evidence support under the correct framework?",
      input: "Prioritized variants plus literature, phenotype context, segregation, and laboratory evidence.",
      process: "Apply ACMG/AMP germline criteria or the appropriate somatic framework.",
      output: "Benign, likely benign, VUS, likely pathogenic, or pathogenic for germline; other frameworks for somatic findings.",
      doctorWhy: "Evidence codes are not diagnosis labels. VUS should remain uncertain unless new evidence changes the case.",
      metrics: ["Evidence direction", "Conflict resolution", "Framework match"],
      failureModes: [
        "Using germline language for tumor-only actionability",
        "Treating ClinVar as the final answer without review",
        "Forcing a VUS into a positive clinical conclusion",
      ],
      tools: ["ACMG/AMP logic", "ClinGen specifications", "Disease-specific expert review"],
      snippetLabel: "Evidence summary example",
      snippet:
        "Variant: c.1521_1523delCTT (p.Phe508del)\nEvidence: PS1 not applicable | PM3 strong context | PP4 phenotype fit | ClinVar expert consensus\nFinal class: Pathogenic",
    },
    {
      id: "report",
      label: "Reporting",
      fileType: "Clinical report",
      count: "Signed interpretation",
      question: "What can be responsibly communicated to the treating team and the patient?",
      input: "Validated findings plus assay limitations, reviewed phenotype, and sign-out approval.",
      process: "State clinically relevant findings, limitations, reanalysis policy, and any need for confirmation or family workup.",
      output: "Signed report with clear language and documented limitations.",
      doctorWhy: "The report should show both the answer and the limits of the answer: uncovered regions, VUS status, confirmatory needs, and implications for relatives.",
      metrics: ["Reportable range", "Limitations", "Reanalysis policy"],
      failureModes: [
        "Reporting pathogenicity without framework clarity",
        "Ignoring uncovered or low-confidence regions",
        "Failing to separate germline and somatic implications",
      ],
      tools: ["Laboratory sign-out workflow", "LIMS", "Director review"],
      snippetLabel: "Report wording example",
      snippet:
        "Finding: Pathogenic CFTR variant detected.\nLimitation: No evidence of a second pathogenic variant in adequately covered coding regions.\nRecommendation: Correlate with phenotype and consider deletion/duplication analysis if clinically indicated.",
    },
  ];

  const workflowPhases = [
    {
      id: "preanalytical",
      label: "Pre-analytical",
      range: "Stages 1-3",
      description: "Receive, identify, extract, and prepare the sample.",
      firstStage: "accession",
    },
    {
      id: "sequencing",
      label: "Sequencing and primary",
      range: "Stages 4-5",
      description: "Generate signal, call bases, and demultiplex samples.",
      firstStage: "sequencing",
    },
    {
      id: "secondary",
      label: "Secondary analysis",
      range: "Stages 6-8",
      description: "Review FASTQ, align reads, and call candidate variants.",
      firstStage: "fastq",
    },
    {
      id: "tertiary",
      label: "Tertiary and reporting",
      range: "Stages 9-12",
      description: "Annotate, prioritize, classify, and communicate.",
      firstStage: "annotation",
    },
  ];

  const workflowPhaseByStage = {
    accession: "preanalytical",
    extraction: "preanalytical",
    library: "preanalytical",
    sequencing: "sequencing",
    "primary-analysis": "sequencing",
    fastq: "secondary",
    alignment: "secondary",
    calling: "secondary",
    annotation: "tertiary",
    prioritization: "tertiary",
    classification: "tertiary",
    report: "tertiary",
  };

  const fastqHeaderParts = [
    {
      id: "instrument",
      value: "@A00519",
      label: "Instrument ID",
      meaning: "The sequencing instrument name. The leading @ marks the FASTQ identifier line.",
    },
    {
      id: "run",
      value: "145",
      label: "Run number",
      meaning: "The run number assigned on that instrument.",
    },
    {
      id: "flowcell",
      value: "H25FYDSX7",
      label: "Flow-cell ID",
      meaning: "The flow cell on which this cluster was sequenced.",
    },
    {
      id: "lane",
      value: "1",
      label: "Lane",
      meaning: "The flow-cell lane containing the cluster.",
    },
    {
      id: "tile",
      value: "1101",
      label: "Tile",
      meaning: "The imaged tile within the lane.",
    },
    {
      id: "x",
      value: "1240",
      label: "X coordinate",
      meaning: "The cluster's horizontal coordinate on the tile.",
    },
    {
      id: "y",
      value: "1000",
      label: "Y coordinate",
      meaning: "The cluster's vertical coordinate on the tile.",
    },
    {
      id: "read",
      value: "1",
      label: "Read number",
      meaning: "Read 1 or Read 2 in a paired-end run.",
    },
    {
      id: "filter",
      value: "N",
      label: "Filter flag",
      meaning: "N means the read did not fail the instrument filter; Y means it was filtered.",
    },
    {
      id: "control",
      value: "0",
      label: "Control number",
      meaning: "0 means the read is not identified as a control read.",
    },
    {
      id: "index",
      value: "ATCACG",
      label: "Index sequence",
      meaning: "The sample index or barcode reported for demultiplexing.",
    },
  ];

  const qualityMetrics = [
    {
      id: "coverage",
      title: "Coverage breadth",
      definition: "The horizontal proportion of the intended target that reaches a stated minimum depth, such as the percentage of target bases at or above 20×.",
      clinical: "A high mean depth cannot rescue a clinically important exon that has 0× coverage.",
    },
    {
      id: "depth",
      title: "Read depth",
      definition: "The number of usable aligned reads overlapping one genomic position; it is reported per position or summarized across a target.",
      clinical: "Depth is local. Two nearby bases can have very different evidence even within the same exon.",
    },
    {
      id: "base-quality",
      title: "Base quality",
      definition: "A Phred-scaled estimate that one called base is wrong. Q30 corresponds to an estimated error probability of 0.001, or 0.1%.",
      clinical: "A read can map correctly while one nucleotide within it remains low quality.",
    },
    {
      id: "mapping-quality",
      title: "Mapping quality",
      definition: "A Phred-scaled estimate of uncertainty in where the read was aligned, not whether each base call is correct.",
      clinical: "Pseudogenes and repetitive regions can give good-looking bases but uncertain genomic placement.",
    },
    {
      id: "allele-fraction",
      title: "Allele fraction",
      definition: "The fraction of usable reads at a locus that support the alternate allele: alternate-supporting reads divided by total usable reads.",
      clinical: "Allele fraction supports interpretation but is not a genotype or diagnosis by itself.",
    },
    {
      id: "strand-bias",
      title: "Strand bias",
      definition: "An imbalance in alternate-allele support between forward- and reverse-oriented reads.",
      clinical: "Support confined largely to one orientation can signal a technical artifact and needs contextual review.",
    },
    {
      id: "contamination",
      title: "Contamination",
      definition: "A mixture of DNA from more than the intended sample, inferred from unexpected allele fractions, genotypes, or sample-fingerprint discordance.",
      clinical: "Even low-level mixture can distort weak variants; contamination estimates and sample identity checks belong in QC.",
    },
    {
      id: "reference-build",
      title: "Reference build",
      definition: "The exact genome assembly used to assign genomic coordinates, for example GRCh37 or GRCh38.",
      clinical: "Coordinates from different builds are not interchangeable and can point to different bases if the build is omitted.",
    },
    {
      id: "transcript-choice",
      title: "Transcript choice",
      definition: "The selected RNA transcript used to assign exon number, cDNA position, and predicted coding consequence.",
      clinical: "One genomic variant can have different consequences across isoforms, so the accession and version must be reported.",
    },
    {
      id: "cnv-support",
      title: "CNV support",
      definition: "Evidence for copy-number gain or loss derived from normalized depth and, where available, split-read, paired-end, and allele-balance signals.",
      clinical: "A depth shift is candidate support, not automatic confirmation; validated calling and orthogonal confirmation may be needed.",
    },
    {
      id: "repeat-expansion",
      title: "Repeat expansion visibility",
      definition: "How well the assay and read length can detect and size a repetitive tract, especially when the expansion is longer than a short read.",
      clinical: "A negative short-read result may not exclude a large repeat expansion unless the assay was validated for that locus and size range.",
    },
    {
      id: "mtdna",
      title: "mtDNA heteroplasmy",
      definition: "The fraction of mitochondrial DNA molecules carrying a variant in the sampled tissue.",
      clinical: "Heteroplasmy is tissue- and assay-dependent; a measured fraction is not automatically the same in every tissue.",
    },
  ];

  const organizations = [
    {
      id: "acmg",
      label: "ACMG",
      fullName: "American College of Medical Genetics and Genomics",
      role: "Professional guidance in medical genetics and genomics.",
      why: "ACMG co-issued the 2015 germline sequence-variant interpretation framework with AMP.",
      not: "It does not regulate all genetic testing worldwide and it is not a replacement for local law or laboratory accreditation.",
      documents: [
        "2015 ACMG/AMP germline framework",
        "Professional education and policy guidance",
      ],
    },
    {
      id: "amp",
      label: "AMP",
      fullName: "Association for Molecular Pathology",
      role: "Professional standards in molecular diagnostics and pathology.",
      why: "AMP co-issued the 2015 germline paper and later helped develop somatic cancer guidance.",
      not: "It does not replace disease-specific evidence review or local clinical accountability.",
      documents: [
        "Joint 2015 ACMG/AMP guideline",
        "Later somatic clinical significance guidance",
      ],
    },
    {
      id: "cap",
      label: "CAP",
      fullName: "College of American Pathologists",
      role: "Laboratory quality, accreditation, checklists, and peer inspection.",
      why: "CAP representation was part of the earlier workgroup, and CAP standards strongly influence clinical laboratory quality systems.",
      not: "CAP accreditation is not the same as assigning a pathogenicity class to one variant.",
      documents: [
        "Accreditation and laboratory quality standards",
        "Inspection and checklist framework",
      ],
    },
    {
      id: "asco",
      label: "ASCO",
      fullName: "American Society of Clinical Oncology",
      role: "Oncology practice and education.",
      why: "ASCO matters when discussing cancer interpretation frameworks, especially somatic clinical significance.",
      not: "ASCO was not part of the 2015 ACMG/AMP germline variant recommendation.",
      documents: [
        "Cancer-focused practice guidance",
        "Later somatic framework collaborations",
      ],
    },
    {
      id: "clingen",
      label: "ClinGen",
      fullName: "Clinical Genome Resource",
      role: "Evidence curation, expert panels, and refinement of criteria use.",
      why: "ClinGen refines how criteria such as PVS1, PM2, PS3/BS3, segregation, and computation are applied in real practice.",
      not: "It is not the same thing as ClinVar, which is a public archive of submissions.",
      documents: [
        "Variant Classification Guidance aggregator",
        "Gene- and disease-specific specifications",
      ],
    },
    {
      id: "clinvar",
      label: "ClinVar",
      fullName: "ClinVar public archive",
      role: "Public repository of submitted variant interpretations and evidence summaries.",
      why: "ClinVar is extremely useful, but entries differ in date, stars, submitter quality, and the depth of underlying evidence.",
      not: "ClinVar alone should not replace independent review of the evidence or ClinGen-style expert specifications.",
      documents: [
        "Public archive of submissions",
        "Review status stars and submitter records",
      ],
    },
    {
      id: "regulation",
      label: "Regulation",
      fullName: "Government regulation and local legal requirements",
      role: "Legal framework for clinical practice and reporting.",
      why: "Professional guidance and accreditation exist inside broader national legal systems.",
      not: "No single international society overrides local legal or institutional obligations.",
      documents: [
        "Country-specific regulatory requirements",
        "Institutional governance and ethics policies",
      ],
    },
  ];

  const criteria = [
    {
      code: "PVS1",
      direction: "pathogenic",
      strength: "Very strong",
      title: "Null variant in a gene where loss of function is a known mechanism",
      definition:
        "Nonsense, frameshift, canonical +/-1 or 2 splice site, initiation codon, or single/multi-exon deletion when loss of function causes the disease.",
      requiredData:
        "Variant consequence, transcript relevance, exon context, NMD prediction, and gene-disease mechanism.",
      example:
        "Early truncating variant in a haploinsufficient disease gene with a clinically relevant transcript.",
      misuse:
        "Applying PVS1 automatically to every stop-gain or splice-site variant without checking mechanism, transcript, or 3' end context.",
      update:
        "Use the ClinGen PVS1 decision framework. Strength may be Very Strong, Strong, Moderate, Supporting, or not applied.",
      adjustable: "Yes",
      geneSpecific: "Yes",
    },
    {
      code: "PS1",
      direction: "pathogenic",
      strength: "Strong",
      title: "Same amino-acid change as a previously established pathogenic variant",
      definition:
        "The amino-acid change matches a known pathogenic amino-acid change, even if the nucleotide change differs.",
      requiredData: "Established pathogenic comparator and transcript-level amino-acid equivalence.",
      example: "A new codon change produces the same protein substitution already proven pathogenic.",
      misuse: "Ignoring the possibility that the new nucleotide change also changes splicing.",
      update: "Still useful, but transcript and splice context must be reviewed carefully.",
      adjustable: "Usually no",
      geneSpecific: "Sometimes",
    },
    {
      code: "PS2",
      direction: "pathogenic",
      strength: "Strong",
      title: "Confirmed de novo",
      definition:
        "Variant arose de novo in a patient with the disease and no family history, with maternity and paternity confirmed.",
      requiredData: "Phenotype fit, parental testing, and confirmed biological parentage.",
      example: "Child with classic syndrome, variant absent in both confirmed biological parents.",
      misuse: "Calling it PS2 when only paternity was checked or phenotype fit is weak.",
      update: "Modern guidance uses de novo scoring and can modify strength based on phenotype and parental confirmation.",
      adjustable: "Yes",
      geneSpecific: "Sometimes",
    },
    {
      code: "PS3",
      direction: "pathogenic",
      strength: "Strong",
      title: "Well-established functional evidence of damage",
      definition:
        "Validated in vitro or in vivo functional studies support a damaging effect on the gene or gene product.",
      requiredData: "Relevant assay, controls, reproducibility, and established assay performance.",
      example: "Clinically validated functional assay shows severe loss of protein function.",
      misuse: "Treating any published experiment as strong evidence without assay validation.",
      update: "PS3 and BS3 should be calibrated to assay quality; many labs no longer assign default strong strength blindly.",
      adjustable: "Yes",
      geneSpecific: "Yes",
    },
    {
      code: "PS4",
      direction: "pathogenic",
      strength: "Strong",
      title: "Variant significantly enriched in affected individuals",
      definition:
        "Prevalence is significantly increased in affected individuals compared with controls.",
      requiredData: "Case-control data or strong multi-case evidence with appropriate controls.",
      example: "Odds ratio above 5 with confidence interval excluding 1 in an appropriate disease cohort.",
      misuse: "Calling PS4 from a few anecdotal cases without proper controls or phenotype definition.",
      update: "Can be downgraded or upgraded depending on the data structure, especially for rare diseases.",
      adjustable: "Yes",
      geneSpecific: "Sometimes",
    },
    {
      code: "PM1",
      direction: "pathogenic",
      strength: "Moderate",
      title: "Hot spot or critical functional domain",
      definition:
        "Variant lies in a mutational hot spot or well-established functional domain without benign variation.",
      requiredData: "Domain knowledge, benign variation context, and disease mechanism.",
      example: "Missense change in a catalytic site with many pathogenic variants and little benign variation.",
      misuse: "Using PM1 for any conserved region without hot-spot or functional-domain evidence.",
      update: "Best applied with curated domain-level evidence and known benign-background review.",
      adjustable: "Sometimes",
      geneSpecific: "Yes",
    },
    {
      code: "PM2",
      direction: "pathogenic",
      strength: "Moderate",
      title: "Absent or extremely rare in controls",
      definition:
        "Absent from controls, or at extremely low frequency if recessive, in population databases.",
      requiredData: "Reliable population database coverage and disease-specific frequency expectations.",
      example: "Candidate variant absent from well-covered general population data in a severe recessive disease.",
      misuse: "Treating absence alone as strong pathogenic evidence.",
      update: "Current ClinGen practice often applies PM2 at supporting strength rather than moderate by default.",
      adjustable: "Yes",
      geneSpecific: "Yes",
    },
    {
      code: "PM3",
      direction: "pathogenic",
      strength: "Moderate",
      title: "Detected in trans with a pathogenic variant in a recessive disorder",
      definition:
        "For recessive disease, the variant is found in trans with a pathogenic variant.",
      requiredData: "Phase information, inheritance model, and confidence in the other pathogenic allele.",
      example: "Recessive disease patient carries a known pathogenic allele on the opposite chromosome.",
      misuse: "Applying PM3 without phase confirmation or when the other allele is not truly pathogenic.",
      update: "Strength can be upgraded with multiple independent in-trans observations.",
      adjustable: "Yes",
      geneSpecific: "Yes",
    },
    {
      code: "PM4",
      direction: "pathogenic",
      strength: "Moderate",
      title: "Protein length change in non-repeat region or stop-loss",
      definition:
        "In-frame deletion/insertion in a non-repeat region, or stop-loss, causing protein length change.",
      requiredData: "Protein context, repeat status, and evidence that length change matters biologically.",
      example: "In-frame exon deletion removes conserved residues outside repetitive sequence.",
      misuse: "Treating every in-frame indel as moderate evidence without structural or functional context.",
      update: "Interpretation often needs domain-specific review and may overlap with BP3 in repetitive regions.",
      adjustable: "Sometimes",
      geneSpecific: "Yes",
    },
    {
      code: "PM5",
      direction: "pathogenic",
      strength: "Moderate",
      title: "Novel missense at residue where another pathogenic missense is known",
      definition:
        "A different pathogenic missense change has already been established at the same residue.",
      requiredData: "Reliable pathogenic comparator and residue equivalence in the correct transcript.",
      example: "Arg156His already pathogenic; new variant changes Arg156 to Cys.",
      misuse: "Ignoring possible splicing effects or using weak comparator evidence.",
      update: "Use with careful comparator review and transcript consistency.",
      adjustable: "Sometimes",
      geneSpecific: "Yes",
    },
    {
      code: "PM6",
      direction: "pathogenic",
      strength: "Moderate",
      title: "Assumed de novo without complete parentage confirmation",
      definition:
        "Variant is assumed de novo but maternity and paternity are not both confirmed.",
      requiredData: "Phenotype fit and partial parental evidence.",
      example: "Variant absent in available parent samples, but complete confirmation of biological parentage is lacking.",
      misuse: "Using PM6 when even the phenotype fit is weak or parental data are unclear.",
      update: "Modern de novo scoring can modify strength depending on phenotype specificity and confirmation level.",
      adjustable: "Yes",
      geneSpecific: "Sometimes",
    },
    {
      code: "PP1",
      direction: "pathogenic",
      strength: "Supporting",
      title: "Co-segregation with disease in multiple affected relatives",
      definition:
        "Variant segregates with disease in multiple affected family members in a gene definitively known to cause the disorder.",
      requiredData: "Pedigree structure, affected status, and clear segregation data.",
      example: "Variant tracks with disease across several informative meioses in a dominant pedigree.",
      misuse: "Counting non-informative or weakly phenotyped relatives as segregation support.",
      update: "ClinGen practice may strengthen or weaken PP1 based on quantitative segregation evidence.",
      adjustable: "Yes",
      geneSpecific: "Yes",
    },
    {
      code: "PP2",
      direction: "pathogenic",
      strength: "Supporting",
      title: "Missense variant in gene with low benign missense rate and pathogenic missense mechanism",
      definition:
        "Use when missense is a common disease mechanism and benign missense variation is low in that gene.",
      requiredData: "Gene-specific variant spectrum knowledge.",
      example: "Novel missense in a gene where disease is predominantly caused by missense changes.",
      misuse: "Applying PP2 to genes without established missense-dominant disease architecture.",
      update: "This is gene-specific and should be used cautiously.",
      adjustable: "Rarely",
      geneSpecific: "Yes",
    },
    {
      code: "PP3",
      direction: "pathogenic",
      strength: "Supporting",
      title: "Multiple computational lines support deleterious effect",
      definition:
        "Computational evidence supports a damaging effect on the gene or gene product, including conservation or splice impact.",
      requiredData: "Calibrated and relevant in-silico tools.",
      example: "Concordant splice prediction and conservation support a damaging impact.",
      misuse: "Counting several correlated predictors as independent criteria.",
      update: "PP3 should generally be used once, and modern guidance favors calibrated computational frameworks.",
      adjustable: "Sometimes",
      geneSpecific: "Sometimes",
    },
    {
      code: "PP4",
      direction: "pathogenic",
      strength: "Supporting",
      title: "Phenotype or family history highly specific for a single genetic etiology",
      definition:
        "The patient's phenotype or family history is highly specific for a disease with one genetic cause.",
      requiredData: "Well-curated phenotype and disease specificity.",
      example: "Classic syndrome pattern with a single well-established causal gene.",
      misuse: "Using PP4 for broad or nonspecific phenotypes such as generic developmental delay.",
      update: "Specificity matters; broad overlapping phenotypes weaken the criterion.",
      adjustable: "Sometimes",
      geneSpecific: "Yes",
    },
    {
      code: "PP5",
      direction: "pathogenic",
      strength: "Supporting",
      title: "Reputable source reports pathogenicity but evidence unavailable",
      definition:
        "A reputable source reports the variant as pathogenic, but the laboratory cannot independently review the evidence.",
      requiredData: "External classification without accessible underlying evidence.",
      example: "Historic database label without usable supporting data.",
      misuse: "Using PP5 instead of reviewing the real evidence.",
      update: "Modern ClinGen guidance advises avoiding PP5 as a substitute for independent evidence review.",
      adjustable: "No",
      geneSpecific: "No",
    },
    {
      code: "BA1",
      direction: "benign",
      strength: "Stand-alone",
      title: "Population frequency too high for the disorder",
      definition:
        "Allele frequency is above the disorder-compatible threshold; the original paper used above 5% in broad databases.",
      requiredData: "Reliable population frequency and disease-specific prevalence/penetrance considerations.",
      example: "Common population variant incompatible with a rare severe Mendelian disorder.",
      misuse: "Using a generic threshold without disease-specific exceptions or ancestry review.",
      update: "Current practice relies on disease-specific thresholds rather than a universal 5% shortcut.",
      adjustable: "Yes",
      geneSpecific: "Yes",
    },
    {
      code: "BS1",
      direction: "benign",
      strength: "Strong",
      title: "Allele frequency greater than expected for the disorder",
      definition:
        "Population frequency is higher than what the disorder would allow.",
      requiredData: "Disease prevalence, penetrance, inheritance, and reliable ancestry-aware population data.",
      example: "Variant frequency is too high for a fully penetrant dominant condition.",
      misuse: "Ignoring founder effects or ancestry-specific interpretation.",
      update: "Use disease-specific frequency models whenever possible.",
      adjustable: "Yes",
      geneSpecific: "Yes",
    },
    {
      code: "BS2",
      direction: "benign",
      strength: "Strong",
      title: "Observed in healthy adult where full penetrance is expected early",
      definition:
        "Variant is seen in a healthy adult for a disorder that should already be fully penetrant in that genotype state.",
      requiredData: "Well-phenotyped unaffected individual and a disease with early full penetrance.",
      example: "Homozygous or heterozygous state observed in a healthy adult despite expected early severe disease.",
      misuse: "Using BS2 in reduced-penetrance or late-onset disorders.",
      update: "Penetrance assumptions must be explicit and clinically valid.",
      adjustable: "Sometimes",
      geneSpecific: "Yes",
    },
    {
      code: "BS3",
      direction: "benign",
      strength: "Strong",
      title: "Well-established functional studies show no damaging effect",
      definition:
        "Validated functional data support no damaging effect on protein function or splicing.",
      requiredData: "Relevant, validated, and reproducible assay demonstrating no damaging effect.",
      example: "Clinically validated assay shows normal function comparable to wild type.",
      misuse: "Using weak or non-relevant assays as if they were strong benign evidence.",
      update: "Like PS3, BS3 should be calibrated to assay quality and disease relevance.",
      adjustable: "Yes",
      geneSpecific: "Yes",
    },
    {
      code: "BS4",
      direction: "benign",
      strength: "Strong",
      title: "Lack of segregation with disease",
      definition:
        "Variant fails to segregate with disease in affected family members.",
      requiredData: "Pedigree review, phenocopy awareness, and reliable affection status.",
      example: "Affected relatives repeatedly lack the variant despite clear disease status.",
      misuse: "Applying BS4 in common phenotypes with phenocopies or blended inherited conditions.",
      update: "Use carefully; common phenotypes and complex families can make apparent non-segregation misleading.",
      adjustable: "Sometimes",
      geneSpecific: "Yes",
    },
    {
      code: "BP1",
      direction: "benign",
      strength: "Supporting",
      title: "Missense in a gene where truncating variants are the main mechanism",
      definition:
        "Missense change occurs in a gene for which disease is primarily caused by truncating variants.",
      requiredData: "Gene-specific variant spectrum knowledge.",
      example: "Novel missense in a gene where known disease-causing variants are almost all truncating.",
      misuse: "Applying BP1 without verifying the gene's true disease mechanism.",
      update: "Should be gene-specific and conservative.",
      adjustable: "Rarely",
      geneSpecific: "Yes",
    },
    {
      code: "BP2",
      direction: "benign",
      strength: "Supporting",
      title: "Observed in trans with pathogenic variant for dominant disease, or in cis with pathogenic variant",
      definition:
        "Configuration argues against causality, depending on inheritance model and phase.",
      requiredData: "Phase testing and correct inheritance framework.",
      example: "Variant in cis with a pathogenic allele, arguing that it is not the independent disease cause.",
      misuse: "Using BP2 without knowing the phase or the disease mechanism.",
      update: "Interpretation depends heavily on disease model and can overlap with PM3 logic.",
      adjustable: "Sometimes",
      geneSpecific: "Yes",
    },
    {
      code: "BP3",
      direction: "benign",
      strength: "Supporting",
      title: "In-frame indel in repetitive region without known function",
      definition:
        "In-frame deletion or insertion occurs in a repetitive region without established function.",
      requiredData: "Region context and evidence that the segment is repetitive/noncritical.",
      example: "Small in-frame change inside a repeat tract without known functional significance.",
      misuse: "Using BP3 in conserved or clearly functional domains.",
      update: "Interpret with caution when domain-level evidence is incomplete.",
      adjustable: "Rarely",
      geneSpecific: "Yes",
    },
    {
      code: "BP4",
      direction: "benign",
      strength: "Supporting",
      title: "Computational evidence suggests no impact",
      definition:
        "Multiple computational lines suggest no impact on the gene or gene product.",
      requiredData: "Calibrated computational tools and appropriate context.",
      example: "Concordant prediction set indicates no splice disruption and low conservation concern.",
      misuse: "Counting multiple correlated tools as separate benign criteria.",
      update: "Use once only; modern frameworks favor calibrated in-silico evidence.",
      adjustable: "Sometimes",
      geneSpecific: "Sometimes",
    },
    {
      code: "BP5",
      direction: "benign",
      strength: "Supporting",
      title: "Alternate molecular basis for disease identified",
      definition:
        "Variant is found in a case with a clear alternate molecular explanation for disease.",
      requiredData: "Convincing alternate diagnosis and careful phenotype review.",
      example: "Patient has another pathogenic variant that fully explains the phenotype.",
      misuse: "Assuming every second variant is benign in blended or dual-diagnosis scenarios.",
      update: "Use cautiously; alternate diagnosis does not always exclude additional relevant findings.",
      adjustable: "Sometimes",
      geneSpecific: "Sometimes",
    },
    {
      code: "BP6",
      direction: "benign",
      strength: "Supporting",
      title: "Reputable source reports benignity but evidence unavailable",
      definition:
        "A reputable source reports the variant as benign, but the laboratory cannot independently review the evidence.",
      requiredData: "External benign label without accessible underlying data.",
      example: "Historic benign database entry lacking usable evidence trail.",
      misuse: "Using BP6 as a substitute for independent review.",
      update: "Modern ClinGen guidance recommends avoiding BP6 in place of real evidence assessment.",
      adjustable: "No",
      geneSpecific: "No",
    },
    {
      code: "BP7",
      direction: "benign",
      strength: "Supporting",
      title: "Synonymous variant with no predicted splice impact and low conservation concern",
      definition:
        "Silent variant where splicing tools predict no impact on the splice consensus sequence or new splice site creation, and the nucleotide is not highly conserved.",
      requiredData: "Splicing prediction and conservation review.",
      example: "Synonymous change outside essential splice context with reassuring splicing predictions.",
      misuse: "Calling BP7 when splicing predictions are discordant or the position is highly conserved.",
      update: "Modern splice-focused guidance should be checked before assigning benign weight.",
      adjustable: "Sometimes",
      geneSpecific: "Sometimes",
    },
  ];

  const terminalWelcome =
    "Supported teaching commands: pwd, ls -lh, cd data, cd .., ls *.gz, zcat sample_R1.fastq.gz | head -n 8, samtools --help | head -n 5, fastp --version, samtools flagstat sample.bam, samtools depth -r chr7:117199640-117199660 sample.bam | head -n 5, zgrep '^#' sample.vcf.gz | head -n 5, bcftools view -H -r chr7:117199640-117199710 sample.vcf.gz, bcftools view -i 'QUAL>30 && FORMAT/DP>10' sample.vcf.gz | head -n 3, bwa-mem2 mem -t 8 ../reference/GRCh38.primary_assembly.fa sample_R1.fastq.gz sample_R2.fastq.gz | samtools sort -o sample.new.bam, fastp -i sample_R1.fastq.gz -I sample_R2.fastq.gz -o trimmed_R1.fastq.gz -O trimmed_R2.fastq.gz --html fastp.html, sha256sum sample_R1.fastq.gz, echo $?";

  const commandConcepts = [
    {
      id: "shell",
      label: "Terminal vs shell",
      title: "Terminal, shell, and command-line interface are related but not identical",
      what:
        "The terminal is the window, the shell interprets text commands, and the CLI is the text-based interface provided by each program.",
      why:
        "When a report is reviewed months later, the question is often not only what program was used, but exactly what command and options were given to that program.",
      example: "samtools --help | head -n 5",
      caution:
        "Copying a command without understanding which program receives which options is a common beginner error.",
    },
    {
      id: "paths",
      label: "Paths",
      title: "Absolute path, relative path, and working directory decide whether the command even sees the correct files",
      what:
        "An absolute path starts from the system root. A relative path depends on the current working directory shown by pwd.",
      why:
        "In clinical genomics, using the wrong directory can mean reading the wrong sample or writing outputs into the wrong case folder.",
      example: "pwd\ncd data\nls -lh",
      caution:
        "A correct command in the wrong directory can still produce a wrong or misleading result.",
    },
    {
      id: "pipes",
      label: "Pipes and streams",
      title: "The pipe symbol sends one program's output directly into the next program",
      what:
        "The symbol | connects commands so that the output of the first becomes the input of the second.",
      why:
        "Pipes make NGS review efficient. They let the laboratory inspect only the relevant part of a large file without making unsafe manual copies.",
      example: "zcat sample_R1.fastq.gz | head -n 8",
      caution:
        "A pipe does not save a file by itself. It streams text from one command to another.",
    },
    {
      id: "redirect",
      label: "Redirection",
      title: "Redirection controls where output goes",
      what:
        "> writes output into a file, >> appends to an existing file, and stderr can be redirected separately in real workflows.",
      why:
        "Clinical pipelines often write logs, QC summaries, and error traces to preserve a permanent audit trail of what happened during a run.",
      example: "bcftools stats sample.vcf.gz > results/vcf_stats.txt",
      caution:
        "Redirection can overwrite files. The laboratory should log intentionally and avoid accidental replacement of validated outputs.",
    },
    {
      id: "quoted",
      label: "Quoting and wildcards",
      title: "Quotes preserve exact expressions and wildcards expand file groups",
      what:
        "Single quotes keep filter expressions intact. Wildcards such as *.gz expand matching file names in the shell.",
      why:
        "Variant filters often fail silently if special characters are not quoted correctly, and sample file selection can be wrong if wildcard use is sloppy.",
      example: "bcftools view -i 'QUAL>30 && FORMAT/DP>10' sample.vcf.gz\nls *.gz",
      caution:
        "Quoted text is treated differently from unquoted text. That matters for real filters and not just for appearance.",
    },
    {
      id: "compressed",
      label: "Compressed files",
      title: "Clinical NGS files are usually compressed, indexed, or both",
      what:
        "FASTQ and VCF files are often gzip-compressed. That is why zcat, zgrep, and indexed viewers are used instead of plain text tools alone.",
      why:
        "Doctors do not need to memorize commands, but they should know why a 3 GB compressed FASTQ is not inspected the same way as a tiny text note.",
      example: "zgrep '^#' sample.vcf.gz | head -n 5",
      caution:
        "Teaching examples should match the file type. Plain head on a .gz file is not a good beginner example.",
    },
    {
      id: "provenance",
      label: "Versions and checksums",
      title: "Reproducibility needs versions, exit codes, and file identity checks",
      what:
        "Programs report versions, commands return exit codes, and checksums prove whether an input file changed between runs.",
      why:
        "If the same patient is reanalyzed later, the laboratory must know whether software, reference, or input data changed before explaining a result difference.",
      example: "fastp --version\nsha256sum sample_R1.fastq.gz\necho $?",
      caution:
        "A beautiful report without provenance is weak scientific evidence.",
    },
  ];

  const caseEvidenceOptions = [
    { id: "pvs1", label: "PVS1", direction: "pathogenic", strength: "Very strong", note: "LoF in a gene where loss of function is established." },
    { id: "ps2", label: "PS2", direction: "pathogenic", strength: "Strong", note: "Confirmed de novo with strong phenotype fit." },
    { id: "ps3", label: "PS3", direction: "pathogenic", strength: "Strong", note: "Validated damaging functional assay." },
    { id: "pm2s", label: "PM2_supporting", direction: "pathogenic", strength: "Supporting", note: "Extremely rare or absent in controls using modern downgraded strength." },
    { id: "pm3", label: "PM3", direction: "pathogenic", strength: "Moderate", note: "Observed in trans with a pathogenic variant in recessive disease." },
    { id: "pm5", label: "PM5", direction: "pathogenic", strength: "Moderate", note: "Novel missense at residue with known pathogenic missense." },
    { id: "pp1", label: "PP1", direction: "pathogenic", strength: "Supporting", note: "Segregation support in informative relatives." },
    { id: "pp3", label: "PP3", direction: "pathogenic", strength: "Supporting", note: "Calibrated computational evidence supports damage." },
    { id: "ba1", label: "BA1", direction: "benign", strength: "Stand-alone", note: "Population frequency incompatible with disease." },
    { id: "bs1", label: "BS1", direction: "benign", strength: "Strong", note: "Frequency greater than expected for disorder." },
    { id: "bs3", label: "BS3", direction: "benign", strength: "Strong", note: "Validated functional study shows no damaging effect." },
    { id: "bp4", label: "BP4", direction: "benign", strength: "Supporting", note: "Computational evidence supports no impact." },
    { id: "bp7", label: "BP7", direction: "benign", strength: "Supporting", note: "Synonymous or splice-reassuring benign support." },
  ];

  const casePresets = {
    lof: ["pvs1", "pm3", "pp1"],
    vus: ["pm2s", "pp3"],
    conflict: ["pm5", "pp3", "bs3"],
    benign: ["bs1", "bp4"],
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderFastqHeaderExplorer() {
    const primary = fastqHeaderParts.slice(0, 7);
    const readMetadata = fastqHeaderParts.slice(7);
    const renderTokenGroup = (parts) =>
      parts
        .map(
          (part, index) => `
            <button
              type="button"
              class="fastq-header-token"
              data-fastq-token="${escapeHtml(part.id)}"
              aria-pressed="false"
            >
              <code>${escapeHtml(part.value)}</code>
              <span>${escapeHtml(part.label)}</span>
            </button>
            ${index < parts.length - 1 ? '<span class="fastq-header-separator" aria-hidden="true">:</span>' : ""}
          `
        )
        .join("");

    return `
      <article class="fastq-header-explorer" data-fastq-header-explorer>
        <div class="fastq-header-heading">
          <div>
            <span>Identifier anatomy</span>
            <h4>Click each FASTQ header field to decode it</h4>
          </div>
          <span class="fastq-format-note">Illumina/CASAVA-style example</span>
        </div>
        <div class="fastq-header-code" aria-label="Annotated FASTQ identifier">
          <div class="fastq-header-token-group">${renderTokenGroup(primary)}</div>
          <span class="fastq-header-space" aria-hidden="true">space</span>
          <div class="fastq-header-token-group">${renderTokenGroup(readMetadata)}</div>
        </div>
        <div class="fastq-header-detail" aria-live="polite">
          <strong data-fastq-detail-label>Instrument ID</strong>
          <code data-fastq-detail-value>@A00519</code>
          <p data-fastq-detail-meaning>The sequencing instrument name. The leading @ marks the FASTQ identifier line.</p>
        </div>
        <div class="fastq-four-line-key" aria-label="Meaning of the four lines in one FASTQ record">
          <span><strong>Line 1</strong> Read identifier and run metadata</span>
          <span><strong>Line 2</strong> Called nucleotide sequence</span>
          <span><strong>Line 3</strong> + separator, optionally repeating the identifier</span>
          <span><strong>Line 4</strong> One encoded Phred quality character per base</span>
        </div>
        <p class="fastq-header-caution">Header conventions vary by platform and conversion software; parse the format actually produced by the instrument pipeline.</p>
      </article>
    `;
  }

  function setupFastqHeaderExplorer(container) {
    const root = container.querySelector("[data-fastq-header-explorer]");
    if (!root) {
      return;
    }

    const label = root.querySelector("[data-fastq-detail-label]");
    const value = root.querySelector("[data-fastq-detail-value]");
    const meaning = root.querySelector("[data-fastq-detail-meaning]");
    const buttons = Array.from(root.querySelectorAll("[data-fastq-token]"));

    function selectPart(id) {
      const part = fastqHeaderParts.find((item) => item.id === id) || fastqHeaderParts[0];
      buttons.forEach((button) => {
        button.setAttribute("aria-pressed", button.dataset.fastqToken === part.id ? "true" : "false");
      });
      label.textContent = part.label;
      value.textContent = part.value;
      meaning.textContent = part.meaning;
    }

    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-fastq-token]");
      if (button) {
        selectPart(button.dataset.fastqToken);
      }
    });
    selectPart(fastqHeaderParts[0].id);
  }

  function qualitySvg(title, content) {
    return `
      <svg viewBox="0 0 840 420" role="img" aria-label="${escapeHtml(title)} teaching diagram">
        <title>${escapeHtml(title)} teaching diagram</title>
        ${content}
      </svg>
    `;
  }

  function qualityRead(x, y, width, extraClass, delay) {
    return `<rect class="qv-read ${extraClass || ""}" x="${x}" y="${y}" width="${width}" height="13" rx="6" style="--delay:${delay || 0}ms" />`;
  }

  function renderCoverageScene() {
    const reads = [
      [92, 68, 190], [150, 88, 205], [225, 108, 170], [92, 128, 230], [265, 148, 125],
      [498, 68, 180], [545, 88, 165], [485, 108, 230], [590, 128, 150], [520, 148, 210],
      [120, 188, 210], [175, 208, 190], [500, 188, 190], [560, 208, 175],
    ];
    return qualitySvg(
      "Coverage breadth",
      `
        <text class="qv-label" x="80" y="38">Reads across the intended target</text>
        ${reads.map((read, index) => qualityRead(read[0], read[1], read[2], "", index * 35)).join("")}
        <line class="qv-reference" x1="80" y1="274" x2="760" y2="274" />
        <text class="qv-label-small" x="80" y="302">target region</text>
        <rect class="qv-covered qv-grow" x="80" y="318" width="338" height="24" rx="8" />
        <rect class="qv-alt qv-grow" x="418" y="318" width="80" height="24" rx="8" />
        <rect class="qv-covered qv-grow" x="498" y="318" width="262" height="24" rx="8" />
        <text class="qv-label-small" x="104" y="373">covered at the stated minimum depth</text>
        <text class="qv-label-small" x="414" y="373">0× dropout</text>
        <text class="qv-label" x="510" y="399">Breadth = horizontal proportion</text>
      `
    );
  }

  function renderDepthScene() {
    const reads = Array.from({ length: 14 }, (_, index) => {
      const x = 150 + (index % 5) * 16;
      const y = 48 + index * 18;
      return qualityRead(x, y, 410 - (index % 4) * 22, index % 4 === 0 ? "qv-read-reverse" : "", index * 28);
    });
    return qualitySvg(
      "Read depth",
      `
        <text class="qv-label" x="74" y="34">Count usable reads vertically at one base</text>
        ${reads.join("")}
        <line class="qv-alt qv-draw" x1="390" y1="38" x2="390" y2="315" />
        <line class="qv-reference" x1="90" y1="330" x2="660" y2="330" />
        <path class="qv-connector qv-draw" d="M692 48 h26 v247 h-26" />
        <text class="qv-label" x="728" y="177">14×</text>
        <text class="qv-label-small" x="676" y="337">depth at this position</text>
        <text class="qv-label-small" x="90" y="370">Depth changes from base to base; it is not one number for the whole gene.</text>
      `
    );
  }

  function renderBaseQualityScene() {
    const bases = "ACCTGAGCTCGA".split("");
    const scores = [39, 38, 37, 36, 35, 34, 33, 32, 31, 28, 17, 9];
    const tiles = bases
      .map((base, index) => {
        const x = 70 + index * 58;
        const tone = scores[index] >= 30 ? "qv-covered" : scores[index] >= 20 ? "qv-warn" : "qv-alt";
        return `
          <g class="qv-grow" style="--delay:${index * 35}ms">
            <rect class="${tone}" x="${x}" y="112" width="46" height="66" rx="9" />
            <text class="qv-label" x="${x + 23}" y="143" text-anchor="middle">${base}</text>
            <text class="qv-label-small" x="${x + 23}" y="165" text-anchor="middle">Q${scores[index]}</text>
          </g>
        `;
      })
      .join("");
    return qualitySvg(
      "Base quality",
      `
        <text class="qv-label" x="70" y="45">Each nucleotide has its own error estimate</text>
        ${tiles}
        <line class="qv-reference" x1="70" y1="216" x2="708" y2="216" />
        <text class="qv-label-small" x="70" y="248">high-confidence bases</text>
        <text class="qv-label-small" x="570" y="248">low-quality tail</text>
        <rect class="qv-soft" x="88" y="286" width="195" height="74" rx="15" />
        <text class="qv-label" x="112" y="316">Q30</text>
        <text class="qv-label-small" x="112" y="342">0.1% estimated error</text>
        <rect class="qv-soft" x="323" y="286" width="195" height="74" rx="15" />
        <text class="qv-label" x="347" y="316">Q20</text>
        <text class="qv-label-small" x="347" y="342">1% estimated error</text>
        <rect class="qv-soft" x="558" y="286" width="195" height="74" rx="15" />
        <text class="qv-label" x="582" y="316">Q10</text>
        <text class="qv-label-small" x="582" y="342">10% estimated error</text>
      `
    );
  }

  function renderMappingQualityScene() {
    return qualitySvg(
      "Mapping quality",
      `
        <text class="qv-label" x="62" y="36">Can the read be placed uniquely?</text>
        <text class="qv-label-small" x="62" y="88">Reference locus</text>
        <line class="qv-reference" x1="190" y1="82" x2="760" y2="82" />
        ${qualityRead(270, 118, 260, "", 0)}
        <line class="qv-connector qv-draw" x1="300" y1="118" x2="300" y2="86" />
        <line class="qv-connector qv-draw" x1="500" y1="118" x2="500" y2="86" />
        <text class="qv-label" x="570" y="139">MAPQ 60</text>
        <text class="qv-label-small" x="570" y="160">highly unique placement</text>

        <text class="qv-label-small" x="62" y="235">Homologous loci</text>
        <line class="qv-reference" x1="190" y1="220" x2="760" y2="220" />
        <line class="qv-reference" x1="190" y1="310" x2="760" y2="310" />
        ${qualityRead(270, 260, 260, "qv-warn", 120)}
        <path class="qv-connector qv-draw" stroke-dasharray="6 6" d="M315 260 Q315 232 340 222" />
        <path class="qv-connector qv-draw" stroke-dasharray="6 6" d="M485 273 Q485 300 510 307" />
        <text class="qv-label" x="570" y="273">MAPQ 0</text>
        <text class="qv-label-small" x="570" y="294">equally plausible placements</text>
        <text class="qv-label-small" x="62" y="380">Mapping quality measures placement uncertainty; base quality measures letter uncertainty.</text>
      `
    );
  }

  function renderAlleleFractionScene() {
    const altRows = new Set([1, 4, 7, 10, 13, 16, 18]);
    const reads = Array.from({ length: 20 }, (_, index) => {
      const y = 40 + index * 16;
      const isAlt = altRows.has(index);
      return `
        ${qualityRead(90 + (index % 4) * 8, y, 440, index % 3 === 0 ? "qv-read-reverse" : "", index * 22)}
        <circle class="${isAlt ? "qv-alt" : "qv-covered"}" cx="330" cy="${y + 6.5}" r="6" />
        <text class="qv-label-small" x="345" y="${y + 11}">${isAlt ? "A" : "G"}</text>
      `;
    });
    return qualitySvg(
      "Allele fraction",
      `
        <text class="qv-label" x="66" y="28">Pileup at one genomic position</text>
        ${reads.join("")}
        <line class="qv-alt qv-draw" x1="330" y1="34" x2="330" y2="360" />
        <rect class="qv-soft" x="590" y="104" width="205" height="145" rx="18" />
        <text class="qv-label" x="617" y="142">7 ALT reads</text>
        <text class="qv-label" x="617" y="177">20 usable reads</text>
        <line class="qv-reference" x1="617" y1="193" x2="765" y2="193" />
        <text class="qv-label" x="617" y="226">VAF = 35%</text>
        <text class="qv-label-small" x="548" y="285">
          <tspan x="548" dy="0">Illustrative count; read filters decide</tspan>
          <tspan x="548" dy="19">which observations are usable.</tspan>
        </text>
      `
    );
  }

  function renderStrandBiasScene() {
    const forward = Array.from({ length: 8 }, (_, index) => {
      const y = 70 + index * 22;
      const isAlt = index < 6;
      return `
        ${qualityRead(120 + (index % 3) * 12, y, 310, "", index * 35)}
        <polygon class="qv-read" points="430,${y} 452,${y + 6.5} 430,${y + 13}" />
        <circle class="${isAlt ? "qv-alt" : "qv-covered"}" cx="300" cy="${y + 6.5}" r="6" />
      `;
    });
    const reverse = Array.from({ length: 8 }, (_, index) => {
      const y = 70 + index * 22;
      return `
        ${qualityRead(500 - (index % 3) * 12, y, 220, "qv-read-reverse", 110 + index * 35)}
        <polygon class="qv-read qv-read-reverse" points="500,${y} 478,${y + 6.5} 500,${y + 13}" />
        <circle class="qv-covered" cx="610" cy="${y + 6.5}" r="6" />
      `;
    });
    return qualitySvg(
      "Strand bias",
      `
        <text class="qv-label" x="80" y="35">Forward-oriented reads</text>
        <text class="qv-label" x="490" y="35">Reverse-oriented reads</text>
        ${forward.join("")}
        ${reverse.join("")}
        <rect class="qv-soft" x="265" y="292" width="310" height="82" rx="16" />
        <text class="qv-label" x="300" y="326">ALT support: forward 6, reverse 0</text>
        <text class="qv-label-small" x="300" y="351">Orientation imbalance requires artifact review.</text>
      `
    );
  }

  function renderContaminationScene() {
    const molecules = Array.from({ length: 30 }, (_, index) => {
      const column = index % 10;
      const row = Math.floor(index / 10);
      const isForeign = [7, 18, 25].includes(index);
      return `
        <g class="qv-grow" style="--delay:${index * 18}ms">
          <circle class="${isForeign ? "qv-alt" : "qv-read"}" cx="${92 + column * 58}" cy="${92 + row * 62}" r="17" />
          <text class="qv-label-small" x="${92 + column * 58}" y="${97 + row * 62}" text-anchor="middle">${isForeign ? "B" : "A"}</text>
        </g>
      `;
    });
    return qualitySvg(
      "Contamination",
      `
        <text class="qv-label" x="70" y="38">Reads expected from sample A</text>
        ${molecules.join("")}
        <rect class="qv-soft" x="110" y="302" width="275" height="70" rx="16" />
        <circle class="qv-read" cx="140" cy="337" r="10" />
        <text class="qv-label-small" x="160" y="342">intended sample</text>
        <rect class="qv-soft" x="420" y="302" width="310" height="70" rx="16" />
        <circle class="qv-alt" cx="450" cy="337" r="10" />
        <text class="qv-label-small" x="470" y="342">foreign DNA signal</text>
        <text class="qv-label-small" x="70" y="384">
          <tspan x="70" dy="0">Mixture is inferred across many loci and sample-fingerprint checks,</tspan>
          <tspan x="70" dy="19">not from one colored read.</tspan>
        </text>
      `
    );
  }

  function renderReferenceBuildScene() {
    return qualitySvg(
      "Reference build",
      `
        <text class="qv-label" x="72" y="42">Same biological locus, different assembly coordinates</text>
        <text class="qv-label" x="72" y="112">GRCh37</text>
        <line class="qv-reference" x1="190" y1="105" x2="760" y2="105" />
        <circle class="qv-alt qv-grow" cx="430" cy="105" r="10" />
        <text class="qv-mono" x="350" y="145">chr7:140,453,136</text>
        <text class="qv-label" x="72" y="265">GRCh38</text>
        <line class="qv-reference" x1="190" y1="258" x2="760" y2="258" />
        <circle class="qv-alt qv-grow" cx="535" cy="258" r="10" />
        <text class="qv-mono" x="455" y="298">chr7:140,753,336</text>
        <path class="qv-connector qv-draw" d="M430 120 C430 185 535 175 535 243" />
        <text class="qv-label-small" x="286" y="184">
          <tspan x="286" dy="0">liftover maps the locus;</tspan>
          <tspan x="286" dy="19">coordinates cannot simply be copied</tspan>
        </text>
        <text class="qv-label-small" x="72" y="382">Illustrative BRAF c.1799 locus, shown with 1-based genomic coordinates.</text>
      `
    );
  }

  function renderTranscriptScene() {
    return qualitySvg(
      "Transcript choice",
      `
        <text class="qv-label" x="65" y="38">One genomic variant</text>
        <line class="qv-reference" x1="70" y1="78" x2="775" y2="78" />
        <line class="qv-alt qv-draw" x1="455" y1="55" x2="455" y2="340" />
        <circle class="qv-alt" cx="455" cy="78" r="9" />

        <text class="qv-label" x="65" y="145">Transcript A</text>
        <line class="qv-reference" x1="190" y1="138" x2="750" y2="138" />
        <rect class="qv-soft" x="230" y="118" width="85" height="40" rx="6" />
        <rect class="qv-covered" x="405" y="118" width="105" height="40" rx="6" />
        <rect class="qv-soft" x="625" y="118" width="80" height="40" rx="6" />
        <text class="qv-label-small" x="410" y="183">variant lies in a coding exon</text>

        <text class="qv-label" x="65" y="260">Transcript B</text>
        <line class="qv-reference" x1="190" y1="253" x2="750" y2="253" />
        <rect class="qv-soft" x="250" y="233" width="70" height="40" rx="6" />
        <rect class="qv-warn" x="420" y="233" width="125" height="40" rx="6" />
        <rect class="qv-soft" x="650" y="233" width="55" height="40" rx="6" />
        <text class="qv-label-small" x="410" y="296">
          <tspan x="410" dy="0">same position can have a different</tspan>
          <tspan x="410" dy="19">transcript consequence</tspan>
        </text>
        <text class="qv-label-small" x="65" y="366">
          <tspan x="65" dy="0">Report transcript accession and version; do not infer consequence</tspan>
          <tspan x="65" dy="19">from genomic position alone.</tspan>
        </text>
      `
    );
  }

  function renderCnvScene() {
    const sampleRatios = [1.02, 0.98, 0.51, 1.01, 0.96];
    const bars = sampleRatios
      .map((ratio, index) => {
        const x = 160 + index * 115;
        const height = ratio * 170;
        const y = 320 - height;
        return `
          <rect class="qv-soft qv-grow" x="${x}" y="150" width="30" height="170" rx="5" />
          <rect class="${index === 2 ? "qv-alt" : "qv-read"} qv-grow" x="${x + 36}" y="${y}" width="30" height="${height}" rx="5" style="--delay:${index * 70}ms" />
          <text class="qv-label-small" x="${x + 33}" y="347" text-anchor="middle">Exon ${index + 1}</text>
        `;
      })
      .join("");
    return qualitySvg(
      "CNV support",
      `
        <text class="qv-label" x="68" y="36">Normalized exon depth compared with controls</text>
        <line class="qv-axis" x1="92" y1="64" x2="92" y2="320" />
        <line class="qv-axis" x1="92" y1="320" x2="755" y2="320" />
        <line class="qv-gridline" x1="92" y1="150" x2="755" y2="150" />
        <text class="qv-label-small" x="52" y="155">1.0</text>
        <text class="qv-label-small" x="52" y="240">0.5</text>
        ${bars}
        <rect class="qv-soft" x="520" y="68" width="26" height="18" rx="4" />
        <text class="qv-label-small" x="554" y="82">control median</text>
        <rect class="qv-read" x="650" y="68" width="26" height="18" rx="4" />
        <text class="qv-label-small" x="684" y="82">sample</text>
        <text class="qv-label" x="262" y="382">
          <tspan x="262" dy="0">Exon 3: approximately 0.5× relative depth</tspan>
          <tspan x="262" dy="23">→ deletion candidate, pending validated review</tspan>
        </text>
      `
    );
  }

  function renderRepeatScene() {
    const normalRepeats = Array.from({ length: 6 }, (_, index) => `<rect class="qv-covered qv-grow" x="${300 + index * 31}" y="92" width="28" height="32" rx="5" style="--delay:${index * 50}ms" />`).join("");
    const expandedRepeats = Array.from({ length: 14 }, (_, index) => `<rect class="qv-alt qv-grow" x="${200 + index * 31}" y="252" width="28" height="32" rx="5" style="--delay:${index * 35}ms" />`).join("");
    return qualitySvg(
      "Repeat expansion visibility",
      `
        <text class="qv-label" x="62" y="42">Repeat shorter than a read</text>
        <line class="qv-reference" x1="80" y1="108" x2="760" y2="108" />
        ${normalRepeats}
        ${qualityRead(205, 62, 420, "qv-read-reverse", 0)}
        <text class="qv-label-small" x="640" y="74">one read spans both flanks</text>

        <text class="qv-label" x="62" y="211">Expansion longer than a short read</text>
        <line class="qv-reference" x1="80" y1="268" x2="760" y2="268" />
        ${expandedRepeats}
        ${qualityRead(80, 303, 205, "", 120)}
        ${qualityRead(555, 303, 205, "qv-read-reverse", 220)}
        <text class="qv-label-small" x="325" y="337">no read spans the full repeat</text>
        <text class="qv-label-small" x="62" y="377">
          <tspan x="62" dy="0">Specialized callers or orthogonal assays may be required</tspan>
          <tspan x="62" dy="19">for validated detection and sizing.</tspan>
        </text>
      `
    );
  }

  function renderMtdnaScene() {
    const molecules = Array.from({ length: 20 }, (_, index) => {
      const x = 95 + (index % 5) * 105;
      const y = 90 + Math.floor(index / 5) * 75;
      const isVariant = [2, 7, 11, 18].includes(index);
      return `
        <g class="qv-grow" style="--delay:${index * 28}ms">
          <circle class="qv-ring ${isVariant ? "qv-ring-alt" : ""}" cx="${x}" cy="${y}" r="24" />
          <circle class="${isVariant ? "qv-alt" : "qv-covered"}" cx="${x + 17}" cy="${y - 17}" r="5" />
        </g>
      `;
    });
    return qualitySvg(
      "mtDNA heteroplasmy",
      `
        <text class="qv-label" x="58" y="38">Mixture of mitochondrial DNA molecules in this sample</text>
        ${molecules.join("")}
        <rect class="qv-soft" x="640" y="95" width="150" height="160" rx="18" />
        <text class="qv-label" x="665" y="135">4 variant</text>
        <text class="qv-label" x="665" y="171">20 total</text>
        <line class="qv-reference" x1="665" y1="188" x2="760" y2="188" />
        <text class="qv-label" x="665" y="224">20%</text>
        <text class="qv-label-small" x="602" y="306">fraction in the sampled tissue</text>
        <text class="qv-label-small" x="58" y="382">
          <tspan x="58" dy="0">A heteroplasmy fraction can differ across tissues, time,</tspan>
          <tspan x="58" dy="19">extraction, and assay sensitivity.</tspan>
        </text>
      `
    );
  }

  function renderQualityMetricScene(metricId) {
    const renderers = {
      coverage: renderCoverageScene,
      depth: renderDepthScene,
      "base-quality": renderBaseQualityScene,
      "mapping-quality": renderMappingQualityScene,
      "allele-fraction": renderAlleleFractionScene,
      "strand-bias": renderStrandBiasScene,
      contamination: renderContaminationScene,
      "reference-build": renderReferenceBuildScene,
      "transcript-choice": renderTranscriptScene,
      "cnv-support": renderCnvScene,
      "repeat-expansion": renderRepeatScene,
      mtdna: renderMtdnaScene,
    };
    return (renderers[metricId] || renderCoverageScene)();
  }

  function setupQualityMetricsExplorer() {
    const root = document.querySelector("[data-quality-explorer]");
    if (!root) {
      return;
    }

    const figure = root.closest(".figure-card");
    const buttons = Array.from(figure.querySelectorAll("[data-quality-metric]"));
    const title = root.querySelector("#quality-metric-title");
    const progress = root.querySelector("#quality-metric-progress");
    const scene = root.querySelector("#quality-metric-scene");
    const definition = root.querySelector("#quality-metric-definition");
    const clinical = root.querySelector("#quality-metric-clinical");
    const playButton = root.querySelector("[data-quality-play]");
    let activeIndex = 0;
    let timer = null;

    function render(index) {
      activeIndex = (index + qualityMetrics.length) % qualityMetrics.length;
      const metric = qualityMetrics[activeIndex];
      title.textContent = metric.title;
      progress.textContent = `${activeIndex + 1} of ${qualityMetrics.length}`;
      definition.textContent = metric.definition;
      clinical.textContent = metric.clinical;
      scene.innerHTML = renderQualityMetricScene(metric.id);
      scene.setAttribute("aria-label", `${metric.title} teaching diagram. ${metric.definition}`);
      buttons.forEach((button) => {
        button.setAttribute("aria-pressed", button.dataset.qualityMetric === metric.id ? "true" : "false");
      });
    }

    function stopPlayback() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
      playButton.setAttribute("aria-pressed", "false");
      playButton.textContent = "Play walkthrough";
    }

    function startPlayback() {
      stopPlayback();
      playButton.setAttribute("aria-pressed", "true");
      playButton.textContent = "Pause walkthrough";
      timer = window.setInterval(() => render(activeIndex + 1), 4800);
    }

    figure.addEventListener("click", (event) => {
      const metricButton = event.target.closest("[data-quality-metric]");
      if (metricButton) {
        stopPlayback();
        render(qualityMetrics.findIndex((metric) => metric.id === metricButton.dataset.qualityMetric));
      }
    });

    playButton.addEventListener("click", () => {
      if (timer) {
        stopPlayback();
      } else {
        startPlayback();
      }
    });

    render(0);
  }

  function workflowPhaseForStage(stageId) {
    const phaseId = workflowPhaseByStage[stageId] || "tertiary";
    return workflowPhases.find((phase) => phase.id === phaseId) || workflowPhases[0];
  }

  function renderWorkflowStageVisual(stage) {
    const flowCellClusters = Array.from({ length: 35 }, (_, index) => {
      const baseClass = ["base-a", "base-c", "base-g", "base-t"][index % 4];
      return `<span class="${baseClass}" style="--cluster-delay:${index % 7}"></span>`;
    }).join("");
    const alignmentReads = Array.from({ length: 9 }, (_, index) => {
      const variant = index === 2 || index === 4 || index === 7;
      return `
        <span class="${variant ? "has-variant" : ""}" style="--read-offset:${8 + (index % 5) * 9}%">
          ${variant ? "<i></i>" : ""}
        </span>
      `;
    }).join("");
    const callingReads = Array.from({ length: 7 }, (_, index) => `
      <span class="${index === 1 || index === 3 || index === 5 ? "has-variant" : ""}">
        <i>${index === 1 || index === 3 || index === 5 ? "A" : "G"}</i>
      </span>
    `).join("");

    const visualByStage = {
      accession: `
        <div class="journey-scene accession-scene">
          <div class="specimen-vial">
            <span class="vial-cap"></span>
            <span class="vial-sample"></span>
            <small>EDTA blood</small>
          </div>
          <div class="accession-scanner">
            <span class="scanner-beam"></span>
            <strong>Identity check</strong>
            <small>2 identifiers + requisition</small>
          </div>
          <div class="journey-transfer-arrow" aria-hidden="true"></div>
          <div class="lims-record">
            <span class="lims-barcode"></span>
            <strong>WAHJ-2026-0017</strong>
            <small><i></i> Specimen accepted</small>
            <small><i></i> Assay matched</small>
            <small><i></i> Chain recorded</small>
          </div>
        </div>
      `,
      extraction: `
        <div class="journey-scene extraction-scene">
          <div class="extraction-tube">
            <span class="tube-pellet"></span>
            <small>Cells</small>
          </div>
          <div class="dna-release" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
          <div class="qc-gauge-stack">
            <div><span>Yield</span><i style="--qc-value:82%"></i><strong>1.62 ug</strong></div>
            <div><span>Purity</span><i style="--qc-value:76%"></i><strong>1.86</strong></div>
            <div><span>Integrity</span><i style="--qc-value:88%"></i><strong>DIN 8.7</strong></div>
          </div>
        </div>
      `,
      library: `
        <div class="journey-scene library-scene">
          <div class="library-step">
            <span class="long-dna"></span>
            <small>Genomic DNA</small>
          </div>
          <div class="journey-transfer-arrow" aria-hidden="true"></div>
          <div class="fragment-cloud">
            <span></span><span></span><span></span><span></span><span></span>
            <small>Fragment / capture</small>
          </div>
          <div class="journey-transfer-arrow" aria-hidden="true"></div>
          <div class="indexed-library">
            <span><i></i><b></b></span>
            <span><i></i><b></b></span>
            <span><i></i><b></b></span>
            <small>Adapters + i7/i5 indexes</small>
          </div>
        </div>
      `,
      sequencing: `
        <div class="journey-scene sequencing-scene">
          <div class="flow-cell">
            <div class="flow-cell-grid">${flowCellClusters}</div>
            <small>Clonal clusters on flow cell</small>
          </div>
          <div class="cycle-reader">
            <div class="cycle-laser"></div>
            <div class="base-calls">
              <span class="base-a">A</span>
              <span class="base-c">C</span>
              <span class="base-g">G</span>
              <span class="base-t">T</span>
            </div>
            <strong>Cycle-by-cycle signal</strong>
            <small>Read 1 -> indexes -> Read 2</small>
          </div>
        </div>
      `,
      "primary-analysis": `
        <div class="journey-scene primary-scene">
          <div class="bcl-tile">
            <span class="base-a"></span><span class="base-c"></span><span class="base-g"></span>
            <span class="base-t"></span><span class="base-g"></span><span class="base-a"></span>
            <span class="base-c"></span><span class="base-t"></span><span class="base-a"></span>
            <small>Cycle signal / BCL</small>
          </div>
          <div class="primary-converter">
            <span>Base calling</span>
            <i></i>
            <span>Demultiplexing</span>
          </div>
          <div class="fastq-file-card">
            <strong>WAHJ-0017_R1.fastq.gz</strong>
            <code>@read_001</code>
            <code>ACCTGAGCTC...</code>
            <code>FFFFFFFFFF...</code>
          </div>
        </div>
      `,
      fastq: `
        <div class="journey-scene fastq-scene">
          <div class="fastq-read-stack">
            <span>R1</span><span>R2</span><span>R1</span><span>R2</span>
            <small>Sequence + Phred quality</small>
          </div>
          <div class="quality-chart">
            <i class="quality-zone"></i>
            <svg viewBox="0 0 260 100" aria-hidden="true">
              <path d="M8 24 C55 22, 95 26, 138 30 S210 43, 252 71" fill="none" stroke="#2f95b8" stroke-width="6" stroke-linecap="round"></path>
              <line x1="8" y1="62" x2="252" y2="62" stroke="#c96a58" stroke-width="2" stroke-dasharray="5 5"></line>
            </svg>
            <small>Per-cycle quality</small>
          </div>
          <div class="trimmed-output">
            <strong>35M</strong>
            <span>raw pairs</span>
            <i></i>
            <strong>33.8M</strong>
            <span>retained</span>
          </div>
        </div>
      `,
      alignment: `
        <div class="journey-scene alignment-scene">
          <div class="reference-ruler">
            <span>GRCh38 reference</span>
            <i></i>
          </div>
          <div class="alignment-read-stack">${alignmentReads}</div>
          <div class="alignment-output">
            <strong>BAM</strong>
            <small>coordinates + MAPQ + CIGAR</small>
          </div>
        </div>
      `,
      calling: `
        <div class="journey-scene calling-scene">
          <div class="mini-pileup">
            <strong>Reference G</strong>
            ${callingReads}
          </div>
          <div class="journey-transfer-arrow" aria-hidden="true"></div>
          <div class="vcf-card">
            <span>CHROM POS REF ALT QUAL</span>
            <strong>chr7 117199646 G A 412.7</strong>
            <small>Candidate call, not interpretation</small>
          </div>
        </div>
      `,
      annotation: `
        <div class="journey-scene annotation-scene">
          <div class="bare-variant">
            <span>chr7</span><span>G</span><span>A</span>
            <small>Technical call</small>
          </div>
          <div class="annotation-lines" aria-hidden="true"></div>
          <div class="annotation-record">
            <strong>CFTR / NM_000492.4</strong>
            <span>coding consequence</span>
            <span>population frequency</span>
            <span>ClinVar review status</span>
            <span>transcript version</span>
          </div>
        </div>
      `,
      prioritization: `
        <div class="journey-scene prioritization-scene">
          <div class="candidate-funnel">
            <span><strong>4,200</strong> annotated</span>
            <span><strong>340</strong> rare + coding</span>
            <span><strong>76</strong> disease genes</span>
            <span><strong>28</strong> expert review</span>
          </div>
          <div class="phenotype-orbit">
            <strong>Phenotype</strong>
            <span>inheritance</span>
            <span>mechanism</span>
            <span>assay scope</span>
          </div>
        </div>
      `,
      classification: `
        <div class="journey-scene classification-scene">
          <div class="evidence-stack evidence-pathogenic">
            <span>Population</span><span>Functional</span><span>Segregation</span>
          </div>
          <div class="evidence-scale">
            <i></i>
            <strong>Evidence integration</strong>
            <small>Gene/disease-specific rules</small>
          </div>
          <div class="evidence-stack evidence-benign">
            <span>Frequency</span><span>Functional</span><span>Clinical</span>
          </div>
          <div class="class-output">
            <span>B</span><span>LB</span><span class="is-active">VUS</span><span>LP</span><span>P</span>
          </div>
        </div>
      `,
      report: `
        <div class="journey-scene report-scene">
          <div class="report-document">
            <span class="report-logo"></span>
            <strong>Clinical molecular report</strong>
            <div><b>Finding</b><i></i><i></i></div>
            <div><b>Interpretation</b><i></i><i></i><i></i></div>
            <div><b>Limitations</b><i></i><i></i></div>
            <small>Electronically reviewed and signed</small>
          </div>
          <div class="report-audience">
            <span>Clinician</span>
            <span>Patient</span>
            <span>Laboratory record</span>
          </div>
        </div>
      `,
    };

    return `
      <figure
        class="workflow-visual-card workflow-visual-${escapeHtml(stage.id)}"
        role="img"
        aria-label="Educational schematic for ${escapeHtml(stage.label)}"
      >
        ${visualByStage[stage.id] || visualByStage.fastq}
        <figcaption>Educational schematic; exact instruments, metrics, and thresholds are assay-specific.</figcaption>
      </figure>
    `;
  }

  function renderWorkflowExplorer() {
    const root = document.querySelector("[data-workflow-explorer]");
    if (!root) {
      return;
    }

    const phaseMap = root.querySelector("[data-workflow-phase-map]");
    const buttonRow = root.querySelector(".workflow-stage-list");
    const panel = root.querySelector("[data-workflow-panel]");
    if (!phaseMap || !buttonRow || !panel) {
      return;
    }

    let activeId = workflowStages[0].id;

    function renderPanel(stage) {
      const stageIndex = workflowStages.findIndex((item) => item.id === stage.id);
      const phase = workflowPhaseForStage(stage.id);
      const previousStage = workflowStages[Math.max(0, stageIndex - 1)];
      const nextStage = workflowStages[Math.min(workflowStages.length - 1, stageIndex + 1)];
      const progress = ((stageIndex + 1) / workflowStages.length) * 100;
      panel.innerHTML = `
        <div class="workflow-panel-heading">
          <div>
            <span class="workflow-phase-chip phase-${escapeHtml(phase.id)}">${escapeHtml(phase.label)}</span>
            <span class="workflow-stage-counter">Stage ${stageIndex + 1} of ${workflowStages.length}</span>
            <h3>${escapeHtml(stage.label)}</h3>
            <p>${escapeHtml(stage.question)}</p>
          </div>
          <div class="workflow-progress" style="--journey-progress:${progress.toFixed(2)}%">
            <span></span>
            <small>${Math.round(progress)}% of the journey</small>
          </div>
        </div>
        ${renderWorkflowStageVisual(stage)}
        <div class="workflow-stage-kpis">
          <article>
            <span>Checkpoint record / file</span>
            <strong>${escapeHtml(stage.fileType)}</strong>
          </article>
          <article>
            <span>Illustrative scale</span>
            <strong>${escapeHtml(stage.count)}</strong>
          </article>
          <article>
            <span>Doctor-facing meaning</span>
            <strong>${escapeHtml(stage.doctorWhy)}</strong>
          </article>
        </div>
        <div class="workflow-stage-grid">
          <article>
            <h4>Input</h4>
            <p>${escapeHtml(stage.input)}</p>
          </article>
          <article>
            <h4>Process</h4>
            <p>${escapeHtml(stage.process)}</p>
          </article>
          <article>
            <h4>Output</h4>
            <p>${escapeHtml(stage.output)}</p>
          </article>
          <article>
            <h4>Typical tools</h4>
            <p>${escapeHtml(stage.tools.join(", "))}</p>
          </article>
          <article>
            <h4>Key metrics</h4>
            <ul class="acmg-checklist">
              ${stage.metrics.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </article>
          <article>
            <h4>Failure modes</h4>
            <ul class="acmg-checklist">
              ${stage.failureModes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </article>
        </div>
        <div class="workflow-stage-grid">
          <article>
            <h4>${escapeHtml(stage.snippetLabel)}</h4>
            <pre class="acmg-command-block"><code>${escapeHtml(stage.snippet)}</code></pre>
          </article>
          ${stage.id === "fastq" ? renderFastqHeaderExplorer() : ""}
          <article>
            <h4>Clinical reading point</h4>
            <p>${escapeHtml(stage.doctorWhy)}</p>
          </article>
        </div>
        <div class="workflow-panel-navigation" aria-label="Move through the workflow">
          <button
            type="button"
            data-workflow-move="${escapeHtml(previousStage.id)}"
            ${stageIndex === 0 ? "disabled" : ""}
          >
            <span>Previous</span>
            <strong>${stageIndex === 0 ? "Start of journey" : escapeHtml(previousStage.label)}</strong>
          </button>
          <button
            type="button"
            data-workflow-move="${escapeHtml(nextStage.id)}"
            ${stageIndex === workflowStages.length - 1 ? "disabled" : ""}
          >
            <span>Next</span>
            <strong>${stageIndex === workflowStages.length - 1 ? "Signed report reached" : escapeHtml(nextStage.label)}</strong>
          </button>
        </div>
      `;
      setupFastqHeaderExplorer(panel);
    }

    function activate(id) {
      const stage = workflowStages.find((item) => item.id === id) || workflowStages[0];
      activeId = stage.id;
      Array.from(buttonRow.querySelectorAll("button")).forEach((button) => {
        const isActive = button.dataset.stageId === activeId;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
        button.tabIndex = isActive ? 0 : -1;
      });
      Array.from(phaseMap.querySelectorAll("button")).forEach((button) => {
        const isActive = button.dataset.phaseId === workflowPhaseByStage[activeId];
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-current", isActive ? "step" : "false");
      });
      renderPanel(stage);
    }

    phaseMap.innerHTML = workflowPhases
      .map(
        (phase, index) => `
          <button
            type="button"
            data-phase-id="${escapeHtml(phase.id)}"
            data-phase-target="${escapeHtml(phase.firstStage)}"
            aria-current="false"
          >
            <span>Phase ${index + 1}</span>
            <strong>${escapeHtml(phase.label)}</strong>
            <small>${escapeHtml(phase.range)} · ${escapeHtml(phase.description)}</small>
          </button>
        `
      )
      .join("");

    buttonRow.innerHTML = workflowStages
      .map(
        (stage, index) => {
          const phase = workflowPhaseForStage(stage.id);
          return `
          <button
            type="button"
            data-stage-id="${escapeHtml(stage.id)}"
            class="stage-phase-${escapeHtml(phase.id)}"
            role="tab"
            aria-controls="workflow-stage-detail"
            aria-selected="false"
          >
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(stage.label)}</strong>
            <small>${escapeHtml(stage.fileType)}</small>
          </button>
        `;
        }
      )
      .join("");

    root.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-stage-id]");
      if (button) {
        activate(button.dataset.stageId);
        return;
      }
      const phaseButton = event.target.closest("button[data-phase-target]");
      if (phaseButton) {
        activate(phaseButton.dataset.phaseTarget);
        return;
      }
      const moveButton = event.target.closest("button[data-workflow-move]");
      if (moveButton && !moveButton.disabled) {
        activate(moveButton.dataset.workflowMove);
      }
    });

    buttonRow.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      const currentIndex = workflowStages.findIndex((stage) => stage.id === activeId);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + direction + workflowStages.length) % workflowStages.length;
      event.preventDefault();
      activate(workflowStages[nextIndex].id);
      buttonRow.querySelector(`[data-stage-id="${workflowStages[nextIndex].id}"]`)?.focus();
    });

    panel.id = "workflow-stage-detail";
    activate(activeId);
  }

  function renderOrganizations() {
    const root = document.querySelector("[data-organization-explorer]");
    if (!root) {
      return;
    }

    const buttonRow = root.querySelector(".organization-button-row");
    const panel = root.querySelector("[data-organization-panel]");
    if (!buttonRow || !panel) {
      return;
    }

    function renderPanel(item) {
      panel.innerHTML = `
        <h3>${escapeHtml(item.label)}: ${escapeHtml(item.fullName)}</h3>
        <p>${escapeHtml(item.role)}</p>
        <div class="organization-panel-meta">
          <article>
            <h4>Why it matters here</h4>
            <p>${escapeHtml(item.why)}</p>
          </article>
          <article>
            <h4>What it is not</h4>
            <p>${escapeHtml(item.not)}</p>
          </article>
        </div>
        <div class="organization-panel-docs">
          <h4>Key outputs or responsibilities</h4>
          <ul>
            ${item.documents.map((doc) => `<li>${escapeHtml(doc)}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    buttonRow.innerHTML = organizations
      .map(
        (item, index) => `
          <button
            type="button"
            data-organization-id="${escapeHtml(item.id)}"
            class="${index === 0 ? "is-active" : ""}"
            aria-selected="${index === 0 ? "true" : "false"}"
          >
            ${escapeHtml(item.label)}
          </button>
        `
      )
      .join("");

    buttonRow.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-organization-id]");
      if (!button) {
        return;
      }
      const item = organizations.find((entry) => entry.id === button.dataset.organizationId) || organizations[0];
      Array.from(buttonRow.querySelectorAll("button")).forEach((current) => {
        const isActive = current === button;
        current.classList.toggle("is-active", isActive);
        current.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      renderPanel(item);
    });

    renderPanel(organizations[0]);
  }

  function renderCriteriaExplorer() {
    const results = document.querySelector("#criteria-results");
    const search = document.querySelector("#criteria-search");
    const direction = document.querySelector("#criteria-direction");
    const strength = document.querySelector("#criteria-strength");
    const status = document.querySelector("#criteria-status");

    if (!results || !search || !direction || !strength || !status) {
      return;
    }

    function matches(item) {
      const searchValue = search.value.trim().toLowerCase();
      const directionValue = direction.value;
      const strengthValue = strength.value;
      const haystack = [
        item.code,
        item.title,
        item.definition,
        item.requiredData,
        item.example,
        item.misuse,
        item.update,
      ]
        .join(" ")
        .toLowerCase();

      if (searchValue && !haystack.includes(searchValue)) {
        return false;
      }
      if (directionValue !== "all" && item.direction !== directionValue) {
        return false;
      }
      if (strengthValue !== "all" && item.strength !== strengthValue) {
        return false;
      }
      return true;
    }

    function render() {
      const filtered = criteria.filter(matches);
      status.textContent = `${filtered.length} criteria shown`;
      if (!filtered.length) {
        results.innerHTML = `
          <article class="criteria-card">
            <h3>No criteria matched the current filters</h3>
            <p class="criteria-definition">Try a code such as PVS1, PM2, BS3, segregation, or splicing.</p>
          </article>
        `;
        return;
      }

      results.innerHTML = filtered
        .map(
          (item) => `
            <article class="criteria-card">
              <div class="criteria-card-header">
                <span class="criteria-code">${escapeHtml(item.code)}</span>
                <div class="criteria-tags">
                  <span class="criteria-tag direction-${escapeHtml(item.direction)}">${escapeHtml(
                    item.direction
                  )}</span>
                  <span class="criteria-tag">${escapeHtml(item.strength)}</span>
                </div>
              </div>
              <h3>${escapeHtml(item.title)}</h3>
              <p class="criteria-definition">${escapeHtml(item.definition)}</p>
              <details ${item.code === "PVS1" || item.code === "PM2" || item.code === "PP5" ? "open" : ""}>
                <summary>Required data, example, misuse, and current caution</summary>
                <dl>
                  <div>
                    <dt>Required data</dt>
                    <dd>${escapeHtml(item.requiredData)}</dd>
                  </div>
                  <div>
                    <dt>Clinical example</dt>
                    <dd>${escapeHtml(item.example)}</dd>
                  </div>
                  <div>
                    <dt>Common misuse</dt>
                    <dd>${escapeHtml(item.misuse)}</dd>
                  </div>
                  <div>
                    <dt>Current ClinGen-era caution</dt>
                    <dd>${escapeHtml(item.update)}</dd>
                  </div>
                  <div>
                    <dt>Can strength change?</dt>
                    <dd>${escapeHtml(item.adjustable)}</dd>
                  </div>
                  <div>
                    <dt>Need gene-specific review?</dt>
                    <dd>${escapeHtml(item.geneSpecific)}</dd>
                  </div>
                </dl>
              </details>
            </article>
          `
        )
        .join("");
    }

    search.addEventListener("input", render);
    direction.addEventListener("change", render);
    strength.addEventListener("change", render);
    render();
  }

  function evaluateCaseEvidence(selectedIds) {
    const selected = caseEvidenceOptions.filter((item) => selectedIds.includes(item.id));
    const counts = {
      pathogenic: { veryStrong: 0, strong: 0, moderate: 0, supporting: 0 },
      benign: { standAlone: 0, strong: 0, supporting: 0 },
    };

    selected.forEach((item) => {
      if (item.direction === "pathogenic") {
        if (item.strength === "Very strong") counts.pathogenic.veryStrong += 1;
        if (item.strength === "Strong") counts.pathogenic.strong += 1;
        if (item.strength === "Moderate") counts.pathogenic.moderate += 1;
        if (item.strength === "Supporting") counts.pathogenic.supporting += 1;
      } else {
        if (item.strength === "Stand-alone") counts.benign.standAlone += 1;
        if (item.strength === "Strong") counts.benign.strong += 1;
        if (item.strength === "Supporting") counts.benign.supporting += 1;
      }
    });

    const pvs = counts.pathogenic.veryStrong;
    const ps = counts.pathogenic.strong;
    const pm = counts.pathogenic.moderate;
    const pp = counts.pathogenic.supporting;
    const ba = counts.benign.standAlone;
    const bs = counts.benign.strong;
    const bp = counts.benign.supporting;
    const hasPathogenicEvidence = pvs + ps + pm + pp > 0;
    const hasBenignEvidence = ba + bs + bp > 0;

    if (!selected.length) {
      return {
        classification: "No case built yet",
        tone: "neutral",
        rule: "Select one or more evidence cards to see how the framework combines them.",
      };
    }

    if (hasPathogenicEvidence && hasBenignEvidence) {
      return {
        classification: "VUS",
        tone: "vus",
        rule:
          "Conflicting benign and pathogenic-direction evidence is present, so the case remains uncertain until the conflict is resolved.",
      };
    }

    if (ba >= 1 || bs >= 2) {
      return {
        classification: "Benign",
        tone: "benign",
        rule: "Original 2015 benign rule met: 1 stand-alone benign criterion or at least 2 strong benign criteria.",
      };
    }

    if ((bs >= 1 && bp >= 1) || bp >= 2) {
      return {
        classification: "Likely benign",
        tone: "likely-benign",
        rule: "Original 2015 likely benign rule met: 1 strong benign plus 1 supporting benign, or at least 2 supporting benign criteria.",
      };
    }

    const pathogenicMet =
      (pvs >= 1 && (ps >= 1 || pm >= 2 || (pm >= 1 && pp >= 1) || pp >= 2)) ||
      ps >= 2 ||
      (ps >= 1 && pm >= 3) ||
      (ps >= 1 && pm >= 2 && pp >= 2) ||
      (ps >= 1 && pm >= 1 && pp >= 4);

    if (pathogenicMet) {
      return {
        classification: "Pathogenic",
        tone: "pathogenic",
        rule: "Original 2015 pathogenic combination rule met.",
      };
    }

    const likelyPathogenicMet =
      (pvs >= 1 && pm >= 1) ||
      (ps >= 1 && (pm === 1 || pm === 2)) ||
      (ps >= 1 && pp >= 2) ||
      pm >= 3 ||
      (pm >= 2 && pp >= 2) ||
      (pm >= 1 && pp >= 4);

    if (likelyPathogenicMet) {
      return {
        classification: "Likely pathogenic",
        tone: "likely-pathogenic",
        rule: "Original 2015 likely pathogenic combination rule met.",
      };
    }

    return {
      classification: "VUS",
      tone: "vus",
      rule:
        "Evidence is present but does not satisfy a complete original benign or pathogenic rule. This remains a variant of uncertain significance.",
    };
  }

  function setupCaseBuilder() {
    const root = document.querySelector("[data-case-builder]");
    if (!root) {
      return;
    }

    const grid = root.querySelector("#case-evidence-grid");
    const result = root.querySelector("#case-builder-result");
    const presetButtons = Array.from(root.querySelectorAll("[data-case-preset]"));
    if (!grid || !result) {
      return;
    }

    grid.innerHTML = caseEvidenceOptions
      .map(
        (item) => `
          <label class="case-evidence-option">
            <input type="checkbox" value="${escapeHtml(item.id)}" />
            <span class="case-evidence-code">${escapeHtml(item.label)}</span>
            <span class="case-evidence-strength">${escapeHtml(item.strength)}</span>
            <small>${escapeHtml(item.note)}</small>
          </label>
        `
      )
      .join("");

    const checkboxes = Array.from(grid.querySelectorAll("input[type='checkbox']"));

    function render() {
      const selectedIds = checkboxes.filter((input) => input.checked).map((input) => input.value);
      const selected = caseEvidenceOptions.filter((item) => selectedIds.includes(item.id));
      const evaluation = evaluateCaseEvidence(selectedIds);
      const summary = {
        pathogenic: { veryStrong: 0, strong: 0, moderate: 0, supporting: 0 },
        benign: { standAlone: 0, strong: 0, supporting: 0 },
      };

      selected.forEach((item) => {
        if (item.direction === "pathogenic") {
          if (item.strength === "Very strong") summary.pathogenic.veryStrong += 1;
          if (item.strength === "Strong") summary.pathogenic.strong += 1;
          if (item.strength === "Moderate") summary.pathogenic.moderate += 1;
          if (item.strength === "Supporting") summary.pathogenic.supporting += 1;
        } else {
          if (item.strength === "Stand-alone") summary.benign.standAlone += 1;
          if (item.strength === "Strong") summary.benign.strong += 1;
          if (item.strength === "Supporting") summary.benign.supporting += 1;
        }
      });

      result.innerHTML = `
        <span class="case-result-badge tone-${escapeHtml(evaluation.tone)}">${escapeHtml(
          evaluation.classification
        )}</span>
        <h3>${escapeHtml(evaluation.rule)}</h3>
        <div class="acmg-two-up">
          <article class="summary-card">
            <h4>Selected evidence</h4>
            ${
              selected.length
                ? `<ul class="acmg-checklist">${selected
                    .map(
                      (item) =>
                        `<li><strong>${escapeHtml(item.label)}</strong> — ${escapeHtml(item.note)}</li>`
                    )
                    .join("")}</ul>`
                : "<p>No evidence cards selected yet.</p>"
            }
          </article>
          <article class="summary-card">
            <h4>Strength summary</h4>
            <ul class="acmg-checklist">
              <li>Pathogenic: VS ${summary.pathogenic.veryStrong}, S ${summary.pathogenic.strong}, M ${summary.pathogenic.moderate}, P ${summary.pathogenic.supporting}</li>
              <li>Benign: BA ${summary.benign.standAlone}, BS ${summary.benign.strong}, BP ${summary.benign.supporting}</li>
            </ul>
            <p class="terminal-disclaimer">
              Educational support only. Real classification still depends on disease mechanism,
              transcript choice, phenotype fit, laboratory validation, and current ClinGen
              specifications.
            </p>
          </article>
        </div>
      `;
    }

    checkboxes.forEach((checkbox) => checkbox.addEventListener("change", render));
    presetButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const preset = casePresets[button.dataset.casePreset] || [];
        checkboxes.forEach((checkbox) => {
          checkbox.checked = preset.includes(checkbox.value);
        });
        render();
      });
    });

    render();
  }

  function setupPvs1Lab() {
    const mechanism = document.querySelector("#pvs1-mechanism");
    const transcript = document.querySelector("#pvs1-transcript");
    const consequence = document.querySelector("#pvs1-consequence");
    const result = document.querySelector("#pvs1-result");

    if (!mechanism || !transcript || !consequence || !result) {
      return;
    }

    function render() {
      let score = "Do not apply PVS1";
      let explanation = "Loss-of-function logic is not justified yet.";
      let bullets = [];

      if (mechanism.value === "no") {
        bullets = [
          "If loss of function is not a known disease mechanism, a null-looking variant is not automatically pathogenic.",
          "Consider whether another framework or another type of evidence fits better.",
        ];
      } else if (transcript.value === "no") {
        bullets = [
          "A biologically irrelevant or uncertain transcript can invalidate what looked like a strong null-variant argument.",
          "Always document which transcript was used in the report or annotation workflow.",
        ];
      } else {
        switch (consequence.value) {
          case "nmd":
            score = "PVS1 Very Strong";
            explanation = "The variant is consistent with a true loss-of-function event in the clinically relevant transcript.";
            bullets = [
              "This is the classic setting for strong PVS1 use: correct mechanism, relevant transcript, and likely nonsense-mediated decay.",
              "Even here, laboratory quality and phenotype relevance still matter.",
            ];
            break;
          case "critical":
            score = "PVS1 Strong";
            explanation = "The variant may escape NMD but still removes a region known to be critical to function.";
            bullets = [
              "Current ClinGen logic often downgrades from Very Strong when the consequence is less definitive than classic NMD-driven loss.",
              "Domain-level and transcript-level evidence become especially important.",
            ];
            break;
          case "uncertain":
            score = "PVS1 Moderate or needs review";
            explanation = "The biology suggests possible loss of function, but the confidence is not strong enough for automatic Very Strong use.";
            bullets = [
              "Examples include partial exon effects, uncertain rescue transcripts, or unclear importance of the lost region.",
              "Gene-specific specifications should be checked before assigning a final strength.",
            ];
            break;
          case "intact":
            score = "Do not apply PVS1";
            explanation = "Predicted exon skipping that leaves most of the protein intact may not support a loss-of-function conclusion.";
            bullets = [
              "This type of variant may need other evidence such as splicing studies, PM4 logic, or disease-specific review.",
              "Avoid turning a transcript prediction into a strong pathogenic claim too early.",
            ];
            break;
          default:
            break;
        }
      }

      result.innerHTML = `
        <span class="pvs1-score">${escapeHtml(score)}</span>
        <h3>${escapeHtml(explanation)}</h3>
        <ul class="acmg-checklist">
          ${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
        </ul>
      `;
    }

    mechanism.addEventListener("change", render);
    transcript.addEventListener("change", render);
    consequence.addEventListener("change", render);
    render();
  }

  function renderCommandConcepts() {
    const root = document.querySelector("[data-command-concepts]");
    if (!root) {
      return;
    }

    const buttonRow = root.querySelector(".command-concept-buttons");
    const panel = root.querySelector("[data-command-concept-panel]");
    if (!buttonRow || !panel) {
      return;
    }

    function renderPanel(item) {
      panel.innerHTML = `
        <h3>${escapeHtml(item.title)}</h3>
        <div class="workflow-stage-grid">
          <article>
            <h4>What it means</h4>
            <p>${escapeHtml(item.what)}</p>
          </article>
          <article>
            <h4>Why a doctor should care</h4>
            <p>${escapeHtml(item.why)}</p>
          </article>
        </div>
        <article class="summary-card command-example-card">
          <h4>Example</h4>
          <pre class="acmg-command-block"><code>${escapeHtml(item.example)}</code></pre>
          <p class="terminal-disclaimer">${escapeHtml(item.caution)}</p>
        </article>
      `;
    }

    buttonRow.innerHTML = commandConcepts
      .map(
        (item, index) => `
          <button
            type="button"
            data-command-concept-id="${escapeHtml(item.id)}"
            class="${index === 0 ? "is-active" : ""}"
            aria-selected="${index === 0 ? "true" : "false"}"
          >
            ${escapeHtml(item.label)}
          </button>
        `
      )
      .join("");

    buttonRow.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-command-concept-id]");
      if (!button) {
        return;
      }
      const item =
        commandConcepts.find((entry) => entry.id === button.dataset.commandConceptId) ||
        commandConcepts[0];
      Array.from(buttonRow.querySelectorAll("button")).forEach((current) => {
        const isActive = current === button;
        current.classList.toggle("is-active", isActive);
        current.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      renderPanel(item);
    });

    renderPanel(commandConcepts[0]);
  }

  function createInitialTerminalState() {
    return {
      cwd: "/home/doctor/ngs-workshop",
      fastpRun: false,
      lastExitCode: 0,
      history: [
        {
          command: "welcome",
          output: terminalWelcome,
          note:
            "This simulator is for teaching. It does not run real software; it shows realistic command patterns and annotated outputs.",
          breakdown: null,
        },
      ],
    };
  }

  function getTerminalFileTree(state) {
    const trimmedFiles = state.fastpRun
      ? ["trimmed_R1.fastq.gz", "trimmed_R2.fastq.gz", "fastp.html"]
      : [];
    return {
      "/home/doctor/ngs-workshop": {
        dirs: ["data", "reference", "results"],
        files: ["README.txt"],
      },
      "/home/doctor/ngs-workshop/data": {
        dirs: [],
        files: [
          "sample_R1.fastq.gz",
          "sample_R2.fastq.gz",
          "sample.bam",
          "sample.vcf.gz",
        ].concat(trimmedFiles),
      },
      "/home/doctor/ngs-workshop/reference": {
        dirs: [],
        files: ["GRCh38.primary_assembly.fa", "GRCh38.primary_assembly.fa.fai"],
      },
      "/home/doctor/ngs-workshop/results": {
        dirs: [],
        files: ["run_log.txt", "coverage_summary.tsv"],
      },
    };
  }

  function terminalPathToTilde(path) {
    return path.replace("/home/doctor/ngs-workshop", "~");
  }

  function buildFileMapMarkup(tree) {
    const root = tree["/home/doctor/ngs-workshop"];
    const dataFiles = tree["/home/doctor/ngs-workshop/data"].files;
    const referenceFiles = tree["/home/doctor/ngs-workshop/reference"].files;
    const resultFiles = tree["/home/doctor/ngs-workshop/results"].files;
    return `
      <ul class="terminal-filetree">
        <li>~/ (${root.files.join(", ")})</li>
        <li>data/
          <ul class="terminal-filetree">
            ${dataFiles.map((file) => `<li>${escapeHtml(file)}</li>`).join("")}
          </ul>
        </li>
        <li>reference/
          <ul class="terminal-filetree">
            ${referenceFiles.map((file) => `<li>${escapeHtml(file)}</li>`).join("")}
          </ul>
        </li>
        <li>results/
          <ul class="terminal-filetree">
            ${resultFiles.map((file) => `<li>${escapeHtml(file)}</li>`).join("")}
          </ul>
        </li>
      </ul>
    `;
  }

  function getPrompt(state) {
    return `doctor@wahj:${terminalPathToTilde(state.cwd)}$`;
  }

  function normalizeCommand(command) {
    return command.trim().replace(/\s+/g, " ");
  }

  function runTerminalCommand(state, rawCommand) {
    const command = normalizeCommand(rawCommand);
    const fileTree = getTerminalFileTree(state);
    const inRoot = state.cwd === "/home/doctor/ngs-workshop";
    const inData = state.cwd === "/home/doctor/ngs-workshop/data";

    const responses = {
      pwd: {
        output: state.cwd,
        note: "pwd shows the current working directory. This matters because the same command can fail or succeed depending on where you are.",
        breakdown: {
          program: "pwd",
          subcommand: "none",
          options: "none",
          input: "Current shell context",
          output: "Absolute directory path",
          caution: "Always confirm location before running file-dependent commands.",
        },
      },
      "ls -lh": {
        output: inRoot
          ? "total 4.0K\ndrwxr-xr-x  data\ndrwxr-xr-x  reference\ndrwxr-xr-x  results\n-rw-r--r--  README.txt"
          : inData
          ? [
              "total 8.4G",
              "3.2G  sample_R1.fastq.gz",
              "3.1G  sample_R2.fastq.gz",
              "1.7G  sample.bam",
              "9.4M  sample.vcf.gz",
            ]
              .concat(
                state.fastpRun
                  ? ["2.9G  trimmed_R1.fastq.gz", "2.8G  trimmed_R2.fastq.gz", "428K  fastp.html"]
                  : []
              )
              .join("\n")
          : state.cwd.endsWith("/reference")
          ? "total 3.3G\n3.2G  GRCh38.primary_assembly.fa\n12M  GRCh38.primary_assembly.fa.fai"
          : "total 184K\n16K  run_log.txt\n24K  coverage_summary.tsv",
        note: "ls -lh reveals the working files, their approximate sizes, and whether expected outputs actually exist.",
        breakdown: {
          program: "ls",
          subcommand: "none",
          options: "-lh",
          input: "Current directory",
          output: "Human-readable file listing",
          caution: "In a real audit trail, confirm file names, sizes, and output timestamps.",
        },
      },
      "ls *.gz": inData
        ? {
            output:
              "sample_R1.fastq.gz\nsample_R2.fastq.gz\nsample.vcf.gz" +
              (state.fastpRun ? "\ntrimmed_R1.fastq.gz\ntrimmed_R2.fastq.gz" : ""),
            note:
              "The wildcard *.gz expands to matching compressed files in the current directory before ls runs.",
            breakdown: {
              program: "ls",
              subcommand: "none",
              options: "*.gz",
              input: "Files matching wildcard",
              output: "Matching compressed files",
              caution: "Wildcards are useful, but careless patterns can accidentally include the wrong sample or output file.",
            },
            exitCode: 0,
          }
        : null,
      "cd data": inRoot
        ? {
            output: "",
            note: "cd changes the working directory. In the simulator, you are now inside the data folder.",
            breakdown: {
              program: "cd",
              subcommand: "none",
              options: "none",
              input: "Target directory: data",
              output: "Shell state changes; no text output is expected on success",
              caution: "Relative paths such as data work only if the current directory is correct.",
            },
            exitCode: 0,
            onSuccess() {
              state.cwd = "/home/doctor/ngs-workshop/data";
            },
          }
        : null,
      "cd ..": !inRoot
        ? {
            output: "",
            note: "cd .. moves one level up. This is often safer than retyping a long absolute path.",
            breakdown: {
              program: "cd",
              subcommand: "none",
              options: "none",
              input: "Parent directory",
              output: "Shell state changes",
              caution: "Always re-check location with pwd if you are not sure.",
            },
            exitCode: 0,
            onSuccess() {
              const current = state.cwd.split("/");
              current.pop();
              state.cwd = current.join("/") || "/";
            },
          }
        : null,
      "zcat sample_R1.fastq.gz | head -n 8": inData
        ? {
            output:
              "@A00519:145:H25FYDSX7:1:1101:1240:1000 1:N:0:ATCACG\n" +
              "ACCTGAGCTCGCCAGTGAAATGATGGCTTATTACAGGTCAGTGGAGACGCTGAGACCAGTAACATGAGC\n" +
              "+\n" +
              "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF\n" +
              "@A00519:145:H25FYDSX7:1:1101:1288:1000 1:N:0:ATCACG\n" +
              "TTTTCCCCTAAATTGCCTCTTTCAGTGGCAAACAGGGTGCCAAGTAAATCTGATTTAAAGACTACTTTC\n" +
              "+\n" +
              "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
            note:
              "This shows exactly two FASTQ records. Using head -n 8 makes the four-line FASTQ structure explicit for beginners.",
            breakdown: {
              program: "zcat",
              subcommand: "none",
              options: "pipe to head -n 8",
              input: "Compressed FASTQ",
              output: "Decompressed first two records",
              caution: "Use zcat or zless for compressed FASTQ. Plain head on .gz files is not a correct teaching example.",
            },
            exitCode: 0,
          }
        : null,
      "samtools --help | head -n 5": {
        output:
          "Program: samtools (Tools for alignments in the SAM format)\n" +
          "Version: 1.20\n" +
          "Usage: samtools <command> [options]\n" +
          "Commands: view, sort, index, flagstat, depth, stats ...\n" +
          "See 'samtools help <command>' for detailed help.",
        note:
          "--help is one of the safest commands in bioinformatics because it explains program structure before a real file-changing command is attempted.",
        breakdown: {
          program: "samtools",
          subcommand: "--help",
          options: "| head -n 5",
          input: "Built-in program help",
          output: "First lines of the help page",
          caution: "Doctors do not need to memorize syntax, but they should expect validated pipelines to document exact versions and subcommands.",
        },
        exitCode: 0,
      },
      "fastp --version": {
        output: "fastp 0.23.4",
        note:
          "Software versions matter. The same sample can generate slightly different outputs if the pipeline version changes.",
        breakdown: {
          program: "fastp",
          subcommand: "--version",
          options: "none",
          input: "Program metadata",
          output: "Installed program version",
          caution: "Version capture is part of reproducibility and should appear in validation records.",
        },
        exitCode: 0,
      },
      "samtools flagstat sample.bam": inData
        ? {
            output:
              "62874518 + 0 in total (QC-passed reads + QC-failed reads)\n" +
              "3721940 + 0 duplicates\n" +
              "61120850 + 0 mapped (97.2% : N/A)\n" +
              "62874518 + 0 paired in sequencing\n" +
              "31437259 + 0 read1\n" +
              "31437259 + 0 read2\n" +
              "60011200 + 0 properly paired (95.4% : N/A)",
            note:
              "flagstat is a fast way to ask whether the alignment looks globally healthy before you start trusting individual calls.",
            breakdown: {
              program: "samtools",
              subcommand: "flagstat",
              options: "none",
              input: "Aligned BAM",
              output: "Mapping and pairing summary",
              caution: "High mapping rate does not prove every locus is reliable; region-level review is still needed.",
            },
            exitCode: 0,
          }
        : null,
      "samtools depth -r chr7:117199640-117199660 sample.bam | head -n 5": inData
        ? {
            output:
              "chr7\t117199640\t68\n" +
              "chr7\t117199641\t70\n" +
              "chr7\t117199642\t71\n" +
              "chr7\t117199643\t69\n" +
              "chr7\t117199644\t72",
            note:
              "Depth is a locus-level metric. A specimen can have a strong overall mapped percentage but still have clinically weak coverage at a crucial exon.",
            breakdown: {
              program: "samtools",
              subcommand: "depth",
              options: "-r chr7:117199640-117199660 | head -n 5",
              input: "Aligned BAM at a selected region",
              output: "Per-base read depth",
              caution: "Depth alone is not enough; mapping quality, base quality, and context still matter.",
            },
            exitCode: 0,
          }
        : null,
      "zgrep '^#' sample.vcf.gz | head -n 5": inData
        ? {
            output:
              "##fileformat=VCFv4.2\n" +
              "##source=HaplotypeCaller\n" +
              "##reference=GRCh38.primary_assembly.fa\n" +
              "##INFO=<ID=DP,Number=1,Type=Integer,Description=\"Approximate read depth\">\n" +
              "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSAMPLE",
            note:
              "The header tells you the reference build, the caller, and where fields such as DP are stored.",
            breakdown: {
              program: "zgrep",
              subcommand: "none",
              options: "'^#' | head -n 5",
              input: "Compressed VCF header lines",
              output: "Metadata lines only",
              caution: "Depth may be stored in INFO/DP or sample-level FORMAT/DP depending on the caller and workflow.",
            },
            exitCode: 0,
          }
        : null,
      "bcftools view -H -r chr7:117199640-117199710 sample.vcf.gz": inData
        ? {
            output:
              "chr7\t117199646\t.\tG\tA\t412.7\tPASS\tAC=1;AN=2\tGT:AD:DP:GQ\t0/1:38,34:72:99\n" +
              "chr7\t117199689\t.\tC\tT\t21.4\tq10\tAC=1;AN=2\tGT:AD:DP:GQ\t0/1:4,3:7:18",
            note:
              "Looking at one genomic region side by side can reveal why one call is convincing and another should probably not survive clinical filtering.",
            breakdown: {
              program: "bcftools",
              subcommand: "view",
              options: "-H -r chr7:117199640-117199710",
              input: "sample.vcf.gz",
              output: "Variant rows only in the selected region",
              caution: "A single row still needs phenotype context, coverage context, and the correct interpretation framework.",
            },
            exitCode: 0,
          }
        : null,
      "bcftools view -i 'QUAL>30 && FORMAT/DP>10' sample.vcf.gz | head -n 3": inData
        ? {
            output:
              "chr7\t117199646\t.\tG\tA\t412.7\tPASS\tAC=1;AN=2\tGT:AD:DP:GQ\t0/1:38,34:72:99\n" +
              "chr7\t117230405\t.\tT\tC\t155.3\tPASS\tAC=1;AN=2\tGT:AD:DP:GQ\t0/1:25,27:52:99\n" +
              "chr7\t117241001\t.\tG\tGT\t108.9\tPASS\tAC=1;AN=2\tGT:AD:DP:GQ\t0/1:31,15:46:93",
            note:
              "This filter keeps only calls with stronger quality and sample-level depth. It is a technical filter, not a final clinical classification rule.",
            breakdown: {
              program: "bcftools",
              subcommand: "view",
              options: "-i 'QUAL>30 && FORMAT/DP>10' | head -n 3",
              input: "sample.vcf.gz",
              output: "Filtered candidate rows",
              caution: "The example uses FORMAT/DP intentionally because some workflows store read depth at sample level rather than INFO/DP.",
            },
            exitCode: 0,
          }
        : null,
      "bwa-mem2 mem -t 8 ../reference/GRCh38.primary_assembly.fa sample_R1.fastq.gz sample_R2.fastq.gz | samtools sort -o sample.new.bam":
        inData
          ? {
              output:
                "[M::bwa_idx_load_from_disk] read 0 ALT contigs\n" +
                "[M::mem_process_seqs] Processed 200000 reads in 1.6 sec\n" +
                "[M::mem_process_seqs] Processed 200000 reads in 1.5 sec\n" +
                "[bam_sort_core] merging from 4 files and 1 in-memory blocks...\n" +
                "sorted BAM written to sample.new.bam",
              note:
                "This is the core alignment idea: map reads to the reference, then sort the alignments so downstream tools can inspect them by genomic coordinate.",
              breakdown: {
                program: "bwa-mem2",
                subcommand: "mem",
                options: "-t 8 ... | samtools sort -o sample.new.bam",
                input: "Paired FASTQ plus reference genome",
                output: "Sorted BAM",
                caution: "This is a realistic pattern, but real laboratories validate the exact reference, version, thread settings, and downstream sort/index steps.",
              },
              exitCode: 0,
            }
          : null,
      "fastp -i sample_R1.fastq.gz -I sample_R2.fastq.gz -o trimmed_R1.fastq.gz -O trimmed_R2.fastq.gz --html fastp.html":
        inData
          ? {
              output:
                "Detecting adapter sequence...\n" +
                "Read1 before filtering: 31,437,259\n" +
                "Read1 after filtering: 29,892,110\n" +
                "Read2 before filtering: 31,437,259\n" +
                "Read2 after filtering: 29,881,774\n" +
                "Q30 rate improved from 86.1% to 92.8%\n" +
                "HTML report written to fastp.html",
              note:
                "fastp is a good teaching example because it shows how quality filtering changes both read counts and downstream trustworthiness.",
              breakdown: {
                program: "fastp",
                subcommand: "none",
                options: "-i -I -o -O --html",
                input: "Paired FASTQ files",
                output: "Trimmed FASTQ and QC report",
                caution: "Read loss after trimming is not always bad; the question is whether enough high-quality data remain for the assay.",
              },
              exitCode: 0,
              onSuccess() {
                state.fastpRun = true;
              },
            }
          : null,
      "sha256sum sample_R1.fastq.gz": inData
        ? {
            output:
              "4fd53e16d7c30f1a3f739154f6c3e4f38f4d086e9e6ac83682d6c41d342ab1aa  sample_R1.fastq.gz",
            note:
              "A checksum proves file identity. If a file changes later, the checksum changes too, which matters for reanalysis and audit trails.",
            breakdown: {
              program: "sha256sum",
              subcommand: "none",
              options: "none",
              input: "FASTQ file",
              output: "Cryptographic hash plus file name",
              caution: "Checksums do not measure quality, but they do prove whether the exact input file stayed the same.",
            },
            exitCode: 0,
          }
        : null,
      "echo $?": {
        output: String(state.lastExitCode),
        note:
          "The shell exit code reports whether the previous command succeeded. Zero usually means success; non-zero means warning or failure.",
        breakdown: {
          program: "echo",
          subcommand: "none",
          options: "$?",
          input: "Previous command exit code",
          output: "Numeric status",
          caution: "In automated pipelines, exit codes are essential for deciding whether the next step should continue.",
        },
        exitCode: 0,
      },
    };

    if (command === "help") {
      return {
        output: terminalWelcome,
        note: "Use the preset buttons or type one of the supported teaching commands exactly.",
        breakdown: {
          program: "help",
          subcommand: "none",
          options: "none",
          input: "none",
          output: "Supported teaching commands",
          caution: "This is intentionally a guided simulator, not a real shell.",
        },
        exitCode: 0,
      };
    }

    if (command === "head -n 8 sample_R1.fastq.gz") {
      return {
        output: "gzip-compressed file detected\nTry: zcat sample_R1.fastq.gz | head -n 8",
        note:
          "This correction is deliberate. In a teaching lecture, compressed FASTQ should be shown with zcat or zless, not with plain head.",
        breakdown: {
          program: "head",
          subcommand: "none",
          options: "-n 8",
          input: "Compressed FASTQ",
          output: "Teaching correction rather than valid content",
          caution: "Choose examples that are technically correct for beginners.",
        },
        exitCode: 1,
      };
    }

    const response = responses[command];
    if (response) {
      if (typeof response.onSuccess === "function") {
        response.onSuccess();
      }
      return response;
    }

    return {
      output:
        `Command not supported in this lecture simulator:\n${command}\n\n` +
        terminalWelcome,
      note:
        "The simulator only accepts guided commands so the page stays safe and scientifically focused during teaching.",
      breakdown: {
        program: command.split(" ")[0] || "none",
        subcommand: "unsupported",
        options: "n/a",
        input: "n/a",
        output: "Teaching warning",
        caution: "In real work, never copy an unfamiliar command into patient data without understanding the inputs and outputs.",
      },
      exitCode: 127,
    };
  }

  function setupTerminalSimulator() {
    const form = document.querySelector("#terminal-form");
    const input = document.querySelector("#terminal-input");
    const output = document.querySelector("#terminal-output");
    const prompt = document.querySelector("#terminal-prompt");
    const breakdown = document.querySelector("#terminal-breakdown");
    const note = document.querySelector("#terminal-note");
    const resetButton = document.querySelector("#terminal-reset");
    const walkthroughButton = document.querySelector("#terminal-walkthrough");
    const presetButtons = Array.from(document.querySelectorAll("[data-terminal-command]"));
    const fileMap = document.querySelector("#terminal-filemap");

    if (!form || !input || !output || !prompt || !breakdown || !note || !resetButton || !walkthroughButton || !fileMap) {
      return;
    }

    let state = createInitialTerminalState();
    const dataScopedCommands = new Set([
      "ls *.gz",
      "zcat sample_R1.fastq.gz | head -n 8",
      "fastp --version",
      "samtools flagstat sample.bam",
      "samtools depth -r chr7:117199640-117199660 sample.bam | head -n 5",
      "zgrep '^#' sample.vcf.gz | head -n 5",
      "bcftools view -H -r chr7:117199640-117199710 sample.vcf.gz",
      "bcftools view -i 'QUAL>30 && FORMAT/DP>10' sample.vcf.gz | head -n 3",
      "bwa-mem2 mem -t 8 ../reference/GRCh38.primary_assembly.fa sample_R1.fastq.gz sample_R2.fastq.gz | samtools sort -o sample.new.bam",
      "fastp -i sample_R1.fastq.gz -I sample_R2.fastq.gz -o trimmed_R1.fastq.gz -O trimmed_R2.fastq.gz --html fastp.html",
      "sha256sum sample_R1.fastq.gz",
    ]);

    function render() {
      prompt.textContent = getPrompt(state);
      output.innerHTML = state.history
        .map((entry) => {
          if (entry.command === "welcome") {
            return `
              <div class="terminal-entry">
                <div class="terminal-entry-output">${escapeHtml(entry.output)}</div>
                <div class="terminal-entry-hint">${escapeHtml(entry.note)}</div>
              </div>
            `;
          }
          return `
            <div class="terminal-entry">
              <div class="terminal-entry-command">${escapeHtml(entry.prompt)} ${escapeHtml(entry.command)}</div>
              <div class="terminal-entry-output">${escapeHtml(entry.output || "")}</div>
              <div class="terminal-entry-hint">${escapeHtml(entry.note)}</div>
            </div>
          `;
        })
        .join("");
      output.scrollTop = output.scrollHeight;
      fileMap.innerHTML = buildFileMapMarkup(getTerminalFileTree(state));

      const last = state.history[state.history.length - 1];
      if (last && last.breakdown) {
        breakdown.innerHTML = `
          <dl>
            <div><dt>Program</dt><dd>${escapeHtml(last.breakdown.program)}</dd></div>
            <div><dt>Subcommand</dt><dd>${escapeHtml(last.breakdown.subcommand)}</dd></div>
            <div><dt>Options</dt><dd>${escapeHtml(last.breakdown.options)}</dd></div>
            <div><dt>Input</dt><dd>${escapeHtml(last.breakdown.input)}</dd></div>
            <div><dt>Output</dt><dd>${escapeHtml(last.breakdown.output)}</dd></div>
            <div><dt>Caution</dt><dd>${escapeHtml(last.breakdown.caution)}</dd></div>
          </dl>
        `;
        note.textContent = last.note;
      }
    }

    function execute(command) {
      const promptText = getPrompt(state);
      const response = runTerminalCommand(state, command);
      state.lastExitCode = typeof response.exitCode === "number" ? response.exitCode : 0;
      state.history.push({
        prompt: promptText,
        command: normalizeCommand(command),
        output: response.output,
        note: response.note,
        breakdown: response.breakdown,
      });
      render();
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const command = input.value.trim();
      if (!command) {
        return;
      }
      execute(command);
      input.select();
    });

    presetButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const command = button.dataset.terminalCommand || "";
        input.value = command;
        if (dataScopedCommands.has(command) && state.cwd === "/home/doctor/ngs-workshop") {
          execute("cd data");
        }
        execute(command);
      });
    });

    resetButton.addEventListener("click", () => {
      state = createInitialTerminalState();
      render();
    });

    walkthroughButton.addEventListener("click", () => {
      state = createInitialTerminalState();
      [
        "pwd",
        "ls -lh",
        "cd data",
        "zcat sample_R1.fastq.gz | head -n 8",
        "samtools --help | head -n 5",
        "samtools flagstat sample.bam",
        "samtools depth -r chr7:117199640-117199660 sample.bam | head -n 5",
        "zgrep '^#' sample.vcf.gz | head -n 5",
        "bcftools view -i 'QUAL>30 && FORMAT/DP>10' sample.vcf.gz | head -n 3",
        "sha256sum sample_R1.fastq.gz",
      ].forEach((command) => execute(command));
    });

    render();
  }

  function setupTeachingSketchPads() {
    const pads = Array.from(document.querySelectorAll("[data-sketch-pad]"));
    if (!pads.length) {
      return;
    }

    function createPadController(pad) {
      const canvas = pad.querySelector("[data-sketch-canvas]");
      const clearButton = pad.querySelector("[data-sketch-clear]");
      const frame = pad.querySelector(".teaching-sketch-canvas-frame");
      if (!canvas || !frame) {
        return null;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        return null;
      }

      const state = {
        drawing: false,
        pointerId: null,
        strokes: [],
        currentStroke: null,
        width: 1,
        height: 1,
      };

      function updateInkClass() {
        pad.classList.toggle("has-ink", state.strokes.length > 0);
      }

      function getRelativePoint(event) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width || 1);
        const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height || 1);
        return {
          x,
          y,
          nx: rect.width ? x / rect.width : 0,
          ny: rect.height ? y / rect.height : 0,
        };
      }

      function drawStroke(stroke) {
        if (!stroke?.points?.length) {
          return;
        }

        context.save();
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = stroke.color;
        context.lineWidth = stroke.lineWidth;
        context.beginPath();
        stroke.points.forEach((point, index) => {
          const x = point.nx * state.width;
          const y = point.ny * state.height;
          if (index === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        });
        if (stroke.points.length === 1) {
          const onlyPoint = stroke.points[0];
          const x = onlyPoint.nx * state.width;
          const y = onlyPoint.ny * state.height;
          context.arc(x, y, stroke.lineWidth / 2, 0, Math.PI * 2);
        }
        context.stroke();
        context.restore();
      }

      function redraw() {
        context.clearRect(0, 0, state.width, state.height);
        state.strokes.forEach(drawStroke);
      }

      function resizeCanvas() {
        const rect = frame.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        state.width = width;
        state.height = height;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        redraw();
      }

      function finishStroke() {
        state.drawing = false;
        state.pointerId = null;
        state.currentStroke = null;
      }

      canvas.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) {
          return;
        }
        event.preventDefault();
        const point = getRelativePoint(event);
        const stroke = {
          color: "#cb4a3f",
          lineWidth: 3.2,
          points: [{ nx: point.nx, ny: point.ny }],
        };
        state.strokes.push(stroke);
        state.currentStroke = stroke;
        state.drawing = true;
        state.pointerId = event.pointerId;
        updateInkClass();
        canvas.setPointerCapture?.(event.pointerId);
        redraw();
      });

      canvas.addEventListener("pointermove", (event) => {
        if (!state.drawing || state.pointerId !== event.pointerId || !state.currentStroke) {
          return;
        }
        event.preventDefault();
        const point = getRelativePoint(event);
        state.currentStroke.points.push({ nx: point.nx, ny: point.ny });
        redraw();
      });

      ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
        canvas.addEventListener(eventName, (event) => {
          if (state.pointerId !== event.pointerId) {
            return;
          }
          finishStroke();
        });
      });

      clearButton?.addEventListener("click", () => {
        state.strokes = [];
        updateInkClass();
        redraw();
      });

      resizeCanvas();
      updateInkClass();
      return { resizeCanvas };
    }

    const controllers = pads.map(createPadController).filter(Boolean);
    if (!controllers.length) {
      return;
    }

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        controllers.forEach((controller) => controller.resizeCanvas());
      }, 120);
    });
  }

  function setupVariantRealityEmbed() {
    const frame = document.querySelector("[data-variant-reality-frame]");
    if (!frame) {
      return;
    }

    window.addEventListener("message", (event) => {
      if (
        event.source !== frame.contentWindow ||
        event.data?.source !== "wahj-variant-reality" ||
        event.data?.type !== "resize"
      ) {
        return;
      }
      const height = Number(event.data.height);
      if (!Number.isFinite(height) || height < 600 || height > 12000) {
        return;
      }
      frame.style.height = `${Math.ceil(height)}px`;
    });
  }

  renderWorkflowExplorer();
  renderOrganizations();
  renderCriteriaExplorer();
  setupCaseBuilder();
  setupPvs1Lab();
  renderCommandConcepts();
  setupTerminalSimulator();
  setupQualityMetricsExplorer();
  setupTeachingSketchPads();
  setupVariantRealityEmbed();
})();
