import { eq, like, or, and, sql, asc, desc, SQL, inArray, gte, lte } from "drizzle-orm";
import {
  quotations, quotationItems, InsertQuotation, InsertQuotationItem,
  quotationVersions,
  users,
  Quotation, QuotationItem,
} from "../../drizzle/schema";
import { requireDb } from "./index";

type QuotationStatus = typeof quotations.$inferSelect.status;

type QuotationListItem = Pick<Quotation, "id" | "quotationNo" | "customerName" | "customerContact" | "customerPhone" | "customerEmail" | "industry" | "projectName" | "status" | "discountRate" | "totalAmount" | "notes" | "createdBy" | "validUntil" | "createdAt" | "updatedAt"> & {
  creatorName: string | null;
  creatorUsername: string | null;
};

type QuotationDetail = QuotationListItem & {
  version: number;
  shareToken: string | null;
  items: QuotationItem[];
};

type RecentQuotation = Pick<Quotation, "id" | "quotationNo" | "customerName" | "customerContact" | "projectName" | "status" | "totalAmount" | "createdAt" | "updatedAt">;

interface AnalyticsSummary {
  totalQuotations: number;
  completedRevenue: number;
  avgAmount: number;
  conversionRate: number;
}

interface IndustryRow {
  industry: string;
  count: number | string;
  totalAmount: number | string;
}

interface CustomerRow {
  customerName: string;
  industry: string;
  count: number | string;
  totalAmount: number | string;
}

interface SalesRepRow {
  repName: string;
  count: number | string;
  totalAmount: number | string;
  completedCount: number | string;
  submittedCount: number | string;
}

interface TimeRow {
  month: string;
  count: number | string;
  totalAmount: number | string;
}

interface StatusRow {
  status: string;
  count: number | string;
  totalAmount: number | string;
}

interface TopProductRow {
  productModel: string;
  productDesc: string | null;
  quotationCount: number | string;
  totalQuantity: number | string;
  totalRevenue: number | string;
}

interface QuotationAnalytics {
  summary: AnalyticsSummary;
  byIndustry: IndustryRow[];
  byCustomer: CustomerRow[];
  bySalesRep: SalesRepRow[];
  byTime: TimeRow[];
  byStatus: StatusRow[];
  topProducts: TopProductRow[];
}

export async function getQuotations(params: {
  search?: string;
  status?: QuotationStatus | "all";
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  createdBy?: number;
}): Promise<{ items: QuotationListItem[]; total: number }> {
  const db = await requireDb();

  const { search, status, page = 1, pageSize = 20, sortBy, sortOrder = "desc", createdBy } = params;
  const conditions: SQL[] = [];

  if (createdBy) {
    conditions.push(eq(quotations.createdBy, createdBy));
  }

  if (status && status !== "all") {
    conditions.push(eq(quotations.status, status));
  }

  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      or(
        like(quotations.quotationNo, searchTerm),
        like(quotations.customerName, searchTerm),
        like(quotations.projectName, searchTerm),
      )!
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortColumnMap: Record<string, any> = {
    quotationNo: quotations.quotationNo,
    customerName: quotations.customerName,
    status: quotations.status,
    totalAmount: quotations.totalAmount,
    createdAt: quotations.createdAt,
  };
  const sortColumn = sortBy && sortColumnMap[sortBy] ? sortColumnMap[sortBy] : quotations.createdAt;
  const orderFn = sortOrder === "asc" ? asc : desc;

  const offset = (page - 1) * pageSize;

  const [items, countResult] = await Promise.all([
    db.select({
      id: quotations.id,
      quotationNo: quotations.quotationNo,
      customerName: quotations.customerName,
      customerContact: quotations.customerContact,
      customerPhone: quotations.customerPhone,
      customerEmail: quotations.customerEmail,
      industry: quotations.industry,
      projectName: quotations.projectName,
      status: quotations.status,
      discountRate: quotations.discountRate,
      totalAmount: quotations.totalAmount,
      notes: quotations.notes,
      createdBy: quotations.createdBy,
      validUntil: quotations.validUntil,
      createdAt: quotations.createdAt,
      updatedAt: quotations.updatedAt,
      creatorName: users.name,
      creatorUsername: users.username,
    })
      .from(quotations)
      .leftJoin(users, eq(quotations.createdBy, users.id))
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(quotations).where(whereClause),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
}

export async function getQuotationById(id: number): Promise<QuotationDetail | null> {
  const db = await requireDb();

  const [quotation] = await db.select({
    id: quotations.id,
    quotationNo: quotations.quotationNo,
    customerName: quotations.customerName,
    customerContact: quotations.customerContact,
    customerPhone: quotations.customerPhone,
    customerEmail: quotations.customerEmail,
    industry: quotations.industry,
    projectName: quotations.projectName,
    status: quotations.status,
    discountRate: quotations.discountRate,
    totalAmount: quotations.totalAmount,
    notes: quotations.notes,
    createdBy: quotations.createdBy,
    validUntil: quotations.validUntil,
    createdAt: quotations.createdAt,
    updatedAt: quotations.updatedAt,
    creatorName: users.name,
    creatorUsername: users.username,
    version: quotations.version,
    shareToken: quotations.shareToken,
  })
    .from(quotations)
    .leftJoin(users, eq(quotations.createdBy, users.id))
    .where(eq(quotations.id, id))
    .limit(1);

  if (!quotation) return null;

  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));

  return { ...quotation, items };
}

