import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db";
import { calculateRiskScore } from "./risk";
import {
  ensureAnalyticsAllowed,
  ConsentError,
  getConsentStatus,
  setConsentStatus,
} from "./consent";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "*", // MVP için açık, prod'da domain bazlı kısıtlanır
  })
);
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "blindvault-backend",
    timestamp: new Date().toISOString(),
  });
});

// Basit müşteri listesi
app.get("/customers", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, segment, created_at FROM customers ORDER BY id ASC"
    );
    res.json({
      data: result.rows,
    });
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    res.status(500).json({
      error: "Failed to fetch customers",
      details: error?.message || "Unknown error",
    });
  }
});

// Müşteriler + son risk skoru (varsa)
app.get("/customers/with-scores", async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.name,
        c.email,
        c.segment,
        c.created_at,
        s.score,
        s.band,
        s.created_at AS score_created_at
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT score, band, created_at
        FROM scores
        WHERE customer_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) s ON TRUE
      ORDER BY c.id ASC;
    `
    );

    res.json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching customers with scores:", error);
    res.status(500).json({
      error: "Failed to fetch customers with scores",
    });
  }
});

// Tek bir müşteri için consent durumu
app.get("/customers/:customerId/consent", async (req, res) => {
  const customerId = Number(req.params.customerId);

  if (Number.isNaN(customerId)) {
    return res.status(400).json({ error: "Invalid customerId" });
  }

  try {
    const allowAnalytics = await getConsentStatus(customerId);
    res.json({
      customerId,
      allowAnalytics,
    });
  } catch (error) {
    console.error("Error fetching consent status:", error);
    res.status(500).json({ error: "Failed to fetch consent status" });
  }
});

// Tek bir müşteri için consent güncelleme
app.put("/customers/:customerId/consent", async (req, res) => {
  const customerId = Number(req.params.customerId);

  if (Number.isNaN(customerId)) {
    return res.status(400).json({ error: "Invalid customerId" });
  }

  const { allowAnalytics } = req.body as { allowAnalytics?: unknown };

  if (typeof allowAnalytics !== "boolean") {
    return res
      .status(400)
      .json({ error: "allowAnalytics must be a boolean" });
  }

  try {
    const customerRes = await pool.query(
      "SELECT id FROM customers WHERE id = $1",
      [customerId]
    );

    const customerRowCount = customerRes.rowCount ?? 0;

    if (customerRowCount === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    await setConsentStatus(customerId, allowAnalytics);

    res.json({
      customerId,
      allowAnalytics,
    });
  } catch (error) {
    console.error("Error updating consent status:", error);
    res.status(500).json({ error: "Failed to update consent status" });
  }
});

// Tek bir müşteri için özet bilgi (profil + son risk skoru + 90 günlük harcama özeti)
app.get("/customers/:customerId/summary", async (req, res) => {
  const customerId = Number(req.params.customerId);

  if (Number.isNaN(customerId)) {
    return res.status(400).json({ error: "Invalid customerId" });
  }

  try {
    // 1) Müşteri bilgisi
    const customerRes = await pool.query(
      `
      SELECT id, name, email, segment, created_at
      FROM customers
      WHERE id = $1
      `,
      [customerId]
    );

    const customerRowCount = customerRes.rowCount ?? 0;

    if (customerRowCount === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = customerRes.rows[0];

    // ✅ Consent durumu
    const allowAnalytics = await getConsentStatus(customerId);

    // 2) Son risk skoru
    const scoreRes = await pool.query(
      `
      SELECT score, band, created_at
      FROM scores
      WHERE customer_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [customerId]
    );

    const scoreRowCount = scoreRes.rowCount ?? 0;
    const lastScore = scoreRowCount > 0 ? scoreRes.rows[0] : null;

    // 3) 90 günlük harcama özeti
    const statsRes = await pool.query(
      `
      SELECT
        COALESCE(SUM(amount), 0) AS total_amount_90d,
        COUNT(*) AS tx_count_90d
      FROM transactions
      WHERE customer_id = $1
        AND tx_date >= NOW() - INTERVAL '90 days'
      `,
      [customerId]
    );

    const statsRow = statsRes.rows[0];
    const totalAmount90d = Number(statsRow.total_amount_90d || 0);
    const txCount90d = Number(statsRow.tx_count_90d || 0);
    const avgAmount90d = txCount90d > 0 ? totalAmount90d / txCount90d : 0;

    // 4) En çok harcama yapılan ilk 3 kategori
    const topCatRes = await pool.query(
      `
      SELECT
        category,
        COUNT(*) AS count,
        SUM(amount) AS total_amount
      FROM transactions
      WHERE customer_id = $1
        AND tx_date >= NOW() - INTERVAL '90 days'
      GROUP BY category
      ORDER BY total_amount DESC
      LIMIT 3
      `,
      [customerId]
    );

    const topCategories = topCatRes.rows.map((row) => ({
      category: row.category,
      count: Number(row.count),
      totalAmount: Number(row.total_amount),
    }));

    // Consent yoksa son kullanıcıya detaylı skor & istatistik göstermeyelim
    const safeScore =
      allowAnalytics && lastScore ? Number(lastScore.score) : null;
    const safeBand = allowAnalytics && lastScore ? lastScore.band : null;
    const safeScoreCreatedAt =
      allowAnalytics && lastScore ? lastScore.created_at : null;

    const safeTotalAmount = allowAnalytics ? totalAmount90d : 0;
    const safeTxCount = allowAnalytics ? txCount90d : 0;
    const safeAvgAmount = allowAnalytics ? avgAmount90d : 0;
    const safeTopCategories = allowAnalytics ? topCategories : [];

    res.json({
      customer,
      consent: {
        allowAnalytics,
      },
      score: safeScore,
      band: safeBand,
      scoreCreatedAt: safeScoreCreatedAt,
      stats: {
        totalAmount90d: safeTotalAmount,
        txCount90d: safeTxCount,
        avgAmount90d: safeAvgAmount,
        topCategories: safeTopCategories,
      },
    });
  } catch (error) {
    console.error("Error fetching customer summary:", error);
    res.status(500).json({ error: "Failed to fetch customer summary" });
  }
});

