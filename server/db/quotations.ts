// server/db/quotations.ts — backward-compatible re-export
// New code should import from server/domain/quotations/ directly
import { eq, sql } from "drizzle-orm";
import {
  quotations, quotationItems, quotationVersions,
  type InsertQuotation, type InsertQuotationItem,
} from "../../drizzle/schema";
import { requireDb } from "./index";
import {
  updateQuotationFields,
  replaceQuotationItems,
} from "../domain/quotations/quotation.repo";

export {
  getQuotations,
  getQuotationById,
  getQuotationsByIds,
  createQuotation,
  updateQuotationStatus,
  batchUpdateQuotationStatus,
  deleteQuotation,
  batchDeleteQuotations,
} from "../domain/quotations/quotation.repo";

export {
  getMyDashboardStats,
  getMyRecentQuotations,
  getQuotationAnalytics,
} from "../domain/quotations/quotation.analytics";

export type {
  QuotationStatus,
  QuotationListItem,
  QuotationDetail,
  RecentQuotation,
  QuotationAnalytics,
} from "../domain/quotations/quotation.types";

/**
 * @deprecated Use updateQuotationFields + replaceQuotationItems in a transaction instead.
 * Kept for backward compatibility with sharing router and legacy callers.
 */
export async function updateQuotation(
  id: number,
  data: Partial<InsertQuotation>,
  items?: InsertQuotationItem[],
  userId?: number,
): Promise<void> {
  const db = await requireDb();

  await db.transaction(async (tx) => {
    // Snapshot current state BEFORE update (for version tracking)
    const oldItems = await tx.select().from(quotationItems).where(eq(quotationItems.quotationId, id));
    const [oldQuotation] = await tx.select({
      version: quotations.version,
      totalAmount: quotations.totalAmount,
      customerName: quotations.customerName,
      projectName: quotations.projectName,
      status: quotations.status,
      notes: quotations.notes,
    }).from(quotations).where(eq(quotations.id, id)).limit(1);

    if (!oldQuotation) throw new Error(`Quotation ${id} not found`);

    const fieldsUpdated = await updateQuotationFields(tx, id, data);

    if (items !== undefined) {
      await replaceQuotationItems(tx, id, items);
    }

    // Auto-create version snapshot with change summary
    if (fieldsUpdated || items !== undefined) {
      const newVersion = (oldQuotation.version ?? 1) + 1;

      // Compute diff summary
      const oldItemMap = new Map(oldItems.map(it => [it.productModel, it]));
      const newItems = items ?? oldItems;
      const added: string[] = [];
      const removed: string[] = [];
      const modified: string[] = [];

      if (items !== undefined) {
        for (const ni of newItems) {
          const oi = oldItemMap.get(ni.productModel);
          if (!oi) {
            added.push(ni.productModel);
          } else {
            if (Number(oi.quantity) !== ni.quantity || Number(oi.discountRate ?? 0) !== Number(ni.discountRate ?? 0)) {
              modified.push(ni.productModel);
            }
          }
        }
        const newItemSet = new Set(newItems.map(it => it.productModel));
        for (const oi of oldItems) {
          if (!newItemSet.has(oi.productModel)) removed.push(oi.productModel);
        }
      }

      const changes: string[] = [];
      if (added.length > 0) changes.push(`+${added.length}项: ${added.slice(0, 3).join(", ")}${added.length > 3 ? "..." : ""}`);
      if (removed.length > 0) changes.push(`-${removed.length}项: ${removed.slice(0, 3).join(", ")}${removed.length > 3 ? "..." : ""}`);
      if (modified.length > 0) changes.push(`改${modified.length}项: ${modified.slice(0, 3).join(", ")}${modified.length > 3 ? "..." : ""}`);
      if (data.customerName && data.customerName !== oldQuotation.customerName) changes.push("客户名称变更");
      if (data.projectName && data.projectName !== oldQuotation.projectName) changes.push("项目名称变更");
      if (data.status && data.status !== oldQuotation.status) changes.push(`状态→${data.status}`);

      const snapshot = JSON.stringify({
        items: (items ?? oldItems).map(it => ({
          productModel: it.productModel,
          productDesc: it.productDesc,
          listPrice: it.listPrice,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountRate: it.discountRate,
          subtotal: it.subtotal,
        })),
        totalAmount: data.totalAmount ?? oldQuotation.totalAmount,
        changeSummary: changes.length > 0 ? changes.join("; ") : "信息更新",
        diff: { added, removed, modified },
      });

      await tx.update(quotations).set({ version: newVersion }).where(eq(quotations.id, id));
      await tx.insert(quotationVersions).values({
        quotationId: id,
        version: newVersion,
        snapshot,
        createdBy: userId ?? 0,
      });
    }
  });
}
