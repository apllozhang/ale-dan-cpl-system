import { eq, and, lt, desc, sql } from "drizzle-orm";
import { importJobs } from "../../drizzle/schema";
import { getDb } from "./index";

/**
 * Create a new import job
 * @returns The job ID
 */
export async function createImportJob(data: {
  id: string;
  type: "cpl" | "eflash";
  fileName: string;
  uploadId?: string;
  createdBy: number;
  selectedSheets?: string[];
}): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(importJobs).values({
    id: data.id,
    type: data.type,
    status: "pending",
    fileName: data.fileName,
    uploadId: data.uploadId ?? null,
    createdBy: data.createdBy,
    progress: 0,
    selectedSheets: data.selectedSheets ?? null,
  });

  return data.id;
}

/**
 * Get an import job by ID
 */
export async function getImportJobById(id: string): Promise<typeof importJobs.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  const [row] = await db.select().from(importJobs).where(eq(importJobs.id, id));
  return row || null;
}

/**
 * Get import jobs for a specific user
 */
export async function getImportJobsByUser(
  userId: number,
  params: { page?: number; pageSize?: number } = {}
): Promise<{ items: typeof importJobs.$inferSelect[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const { page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;

  const [items, countResult] = await Promise.all([
    db.select().from(importJobs)
      .where(eq(importJobs.createdBy, userId))
      .orderBy(desc(importJobs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(importJobs)
      .where(eq(importJobs.createdBy, userId)),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
}

/**
 * Get all import jobs (admin view)
 */
export async function getImportJobs(
  params: { page?: number; pageSize?: number } = {}
): Promise<{ items: typeof importJobs.$inferSelect[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const { page = 1, pageSize = 20 } = params;
  const offset = (page - 1) * pageSize;

  const [items, countResult] = await Promise.all([
    db.select().from(importJobs)
      .orderBy(desc(importJobs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(importJobs),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
}

/**
 * Update import job status
 */
export async function updateImportJobStatus(
  id: string,
  status: "pending" | "processing" | "succeeded" | "failed" | "cancelled",
  updates: {
    progress?: number;
    result?: { sheetsImported?: number; productsImported?: number; hasSummary?: boolean };
    errorMessage?: string;
  } = {}
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const setData: Record<string, unknown> = { status };

  if (updates.progress !== undefined) {
    setData.progress = updates.progress;
  }
  if (updates.result !== undefined) {
    setData.result = updates.result;
  }
  if (updates.errorMessage !== undefined) {
    setData.errorMessage = updates.errorMessage;
  }

  // Set timestamps based on status
  if (status === "processing") {
    setData.startedAt = new Date();
  } else if (status === "succeeded" || status === "failed" || status === "cancelled") {
    setData.finishedAt = new Date();
  }

  await db.update(importJobs)
    .set(setData)
    .where(eq(importJobs.id, id));
}

/**
 * Claim the next pending job for processing (atomic operation)
 * Uses UPDATE with status condition to prevent race conditions
 * @returns The claimed job, or null if no pending jobs
 */
export async function claimNextPendingJob(): Promise<typeof importJobs.$inferSelect | null> {
  const db = await getDb();
  if (!db) return null;

  // Find the oldest pending job
  const [pending] = await db.select()
    .from(importJobs)
    .where(eq(importJobs.status, "pending"))
    .orderBy(importJobs.createdAt)
    .limit(1);

  if (!pending) return null;

  // Try to claim it atomically
  const result = await db.update(importJobs)
    .set({ status: "processing", startedAt: new Date() })
    .where(and(
      eq(importJobs.id, pending.id),
      eq(importJobs.status, "pending"), // Ensure it's still pending
    ));

  // Check if we actually updated a row
  // drizzle-orm doesn't return affected rows directly for mysql2,
  // so we re-read the job to confirm
  const [claimed] = await db.select()
    .from(importJobs)
    .where(eq(importJobs.id, pending.id));

  if (claimed && claimed.status === "processing") {
    return claimed;
  }

  return null;
}

/**
 * Cancel a pending import job
 * @returns true if cancelled, false if not found or not pending
 */
export async function cancelImportJob(id: string, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const [job] = await db.select()
    .from(importJobs)
    .where(and(
      eq(importJobs.id, id),
      eq(importJobs.createdBy, userId),
    ));

  if (!job || job.status !== "pending") return false;

  await db.update(importJobs)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(eq(importJobs.id, id));

  return true;
}

/**
 * Get import job statistics
 */
export async function getImportJobStats(): Promise<{
  total: number;
  pending: number;
  processing: number;
  succeeded: number;
  failed: number;
  cancelled: number;
}> {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, processing: 0, succeeded: 0, failed: 0, cancelled: 0 };

  const [total] = await db.select({ count: sql<number>`count(*)` }).from(importJobs);
  const [pending] = await db.select({ count: sql<number>`count(*)` }).from(importJobs).where(eq(importJobs.status, "pending"));
  const [processing] = await db.select({ count: sql<number>`count(*)` }).from(importJobs).where(eq(importJobs.status, "processing"));
  const [succeeded] = await db.select({ count: sql<number>`count(*)` }).from(importJobs).where(eq(importJobs.status, "succeeded"));
  const [failed] = await db.select({ count: sql<number>`count(*)` }).from(importJobs).where(eq(importJobs.status, "failed"));
  const [cancelled] = await db.select({ count: sql<number>`count(*)` }).from(importJobs).where(eq(importJobs.status, "cancelled"));

  return {
    total: Number(total?.count ?? 0),
    pending: Number(pending?.count ?? 0),
    processing: Number(processing?.count ?? 0),
    succeeded: Number(succeeded?.count ?? 0),
    failed: Number(failed?.count ?? 0),
    cancelled: Number(cancelled?.count ?? 0),
  };
}
