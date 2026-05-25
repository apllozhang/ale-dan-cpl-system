import { eq, like, or, and, sql, asc, desc, SQL, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, cplProducts, cplSheets, cplSummary,
  InsertCplProduct, InsertCplSheet, InsertCplSummary,
  quotations, quotationItems, InsertQuotation, InsertQuotationItem,
  organizations, InsertOrganization,
  userGroups, InsertUserGroup,
  importLogs, InsertImportLog,
  activityLogs, InsertActivityLog,
  quotationTemplates, InsertQuotationTemplate,
  quotationVersions, InsertQuotationVersion,
  savedSearches, InsertSavedSearch,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User helpers ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== CPL Product helpers ====================
export async function getCplProducts(params: {
  sheetName?: string;
  sheetNames?: string[];
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const { sheetName, sheetNames, search, page = 1, pageSize = 50, sortBy, sortOrder = "asc", filters } = params;
  const conditions: SQL[] = [];

  if (sheetNames && sheetNames.length > 0) {
    conditions.push(inArray(cplProducts.sheetName, sheetNames));
  } else if (sheetName) {
    conditions.push(eq(cplProducts.sheetName, sheetName));
  }

  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      or(
        like(cplProducts.productGroup, searchTerm),
        like(cplProducts.taxCategory, searchTerm),
        like(cplProducts.productModel, searchTerm),
        like(cplProducts.productDesc, searchTerm),
        like(cplProducts.salesCategory, searchTerm),
        like(cplProducts.serviceCategory, searchTerm),
        like(cplProducts.productStatus, searchTerm),
        like(cplProducts.listPrice, searchTerm),
        like(cplProducts.priceNote, searchTerm),
        like(cplProducts.isNew, searchTerm),
        like(cplProducts.remark, searchTerm),
      )!
    );
  }

  // Apply column-specific filters
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (!value || !value.trim()) continue;
      const filterTerm = `%${value.trim()}%`;
      const columnMap: Record<string, any> = {
        productGroup: cplProducts.productGroup,
        taxCategory: cplProducts.taxCategory,
        productModel: cplProducts.productModel,
        productDesc: cplProducts.productDesc,
        salesCategory: cplProducts.salesCategory,
        serviceCategory: cplProducts.serviceCategory,
        productStatus: cplProducts.productStatus,
        listPrice: cplProducts.listPrice,
        priceNote: cplProducts.priceNote,
        isNew: cplProducts.isNew,
        remark: cplProducts.remark,
      };
      if (columnMap[key]) {
        conditions.push(like(columnMap[key], filterTerm));
      }
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Sort
  const sortColumnMap: Record<string, any> = {
    productGroup: cplProducts.productGroup,
    taxCategory: cplProducts.taxCategory,
    productModel: cplProducts.productModel,
    productDesc: cplProducts.productDesc,
    salesCategory: cplProducts.salesCategory,
    serviceCategory: cplProducts.serviceCategory,
    productStatus: cplProducts.productStatus,
    listPrice: cplProducts.listPrice,
    priceNote: cplProducts.priceNote,
    isNew: cplProducts.isNew,
    remark: cplProducts.remark,
  };
  const sortColumn = sortBy && sortColumnMap[sortBy] ? sortColumnMap[sortBy] : cplProducts.id;
  const orderFn = sortOrder === "desc" ? desc : asc;

  const offset = (page - 1) * pageSize;

  const [items, countResult] = await Promise.all([
    db.select().from(cplProducts).where(whereClause).orderBy(orderFn(sortColumn)).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(cplProducts).where(whereClause),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
}

// ==================== CPL Sheet helpers ====================
export async function getCplSheets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cplSheets).orderBy(asc(cplSheets.displayOrder));
}

export async function clearAndInsertSheets(sheets: InsertCplSheet[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cplSheets);
  if (sheets.length > 0) {
    await db.insert(cplSheets).values(sheets);
  }
}

