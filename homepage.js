const homepageConfig = window.WAHJ_NGS_CONFIG || {};
const homepageBackendApiUrl = (homepageConfig.readerApiUrl || "").trim();
const homepageSiteLabel = (homepageConfig.siteLabel || "Wahj NGS Guide").trim();
const homepageLanguage = document.documentElement.lang === "ar" ? "ar" : "en";
const homepageReducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const homepageReaderIdStorageKey = "wahj-ngs-reader-id";
const homepageTopicCooldownStorageKey = "wahj-topic-visit-cooldowns-v1";
const homepageMotionPreferenceStorageKey = "wahj-homepage-motion-v1";
const homepageTopicCooldownMs = 30 * 60 * 1000;
const homepagePathPrefix = homepageLanguage === "ar" ? "../" : "./";

const homepageCopy = {
  en: {
    sceneChip: "Living molecular scene",
    sceneTitle: "Animated molecular workflow",
    sceneCopy:
      "Schematic scientific motion links DNA replication, gene expression, PCR, Sanger traces, ELISA signal, and genotype statistics.",
    sceneNote: "Schematic, not to scale",
    motionReduce: "Reduce motion",
    motionResume: "Resume motion",
    motionLiveLabel: "Scene motion on",
    motionReducedLabel: "Scene motion reduced",
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
    scenePanels: {
      ngs: "DNA replication and data stream",
      expression: "Gene expression pathway",
      qpcr: "PCR and qPCR signal",
      sanger: "Sanger chromatogram",
      elisa: "ELISA plate and standard curve",
      genotype: "Genotype comparison logic",
    },
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
    sceneChip: "مشهد جزيئي حي",
    sceneTitle: "سير عمل جزيئي متحرك",
    sceneCopy:
      "حركة علمية تخطيطية تربط تضاعف الحمض النووي، والتعبير الجيني، وPCR، وكروماتوغرام سانجر، وإشارة ELISA، وإحصاءات الأنماط الجينية.",
    sceneNote: "رسم تخطيطي غير مطابق للمقياس",
    motionReduce: "تقليل الحركة",
    motionResume: "استئناف الحركة",
    motionLiveLabel: "الحركة مفعلة",
    motionReducedLabel: "تم تقليل الحركة",
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
    scenePanels: {
      ngs: "تضاعف الحمض النووي وتيار البيانات",
      expression: "مسار التعبير الجيني",
      qpcr: "إشارة PCR وqPCR",
      sanger: "كروماتوغرام سانجر",
      elisa: "صفيحة ELISA والمنحنى القياسي",
      genotype: "منطق مقارنة الأنماط الجينية",
    },
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
let homepageManualMotionMode = "";
let homepageSceneInView = true;

function getHomepageCopy() {
  return homepageCopy[homepageLanguage];
}

function getStoredHomepageMotionMode() {
  try {
    return localStorage.getItem(homepageMotionPreferenceStorageKey) || "";
  } catch (error) {
    return "";
  }
}

function setStoredHomepageMotionMode(value) {
  try {
    if (!value) {
      localStorage.removeItem(homepageMotionPreferenceStorageKey);
      return;
    }
    localStorage.setItem(homepageMotionPreferenceStorageKey, value);
  } catch (error) {
    // Ignore storage errors and keep the in-memory preference.
  }
}

function isHomepageReducedMotion() {
  return homepageManualMotionMode === "reduce" || homepageReducedMotionQuery.matches;
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

function renderLivingScene() {
  const root = document.querySelector("#home-scene-root");
  const copy = getHomepageCopy();
  if (!root) {
    return;
  }

  const motionReduced = isHomepageReducedMotion();
  root.innerHTML = `
    <section
      class="molecular-scene"
      id="molecular-scene"
      data-active-topic="ngs"
      data-scene-play-state="${motionReduced ? "reduced" : "running"}"
      aria-label="${copy.sceneTitle}"
    >
      <div class="scene-atmosphere" aria-hidden="true">
        <span class="scene-particle scene-particle--1"></span>
        <span class="scene-particle scene-particle--2"></span>
        <span class="scene-particle scene-particle--3"></span>
        <span class="scene-particle scene-particle--4"></span>
      </div>
      <div class="molecular-scene-toolbar">
        <div class="molecular-scene-copy">
          <span class="signal-board-chip">${copy.sceneChip}</span>
          <h2>${copy.sceneTitle}</h2>
          <p>${copy.sceneCopy}</p>
        </div>
        <div class="molecular-scene-controls">
          <button
            type="button"
            class="motion-toggle"
            id="scene-motion-toggle"
            aria-pressed="${motionReduced ? "true" : "false"}"
          >
            ${motionReduced ? copy.motionResume : copy.motionReduce}
          </button>
          <span class="scene-motion-state" id="scene-motion-state">
            ${motionReduced ? copy.motionReducedLabel : copy.motionLiveLabel}
          </span>
        </div>
      </div>

      <div class="molecular-scene-grid">
        <article class="scene-panel scene-panel--wide scene-panel--ngs" data-scene-panel="ngs">
          <div class="scene-panel-head">
            <span class="scene-panel-tag">NGS</span>
            <strong>${copy.scenePanels.ngs}</strong>
          </div>
          <svg class="scene-svg" viewBox="0 0 360 156" aria-hidden="true" focusable="false">
            <text x="18" y="30" class="scene-svg-label">3'</text>
            <text x="316" y="30" class="scene-svg-label">5'</text>
            <text x="18" y="138" class="scene-svg-label">5'</text>
            <text x="316" y="138" class="scene-svg-label">3'</text>
            <path class="scene-strand scene-strand--template" d="M26 42 H334" />
            <path class="scene-strand scene-strand--new scene-animate-grow" d="M26 114 H266" />
            <path class="scene-strand scene-strand--new-ghost" d="M266 114 H334" />
            <g class="scene-rungs">
              <line x1="42" y1="50" x2="42" y2="106" />
              <line x1="68" y1="50" x2="68" y2="106" />
              <line x1="94" y1="50" x2="94" y2="106" />
              <line x1="120" y1="50" x2="120" y2="106" />
              <line x1="146" y1="50" x2="146" y2="106" />
              <line x1="172" y1="50" x2="172" y2="106" />
              <line x1="198" y1="50" x2="198" y2="106" />
              <line x1="224" y1="50" x2="224" y2="106" />
              <line x1="250" y1="50" x2="250" y2="106" />
            </g>
            <g class="scene-polymerase scene-animate-polymerase">
              <ellipse cx="0" cy="0" rx="30" ry="22" />
              <circle cx="-10" cy="-3" r="4" />
              <circle cx="8" cy="7" r="4" />
            </g>
            <g class="scene-nucleotides">
              <circle class="scene-animate-float-a" cx="244" cy="24" r="6" />
              <circle class="scene-animate-float-b" cx="268" cy="18" r="6" />
              <circle class="scene-animate-float-c" cx="294" cy="22" r="6" />
            </g>
            <g class="scene-data-stream">
              <rect x="282" y="66" width="52" height="44" rx="12" />
              <text x="308" y="84" text-anchor="middle" class="scene-svg-code">FASTQ</text>
              <text x="308" y="100" text-anchor="middle" class="scene-svg-code scene-animate-fade">A C G T</text>
            </g>
          </svg>
        </article>

        <article class="scene-panel scene-panel--wide scene-panel--expression" data-scene-panel="expression">
          <div class="scene-panel-head">
            <span class="scene-panel-tag">RNA</span>
            <strong>${copy.scenePanels.expression}</strong>
          </div>
          <svg class="scene-svg" viewBox="0 0 360 156" aria-hidden="true" focusable="false">
            <circle class="scene-nucleus" cx="86" cy="78" r="54" />
            <path class="scene-dna-loop" d="M46 66 C70 40, 92 100, 118 60 S156 48, 132 98" />
            <circle class="scene-rna-polymerase scene-animate-transcription" cx="112" cy="72" r="12" />
            <path class="scene-mrna-trail scene-animate-rna" d="M120 84 C144 96, 168 102, 196 102 S244 94, 282 98" />
            <text x="170" y="90" class="scene-svg-code">A U G</text>
            <g class="scene-ribosome scene-animate-ribosome">
              <ellipse cx="248" cy="98" rx="22" ry="16" />
              <ellipse cx="248" cy="112" rx="16" ry="10" />
            </g>
            <path class="scene-polypeptide scene-animate-polypeptide" d="M270 98 C286 92, 300 110, 312 90 S334 84, 340 106" />
            <path class="scene-folded-protein scene-animate-fold" d="M320 52 C336 36, 350 48, 344 66 C338 84, 314 84, 308 66 C302 52, 308 38, 320 52 Z" />
          </svg>
        </article>

        <article class="scene-panel scene-panel--qpcr" data-scene-panel="qpcr">
          <div class="scene-panel-head">
            <span class="scene-panel-tag">qPCR</span>
            <strong>${copy.scenePanels.qpcr}</strong>
          </div>
          <svg class="scene-svg" viewBox="0 0 240 132" aria-hidden="true" focusable="false">
            <g class="scene-wells scene-animate-glow">
              <rect x="20" y="22" width="30" height="56" rx="12" />
              <rect x="60" y="22" width="30" height="56" rx="12" />
              <rect x="100" y="22" width="30" height="56" rx="12" />
            </g>
            <line class="scene-axis" x1="150" y1="102" x2="222" y2="102" />
            <line class="scene-axis" x1="160" y1="28" x2="160" y2="102" />
            <line class="scene-threshold" x1="150" y1="64" x2="222" y2="64" />
            <path class="scene-curve scene-animate-curve" d="M160 100 C176 100, 186 96, 194 88 S210 62, 220 36" />
            <circle class="scene-curve-dot scene-animate-curve-dot" cx="0" cy="0" r="4.5" />
          </svg>
        </article>

        <article class="scene-panel scene-panel--sanger" data-scene-panel="sanger">
          <div class="scene-panel-head">
            <span class="scene-panel-tag">AB1</span>
            <strong>${copy.scenePanels.sanger}</strong>
          </div>
          <svg class="scene-svg" viewBox="0 0 240 132" aria-hidden="true" focusable="false">
            <rect class="scene-screen" x="18" y="16" width="204" height="88" rx="16" />
            <path class="scene-trace scene-trace--a" d="M28 92 Q44 52 58 92 T92 92 T126 92 T160 92 T194 92" />
            <path class="scene-trace scene-trace--c" d="M28 94 Q50 78 62 94 T108 94 T154 94 T200 94" />
            <path class="scene-trace scene-trace--g" d="M28 96 Q56 88 68 96 T124 96 T180 96" />
            <path class="scene-trace scene-trace--t" d="M28 98 Q60 44 74 98 T136 98 T198 98" />
            <rect class="scene-scan-bar scene-animate-scan" x="38" y="18" width="16" height="84" rx="8" />
            <text x="34" y="118" class="scene-svg-code">.ab1 / FASTA</text>
          </svg>
        </article>

        <article class="scene-panel scene-panel--elisa" data-scene-panel="elisa">
          <div class="scene-panel-head">
            <span class="scene-panel-tag">ELISA</span>
            <strong>${copy.scenePanels.elisa}</strong>
          </div>
          <svg class="scene-svg" viewBox="0 0 240 132" aria-hidden="true" focusable="false">
            <g class="scene-plate">
              <rect x="16" y="18" width="112" height="86" rx="20" />
              <circle class="scene-well-fill scene-well-fill--1" cx="38" cy="42" r="10" />
              <circle class="scene-well-fill scene-well-fill--2" cx="72" cy="42" r="10" />
              <circle class="scene-well-fill scene-well-fill--3" cx="106" cy="42" r="10" />
              <circle class="scene-well-fill scene-well-fill--4" cx="38" cy="76" r="10" />
              <circle class="scene-well-fill scene-well-fill--5" cx="72" cy="76" r="10" />
              <circle class="scene-well-fill scene-well-fill--6" cx="106" cy="76" r="10" />
            </g>
            <line class="scene-axis" x1="150" y1="100" x2="220" y2="100" />
            <line class="scene-axis" x1="160" y1="28" x2="160" y2="100" />
            <path class="scene-curve scene-animate-curve" d="M160 96 C174 86, 188 72, 198 58 S214 36, 220 24" />
          </svg>
        </article>

        <article class="scene-panel scene-panel--genotype" data-scene-panel="genotype">
          <div class="scene-panel-head">
            <span class="scene-panel-tag">HWE</span>
            <strong>${copy.scenePanels.genotype}</strong>
          </div>
          <svg class="scene-svg" viewBox="0 0 240 132" aria-hidden="true" focusable="false">
            <g class="scene-genotype-groups">
              <circle class="scene-allele scene-animate-gentle scene-allele--a" cx="34" cy="40" r="9" />
              <circle class="scene-allele scene-animate-gentle scene-allele--b" cx="62" cy="40" r="9" />
              <circle class="scene-allele scene-animate-gentle scene-allele--c" cx="48" cy="68" r="9" />
              <circle class="scene-allele scene-animate-gentle scene-allele--d" cx="92" cy="40" r="9" />
              <circle class="scene-allele scene-animate-gentle scene-allele--e" cx="120" cy="40" r="9" />
              <circle class="scene-allele scene-animate-gentle scene-allele--f" cx="106" cy="68" r="9" />
            </g>
            <g class="scene-or-table">
              <rect x="150" y="24" width="68" height="64" rx="14" />
              <line x1="184" y1="24" x2="184" y2="88" />
              <line x1="150" y1="56" x2="218" y2="56" />
              <text x="166" y="46" class="scene-svg-code">a</text>
              <text x="198" y="46" class="scene-svg-code">b</text>
              <text x="166" y="76" class="scene-svg-code">c</text>
              <text x="198" y="76" class="scene-svg-code">d</text>
            </g>
          </svg>
        </article>
      </div>

      <p class="scene-footnote">${copy.sceneNote}</p>
    </section>
  `;

  const motionButton = root.querySelector("#scene-motion-toggle");
  if (motionButton) {
    motionButton.addEventListener("click", () => {
      homepageManualMotionMode = isHomepageReducedMotion() ? "" : "reduce";
      setStoredHomepageMotionMode(homepageManualMotionMode);
      applyHomepageSceneMotionState();
    });
  }
}

function applyHomepageSceneMotionState() {
  const scene = document.querySelector("#molecular-scene");
  const motionButton = document.querySelector("#scene-motion-toggle");
  const motionState = document.querySelector("#scene-motion-state");
  const copy = getHomepageCopy();
  if (!scene) {
    return;
  }

  const reduced = isHomepageReducedMotion();
  const playState = reduced ? "reduced" : homepageSceneInView ? "running" : "paused";
  scene.dataset.scenePlayState = playState;

  if (motionButton) {
    motionButton.textContent = reduced ? copy.motionResume : copy.motionReduce;
    motionButton.setAttribute("aria-pressed", reduced ? "true" : "false");
  }

  if (motionState) {
    motionState.textContent = reduced ? copy.motionReducedLabel : copy.motionLiveLabel;
  }
}

function setSceneTopic(topicKey) {
  const scene = document.querySelector("#molecular-scene");
  if (!scene) {
    return;
  }
  const normalizedKey = normalizeHomepageTopicKey(topicKey) || "ngs";
  scene.dataset.activeTopic = normalizedKey;
}

function initializeHomepageSceneMotion() {
  homepageManualMotionMode = getStoredHomepageMotionMode();
  applyHomepageSceneMotionState();

  if (typeof IntersectionObserver === "function") {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        homepageSceneInView = Boolean(entry?.isIntersecting);
        applyHomepageSceneMotionState();
      },
      { threshold: 0.15 }
    );
    const shell = document.querySelector("#home-scene-shell");
    if (shell) {
      observer.observe(shell);
    }
  }

  if (typeof homepageReducedMotionQuery.addEventListener === "function") {
    homepageReducedMotionQuery.addEventListener("change", () => {
      if (!homepageManualMotionMode) {
        applyHomepageSceneMotionState();
      }
    });
  }
}

function topicVisualSvg(theme) {
  const svgByTheme = {
    ngs: `
      <svg viewBox="0 0 220 110" role="presentation" focusable="false">
        <rect x="12" y="14" width="70" height="40" rx="16" fill="rgba(47,149,184,0.1)" />
        <rect x="98" y="18" width="110" height="32" rx="16" fill="rgba(24,79,103,0.08)" />
        <path d="M24 78 C48 46, 72 94, 96 64 S144 28, 170 52 S198 82, 210 62" fill="none" stroke="rgba(47,149,184,0.95)" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M24 90 C48 58, 72 106, 96 76 S144 40, 170 64 S198 94, 210 74" fill="none" stroke="rgba(24,79,103,0.42)" stroke-width="3.5" stroke-linecap="round"/>
        <text x="30" y="40" class="scene-svg-code">FASTQ</text>
        <text x="128" y="39" class="scene-svg-code">ALIGN</text>
      </svg>
    `,
    sanger: `
      <svg viewBox="0 0 220 110" role="presentation" focusable="false">
        <rect x="12" y="12" width="196" height="76" rx="18" fill="rgba(255,255,255,0.74)" stroke="rgba(201,106,88,0.18)"/>
        <path d="M20 80 Q36 34 48 80 T78 80 T108 80 T138 80 T168 80 T198 80" fill="none" stroke="rgba(201,106,88,0.9)" stroke-width="4" stroke-linecap="round"/>
        <path d="M20 82 Q40 66 52 82 T92 82 T132 82 T172 82 T212 82" fill="none" stroke="rgba(63,137,104,0.86)" stroke-width="3" stroke-linecap="round"/>
        <path d="M20 84 Q42 76 58 84 T108 84 T158 84 T208 84" fill="none" stroke="rgba(47,149,184,0.82)" stroke-width="3" stroke-linecap="round"/>
        <path d="M20 86 Q46 38 64 86 T128 86 T192 86" fill="none" stroke="rgba(199,168,96,0.85)" stroke-width="3" stroke-linecap="round"/>
        <text x="24" y="102" class="scene-svg-code">.ab1</text>
        <text x="70" y="102" class="scene-svg-code">FASTA</text>
      </svg>
    `,
    qpcr: `
      <svg viewBox="0 0 220 110" role="presentation" focusable="false">
        <rect x="16" y="18" width="24" height="52" rx="10" fill="rgba(63,137,104,0.14)" />
        <rect x="48" y="18" width="24" height="52" rx="10" fill="rgba(63,137,104,0.14)" />
        <rect x="80" y="18" width="24" height="52" rx="10" fill="rgba(63,137,104,0.14)" />
        <line x1="126" y1="88" x2="210" y2="88" stroke="rgba(23,39,57,0.18)" stroke-width="3" />
        <line x1="136" y1="24" x2="136" y2="88" stroke="rgba(23,39,57,0.18)" stroke-width="3" />
        <line x1="126" y1="56" x2="210" y2="56" stroke="rgba(201,106,88,0.36)" stroke-width="2.5" stroke-dasharray="7 7" />
        <path d="M136 86 C152 86, 164 84, 172 74 S190 50, 206 26" fill="none" stroke="rgba(47,149,184,0.92)" stroke-width="4.5" stroke-linecap="round" />
        <text x="146" y="104" class="scene-svg-code">Ct</text>
      </svg>
    `,
    elisa: `
      <svg viewBox="0 0 220 110" role="presentation" focusable="false">
        <rect x="16" y="18" width="92" height="66" rx="18" fill="rgba(199,168,96,0.14)" />
        <circle cx="36" cy="40" r="9" fill="rgba(199,168,96,0.42)" />
        <circle cx="62" cy="40" r="9" fill="rgba(199,168,96,0.58)" />
        <circle cx="88" cy="40" r="9" fill="rgba(199,168,96,0.74)" />
        <circle cx="36" cy="66" r="9" fill="rgba(199,168,96,0.32)" />
        <circle cx="62" cy="66" r="9" fill="rgba(199,168,96,0.52)" />
        <circle cx="88" cy="66" r="9" fill="rgba(199,168,96,0.88)" />
        <line x1="132" y1="86" x2="210" y2="86" stroke="rgba(23,39,57,0.18)" stroke-width="3" />
        <line x1="142" y1="24" x2="142" y2="86" stroke="rgba(23,39,57,0.18)" stroke-width="3" />
        <path d="M142 80 C154 72, 168 58, 180 44 S200 24, 210 18" fill="none" stroke="rgba(24,79,103,0.92)" stroke-width="4.2" stroke-linecap="round" />
        <text x="146" y="104" class="scene-svg-code">OD</text>
      </svg>
    `,
    genotype: `
      <svg viewBox="0 0 220 110" role="presentation" focusable="false">
        <circle cx="38" cy="36" r="9" fill="rgba(201,106,88,0.92)" />
        <circle cx="66" cy="36" r="9" fill="rgba(47,149,184,0.92)" />
        <circle cx="52" cy="64" r="9" fill="rgba(63,137,104,0.88)" />
        <circle cx="96" cy="36" r="9" fill="rgba(201,106,88,0.72)" />
        <circle cx="124" cy="36" r="9" fill="rgba(47,149,184,0.72)" />
        <circle cx="110" cy="64" r="9" fill="rgba(63,137,104,0.72)" />
        <rect x="150" y="20" width="54" height="48" rx="12" fill="rgba(88,119,180,0.1)" stroke="rgba(88,119,180,0.24)" />
        <line x1="177" y1="20" x2="177" y2="68" stroke="rgba(88,119,180,0.24)" />
        <line x1="150" y1="44" x2="204" y2="44" stroke="rgba(88,119,180,0.24)" />
        <text x="158" y="38" class="scene-svg-code">a</text>
        <text x="184" y="38" class="scene-svg-code">b</text>
        <text x="158" y="58" class="scene-svg-code">c</text>
        <text x="184" y="58" class="scene-svg-code">d</text>
        <text x="150" y="92" class="scene-svg-code">OR</text>
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
          <div class="topic-card-head">
            <span class="topic-tag">${copy.topicTag}</span>
            <span
              class="topic-count-badge is-loading"
              data-topic-count="${topic.analyticsId}"
              title="${copy.countTitle}"
            >
              <span class="topic-count-label">${copy.countLabel}</span>
              <strong class="topic-count-value">${copy.countLoading}</strong>
            </span>
          </div>
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
  setSceneTopic("ngs");
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
  setSceneTopic(normalizedKey);
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
        behavior: isHomepageReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    });
  });
}

function initializeHomepage() {
  if (!document.querySelector("#topic-selector-grid")) {
    return;
  }

  renderLivingScene();
  initializeHomepageSceneMotion();
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
