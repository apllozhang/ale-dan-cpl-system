import { eq, and, isNull, sql } from "drizzle-orm";
import { sessions } from "../../drizzle/schema";
import { requireDb } from "./index";
import crypto from "crypto";

// Session durations
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
export const REFRESH_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Create a new session for a user
 * @param userId User ID
 * @param durationMs Session duration in milliseconds
 * @returns Session ID
 */
export async function createSession(userId: number, durationMs: number = SESSION_DURATION_MS): Promise<string> {
  const db = await requireDb();
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + durationMs);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });

  return sessionId;
}

/**
 * Validate a session ID and return the user ID if valid
 * @param sessionId Session ID to validate
 * @returns User ID if valid, null otherwise
 */
export async function validateSession(sessionId: string): Promise<number | null> {
  const db = await requireDb();
  const now = new Date();

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        isNull(sessions.revokedAt), // Not revoked
      )
    )
    .limit(1);

  if (!session) return null;

  // Check expiration
  if (session.expiresAt < now) {
    // Delete expired session
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  return session.userId;
}

/**
 * Revoke a specific session
 * @param sessionId Session ID to revoke
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const db = await requireDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

/**
 * Revoke all sessions for a user (e.g., on password change)
 * @param userId User ID
 */
export async function revokeAllUserSessions(userId: number): Promise<void> {
  const db = await requireDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.userId, userId));
}

/**
 * Clean up expired and revoked sessions
 */
export async function cleanupSessions(): Promise<void> {
  const db = await requireDb();

  // Delete expired sessions
  await db.delete(sessions).where(sql`${sessions.expiresAt} < NOW()`);

  // Delete revoked sessions older than 7 days
  await db.delete(sessions).where(sql`${sessions.revokedAt} < NOW() - INTERVAL 7 DAY`);
}
