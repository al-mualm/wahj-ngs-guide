const navToggle = document.querySelector(".nav-toggle");
const primaryNav = document.querySelector(".primary-nav");
const navLinks = Array.from(document.querySelectorAll(".primary-nav a"));
const revealItems = document.querySelectorAll(".reveal");
const glossarySearch = document.querySelector("#glossary-search");
const glossaryCards = document.querySelectorAll(".glossary-card");

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
      if (!entry.isIntersecting) return;
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
      if (!entry.isIntersecting) return;
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
      const matches = haystack.includes(query);
      card.classList.toggle("hidden", !matches);
    });
  });
}
