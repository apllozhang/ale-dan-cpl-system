import { eq, and, lt, sql } from "drizzle-orm";
import { loginAttempts } from "../../drizzle/schema";
import { getDb } from "./index";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if a login key (IP or IP:username) is rate-limited
 * @returns { blocked: true if rate limit exceeded, remaining: attempts left }
 */
export async function checkLoginRateLimit(key: string): Promise<{ blocked: boolean; remaining: number }> {
  const db = await getDb();
  if (!db) return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };

  const now = new Date();

  // Clean up expired records
  await db.delete(loginAttempts).where(lt(loginAttempts.expiresAt, now));

  // Find existing record
  const [record] = await db.select()
    .from(loginAttempts)
    .where(eq(loginAttempts.key, key))
    .limit(1);

  if (!record) {
    return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };
  }

  // Check if window has expired
  if (record.windowStart.getTime() + LOGIN_WINDOW_MS < now.getTime()) {
    // Window expired, delete and allow
    await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
    return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - record.count);
  return { blocked: record.count >= MAX_LOGIN_ATTEMPTS, remaining };
}

/**
 * Record a login failure for the given key
 */
export async function recordLoginFailure(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOGIN_WINDOW_MS);

  // Try to find existing record
  const [existing] = await db.select()
    .from(loginAttempts)
    .where(eq(loginAttempts.key, key))
    .limit(1);

  if (existing) {
    // Check if window has expired
    if (existing.windowStart.getTime() + LOGIN_WINDOW_MS < now.getTime()) {
      // Reset window
      await db.update(loginAttempts)
        .set({ count: 1, windowStart: now, expiresAt })
        .where(eq(loginAttempts.key, key));
    } else {
      // Increment count
      await db.update(loginAttempts)
        .set({ count: sql`${loginAttempts.count} + 1` })
        .where(eq(loginAttempts.key, key));
    }
  } else {
    // Create new record
    await db.insert(loginAttempts).values({
      key,
      count: 1,
      windowStart: now,
      expiresAt,
    });
  }
}

/**
 * Clear login attempts for a given key (e.g., after successful login)
 */
export async function clearLoginAttempts(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}

/**
 * Cleanup expired login attempt records
 * @returns number of deleted records
 */
export async function cleanupExpiredAttempts(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const now = new Date();
  const result = await db.delete(loginAttempts).where(lt(loginAttempts.expiresAt, now));
  return result[0]?.affectedRows ?? 0;
}

/**
 * Get current attempt count for a key (for testing/debugging)
 */
export async function getAttemptCount(key: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const [record] = await db.select({ count: loginAttempts.count })
    .from(loginAttempts)
    .where(eq(loginAttempts.key, key))
    .limit(1);

  return record?.count ?? 0;
}
