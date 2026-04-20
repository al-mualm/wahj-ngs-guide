const appConfig = window.WAHJ_NGS_CONFIG || {};
const registrationApiUrl = (appConfig.registrationApiUrl || "").trim();
const storageKey = "wahj-ngs-registration-v1";
const sessionKey = "wahj-ngs-session-id";
const uiLanguageKey = "wahj-ngs-ui-language";

const body = document.body;
const registrationGate = document.querySelector("#registration-gate");
const gatePanel = document.querySelector("#gate-panel");
const registrationForm = document.querySelector("#registration-form");
const closeGateButton = document.querySelector("#close-gate");
const editRegistrationButton = document.querySelector("#edit-registration");
const gateStatus = document.querySelector("#gate-status");
const visitorCount = document.querySelector("#visitor-count");
const visitorCountLabel = document.querySelector("#visitor-count-label");
const visitorCountNote = document.querySelector("#visitor-count-note");
const registrationSummary = document.querySelector("#registration-summary");
const languageButtons = Array.from(document.querySelectorAll("[data-ui-lang]"));
const preferredLanguageSelect = document.querySelector("#preferred-language");
const navToggle = document.querySelector(".nav-toggle");
const primaryNav = document.querySelector(".primary-nav");
const navLinks = Array.from(document.querySelectorAll(".primary-nav a"));
const revealItems = document.querySelectorAll(".reveal");
const glossarySearch = document.querySelector("#glossary-search");
const glossaryCards = document.querySelectorAll(".glossary-card");

const translations = {
  en: {
    gateEyebrow: "Access Registration",
    gateTitle: "Welcome to the Wahj NGS learning page",
    gateIntro:
      "Please enter your details before opening the guide. Your registration is stored securely for visitor logging and follow-up reporting.",
    fullNameLabel: "Full name",
    fullNamePlaceholder: "Your full name",
    emailLabel: "Email address",
    emailPlaceholder: "name@example.com",
    phoneLabel: "Phone number",
    phonePlaceholder: "+964...",
    affiliationLabel: "Affiliation / workplace",
    affiliationPlaceholder: "University, company, laboratory, or hospital",
    preferredLanguageLabel: "Preferred language",
    preferredLanguageEnglish: "English",
    preferredLanguageArabic: "Arabic",
    submitLabel: "Save and open the guide",
    defaultStatus:
      "Your details will be stored in a protected Google Sheet used for visitor logging.",
    privacyNote:
      "We count unique registered visitors by phone number so the final counter reflects real registrations rather than anonymous page refreshes.",
    visitorCountLabel: "Unique registered visitors:",
    visitorCountPending: "Backend setup pending",
    visitorCountError: "Unable to load count right now",
    visitorCountNote:
      "This number is stored outside the browser and is based on successful registrations.",
    waitingRegistration: "Waiting for registration data.",
    savedSummary: "Registered as {name} | {affiliation} | preferred language: {language}",
    editRegistration: "Update registration details",
    editStatus: "You can update your details and submit again if needed.",
    submitting: "Saving your registration...",
    success: "Registration saved successfully.",
    repeatSuccess:
      "Your details were already known, so the visitor count stayed accurate and your access was refreshed.",
    previewSuccess:
      "Local preview mode only: the page is unlocked, but registrations are not being sent to Google Sheets yet.",
    backendMissing:
      "The Google Sheets backend is not connected yet, so public registrations cannot be saved.",
    validationError: "Please complete your name, email, phone number, affiliation, and language.",
    saveError:
      "We could not save your registration right now. Please try again in a moment.",
  },
  ar: {
    gateEyebrow: "تسجيل الدخول إلى الصفحة",
    gateTitle: "مرحباً بك في صفحة وهج التعليمية عن NGS",
    gateIntro:
      "يرجى إدخال معلوماتك قبل فتح الدليل. سيتم حفظ التسجيل بشكل آمن لاستخدامه في عدّ الزوار والتقارير.",
    fullNameLabel: "الاسم الكامل",
    fullNamePlaceholder: "اكتب اسمك الكامل",
    emailLabel: "البريد الإلكتروني",
    emailPlaceholder: "name@example.com",
    phoneLabel: "رقم الهاتف",
    phonePlaceholder: "+964...",
    affiliationLabel: "الانتماء أو مكان العمل",
    affiliationPlaceholder: "جامعة أو شركة أو مختبر أو مستشفى",
    preferredLanguageLabel: "اللغة المفضلة",
    preferredLanguageEnglish: "الإنجليزية",
    preferredLanguageArabic: "العربية",
    submitLabel: "احفظ البيانات وافتح الدليل",
    defaultStatus:
      "سيتم حفظ بياناتك في Google Sheet محمية ومخصصة لتسجيل الزوار.",
    privacyNote:
      "يتم احتساب الزوار المسجلين الفريدين باستخدام رقم الهاتف حتى يعكس العداد الزوار الحقيقيين وليس مجرد تحديث الصفحة.",
    visitorCountLabel: "عدد الزوار المسجلين الفريدين:",
    visitorCountPending: "إعداد الربط ما زال غير مكتمل",
    visitorCountError: "تعذر تحميل عدد الزوار حالياً",
    visitorCountNote:
      "هذا الرقم محفوظ خارج المتصفح ويعتمد على التسجيلات الناجحة.",
    waitingRegistration: "بانتظار بيانات التسجيل.",
    savedSummary: "تم التسجيل باسم {name} | {affiliation} | اللغة المفضلة: {language}",
    editRegistration: "تحديث بيانات التسجيل",
    editStatus: "يمكنك تعديل بياناتك وإرسالها مرة أخرى عند الحاجة.",
    submitting: "جارٍ حفظ التسجيل...",
    success: "تم حفظ التسجيل بنجاح.",
    repeatSuccess:
      "كانت بياناتك موجودة مسبقاً، لذلك بقي عداد الزوار دقيقاً وتم تحديث الوصول.",
    previewSuccess:
      "وضع معاينة محلي فقط: تم فتح الصفحة، لكن لم يتم إرسال البيانات إلى Google Sheets بعد.",
    backendMissing:
      "ربط Google Sheets غير جاهز بعد، لذلك لا يمكن حفظ التسجيلات العامة حالياً.",
    validationError: "يرجى إدخال الاسم والبريد الإلكتروني ورقم الهاتف والانتماء واللغة.",
    saveError: "تعذر حفظ التسجيل الآن. حاول مرة أخرى بعد قليل.",
  },
};

