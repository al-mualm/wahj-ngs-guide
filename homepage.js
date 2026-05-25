const homepageConfig = window.WAHJ_NGS_CONFIG || {};
const homepageBackendApiUrl = (homepageConfig.readerApiUrl || "").trim();
const homepageSiteLabel = (homepageConfig.siteLabel || "Wahj NGS Guide").trim();
const homepageLanguage = document.documentElement.lang === "ar" ? "ar" : "en";
const homepageReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const homepageReaderIdStorageKey = "wahj-ngs-reader-id";
const homepageTopicCooldownStorageKey = "wahj-topic-visit-cooldowns-v1";
const homepageTopicCooldownMs = 30 * 60 * 1000;
const homepagePathPrefix = homepageLanguage === "ar" ? "../" : "./";

const homepageCopy = {
  en: {
    topicTag: "Scientific module",
    selectedBadge: "Selected module",
    countLabel: "Visits",
    countLoading: "…",
    countUnavailable: "—",
    countTitle:
      "Real topic visits are counted when a visitor actively opens this scientific module.",
    countUnavailableTitle:
      "Per-topic analytics are unavailable until the topic-visit backend actions are deployed.",
    countNote:
      "Per-topic badges show real topic opens only when topic analytics are available from the live backend.",
    actionHint: "Tap to reveal the lecture and tool paths",
    openLabel: "Open page",
    selectionDefaultTitle: "Choose a topic first",
    selectionDefaultCopy:
      "Select one of the five scientific modules above to reveal the best lecture and practical entry pages.",
    selectionPlaceholder:
      "Choose one of the five molecular biology modules above. The selected topic will reveal the best lecture and practical entry cards here.",
    panelCountLabel: "Topic visits",
    cardsLabel: "Available entry points",
    topics: {
      ngs: {
        analyticsId: "ngs",
        theme: "ngs",
        title: "Next-Generation Sequencing",
        subtitle: "FASTQ/FASTA, QC, alignment, and platform-choice guidance.",
        detail:
          "Choose this card if you have next-generation sequencing data or want to understand the workflow from sample preparation to FASTQ/FASTA files, quality control, alignment, and interpretation. This section contains a clear lecture and practical guidance for choosing the right NGS approach.",
        panelLead:
          "Open the full NGS lecture or go directly to the practical workflow and decision-guide entry points.",
        chips: ["Genomics", "FASTQ/FASTA", "QC"],
        cards: [
          {
            badge: "Lecture",
            title: "NGS lecture",
            description:
              "Open the full NGS teaching page covering workflow, applications, file formats, platform logic, and biological interpretation.",
            href: "ngs/",
            chips: ["Workflow", "Applications", "Interpretation"],
          },
          {
            badge: "Practical guide",
            title: "NGS workflow and decision sections",
            description:
              "Jump directly into the workflow, quality-control, platform, and decision-guide sections inside the NGS page.",
            href: "ngs/#workflow",
            chips: ["Workflow", "QC", "Decision guide"],
          },
        ],
      },
      sanger: {
        analyticsId: "sanger",
        theme: "sanger",
        title: "Sanger Sequencing",
        subtitle: "FASTA, .ab1, chromatogram evidence, BLAST, and interpretation.",
        detail:
          "Choose this card if you performed Sanger sequencing yourself or sent samples to a laboratory and received Sanger files, usually FASTA, .ab1, or chromatogram data. This section contains a simple lecture and an analysis tool for cleaning, checking, and interpreting Sanger results.",
        panelLead:
          "Open the Sanger lecture, the BLAST alignment workflow, or the AB1 chromatogram analysis tool.",
        chips: ["FASTA", ".ab1", "Chromatograms"],
        cards: [
          {
            badge: "Lecture",
            title: "Sanger sequencing lecture",
            description:
              "Start with sequence cleaning, BLAST interpretation, taxonomy context, and how to read alignment evidence correctly.",
            href: "sequence-analysis/#overview",
            chips: ["Cleaning", "Taxonomy", "Interpretation"],
          },
          {
            badge: "Tool",
            title: "BLAST alignment tool",
            description:
              "Paste a sequence, clean it, run BLAST, inspect ranked hits, and generate publication-oriented tables.",
            href: "sequence-analysis/#analysis-tool",
            chips: ["Live BLAST", "Ranked hits", "Publication tables"],
          },
          {
            badge: "Tool",
            title: "SeqStudio / Sanger Smart Analyzer",
            description:
              "Upload AB1 chromatogram files, trim reads, align them against a selected reference, inspect chromatogram evidence, and generate publication-ready tables.",
            href: "seqstudio/",
            chips: ["AB1 upload", "Chromatograms", "Variant tables"],
          },
        ],
      },
      qpcr: {
        analyticsId: "qpcr",
        theme: "qpcr",
        title: "Real-Time PCR",
        subtitle: "Ct, DeltaCt, DeltaDeltaCt, fold change, and sample-level statistics.",
        detail:
          "Choose this card if you have Ct values from Real-Time PCR and need to understand ΔCt, ΔΔCt, fold change, reference genes, controls, and sample-level statistics.",
        panelLead:
          "Open the scientific lecture or go directly to the gene-expression calculator and statistical workflow.",
        chips: ["Ct", "DeltaCt", "Statistics"],
        cards: [
          {
            badge: "Lecture",
            title: "Real-Time PCR lecture",
            description:
              "Study Ct interpretation, threshold logic, assay chemistry, and relative versus absolute quantification.",
            href: "real-time-pcr/",
            chips: ["Ct", "Chemistry", "Quantification"],
          },
          {
            badge: "Tool",
            title: "Gene expression calculator",
            description:
              "Assign plate wells, import Ct values, calculate 2^-ΔΔCt, and review summary tables, statistical tests, and graphs.",
            href: "real-time-pcr/#calculator",
            chips: ["Plate map", "2^-ΔΔCt", "Stats"],
          },
        ],
      },
      elisa: {
        analyticsId: "elisa",
        theme: "elisa",
        title: "Wahj ELISA Learning and Analysis Suite",
        subtitle: "OD, standard curves, concentration output, and report-ready statistics.",
        detail:
          "Choose this card if you have OD readings from an ELISA plate and need to build a standard curve, calculate sample concentration, check curve reliability, and generate clear statistical or report text.",
        panelLead:
          "Open the ELISA lecture or go directly to the standard-curve and concentration workflow.",
        chips: ["OD", "Standard curve", "Concentration"],
        cards: [
          {
            badge: "Lecture",
            title: "ELISA lecture",
            description:
              "Learn what ELISA measures, what OD means, how the standard curve works, and how to choose the curve shape from the kit leaflet.",
            href: "elisa/",
            chips: ["Signal", "OD", "Curve logic"],
          },
          {
            badge: "Tool",
            title: "Wahj ELISA Learning and Analysis Suite",
            description:
              "Enter standards and unknown ODs, generate the fitted equation, calculate concentrations, and open guided statistical analysis.",
            href: "elisa-tool/",
            chips: ["Curve fit", "Concentration", "Statistics"],
          },
        ],
      },
      genotype: {
        analyticsId: "genotype",
        theme: "genotype",
        title: "Genotype Statistics",
        subtitle: "Hardy-Weinberg, odds ratio, Fisher tests, and publication tables.",
        detail:
          "Choose this card if you have genotype counts from patients and controls and need Hardy-Weinberg equilibrium, allele/genotype comparison, odds ratio, Fisher/exact tests, confidence interval, and publication-ready tables.",
        panelLead:
          "Open the Hardy-Weinberg equation tool or go directly to the SNP case-control statistics workflow.",
        chips: ["HWE", "Odds ratio", "Fisher exact"],
        cards: [
          {
            badge: "Tool",
            title: "Hardy-Weinberg equation",
            description:
              "Enter the three genotype counts, compare observed and expected values, and review the Hardy-Weinberg statistic and p-value.",
            href: "hardy-weinberg/",
            chips: ["Observed", "Expected", "P-value"],
          },
          {
            badge: "Tool",
            title: "SNP statistics",
            description:
              "Enter patient and control genotype counts to review frequencies, odds ratios, Fisher exact p-values, and confidence intervals.",
            href: "snp-statistics/",
            chips: ["Patients vs controls", "Odds ratio", "Confidence interval"],
          },
        ],
      },
    },
  },
  ar: {
    topicTag: "وحدة علمية",
    selectedBadge: "الوحدة المختارة",
    countLabel: "الزيارات",
    countLoading: "…",
    countUnavailable: "—",
    countTitle:
      "يُحتسب هذا الرقم عند فتح الزائر لهذه الوحدة العلمية فعلياً، وليس عند تحميل الصفحة فقط.",
    countUnavailableTitle:
      "إحصاءات الزيارات الخاصة بكل موضوع غير متاحة حتى يتم نشر إجراءات الخدمة الخلفية الخاصة بها.",
    countNote:
      "شارات الزيارات الخاصة بالموضوعات تعرض الفتحات الحقيقية فقط عندما تكون خدمة الإحصاءات الخاصة بالموضوعات منشورة في الخلفية.",
    actionHint: "اضغط لإظهار بطاقات الشرح والأداة",
    openLabel: "افتح الصفحة",
    selectionDefaultTitle: "اختر الموضوع أولاً",
    selectionDefaultCopy:
      "اختر واحدة من الوحدات العلمية الخمس في الأعلى ليظهر لك أفضل مسار للشرح أو الصفحة العملية.",
    selectionPlaceholder:
      "اختر واحدة من الوحدات الخمس في الأعلى. بعد الاختيار ستظهر لك هنا بطاقات الدخول المباشر المناسبة للشرح أو الأداة العملية.",
    panelCountLabel: "زيارات الموضوع",
    cardsLabel: "نقاط الدخول المتاحة",
    topics: {
      ngs: {
        analyticsId: "ngs",
        theme: "ngs",
        title: "Next-Generation Sequencing",
        subtitle: "ملفات FASTQ/FASTA وضبط الجودة والمحاذاة واختيار المنصة المناسبة.",
        detail:
          "اختر هذه البطاقة إذا كانت لديك بيانات تسلسل الجيل الجديد أو تريد فهم رحلة العينة من التحضير إلى ملفات FASTQ/FASTA، وضبط الجودة، والمحاذاة، وتفسير النتائج. يحتوي هذا القسم على محاضرة مبسطة وإرشاد عملي لاختيار منهج NGS المناسب.",
        panelLead:
          "افتح محاضرة NGS أو انتقل مباشرة إلى أقسام سير العمل وضبط الجودة ودليل اختيار المنهج.",
        chips: ["جينوميات", "FASTQ/FASTA", "ضبط الجودة"],
        cards: [
          {
            badge: "محاضرة",
            title: "محاضرة NGS",
            description:
              "افتح صفحة NGS الكاملة التي تشرح سير العمل والتطبيقات والملفات والمنصات وتفسير النتائج.",
            href: "ar/",
            chips: ["سير العمل", "التطبيقات", "التفسير"],
          },
          {
            badge: "إرشاد عملي",
            title: "أقسام سير العمل ودليل القرار",
            description:
              "انتقل مباشرة إلى أقسام سير العمل وضبط الجودة والمنصات ودليل اختيار التقنية داخل صفحة NGS.",
            href: "ar/#workflow",
            chips: ["Workflow", "QC", "Decision guide"],
          },
        ],
      },
      sanger: {
        analyticsId: "sanger",
        theme: "sanger",
        title: "Sanger Sequencing",
        subtitle: "FASTA وملفات ‎.ab1 وبيانات الكروماتوغرام وBLAST والتفسير.",
        detail:
          "اختر هذه البطاقة إذا قمت بتسلسل سانجر بنفسك أو أرسلت العينات إلى مختبر واستلمت ملفات سانجر، غالباً بصيغة FASTA أو ‎.ab1 أو بيانات كروماتوغرام. يحتوي هذا القسم على محاضرة مبسطة وأداة لتحليل وتنظيف وفحص وتفسير نتائج سانجر.",
        panelLead:
          "افتح المحاضرة أو أداة BLAST أو محلل SeqStudio لملفات AB1 والكروماتوغرام.",
        chips: ["FASTA", ".ab1", "كروماتوغرام"],
        cards: [
          {
            badge: "محاضرة",
            title: "محاضرة Sanger sequencing",
            description:
              "ابدأ بتنظيف التسلسل وفهم BLAST وسياق التصنيف الحيوي وكيفية قراءة دليل المحاذاة بشكل صحيح.",
            href: "sequence-analysis/#overview",
            chips: ["Cleaning", "Taxonomy", "Interpretation"],
          },
          {
            badge: "أداة",
            title: "أداة BLAST العملية",
            description:
              "ألصق التسلسل ونظفه وشغّل BLAST وراجع أفضل التطابقات والمحاذاة وجداول النشر.",
            href: "sequence-analysis/#analysis-tool",
            chips: ["Live BLAST", "Ranked hits", "Tables"],
          },
          {
            badge: "أداة",
            title: "SeqStudio / Sanger Smart Analyzer",
            description:
              "ارفع ملفات AB1 ونظّف القراءة وراجع الكروماتوغرام والمحاذاة وجداول المتغيرات القابلة للاستخدام في النشر.",
            href: "seqstudio/",
            chips: ["AB1 upload", "Chromatograms", "Variant tables"],
          },
        ],
      },
      qpcr: {
        analyticsId: "qpcr",
        theme: "qpcr",
        title: "Real-Time PCR",
        subtitle: "Ct وΔCt وΔΔCt وFold Change والتحليل الإحصائي على مستوى العينة.",
        detail:
          "اختر هذه البطاقة إذا كانت لديك قيم Ct من Real-Time PCR وتحتاج إلى فهم ΔCt وΔΔCt وFold Change والجينات المرجعية والضوابط والتحليل الإحصائي على مستوى العينة.",
        panelLead:
          "افتح المحاضرة أو انتقل مباشرة إلى حاسبة التعبير الجيني والتحليل الإحصائي.",
        chips: ["Ct", "ΔCt", "إحصاء"],
        cards: [
          {
            badge: "محاضرة",
            title: "محاضرة Real-Time PCR",
            description:
              "راجع Ct والمنطق الكمي والكيمياء الكاشفة والفروق بين القياس النسبي والمطلق.",
            href: "real-time-pcr/",
            chips: ["Ct", "Chemistry", "Quantification"],
          },
          {
            badge: "أداة",
            title: "حاسبة التعبير الجيني",
            description:
              "عيّن الآبار واستورد قيم Ct واحسب 2^-ΔΔCt مع الجداول والإحصاء والرسوم.",
            href: "real-time-pcr/#calculator",
            chips: ["Plate map", "2^-ΔΔCt", "Stats"],
          },
        ],
      },
      elisa: {
        analyticsId: "elisa",
        theme: "elisa",
        title: "Wahj ELISA Learning and Analysis Suite",
        subtitle: "قراءات OD والمنحنى القياسي وحساب التركيز والنصوص الإحصائية والتقريرية.",
        detail:
          "اختر هذه البطاقة إذا كانت لديك قراءات OD من صفيحة ELISA وتحتاج إلى بناء المنحنى القياسي، وحساب تركيز العينات، وفحص موثوقية المنحنى، وإنتاج نص إحصائي أو تقريري واضح.",
        panelLead:
          "افتح محاضرة ELISA أو انتقل مباشرة إلى أداة المنحنى القياسي وحساب التركيز.",
        chips: ["OD", "المنحنى القياسي", "التركيز"],
        cards: [
          {
            badge: "محاضرة",
            title: "محاضرة ELISA",
            description:
              "تعرف على معنى OD وكيف يعمل المنحنى القياسي وكيف تتحول الإشارة إلى تركيز موثوق.",
            href: "elisa/",
            chips: ["Signal", "OD", "Curve logic"],
          },
          {
            badge: "أداة",
            title: "Wahj ELISA Learning and Analysis Suite",
            description:
              "أدخل المعايير والعينات المجهولة وأنشئ المعادلة واحسب التركيز ثم افتح الإحصاء الموجّه.",
            href: "elisa-tool/",
            chips: ["Curve fit", "Concentration", "Statistics"],
          },
        ],
      },
      genotype: {
        analyticsId: "genotype",
        theme: "genotype",
        title: "Genotype Statistics",
        subtitle: "Hardy-Weinberg وOdds Ratio وFisher والجداول الجاهزة للنشر.",
        detail:
          "اختر هذه البطاقة إذا كانت لديك أعداد الأنماط الجينية للمرضى والضوابط وتحتاج إلى Hardy-Weinberg equilibrium، ومقارنة الأليلات والأنماط الجينية، وحساب Odds Ratio، واختبار Fisher أو الاختبارات المناسبة، وفاصل الثقة، وجداول جاهزة للنشر.",
        panelLead:
          "افتح أداة Hardy-Weinberg أو انتقل مباشرة إلى أداة SNP للمقارنة بين المرضى والضوابط.",
        chips: ["HWE", "Odds Ratio", "Fisher"],
        cards: [
          {
            badge: "أداة",
            title: "Hardy-Weinberg equation",
            description:
              "أدخل أعداد الأنماط الجينية الثلاثة وقارن القيم المرصودة والمتوقعة وراجع قيمة Hardy-Weinberg وP-value.",
            href: "hardy-weinberg/",
            chips: ["Observed", "Expected", "P-value"],
          },
          {
            badge: "أداة",
            title: "SNP statistics",
            description:
              "أدخل أعداد الأنماط الجينية في المرضى والضوابط لمراجعة التكرارات وOdds Ratio وFisher وفاصل الثقة.",
            href: "snp-statistics/",
            chips: ["Patients vs controls", "Odds Ratio", "Confidence interval"],
          },
        ],
      },
    },
  },
};

