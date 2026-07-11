(function initializeNgsAcmgLecture() {
  const page = document.querySelector(".ngs-acmg-page");
  if (!page) {
    return;
  }

  const workflowStages = [
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
        "GENE=CFTR | TRANSCRIPT=NM_000492.4 | CONSEQUENCE=missense_variant | HGVSc=c.1521_1523delCTT | HGVSp=p.Phe508del | gnomAD_AF=0.006 | ClinVar=Pathogenic",
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

  function renderWorkflowExplorer() {
    const root = document.querySelector("[data-workflow-explorer]");
    if (!root) {
      return;
    }

    const buttonRow = root.querySelector(".workflow-stage-list");
    const panel = root.querySelector("[data-workflow-panel]");
    if (!buttonRow || !panel) {
      return;
    }

    let activeId = workflowStages[0].id;

    function renderPanel(stage) {
      panel.innerHTML = `
        <h3>${escapeHtml(stage.label)}</h3>
        <p>${escapeHtml(stage.question)}</p>
        <div class="workflow-stage-kpis">
          <article>
            <span>Checkpoint file</span>
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
          <article>
            <h4>Clinical reading point</h4>
            <p>${escapeHtml(stage.doctorWhy)}</p>
          </article>
        </div>
      `;
    }

    function activate(id) {
      const stage = workflowStages.find((item) => item.id === id) || workflowStages[0];
      activeId = stage.id;
      Array.from(buttonRow.querySelectorAll("button")).forEach((button) => {
        const isActive = button.dataset.stageId === activeId;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      renderPanel(stage);
    }

    buttonRow.innerHTML = workflowStages
      .map(
        (stage) => `
          <button
            type="button"
            data-stage-id="${escapeHtml(stage.id)}"
            aria-selected="false"
          >
            ${escapeHtml(stage.label)}
          </button>
        `
      )
      .join("");

    buttonRow.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-stage-id]");
      if (!button) {
        return;
      }
      activate(button.dataset.stageId);
    });

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

  renderWorkflowExplorer();
  renderOrganizations();
  renderCriteriaExplorer();
  setupCaseBuilder();
  setupPvs1Lab();
  renderCommandConcepts();
  setupTerminalSimulator();
})();
