const appConfig = window.WAHJ_NGS_CONFIG || {};
const readerApiUrl = (appConfig.readerApiUrl || appConfig.registrationApiUrl || "").trim();
const siteLabel = (appConfig.siteLabel || "Wahj NGS Guide").trim();
const readerIdStorageKey = "wahj-ngs-reader-id";

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

function createReaderId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `reader-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getReaderId() {
  try {
    const existingId = localStorage.getItem(readerIdStorageKey);
    if (existingId) {
      return existingId;
    }

    const newId = createReaderId();
    localStorage.setItem(readerIdStorageKey, newId);
    return newId;
  } catch (error) {
    return createReaderId();
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
      reject(new Error("Timed out while loading reader stats."));
    }, 10000);

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
      reject(new Error("Unable to contact the reader counter."));
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

async function requestReaderAction(action, extraParams = {}) {
  if (!readerApiUrl) {
    throw new Error("Reader API URL is missing.");
  }

  const callbackName = `wahjReaderCallback_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const url = new URL(readerApiUrl);
  url.searchParams.set("action", action);
  url.searchParams.set("callback", callbackName);

  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const payload = await loadJsonp(url.toString(), callbackName);
  if (!payload || !payload.ok) {
    throw new Error(payload?.error || "Reader request failed.");
  }

  return payload;
}

async function initializeReaderCounter() {
  if (!readerCountElements.length) {
    return;
  }

  if (!readerApiUrl) {
    setReaderCount("N/A");
    setReaderNote("Anonymous reader counter is not connected right now.", "error");
    return;
  }

  setReaderCount("...");

  try {
    const visitPayload = await requestReaderAction("visit", {
      visitorId: getReaderId(),
      pageUrl: window.location.href,
      site: siteLabel,
    });

    renderReaderStats(visitPayload.stats);
    setReaderNote(
      "Anonymous reader count updates automatically. No personal information is collected."
    );
  } catch (visitError) {
    try {
      const statsPayload = await requestReaderAction("stats", {
        site: siteLabel,
      });

      renderReaderStats(statsPayload.stats);
      setReaderNote(
        "Reader count loaded, but this device could not update the counter right now."
      );
    } catch (statsError) {
      setReaderCount("Unavailable");
      setReaderNote("The anonymous reader counter is temporarily unavailable.", "error");
      console.error(visitError);
      console.error(statsError);
    }
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

initializeReaderCounter();
