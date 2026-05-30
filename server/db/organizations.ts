import { eq } from "drizzle-orm";
import { organizations } from "../../drizzle/schema";
import { getDb } from "./index";

export async function getAllOrganizations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizations);
}

export async function createOrganization(data: { name: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(organizations).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateOrganization(id: number, data: { name: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(organizations).set(data).where(eq(organizations.id, id));
}

export async function deleteOrganization(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(organizations).where(eq(organizations.id, id));
}
