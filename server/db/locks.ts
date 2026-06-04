import { eq, and, sql } from "drizzle-orm";
import { systemLocks } from "../../drizzle/schema";
import { requireDb } from "./index";

/**
 * Acquire a named lock with expiration
 * @param name Lock name (e.g., "cpl_import")
 * @param owner Lock owner identifier (e.g., userId or requestId)
 * @param ttlMs Time-to-live in milliseconds
 * @returns true if lock acquired, false if already held
 */
export async function acquireLock(name: string, owner: string, ttlMs: number): Promise<boolean> {
  const db = await requireDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    // Clean up expired locks first
    await db.delete(systemLocks).where(sql`${systemLocks.expiresAt} < NOW()`);

    // Try to insert a new lock
    await db.insert(systemLocks).values({
      name,
      owner,
      expiresAt,
    });
    return true;
  } catch {
    // Lock row exists — atomically claim only if expired
    const result = await db.update(systemLocks)
      .set({ owner, expiresAt })
      .where(and(
        eq(systemLocks.name, name),
        sql`${systemLocks.expiresAt} < NOW()`,
      ));

    const affectedRows = (result[0] as { affectedRows: number }).affectedRows;
    return affectedRows > 0;
  }
}

/**
 * Release a named lock
 * @param name Lock name
 * @param owner Lock owner (must match to release)
 */
export async function releaseLock(name: string, owner: string): Promise<void> {
  const db = await requireDb();
  await db.delete(systemLocks).where(
    and(eq(systemLocks.name, name), eq(systemLocks.owner, owner))
  );
}
