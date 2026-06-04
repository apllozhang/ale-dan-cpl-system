import { eq, and, lt } from "drizzle-orm";
import {
  tempUploads,
  type InsertTempUpload,
  type TempUpload,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function createTempUpload(data: InsertTempUpload) {
  const db = await getDb();
  if (!db) return;
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

/** Remove expired uploads that haven't been consumed */
export async function cleanupExpiredUploads() {
  const db = await getDb();
  if (!db) return 0;
  const now = new Date();
  const result = await db.delete(tempUploads).where(lt(tempUploads.expiresAt, now));
  return result[0].affectedRows as number;
}
