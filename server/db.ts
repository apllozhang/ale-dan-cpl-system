import { eq, like, or, and, sql, asc, desc, SQL, inArray, gte, lte } from "drizzle-orm";
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

export async function updateQuotation(id: number, data: Partial<InsertQuotation>, items?: InsertQuotationItem[], userId?: number) {
  const db = await getDb();
  if (!db) return;

  // Snapshot current state BEFORE update (for version tracking)
  let shouldCreateVersion = false;
  const oldItems = await db.select().from(quotationItems).where(eq(quotationItems.quotationId, id));
  const [oldQuotation] = await db.select({
    version: quotations.version,
    totalAmount: quotations.totalAmount,
    customerName: quotations.customerName,
    projectName: quotations.projectName,
    status: quotations.status,
    notes: quotations.notes,
  }).from(quotations).where(eq(quotations.id, id)).limit(1);

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
    await db.update(quotations).set(updateSet).where(eq(quotations.id, id));
  }

  if (items !== undefined) {
    shouldCreateVersion = true;
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

  // Auto-create version snapshot with change summary
  if (shouldCreateVersion && oldQuotation) {
    const newVersion = (oldQuotation.version ?? 1) + 1;
    await db.update(quotations).set({ version: newVersion }).where(eq(quotations.id, id));

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
          if (Number(oi.quantity) !== ni.quantity || oi.discountRate !== String(ni.discountRate ?? 0)) {
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

    await db.insert(quotationVersions).values({
      quotationId: id,
      version: newVersion,
      snapshot,
      createdBy: userId ?? 0,
    });
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

// ==================== Quotation Analytics ====================
export async function getQuotationAnalytics(params: { startDate?: Date; endDate?: Date; userId?: number }) {
  const db = await getDb();
  const empty = { summary: { totalQuotations: 0, completedRevenue: 0, avgAmount: 0, conversionRate: 0 }, byIndustry: [], byCustomer: [], bySalesRep: [], byTime: [], byStatus: [], topProducts: [] };
  if (!db) return empty;

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
    byIndustry: industryRows as any[],
    byCustomer: customerRows as any[],
    bySalesRep: salesRepRows as any[],
    byTime: timeRows as any[],
    byStatus: statusRows as any[],
    topProducts: productRows as any[],
  };
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
