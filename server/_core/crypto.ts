import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.AI_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("AI_ENCRYPTION_KEY environment variable is not set");
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("AI_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)");
  }
  return buf;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64 string: iv (16 bytes) + authTag (16 bytes) + encrypted data.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) throw new Error("Cannot encrypt empty string");
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a base64 ciphertext produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Invalid ciphertext: too short");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

/**
 * Mask an API key for display: show first 4 and last 4 chars, mask the rest.
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length < 8) return "****";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
