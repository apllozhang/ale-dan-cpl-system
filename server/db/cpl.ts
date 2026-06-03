import { randomUUID } from "crypto";
import { eq, ne, like, or, and, sql, asc, desc, isNotNull, inArray, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  importLogs, cplSheets, cplProducts, cplSummary, InsertImportLog, InsertCplSheet, InsertCplProduct,
} from "../../drizzle/schema";
import { getDb } from "./index";

type DbInstance = ReturnType<typeof drizzle>;
type DbTransaction = Parameters<Parameters<DbInstance["transaction"]>[0]>[0];

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

async function createImportLogAndGetId(tx: DbTransaction, data: Omit<InsertImportLog, "batchId">): Promise<number> {
  // Generate a unique batchId so we can reliably find the exact row we just inserted,
  // regardless of TiDB's non-monotonic auto-increment behavior
  const batchId = randomUUID();
  await tx.insert(importLogs).values({
    batchId,
    fileName: data.fileName,
    userId: data.userId,
    username: data.username,
    orgName: data.orgName ?? null,
    groupName: data.groupName ?? null,
    mode: data.mode,
    isActive: data.isActive,
    sheetNames: data.sheetNames,
    sheetsCount: data.sheetsCount,
    productsCount: data.productsCount,
  });
  // Query back by batchId — guaranteed to find exactly our row
  const [row] = await tx.select({ id: importLogs.id })
    .from(importLogs)
    .where(eq(importLogs.batchId, batchId))
    .limit(1);
  if (!row || !row.id || row.id <= 0) {
    throw new Error(`Failed to retrieve import log after insert for batchId=${batchId}`);
  }
  console.log(`[import] Created import_log id=${row.id}, batchId=${batchId}, fileName=${data.fileName}`);
  return row.id;
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
  statusFilter?: string;
  newOnly?: boolean;
  priceMin?: number;
  priceMax?: number;
} = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const activeImportId = await getActiveImportLogId();
  if (!activeImportId) return { items: [], total: 0 };

  const { sheetName, sheetNames, search, page = 1, pageSize = 50, sortBy, sortOrder = "asc", filters, statusFilter, newOnly, priceMin, priceMax } = params;
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

  if (statusFilter && statusFilter !== "all") {
    conditions.push(eq(cplProducts.productStatus, statusFilter));
  }

  if (newOnly) {
    conditions.push(
      or(
        like(cplProducts.isNew, "%新品%"),
        like(cplProducts.isNew, "%New%"),
        like(cplProducts.isNew, "%Yes%"),
        eq(cplProducts.isNew, "1"),
      )!
    );
  }

  if (priceMin !== undefined) {
    conditions.push(sql`CAST(${cplProducts.listPrice} AS DECIMAL(20,2)) >= ${priceMin}`);
  }
  if (priceMax !== undefined) {
    conditions.push(sql`CAST(${cplProducts.listPrice} AS DECIMAL(20,2)) <= ${priceMax}`);
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

export async function getCplProductsByIds(ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  const activeImportId = await getActiveImportLogId();
  if (!activeImportId) return [];
  return db.select().from(cplProducts).where(
    and(eq(cplProducts.importLogId, activeImportId), inArray(cplProducts.id, ids))
  );
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

  // Everything in ONE transaction — if any step fails, the entire thing rolls back
  // (including the import_log row), so failed imports never appear in history.
  return await db.transaction(async (tx) => {
    // 1. Create import log (inactive initially)
    const importLogId = await createImportLogAndGetId(tx, {
      fileName: data.fileName,
      userId: data.userId,
      username: data.username,
      orgName: data.orgName,
      groupName: data.groupName,
      mode: "overwrite",
      sheetNames: data.sheetNames,
      sheetsCount: data.sheetsCount,
      productsCount: data.productsCount,
      isActive: false,
    });
    console.log(`[import] Starting overwrite importLogId=${importLogId}, sheets=${data.sheets.length}, products=${data.products.length}`);

    // 2. Deactivate ALL other imports
    await tx.update(importLogs).set({ isActive: false }).where(ne(importLogs.id, importLogId));

    // 3. Activate this import
    await tx.update(importLogs).set({ isActive: true }).where(eq(importLogs.id, importLogId));

    // 4. Insert sheets one by one
    if (data.sheets.length > 0) {
      const sheetsWithLogId = data.sheets.map(s => ({ ...s, importLogId }));
      for (const sheet of sheetsWithLogId) {
        try {
          await tx.insert(cplSheets).values(sheet);
        } catch (sheetErr: unknown) {
          const msg = sheetErr instanceof Error ? sheetErr.message : String(sheetErr);
          console.error(`[import] Failed to insert sheet importLogId=${importLogId} sheetName=${sheet.sheetName}: ${msg}`);
          throw sheetErr;
        }
      }
    }

    // 5. Insert products in batches
    if (data.products.length > 0) {
      const productsWithLogId = data.products.map(p => ({ ...p, importLogId }));
      const batchSize = 200;
      for (let i = 0; i < productsWithLogId.length; i += batchSize) {
        const batch = productsWithLogId.slice(i, i + batchSize);
        await tx.insert(cplProducts).values(batch);
      }
    }

    // 6. Insert summary
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
