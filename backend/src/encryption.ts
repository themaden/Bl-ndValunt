import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ENCRYPTION_KEY_HEX = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY_HEX) {
  throw new Error("ENCRYPTION_KEY is not set in environment variables");
}

const KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex"); // 32 byte
const ALGORITHM = "aes-256-gcm"; // modern ve authenticated encryption
const IV_LENGTH = 12; // GCM için 12 byte IV önerilir

/**
 * Plaintext string'i AES-256-GCM ile şifreler.
 * Dönen format: base64(iv):base64(tag):base64(ciphertext)
 */
export function encryptString(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  const ivB64 = iv.toString("base64");
  const tagB64 = authTag.toString("base64");
  const encB64 = encrypted.toString("base64");

  return `${ivB64}:${tagB64}:${encB64}`;
}

/**
 * encryptString ile üretilmiş formatı çözmek için.
 */
export function decryptString(encrypted: string): string {
  const [ivB64, tagB64, encB64] = encrypted.split(":");
  if (!ivB64 || !tagB64 || !encB64) {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(encB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
