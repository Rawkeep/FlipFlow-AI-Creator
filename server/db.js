// ─── SQLite Storage Layer (better-sqlite3) ───
// WAL mode for concurrent reads, proper indexes for performance.

import Database from "better-sqlite3";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, "flipflow.db");

let db;

export function getDB() {
  if (db) return db;

  db = new Database(DB_PATH);

  // Performance settings
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  return db;
}

export function initDB() {
  const db = getDB();

  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Saved listings
    CREATE TABLE IF NOT EXISTS saved_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      external_id TEXT,
      title TEXT NOT NULL,
      price REAL,
      currency TEXT DEFAULT 'EUR',
      platform TEXT,
      condition TEXT,
      location TEXT,
      seller_name TEXT,
      seller_type TEXT,
      item_url TEXT,
      image_url TEXT,
      description TEXT,
      category TEXT,
      market_value REAL,
      margin REAL,
      ai_score REAL,
      status TEXT DEFAULT 'new',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Search history
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      keywords TEXT NOT NULL,
      platforms TEXT,
      categories TEXT,
      result_count INTEGER DEFAULT 0,
      searched_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- API tokens (for external integrations / browser extension)
    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      label TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      last_used_at TEXT,
      uses INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_saved_listings_user ON saved_listings(user_id);
    CREATE INDEX IF NOT EXISTS idx_saved_listings_platform ON saved_listings(platform);
    CREATE INDEX IF NOT EXISTS idx_saved_listings_status ON saved_listings(status);
    CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_search_history_date ON search_history(searched_at);
    CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id);
  `);

  return db;
}

/** Check if the DB connection is healthy */
export function checkHealth() {
  try {
    const db = getDB();
    const row = db.prepare("SELECT 1 AS ok").get();
    return row?.ok === 1;
  } catch {
    return false;
  }
}

/** Graceful shutdown */
export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}
