import { eq, like, and, sql, asc, desc, isNotNull } from "drizzle-orm";
import {
  productSpecSets, productSpecs, InsertProductSpecSet, InsertProductSpec,
} from "../../drizzle/schema";
import { getDb } from "./index";
import { getQuotationById } from "./quotations";
import type { MatchedSpecItem, UnmatchedSpecItem, SpecSetCoverage, SpecMatchResult } from "@shared/types";
import { escapeLikeWildcards } from "@shared/utils";

export async function getProductSpecSets(params: { search?: string; page?: number; pageSize?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (params.search) {
    conditions.push(like(productSpecSets.name, `%${escapeLikeWildcards(params.search)}%`));
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

type SpecEntry = { productModel: string; productDesc: string | null; specs: Record<string, string> };

function normalizeForMatch(model: string) {
  const trimmed = model.trim();
  return {
    exact: trimmed,
    lower: trimmed.toLowerCase(),
    noSpace: trimmed.replace(/\s/g, ""),
  };
}

export async function matchQuotationWithSpecs(quotationId: number, setId: number): Promise<SpecMatchResult> {
  const db = await getDb();
  if (!db) return { matched: [], unmatched: [], quotation: null };

  const quotation = await getQuotationById(quotationId);

  const specEntries = await db.select().from(productSpecs)
    .where(eq(productSpecs.setId, setId));

  const lookup = buildLookup(specEntries);

  const matched: MatchedSpecItem[] = [];
  const unmatched: UnmatchedSpecItem[] = [];

  if (quotation?.items) {
    for (const item of quotation.items) {
      const specEntry = lookup.find(item.productModel || "");
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

export async function matchQuotationWithAllSpecs(quotationId: number): Promise<SpecMatchResult> {
  const db = await getDb();
  if (!db) return { matched: [], unmatched: [], quotation: null };

  const quotation = await getQuotationById(quotationId);
  if (!quotation) return { matched: [], unmatched: [], quotation: null };

  const allSpecEntries = await db.select().from(productSpecs);
  const lookup = buildLookup(allSpecEntries);

  const matched: MatchedSpecItem[] = [];
  const unmatched: UnmatchedSpecItem[] = [];

  if (quotation.items) {
    for (const item of quotation.items) {
      const specEntry = lookup.find(item.productModel || "");
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

export async function getBestMatchSet(quotationId: number): Promise<SpecSetCoverage[]> {
  const db = await getDb();
  if (!db) return [];

  const quotation = await getQuotationById(quotationId);
  if (!quotation?.items?.length) return [];

  const totalItems = quotation.items.length;

  const sets = await db.select().from(productSpecSets)
    .orderBy(desc(productSpecSets.createdAt));

  if (sets.length === 0) return [];

  // Single query: load ALL spec entries, then group by setId in memory
  const allSpecEntries = await db.select().from(productSpecs);
  const entriesBySet = new Map<number, typeof allSpecEntries>();
  for (const entry of allSpecEntries) {
    let arr = entriesBySet.get(entry.setId);
    if (!arr) { arr = []; entriesBySet.set(entry.setId, arr); }
    arr.push(entry);
  }

  const results: SpecSetCoverage[] = [];

  for (const set of sets) {
    const specEntries = entriesBySet.get(set.id) ?? [];
    const lookup = buildLookup(specEntries);
    let matchedCount = 0;
    for (const item of quotation.items) {
      if (lookup.find(item.productModel || "")) matchedCount++;
    }
    results.push({
      setId: set.id,
      setName: set.name,
      fileName: set.fileName ?? null,
      coverageRate: Math.round((matchedCount / totalItems) * 100),
      matchedCount,
      totalItems,
    });
  }

  return results.sort((a, b) => b.coverageRate - a.coverageRate);
}

// Unified five-level lookup used by both matchQuotationWithSpecs and getBestMatchSet
function buildLookup(entries: SpecEntry[]) {
  const l1Map = new Map<string, SpecEntry>();
  const l2Map = new Map<string, SpecEntry>();
  const l3Map = new Map<string, SpecEntry>();

  for (const entry of entries) {
    const norm = normalizeForMatch(entry.productModel);
    l1Map.set(norm.exact, entry);
    l2Map.set(norm.lower, entry);
    l3Map.set(norm.noSpace, entry);
  }

  function find(itemModel: string): SpecEntry | null {
    const norm = normalizeForMatch(itemModel);
    // L1-L3: exact / case-insensitive / no-space
    const exact = l1Map.get(norm.exact) ?? l2Map.get(norm.lower) ?? l3Map.get(norm.noSpace);
    if (exact) return exact;

    const lower = norm.lower;
    // L4: item starts with spec entry (e.g. "9907-E-AC" → "9907", "F5-E-AC" → "F5")
    let best: SpecEntry | null = null;
    let bestLen = 0;
    for (const entry of entries) {
      const entryLower = entry.productModel.trim().toLowerCase();
      if (entryLower.length >= 2 && lower.startsWith(entryLower) && entryLower.length > bestLen) {
        best = entry;
        bestLen = entryLower.length;
      }
    }
    if (best) return best;

    // L5: spec entry starts with item (e.g. item "9907" → spec "9907-E-AC", item "F5" → spec "F5-E-AC")
    for (const entry of entries) {
      const entryLower = entry.productModel.trim().toLowerCase();
      if (lower.length >= 2 && entryLower.startsWith(lower) && entryLower.length > bestLen) {
        best = entry;
        bestLen = entryLower.length;
      }
    }
    return best;
  }

  return { find };
}
