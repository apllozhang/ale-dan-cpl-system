import { eq, and, sql } from "drizzle-orm";
import {
  importJobs,
  type InsertImportJob,
  type ImportJob,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function createImportJob(data: InsertImportJob) {
  const db = await getDb();
  if (!db) return;
  await db.insert(importJobs).values(data);
}

export async function getImportJobById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(importJobs).where(eq(importJobs.id, id)).limit(1);
  return rows[0] as ImportJob | undefined;
}

export async function updateImportJob(
  id: string,
  data: Partial<Pick<ImportJob, "status" | "progress" | "errorMessage" | "result" | "startedAt" | "finishedAt">>,
) {
  const db = await getDb();
  if (!db) return;
  await db.update(importJobs).set(data).where(eq(importJobs.id, id));
}

export async function getPendingImportJobs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(importJobs).where(eq(importJobs.status, "pending"));
}

export async function cancelImportJob(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(importJobs).set({ status: "cancelled", finishedAt: new Date() }).where(eq(importJobs.id, id));
}

export async function getImportJobStats(): Promise<{
  pending: number;
  processing: number;
  succeeded: number;
  failed: number;
}> {
  const db = await getDb();
  if (!db) return { pending: 0, processing: 0, succeeded: 0, failed: 0 };

  const rows = await db
    .select({
      status: importJobs.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(importJobs)
    .groupBy(importJobs.status);

  const stats = { pending: 0, processing: 0, succeeded: 0, failed: 0 };
  for (const row of rows) {
    const key = row.status as keyof typeof stats;
    if (key in stats) {
      stats[key] = row.count;
    }
  }
  return stats;
}
