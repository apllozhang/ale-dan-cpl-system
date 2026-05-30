import { eq, and, desc } from "drizzle-orm";
import {
  savedSearches, InsertSavedSearch,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function getSavedSearches(userId: number, page: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(savedSearches)
    .where(and(eq(savedSearches.userId, userId), eq(savedSearches.page, page)))
    .orderBy(desc(savedSearches.createdAt));
}

export async function createSavedSearch(data: InsertSavedSearch) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(savedSearches).values(data);
  return { id: Number(result[0].insertId) };
}

export async function deleteSavedSearch(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(savedSearches).where(eq(savedSearches.id, id));
}
