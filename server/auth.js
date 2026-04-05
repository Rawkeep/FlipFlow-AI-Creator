// ─── Server-side JWT Auth ───
// Routes: register, login, me
// Middleware: requireAuth

import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { getDB } from "./db.js";

const SALT_ROUNDS = 12;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  if (!secret) {
    console.warn("[WARN] JWT_SECRET not set — using insecure dev fallback. DO NOT use in production.");
    return "flipflow-dev-secret-do-not-use-in-prod";
  }
  return secret;
}

// ── Middleware ──

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getSecret());
    req.user = payload; // { id, username, role }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
}

// ── Routes ──

const router = Router();

/** POST /api/auth/register */
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    if (typeof username !== "string" || username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: "Username must be 3-50 characters" });
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "Password must be 8-128 characters" });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return res.status(400).json({ error: "Username may only contain letters, numbers, dots, hyphens, and underscores" });
    }

    const db = getDB();

    // First user becomes admin
    const userCount = db.prepare("SELECT COUNT(*) AS cnt FROM users").get().cnt;
    const role = userCount === 0 ? "admin" : "user";

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      const result = db.prepare(
        "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)"
      ).run(username, hash, role);

      const token = jwt.sign(
        { id: result.lastInsertRowid, username, role },
        getSecret(),
        { expiresIn: "7d" }
      );

      res.status(201).json({ token, user: { id: result.lastInsertRowid, username, role } });
    } catch (err) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE" || err.message?.includes("UNIQUE")) {
        return res.status(409).json({ error: "Username already taken" });
      }
      throw err;
    }
  } catch (err) {
    console.error("[AUTH] Register error:", err.message);
    const message = process.env.NODE_ENV === "production" ? "Registration failed" : err.message;
    res.status(500).json({ error: message });
  }
});

/** POST /api/auth/login */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const db = getDB();
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    db.prepare("UPDATE users SET updated_at = datetime('now') WHERE id = ?").run(user.id);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      getSecret(),
      { expiresIn: "7d" }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error("[AUTH] Login error:", err.message);
    const message = process.env.NODE_ENV === "production" ? "Login failed" : err.message;
    res.status(500).json({ error: message });
  }
});

/** GET /api/auth/me */
router.get("/me", requireAuth, (req, res) => {
  const db = getDB();
  const user = db.prepare("SELECT id, username, role, created_at FROM users WHERE id = ?").get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ user });
});

export default router;
