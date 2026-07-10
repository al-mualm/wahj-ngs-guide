const accountConfig = window.WAHJ_NGS_CONFIG || {};
const accountSettings = accountConfig.account || {};
const firebaseConfig = accountConfig.firebase || {};
const accountLanguage = document.documentElement.lang === "ar" ? "ar" : "en";
const accountRoot = new URL("./", import.meta.url);
const localHistoryKey = "wahj-learning-history-v1";
const localHistoryLimit = 80;
const registrationRequired = accountSettings.requireRegistration === true;
const accountSurfacePaths = [
  "/account/",
  "/login/",
  "/register/",
  "/history/",
  "/privacy/",
];
const publicAccessPaths = ["/login/", "/register/", "/privacy/"];
const pageIsPrivateAccountSurface = accountSurfacePaths.some((path) =>
  window.location.pathname.endsWith(path)
);
const pageIsPublicAccessSurface = publicAccessPaths.some((path) =>
  window.location.pathname.endsWith(path)
);
const pageRequiresAccount = registrationRequired && !pageIsPublicAccessSurface;
let localHistoryTrackingStarted = false;

const accountCopy = {
  en: {
    account: "Account",
    history: "History",
    signIn: "Sign in",
    register: "Register",
    signOut: "Sign out",
    setupMissing:
      "Firebase is not connected yet. The account pages are installed, but registration will work after the Firebase web config is added.",
    setupError: "Firebase could not start. Check the config values and Firestore rules.",
    checkingAccount: "Checking account access...",
    accessRequiredTitle: "Account required",
    accessRequiredBody:
      "Create an account or sign in to use Wahj Al-DNA lectures, tools, and saved history.",
    accessSetupBody:
      "Account access is required, but Firebase is not connected yet. Add the Firebase web config first, then registration and login will work.",
    registerBusy: "Creating your account...",
    registerSuccess:
      "Account created. We sent a verification email. Your reading history will sync while you are signed in.",
    loginBusy: "Signing in...",
    loginSuccess: "Signed in. Your local history is being synced.",
    resetSent:
      "Password reset email sent. Check your Inbox first, then Spam or Promotions. Use the newest reset email only.",
    authRequired: "Sign in to manage your account.",
    profileSaved: "Profile saved.",
    verificationSent: "Verification email sent.",
    signedOut: "Signed out.",
    localHistoryCleared: "Local history cleared on this device.",
    deleteConfirm:
      "This deletes your Firebase account data and local history on this browser. Continue?",
    deleteSuccess: "Account deleted from Firebase and local history cleared.",
    deleteNeedsLogin: "Please sign in again, then retry account deletion.",
    historyEmpty: "No reading history yet.",
    continueReading: "Continue",
    lastOpened: "Last opened",
    section: "Section",
    scroll: "Scroll",
    notVerified: "Email not verified",
    verified: "Email verified",
    emailOptIn: "Email updates enabled",
    emailOptOut: "Email updates disabled",
  },
  ar: {
    account: "الحساب",
    history: "السجل",
    signIn: "تسجيل الدخول",
    register: "إنشاء حساب",
    signOut: "تسجيل الخروج",
    setupMissing:
      "لم يتم ربط Firebase بعد. صفحات الحساب موجودة الآن، وسيعمل التسجيل بعد إضافة إعدادات Firebase.",
    setupError: "تعذر تشغيل Firebase. تحقق من قيم الإعدادات وقواعد Firestore.",
    checkingAccount: "يتم التحقق من صلاحية الحساب...",
    accessRequiredTitle: "الحساب مطلوب",
    accessRequiredBody:
      "أنشئ حساباً أو سجّل الدخول لاستخدام محاضرات وأدوات Wahj Al-DNA وسجل القراءة.",
    accessSetupBody:
      "الوصول إلى الموقع يتطلب حساباً، لكن Firebase غير مرتبط بعد. أضف إعدادات Firebase أولاً ليعمل التسجيل والدخول.",
    registerBusy: "يتم إنشاء الحساب...",
    registerSuccess:
      "تم إنشاء الحساب. أرسلنا رسالة تحقق إلى البريد. سيُزامن سجل القراءة عند تسجيل الدخول.",
    loginBusy: "يتم تسجيل الدخول...",
    loginSuccess: "تم تسجيل الدخول. تتم الآن مزامنة السجل المحلي.",
    resetSent:
      "تم إرسال رسالة إعادة تعيين كلمة المرور. تحقق من صندوق الوارد أولاً، ثم مجلد الرسائل غير المرغوب فيها أو العروض الترويجية. استخدم أحدث رسالة فقط.",
    authRequired: "سجّل الدخول لإدارة الحساب.",
    profileSaved: "تم حفظ الملف الشخصي.",
    verificationSent: "تم إرسال رسالة التحقق.",
    signedOut: "تم تسجيل الخروج.",
    localHistoryCleared: "تم حذف السجل المحلي من هذا الجهاز.",
    deleteConfirm:
      "سيتم حذف بيانات حساب Firebase والسجل المحلي في هذا المتصفح. هل تريد المتابعة؟",
    deleteSuccess: "تم حذف الحساب من Firebase ومسح السجل المحلي.",
    deleteNeedsLogin: "يرجى تسجيل الدخول مرة أخرى ثم إعادة محاولة حذف الحساب.",
    historyEmpty: "لا يوجد سجل قراءة بعد.",
    continueReading: "متابعة",
    lastOpened: "آخر فتح",
    section: "القسم",
    scroll: "الموضع",
    notVerified: "البريد غير مؤكد",
    verified: "البريد مؤكد",
    emailOptIn: "تحديثات البريد مفعلة",
    emailOptOut: "تحديثات البريد غير مفعلة",
  },
};