export async function getQuotationsByIds(ids: number[]): Promise<Pick<Quotation, "id" | "createdBy" | "status">[]> {
  if (ids.length === 0) return [];
  const db = await requireDb();
  return db.select({
    id: quotations.id,
    createdBy: quotations.createdBy,
    status: quotations.status,
  }).from(quotations).where(inArray(quotations.id, ids));
}

export async function createQuotation(data: InsertQuotation, items: InsertQuotationItem[]): Promise<{ id: number; quotationNo: string }> {
  const db = await requireDb();

  // Generate quotationNo atomically: QT-YYYYMMDD-NNN
  // Uses a transaction with SELECT FOR UPDATE to prevent concurrent duplicates
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `QT-${dateStr}-`;

  return await db.transaction(async (tx) => {
    // Lock the matching rows to prevent concurrent sequence generation
    const seqResult = await tx.execute(sql`
      SELECT CAST(SUBSTRING_INDEX(quotationNo, '-', -1) AS UNSIGNED) AS seq
      FROM quotations
      WHERE quotationNo LIKE ${prefix + "%"}
      ORDER BY seq DESC
      LIMIT 1
      FOR UPDATE
    `);
    const rows = Array.isArray(seqResult[0]) ? seqResult[0] as Array<{ seq: number }> : [];
    const nextSeq = (rows[0]?.seq ?? 0) + 1;
    const quotationNo = `${prefix}${String(nextSeq).padStart(3, "0")}`;

    const result = await tx.insert(quotations).values({
      ...data,
      quotationNo,
    });
    const quotationId = Number(result[0].insertId);

    if (items.length > 0) {
      const itemsWithQId = items.map(item => ({ ...item, quotationId }));
      const batchSize = 100;
      for (let i = 0; i < itemsWithQId.length; i += batchSize) {
        const batch = itemsWithQId.slice(i, i + batchSize);
        await tx.insert(quotationItems).values(batch);
      }
    }

    return { id: quotationId, quotationNo };
  });
}

