import { eq, and, lt } from "drizzle-orm";
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
    await db.delete(systemLocks).where(lt(systemLocks.expiresAt, now));

    // Try to insert a new lock
    await db.insert(systemLocks).values({
      name,
      owner,
      expiresAt,
    });
    return true;
  } catch (error) {
    // Lock already exists — check if it's expired
    const [existing] = await db.select().from(systemLocks).where(eq(systemLocks.name, name)).limit(1);
    if (existing && existing.expiresAt < now) {
      // Lock expired, update it
      await db.update(systemLocks)
        .set({ owner, expiresAt })
        .where(eq(systemLocks.name, name));
      return true;
    }
    return false;
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
