// ─── Client-side Auth Helpers ───
// Authentication is handled server-side via JWT (see server/auth.js).
// This module provides client-side session management and token storage
// for the demo/offline mode. When a backend is available, use the
// /api/auth/* endpoints instead.

const AUTH_KEY = "flipflow_auth";
const TOKENS_KEY = "flipflow_admin_tokens";

// ── Token format: FF-XXXX-XXXX-XXXX (12 random hex chars) ──

function generateId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `FF-${seg()}-${seg()}-${seg()}`;
}

// ── Admin: Token Management (stored in localStorage for admin) ──

export function getStoredTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) || "[]");
  } catch { return []; }
}

export function saveTokens(tokens) {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function createToken(label = "", expiresInDays = null) {
  const tokens = getStoredTokens();
  const token = {
    id: generateId(),
    label: label || `User ${tokens.length + 1}`,
    created: new Date().toISOString(),
    expires: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null,
    active: true,
    lastUsed: null,
    uses: 0,
  };
  tokens.push(token);
  saveTokens(tokens);
  return token;
}

export function revokeToken(id) {
  const tokens = getStoredTokens().map(t => t.id === id ? { ...t, active: false } : t);
  saveTokens(tokens);
}

export function reactivateToken(id) {
  const tokens = getStoredTokens().map(t => t.id === id ? { ...t, active: true } : t);
  saveTokens(tokens);
}

export function deleteToken(id) {
  saveTokens(getStoredTokens().filter(t => t.id !== id));
}

// ── Validation ──

export function validateToken(input) {
  const trimmed = (input || "").trim().toUpperCase();
  const tokens = getStoredTokens();
  const token = tokens.find(t => t.id === trimmed);

  if (!token) return { valid: false, reason: "Token nicht gefunden" };
  if (!token.active) return { valid: false, reason: "Token deaktiviert" };
  if (token.expires && new Date(token.expires) < new Date()) {
    return { valid: false, reason: "Token abgelaufen" };
  }

  // Update usage stats
  const updated = tokens.map(t =>
    t.id === trimmed ? { ...t, lastUsed: new Date().toISOString(), uses: (t.uses || 0) + 1 } : t
  );
  saveTokens(updated);

  return { valid: true, token: { ...token, lastUsed: new Date().toISOString(), uses: (token.uses || 0) + 1 } };
}

// ── Session ──

export function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Re-validate on load
    if (session?.token) {
      const result = validateToken(session.token);
      if (!result.valid) { clearSession(); return null; }
      return session;
    }
    return null;
  } catch { return null; }
}

export function setSession(tokenId, isAdmin = false) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    token: tokenId,
    isAdmin,
    loginAt: new Date().toISOString(),
  }));
}

export function clearSession() {
  localStorage.removeItem(AUTH_KEY);
}

// ── Admin check ──

const ADMIN_KEY = "flipflow_is_admin";

export function isAdmin() {
  try { return localStorage.getItem(ADMIN_KEY) === "true"; } catch { return false; }
}

export function setAdmin(val) {
  localStorage.setItem(ADMIN_KEY, val ? "true" : "false");
}

// ── Master password removed ──
// Authentication is now handled server-side via /api/auth/login.
// For the demo/offline mode (github.io), auth is bypassed entirely.
// See server/auth.js for the production auth implementation.

export function verifyMasterPassword() {
  // No-op: server-side auth only. This stub keeps the demo landing page
  // from crashing if it still references this function.
  return false;
}
