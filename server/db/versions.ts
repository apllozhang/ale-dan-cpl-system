import { eq, desc } from "drizzle-orm";
import {
  quotationVersions, InsertQuotationVersion,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function createQuotationVersion(data: InsertQuotationVersion) {
  const db = await getDb();
  if (!db) return;
  await db.insert(quotationVersions).values(data);
}

export async function getQuotationVersions(quotationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quotationVersions)
    .where(eq(quotationVersions.quotationId, quotationId))
    .orderBy(desc(quotationVersions.version));
}