const homepageTopicKeyAliases = {
  ngs: "ngs",
  sanger: "sanger",
  "rt-pcr": "qpcr",
  qpcr: "qpcr",
  elisa: "elisa",
  genetics: "genotype",
  genotype: "genotype",
};

const homepageTopicStats = new Map();
const homepagePendingTrackRequests = new Map();

function getHomepageCopy() {
  return homepageCopy[homepageLanguage];
}

function normalizeHomepageTopicKey(value) {
  return homepageTopicKeyAliases[String(value || "").trim().toLowerCase()] || "";
}

function createHomepageReaderId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `reader-${window.crypto.randomUUID()}`;
  }

  return `reader-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getHomepageReaderId() {
  try {
    const existingId = localStorage.getItem(homepageReaderIdStorageKey);
    if (existingId) {
      return existingId;
    }

    const newId = createHomepageReaderId();
    localStorage.setItem(homepageReaderIdStorageKey, newId);
    return newId;
  } catch (error) {
    return createHomepageReaderId();
  }
}

function loadHomepageJsonp(url, callbackName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while loading topic analytics."));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Unable to contact the topic analytics backend."));
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

async function requestHomepageBackendAction(action, extraParams = {}) {
  if (!homepageBackendApiUrl) {
    throw new Error("Backend API URL is missing.");
  }

  const callbackName = `wahjTopicCallback_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const url = new URL(homepageBackendApiUrl);
  url.searchParams.set("action", action);
  url.searchParams.set("callback", callbackName);

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const payload = await loadHomepageJsonp(url.toString(), callbackName);
  if (!payload || !payload.ok) {
    throw new Error(payload?.error || "Topic analytics request failed.");
  }

  return payload;
}

