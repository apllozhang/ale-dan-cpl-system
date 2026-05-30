import { eq, like, and, sql, asc, desc, isNotNull } from "drizzle-orm";
import {
  importLogs, cplSheets, cplProducts, cplSummary, InsertImportLog, InsertCplSheet, InsertCplProduct,
} from "../../drizzle/schema";
import { getDb } from "./index";

// ==================== Import Logs helpers ====================
export async function deactivateAllImports() {
  const db = await getDb();
  if (!db) return;
  await db.update(importLogs).set({ isActive: false }).where(eq(importLogs.isActive, true));
}

export async function createImportLogAndGetId(data: InsertImportLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const insertResult = await db.insert(importLogs).values(data);
  console.log('[DEBUG] insertResult:', insertResult);
  
  // Get the last inserted record by querying with the unique combination
  const lastRecord = await db.select({ id: importLogs.id })
    .from(importLogs)
    .where(eq(importLogs.fileName, data.fileName))
    .orderBy(desc(importLogs.id))
    .limit(1);
  console.log('[DEBUG] lastRecord:', lastRecord);
  
  const rawId = lastRecord[0]?.id;
  console.log('[DEBUG] raw id:', rawId, 'type:', typeof rawId);
  
  let insertId: number;
  if (typeof rawId === 'bigint') {
    insertId = Number(rawId);
  } else if (typeof rawId === 'number') {
    insertId = rawId;
  } else if (typeof rawId === 'string') {
    insertId = parseInt(rawId, 10);
  } else {
    insertId = 0;
  }
  
  console.log('[DEBUG] converted insertId:', insertId);
  
  if (!insertId || insertId <= 0) {
    throw new Error("Failed to get insertId from import log creation");
  }
  return insertId;
}

export async function getImportLogById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [log] = await db.select().from(importLogs).where(eq(importLogs.id, id));
  return log || null;
}

export async function getActiveImportLog() {
  const db = await getDb();
  if (!db) return null;
  const [log] = await db.select().from(importLogs).where(eq(importLogs.isActive, true));
  return log || null;
}

export async function getImportLogs(params: { page?: number; pageSize?: number } = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const countResult = await db.select({ total: sql<number>`COUNT(*)` }).from(importLogs);
  const total = Number(countResult[0]?.total ?? 0);

  const items = await db.select().from(importLogs)
    .orderBy(desc(importLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total };
}

// ==================== CPL Sheets helpers ====================
export async function getCplSheets(params: { importLogId?: number; page?: number; pageSize?: number } = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (params.importLogId) {
    conditions.push(eq(cplSheets.importLogId, params.importLogId));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: sql<number>`COUNT(*)` }).from(cplSheets).where(whereClause);
  const total = Number(countResult[0]?.total ?? 0);

  const items = await db.select().from(cplSheets)
    .where(whereClause)
    .orderBy(asc(cplSheets.displayOrder))
    .limit(pageSize)
    .offset(offset);

  return { items, total };
}

// ==================== CPL Products helpers ====================
export async function getCplProducts(params: { sheetId?: number; page?: number; pageSize?: number } = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (params.sheetId) {
    conditions.push(eq(cplProducts.sheetId, params.sheetId));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: sql<number>`COUNT(*)` }).from(cplProducts).where(whereClause);
  const total = Number(countResult[0]?.total ?? 0);

  const items = await db.select().from(cplProducts)
    .where(whereClause)
    .orderBy(asc(cplProducts.productModel))
    .limit(pageSize)
    .offset(offset);

  return { items, total };
}

// ==================== CPL Import helpers ====================
export async function importCplOverwrite(data: {
  fileName: string;
  userId: number;
  username: string;
  orgName: string | null;
  groupName: string | null;
  sheetNames: string[];
  sheetsCount: number;
  productsCount: number;
  products: InsertCplProduct[];
  sheets: InsertCplSheet[];
  summary?: { content: string; version: string };
}): Promise<{ importLogId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Create import log OUTSIDE transaction to get reliable insertId
  const importLogId = await createImportLogAndGetId({
    fileName: data.fileName,
    userId: data.userId,
    username: data.username,
    orgName: data.orgName,
    groupName: data.groupName,
    mode: "overwrite",
    sheetNames: data.sheetNames,
    sheetsCount: data.sheetsCount,
    productsCount: data.productsCount,
    isActive: true,
  });

  // 2. Now use transaction for the rest of the operations
  return await db.transaction(async (tx) => {
    // 2a. Deactivate all other imports
    await tx.update(importLogs).set({ isActive: false }).where(eq(importLogs.isActive, true));

    // 2b. Activate this import
    await tx.update(importLogs).set({ isActive: true }).where(eq(importLogs.id, importLogId));

    // 3. Tag and insert sheets one by one
    if (data.sheets.length > 0) {
      const sheetsWithLogId = data.sheets.map(s => ({ ...s, importLogId }));
      for (const sheet of sheetsWithLogId) {
        await tx.insert(cplSheets).values(sheet);
      }
    }

    // 4. Tag and insert products in batches
    if (data.products.length > 0) {
      const productsWithLogId = data.products.map(p => ({ ...p, importLogId }));
      const batchSize = 200;
      for (let i = 0; i < productsWithLogId.length; i += batchSize) {
        const batch = productsWithLogId.slice(i, i + batchSize);
        await tx.insert(cplProducts).values(batch);
      }
    }

    // 5. Insert summary
    if (data.summary) {
      await tx.insert(cplSummary).values({
        content: data.summary.content,
        version: data.summary.version,
        importLogId,
      });
    }

    return { importLogId };
  });
}

// ==================== CPL Stats helpers ====================
export async function getCplStats() {
  const db = await getDb();
  if (!db) return null;

  const activeLog = await getActiveImportLog();
  if (!activeLog) return null;

  const sheetsCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(cplSheets)
    .where(eq(cplSheets.importLogId, activeLog.id));

  const productsCount = await db.select({ count: sql<number>`COUNT(*)` })
    .from(cplProducts)
    .where(eq(cplProducts.importLogId, activeLog.id));

  return {
    importLogId: activeLog.id,
    fileName: activeLog.fileName,
    sheetsCount: Number(sheetsCount[0]?.count ?? 0),
    productsCount: Number(productsCount[0]?.count ?? 0),
    createdAt: activeLog.createdAt,
  };
}
