import { eq, like, or, sql } from "drizzle-orm";
import { InsertUser, users } from "../../drizzle/schema";
import { getDb } from "./index";

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
  if (existing.length > 0) {
    await db.update(users).set({
      ...user,
      updatedAt: new Date(),
    }).where(eq(users.openId, user.openId));
  } else {
    await db.insert(users).values(user);
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? null;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0] ?? null;
}

export async function createUser(data: {
  username: string;
  passwordHash: string;
  name?: string;
  email?: string;
  role?: string;
  isSuperAdmin?: boolean;
  organizationId?: number;
  groupId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const openId = `local_${data.username}_${Date.now()}`;
  const result = await db.insert(users).values({
    openId,
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name || data.username,
    email: data.email,
    loginMethod: "local",
    role: (data.role as any) || "user",
    isSuperAdmin: data.isSuperAdmin || false,
    organizationId: data.organizationId,
    groupId: data.groupId,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateUser(id: number, data: {
  username?: string;
  passwordHash?: string;
  name?: string;
  email?: string;
  role?: string;
  isSuperAdmin?: boolean;
  organizationId?: number | null;
  groupId?: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = {};
  if (data.username !== undefined) updateData.username = data.username;
  if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isSuperAdmin !== undefined) updateData.isSuperAdmin = data.isSuperAdmin;
  if (data.organizationId !== undefined) updateData.organizationId = data.organizationId;
  if (data.groupId !== undefined) updateData.groupId = data.groupId;
  if (Object.keys(updateData).length > 0) {
    await db.update(users).set(updateData).where(eq(users.id, id));
  }
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, id));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    openId: users.openId,
    username: users.username,
    name: users.name,
    email: users.email,
    loginMethod: users.loginMethod,
    role: users.role,
    isSuperAdmin: users.isSuperAdmin,
    organizationId: users.organizationId,
    groupId: users.groupId,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(sql`${users.createdAt} DESC`);
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({
    id: users.id,
    openId: users.openId,
    username: users.username,
    name: users.name,
    email: users.email,
    loginMethod: users.loginMethod,
    role: users.role,
    isSuperAdmin: users.isSuperAdmin,
    organizationId: users.organizationId,
    groupId: users.groupId,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}
