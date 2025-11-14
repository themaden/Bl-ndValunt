import { pool } from "./db";

export type RiskResult = {
  score: number; // 0-1 arası
  band: "LOW" | "MEDIUM" | "HIGH";
};

export async function calculateRiskScore(
  customerId: number
): Promise<RiskResult> {
  // Son 90 gündeki işlemleri çekelim
  const txRes = await pool.query(
    `
    SELECT amount, category, tx_date
    FROM transactions
    WHERE customer_id = $1
      AND tx_date >= NOW() - INTERVAL '90 days'
    ORDER BY tx_date DESC;
  `,
    [customerId]
  );

  const txs = txRes.rows;

  if (txs.length === 0) {
    // Hiç işlem yoksa orta risk diyelim (0.5)
    return { score: 0.5, band: "MEDIUM" };
  }

  const amounts = txs.map((t) => Number(t.amount));
  const totalAmount = amounts.reduce((sum, a) => sum + a, 0);
  const txCount = amounts.length;
  const avgAmount = totalAmount / txCount;
  const maxAmount = Math.max(...amounts);

  // Basit kural tabanlı risk puanı
  let score = 0.1; // taban

  // Çok yüksek toplam hacim → risk ekle (örnek kural)
  if (totalAmount > 50000) {
    score += 0.2;
  }

  // Büyük tekil işlem → risk ekle
  if (maxAmount > 15000) {
    score += 0.2;
  }

  // Ortalama harcama tutarı yüksekse → risk ekle
  if (avgAmount > 3000) {
    score += 0.2;
  }

  // Eğlence + "DIGER" kategorilerinin oranı
  const highRiskCategories = ["EGLENCE", "DIGER"];
  const highRiskCount = txs.filter((t) =>
    highRiskCategories.includes(String(t.category))
  ).length;
  const highRiskRatio = highRiskCount / txCount;

  if (highRiskRatio > 0.4) {
    score += 0.2;
  }

  // Çok düşük yoğunlukta işlem → belirsizlik → orta risk ekle
  if (txCount < 5) {
    score += 0.1;
  }

  // 0 ile 1 arasında tut
  if (score < 0) score = 0;
  if (score > 1) score = 1;

  let band: RiskResult["band"];
  if (score < 0.33) {
    band = "LOW";
  } else if (score < 0.66) {
    band = "MEDIUM";
  } else {
    band = "HIGH";
  }

  return { score, band };
}
