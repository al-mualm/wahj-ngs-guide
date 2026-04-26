const appConfig = window.WAHJ_NGS_CONFIG || {};
const backendApiUrl = (appConfig.readerApiUrl || appConfig.registrationApiUrl || "").trim();
const siteLabel = (appConfig.siteLabel || "Wahj NGS Guide").trim();
const commentsLimit = Number(appConfig.commentsLimit || 6);
const pageLanguage = document.documentElement.lang === "ar" ? "ar" : "en";
const readerIdStorageKey = "wahj-ngs-reader-id";

const messages = {
  en: {
    readerReady:
      "Anonymous reader count updates automatically. No personal information is collected.",
    readerMissing: "Anonymous reader counter is not connected right now.",
    readerFallback: "Reader count loaded, but this device could not update the counter right now.",
    readerError: "The anonymous reader counter is temporarily unavailable.",
    commentLoading: "Loading recent comments...",
    commentReady: "Comments load automatically from the live site backend.",
    commentSuccess: "Your comment was saved and added to the live comments list.",
    commentValidation:
      "Please complete your name, professional title, affiliation, and comment.",
    commentBusy: "Saving your comment...",
    commentError: "We could not save your comment right now. Please try again in a moment.",
    commentEmptyTitle: "No comments yet",
    commentEmptyBody: "The first professional comment will appear here.",
    commentMetaSeparator: " | ",
  },
  ar: {
    readerReady:
      "يتم تحديث عداد القرّاء المجهول تلقائياً من دون جمع أي معلومات شخصية.",
    readerMissing: "عداد القرّاء غير مرتبط حالياً بالخدمة الخلفية.",
    readerFallback:
      "تم تحميل عدد القرّاء، لكن هذا الجهاز لم يتمكن من تحديث العداد في هذه اللحظة.",
    readerError: "عداد القرّاء المجهول غير متاح مؤقتاً.",
    commentLoading: "يتم الآن تحميل أحدث التعليقات...",
    commentReady: "يتم تحميل التعليقات تلقائياً من الخدمة الخلفية للموقع.",
    commentSuccess: "تم حفظ تعليقك وإضافته إلى قائمة التعليقات الظاهرة.",
    commentValidation:
      "يرجى إدخال الاسم والصفة المهنية والانتماء ونص التعليق.",
    commentBusy: "يتم الآن حفظ التعليق...",
    commentError: "تعذر حفظ التعليق حالياً. يرجى المحاولة مرة أخرى بعد قليل.",
    commentEmptyTitle: "لا توجد تعليقات بعد",
    commentEmptyBody: "سيظهر أول تعليق مهني هنا.",
    commentMetaSeparator: " | ",
  },
};

const navToggle = document.querySelector(".nav-toggle");
const primaryNav = document.querySelector(".primary-nav");
const navLinks = Array.from(document.querySelectorAll(".primary-nav a"));
const revealItems = Array.from(document.querySelectorAll(".reveal"));
const glossarySearch = document.querySelector("#glossary-search");
const glossaryCards = Array.from(document.querySelectorAll(".glossary-card"));
const readerCountElements = [
  document.querySelector("#reader-count"),
  document.querySelector("#footer-reader-count"),
].filter(Boolean);
const readerNote = document.querySelector("#reader-note");
const commentForm = document.querySelector("#comment-form");
const commentSubmitButton = document.querySelector("#comment-submit");
const commentStatus = document.querySelector("#comment-status");
const commentsList = document.querySelector("#comments-list");

function getMessage(key) {
  return messages[pageLanguage][key] || key;
}

function setReaderCount(value) {
  const text = typeof value === "number" ? value.toLocaleString() : String(value);
  readerCountElements.forEach((element) => {
    element.textContent = text;
  });
}

function setReaderNote(message, tone = "") {
  if (!readerNote) {
    return;
  }

  readerNote.textContent = message;
  readerNote.classList.toggle("is-error", tone === "error");
}

function setCommentStatus(message, tone = "") {
  if (!commentStatus) {
    return;
  }

  commentStatus.textContent = message;
  commentStatus.classList.remove("is-error", "is-success");
  if (tone) {
    commentStatus.classList.add(tone === "error" ? "is-error" : "is-success");
  }
}

function createId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getReaderId() {
  try {
    const existingId = localStorage.getItem(readerIdStorageKey);
    if (existingId) {
      return existingId;
    }

    const newId = createId("reader");
    localStorage.setItem(readerIdStorageKey, newId);
    return newId;
  } catch (error) {
    return createId("reader");
  }
}

function normalizeStats(stats) {
  if (!stats) {
    return {
      uniqueVisitors: 0,
      totalVisits: 0,
      lastUpdatedUtc: "",
    };
  }

  return {
    uniqueVisitors: Number(
      stats.uniqueVisitors ?? stats.readerCount ?? stats.uniqueReaders ?? 0
    ),
    totalVisits: Number(stats.totalVisits ?? stats.totalSubmissions ?? 0),
    lastUpdatedUtc: stats.lastUpdatedUtc || "",
  };
}

function renderReaderStats(stats) {
  const normalizedStats = normalizeStats(stats);
  setReaderCount(normalizedStats.uniqueVisitors);
}

