import { pool } from "./db";

export class ConsentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsentError";
  }
}

/**
 * Müşterinin analitik izni var mı?
 * Not: Şimdilik demo için kayıt yoksa "true" kabul ediyoruz.
 */
export async function getConsentStatus(
  customerId: number
): Promise<boolean> {
  const res = await pool.query(
    "SELECT allow_analytics FROM consents WHERE customer_id = $1",
    [customerId]
  );

  if (res.rowCount === 0) {
    // MVP: kayıt yoksa izin var say.
    // Prod'da burayı privacy-by-default için false yaparsın.
    return true;
  }

  return Boolean(res.rows[0].allow_analytics);
}

/**
 * İzin yoksa ConsentError fırlatır.
 */
export async function ensureAnalyticsAllowed(
  customerId: number
): Promise<void> {
  const allowed = await getConsentStatus(customerId);
  if (!allowed) {
    throw new ConsentError(
      "Analytics is disabled for this customer (consent not given)."
    );
  }
}

/**
 * Consent kaydını günceller (yoksa oluşturur).
 */
export async function setConsentStatus(
  customerId: number,
  allowAnalytics: boolean
): Promise<void> {
  await pool.query(
    `
    INSERT INTO consents (customer_id, allow_analytics)
    VALUES ($1, $2)
    ON CONFLICT (customer_id) DO UPDATE
    SET allow_analytics = EXCLUDED.allow_analytics,
        updated_at = NOW();
  `,
    [customerId, allowAnalytics]
  );
}