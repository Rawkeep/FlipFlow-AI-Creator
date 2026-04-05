import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import ErrorBoundary from "./ErrorBoundary.jsx";
import LandingPage from "./Landing.jsx";
import TokenAdmin from "./TokenAdmin.jsx";
import FlipFlowPro from "./App.jsx";
import {
  getSession, setSession, clearSession,
  validateToken, isAdmin, setAdmin,
  verifyMasterPassword, getStoredTokens,
} from "./auth.js";

// Auto-detect GitHub Pages demo mode
const IS_DEMO = window.location.hostname.includes("github.io");

function AppRouter() {
  const [view, setView] = useState("loading"); // loading | landing | admin | app
  const [session, setSessionState] = useState(null);

  useEffect(() => {
    // GitHub Pages = demo mode, skip auth
    if (IS_DEMO) {
      setSessionState({ token: "DEMO", isAdmin: false });
      setView("app");
      return;
    }
    // Check existing session
    const existing = getSession();
    if (existing) {
      setSessionState(existing);
      setView("app");
    } else if (isAdmin()) {
      setView("admin");
    } else {
      setView("landing");
    }
  }, []);

  const handleTokenEntry = (tokenInput) => {
    const result = validateToken(tokenInput);
    if (result.valid) {
      setSession(tokenInput, false);
      setSessionState({ token: tokenInput, isAdmin: false });
      setView("app");
    }
    return result;
  };

  const handleAdminLogin = (password) => {
    if (verifyMasterPassword(password)) {
      setAdmin(true);
      // Ensure at least 1 token exists for admin to use the app too
      const tokens = getStoredTokens();
      if (tokens.length === 0) {
        // Admin gets redirected to token panel first
        setView("admin");
      } else {
        setView("admin");
      }
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    clearSession();
    setAdmin(false);
    setSessionState(null);
    setView("landing");
  };

  if (view === "loading") {
    return null; // index.html spinner handles this
  }

  if (view === "landing") {
    return (
      <LandingPage
        onEnterToken={handleTokenEntry}
        onAdminLogin={handleAdminLogin}
      />
    );
  }

  if (view === "admin") {
    return (
      <TokenAdmin
        onBack={() => {
          // Admin can enter app if tokens exist
          const tokens = getStoredTokens();
          const activeTokens = tokens.filter(t => t.active);
          if (activeTokens.length > 0) {
            // Auto-login with first active admin token
            setSession(activeTokens[0].id, true);
            setSessionState({ token: activeTokens[0].id, isAdmin: true });
            setView("app");
          } else {
            setAdmin(false);
            setView("landing");
          }
        }}
      />
    );
  }

  // view === "app"
  return <FlipFlowPro onLogout={handleLogout} session={session} />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  </StrictMode>
);
