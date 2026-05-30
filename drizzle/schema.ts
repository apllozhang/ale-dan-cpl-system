import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: text("passwordHash"),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "sales_manager", "sales_rep", "viewer"]).default("user").notNull(),
  isSuperAdmin: boolean("isSuperAdmin").default(false).notNull(),
  organizationId: int("organizationId"),
  groupId: int("groupId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Organization table
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// User Group table
export const userGroups = mysqlTable("user_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  organizationId: int("organizationId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserGroup = typeof userGroups.$inferSelect;
export type InsertUserGroup = typeof userGroups.$inferInsert;

// CPL Product data table
export const cplProducts = mysqlTable("cpl_products", {
  id: int("id").autoincrement().primaryKey(),
  importLogId: int("importLogId"),
  sheetName: varchar("sheetName", { length: 128 }).notNull(),
  productGroup: text("productGroup"),       // 产品组件
  taxCategory: text("taxCategory"),         // 税务小类
  productModel: varchar("productModel", { length: 256 }), // 产品型号
  productDesc: text("productDesc"),         // 产品说明
  salesCategory: varchar("salesCategory", { length: 128 }), // 销售类别
  serviceCategory: varchar("serviceCategory", { length: 128 }), // 服务类别
  productStatus: varchar("productStatus", { length: 64 }), // 产品状态
  listPrice: varchar("listPrice", { length: 64 }),  // 媒体价
  priceNote: text("priceNote"),             // 价格说明
  isNew: varchar("isNew", { length: 64 }),  // 新品
  remark: text("remark"),                   // 备注
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("cpl_products_importLogId_idx").on(table.importLogId),
  index("cpl_products_sheetName_idx").on(table.sheetName),
]);

export type CplProduct = typeof cplProducts.$inferSelect;
export type InsertCplProduct = typeof cplProducts.$inferInsert;

// CPL Summary / Changelog table
export const cplSummary = mysqlTable("cpl_summary", {
  id: int("id").autoincrement().primaryKey(),
  importLogId: int("importLogId"),
  content: text("content").notNull(),
  version: varchar("version", { length: 256 }),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
});

export type CplSummary = typeof cplSummary.$inferSelect;
export type InsertCplSummary = typeof cplSummary.$inferInsert;

// Sheet metadata table
export const cplSheets = mysqlTable("cpl_sheets", {
  id: int("id").autoincrement().primaryKey(),
  importLogId: int("importLogId"),
  sheetName: varchar("sheetName", { length: 128 }).notNull(),
  displayOrder: int("displayOrder").notNull().default(0),
  productCount: int("productCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CplSheet = typeof cplSheets.$inferSelect;
export type InsertCplSheet = typeof cplSheets.$inferInsert;

// Quotation table
export const quotations = mysqlTable("quotations", {
  id: int("id").autoincrement().primaryKey(),
  quotationNo: varchar("quotationNo", { length: 64 }).notNull().unique(),
  customerName: varchar("customerName", { length: 256 }).notNull(),
  customerContact: varchar("customerContact", { length: 128 }),
  customerPhone: varchar("customerPhone", { length: 64 }),
  customerEmail: varchar("customerEmail", { length: 320 }),
  industry: varchar("industry", { length: 128 }),
  projectName: varchar("projectName", { length: 256 }),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "sent", "completed", "cancelled"]).default("draft").notNull(),
  discountRate: decimal("discountRate", { precision: 5, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 14, scale: 2 }).default("0"),
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  version: int("version").default(1).notNull(),
  shareToken: varchar("shareToken", { length: 64 }).unique(),
  validUntil: timestamp("validUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

// Quotation items table
export const quotationItems = mysqlTable("quotation_items", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull(),
  productId: int("productId"),
  productModel: varchar("productModel", { length: 256 }).notNull(),
  productDesc: text("productDesc"),
  listPrice: varchar("listPrice", { length: 64 }),
  quantity: int("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 14, scale: 2 }),
  discountRate: decimal("discountRate", { precision: 5, scale: 2 }).default("0"),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("quotation_items_quotationId_idx").on(table.quotationId),
]);

export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = typeof quotationItems.$inferInsert;

// Import log table
export const importLogs = mysqlTable("import_logs", {
  id: int("id").autoincrement().primaryKey(),
  isActive: boolean("isActive").default(false).notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  userId: int("userId").notNull(),
  username: varchar("username", { length: 64 }).notNull(),
  orgName: varchar("orgName", { length: 128 }),
  groupName: varchar("groupName", { length: 128 }),
  mode: varchar("mode", { length: 16 }).notNull(), // "overwrite" | "merge"
  sheetNames: json("sheetNames").$type<string[]>(),
  sheetsCount: int("sheetsCount").notNull().default(0),
  productsCount: int("productsCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImportLog = typeof importLogs.$inferSelect;
export type InsertImportLog = typeof importLogs.$inferInsert;

// Activity / Audit log table
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  username: varchar("username", { length: 64 }),
  action: varchar("action", { length: 64 }).notNull(),
  resourceType: varchar("resourceType", { length: 64 }),
  resourceId: int("resourceId"),
  detail: text("detail"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// Quotation templates
export const quotationTemplates = mysqlTable("quotation_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  createdBy: int("createdBy").notNull(),
  isPublic: boolean("isPublic").default(false).notNull(),
  discountRate: decimal("discountRate", { precision: 5, scale: 2 }).default("0"),
  notes: text("notes"),
  validDays: int("validDays"),
  items: text("items").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type QuotationTemplate = typeof quotationTemplates.$inferSelect;
export type InsertQuotationTemplate = typeof quotationTemplates.$inferInsert;

// Quotation versions
export const quotationVersions = mysqlTable("quotation_versions", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull(),
  version: int("version").notNull(),
  snapshot: text("snapshot").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuotationVersion = typeof quotationVersions.$inferSelect;
export type InsertQuotationVersion = typeof quotationVersions.$inferInsert;

// Saved searches
export const savedSearches = mysqlTable("saved_searches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  page: varchar("page", { length: 32 }).notNull(),
  conditions: text("conditions").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = typeof savedSearches.$inferInsert;

// Product spec sets (one per upload)
export const productSpecSets = mysqlTable("product_spec_sets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  fileName: varchar("fileName", { length: 256 }),
  description: text("description"),
  summaryContent: text("summaryContent"),
  modelCount: int("modelCount").notNull().default(0),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductSpecSet = typeof productSpecSets.$inferSelect;
export type InsertProductSpecSet = typeof productSpecSets.$inferInsert;

// Product spec entries (one per productModel within a set)
export const productSpecs = mysqlTable("product_specs", {
  id: int("id").autoincrement().primaryKey(),
  setId: int("setId").notNull(),
  productModel: varchar("productModel", { length: 256 }).notNull(),
  productDesc: text("productDesc"),
  specs: json("specs").notNull().$type<Record<string, string>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductSpec = typeof productSpecs.$inferSelect;
export type InsertProductSpec = typeof productSpecs.$inferInsert;
