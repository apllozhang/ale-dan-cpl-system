import { eq, like, or, and, sql, asc, desc, SQL, inArray } from "drizzle-orm";
import {
  quotations,
  quotationItems,
  quotationVersions,
  users,
  type InsertQuotation,
  type InsertQuotationItem,
  type Quotation,
} from "../../../drizzle/schema";
import { requireDb } from "../../db/index";
import type {
  QuotationStatus,
  QuotationListItem,
  QuotationDetail,
} from "./quotation.types";

// ──────────────────────── Read ────────────────────────

export async function getQuotations(params: {
  search?: string;
  status?: QuotationStatus | "all";
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  createdBy?: number;
}): Promise<{ items: QuotationListItem[]; total: number }> {
  const db = await requireDb();

  const {
    search,
    status,
    page = 1,
    pageSize = 20,
    sortBy,
    sortOrder = "desc",
    createdBy,
  } = params;
  const conditions: SQL[] = [];

  if (createdBy) {
    conditions.push(eq(quotations.createdBy, createdBy));
  }

  if (status && status !== "all") {
    conditions.push(eq(quotations.status, status));
  }

  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      or(
        like(quotations.quotationNo, searchTerm),
        like(quotations.customerName, searchTerm),
        like(quotations.projectName, searchTerm),
      )!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortColumnMap: Record<string, any> = {
    quotationNo: quotations.quotationNo,
    customerName: quotations.customerName,
    status: quotations.status,
    totalAmount: quotations.totalAmount,
    createdAt: quotations.createdAt,
  };
  const sortColumn =
    sortBy && sortColumnMap[sortBy]
      ? sortColumnMap[sortBy]
      : quotations.createdAt;
  const orderFn = sortOrder === "asc" ? asc : desc;

  const offset = (page - 1) * pageSize;

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: quotations.id,
        quotationNo: quotations.quotationNo,
        customerName: quotations.customerName,
        customerContact: quotations.customerContact,
        customerPhone: quotations.customerPhone,
        customerEmail: quotations.customerEmail,
        industry: quotations.industry,
        projectName: quotations.projectName,
        status: quotations.status,
        discountRate: quotations.discountRate,
        totalAmount: quotations.totalAmount,
        notes: quotations.notes,
        createdBy: quotations.createdBy,
        validUntil: quotations.validUntil,
        createdAt: quotations.createdAt,
        updatedAt: quotations.updatedAt,
        creatorName: users.name,
        creatorUsername: users.username,
      })
      .from(quotations)
      .leftJoin(users, eq(quotations.createdBy, users.id))
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(quotations)
      .where(whereClause),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
}

export async function getQuotationById(
  id: number,
): Promise<QuotationDetail | null> {
  const db = await requireDb();

  const [quotation] = await db
    .select({
      id: quotations.id,
      quotationNo: quotations.quotationNo,
      customerName: quotations.customerName,
      customerContact: quotations.customerContact,
      customerPhone: quotations.customerPhone,
      customerEmail: quotations.customerEmail,
      industry: quotations.industry,
      projectName: quotations.projectName,
      status: quotations.status,
      discountRate: quotations.discountRate,
      totalAmount: quotations.totalAmount,
      notes: quotations.notes,
      createdBy: quotations.createdBy,
      validUntil: quotations.validUntil,
      createdAt: quotations.createdAt,
      updatedAt: quotations.updatedAt,
      creatorName: users.name,
      creatorUsername: users.username,
      version: quotations.version,
      shareToken: quotations.shareToken,
    })
    .from(quotations)
    .leftJoin(users, eq(quotations.createdBy, users.id))
    .where(eq(quotations.id, id))
    .limit(1);

  if (!quotation) return null;

  const items = await db
    .select()
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, id));

  return { ...quotation, items };
}

export async function getQuotationsByIds(
  ids: number[],
): Promise<Pick<Quotation, "id" | "createdBy" | "status">[]> {
  if (ids.length === 0) return [];
  const db = await requireDb();
  return db
    .select({
      id: quotations.id,
      createdBy: quotations.createdBy,
      status: quotations.status,
    })
    .from(quotations)
    .where(inArray(quotations.id, ids));
}

// ──────────────────────── Create ────────────────────────