// ==================== CPL Summary helpers ====================
export async function getLatestSummary() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cplSummary).orderBy(desc(cplSummary.importedAt)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function insertSummary(summary: InsertCplSummary) {
  const db = await getDb();
  if (!db) return;
  await db.insert(cplSummary).values(summary);
}

// ==================== Bulk import helpers ====================
export async function clearAllProducts() {
  const db = await getDb();
  if (!db) return;
  await db.delete(cplProducts);
}

export async function bulkInsertProducts(products: InsertCplProduct[]) {
  const db = await getDb();
  if (!db) return;
  // Insert in batches of 200
  const batchSize = 200;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    await db.insert(cplProducts).values(batch);
  }
}

// ==================== User auth helpers ====================
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(data: {
  username: string;
  passwordHash: string;
  name?: string;
  email?: string;
  role?: "user" | "admin" | "sales_manager" | "sales_rep" | "viewer";
  isSuperAdmin?: boolean;
  organizationId?: number;
  groupId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(users).values({
    openId: `local-${data.username}`,
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name || null,
    email: data.email || null,
    loginMethod: "local",
    role: data.role || "user",
    isSuperAdmin: data.isSuperAdmin ?? false,
    organizationId: data.organizationId ?? null,
    groupId: data.groupId ?? null,
  });
  return { id: Number(result[0].insertId), username: data.username };
}

export async function updateUser(id: number, data: {
  username?: string;
  passwordHash?: string;
  name?: string;
  email?: string;
  role?: "user" | "admin" | "sales_manager" | "sales_rep" | "viewer";
  isSuperAdmin?: boolean;
  organizationId?: number | null;
  groupId?: number | null;
}) {
  const db = await getDb();
  if (!db) return;
  const updateSet: Record<string, unknown> = {};
  if (data.username !== undefined) updateSet.username = data.username;
  if (data.passwordHash !== undefined) updateSet.passwordHash = data.passwordHash;
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.email !== undefined) updateSet.email = data.email;
  if (data.role !== undefined) updateSet.role = data.role;
  if (data.isSuperAdmin !== undefined) updateSet.isSuperAdmin = data.isSuperAdmin;
  if (data.organizationId !== undefined) updateSet.organizationId = data.organizationId;
  if (data.groupId !== undefined) updateSet.groupId = data.groupId;
  if (data.username !== undefined) updateSet.openId = `local-${data.username}`;
  await db.update(users).set(updateSet).where(eq(users.id, id));
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
    username: users.username,
    name: users.name,
    email: users.email,
    role: users.role,
    isSuperAdmin: users.isSuperAdmin,
    organizationId: users.organizationId,
    groupId: users.groupId,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(asc(users.id));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: users.id,
    username: users.username,
    name: users.name,
    email: users.email,
    role: users.role,
    isSuperAdmin: users.isSuperAdmin,
    organizationId: users.organizationId,
    groupId: users.groupId,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== Quotation helpers ====================
export async function getQuotations(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const { search, status, page = 1, pageSize = 20, sortBy, sortOrder = "desc", createdBy } = params;
  const conditions: SQL[] = [];

  if (createdBy) {
    conditions.push(eq(quotations.createdBy, createdBy));
  }

  if (status && status !== "all") {
    conditions.push(eq(quotations.status, status as any));
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

export async function getQuotationById(id: number) {
  const db = await getDb();
  if (!db) return null;

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

export async function createQuotation(data: InsertQuotation, items: InsertQuotationItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Generate quotationNo: QT-YYYYMMDD-NNN
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `QT-${dateStr}-`;
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(quotations)
    .where(like(quotations.quotationNo, prefix + "%"));
  const seq = Number(countResult[0]?.count ?? 0) + 1;
  const quotationNo = `${prefix}${String(seq).padStart(3, "0")}`;

  const result = await db.insert(quotations).values({
    ...data,
    quotationNo,
  });
  const quotationId = Number(result[0].insertId);

  if (items.length > 0) {
    const itemsWithQId = items.map(item => ({ ...item, quotationId }));
    const batchSize = 100;
    for (let i = 0; i < itemsWithQId.length; i += batchSize) {
      const batch = itemsWithQId.slice(i, i + batchSize);
      await db.insert(quotationItems).values(batch);
    }
  }

  return { id: quotationId, quotationNo };
}

export async function updateQuotation(id: number, data: Partial<InsertQuotation>, items?: InsertQuotationItem[]) {
  const db = await getDb();
  if (!db) return;

  const updateSet: Record<string, unknown> = {};
  if (data.customerName !== undefined) updateSet.customerName = data.customerName;
  if (data.customerContact !== undefined) updateSet.customerContact = data.customerContact;
  if (data.customerPhone !== undefined) updateSet.customerPhone = data.customerPhone;
  if (data.customerEmail !== undefined) updateSet.customerEmail = data.customerEmail;
  if (data.projectName !== undefined) updateSet.projectName = data.projectName;
  if (data.discountRate !== undefined) updateSet.discountRate = data.discountRate;
  if (data.totalAmount !== undefined) updateSet.totalAmount = data.totalAmount;
  if (data.notes !== undefined) updateSet.notes = data.notes;
  if (data.validUntil !== undefined) updateSet.validUntil = data.validUntil;
  if (data.status !== undefined) updateSet.status = data.status;

  if (Object.keys(updateSet).length > 0) {
    await db.update(quotations).set(updateSet).where(eq(quotations.id, id));
  }

  if (items !== undefined) {
    await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
    if (items.length > 0) {
      const itemsWithQId = items.map(item => ({ ...item, quotationId: id }));
      const batchSize = 100;
      for (let i = 0; i < itemsWithQId.length; i += batchSize) {
        const batch = itemsWithQId.slice(i, i + batchSize);
        await db.insert(quotationItems).values(batch);
      }
    }
  }
}

export async function deleteQuotation(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
  await db.delete(quotations).where(eq(quotations.id, id));
}

export async function updateQuotationStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(quotations).set({ status: status as any }).where(eq(quotations.id, id));
}

// ==================== Organization helpers ====================
export async function getAllOrganizations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(organizations).orderBy(asc(organizations.id));
}

export async function createOrganization(data: { name: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(organizations).values({ name: data.name });
  return { id: Number(result[0].insertId), name: data.name };
}

export async function updateOrganization(id: number, data: { name: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(organizations).set({ name: data.name }).where(eq(organizations.id, id));
}

export async function deleteOrganization(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(organizations).where(eq(organizations.id, id));
}

// ==================== User Group helpers ====================
export async function getAllUserGroups() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: userGroups.id,
    name: userGroups.name,
    organizationId: userGroups.organizationId,
    createdAt: userGroups.createdAt,
    updatedAt: userGroups.updatedAt,
  }).from(userGroups).orderBy(asc(userGroups.id));
}

export async function createUserGroup(data: { name: string; organizationId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(userGroups).values({
    name: data.name,
    organizationId: data.organizationId,
  });
  return { id: Number(result[0].insertId), name: data.name, organizationId: data.organizationId };
}

export async function updateUserGroup(id: number, data: { name?: string; organizationId?: number }) {
  const db = await getDb();
  if (!db) return;
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.organizationId !== undefined) updateSet.organizationId = data.organizationId;
  await db.update(userGroups).set(updateSet).where(eq(userGroups.id, id));
}

export async function deleteUserGroup(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(userGroups).where(eq(userGroups.id, id));
}

// ==================== Import Log helpers ====================
export async function getImportLogs(params: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const { search, page = 1, pageSize = 20 } = params;
  const conditions: SQL[] = [];

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(
      like(importLogs.fileName, term),
      like(importLogs.username, term),
      like(importLogs.orgName || sql`''`, term),
      like(importLogs.groupName || sql`''`, term),
      like(importLogs.mode, term),
    )!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const total = await db.$count(importLogs, where);
  const items = await db.select().from(importLogs)
    .where(where)
    .orderBy(desc(importLogs.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items, total };
}

export async function createImportLog(data: InsertImportLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(importLogs).values(data);
}

export async function clearImportLogs() {
  const db = await getDb();
  if (!db) return;
  await db.delete(importLogs);
}

export async function countCplProducts() {
  const db = await getDb();
  if (!db) return 0;
  return db.$count(cplProducts);
}

// ==================== Activity Log helpers ====================
export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}

export async function getActivityLogs(params: {
  search?: string;
  action?: string;
  userId?: number;
  page: number;
  pageSize: number;
}) {
  const db = await getDb();
  if (!db) return { items: [] as any[], total: 0 };
  const { search, action, userId, page, pageSize } = params;

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
  if (userId) {
    conditions.push(eq(activityLogs.userId, userId));
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

// ==================== CPL Stats helpers ====================
export async function getCplStats() {
  const db = await getDb();
  if (!db) return { bySheet: [], byStatus: [], bySalesCategory: [], total: 0 };

  const bySheet = await db.select({
    sheetName: cplProducts.sheetName,
    count: sql<number>`count(*)`,
  }).from(cplProducts)
    .groupBy(cplProducts.sheetName)
    .orderBy(desc(sql`count(*)`));

  const byStatus = await db.select({
    status: cplProducts.productStatus,
    count: sql<number>`count(*)`,
  }).from(cplProducts)
    .where(sql`${cplProducts.productStatus} IS NOT NULL AND ${cplProducts.productStatus} != ''`)
    .groupBy(cplProducts.productStatus)
    .orderBy(desc(sql`count(*)`));

  const bySalesCategory = await db.select({
    category: cplProducts.salesCategory,
    count: sql<number>`count(*)`,
  }).from(cplProducts)
    .where(sql`${cplProducts.salesCategory} IS NOT NULL AND ${cplProducts.salesCategory} != ''`)
    .groupBy(cplProducts.salesCategory)
    .orderBy(desc(sql`count(*)`))
    .limit(15);

  const [totalRow] = await db.select({
    count: sql<number>`count(*)`,
  }).from(cplProducts);

  return { bySheet, byStatus, bySalesCategory, total: totalRow?.count ?? 0 };
}

// ==================== Quotation Template helpers ====================
export async function getQuotationTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(quotationTemplates)
    .where(or(
      eq(quotationTemplates.createdBy, userId),
      eq(quotationTemplates.isPublic, true),
    ))
    .orderBy(desc(quotationTemplates.updatedAt));
}

export async function getQuotationTemplateById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(quotationTemplates).where(eq(quotationTemplates.id, id));
  return row ?? null;
}

export async function createQuotationTemplate(data: InsertQuotationTemplate) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(quotationTemplates).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateQuotationTemplate(id: number, data: Partial<InsertQuotationTemplate>) {
  const db = await getDb();
  if (!db) return;
  await db.update(quotationTemplates).set(data).where(eq(quotationTemplates.id, id));
}

export async function deleteQuotationTemplate(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(quotationTemplates).where(eq(quotationTemplates.id, id));
}

// ==================== Quotation Version helpers ====================
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

// ==================== Saved Search helpers ====================
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

// ==================== Search Suggestions ====================
export async function getSearchSuggestions(field: string, query: string, limit: number = 10) {
  const db = await getDb();
  if (!db || !query) return [];
  const columnMap: Record<string, any> = {
    productModel: cplProducts.productModel,
    productDesc: cplProducts.productDesc,
    productGroup: cplProducts.productGroup,
  };
  const col = columnMap[field];
  if (!col) return [];
  const term = `%${query}%`;
  return db.selectDistinct({ value: col }).from(cplProducts)
    .where(like(col, term))
    .limit(limit);
}

// ==================== Quotation Share helpers ====================
export async function getQuotationByShareToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const [q] = await db.select().from(quotations).where(eq(quotations.shareToken, token));
  if (!q) return null;
  const items = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, q.id));
  return { ...q, items };
}
