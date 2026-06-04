import { eq, and, lt } from "drizzle-orm";
import fs from "node:fs/promises";
import {
  tempUploads,
  type InsertTempUpload,
  type TempUpload,
} from "../../drizzle/schema";
import { getDb, requireDb } from "./index";
import { logger } from "../_core/logger";

export async function createTempUpload(data: InsertTempUpload) {
  const db = await requireDb();
  await db.insert(tempUploads).values(data);
}

export async function getTempUploadById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(tempUploads).where(eq(tempUploads.id, id)).limit(1);
  return rows[0] as TempUpload | undefined;
}

export async function markTempUploadConsumed(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(tempUploads).set({ consumedAt: new Date() }).where(eq(tempUploads.id, id));
}

export async function deleteTempUpload(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tempUploads).where(eq(tempUploads.id, id));
}

/** Get a temp upload by ID, verifying it belongs to the given user */
export async function getTempUploadForUser(id: string, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(tempUploads)
    .where(and(eq(tempUploads.id, id), eq(tempUploads.uploadedBy, userId)))
    .limit(1);
  return rows[0] as TempUpload | undefined;
}

/** Remove expired uploads: deletes both database records and disk files */
export async function cleanupExpiredUploads() {
  const db = await getDb();
  if (!db) return 0;

  // First, fetch expired uploads so we can delete their files from disk
  const now = new Date();
  const expired = await db.select().from(tempUploads).where(lt(tempUploads.expiresAt, now));

  if (expired.length === 0) return 0;

  // Delete disk files (best-effort, don't block on failures)
  await Promise.allSettled(
    expired.map(async (upload) => {
      try {
        await fs.unlink(upload.filePath);
      } catch {
        // File may already be deleted or never existed — non-fatal
        logger.debug("temp_file_cleanup_skip", { uploadId: upload.id, filePath: upload.filePath });
      }
    })
  );

  // Delete database records
  for (const upload of expired) {
    await db.delete(tempUploads).where(eq(tempUploads.id, upload.id));
  }

  logger.info("temp_uploads_cleaned", { count: expired.length });
  return expired.length;
}