function getTopicCooldowns() {
  try {
    const raw = localStorage.getItem(homepageTopicCooldownStorageKey);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function setTopicCooldown(topicId) {
  try {
    const current = getTopicCooldowns();
    current[topicId] = Date.now();
    localStorage.setItem(homepageTopicCooldownStorageKey, JSON.stringify(current));
  } catch (error) {
    // Ignore storage errors and rely on backend-side deduplication semantics.
  }
}

function isTopicCooldownActive(topicId) {
  const cooldowns = getTopicCooldowns();
  const lastTrackedAt = Number(cooldowns[topicId] || 0);
  return Boolean(lastTrackedAt && Date.now() - lastTrackedAt < homepageTopicCooldownMs);
}

function topicVisualSvg(theme) {
  const svgByTheme = {
    ngs: `
      <svg viewBox="0 0 220 96" role="presentation" focusable="false">
        <defs>
          <linearGradient id="ngsLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="rgba(47,149,184,0.9)" />
            <stop offset="100%" stop-color="rgba(94,191,214,0.95)" />
          </linearGradient>
        </defs>
        <rect x="8" y="12" width="76" height="46" rx="14" fill="rgba(47,149,184,0.12)" />
        <rect x="96" y="18" width="116" height="34" rx="17" fill="rgba(24,79,103,0.08)" />
        <path d="M28 70 C58 28, 88 90, 118 44 S178 18, 198 58" fill="none" stroke="url(#ngsLine)" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="34" cy="34" r="4.5" fill="rgba(24,79,103,0.9)" />
        <circle cx="48" cy="40" r="4.5" fill="rgba(24,79,103,0.72)" />
        <circle cx="62" cy="28" r="4.5" fill="rgba(24,79,103,0.5)" />
        <circle cx="146" cy="35" r="5" fill="rgba(47,149,184,0.92)" />
        <circle cx="166" cy="35" r="5" fill="rgba(47,149,184,0.68)" />
        <circle cx="186" cy="35" r="5" fill="rgba(47,149,184,0.42)" />
      </svg>
    `,
    sanger: `
      <svg viewBox="0 0 220 96" role="presentation" focusable="false">
        <path d="M12 72 Q28 32 42 72 T72 72 T102 72 T132 72 T162 72 T192 72" fill="none" stroke="rgba(201,106,88,0.88)" stroke-width="4" stroke-linecap="round"/>
        <path d="M12 74 Q32 58 44 74 T84 74 T124 74 T164 74 T204 74" fill="none" stroke="rgba(63,137,104,0.88)" stroke-width="3" stroke-linecap="round"/>
        <path d="M12 76 Q36 70 48 76 T96 76 T144 76 T192 76" fill="none" stroke="rgba(47,149,184,0.82)" stroke-width="3" stroke-linecap="round"/>
        <path d="M12 78 Q40 42 54 78 T108 78 T162 78 T216 78" fill="none" stroke="rgba(199,168,96,0.82)" stroke-width="3" stroke-linecap="round"/>
        <rect x="12" y="10" width="196" height="16" rx="8" fill="rgba(255,255,255,0.52)" />
        <circle cx="32" cy="18" r="3.5" fill="rgba(201,106,88,0.95)" />
        <circle cx="50" cy="18" r="3.5" fill="rgba(63,137,104,0.92)" />
        <circle cx="68" cy="18" r="3.5" fill="rgba(47,149,184,0.92)" />
        <circle cx="86" cy="18" r="3.5" fill="rgba(199,168,96,0.92)" />
      </svg>
    `,
    qpcr: `
      <svg viewBox="0 0 220 96" role="presentation" focusable="false">
        <line x1="12" y1="78" x2="208" y2="78" stroke="rgba(23,39,57,0.18)" stroke-width="3" />
        <line x1="28" y1="18" x2="28" y2="78" stroke="rgba(23,39,57,0.18)" stroke-width="3" />
        <line x1="12" y1="48" x2="208" y2="48" stroke="rgba(201,106,88,0.4)" stroke-width="2.5" stroke-dasharray="7 7" />
        <path d="M28 76 C72 76, 98 74, 120 68 S162 48, 190 18" fill="none" stroke="rgba(47,149,184,0.92)" stroke-width="4.5" stroke-linecap="round" />
        <path d="M28 76 C82 76, 104 72, 128 60 S172 34, 198 12" fill="none" stroke="rgba(63,137,104,0.78)" stroke-width="3.5" stroke-linecap="round" />
        <circle cx="146" cy="51" r="5" fill="rgba(201,106,88,0.9)" />
      </svg>
    `,
    elisa: `
      <svg viewBox="0 0 220 96" role="presentation" focusable="false">
        <g fill="rgba(47,149,184,0.14)">
          <rect x="16" y="16" width="96" height="58" rx="18" />
          <circle cx="34" cy="34" r="8" />
          <circle cx="58" cy="34" r="8" />
          <circle cx="82" cy="34" r="8" />
          <circle cx="34" cy="58" r="8" />
          <circle cx="58" cy="58" r="8" />
          <circle cx="82" cy="58" r="8" />
        </g>
        <polyline points="128,76 148,60 168,40 188,30 208,18" fill="none" stroke="rgba(199,168,96,0.96)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="128" cy="76" r="4.6" fill="rgba(24,79,103,0.9)" />
        <circle cx="148" cy="60" r="4.6" fill="rgba(24,79,103,0.82)" />
        <circle cx="168" cy="40" r="4.6" fill="rgba(24,79,103,0.74)" />
        <circle cx="188" cy="30" r="4.6" fill="rgba(24,79,103,0.66)" />
        <circle cx="208" cy="18" r="4.6" fill="rgba(24,79,103,0.58)" />
      </svg>
    `,
    genotype: `
      <svg viewBox="0 0 220 96" role="presentation" focusable="false">
        <rect x="18" y="16" width="72" height="58" rx="18" fill="rgba(199,168,96,0.14)" />
        <rect x="102" y="16" width="100" height="58" rx="18" fill="rgba(24,79,103,0.08)" />
        <circle cx="40" cy="36" r="9" fill="rgba(201,106,88,0.92)" />
        <circle cx="68" cy="36" r="9" fill="rgba(47,149,184,0.92)" />
        <circle cx="54" cy="56" r="9" fill="rgba(63,137,104,0.88)" />
        <line x1="118" y1="34" x2="186" y2="34" stroke="rgba(23,39,57,0.24)" stroke-width="3" />
        <line x1="118" y1="56" x2="186" y2="56" stroke="rgba(23,39,57,0.24)" stroke-width="3" />
        <circle cx="132" cy="34" r="5" fill="rgba(47,149,184,0.92)" />
        <circle cx="158" cy="34" r="5" fill="rgba(201,106,88,0.88)" />
        <circle cx="184" cy="34" r="5" fill="rgba(47,149,184,0.58)" />
        <circle cx="132" cy="56" r="5" fill="rgba(63,137,104,0.92)" />
        <circle cx="158" cy="56" r="5" fill="rgba(201,106,88,0.68)" />
        <circle cx="184" cy="56" r="5" fill="rgba(63,137,104,0.56)" />
      </svg>
    `,
  };

  return svgByTheme[theme] || svgByTheme.ngs;
}

function buildHomepageHref(rawHref) {
  const href = String(rawHref || "").trim();
  if (!href) {
    return "#";
  }

  if (/^(?:[a-z]+:|\/)/i.test(href)) {
    return href;
  }

  return `${homepagePathPrefix}${href.replace(/^\.\//, "")}`;
}

function renderTopicCards() {
  const grid = document.querySelector("#topic-selector-grid");
  const copy = getHomepageCopy();
  if (!grid) {
    return;
  }

  const topicMarkup = Object.entries(copy.topics)
    .map(([topicKey, topic]) => {
      return `
        <button
          class="topic-selector-card topic-selector-card--${topic.theme}"
          type="button"
          data-topic-select="${topicKey}"
          aria-pressed="false"
          aria-expanded="false"
          aria-controls="topic-detail-${topicKey}"
          role="listitem"
        >
          <span class="topic-card-shell" aria-hidden="true"></span>
          <span class="topic-tag">${copy.topicTag}</span>
          <span
            class="topic-count-badge is-loading"
            data-topic-count="${topic.analyticsId}"
            title="${copy.countTitle}"
          >
            <span class="topic-count-label">${copy.countLabel}</span>
            <strong class="topic-count-value">${copy.countLoading}</strong>
          </span>
          <div class="topic-visual" aria-hidden="true">
            ${topicVisualSvg(topic.theme)}
          </div>
          <div class="topic-copy-stack">
            <h3>${topic.title}</h3>
            <p class="topic-subtitle">${topic.subtitle}</p>
          </div>
          <div class="topic-selector-meta">
            ${topic.chips.map((chip) => `<span>${chip}</span>`).join("")}
          </div>
          <div class="topic-card-detail" id="topic-detail-${topicKey}" hidden>
            <p>${topic.detail}</p>
            <span class="topic-card-action">${copy.actionHint}</span>
          </div>
        </button>
      `;
    })
    .join("");

  grid.innerHTML = topicMarkup;
}

function renderSelectionPlaceholder() {
  const selectionTitle = document.querySelector("#selection-title");
  const selectionCopy = document.querySelector("#selection-copy");
  const selectionContext = document.querySelector("#selection-context");
  const selectionOptions = document.querySelector("#selection-options");
  const copy = getHomepageCopy();

  if (selectionTitle) {
    selectionTitle.textContent = copy.selectionDefaultTitle;
  }
  if (selectionCopy) {
    selectionCopy.textContent = copy.selectionDefaultCopy;
  }
  if (selectionContext) {
    selectionContext.innerHTML = `<div class="topic-placeholder">${copy.selectionPlaceholder}</div>`;
  }
  if (selectionOptions) {
    selectionOptions.innerHTML = "";
  }
}

function formatTopicCount(topicId) {
  const copy = getHomepageCopy();
  if (!homepageTopicStats.has(topicId)) {
    return copy.countUnavailable;
  }

  const topicStats = homepageTopicStats.get(topicId);
  if (typeof topicStats.totalVisits !== "number") {
    return copy.countUnavailable;
  }

  return topicStats.totalVisits.toLocaleString();
}

function setTopicCountUnavailable() {
  const copy = getHomepageCopy();
  document.querySelectorAll("[data-topic-count]").forEach((badge) => {
    badge.classList.remove("is-loading");
    badge.classList.add("is-unavailable");
    badge.title = copy.countUnavailableTitle;
    const value = badge.querySelector(".topic-count-value");
    if (value) {
      value.textContent = copy.countUnavailable;
    }
  });
}

function updateTopicCountBadges() {
  const copy = getHomepageCopy();
  document.querySelectorAll("[data-topic-count]").forEach((badge) => {
    const topicId = badge.getAttribute("data-topic-count");
    const value = badge.querySelector(".topic-count-value");
    if (!value) {
      return;
    }

    badge.classList.remove("is-loading");
    value.textContent = formatTopicCount(topicId);
    badge.title = copy.countTitle;
    if (homepageTopicStats.has(topicId)) {
      badge.classList.remove("is-unavailable");
    }
  });
}

function renderSelection(topicKey) {
  const normalizedKey = normalizeHomepageTopicKey(topicKey);
  const copy = getHomepageCopy();
  const topic = copy.topics[normalizedKey];
  const selectorButtons = Array.from(document.querySelectorAll("[data-topic-select]"));
  const selectionTitle = document.querySelector("#selection-title");
  const selectionCopy = document.querySelector("#selection-copy");
  const selectionContext = document.querySelector("#selection-context");
  const selectionOptions = document.querySelector("#selection-options");

  if (!topic || !selectionTitle || !selectionCopy || !selectionContext || !selectionOptions) {
    return;
  }

  selectorButtons.forEach((button) => {
    const isActive = normalizeHomepageTopicKey(button.dataset.topicSelect) === normalizedKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.setAttribute("aria-expanded", isActive ? "true" : "false");
    const detail = button.querySelector(".topic-card-detail");
    if (detail) {
      detail.hidden = !isActive;
    }
  });

  selectionTitle.textContent = topic.title;
  selectionCopy.textContent = topic.panelLead;
  selectionContext.innerHTML = `
    <div class="topic-context-panel topic-context-panel--${topic.theme}">
      <div class="topic-context-copy">
        <span class="topic-entry-badge">${copy.selectedBadge}</span>
        <h3>${topic.title}</h3>
        <p>${topic.detail}</p>
      </div>
      <div class="topic-context-side">
        <div class="topic-context-count">
          <span>${copy.panelCountLabel}</span>
          <strong>${formatTopicCount(topic.analyticsId)}</strong>
        </div>
        <div class="topic-selector-meta">
          ${topic.chips.map((chip) => `<span>${chip}</span>`).join("")}
        </div>
      </div>
    </div>
  `;

  selectionOptions.innerHTML = topic.cards
    .map(
      (card) => `
        <a class="topic-entry-card topic-entry-card--${topic.theme}" href="${buildHomepageHref(
          card.href
        )}">
          <div class="topic-entry-topline">
            <span class="topic-entry-badge">${card.badge}</span>
            <span class="topic-entry-open">${copy.openLabel}</span>
          </div>
          <div class="topic-entry-visual" aria-hidden="true">
            ${topicVisualSvg(topic.theme)}
          </div>
          <h3>${card.title}</h3>
          <p>${card.description}</p>
          <div class="topic-selector-meta">
            ${card.chips.map((chip) => `<span>${chip}</span>`).join("")}
          </div>
        </a>
      `
    )
    .join("");

  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, "", `#${normalizedKey}`);
  }
}

