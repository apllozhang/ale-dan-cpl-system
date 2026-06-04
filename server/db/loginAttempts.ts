/**
 * Database-backed login rate limiting.
 *
 * Uses atomic SQL operations to prevent race conditions under concurrent requests.
 * TODO: For multi-instance deployment, consider Redis-based rate limiter for lower latency.
 */

import { eq, sql, or } from "drizzle-orm";
import {
  loginAttempts,
} from "../../drizzle/schema";
import { getDb, requireDb } from "./index";

const MAX_LOGIN_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Atomic increment: INSERT a new record, or UPDATE count+1 if key exists and window hasn't expired.
 * Uses ON DUPLICATE KEY UPDATE for atomicity — no read-then-write race.
 *
 * Uses requireDb() so that a missing database connection throws instead of
 * silently allowing the login attempt through (fail-closed on DB unavailable).
 */
export async function recordLoginFailure(key: string): Promise<void> {
  const db = await requireDb();

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
 * Uses requireDb() — if the database is unavailable the call throws, which
 * causes the login to be rejected (fail-closed).
 */
export async function checkLoginRateLimit(key: string): Promise<{ blocked: boolean; remaining: number }> {
  const db = await requireDb();

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
 * Check rate limits for both IP and username dimensions.
 * Returns blocked=true if EITHER dimension is rate-limited.
 */
export async function checkDualRateLimit(
  ipKey: string,
  userKey: string,
): Promise<{ blocked: boolean; remaining: number }> {
  const [ipResult, userResult] = await Promise.all([
    checkLoginRateLimit(ipKey),
    checkLoginRateLimit(userKey),
  ]);
  return {
    blocked: ipResult.blocked || userResult.blocked,
    remaining: Math.min(ipResult.remaining, userResult.remaining),
  };
}

/**
 * Record failure on both IP and username dimensions.
 */
export async function recordDualLoginFailure(ipKey: string, userKey: string): Promise<void> {
  await Promise.all([
    recordLoginFailure(ipKey),
    recordLoginFailure(userKey),
  ]);
}

/**
 * Clear rate limit entries for both IP and username (on successful login).
 */
export async function clearDualLoginAttempts(ipKey: string, userKey: string): Promise<void> {
  const db = await requireDb();
  await db.delete(loginAttempts).where(
    or(eq(loginAttempts.key, ipKey), eq(loginAttempts.key, userKey)),
  );
}

/**
 * Clear rate limit entries for the given key (on successful login).
 */
export async function clearLoginAttempts(key: string): Promise<void> {
  const db = await requireDb();
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}

/** Remove expired login attempt records */
export async function cleanupExpiredLoginAttempts() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.delete(loginAttempts).where(sql`${loginAttempts.expiresAt} < NOW()`);
  return (result[0] as { affectedRows: number }).affectedRows;
}