function getCurrentUiLanguage() {
  return localStorage.getItem(uiLanguageKey) || "en";
}

function setCurrentUiLanguage(language) {
  const uiLanguage = translations[language] ? language : "en";
  localStorage.setItem(uiLanguageKey, uiLanguage);
  gatePanel.setAttribute("dir", uiLanguage === "ar" ? "rtl" : "ltr");
  gatePanel.setAttribute("lang", uiLanguage);

  languageButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.uiLang === uiLanguage);
  });

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (translations[uiLanguage][key]) {
      element.textContent = translations[uiLanguage][key];
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (translations[uiLanguage][key]) {
      element.setAttribute("placeholder", translations[uiLanguage][key]);
    }
  });

  visitorCountLabel.textContent = translations[uiLanguage].visitorCountLabel;
  visitorCountNote.textContent = translations[uiLanguage].visitorCountNote;
  if (editRegistrationButton) {
    editRegistrationButton.textContent = translations[uiLanguage].editRegistration;
  }
}

function setGateStatus(messageKey, tone = "") {
  const uiLanguage = getCurrentUiLanguage();
  gateStatus.classList.remove("is-error", "is-success");
  if (tone) {
    gateStatus.classList.add(tone);
  }

  gateStatus.textContent = translations[uiLanguage][messageKey] || messageKey;
}

function loadStoredRegistration() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "null");
  } catch (error) {
    return null;
  }
}

function saveStoredRegistration(profile) {
  localStorage.setItem(storageKey, JSON.stringify(profile));
}

function openGate() {
  body.classList.add("gate-active");
}

function closeGate() {
  const saved = loadStoredRegistration();
  if (!saved) {
    return;
  }
  body.classList.remove("gate-active");
}

function unlockSite(profile) {
  body.classList.remove("gate-active");
  closeGateButton.hidden = false;
  editRegistrationButton.hidden = false;
  updateRegistrationSummary(profile);
}

function updateRegistrationSummary(profile) {
  if (!profile) {
    registrationSummary.textContent = translations[getCurrentUiLanguage()].waitingRegistration;
    return;
  }

  const uiLanguage = getCurrentUiLanguage();
  const displayLanguage =
    profile.preferredLanguage === "ar"
      ? translations[uiLanguage].preferredLanguageArabic
      : translations[uiLanguage].preferredLanguageEnglish;

  registrationSummary.textContent = translations[uiLanguage].savedSummary
    .replace("{name}", profile.fullName)
    .replace("{affiliation}", profile.affiliation)
    .replace("{language}", displayLanguage);
}

function fillRegistrationForm(profile) {
  if (!profile || !registrationForm) {
    return;
  }

  registrationForm.full_name.value = profile.fullName || "";
  registrationForm.email_address.value = profile.emailAddress || "";
  registrationForm.phone_number.value = profile.phoneNumber || "";
  registrationForm.affiliation.value = profile.affiliation || "";
  registrationForm.preferred_language.value = profile.preferredLanguage || "en";
}

function getSessionId() {
  let sessionId = sessionStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(sessionKey, sessionId);
  }
  return sessionId;
}

function normalizePhoneNumber(phoneNumber) {
  const trimmed = phoneNumber.trim();
  if (!trimmed) {
    return "";
  }

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  return hasPlus ? `+${digits}` : digits;
}

