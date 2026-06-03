import { eq, desc } from "drizzle-orm";
import {
  quotationVersions, InsertQuotationVersion, QuotationVersion,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function createQuotationVersion(data: InsertQuotationVersion): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(quotationVersions).values(data);
}

export async function getQuotationVersions(quotationId: number): Promise<QuotationVersion[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quotationVersions)
    .where(eq(quotationVersions.quotationId, quotationId))
    .orderBy(desc(quotationVersions.version))
    .limit(50);
}
