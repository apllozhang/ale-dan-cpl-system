import { eq, like, and, sql, asc, desc, isNotNull } from "drizzle-orm";
import {
  productSpecSets, productSpecs, InsertProductSpecSet, InsertProductSpec,
} from "../../drizzle/schema";
import { getDb } from "./index";
import { getQuotationById } from "./quotations";

export async function getProductSpecSets(params: { search?: string; page?: number; pageSize?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (params.search) {
    conditions.push(like(productSpecSets.name, `%${params.search}%`));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: sql<number>`COUNT(*)` }).from(productSpecSets).where(whereClause);
  const total = Number((Array.isArray(countResult[0]) ? countResult[0][0] : countResult[0])?.total ?? 0);

  const items = await db.select().from(productSpecSets)
    .where(whereClause)
    .orderBy(desc(productSpecSets.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total };
}

export async function getProductSpecSetById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const setRows = await db.select().from(productSpecSets).where(eq(productSpecSets.id, id));
  const set = Array.isArray(setRows[0]) ? setRows[0][0] : setRows[0];
  if (!set) return null;

  const entries = await db.select().from(productSpecs)
    .where(eq(productSpecs.setId, id))
    .orderBy(asc(productSpecs.productModel));

  return { ...set, entries };
}

export async function createProductSpecSet(data: InsertProductSpecSet) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productSpecSets).values(data);
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return insertId;
}

export async function bulkInsertProductSpecs(items: InsertProductSpec[]) {
  const db = await getDb();
  if (!db) return;
  const BATCH = 200;
  for (let i = 0; i < items.length; i += BATCH) {
    await db.insert(productSpecs).values(items.slice(i, i + BATCH));
  }
}

export async function deleteProductSpecSet(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(productSpecs).where(eq(productSpecs.setId, id));
  await db.delete(productSpecSets).where(eq(productSpecSets.id, id));
}

export async function updateProductSpecEntry(id: number, data: { specs: Record<string, string>; productDesc?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(productSpecs).set({ specs: data.specs, productDesc: data.productDesc }).where(eq(productSpecs.id, id));
}

export async function addProductSpecEntry(data: InsertProductSpec) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productSpecs).values(data);
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return insertId;
}

export async function deleteProductSpecEntry(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(productSpecs).where(eq(productSpecs.id, id));
}

export async function matchQuotationWithSpecs(quotationId: number, setId: number) {
  const db = await getDb();
  if (!db) return { matched: [], unmatched: [], quotation: null };

  // Get quotation
  const quotation = await getQuotationById(quotationId);

  // Get all spec entries for the set
  const specEntries = await db.select().from(productSpecs)
    .where(eq(productSpecs.setId, setId));

  // Build lookup map: trimmed productModel -> spec entry
  const specMap = new Map<string, typeof specEntries[0]>();
  for (const entry of specEntries) {
    specMap.set(entry.productModel.trim(), entry);
  }

  // Match quotation items
  const matched: any[] = [];
  const unmatched: any[] = [];

  if (quotation?.items) {
    for (const item of quotation.items) {
      const model = (item.productModel || "").trim();
      const specEntry = specMap.get(model);
      if (specEntry) {
        matched.push({
          productModel: item.productModel,
          productDesc: specEntry.productDesc || item.productDesc,
          quantity: item.quantity,
          listPrice: item.listPrice,
          specs: specEntry.specs,
        });
      } else {
        unmatched.push({
          productModel: item.productModel,
          productDesc: item.productDesc,
          quantity: item.quantity,
          listPrice: item.listPrice,
        });
      }
    }
  }

  return { matched, unmatched, quotation };
}

export async function getLatestSpecSummary() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(productSpecSets)
    .where(isNotNull(productSpecSets.summaryContent))
    .orderBy(desc(productSpecSets.createdAt))
    .limit(1);
  const row = Array.isArray(rows[0]) ? rows[0][0] : rows[0];
  return row ?? null;
}
