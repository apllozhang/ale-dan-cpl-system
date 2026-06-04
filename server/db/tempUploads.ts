import { eq, and, lt, isNull } from "drizzle-orm";
import { tempUploads } from "../../drizzle/schema";
import { getDb } from "./index";

/**
 * Create a new temp upload record
 */
export async function createTempUpload(data: {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: number;
  expiresAt: Date;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(tempUploads).values({
    id: data.id,
    fileName: data.fileName,
    filePath: data.filePath,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    uploadedBy: data.uploadedBy,
    expiresAt: data.expiresAt,
  });
}

/**
 * Get a temp upload by ID
 */
export async function getTempUploadById(id: string): Promise<typeof tempUploads.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  const [row] = await db.select().from(tempUploads).where(eq(tempUploads.id, id));
  return row || null;
}

/**
 * Get a temp upload by ID and verify ownership
 */
export async function getTempUploadForUser(id: string, userId: number): Promise<typeof tempUploads.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  const [row] = await db.select().from(tempUploads).where(
    and(
      eq(tempUploads.id, id),
      eq(tempUploads.uploadedBy, userId),
      isNull(tempUploads.consumedAt), // Not yet consumed
    )
  );
  return row || null;
}

/**
 * Mark a temp upload as consumed
 */
export async function markTempUploadConsumed(id: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(tempUploads)
    .set({ consumedAt: new Date() })
    .where(eq(tempUploads.id, id));
}

/**
 * Delete expired temp uploads and return the file paths for cleanup
 */
export async function cleanupExpiredUploads(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();

  // Find expired uploads first
  const expired = await db.select({
    id: tempUploads.id,
    filePath: tempUploads.filePath,
  }).from(tempUploads).where(lt(tempUploads.expiresAt, now));

  if (expired.length === 0) return [];

  // Delete expired records
  await db.delete(tempUploads).where(lt(tempUploads.expiresAt, now));

  // Return file paths for filesystem cleanup
  return expired.map((r) => r.filePath);
}

/**
 * Delete a specific temp upload by ID
 */
export async function deleteTempUpload(id: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const [row] = await db.select({ filePath: tempUploads.filePath })
    .from(tempUploads)
    .where(eq(tempUploads.id, id));

  if (!row) return null;

  await db.delete(tempUploads).where(eq(tempUploads.id, id));
  return row.filePath;
}