// Risk skorunu hesaplayıp scores tablosuna kaydeden endpoint
app.post("/risk/score/:customerId", async (req, res) => {
  const customerId = Number(req.params.customerId);

  if (Number.isNaN(customerId)) {
    return res.status(400).json({ error: "Invalid customerId" });
  }

  try {
    // Müşteri var mı?
    const customerRes = await pool.query(
      "SELECT id, name FROM customers WHERE id = $1",
      [customerId]
    );

    const customerRowCount = customerRes.rowCount ?? 0;

    if (customerRowCount === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // ✅ Consent kontrolü
    await ensureAnalyticsAllowed(customerId);

    // Risk skorunu hesapla
    const { score, band } = await calculateRiskScore(customerId);

    // Scores tablosuna kaydet
    const insertRes = await pool.query(
      `
      INSERT INTO scores (customer_id, score, band, model_version)
      VALUES ($1, $2, $3, $4)
      RETURNING id, customer_id, score, band, model_version, created_at;
    `,
      [customerId, score, band, "v1"]
    );

    const saved = insertRes.rows[0];

    res.json({
      customer: customerRes.rows[0],
      score: saved.score,
      band: saved.band,
      modelVersion: saved.model_version,
      createdAt: saved.created_at,
    });
  } catch (error: any) {
    if (error instanceof ConsentError) {
      return res.status(403).json({
        error: error.message,
        code: "CONSENT_REQUIRED",
      });
    }

    console.error("Error calculating risk score:", error);
    res.status(500).json({ error: "Failed to calculate risk score" });
  }
});

// Müşteriler + son risk skoru (varsa) + consent durumu
app.get("/customers/with-scores", async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        c.id,
        c.name,
        c.email,
        c.segment,
        c.created_at,
        s.score,
        s.band,
        s.created_at AS score_created_at,
        COALESCE(cons.allow_analytics, TRUE) AS allow_analytics
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT score, band, created_at
        FROM scores
        WHERE customer_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) s ON TRUE
      LEFT JOIN consents cons
        ON cons.customer_id = c.id
      ORDER BY c.id ASC;
    `
    );

    res.json({
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching customers with scores:", error);
    res.status(500).json({
      error: "Failed to fetch customers with scores",
    });
  }
});


app.listen(PORT, () => {
  console.log(`BlindVault backend listening on port ${PORT}`);
});
