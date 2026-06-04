import { eq, sql, gte, lte, and, desc, SQL } from "drizzle-orm";
import { quotations, quotationItems, users } from "../../../drizzle/schema";
import { requireDb } from "../../db/index";
import type {
  RecentQuotation,
  QuotationAnalytics,
  IndustryRow,
  CustomerRow,
  SalesRepRow,
  TimeRow,
  StatusRow,
  TopProductRow,
} from "./quotation.types";

export async function getMyDashboardStats(userId: number, startDate?: Date, endDate?: Date): Promise<{ totalQuotations: number; completedRevenue: number; statusCounts: Record<string, number> }> {
  const db = await requireDb();

  const conditions = [eq(quotations.createdBy, userId)];
  if (startDate) conditions.push(gte(quotations.createdAt, startDate));
  if (endDate) conditions.push(lte(quotations.createdAt, endDate));

  // Get totals + revenue in one query
  const result = await db.select({
    totalQuotations: sql<number>`count(*)`,
    completedRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${quotations.status} = 'completed' THEN CAST(${quotations.totalAmount} AS DECIMAL(14,2)) ELSE 0 END), 0)`,
  }).from(quotations).where(and(...conditions));

  // Get per-status counts
  const statusResult = await db.select({
    status: quotations.status,
    count: sql<number>`count(*)`,
  }).from(quotations).where(and(...conditions)).groupBy(quotations.status);

  const row = Array.isArray(result[0]) ? result[0][0] : result[0];
  const statusCounts: Record<string, number> = {};
  const statusRows = Array.isArray(statusResult[0]) ? statusResult[0] : statusResult;
  for (const sr of statusRows) {
    const r = sr as { status: string | null; count: number | string };
    if (r.status) statusCounts[r.status] = Number(r.count);
  }

  return {
    totalQuotations: Number(row?.totalQuotations ?? 0),
    completedRevenue: Number(row?.completedRevenue ?? 0),
    statusCounts,
  };
}

export async function getMyRecentQuotations(userId: number, limit = 5): Promise<RecentQuotation[]> {
  const db = await requireDb();
  return db.select({
    id: quotations.id,
    quotationNo: quotations.quotationNo,
    customerName: quotations.customerName,
    customerContact: quotations.customerContact,
    projectName: quotations.projectName,
    status: quotations.status,
    totalAmount: quotations.totalAmount,
    createdAt: quotations.createdAt,
    updatedAt: quotations.updatedAt,
  }).from(quotations)
    .where(eq(quotations.createdBy, userId))
    .orderBy(desc(quotations.updatedAt))
    .limit(limit);
}

export async function getQuotationAnalytics(params: { startDate?: Date; endDate?: Date; userId?: number }): Promise<QuotationAnalytics> {
  const db = await requireDb();

  const conditions: SQL[] = [];
  if (params.startDate) conditions.push(gte(quotations.createdAt, params.startDate));
  if (params.endDate) conditions.push(lte(quotations.createdAt, params.endDate));
  if (params.userId) conditions.push(eq(quotations.createdBy, params.userId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const productConditions: SQL[] = [];
  if (params.startDate) productConditions.push(gte(quotations.createdAt, params.startDate));
  if (params.endDate) productConditions.push(lte(quotations.createdAt, params.endDate));
  if (params.userId) productConditions.push(eq(quotations.createdBy, params.userId));
  const productWhere = productConditions.length > 0 ? and(...productConditions) : undefined;

  const [
    summaryRows, byIndustry, byCustomer, bySalesRepRows,
    byTime, byStatus, topProducts,
  ] = await Promise.all([
    // 1. Summary KPI
    db.select({
      totalQuotations: sql<number>`count(*)`,
      completedRevenue: sql<number>`coalesce(sum(case when ${quotations.status} = 'completed' then cast(${quotations.totalAmount} as decimal(14,2)) else 0 end), 0)`,
      avgAmount: sql<number>`coalesce(avg(cast(${quotations.totalAmount} as decimal(14,2))), 0)`,
      conversionRate: sql<number>`coalesce(sum(case when ${quotations.status} = 'completed' then 1 else 0 end) / nullif(sum(case when ${quotations.status} in ('submitted','approved','sent','completed') then 1 else 0 end), 0), 0)`,
    }).from(quotations).where(where),

    // 2. By Industry
    db.execute(sql`
      SELECT
        COALESCE(industry, '未指定') as industry,
        COUNT(*) as \`count\`,
        COALESCE(SUM(CAST(totalAmount AS DECIMAL(14,2))), 0) as totalAmount
      FROM quotations
      ${where ? sql`WHERE ${where}` : sql``}
      GROUP BY COALESCE(industry, '未指定')
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `),

    // 3. Top Customers
    db.execute(sql`
      SELECT
        customerName,
        GROUP_CONCAT(DISTINCT COALESCE(industry, '')) as industry,
        COUNT(*) as \`count\`,
        COALESCE(SUM(CAST(totalAmount AS DECIMAL(14,2))), 0) as totalAmount
      FROM quotations
      ${where ? sql`WHERE ${where}` : sql``}
      GROUP BY customerName
      ORDER BY totalAmount DESC
      LIMIT 10
    `),

    // 4. By Sales Rep — use raw SQL for JOIN
    db.execute(sql`
      SELECT
        COALESCE(u.name, u.username, 'Unknown') as repName,
        COUNT(*) as \`count\`,
        COALESCE(SUM(CAST(q.totalAmount AS DECIMAL(14,2))), 0) as totalAmount,
        SUM(CASE WHEN q.status = 'completed' THEN 1 ELSE 0 END) as completedCount,
        SUM(CASE WHEN q.status IN ('submitted','approved','sent','completed') THEN 1 ELSE 0 END) as submittedCount
      FROM quotations q
      LEFT JOIN users u ON q.createdBy = u.id
      ${where ? sql`WHERE ${and(
        params.startDate ? gte(sql`q.createdAt`, params.startDate) : sql`TRUE`,
        params.endDate ? lte(sql`q.createdAt`, params.endDate) : sql`TRUE`,
        params.userId ? eq(sql`q.createdBy`, params.userId) : sql`TRUE`,
      )}` : sql``}
      GROUP BY q.createdBy, u.name, u.username
      ORDER BY totalAmount DESC
      LIMIT 10
    `),

    // 5. Monthly Trend
    db.execute(sql`
      SELECT
        DATE_FORMAT(createdAt, '%Y-%m') as month,
        COUNT(*) as \`count\`,
        COALESCE(SUM(CAST(totalAmount AS DECIMAL(14,2))), 0) as totalAmount
      FROM quotations
      ${where ? sql`WHERE ${where}` : sql``}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY DATE_FORMAT(createdAt, '%Y-%m') DESC
      LIMIT 10
    `),

    // 6. By Status
    db.execute(sql`
      SELECT
        status,
        COUNT(*) as \`count\`,
        COALESCE(SUM(CAST(totalAmount AS DECIMAL(14,2))), 0) as totalAmount
      FROM quotations
      ${where ? sql`WHERE ${where}` : sql``}
      GROUP BY status
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `),

    // 7. Top Products — JOIN needs raw SQL
    db.execute(sql`
      SELECT
        qi.productModel,
        qi.productDesc,
        COUNT(DISTINCT qi.quotationId) as quotationCount,
        COALESCE(SUM(qi.quantity), 0) as totalQuantity,
        COALESCE(SUM(CAST(qi.subtotal AS DECIMAL(14,2))), 0) as totalRevenue
      FROM quotation_items qi
      INNER JOIN quotations q ON qi.quotationId = q.id
      ${productWhere ? sql`WHERE ${and(
        params.startDate ? gte(sql`q.createdAt`, params.startDate) : sql`TRUE`,
        params.endDate ? lte(sql`q.createdAt`, params.endDate) : sql`TRUE`,
        params.userId ? eq(sql`q.createdBy`, params.userId) : sql`TRUE`,
      )}` : sql``}
      GROUP BY qi.productModel, qi.productDesc
      ORDER BY quotationCount DESC
      LIMIT 10
    `),
  ]);

  const summary = summaryRows[0] ?? { totalQuotations: 0, completedRevenue: 0, avgAmount: 0, conversionRate: 0 };
  // db.execute() returns [rows, fields] tuple, extract rows
  const industryRows = Array.isArray(byIndustry) && Array.isArray(byIndustry[0]) ? byIndustry[0] : (Array.isArray(byIndustry) ? byIndustry : []);
  const customerRows = Array.isArray(byCustomer) && Array.isArray(byCustomer[0]) ? byCustomer[0] : (Array.isArray(byCustomer) ? byCustomer : []);
  const salesRepRows = Array.isArray(bySalesRepRows) && Array.isArray(bySalesRepRows[0]) ? bySalesRepRows[0] : (Array.isArray(bySalesRepRows) ? bySalesRepRows : []);
  const timeRows = Array.isArray(byTime) && Array.isArray(byTime[0]) ? byTime[0] : (Array.isArray(byTime) ? byTime : []);
  const statusRows = Array.isArray(byStatus) && Array.isArray(byStatus[0]) ? byStatus[0] : (Array.isArray(byStatus) ? byStatus : []);
  const productRows = Array.isArray(topProducts) && Array.isArray(topProducts[0]) ? topProducts[0] : (Array.isArray(topProducts) ? topProducts : []);

  return {
    summary: {
      totalQuotations: Number(summary.totalQuotations ?? 0),
      completedRevenue: Number(summary.completedRevenue ?? 0),
      avgAmount: Number(summary.avgAmount ?? 0),
      conversionRate: Number(summary.conversionRate ?? 0),
    },
    byIndustry: industryRows as IndustryRow[],
    byCustomer: customerRows as CustomerRow[],
    bySalesRep: salesRepRows as SalesRepRow[],
    byTime: timeRows as TimeRow[],
    byStatus: statusRows as StatusRow[],
    topProducts: productRows as TopProductRow[],
  };
}