function loadJsonp(url, callbackName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while loading backend response."));
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
      reject(new Error("Unable to contact the site backend."));
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

async function requestBackendAction(action, extraParams = {}) {
  if (!backendApiUrl) {
    throw new Error("Backend API URL is missing.");
  }

  const callbackName = `wahjBackendCallback_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const url = new URL(backendApiUrl);
  url.searchParams.set("action", action);
  url.searchParams.set("callback", callbackName);

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const payload = await loadJsonp(url.toString(), callbackName);
  if (!payload || !payload.ok) {
    throw new Error(payload?.error || "Backend request failed.");
  }

  return payload;
}

async function initializeReaderCounter() {
  if (!readerCountElements.length) {
    return;
  }

  if (!backendApiUrl) {
    setReaderCount("N/A");
    setReaderNote(getMessage("readerMissing"), "error");
    return;
  }

  setReaderCount("...");

  try {
    const visitPayload = await requestBackendAction("visit", {
      visitorId: getReaderId(),
      pageUrl: window.location.href,
      site: siteLabel,
    });

    renderReaderStats(visitPayload.stats);
    setReaderNote(getMessage("readerReady"));
  } catch (visitError) {
    try {
      const statsPayload = await requestBackendAction("stats", {
        site: siteLabel,
      });

      renderReaderStats(statsPayload.stats);
      setReaderNote(getMessage("readerFallback"));
    } catch (statsError) {
      setReaderCount("Unavailable");
      setReaderNote(getMessage("readerError"), "error");
      console.error(visitError);
      console.error(statsError);
    }
  }
}

function normalizeComments(comments) {
  if (!Array.isArray(comments)) {
    return [];
  }

  return comments
    .map((comment) => ({
      id: comment.id || "",
      displayName: comment.displayName || comment.name || "",
      professionalTitle: comment.professionalTitle || comment.title || "",
      affiliation: comment.affiliation || "",
      commentText: comment.commentText || comment.comment || "",
      submittedAt: comment.submittedAt || comment.submitted_at || "",
    }))
    .filter((comment) => comment.displayName && comment.commentText);
}

function formatCommentDate(dateString) {
  if (!dateString) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(pageLanguage === "ar" ? "ar-IQ" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(dateString));
  } catch (error) {
    return dateString;
  }
}

function renderEmptyComments() {
  if (!commentsList) {
    return;
  }

  commentsList.replaceChildren();

  const card = document.createElement("article");
  card.className = "comment-card comment-card-empty";

  const title = document.createElement("h4");
  title.textContent = getMessage("commentEmptyTitle");

  const body = document.createElement("p");
  body.textContent = getMessage("commentEmptyBody");

  card.append(title, body);
  commentsList.append(card);
}

function renderComments(comments) {
  if (!commentsList) {
    return;
  }

  const normalizedComments = normalizeComments(comments);
  if (!normalizedComments.length) {
    renderEmptyComments();
    return;
  }

  commentsList.replaceChildren();

  normalizedComments.forEach((comment) => {
    const card = document.createElement("article");
    card.className = "comment-card";

    const title = document.createElement("h4");
    title.textContent = comment.displayName;

    const meta = document.createElement("p");
    meta.className = "comment-meta";

    const parts = [comment.professionalTitle, comment.affiliation, formatCommentDate(comment.submittedAt)]
      .filter(Boolean);
    meta.textContent = parts.join(getMessage("commentMetaSeparator"));

    const quote = document.createElement("blockquote");
    quote.textContent = comment.commentText;

    card.append(title, meta, quote);
    commentsList.append(card);
  });
}

async function loadComments() {
  if (!commentsList || !backendApiUrl) {
    return;
  }

  setCommentStatus(getMessage("commentLoading"));

  try {
    const payload = await requestBackendAction("comments", {
      site: siteLabel,
      limit: commentsLimit,
    });

    renderComments(payload.comments);
    setCommentStatus(getMessage("commentReady"));
  } catch (error) {
    renderEmptyComments();
    setCommentStatus(getMessage("commentError"), "error");
    console.error(error);
  }
}

async function submitComment(formData) {
  return requestBackendAction("comment", {
    commentId: createId("comment"),
    displayName: formData.displayName,
    professionalTitle: formData.professionalTitle,
    affiliation: formData.affiliation,
    commentText: formData.commentText,
    pageUrl: window.location.href,
    site: siteLabel,
  });
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

const sectionTargets = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window && sectionTargets.length) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        const activeId = `#${entry.target.id}`;
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.getAttribute("href") === activeId);
        });
      });
    },
    {
      rootMargin: "-30% 0px -55% 0px",
      threshold: 0.1,
    }
  );

  sectionTargets.forEach((section) => sectionObserver.observe(section));
}

if ("IntersectionObserver" in window && revealItems.length) {
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
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

if (glossarySearch) {
  glossarySearch.addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();

    glossaryCards.forEach((card) => {
      const haystack = `${card.dataset.term || ""} ${card.textContent}`.toLowerCase();
      card.classList.toggle("hidden", !haystack.includes(query));
    });
  });
}

if (commentForm) {
  commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const displayName = commentForm.display_name.value.trim();
    const professionalTitle = commentForm.professional_title.value.trim();
    const affiliation = commentForm.affiliation.value.trim();
    const commentText = commentForm.comment_text.value.trim();
    const honeypot = commentForm.website.value.trim();

    if (honeypot) {
      return;
    }

    if (!displayName || !professionalTitle || !affiliation || !commentText) {
      setCommentStatus(getMessage("commentValidation"), "error");
      return;
    }

    if (!backendApiUrl) {
      setCommentStatus(getMessage("commentError"), "error");
      return;
    }

    if (commentSubmitButton) {
      commentSubmitButton.disabled = true;
    }

    setCommentStatus(getMessage("commentBusy"));

    try {
      const payload = await submitComment({
        displayName,
        professionalTitle,
        affiliation,
        commentText,
      });

      renderComments(payload.comments);
      commentForm.reset();
      setCommentStatus(getMessage("commentSuccess"), "success");
    } catch (error) {
      setCommentStatus(getMessage("commentError"), "error");
      console.error(error);
    } finally {
      if (commentSubmitButton) {
        commentSubmitButton.disabled = false;
      }
    }
  });
}

initializeReaderCounter();
loadComments();
