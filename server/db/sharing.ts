import { eq } from "drizzle-orm";
import {
  quotations, quotationItems,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function getQuotationByShareToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.select({
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
    validUntil: quotations.validUntil,
    createdAt: quotations.createdAt,
    updatedAt: quotations.updatedAt,
    version: quotations.version,
  }).from(quotations).where(eq(quotations.shareToken, token)).limit(1);
  if (!result) return null;
  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, result.id));
  return { ...result, items };
}
