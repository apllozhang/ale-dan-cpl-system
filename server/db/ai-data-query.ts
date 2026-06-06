import { type Tool } from "../_core/llm";
import { getDb } from "./index";
import { eq, and, or, like, desc, sql, gte, lte, SQL } from "drizzle-orm";
import {
  quotations, quotationItems, organizations, cplProducts,
  certifications,
  eflashRecords, activityLogs,
  productSpecSets, productSpecs,
} from "../../drizzle/schema";

// ── Tool Schema Definitions ──

export const DATA_QUERY_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "queryQuotations",
      description: "查询报价单列表，支持按状态、日期范围、客户、关键词筛选。返回报价摘要和总数。",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "submitted", "approved", "rejected", "cancelled"], description: "报价状态" },
          dateFrom: { type: "string", description: "起始日期 YYYY-MM-DD" },
          dateTo: { type: "string", description: "截止日期 YYYY-MM-DD" },
          customerId: { type: "number", description: "客户/组织 ID" },
          keyword: { type: "string", description: "关键词搜索（报价名称/编号）" },
          limit: { type: "number", description: "返回条数，默认20，最大50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getQuotationDetail",
      description: "获取单个报价的完整信息，包含报价项和版本历史。",
      parameters: {
        type: "object",
        properties: {
          quotationId: { type: "number", description: "报价 ID" },
        },
        required: ["quotationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queryProducts",
      description: "查询产品列表，支持按型号、关键词、价格范围筛选。",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "搜索关键词（型号/描述）" },
          productModel: { type: "string", description: "精确产品型号" },
          minPrice: { type: "number", description: "最低价格" },
          maxPrice: { type: "number", description: "最高价格" },
          limit: { type: "number", description: "返回条数，默认20，最大50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queryProductSpecs",
      description: "查询产品的详细规格参数（如端口数、功耗、尺寸等）。",
      parameters: {
        type: "object",
        properties: {
          productModel: { type: "string", description: "产品型号" },
          specSetName: { type: "string", description: "规格参数集名称" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queryCertifications",
      description: "查询认证证书信息，支持按类型、状态、持有者、到期时间筛选。",
      parameters: {
        type: "object",
        properties: {
          certType: { type: "string", description: "证书类型（如 3C、CE、FCC）" },
          status: { type: "string", enum: ["active", "expired", "pending"], description: "证书状态" },
          keyword: { type: "string", description: "关键词搜索（证号/名称）" },
          holder: { type: "string", description: "持有者" },
          expiringWithinDays: { type: "number", description: "即将在N天内到期的证书" },
          limit: { type: "number", description: "返回条数，默认20，最大50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queryEflash",
      description: "查询 eFlash 产品公告（phase_in/phase_out/service/pricing/program）。",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["phase_in", "phase_out", "service", "pricing", "program"], description: "公告类型" },
          division: { type: "string", enum: ["communications", "network", "general"], description: "部门" },
          scope: { type: "string", enum: ["global", "china"], description: "范围" },
          dateFrom: { type: "string", description: "起始日期 YYYY-MM-DD" },
          dateTo: { type: "string", description: "截止日期 YYYY-MM-DD" },
          keyword: { type: "string", description: "关键词搜索" },
          limit: { type: "number", description: "返回条数，默认20，最大50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queryCustomers",
      description: "查询客户/组织信息。",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "关键词搜索（名称）" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "queryActivityLogs",
      description: "查询用户操作日志，支持按用户、操作类型、日期筛选。",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "number", description: "用户 ID" },
          actionType: { type: "string", description: "操作类型" },
          dateFrom: { type: "string", description: "起始日期 YYYY-MM-DD" },
          dateTo: { type: "string", description: "截止日期 YYYY-MM-DD" },
          limit: { type: "number", description: "返回条数，默认20，最大50" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getDashboardSummary",
      description: "获取系统数据概览：报价统计、产品数量、证书状态、近期eFlash等。",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ── Query Implementations ──

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function clampLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

function escapeLike(input: string): string {
  return input.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function queryQuotationsImpl(args: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  customerId?: number;
  keyword?: string;
  limit?: number;
}): Promise<{ items: unknown[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const limit = clampLimit(args.limit);
  const conditions: SQL[] = [];

  if (args.status) conditions.push(eq(quotations.status, args.status as "draft" | "submitted" | "approved" | "sent" | "completed" | "cancelled"));
  if (args.keyword) {
    const term = `%${escapeLike(args.keyword)}%`;
    conditions.push(or(like(quotations.customerName, term), like(quotations.quotationNo, term))!);
  }
  if (args.dateFrom) conditions.push(gte(quotations.createdAt, new Date(args.dateFrom)));
  if (args.dateTo) conditions.push(lte(quotations.createdAt, new Date(args.dateTo + "T23:59:59")));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: sql<number>`COUNT(*)` })
    .from(quotations).where(where);
  const total = Number((Array.isArray(countResult[0]) ? countResult[0][0] : countResult[0])?.total ?? 0);

  const items = await db.select({
    id: quotations.id,
    quotationNumber: quotations.quotationNo,
    title: quotations.customerName,
    status: quotations.status,
    totalAmount: quotations.totalAmount,
    customerName: quotations.customerName,
    createdBy: quotations.createdBy,
    createdAt: quotations.createdAt,
  }).from(quotations).where(where)
    .orderBy(desc(quotations.createdAt))
    .limit(limit);

  return { items, total };
}

async function getQuotationDetailImpl(args: { quotationId: number }): Promise<unknown> {
  const db = await getDb();
  if (!db) return null;

  const [quotation] = await db.select().from(quotations)
    .where(eq(quotations.id, args.quotationId)).limit(1);
  if (!quotation) return null;

  const items = await db.select().from(quotationItems)
    .where(eq(quotationItems.quotationId, args.quotationId));

  const { ...safeQuotation } = quotation;
  return { ...safeQuotation, items };
}

async function queryProductsImpl(args: {
  keyword?: string;
  productModel?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}): Promise<{ items: unknown[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const limit = clampLimit(args.limit);
  const conditions: SQL[] = [];

  if (args.productModel) conditions.push(eq(cplProducts.productModel, args.productModel));
  if (args.keyword) {
    const term = `%${escapeLike(args.keyword)}%`;
    conditions.push(or(
      like(cplProducts.productModel, term),
      like(cplProducts.productDesc, term),
    )!);
  }
  if (args.minPrice) conditions.push(gte(cplProducts.listPrice, String(args.minPrice)));
  if (args.maxPrice) conditions.push(lte(cplProducts.listPrice, String(args.maxPrice)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: sql<number>`COUNT(*)` })
    .from(cplProducts).where(where);
  const total = Number((Array.isArray(countResult[0]) ? countResult[0][0] : countResult[0])?.total ?? 0);

  const items = await db.select({
    id: cplProducts.id,
    productModel: cplProducts.productModel,
    productDesc: cplProducts.productDesc,
    listPrice: cplProducts.listPrice,
    productGroup: cplProducts.productGroup,
    productStatus: cplProducts.productStatus,
    salesCategory: cplProducts.salesCategory,
  }).from(cplProducts).where(where)
    .orderBy(desc(cplProducts.id))
    .limit(limit);

  return { items, total };
}

async function queryProductSpecsImpl(args: {
  productModel?: string;
  specSetName?: string;
}): Promise<unknown[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [];
  if (args.productModel) conditions.push(eq(productSpecs.productModel, args.productModel));
  if (args.specSetName) {
    const setNameTerm = `%${escapeLike(args.specSetName)}%`;
    conditions.push(like(productSpecSets.name, setNameTerm));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db.select({
    productModel: productSpecs.productModel,
    productDesc: productSpecs.productDesc,
    specs: productSpecs.specs,
    setName: productSpecSets.name,
  }).from(productSpecs)
    .innerJoin(productSpecSets, eq(productSpecs.setId, productSpecSets.id))
    .where(where)
    .limit(20);
}

async function queryCertificationsImpl(args: {
  certType?: string;
  status?: string;
  keyword?: string;
  holder?: string;
  expiringWithinDays?: number;
  limit?: number;
}): Promise<{ items: unknown[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const limit = clampLimit(args.limit);
  const conditions: SQL[] = [];

  if (args.certType) conditions.push(eq(certifications.certType, args.certType));
  if (args.status) conditions.push(eq(certifications.status, args.status));
  if (args.holder) conditions.push(eq(certifications.holder, args.holder));
  if (args.keyword) {
    const term = `%${escapeLike(args.keyword)}%`;
    conditions.push(or(
      like(certifications.certNo, term),
      like(certifications.certName, term),
    )!);
  }
  if (args.expiringWithinDays) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + args.expiringWithinDays);
    conditions.push(and(
      eq(certifications.status, "active"),
      lte(certifications.expiryDate, futureDate.toISOString().slice(0, 10)),
    )!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: sql<number>`COUNT(*)` })
    .from(certifications).where(where);
  const total = Number((Array.isArray(countResult[0]) ? countResult[0][0] : countResult[0])?.total ?? 0);

  const items = await db.select({
    id: certifications.id,
    certType: certifications.certType,
    certNo: certifications.certNo,
    certName: certifications.certName,
    holder: certifications.holder,
    issueDate: certifications.issueDate,
    expiryDate: certifications.expiryDate,
    status: certifications.status,
    productCategory: certifications.productCategory,
  }).from(certifications).where(where)
    .orderBy(desc(certifications.createdAt))
    .limit(limit);

  return { items, total };
}

async function queryEflashImpl(args: {
  type?: string;
  division?: string;
  scope?: string;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  limit?: number;
}): Promise<{ items: unknown[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const limit = clampLimit(args.limit);
  const conditions: SQL[] = [];

  if (args.type) conditions.push(eq(eflashRecords.type, args.type as "phase_in" | "phase_out" | "service" | "pricing" | "program"));
  if (args.division) conditions.push(eq(eflashRecords.division, args.division as "communications" | "network" | "general"));
  if (args.scope) conditions.push(eq(eflashRecords.scope, args.scope as "global" | "china"));
  if (args.dateFrom) conditions.push(gte(eflashRecords.effectiveDate, new Date(args.dateFrom)));
  if (args.dateTo) conditions.push(lte(eflashRecords.effectiveDate, new Date(args.dateTo + "T23:59:59")));
  if (args.keyword) {
    const term = `%${escapeLike(args.keyword)}%`;
    conditions.push(or(
      like(eflashRecords.subjectEn, term),
      like(eflashRecords.subjectCn, term),
      like(eflashRecords.eflashId, term),
    )!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: sql<number>`COUNT(*)` })
    .from(eflashRecords).where(where);
  const total = Number((Array.isArray(countResult[0]) ? countResult[0][0] : countResult[0])?.total ?? 0);

  const items = await db.select({
    id: eflashRecords.id,
    eflashId: eflashRecords.eflashId,
    type: eflashRecords.type,
    division: eflashRecords.division,
    scope: eflashRecords.scope,
    subjectCn: eflashRecords.subjectCn,
    subjectEn: eflashRecords.subjectEn,
    effectiveDate: eflashRecords.effectiveDate,
    chinaDate: eflashRecords.chinaDate,
  }).from(eflashRecords).where(where)
    .orderBy(desc(eflashRecords.effectiveDate))
    .limit(limit);

  return { items, total };
}

async function queryCustomersImpl(args: { keyword?: string }): Promise<unknown[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions: SQL[] = [];
  if (args.keyword) {
    const term = `%${escapeLike(args.keyword)}%`;
    conditions.push(like(organizations.name, term));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db.select({
    id: organizations.id,
    name: organizations.name,
  }).from(organizations).where(where).limit(20);
}

async function queryActivityLogsImpl(args: {
  userId?: number;
  actionType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<{ items: unknown[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const limit = clampLimit(args.limit);
  const conditions: SQL[] = [];

  if (args.userId) conditions.push(eq(activityLogs.userId, args.userId));
  if (args.actionType) conditions.push(eq(activityLogs.action, args.actionType));
  if (args.dateFrom) conditions.push(gte(activityLogs.createdAt, new Date(args.dateFrom)));
  if (args.dateTo) conditions.push(lte(activityLogs.createdAt, new Date(args.dateTo + "T23:59:59")));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const countResult = await db.select({ total: sql<number>`COUNT(*)` })
    .from(activityLogs).where(where);
  const total = Number((Array.isArray(countResult[0]) ? countResult[0][0] : countResult[0])?.total ?? 0);

  const items = await db.select({
    id: activityLogs.id,
    userId: activityLogs.userId,
    action: activityLogs.action,
    resourceType: activityLogs.resourceType,
    resourceId: activityLogs.resourceId,
    detail: activityLogs.detail,
    createdAt: activityLogs.createdAt,
  }).from(activityLogs).where(where)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  return { items, total };
}

async function getDashboardSummaryImpl(): Promise<Record<string, unknown>> {
  const db = await getDb();
  if (!db) return {};

  const [quoteCount] = await db.select({ total: sql<number>`COUNT(*)` }).from(quotations);
  const [productCount] = await db.select({ total: sql<number>`COUNT(*)` }).from(cplProducts);
  const [certCount] = await db.select({ total: sql<number>`COUNT(*)` }).from(certifications);
  const [eflashCount] = await db.select({ total: sql<number>`COUNT(*)` }).from(eflashRecords);

  const quoteByStatus = await db.select({
    status: quotations.status,
    count: sql<number>`COUNT(*)`,
  }).from(quotations).groupBy(quotations.status);

  const certByStatus = await db.select({
    status: certifications.status,
    count: sql<number>`COUNT(*)`,
  }).from(certifications).groupBy(certifications.status);

  const recentEflash = await db.select({
    eflashId: eflashRecords.eflashId,
    type: eflashRecords.type,
    subjectCn: eflashRecords.subjectCn,
    effectiveDate: eflashRecords.effectiveDate,
  }).from(eflashRecords).orderBy(desc(eflashRecords.effectiveDate)).limit(5);

  return {
    quotations: { total: Number(quoteCount?.total ?? 0), byStatus: Object.fromEntries(quoteByStatus.map(r => [r.status, Number(r.count)])) },
    products: { total: Number(productCount?.total ?? 0) },
    certifications: { total: Number(certCount?.total ?? 0), byStatus: Object.fromEntries(certByStatus.map(r => [r.status, Number(r.count)])) },
    eflash: { total: Number(eflashCount?.total ?? 0), recent: recentEflash },
  };
}

// ── Tool Dispatcher ──

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  queryQuotations: (args) => queryQuotationsImpl(args as Parameters<typeof queryQuotationsImpl>[0]),
  getQuotationDetail: (args) => getQuotationDetailImpl(args as { quotationId: number }),
  queryProducts: (args) => queryProductsImpl(args as Parameters<typeof queryProductsImpl>[0]),
  queryProductSpecs: (args) => queryProductSpecsImpl(args as Parameters<typeof queryProductSpecsImpl>[0]),
  queryCertifications: (args) => queryCertificationsImpl(args as Parameters<typeof queryCertificationsImpl>[0]),
  queryEflash: (args) => queryEflashImpl(args as Parameters<typeof queryEflashImpl>[0]),
  queryCustomers: (args) => queryCustomersImpl(args as { keyword?: string }),
  queryActivityLogs: (args) => queryActivityLogsImpl(args as Parameters<typeof queryActivityLogsImpl>[0]),
  getDashboardSummary: () => getDashboardSummaryImpl(),
};

export async function executeDataTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return JSON.stringify({ error: `Unknown function: ${name}` });
  }
  try {
    const result = await handler(args);
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}
