import { eq, sql } from "drizzle-orm";
import { userGroups, organizations } from "../../drizzle/schema";
import { getDb } from "./index";

export async function getAllUserGroups() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: userGroups.id,
    name: userGroups.name,
    organizationId: userGroups.organizationId,
    createdAt: userGroups.createdAt,
    updatedAt: userGroups.updatedAt,
    organizationName: organizations.name,
  })
    .from(userGroups)
    .leftJoin(organizations, eq(userGroups.organizationId, organizations.id));
}

export async function createUserGroup(data: { name: string; organizationId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(userGroups).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateUserGroup(id: number, data: { name?: string; organizationId?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.update(userGroups).set(data).where(eq(userGroups.id, id));
}

export async function deleteUserGroup(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userGroups).where(eq(userGroups.id, id));
}
