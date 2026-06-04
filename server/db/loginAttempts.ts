/**
 * Database-backed login rate limiting.
 *
 * Uses atomic SQL operations to prevent race conditions under concurrent requests.
 * TODO: For multi-instance deployment, consider Redis-based rate limiter for lower latency.
 */

import { eq, sql } from "drizzle-orm";
import {
  loginAttempts,
} from "../../drizzle/schema";
import { getDb } from "./index";

const MAX_LOGIN_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Atomic increment: INSERT a new record, or UPDATE count+1 if key exists and window hasn't expired.
 * Uses ON DUPLICATE KEY UPDATE for atomicity — no read-then-write race.
 */
export async function recordLoginFailure(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_MS);

  // Atomic upsert: insert new or reset window + increment count
  const windowSeconds = Math.floor(WINDOW_MS / 1000);
  await db.execute(sql`
    INSERT INTO login_attempts (\`key\`, count, windowStart, expiresAt)
    VALUES (${key}, 1, ${now}, ${expiresAt})
    ON DUPLICATE KEY UPDATE
      count = IF(windowStart < DATE_SUB(${now}, INTERVAL ${windowSeconds} SECOND), 1, count + 1),
      windowStart = IF(windowStart < DATE_SUB(${now}, INTERVAL ${windowSeconds} SECOND), ${now}, windowStart),
      expiresAt = ${expiresAt}
  `);
}

/**
 * Check if the given key is rate-limited.
 * Reads are inherently safe (no write race); the count is atomically maintained by recordLoginFailure.
 */
export async function checkLoginRateLimit(key: string): Promise<{ blocked: boolean; remaining: number }> {
  const db = await getDb();
  if (!db) return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };

  const rows = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).limit(1);
  const existing = rows[0];

  if (!existing) {
    return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };
  }

  const now = Date.now();

  // If window expired, clean up and allow
  if (now - existing.windowStart.getTime() >= WINDOW_MS) {
    await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
    return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - existing.count);
  return { blocked: existing.count >= MAX_LOGIN_ATTEMPTS, remaining };
}

/**
 * Clear rate limit entries for the given key (on successful login).
 */
export async function clearLoginAttempts(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}

/** Remove expired login attempt records */
export async function cleanupExpiredLoginAttempts() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.delete(loginAttempts).where(sql`${loginAttempts.expiresAt} < NOW()`);
  return (result[0] as { affectedRows: number }).affectedRows;
}