const firebaseState = {
  app: null,
  auth: null,
  db: null,
  modules: null,
  readyPromise: null,
  user: null,
  authReady: false,
  listeners: [],
};

function accountText(key) {
  return accountCopy[accountLanguage][key] || key;
}

function rootHref(path = "") {
  return new URL(path.replace(/^\//, ""), accountRoot).href;
}

function safeNextUrl(fallbackUrl) {
  const params = new URLSearchParams(window.location.search);
  const nextValue = params.get("next");
  if (!nextValue) {
    return fallbackUrl;
  }

  try {
    const nextUrl = new URL(nextValue, window.location.origin);
    if (nextUrl.origin !== window.location.origin) {
      return fallbackUrl;
    }

    return nextUrl.href;
  } catch (error) {
    return fallbackUrl;
  }
}

function rootHrefWithNext(path = "") {
  const url = new URL(path.replace(/^\//, ""), accountRoot);
  if (!pageIsPublicAccessSurface) {
    url.searchParams.set("next", `${window.location.pathname}${window.location.search}${window.location.hash}`);
  }
  return url.href;
}

function relativeFromRoot() {
  const rootPath = accountRoot.pathname.replace(/\/$/, "");
  const currentPath = window.location.pathname;
  return currentPath.startsWith(rootPath)
    ? currentPath.slice(rootPath.length) || "/"
    : currentPath;
}

function hasFirebaseConfig() {
  if (firebaseConfig.enabled !== true) {
    return false;
  }

  return ["apiKey", "authDomain", "projectId", "appId"].every((key) =>
    String(firebaseConfig[key] || "").trim()
  );
}

function setStatus(element, message, tone = "") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove("is-error", "is-success", "is-info");
  if (tone) {
    element.classList.add(`is-${tone}`);
  }
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(accountLanguage === "ar" ? "ar-IQ" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function normalizeHistoryId(pathname) {
  const cleanPath = String(pathname || window.location.pathname)
    .replace(accountRoot.pathname, "/")
    .replace(/\/index\.html$/, "/")
    .replace(/\/+$/, "/");
  const id = cleanPath.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  return id || "home";
}

function getActiveSectionId() {
  const sections = Array.from(document.querySelectorAll("main section[id], article[id]"));
  if (!sections.length) {
    return window.location.hash.replace("#", "");
  }

  let activeSection = sections[0];
  let smallestDistance = Infinity;

  sections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    const distance = Math.abs(rect.top - 96);
    if (rect.top <= window.innerHeight * 0.7 && distance < smallestDistance) {
      smallestDistance = distance;
      activeSection = section;
    }
  });

  return activeSection?.id || window.location.hash.replace("#", "");
}

function getPageTitle() {
  return (
    document.querySelector("main h1")?.textContent?.trim() ||
    document.querySelector("h1")?.textContent?.trim() ||
    document.title ||
    "Wahj Al-DNA page"
  );
}

function getHistoryEntry() {
  const sectionId = getActiveSectionId();
  const url = new URL(window.location.href);
  url.hash = sectionId ? `#${sectionId}` : "";

  return {
    id: normalizeHistoryId(window.location.pathname),
    title: getPageTitle(),
    url: url.href,
    path: relativeFromRoot(),
    sectionId,
    scrollY: Math.max(0, Math.round(window.scrollY || 0)),
    language: accountLanguage,
    updatedAt: new Date().toISOString(),
    pageKind: document.body.className || "",
  };
}

function readLocalHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(localHistoryKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeLocalHistory(entries) {
  try {
    localStorage.setItem(localHistoryKey, JSON.stringify(entries.slice(0, localHistoryLimit)));
  } catch (error) {
    console.warn("Could not save local learning history.", error);
  }
}

function saveLocalHistory(entry) {
  if (!entry || pageIsPrivateAccountSurface) {
    return [];
  }

  const existing = readLocalHistory().filter((item) => item.id !== entry.id);
  const nextEntries = [entry, ...existing].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  writeLocalHistory(nextEntries);
  return nextEntries;
}

async function loadFirebase() {
  if (firebaseState.readyPromise) {
    return firebaseState.readyPromise;
  }

  firebaseState.readyPromise = (async () => {
    if (!hasFirebaseConfig()) {
      throw new Error("Missing Firebase config.");
    }

    const version = accountConfig.firebaseSdkVersion || "10.12.5";
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`),
    ]);

    firebaseState.modules = {
      ...appModule,
      ...authModule,
      ...firestoreModule,
    };
    firebaseState.app = appModule.initializeApp(firebaseConfig);
    firebaseState.auth = authModule.getAuth(firebaseState.app);
    firebaseState.db = firestoreModule.getFirestore(firebaseState.app);

    authModule.onAuthStateChanged(firebaseState.auth, async (user) => {
      firebaseState.user = user;
      firebaseState.authReady = true;
      updateAccountNav(user);
      updateAccountGate(user);
      notifyAuthListeners(user);

      if (user) {
        beginLocalHistoryTracking();
        await syncLocalHistoryToCloud(user).catch((error) => console.warn(error));
        await updateUserLastSeen(user).catch((error) => console.warn(error));
        await saveCurrentEntryToCloud(user).catch((error) => console.warn(error));
      }
    });

    return firebaseState;
  })();

  return firebaseState.readyPromise;
}

function onAuthReady(callback) {
  firebaseState.listeners.push(callback);
  if (firebaseState.authReady) {
    callback(firebaseState.user);
  }
}

function notifyAuthListeners(user) {
  firebaseState.listeners.forEach((callback) => callback(user));
}

function createAccountNav() {
  const header = document.querySelector(".site-header");
  if (!header || header.querySelector("[data-account-nav]")) {
    return;
  }

  const nav = document.createElement("nav");
  nav.className = "account-nav";
  nav.dataset.accountNav = "true";
  nav.setAttribute("aria-label", accountText("account"));

  const readerBadge = header.querySelector(".reader-badge");
  header.insertBefore(nav, readerBadge || null);
  updateAccountNav(firebaseState.user);
}

function createAccountLink(label, href, className = "account-link") {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
}

function updateAccountNav(user) {
  const nav = document.querySelector("[data-account-nav]");
  if (!nav) {
    return;
  }

  nav.replaceChildren();
  nav.append(createAccountLink(accountText("history"), rootHref("history/")));

  if (user) {
    const accountLink = createAccountLink(
      user.displayName || user.email || accountText("account"),
      rootHref("account/"),
      "account-link account-link-primary"
    );
    const signOutButton = document.createElement("button");
    signOutButton.type = "button";
    signOutButton.className = "account-link account-link-button";
    signOutButton.textContent = accountText("signOut");
    signOutButton.addEventListener("click", async () => {
      await signOutUser();
    });
    nav.append(accountLink, signOutButton);
    return;
  }

  nav.append(
    createAccountLink(accountText("signIn"), rootHrefWithNext("login/")),
    createAccountLink(accountText("register"), rootHrefWithNext("register/"), "account-link account-link-primary")
  );
}

function createAccountGate() {
  if (!pageRequiresAccount || document.querySelector("[data-account-gate]")) {
    return;
  }

  const gate = document.createElement("section");
  gate.className = "account-gate";
  gate.dataset.accountGate = "true";
  gate.setAttribute("aria-labelledby", "account-gate-title");
  gate.innerHTML = `
    <div class="account-gate-panel">
      <span class="section-chip">${accountText("account")}</span>
      <h2 id="account-gate-title">${accountText("accessRequiredTitle")}</h2>
      <p data-account-gate-copy>${accountText("checkingAccount")}</p>
      <div class="account-gate-actions">
        <a class="primary-action" href="${rootHrefWithNext("register/")}">${accountText("register")}</a>
        <a class="secondary-action" href="${rootHrefWithNext("login/")}">${accountText("signIn")}</a>
      </div>
    </div>
  `;
  document.body.append(gate);
  document.body.classList.add("account-access-locked");
}

function updateAccountGate(user) {
  if (!pageRequiresAccount) {
    return;
  }

  if (user) {
    document.querySelector("[data-account-gate]")?.remove();
    document.body.classList.remove("account-access-locked");
    return;
  }

  createAccountGate();
  const gateCopy = document.querySelector("[data-account-gate-copy]");
  if (!gateCopy) {
    return;
  }

  gateCopy.textContent = hasFirebaseConfig()
    ? accountText("accessRequiredBody")
    : accountText("accessSetupBody");
}

async function signOutUser() {
  await loadFirebase();
  await firebaseState.modules.signOut(firebaseState.auth);
  setStatus(document.querySelector("[data-account-status]"), accountText("signedOut"), "success");
}

async function syncLocalHistoryToCloud(user) {
  if (!user || !firebaseState.db || !firebaseState.modules) {
    return;
  }

  const entries = readLocalHistory();
  if (!entries.length) {
    return;
  }

  const { doc, setDoc, serverTimestamp } = firebaseState.modules;
  await Promise.all(
    entries.map((entry) =>
      setDoc(
        doc(firebaseState.db, "users", user.uid, "history", entry.id),
        {
          ...entry,
          uid: user.uid,
          syncedFromLocal: true,
          serverUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

async function saveCurrentEntryToCloud(user) {
  if (!user || !firebaseState.db || pageIsPrivateAccountSurface) {
    return;
  }

  const entry = getHistoryEntry();
  const { doc, setDoc, serverTimestamp } = firebaseState.modules;
  await setDoc(
    doc(firebaseState.db, "users", user.uid, "history", entry.id),
    {
      ...entry,
      uid: user.uid,
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function updateUserLastSeen(user) {
  if (!user || !firebaseState.db) {
    return;
  }

  const { doc, setDoc, serverTimestamp } = firebaseState.modules;
  const entry = pageIsPrivateAccountSurface ? null : getHistoryEntry();
  await setDoc(
    doc(firebaseState.db, "users", user.uid),
    {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      emailVerified: Boolean(user.emailVerified),
      lastSeenAt: new Date().toISOString(),
      lastSeenPage: entry ? entry.url : "",
      updatedAt: new Date().toISOString(),
      serverUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function beginLocalHistoryTracking() {
  if (localHistoryTrackingStarted) {
    return;
  }

  if (registrationRequired && !firebaseState.user) {
    return;
  }

  if (pageIsPrivateAccountSurface) {
    return;
  }

  localHistoryTrackingStarted = true;
  let saveTimer = null;
  const saveNow = () => {
    const entry = getHistoryEntry();
    saveLocalHistory(entry);
    if (firebaseState.user) {
      saveCurrentEntryToCloud(firebaseState.user).catch((error) => console.warn(error));
    }
  };
  const scheduleSave = () => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 600);
  };

  saveNow();
  window.addEventListener("hashchange", scheduleSave);
  window.addEventListener("scroll", scheduleSave, { passive: true });
  window.addEventListener("beforeunload", saveNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveNow();
    }
  });
}

function initSetupWarnings() {
  const warning = document.querySelector("[data-firebase-setup-warning]");
  if (!warning) {
    return;
  }

  if (!hasFirebaseConfig()) {
    setStatus(warning, accountText("setupMissing"), "info");
  }
}

function getProfileFormData(form) {
  return {
    fullName: form.full_name?.value.trim() || "",
    email: form.email?.value.trim() || "",
    country: form.country?.value.trim() || "",
    institution: form.institution?.value.trim() || "",
    role: form.role?.value || "",
    emailOptIn: Boolean(form.email_opt_in?.checked),
    privacyAccepted: Boolean(form.privacy_agree?.checked),
  };
}

async function initRegisterPage() {
  const form = document.querySelector("#account-register-form");
  if (!form) {
    return;
  }

  const status = document.querySelector("[data-account-status]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, accountText("registerBusy"), "info");

    try {
      await loadFirebase();
      const data = getProfileFormData(form);
      const password = form.password.value;
      const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, doc, setDoc, serverTimestamp } =
        firebaseState.modules;
      const credential = await createUserWithEmailAndPassword(firebaseState.auth, data.email, password);

      if (data.fullName) {
        await updateProfile(credential.user, { displayName: data.fullName });
      }

      await setDoc(
        doc(firebaseState.db, "users", credential.user.uid),
        {
          uid: credential.user.uid,
          fullName: data.fullName,
          displayName: data.fullName,
          email: credential.user.email || data.email,
          country: data.country,
          institution: data.institution,
          role: data.role,
          emailOptIn: data.emailOptIn,
          privacyAccepted: data.privacyAccepted,
          emailVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await sendEmailVerification(credential.user);
      await syncLocalHistoryToCloud(credential.user);
      form.reset();
      setStatus(status, accountText("registerSuccess"), "success");
      window.setTimeout(() => {
        window.location.href = safeNextUrl(rootHref("account/"));
      }, 1400);
    } catch (error) {
      setStatus(status, error.message || accountText("setupError"), "error");
    }
  });
}

async function initLoginPage() {
  const form = document.querySelector("#account-login-form");
  const resetForm = document.querySelector("#account-reset-form");
  if (!form && !resetForm) {
    return;
  }

  const status = document.querySelector("[data-account-status]");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, accountText("loginBusy"), "info");

    try {
      await loadFirebase();
      await firebaseState.modules.signInWithEmailAndPassword(
        firebaseState.auth,
        form.email.value.trim(),
        form.password.value
      );
      setStatus(status, accountText("loginSuccess"), "success");
      window.setTimeout(() => {
        window.location.href = safeNextUrl(rootHref("history/"));
      }, 900);
    } catch (error) {
      setStatus(status, error.message || accountText("setupError"), "error");
    }
  });

  resetForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await loadFirebase();
      await firebaseState.modules.sendPasswordResetEmail(
        firebaseState.auth,
        resetForm.reset_email.value.trim()
      );
      setStatus(status, accountText("resetSent"), "success");
    } catch (error) {
      setStatus(status, error.message || accountText("setupError"), "error");
    }
  });
}

async function initAccountPage() {
  const form = document.querySelector("#account-profile-form");
  if (!form) {
    return;
  }

  const status = document.querySelector("[data-account-status]");
  const summary = document.querySelector("#account-user-summary");
  const verifyButton = document.querySelector("#account-verify-email");
  const signOutButton = document.querySelector("#account-sign-out");
  const clearLocalButton = document.querySelector("#account-clear-local");
  const deleteButton = document.querySelector("#account-delete");

  try {
    await loadFirebase();
  } catch (error) {
    setStatus(status, accountText("setupMissing"), "info");
    form.hidden = true;
    return;
  }

  onAuthReady(async (user) => {
    if (!user) {
      form.hidden = true;
      setStatus(status, accountText("authRequired"), "info");
      if (summary) {
        summary.textContent = "";
      }
      return;
    }

    form.hidden = false;
    const profile = await readUserProfile(user).catch(() => null);
    form.full_name.value = profile?.fullName || user.displayName || "";
    form.email.value = user.email || "";
    form.country.value = profile?.country || "";
    form.institution.value = profile?.institution || "";
    form.role.value = profile?.role || "";
    form.email_opt_in.checked = Boolean(profile?.emailOptIn);

    if (summary) {
      const verification = user.emailVerified ? accountText("verified") : accountText("notVerified");
      const optIn = profile?.emailOptIn ? accountText("emailOptIn") : accountText("emailOptOut");
      summary.textContent = `${user.email || ""} | ${verification} | ${optIn}`;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = firebaseState.auth.currentUser;
    if (!user) {
      setStatus(status, accountText("authRequired"), "error");
      return;
    }

    const data = getProfileFormData(form);
    const { updateProfile, doc, setDoc, serverTimestamp } = firebaseState.modules;

    try {
      if (data.fullName && data.fullName !== user.displayName) {
        await updateProfile(user, { displayName: data.fullName });
      }

      await setDoc(
        doc(firebaseState.db, "users", user.uid),
        {
          uid: user.uid,
          fullName: data.fullName,
          displayName: data.fullName,
          email: user.email || data.email,
          country: data.country,
          institution: data.institution,
          role: data.role,
          emailOptIn: data.emailOptIn,
          emailVerified: Boolean(user.emailVerified),
          updatedAt: new Date().toISOString(),
          serverUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setStatus(status, accountText("profileSaved"), "success");
    } catch (error) {
      setStatus(status, error.message || accountText("setupError"), "error");
    }
  });

  verifyButton?.addEventListener("click", async () => {
    const user = firebaseState.auth.currentUser;
    if (!user) {
      setStatus(status, accountText("authRequired"), "error");
      return;
    }

    try {
      await firebaseState.modules.sendEmailVerification(user);
      setStatus(status, accountText("verificationSent"), "success");
    } catch (error) {
      setStatus(status, error.message || accountText("setupError"), "error");
    }
  });

  signOutButton?.addEventListener("click", signOutUser);
  clearLocalButton?.addEventListener("click", () => {
    writeLocalHistory([]);
    setStatus(status, accountText("localHistoryCleared"), "success");
  });
  deleteButton?.addEventListener("click", async () => {
    const user = firebaseState.auth.currentUser;
    if (!user || !window.confirm(accountText("deleteConfirm"))) {
      return;
    }

    try {
      await deleteCurrentUserData(user);
      writeLocalHistory([]);
      await firebaseState.modules.deleteUser(user);
      setStatus(status, accountText("deleteSuccess"), "success");
    } catch (error) {
      const message = String(error.message || error);
      setStatus(
        status,
        message.includes("requires-recent-login") ? accountText("deleteNeedsLogin") : message,
        "error"
      );
    }
  });
}

async function readUserProfile(user) {
  const { doc, getDoc } = firebaseState.modules;
  const snapshot = await getDoc(doc(firebaseState.db, "users", user.uid));
  return snapshot.exists() ? snapshot.data() : null;
}

async function deleteCurrentUserData(user) {
  const { collection, deleteDoc, doc, getDocs } = firebaseState.modules;
  const historySnapshot = await getDocs(collection(firebaseState.db, "users", user.uid, "history"));
  await Promise.all(historySnapshot.docs.map((historyDoc) => deleteDoc(historyDoc.ref)));
  await deleteDoc(doc(firebaseState.db, "users", user.uid));
}

function renderHistoryEntries(container, entries) {
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "account-empty-state";
    empty.textContent = accountText("historyEmpty");
    container.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "history-card";

    const title = document.createElement("h3");
    title.textContent = entry.title || "Wahj Al-DNA";

    const meta = document.createElement("p");
    meta.className = "history-meta";
    const parts = [
      entry.updatedAt ? `${accountText("lastOpened")}: ${formatDateTime(entry.updatedAt)}` : "",
      entry.sectionId ? `${accountText("section")}: ${entry.sectionId}` : "",
      Number.isFinite(Number(entry.scrollY)) ? `${accountText("scroll")}: ${entry.scrollY}px` : "",
    ].filter(Boolean);
    meta.textContent = parts.join(" | ");

    const link = document.createElement("a");
    link.className = "primary-action history-continue";
    link.href = entry.url || rootHref(entry.path || "");
    link.textContent = accountText("continueReading");

    card.append(title, meta, link);
    container.append(card);
  });
}

async function initHistoryPage() {
  const localContainer = document.querySelector("#local-history-list");
  const cloudContainer = document.querySelector("#cloud-history-list");
  if (!localContainer && !cloudContainer) {
    return;
  }

  const status = document.querySelector("[data-account-status]");
  renderHistoryEntries(localContainer, readLocalHistory());

  if (!hasFirebaseConfig()) {
    renderHistoryEntries(cloudContainer, []);
    setStatus(status, accountText("setupMissing"), "info");
    return;
  }

  try {
    await loadFirebase();
  } catch (error) {
    setStatus(status, accountText("setupError"), "error");
    return;
  }

  onAuthReady(async (user) => {
    if (!user) {
      renderHistoryEntries(cloudContainer, []);
      setStatus(status, accountText("authRequired"), "info");
      return;
    }

    const entries = await readCloudHistory(user).catch((error) => {
      setStatus(status, error.message || accountText("setupError"), "error");
      return [];
    });
    renderHistoryEntries(cloudContainer, entries);
  });
}

async function readCloudHistory(user) {
  const { collection, getDocs, limit, orderBy, query } = firebaseState.modules;
  const historyQuery = query(
    collection(firebaseState.db, "users", user.uid, "history"),
    orderBy("updatedAt", "desc"),
    limit(50)
  );
  const snapshot = await getDocs(historyQuery);
  return snapshot.docs.map((item) => item.data());
}

async function startFirebaseIfConfigured() {
  if (!hasFirebaseConfig()) {
    updateAccountNav(null);
    updateAccountGate(null);
    return;
  }

  try {
    await loadFirebase();
  } catch (error) {
    updateAccountGate(null);
    console.warn(accountText("setupError"), error);
  }
}

function initializeAccountFeature() {
  createAccountNav();
  createAccountGate();
  initSetupWarnings();
  if (!registrationRequired) {
    beginLocalHistoryTracking();
  }
  initRegisterPage();
  initLoginPage();
  initAccountPage();
  initHistoryPage();
  startFirebaseIfConfigured();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAccountFeature);
} else {
  initializeAccountFeature();
}