export async function createQuotation(
  data: InsertQuotation,
  items: InsertQuotationItem[],
): Promise<{ id: number; quotationNo: string }> {
  const db = await requireDb();

  // Generate quotationNo atomically: QT-YYYYMMDD-NNN
  // Uses a transaction with SELECT FOR UPDATE to prevent concurrent duplicates
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `QT-${dateStr}-`;

  return await db.transaction(async (tx) => {
    // Lock the matching rows to prevent concurrent sequence generation
    const seqResult = await tx.execute(sql`
      SELECT CAST(SUBSTRING_INDEX(quotationNo, '-', -1) AS UNSIGNED) AS seq
      FROM quotations
      WHERE quotationNo LIKE ${prefix + "%"}
      ORDER BY seq DESC
      LIMIT 1
      FOR UPDATE
    `);
    const rows = Array.isArray(seqResult[0])
      ? (seqResult[0] as Array<{ seq: number }>)
      : [];
    const nextSeq = (rows[0]?.seq ?? 0) + 1;
    const quotationNo = `${prefix}${String(nextSeq).padStart(3, "0")}`;

    const result = await tx.insert(quotations).values({
      ...data,
      quotationNo,
    });
    const quotationId = Number(result[0].insertId);

    if (items.length > 0) {
      const itemsWithQId = items.map((item) => ({
        ...item,
        quotationId,
      }));
      const batchSize = 100;
      for (let i = 0; i < itemsWithQId.length; i += batchSize) {
        const batch = itemsWithQId.slice(i, i + batchSize);
        await tx.insert(quotationItems).values(batch);
      }
    }

    return { id: quotationId, quotationNo };
  });
}

// ──────────────────────── Update (split from updateQuotation) ────────────────────────

/**
 * Update quotation fields only (no items, no versioning).
 * Caller is responsible for wrapping in a transaction.
 */
export async function updateQuotationFields(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  id: number,
  data: Partial<InsertQuotation>,
): Promise<boolean> {
  const updateSet: Record<string, unknown> = {};
  if (data.customerName !== undefined) updateSet.customerName = data.customerName;
  if (data.customerContact !== undefined)
    updateSet.customerContact = data.customerContact;
  if (data.customerPhone !== undefined)
    updateSet.customerPhone = data.customerPhone;
  if (data.customerEmail !== undefined)
    updateSet.customerEmail = data.customerEmail;
  if (data.industry !== undefined) updateSet.industry = data.industry;
  if (data.projectName !== undefined) updateSet.projectName = data.projectName;
  if (data.discountRate !== undefined) updateSet.discountRate = data.discountRate;
  if (data.totalAmount !== undefined) updateSet.totalAmount = data.totalAmount;
  if (data.notes !== undefined) updateSet.notes = data.notes;
  if (data.validUntil !== undefined) updateSet.validUntil = data.validUntil;
  if (data.status !== undefined) updateSet.status = data.status;

  if (Object.keys(updateSet).length > 0) {
    await tx.update(quotations).set(updateSet).where(eq(quotations.id, id));
    return true;
  }
  return false;
}

/**
 * Replace all quotation items (delete existing + insert new).
 * Caller is responsible for wrapping in a transaction.
 */
export async function replaceQuotationItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  quotationId: number,
  items: InsertQuotationItem[],
): Promise<void> {
  await tx
    .delete(quotationItems)
    .where(eq(quotationItems.quotationId, quotationId));
  if (items.length > 0) {
    const itemsWithQId = items.map((item) => ({
      ...item,
      quotationId,
    }));
    const batchSize = 100;
    for (let i = 0; i < itemsWithQId.length; i += batchSize) {
      const batch = itemsWithQId.slice(i, i + batchSize);
      await tx.insert(quotationItems).values(batch);
    }
  }
}

// ──────────────────────── Status ────────────────────────

export async function updateQuotationStatus(
  id: number,
  status: QuotationStatus,
): Promise<void> {
  const db = await requireDb();
  await db.update(quotations).set({ status }).where(eq(quotations.id, id));
}

export async function batchUpdateQuotationStatus(
  ids: number[],
  status: QuotationStatus,
): Promise<void> {
  if (ids.length === 0) return;
  const db = await requireDb();
  await db
    .update(quotations)
    .set({ status })
    .where(inArray(quotations.id, ids));
}

// ──────────────────────── Delete (cascade) ────────────────────────

export async function deleteQuotation(id: number): Promise<void> {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));
    await tx
      .delete(quotationVersions)
      .where(eq(quotationVersions.quotationId, id));
    await tx.delete(quotations).where(eq(quotations.id, id));
  });
}

export async function batchDeleteQuotations(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx
      .delete(quotationItems)
      .where(inArray(quotationItems.quotationId, ids));
    await tx
      .delete(quotationVersions)
      .where(inArray(quotationVersions.quotationId, ids));
    await tx.delete(quotations).where(inArray(quotations.id, ids));
  });
}