async function loadTopicStats() {
  if (!homepageBackendApiUrl) {
    setTopicCountUnavailable();
    return;
  }

  try {
    const payload = await requestHomepageBackendAction("getTopicVisitStats", {
      site: homepageSiteLabel,
    });

    const topics = payload.topics || {};
    Object.entries(topics).forEach(([topicId, stats]) => {
      homepageTopicStats.set(topicId, {
        totalVisits: Number(stats.totalVisits || 0),
        uniqueVisitors: Number(stats.uniqueVisitors || 0),
      });
    });

    updateTopicCountBadges();
    const activeTopicKey = normalizeHomepageTopicKey(
      document.querySelector(".topic-selector-card.is-active")?.dataset.topicSelect || ""
    );
    if (activeTopicKey) {
      renderSelection(activeTopicKey);
    }
  } catch (error) {
    setTopicCountUnavailable();
  }
}

async function trackTopicVisit(topicKey) {
  const normalizedKey = normalizeHomepageTopicKey(topicKey);
  const topic = getHomepageCopy().topics[normalizedKey];

  if (!normalizedKey || !topic || !homepageBackendApiUrl || isTopicCooldownActive(topic.analyticsId)) {
    return;
  }

  if (homepagePendingTrackRequests.has(topic.analyticsId)) {
    return homepagePendingTrackRequests.get(topic.analyticsId);
  }

  const pendingRequest = requestHomepageBackendAction("trackTopicVisit", {
    visitorId: getHomepageReaderId(),
    topicId: topic.analyticsId,
    pageUrl: window.location.href,
    site: homepageSiteLabel,
  })
    .then((payload) => {
      const topics = payload.topics || {};
      Object.entries(topics).forEach(([topicId, stats]) => {
        homepageTopicStats.set(topicId, {
          totalVisits: Number(stats.totalVisits || 0),
          uniqueVisitors: Number(stats.uniqueVisitors || 0),
        });
      });

      if (payload.topicStats) {
        homepageTopicStats.set(topic.analyticsId, {
          totalVisits: Number(payload.topicStats.totalVisits || 0),
          uniqueVisitors: Number(payload.topicStats.uniqueVisitors || 0),
        });
      }

      setTopicCooldown(topic.analyticsId);
      updateTopicCountBadges();
      const activeTopicKey = normalizeHomepageTopicKey(
        document.querySelector(".topic-selector-card.is-active")?.dataset.topicSelect || ""
      );
      if (activeTopicKey) {
        renderSelection(activeTopicKey);
      }
    })
    .catch(() => {
      // Keep the homepage usable even when topic analytics are unavailable.
    })
    .finally(() => {
      homepagePendingTrackRequests.delete(topic.analyticsId);
    });

  homepagePendingTrackRequests.set(topic.analyticsId, pendingRequest);
  return pendingRequest;
}

function bindTopicSelection() {
  const selectorButtons = Array.from(document.querySelectorAll("[data-topic-select]"));

  selectorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const topicKey = normalizeHomepageTopicKey(button.dataset.topicSelect);
      renderSelection(topicKey);
      trackTopicVisit(topicKey);
      document.querySelector("#selection-panel")?.scrollIntoView({
        behavior: homepageReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  });
}

function initializeHomepage() {
  if (!document.querySelector("#topic-selector-grid")) {
    return;
  }

  renderTopicCards();
  renderSelectionPlaceholder();
  bindTopicSelection();
  loadTopicStats();

  const topicFromHash = normalizeHomepageTopicKey(window.location.hash.replace("#", ""));
  if (topicFromHash && getHomepageCopy().topics[topicFromHash]) {
    renderSelection(topicFromHash);
  }
}

initializeHomepage();
