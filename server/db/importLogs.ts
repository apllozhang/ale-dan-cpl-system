import { eq, like, or, and, sql, desc, SQL } from "drizzle-orm";
import {
  cplProducts, cplSheets, cplSummary,
  importLogs, InsertImportLog,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function getImportLogs(params: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const { search, page = 1, pageSize = 20 } = params;
  const conditions: SQL[] = [];

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(
      like(importLogs.fileName, term),
      like(importLogs.username, term),
      like(importLogs.orgName || sql`''`, term),
      like(importLogs.groupName || sql`''`, term),
      like(importLogs.mode, term),
    )!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const total = await db.$count(importLogs, where);
  const items = await db.select().from(importLogs)
    .where(where)
    .orderBy(desc(importLogs.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total };
}

export async function createImportLog(data: InsertImportLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(importLogs).values(data);
}

export async function clearImportLogs() {
  const db = await getDb();
  if (!db) return;
  await db.delete(importLogs);
}

export async function deleteImportLog(id: number) {
  const db = await getDb();
  if (!db) return;
  // Cascade delete associated data
  await db.delete(cplProducts).where(eq(cplProducts.importLogId, id));
  await db.delete(cplSheets).where(eq(cplSheets.importLogId, id));
  await db.delete(cplSummary).where(eq(cplSummary.importLogId, id));
  await db.delete(importLogs).where(eq(importLogs.id, id));
}
