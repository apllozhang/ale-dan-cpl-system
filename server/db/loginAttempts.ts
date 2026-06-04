import { eq, and, lt, sql } from "drizzle-orm";
import {
  loginAttempts,
  type InsertLoginAttempt,
} from "../../drizzle/schema";
import { getDb } from "./index";

const MAX_LOGIN_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function getLoginAttemptByKey(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).limit(1);
  return rows[0];
}

export async function upsertLoginAttempt(data: InsertLoginAttempt) {
  const db = await getDb();
  if (!db) return;
  const existing = await getLoginAttemptByKey(data.key);
  if (existing) {
    await db.update(loginAttempts).set({ count: data.count, windowStart: data.windowStart }).where(eq(loginAttempts.key, data.key));
  } else {
    await db.insert(loginAttempts).values(data);
  }
}

export async function incrementLoginAttempt(key: string) {
  const db = await getDb();
  if (!db) return;
  const existing = await getLoginAttemptByKey(key);
  if (existing) {
    await db.update(loginAttempts).set({ count: existing.count + 1 }).where(eq(loginAttempts.key, key));
  }
}

export async function deleteLoginAttempt(key: string) {
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

/**
 * Check if the given key is rate-limited.
 * Returns { blocked: true, remaining: 0 } if over limit.
 */
export async function checkLoginRateLimit(key: string): Promise<{ blocked: boolean; remaining: number }> {
  const db = await getDb();
  if (!db) return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };

  const existing = await getLoginAttemptByKey(key);
  const now = new Date();

  if (!existing) {
    return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };
  }

  // If window expired, reset
  if (now.getTime() - existing.windowStart.getTime() >= WINDOW_MS) {
    await deleteLoginAttempt(key);
    return { blocked: false, remaining: MAX_LOGIN_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - existing.count);
  return { blocked: existing.count >= MAX_LOGIN_ATTEMPTS, remaining };
}

/**
 * Record a failed login attempt for the given key.
 */
export async function recordLoginFailure(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await getLoginAttemptByKey(key);
  const now = new Date();

  if (!existing || now.getTime() - existing.windowStart.getTime() >= WINDOW_MS) {
    // Start a new window
    await upsertLoginAttempt({
      key,
      count: 1,
      windowStart: now,
      expiresAt: new Date(now.getTime() + WINDOW_MS),
    });
  } else {
    await incrementLoginAttempt(key);
  }
}

/**
 * Clear rate limit entries for the given key (on successful login).
 */
export async function clearLoginAttempts(key: string): Promise<void> {
  await deleteLoginAttempt(key);
}
