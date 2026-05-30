import { eq, like, or, and, sql, asc, desc, SQL, inArray } from "drizzle-orm";
import {
  cplProducts, cplSheets, cplSummary,
  InsertCplProduct, InsertCplSheet, InsertCplSummary,
  importLogs, InsertImportLog,
} from "../../drizzle/schema";
import { getDb } from "./index";

// ==================== Import Log helpers (used by CPL) ====================
export async function getActiveImportLogId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({ id: importLogs.id }).from(importLogs).where(eq(importLogs.isActive, true)).limit(1);
  return result.length > 0 ? result[0].id : null;
}

export async function setCplImportActive(importLogId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(importLogs).set({ isActive: false }).where(eq(importLogs.isActive, true));
  await db.update(importLogs).set({ isActive: true }).where(eq(importLogs.id, importLogId));
}

export async function deactivateAllImports() {
  const db = await getDb();
  if (!db) return;
  await db.update(importLogs).set({ isActive: false }).where(eq(importLogs.isActive, true));
}

export async function createImportLogAndGetId(data: InsertImportLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: any = await db.insert(importLogs).values(data);
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return Number(rows.insertId ?? rows[0]?.insertId ?? 0);
}

export async function getImportLogById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(importLogs).where(eq(importLogs.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ==================== CPL Product helpers ====================
export async function getCplProducts(params: {
  sheetName?: string;
  sheetNames?: string[];
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
}) {
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

  // Apply column-specific filters
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (!value || !value.trim()) continue;
      const filterTerm = `%${value.trim()}%`;
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
        conditions.push(like(columnMap[key], filterTerm));
      }
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Sort
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

// ==================== CPL Sheet helpers ====================
export async function getCplSheets() {
  const db = await getDb();
  if (!db) return [];
  const activeImportId = await getActiveImportLogId();
  if (!activeImportId) return [];
  return db.select().from(cplSheets).where(eq(cplSheets.importLogId, activeImportId)).orderBy(asc(cplSheets.displayOrder));
}

export async function insertSheets(sheets: InsertCplSheet[]) {
  const db = await getDb();
  if (!db || sheets.length === 0) return;
  await db.insert(cplSheets).values(sheets);
}

// ==================== CPL Summary helpers ====================
export async function getLatestSummary() {
  const db = await getDb();
  if (!db) return null;
  const activeImportId = await getActiveImportLogId();
  if (!activeImportId) return null;
  const result = await db.select().from(cplSummary).where(eq(cplSummary.importLogId, activeImportId)).orderBy(desc(cplSummary.importedAt)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function insertSummary(summary: InsertCplSummary) {
  const db = await getDb();
  if (!db) return;
  await db.insert(cplSummary).values(summary);
}

// ==================== Bulk import helpers ====================
export async function clearAllProducts() {
  // Deprecated: kept for backward compat, no longer used in new import flow
  const db = await getDb();
  if (!db) return;
  await db.delete(cplProducts);
}

export async function bulkInsertProducts(products: InsertCplProduct[]) {
  const db = await getDb();
  if (!db) return;
  // Insert in batches of 200
  const batchSize = 200;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    await db.insert(cplProducts).values(batch);
  }
}

export async function countCplProducts() {
  const db = await getDb();
  if (!db) return 0;
  const activeImportId = await getActiveImportLogId();
  if (!activeImportId) return 0;
  return db.$count(cplProducts, eq(cplProducts.importLogId, activeImportId));
}

// ==================== Transactional import ====================
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

  return await db.transaction(async (tx) => {
    // 1. Create import log
    const result: any = await tx.insert(importLogs).values({
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
    const rows = Array.isArray(result[0]) ? result[0] : result;
    const importLogId = Number(rows.insertId ?? rows[0]?.insertId ?? 0);

    // 2. Deactivate all other imports
    await tx.update(importLogs).set({ isActive: false }).where(eq(importLogs.isActive, true));

    // 3. Activate this import
    await tx.update(importLogs).set({ isActive: true }).where(eq(importLogs.id, importLogId));

    // 4. Tag and insert sheets
    if (data.sheets.length > 0) {
      const sheetsWithLogId = data.sheets.map(s => ({ ...s, importLogId }));
      await tx.insert(cplSheets).values(sheetsWithLogId);
    }

    // 5. Tag and insert products in batches
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
export async function getCplStats() {
  const db = await getDb();
  if (!db) return { bySheet: [], byStatus: [], bySalesCategory: [], total: 0 };

  const bySheet = await db.select({
    sheetName: cplProducts.sheetName,
    count: sql<number>`count(*)`,
  }).from(cplProducts)
    .groupBy(cplProducts.sheetName)
    .orderBy(desc(sql`count(*)`));

  const byStatus = await db.select({
    status: cplProducts.productStatus,
    count: sql<number>`count(*)`,
  }).from(cplProducts)
    .where(sql`${cplProducts.productStatus} IS NOT NULL AND ${cplProducts.productStatus} != ''`)
    .groupBy(cplProducts.productStatus)
    .orderBy(desc(sql`count(*)`));

  const bySalesCategory = await db.select({
    category: cplProducts.salesCategory,
    count: sql<number>`count(*)`,
  }).from(cplProducts)
    .where(sql`${cplProducts.salesCategory} IS NOT NULL AND ${cplProducts.salesCategory} != ''`)
    .groupBy(cplProducts.salesCategory)
    .orderBy(desc(sql`count(*)`))
    .limit(15);

  const [totalRow] = await db.select({
    count: sql<number>`count(*)`,
  }).from(cplProducts);

  return { bySheet, byStatus, bySalesCategory, total: totalRow?.count ?? 0 };
}
