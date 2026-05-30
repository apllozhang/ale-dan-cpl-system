import { eq, like, and, sql } from "drizzle-orm";
import { quotations } from "../../drizzle/schema";
import { getDb } from "./index";

export async function getCustomerList(params: { search?: string; page?: number; pageSize?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const conditions = [
    sql`${quotations.customerName} IS NOT NULL`,
    sql`${quotations.customerName} != ''`,
  ];
  if (params.search) {
    conditions.push(like(quotations.customerName, `%${params.search}%`));
  }

  const whereClause = and(...conditions);

  const countResult = await db.select({
    total: sql<number>`COUNT(DISTINCT ${quotations.customerName})`,
  }).from(quotations).where(whereClause);
  const total = Number((Array.isArray(countResult[0]) ? countResult[0][0] : countResult[0])?.total ?? 0);

  const items = await db.select({
    customerName: quotations.customerName,
    quotationCount: sql<number>`COUNT(*)`,
    totalRevenue: sql<number>`COALESCE(SUM(CAST(${quotations.totalAmount} AS DECIMAL(14,2))), 0)`,
    completedRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${quotations.status} = 'completed' THEN CAST(${quotations.totalAmount} AS DECIMAL(14,2)) ELSE 0 END), 0)`,
    industries: sql<string>`GROUP_CONCAT(DISTINCT ${quotations.industry})`,
    lastQuotationAt: sql<Date>`MAX(${quotations.createdAt})`,
  }).from(quotations)
    .where(whereClause)
    .groupBy(quotations.customerName)
    .orderBy(sql`COALESCE(SUM(CAST(${quotations.totalAmount} AS DECIMAL(14,2))), 0) DESC`)
    .limit(pageSize)
    .offset(offset);

  return {
    items: items.map(item => ({
      ...item,
      quotationCount: Number(item.quotationCount),
      totalRevenue: Number(item.totalRevenue),
      completedRevenue: Number(item.completedRevenue),
    })),
    total,
  };
}
