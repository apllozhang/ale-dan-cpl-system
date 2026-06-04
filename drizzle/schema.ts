import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, index, uniqueIndex } from "drizzle-orm/mysql-core";

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
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
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
}, (table) => [
  index("quotations_createdBy_idx").on(table.createdBy),
  index("quotations_status_idx").on(table.status),
  index("quotations_createdAt_idx").on(table.createdAt),
]);

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

// Quotation items table
export const quotationItems = mysqlTable("quotation_items", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull().references(() => quotations.id, { onDelete: "cascade" }),
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
  batchId: varchar("batchId", { length: 36 }).notNull(),
  isActive: boolean("isActive").default(false).notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  userId: int("userId").notNull().references(() => users.id),
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
  userId: int("userId").notNull().references(() => users.id),
  username: varchar("username", { length: 64 }),
  action: varchar("action", { length: 64 }).notNull(),
  resourceType: varchar("resourceType", { length: 64 }),
  resourceId: int("resourceId"),
  detail: text("detail"),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("activity_logs_userId_idx").on(table.userId),
]);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// Quotation templates
export const quotationTemplates = mysqlTable("quotation_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  createdBy: int("createdBy").notNull().references(() => users.id),
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
  quotationId: int("quotationId").notNull().references(() => quotations.id, { onDelete: "cascade" }),
  version: int("version").notNull(),
  snapshot: text("snapshot").notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuotationVersion = typeof quotationVersions.$inferSelect;
export type InsertQuotationVersion = typeof quotationVersions.$inferInsert;

// Saved searches
export const savedSearches = mysqlTable("saved_searches", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  createdBy: int("createdBy").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductSpecSet = typeof productSpecSets.$inferSelect;
export type InsertProductSpecSet = typeof productSpecSets.$inferInsert;

// Product spec entries (one per productModel within a set)
export const productSpecs = mysqlTable("product_specs", {
  id: int("id").autoincrement().primaryKey(),
  setId: int("setId").notNull().references(() => productSpecSets.id, { onDelete: "cascade" }),
  productModel: varchar("productModel", { length: 256 }).notNull(),
  productDesc: text("productDesc"),
  specs: json("specs").notNull().$type<Record<string, string>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("product_specs_setId_idx").on(table.setId),
]);

export type ProductSpec = typeof productSpecs.$inferSelect;
export type InsertProductSpec = typeof productSpecs.$inferInsert;

// ==================== Certifications ====================

export const certifications = mysqlTable("certifications", {
  id: int("id").autoincrement().primaryKey(),
  certType: varchar("certType", { length: 32 }).notNull(),
  certNo: varchar("certNo", { length: 128 }).notNull().unique(),
  certName: varchar("certName", { length: 256 }).notNull(),
  standardType: varchar("standardType", { length: 64 }),
  productCategory: varchar("productCategory", { length: 64 }),
  productSeries: varchar("productSeries", { length: 128 }),
  issuer: varchar("issuer", { length: 256 }).notNull(),
  holder: varchar("holder", { length: 256 }).notNull(),
  factoryNo: varchar("factoryNo", { length: 128 }),
  testReportNo: varchar("testReportNo", { length: 128 }),
  certScope: text("certScope"),
  issueDate: varchar("issueDate", { length: 10 }).notNull(),
  expiryDate: varchar("expiryDate", { length: 10 }),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  attachmentUrl: varchar("attachmentUrl", { length: 512 }),
  remark: text("remark"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("certifications_certType_idx").on(table.certType),
  index("certifications_productCategory_idx").on(table.productCategory),
  index("certifications_expiryDate_idx").on(table.expiryDate),
  index("certifications_status_idx").on(table.status),
  index("certifications_createdBy_idx").on(table.createdBy),
]);

export type Certification = typeof certifications.$inferSelect;
export type InsertCertification = typeof certifications.$inferInsert;

export const productCertifications = mysqlTable("product_certifications", {
  id: int("id").autoincrement().primaryKey(),
  certificationId: int("certificationId").notNull().references(() => certifications.id, { onDelete: "cascade" }),
  productModel: varchar("productModel", { length: 256 }).notNull(),
}, (table) => [
  index("product_certifications_certificationId_idx").on(table.certificationId),
  index("product_certifications_productModel_idx").on(table.productModel),
]);

export type ProductCertification = typeof productCertifications.$inferSelect;
export type InsertProductCertification = typeof productCertifications.$inferInsert;

// ==================== eFlash ====================

export const eflashRecords = mysqlTable("eflash_records", {
  id: int("id").autoincrement().primaryKey(),
  eflashId: varchar("eflashId", { length: 20 }).notNull().unique(),
  type: mysqlEnum("type", ["phase_in", "phase_out", "service", "pricing", "program"]).notNull(),
  division: mysqlEnum("division", ["communications", "network", "general"]).notNull(),
  scope: mysqlEnum("scope", ["global", "china"]).notNull(),
  subjectEn: text("subjectEn"),
  subjectCn: text("subjectCn"),
  globalDate: timestamp("globalDate"),
  chinaDate: timestamp("chinaDate"),
  effectiveDate: timestamp("effectiveDate"),
  authorEn: varchar("authorEn", { length: 200 }),
  authorCn: varchar("authorCn", { length: 200 }),
  comments: text("comments"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("eflash_records_type_idx").on(table.type),
  index("eflash_records_division_idx").on(table.division),
  index("eflash_records_scope_idx").on(table.scope),
  index("eflash_records_effectiveDate_idx").on(table.effectiveDate),
  index("eflash_records_createdBy_idx").on(table.createdBy),
]);

export type EFlashRecord = typeof eflashRecords.$inferSelect;
export type InsertEFlashRecord = typeof eflashRecords.$inferInsert;

export const eflashTags = mysqlTable("eflash_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  category: mysqlEnum("category", ["region", "product"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("eflash_tags_category_idx").on(table.category),
]);

export type EFlashTag = typeof eflashTags.$inferSelect;
export type InsertEFlashTag = typeof eflashTags.$inferInsert;

export const eflashRecordTags = mysqlTable("eflash_record_tags", {
  recordId: int("recordId").notNull().references(() => eflashRecords.id, { onDelete: "cascade" }),
  tagId: int("tagId").notNull().references(() => eflashTags.id, { onDelete: "cascade" }),
}, (table) => [
  index("eflash_record_tags_tagId_idx").on(table.tagId),
]);

export const eflashAttachments = mysqlTable("eflash_attachments", {
  id: int("id").autoincrement().primaryKey(),
  recordId: int("recordId").notNull().references(() => eflashRecords.id, { onDelete: "cascade" }),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  filePath: varchar("filePath", { length: 1000 }).notNull(),
  fileSize: int("fileSize"),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("eflash_attachments_recordId_idx").on(table.recordId),
]);

export type EFlashAttachment = typeof eflashAttachments.$inferSelect;
export type InsertEFlashAttachment = typeof eflashAttachments.$inferInsert;

// Sessions table — server-side session management for token revocation
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
}, (table) => [
  index("sessions_userId_idx").on(table.userId),
  index("sessions_expiresAt_idx").on(table.expiresAt),
]);

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// System locks table — replaces process-level import locks for multi-instance support
export const systemLocks = mysqlTable("system_locks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull().unique(),
  owner: varchar("owner", { length: 128 }),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SystemLock = typeof systemLocks.$inferSelect;
export type InsertSystemLock = typeof systemLocks.$inferInsert;

// ==================== Temp Uploads ====================
// Temporary file uploads — uploadId replaces filePath in API responses for security
export const tempUploads = mysqlTable("temp_uploads", {
  id: varchar("id", { length: 64 }).primaryKey(),           // UUID
  fileName: varchar("fileName", { length: 256 }).notNull(),
  filePath: varchar("filePath", { length: 1000 }).notNull(),
  fileSize: int("fileSize").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  uploadedBy: int("uploadedBy").notNull().references(() => users.id),
  consumedAt: timestamp("consumedAt"),                       // Marked when consumed by an import job
  expiresAt: timestamp("expiresAt").notNull(),               // Auto-cleanup after expiry
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("temp_uploads_uploadedBy_idx").on(table.uploadedBy),
  index("temp_uploads_expiresAt_idx").on(table.expiresAt),
]);

export type TempUpload = typeof tempUploads.$inferSelect;
export type InsertTempUpload = typeof tempUploads.$inferInsert;

// ==================== Import Jobs ====================
// Async import job tracking — replaces synchronous import in API request
export const importJobs = mysqlTable("import_jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),            // UUID
  type: mysqlEnum("type", ["cpl", "eflash"]).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "succeeded", "failed", "cancelled"]).default("pending").notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  uploadId: varchar("uploadId", { length: 64 }),             // References temp_uploads.id
  createdBy: int("createdBy").notNull().references(() => users.id),
  progress: int("progress").default(0).notNull(),            // 0-100
  errorMessage: text("errorMessage"),
  result: json("result").$type<{
    sheetsImported?: number;
    productsImported?: number;
    hasSummary?: boolean;
  }>(),
  selectedSheets: json("selectedSheets").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
}, (table) => [
  index("import_jobs_createdBy_idx").on(table.createdBy),
  index("import_jobs_status_idx").on(table.status),
  index("import_jobs_createdAt_idx").on(table.createdAt),
]);

export type ImportJob = typeof importJobs.$inferSelect;
export type InsertImportJob = typeof importJobs.$inferInsert;

// ==================== Login Attempts ====================
// Database-backed login rate limiting — replaces in-memory Map for multi-instance support
export const loginAttempts = mysqlTable("login_attempts", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull(),             // IP or IP:username
  count: int("count").default(0).notNull(),
  windowStart: timestamp("windowStart").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
}, (table) => [
  uniqueIndex("login_attempts_key_unique").on(table.key),
  index("login_attempts_expiresAt_idx").on(table.expiresAt),
]);

export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type InsertLoginAttempt = typeof loginAttempts.$inferInsert;
