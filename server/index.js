import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import searchRoutes from "./routes/search.js";
import priceRoutes from "./routes/prices.js";
import importRoutes from "./routes/import.js";
import authRoutes, { requireAuth } from "./auth.js";
import { initDB, checkHealth, closeDB } from "./db.js";

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === "production";

// ── Initialize database ──
initDB();

// ── Security: Helmet + HSTS ──
app.use(helmet({
  contentSecurityPolicy: false, // CSP handled by nginx or frontend meta tags
  hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

// ── HTTPS redirect in production (behind reverse proxy) ──
if (IS_PROD) {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] === "http") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// ── CORS ──
const corsOptions = IS_PROD && process.env.APP_URL
  ? { origin: process.env.APP_URL, credentials: true }
  : { origin: true };
app.use(cors(corsOptions));

// ── Body parsing ──
app.use(express.json({ limit: "10mb" }));

// ── Rate Limiting ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Try again in 15 minutes." },
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many search requests. Try again shortly." },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. Try again shortly." },
});

app.use("/api/", generalLimiter);

// ── Health ──
app.get("/api/health", (req, res) => {
  const dbOk = checkHealth();
  const services = {
    ebay: !!(process.env.EBAY_APP_ID && process.env.EBAY_APP_ID !== "your_ebay_app_id"),
    etsy: !!(process.env.ETSY_API_KEY && process.env.ETSY_API_KEY !== "your_etsy_api_key"),
  };
  const envStatus = {
    JWT_SECRET: !!process.env.JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV || "not set",
    APP_URL: !!process.env.APP_URL,
  };

  const allOk = dbOk;
  res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    database: dbOk ? "connected" : "error",
    services,
    env: envStatus,
    timestamp: new Date().toISOString(),
  });
});

// ── Auth Routes (rate-limited) ──
app.use("/api/auth", authLimiter, authRoutes);

// ── API Routes (search-rate-limited) ──
app.use("/api/search", searchLimiter, searchRoutes);
app.use("/api/prices", searchLimiter, priceRoutes);
app.use("/api/import", searchLimiter, importRoutes);

// ── Serve static frontend in production ──
const distPath = join(__dirname, "..", "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback (Express v5 syntax)
  app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(join(distPath, "index.html"));
  });
  console.log(`   Static: serving from ${distPath}`);
}

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.stack || err.message}`);

  const status = err.status || 500;

  // In production, sanitize error messages — don't leak internal/API details
  let message;
  if (IS_PROD && status >= 500) {
    message = "Internal server error";
  } else {
    message = err.message || "Internal server error";
  }

  res.status(status).json({
    error: message,
    ...(IS_PROD ? {} : { stack: err.stack }),
  });
});

// ── Start ──
const server = app.listen(PORT, () => {
  console.log(`\n   FlipFlow Pro running on http://localhost:${PORT}`);
  console.log(`   eBay API: ${process.env.EBAY_APP_ID && process.env.EBAY_APP_ID !== "your_ebay_app_id" ? "configured" : "missing EBAY_APP_ID"}`);
  console.log(`   Etsy API: ${process.env.ETSY_API_KEY && process.env.ETSY_API_KEY !== "your_etsy_api_key" ? "configured" : "missing ETSY_API_KEY"}`);
  console.log(`   Database: SQLite (WAL mode)`);
  console.log(`   Mode: ${process.env.NODE_ENV || "development"}\n`);
});

// ── Graceful shutdown ──
function shutdown() {
  console.log("\n   Shutting down...");
  closeDB();
  server.close(() => {
    console.log("   Server closed.");
    process.exit(0);
  });
  // Force close after 10s
  setTimeout(() => process.exit(1), 10000);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
