import { eq, ne, like, or, and, sql, asc, desc, isNotNull, inArray, SQL } from "drizzle-orm";
import {
  importLogs, cplSheets, cplProducts, cplSummary, InsertImportLog, InsertCplSheet, InsertCplProduct,
} from "../../drizzle/schema";
import { getDb } from "./index";

// ==================== Import Logs helpers ====================
export async function deactivateAllImports() {
  const db = await getDb();
  if (!db) return;
  await db.update(importLogs).set({ isActive: false }).where(ne(importLogs.id, -1));
}

export async function activateImport(importLogId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(importLogs).set({ isActive: true }).where(eq(importLogs.id, importLogId));
}

export async function createImportLogAndGetId(data: InsertImportLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const insertResult = await db.insert(importLogs).values(data);

  // mysql2 returns ResultSetHeader; insertId may be BigInt on Node 22
  const rawId = (insertResult as any).insertId ?? (insertResult as any)[0]?.insertId;
  let insertId: number;
  if (typeof rawId === "bigint") {
    insertId = Number(rawId);
  } else if (typeof rawId === "number") {
    insertId = rawId;
  } else {
    // Fallback: query by max id
    const [row] = await db.select({ id: sql<number>`LAST_INSERT_ID()` }).from(importLogs).limit(1);
    insertId = typeof row?.id === "bigint" ? Number(row.id) : Number(row?.id ?? 0);
  }

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

// getImportLogs is in ./importLogs.ts — do not re-export from here

// ==================== CPL Sheets helpers ====================
export async function getCplSheets(params: { importLogId?: number; page?: number; pageSize?: number } = {}) {
  const db = await getDb();
  if (!db) return [];

  // Default to active import log so stale sheets from old imports don't leak
  const importLogId = params.importLogId ?? await getActiveImportLogId();
  if (!importLogId) return [];

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const items = await db.select().from(cplSheets)
    .where(eq(cplSheets.importLogId, importLogId))
    .orderBy(asc(cplSheets.displayOrder))
    .limit(pageSize)
    .offset(offset);

  return items;
}

// ==================== CPL Products helpers ====================
export async function getCplProducts(params: {
  sheetName?: string;
  sheetNames?: string[];
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
} = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const activeImportId = await getActiveImportLogId();
  if (!activeImportId) return { items: [], total: 0 };

  const { sheetName, sheetNames, search, page = 1, pageSize = 50, sortBy, sortOrder = "asc", filters } = params;
  const conditions: SQL[] = [eq(cplProducts.importLogId, activeImportId)];

  if (sheetNames && sheetNames.length > 0) {
    conditions.push(inArray(cplProducts.sheetName, sheetNames));
  } else if (sheetName) {
    conditions.push(eq(cplProducts.sheetName, sheetName));
  }

  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      or(
        like(cplProducts.productGroup, searchTerm),
        like(cplProducts.taxCategory, searchTerm),
        like(cplProducts.productModel, searchTerm),
        like(cplProducts.productDesc, searchTerm),
        like(cplProducts.salesCategory, searchTerm),
        like(cplProducts.serviceCategory, searchTerm),
        like(cplProducts.productStatus, searchTerm),
        like(cplProducts.listPrice, searchTerm),
        like(cplProducts.priceNote, searchTerm),
        like(cplProducts.isNew, searchTerm),
        like(cplProducts.remark, searchTerm),
      )!
    );
  }

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (!value || !value.trim()) continue;
      const columnMap: Record<string, any> = {
        productGroup: cplProducts.productGroup,
        taxCategory: cplProducts.taxCategory,
        productModel: cplProducts.productModel,
        productDesc: cplProducts.productDesc,
        salesCategory: cplProducts.salesCategory,
        serviceCategory: cplProducts.serviceCategory,
        productStatus: cplProducts.productStatus,
        listPrice: cplProducts.listPrice,
        priceNote: cplProducts.priceNote,
        isNew: cplProducts.isNew,
        remark: cplProducts.remark,
      };
      if (columnMap[key]) {
        conditions.push(like(columnMap[key], `%${value.trim()}%`));
      }
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumnMap: Record<string, any> = {
    productGroup: cplProducts.productGroup,
    taxCategory: cplProducts.taxCategory,
    productModel: cplProducts.productModel,
    productDesc: cplProducts.productDesc,
    salesCategory: cplProducts.salesCategory,
    serviceCategory: cplProducts.serviceCategory,
    productStatus: cplProducts.productStatus,
    listPrice: cplProducts.listPrice,
    priceNote: cplProducts.priceNote,
    isNew: cplProducts.isNew,
    remark: cplProducts.remark,
  };
  const sortColumn = sortBy && sortColumnMap[sortBy] ? sortColumnMap[sortBy] : cplProducts.id;
  const orderFn = sortOrder === "desc" ? desc : asc;

  const offset = (page - 1) * pageSize;

  const [items, countResult] = await Promise.all([
    db.select().from(cplProducts).where(whereClause).orderBy(orderFn(sortColumn)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(cplProducts).where(whereClause),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
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
    // 2a. Deactivate all other imports (excluding the new one)
    await tx.update(importLogs).set({ isActive: false }).where(ne(importLogs.id, importLogId));

    // 2b. Ensure this import is activated
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
export async function getActiveImportLogId(): Promise<number | null> {
  const log = await getActiveImportLog();
  return log?.id ?? null;
}

export async function getLatestSummary() {
  const db = await getDb();
  if (!db) return null;
  const activeImportId = await getActiveImportLogId();
  if (!activeImportId) return null;
  const result = await db.select().from(cplSummary).where(eq(cplSummary.importLogId, activeImportId)).orderBy(desc(cplSummary.importedAt)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function countCplProducts() {
  const db = await getDb();
  if (!db) return 0;
  const activeImportId = await getActiveImportLogId();
  if (!activeImportId) return 0;
  return db.$count(cplProducts, eq(cplProducts.importLogId, activeImportId));
}

export async function insertSheets(sheets: InsertCplSheet[]) {
  const db = await getDb();
  if (!db || sheets.length === 0) return;
  const batchSize = 50;
  for (let i = 0; i < sheets.length; i += batchSize) {
    const batch = sheets.slice(i, i + batchSize);
    await db.insert(cplSheets).values(batch);
  }
}

export async function bulkInsertProducts(products: InsertCplProduct[]) {
  const db = await getDb();
  if (!db) return;
  const batchSize = 200;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    await db.insert(cplProducts).values(batch);
  }
}

export async function insertSummary(summary: { content: string; version: string; importLogId: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(cplSummary).values(summary);
}

export async function getCplStats() {
  const db = await getDb();
  if (!db) return {
    importLogId: 0, fileName: "", sheetsCount: 0, productsCount: 0, createdAt: new Date(),
    bySheet: [], byStatus: [], bySalesCategory: [], total: 0,
  };

  const activeImportId = await getActiveImportLogId();
  if (!activeImportId) return {
    importLogId: 0, fileName: "", sheetsCount: 0, productsCount: 0, createdAt: new Date(),
    bySheet: [], byStatus: [], bySalesCategory: [], total: 0,
  };

  const activeLog = await getActiveImportLog();

  const bySheet = await db.select({
    sheetName: cplProducts.sheetName,
    count: sql<number>`count(*)`,
  }).from(cplProducts)
    .where(eq(cplProducts.importLogId, activeImportId))
    .groupBy(cplProducts.sheetName)
    .orderBy(desc(sql`count(*)`));

  const byStatus = await db.select({
    status: cplProducts.productStatus,
    count: sql<number>`count(*)`,
  }).from(cplProducts)
    .where(and(
      eq(cplProducts.importLogId, activeImportId),
      sql`${cplProducts.productStatus} IS NOT NULL AND ${cplProducts.productStatus} != ''`,
    ))
    .groupBy(cplProducts.productStatus)
    .orderBy(desc(sql`count(*)`));

  const bySalesCategory = await db.select({
    category: cplProducts.salesCategory,
    count: sql<number>`count(*)`,
  }).from(cplProducts)
    .where(and(
      eq(cplProducts.importLogId, activeImportId),
      sql`${cplProducts.salesCategory} IS NOT NULL AND ${cplProducts.salesCategory} != ''`,
    ))
    .groupBy(cplProducts.salesCategory)
    .orderBy(desc(sql`count(*)`))
    .limit(15);

  const [totalRow] = await db.select({ count: sql<number>`count(*)` })
    .from(cplProducts)
    .where(eq(cplProducts.importLogId, activeImportId));

  return {
    importLogId: activeImportId,
    fileName: activeLog?.fileName ?? "",
    sheetsCount: activeLog?.sheetsCount ?? 0,
    productsCount: activeLog?.productsCount ?? 0,
    createdAt: activeLog?.createdAt ?? new Date(),
    bySheet,
    byStatus,
    bySalesCategory,
    total: totalRow?.count ?? 0,
  };
}
