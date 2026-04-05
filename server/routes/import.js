import { Router } from "express";
import { scoreListings } from "../services/scoring.js";

const router = Router();

/**
 * POST /api/import/manual
 * Import manually captured listings (from browser extension, CSV, or manual entry)
 * Body: { listings: [...], config: {...} }
 */
router.post("/manual", (req, res, next) => {
  try {
    const { listings = [], config = {} } = req.body;

    if (listings.length === 0) {
      return res.status(400).json({ error: "Keine Listings zum Importieren" });
    }

    const normalized = listings.map((item, i) => ({
      id: item.id || `MAN-${Date.now()}-${i}`,
      externalId: item.externalId || null,
      title: item.title || "Unbekannt",
      price: parseFloat(item.price) || 0,
      currency: item.currency || "EUR",
      condition: item.condition || "gut",
      platform: item.platform || "kleinanzeigen",
      location: item.location || "",
      seller: {
        name: item.sellerName || item.seller?.name || "unbekannt",
        rating: item.seller?.rating || 0,
        sales: item.seller?.sales || 0,
        badge: item.seller?.badge || null,
      },
      sellerType: item.sellerType || "private",
      images: item.images || 0,
      imageUrl: item.imageUrl || null,
      itemUrl: item.itemUrl || item.url || "",
      posted: item.posted || null,
      description: item.description || "",
      category: item.category || "",
      marketValue: item.marketValue || null,
      margin: null,
      aiScore: null,
      status: "new",
      negotiable: item.negotiable || false,
      urgency: item.urgency || "low",
      matchKeywords: [],
      bestResalePlatform: null,
      bestResaleNet: null,
    }));

    // Score the imported listings
    const scored = scoreListings(normalized, {}, config);

    res.json({
      imported: scored.length,
      items: scored,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/import/csv
 * Import from CSV text
 * Body: { csv: "title;price;platform;condition;url;location\n...", config: {...} }
 */
router.post("/csv", (req, res, next) => {
  try {
    const { csv = "", config = {} } = req.body;

    if (!csv.trim()) return res.status(400).json({ error: "CSV darf nicht leer sein" });

    // Validate CSV size
    const MAX_CSV_SIZE = 2 * 1024 * 1024; // 2 MB
    const MAX_CSV_ROWS = 5000;
    if (csv.length > MAX_CSV_SIZE) {
      return res.status(400).json({ error: `CSV too large (max ${MAX_CSV_SIZE / 1024 / 1024} MB)` });
    }

    const lines = csv.trim().split("\n");
    if (lines.length < 2) return res.status(400).json({ error: "CSV braucht Header + mindestens eine Zeile" });
    if (lines.length > MAX_CSV_ROWS + 1) {
      return res.status(400).json({ error: `CSV too many rows (max ${MAX_CSV_ROWS})` });
    }

    const headers = lines[0].split(";").map(h => h.trim().toLowerCase());
    const listings = [];

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(";").map(v => v.trim());
      const row = {};
      headers.forEach((h, j) => { row[h] = vals[j] || ""; });

      listings.push({
        title: row.title || row.titel || "",
        price: parseFloat(row.price || row.preis || 0),
        platform: row.platform || row.plattform || "kleinanzeigen",
        condition: row.condition || row.zustand || "gut",
        itemUrl: row.url || row.link || "",
        location: row.location || row.ort || row.standort || "",
        sellerName: row.seller || row.verkäufer || row.verkaufer || "",
        sellerType: row.sellertype || row.verkäufertyp || "private",
        negotiable: ["ja", "vb", "yes", "true", "1"].includes((row.vb || row.negotiable || "").toLowerCase()),
        description: row.description || row.beschreibung || "",
        category: row.category || row.kategorie || "",
      });
    }

    // Normalize and score
    const normalized = listings.map((item, i) => ({
      id: `CSV-${Date.now()}-${i}`,
      externalId: null,
      title: item.title,
      price: item.price,
      currency: "EUR",
      condition: item.condition,
      platform: item.platform,
      location: item.location,
      seller: { name: item.sellerName || "unbekannt", rating: 0, sales: 0, badge: null },
      sellerType: item.sellerType,
      images: 0,
      imageUrl: null,
      itemUrl: item.itemUrl,
      posted: null,
      description: item.description,
      category: item.category,
      marketValue: null,
      margin: null,
      aiScore: null,
      status: "new",
      negotiable: item.negotiable,
      urgency: "low",
      matchKeywords: [],
      bestResalePlatform: null,
      bestResaleNet: null,
    }));

    const scored = scoreListings(normalized, {}, config);

    res.json({
      imported: scored.length,
      items: scored,
      headers,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