function renderVisitorStats(stats) {
  const uiLanguage = getCurrentUiLanguage();
  if (!stats) {
    visitorCount.textContent = translations[uiLanguage].visitorCountError;
    return;
  }

  const uniqueVisitors =
    stats.uniqueVisitors ??
    stats.unique_phone_visitors ??
    stats.uniquePhoneVisitors ??
    stats.totalSubmissions ??
    0;

  visitorCount.textContent = String(uniqueVisitors);
}

async function fetchVisitorStats() {
  const uiLanguage = getCurrentUiLanguage();
  if (!registrationApiUrl) {
    visitorCount.textContent = translations[uiLanguage].visitorCountPending;
    return;
  }

  try {
    const response = await fetch(
      `${registrationApiUrl}?action=stats&site=${encodeURIComponent(appConfig.siteLabel || "Wahj NGS Guide")}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error("Failed to fetch visitor stats");
    }

    renderVisitorStats(data.stats);
  } catch (error) {
    visitorCount.textContent = translations[uiLanguage].visitorCountError;
  }
}

if (navToggle && primaryNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = primaryNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      primaryNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const sectionIds = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      const id = `#${entry.target.id}`;
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === id);
      });
    });
  },
  {
    rootMargin: "-30% 0px -55% 0px",
    threshold: 0.1,
  }
);

sectionIds.forEach((section) => sectionObserver.observe(section));

const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  },
  {
    threshold: 0.1,
  }
);

revealItems.forEach((item) => revealObserver.observe(item));

if (glossarySearch) {
  glossarySearch.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();

    glossaryCards.forEach((card) => {
      const haystack = `${card.dataset.term || ""} ${card.textContent}`.toLowerCase();
      card.classList.toggle("hidden", !haystack.includes(query));
    });
  });
}

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const gateWasActive = body.classList.contains("gate-active");
    const saved = loadStoredRegistration();
    setCurrentUiLanguage(button.dataset.uiLang);

    if (saved) {
      updateRegistrationSummary(saved);
      if (!gateWasActive) {
        unlockSite(saved);
      }
      return;
    }

    registrationSummary.textContent = translations[getCurrentUiLanguage()].waitingRegistration;
  });
});

if (closeGateButton) {
  closeGateButton.addEventListener("click", () => {
    setGateStatus("editStatus");
    closeGate();
  });
}

if (editRegistrationButton) {
  editRegistrationButton.addEventListener("click", () => {
    const saved = loadStoredRegistration();
    if (saved) {
      fillRegistrationForm(saved);
      registrationForm.preferred_language.value = saved.preferredLanguage || "en";
    }
    openGate();
    setGateStatus("editStatus");
  });
}

if (registrationForm) {
  registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = registrationForm.full_name.value.trim();
    const emailAddress = registrationForm.email_address.value.trim();
    const phoneNumber = registrationForm.phone_number.value.trim();
    const affiliation = registrationForm.affiliation.value.trim();
    const preferredLanguage = registrationForm.preferred_language.value;
    const honeypot = registrationForm.website.value.trim();

    if (honeypot) {
      return;
    }

    if (!fullName || !emailAddress || !phoneNumber || !affiliation || !preferredLanguage) {
      setGateStatus("validationError", "is-error");
      return;
    }

    const profile = {
      fullName,
      emailAddress,
      phoneNumber,
      affiliation,
      preferredLanguage,
      registeredAt: new Date().toISOString(),
    };

    const localPreviewAllowed =
      location.protocol === "file:" ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1";

    if (!registrationApiUrl) {
      if (!localPreviewAllowed) {
        setGateStatus("backendMissing", "is-error");
        return;
      }

      saveStoredRegistration(profile);
      unlockSite(profile);
      renderVisitorStats(null);
      setGateStatus("previewSuccess", "is-success");
      return;
    }

    const submitButton = document.querySelector("#registration-submit");
    submitButton.disabled = true;
    setGateStatus("submitting");

    try {
      const response = await fetch(registrationApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "register",
          fullName,
          emailAddress,
          phoneNumber: normalizePhoneNumber(phoneNumber),
          affiliation,
          preferredLanguage,
          sessionId: getSessionId(),
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          siteLabel: appConfig.siteLabel || "Wahj NGS Guide",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to save registration");
      }

      saveStoredRegistration(profile);
      renderVisitorStats(data.stats);
      unlockSite(profile);
      setGateStatus(data.duplicate ? "repeatSuccess" : "success", "is-success");
    } catch (error) {
      setGateStatus("saveError", "is-error");
    } finally {
      submitButton.disabled = false;
    }
  });
}

const savedRegistration = loadStoredRegistration();
setCurrentUiLanguage(savedRegistration?.preferredLanguage || getCurrentUiLanguage());

if (savedRegistration) {
  fillRegistrationForm(savedRegistration);
  unlockSite(savedRegistration);
} else {
  registrationSummary.textContent = translations[getCurrentUiLanguage()].waitingRegistration;
  openGate();
}

fetchVisitorStats();
