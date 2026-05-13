import { eq, like, or, and, sql, asc, desc, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, cplProducts, cplSheets, cplSummary, InsertCplProduct, InsertCplSheet, InsertCplSummary } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User helpers ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== CPL Product helpers ====================
export async function getCplProducts(params: {
  sheetName?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const { sheetName, search, page = 1, pageSize = 50, sortBy, sortOrder = "asc", filters } = params;
  const conditions: SQL[] = [];

  if (sheetName) {
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
  return db.select().from(cplSheets).orderBy(asc(cplSheets.displayOrder));
}

export async function clearAndInsertSheets(sheets: InsertCplSheet[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cplSheets);
  if (sheets.length > 0) {
    await db.insert(cplSheets).values(sheets);
  }
}

// ==================== CPL Summary helpers ====================
export async function getLatestSummary() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cplSummary).orderBy(desc(cplSummary.importedAt)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function insertSummary(summary: InsertCplSummary) {
  const db = await getDb();
  if (!db) return;
  await db.insert(cplSummary).values(summary);
}

// ==================== Bulk import helpers ====================
export async function clearAllProducts() {
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
