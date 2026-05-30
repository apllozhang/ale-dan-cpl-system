import { eq, like, or, and, sql, desc, SQL, gte, lte } from "drizzle-orm";
import {
  activityLogs, InsertActivityLog,
} from "../../drizzle/schema";
import { getDb } from "./index";

export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}

export async function getActivityLogs(params: {
  search?: string;
  action?: string;
  resourceType?: string;
  userId?: number;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) {
  const db = await getDb();
  if (!db) return { items: [] as any[], total: 0 };
  const { search, action, resourceType, userId, startDate, endDate, page, pageSize } = params;

  const conditions: SQL[] = [];
  if (search) {
    const term = `%${search}%`;
    conditions.push(or(
      like(activityLogs.username || sql`''`, term),
      like(activityLogs.action, term),
      like(activityLogs.detail || sql`''`, term),
    )!);
  }
  if (action) {
    conditions.push(eq(activityLogs.action, action));
  }
  if (resourceType) {
    conditions.push(eq(activityLogs.resourceType, resourceType));
  }
  if (userId) {
    conditions.push(eq(activityLogs.userId, userId));
  }
  if (startDate) {
    conditions.push(gte(activityLogs.createdAt, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(activityLogs.createdAt, new Date(endDate + "T23:59:59")));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const total = await db.$count(activityLogs, where);
  const items = await db.select().from(activityLogs)
    .where(where)
    .orderBy(desc(activityLogs.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total };
}

export async function getActivityStats() {
  const db = await getDb();
  if (!db) return { today: 0, week: 0, byAction: {} };
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const weekLogs = await db.select({
    action: activityLogs.action,
    count: sql<number>`count(*)`,
  }).from(activityLogs)
    .where(sql`${activityLogs.createdAt} >= ${sevenDaysAgo}`)
    .groupBy(activityLogs.action);

  const [todayResult] = await db.select({
    count: sql<number>`count(*)`,
  }).from(activityLogs)
    .where(sql`${activityLogs.createdAt} >= ${todayStart}`);

  const byAction: Record<string, number> = {};
  for (const row of weekLogs) {
    byAction[row.action] = row.count;
  }

  return { today: todayResult?.count ?? 0, week: weekLogs.reduce((s, r) => s + r.count, 0), byAction };
}

export async function clearActivityLogs() {
  const db = await getDb();
  if (!db) return;
  await db.delete(activityLogs);
}
