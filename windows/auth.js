/**
 * Workflow Updater — Firebase Authentication
 * Google Sign-In with an email allowlist.
 */

(function () {
  const SESSION_PROFILE_KEY = "wu_auth_profile";

  function getAuthConfig() {
    return window.CONFIG?.AUTH || {};
  }

  function getFirebaseConfig() {
    return getAuthConfig().FIREBASE || {};
  }

  function isFirebaseConfigured() {
    const firebaseConfig = getFirebaseConfig();
    return Boolean(
      firebaseConfig.apiKey &&
        firebaseConfig.authDomain &&
        firebaseConfig.projectId &&
        firebaseConfig.appId
    );
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function getAllowedEmails() {
    const configured = getAuthConfig().ALLOWED_EMAILS || [];
    const profileEmails = (window.CONFIG?.PROFILES || [])
      .map((profile) => profile.email)
      .filter(Boolean);

    return [...new Set([...configured, ...profileEmails].map(normalizeEmail))].filter(Boolean);
  }

  function isEmailAllowed(email) {
    const allowed = getAllowedEmails();
    if (!allowed.length) return false;
    return allowed.includes(normalizeEmail(email));
  }

  function isLoginPage() {
    return /login\.html$/i.test(window.location.pathname);
  }

  function isDashboardPage() {
    return /index\.html$/i.test(window.location.pathname) || /\/$/.test(window.location.pathname);
  }

  function setAuthPending(pending) {
    document.body.classList.toggle("auth-pending", pending);
  }

  function hideAuthLoading() {
    const overlay = document.getElementById("auth-loading");
    if (overlay) overlay.remove();
    setAuthPending(false);
    document.dispatchEvent(new Event("auth-ready"));
  }

  function showAuthError(message) {
    const errorEl = document.getElementById("auth-error");
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearAuthError() {
    const errorEl = document.getElementById("auth-error");
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.hidden = true;
  }

  function saveUserProfile(user) {
    if (!user) return;
    sessionStorage.setItem(
      SESSION_PROFILE_KEY,
      JSON.stringify({
        email: user.email,
        name: user.displayName || user.email,
        photoURL: user.photoURL || ""
      })
    );
  }

  function clearUserProfile() {
    sessionStorage.removeItem(SESSION_PROFILE_KEY);
  }

  function getUserProfile() {
    const raw = sessionStorage.getItem(SESSION_PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function updateDashboardUserChip(user) {
    const chip = document.getElementById("auth-user-chip");
    const avatar = document.getElementById("auth-user-avatar");
    const label = document.getElementById("auth-user-label");
    if (!chip || !avatar || !label || !user) return;

    const name = user.displayName || user.email || "Signed in";
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

    label.textContent = user.email || name;
    avatar.textContent = initials || "?";

    if (user.photoURL) {
      avatar.style.backgroundImage = `url("${user.photoURL}")`;
      avatar.style.backgroundSize = "cover";
      avatar.style.backgroundPosition = "center";
      avatar.textContent = "";
    }

    chip.hidden = false;
  }

  function wireSignOutButton(auth) {
    const signOutBtn = document.getElementById("auth-sign-out-btn");
    if (!signOutBtn || signOutBtn.dataset.wired === "true") return;
    signOutBtn.dataset.wired = "true";
    signOutBtn.addEventListener("click", async () => {
      signOutBtn.disabled = true;
      try {
        await auth.signOut();
      } finally {
        clearUserProfile();
        window.location.replace("login.html");
      }
    });
  }

  function wireGoogleSignInButton(auth) {
    const button = document.getElementById("google-sign-in-btn");
    if (!button || button.dataset.wired === "true") return;
    button.dataset.wired = "true";

    button.addEventListener("click", async () => {
      clearAuthError();
      button.disabled = true;
      const label = button.querySelector(".btn-label");
      const previousLabel = label ? label.textContent : "";
      if (label) label.textContent = "Signing in...";

      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const result = await auth.signInWithPopup(provider);
        const email = result.user?.email;

        if (!isEmailAllowed(email)) {
          await auth.signOut();
          clearUserProfile();
          showAuthError("This Google account is not authorized to access Workflow Updater.");
          return;
        }

        saveUserProfile(result.user);
        window.location.replace("index.html");
      } catch (error) {
        if (error?.code === "auth/popup-closed-by-user") return;
        showAuthError(error?.message || "Google sign-in failed. Please try again.");
      } finally {
        button.disabled = false;
        if (label) label.textContent = previousLabel || "Continue with Google";
      }
    });
  }

  function showSetupNotice() {
    const notice = document.getElementById("firebase-setup-notice");
    if (notice) notice.hidden = false;

    const button = document.getElementById("google-sign-in-btn");
    if (button) button.disabled = true;
  }

  function initAuth() {
    const authConfig = getAuthConfig();

    if (!authConfig.REQUIRE_AUTH) {
      hideAuthLoading();
      return;
    }

    if (!isFirebaseConfigured()) {
      if (isLoginPage()) {
        showSetupNotice();
        setAuthPending(false);
        return;
      }
      window.location.replace("login.html");
      return;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(getFirebaseConfig());
    }

    const auth = firebase.auth();

    if (isLoginPage()) {
      wireGoogleSignInButton(auth);
      auth.onAuthStateChanged((user) => {
        if (user && isEmailAllowed(user.email)) {
          saveUserProfile(user);
          window.location.replace("index.html");
          return;
        }
        if (user && !isEmailAllowed(user.email)) {
          auth.signOut();
          clearUserProfile();
          showAuthError("This Google account is not authorized to access Workflow Updater.");
        }
        setAuthPending(false);
      });
      return;
    }

    if (isDashboardPage()) {
      auth.onAuthStateChanged(async (user) => {
        if (!user || !isEmailAllowed(user.email)) {
          if (user) {
            await auth.signOut();
          }
          clearUserProfile();
          window.location.replace("login.html");
          return;
        }

        saveUserProfile(user);
        updateDashboardUserChip(user);
        wireSignOutButton(auth);
        hideAuthLoading();
      });
    }
  }

  window.WorkflowAuth = {
    getAllowedEmails,
    isEmailAllowed,
    getUserProfile,
    initAuth
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAuth);
  } else {
    initAuth();
  }
})();