export async function updateQuotation(id: number, data: Partial<InsertQuotation>, items?: InsertQuotationItem[], userId?: number): Promise<void> {
  const db = await requireDb();

  await db.transaction(async (tx) => {
    // Snapshot current state BEFORE update (for version tracking)
    let shouldCreateVersion = false;
    const oldItems = await tx.select().from(quotationItems).where(eq(quotationItems.quotationId, id));
    const [oldQuotation] = await tx.select({
      version: quotations.version,
      totalAmount: quotations.totalAmount,
      customerName: quotations.customerName,
      projectName: quotations.projectName,
      status: quotations.status,
      notes: quotations.notes,
    }).from(quotations).where(eq(quotations.id, id)).limit(1);

    if (!oldQuotation) throw new Error(`Quotation ${id} not found`);

    const updateSet: Record<string, unknown> = {};
    if (data.customerName !== undefined) updateSet.customerName = data.customerName;
    if (data.customerContact !== undefined) updateSet.customerContact = data.customerContact;
    if (data.customerPhone !== undefined) updateSet.customerPhone = data.customerPhone;
    if (data.customerEmail !== undefined) updateSet.customerEmail = data.customerEmail;
    if (data.industry !== undefined) updateSet.industry = data.industry;
    if (data.projectName !== undefined) updateSet.projectName = data.projectName;
    if (data.discountRate !== undefined) updateSet.discountRate = data.discountRate;
    if (data.totalAmount !== undefined) updateSet.totalAmount = data.totalAmount;
    if (data.notes !== undefined) updateSet.notes = data.notes;
    if (data.validUntil !== undefined) updateSet.validUntil = data.validUntil;
    if (data.status !== undefined) updateSet.status = data.status;

    if (Object.keys(updateSet).length > 0) {
      shouldCreateVersion = true;
      await tx.update(quotations).set(updateSet).where(eq(quotations.id, id));
    }

    if (items !== undefined) {
      shouldCreateVersion = true;
      await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));
      if (items.length > 0) {
        const itemsWithQId = items.map(item => ({ ...item, quotationId: id }));
        const batchSize = 100;
        for (let i = 0; i < itemsWithQId.length; i += batchSize) {
          const batch = itemsWithQId.slice(i, i + batchSize);
          await tx.insert(quotationItems).values(batch);
        }
      }
    }

    // Auto-create version snapshot with change summary
    if (shouldCreateVersion) {
      const newVersion = (oldQuotation.version ?? 1) + 1;

      // Compute diff summary
      const oldItemMap = new Map(oldItems.map(it => [it.productModel, it]));
      const newItems = items ?? oldItems;
      const added: string[] = [];
      const removed: string[] = [];
      const modified: string[] = [];

      if (items !== undefined) {
        for (const ni of newItems) {
          const oi = oldItemMap.get(ni.productModel);
          if (!oi) {
            added.push(ni.productModel);
          } else {
            if (Number(oi.quantity) !== ni.quantity || Number(oi.discountRate ?? 0) !== Number(ni.discountRate ?? 0)) {
              modified.push(ni.productModel);
            }
          }
        }
        const newItemSet = new Set(newItems.map(it => it.productModel));
        for (const oi of oldItems) {
          if (!newItemSet.has(oi.productModel)) removed.push(oi.productModel);
        }
      }

      const changes: string[] = [];
      if (added.length > 0) changes.push(`+${added.length}项: ${added.slice(0, 3).join(", ")}${added.length > 3 ? "..." : ""}`);
      if (removed.length > 0) changes.push(`-${removed.length}项: ${removed.slice(0, 3).join(", ")}${removed.length > 3 ? "..." : ""}`);
      if (modified.length > 0) changes.push(`改${modified.length}项: ${modified.slice(0, 3).join(", ")}${modified.length > 3 ? "..." : ""}`);
      if (data.customerName && data.customerName !== oldQuotation.customerName) changes.push("客户名称变更");
      if (data.projectName && data.projectName !== oldQuotation.projectName) changes.push("项目名称变更");
      if (data.status && data.status !== oldQuotation.status) changes.push(`状态→${data.status}`);

      const snapshot = JSON.stringify({
        items: (items ?? oldItems).map(it => ({
          productModel: it.productModel,
          productDesc: it.productDesc,
          listPrice: it.listPrice,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountRate: it.discountRate,
          subtotal: it.subtotal,
        })),
        totalAmount: data.totalAmount ?? oldQuotation.totalAmount,
        changeSummary: changes.length > 0 ? changes.join("; ") : "信息更新",
        diff: { added, removed, modified },
      });

      await tx.update(quotations).set({ version: newVersion }).where(eq(quotations.id, id));
      await tx.insert(quotationVersions).values({
        quotationId: id,
        version: newVersion,
        snapshot,
        createdBy: userId ?? 0,
      });
    }
  });
}

export async function deleteQuotation(id: number): Promise<void> {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));
    await tx.delete(quotationVersions).where(eq(quotationVersions.quotationId, id));
    await tx.delete(quotations).where(eq(quotations.id, id));
  });
}

export async function updateQuotationStatus(id: number, status: QuotationStatus): Promise<void> {
  const db = await requireDb();
  await db.update(quotations).set({ status }).where(eq(quotations.id, id));
}

export async function batchUpdateQuotationStatus(ids: number[], status: QuotationStatus): Promise<void> {
  if (ids.length === 0) return;
  const db = await requireDb();
  await db.update(quotations).set({ status })
    .where(inArray(quotations.id, ids));
}

export async function batchDeleteQuotations(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx.delete(quotationItems).where(inArray(quotationItems.quotationId, ids));
    await tx.delete(quotationVersions).where(inArray(quotationVersions.quotationId, ids));
    await tx.delete(quotations).where(inArray(quotations.id, ids));
  });
}

// ==================== Dashboard helpers ====================
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
