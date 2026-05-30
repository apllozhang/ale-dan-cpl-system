import { eq, or, desc } from "drizzle-orm";
import {
  quotationTemplates, InsertQuotationTemplate,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function getQuotationTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quotationTemplates)
    .where(or(
      eq(quotationTemplates.createdBy, userId),
      eq(quotationTemplates.isPublic, true),
    ))
    .orderBy(desc(quotationTemplates.updatedAt));
}

export async function getQuotationTemplateById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(quotationTemplates).where(eq(quotationTemplates.id, id));
  return row ?? null;
}

export async function createQuotationTemplate(data: InsertQuotationTemplate) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(quotationTemplates).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateQuotationTemplate(id: number, data: Partial<InsertQuotationTemplate>) {
  const db = await getDb();
  if (!db) return;
  await db.update(quotationTemplates).set(data).where(eq(quotationTemplates.id, id));
}

export async function deleteQuotationTemplate(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quotationTemplates).where(eq(quotationTemplates.id, id));
}
