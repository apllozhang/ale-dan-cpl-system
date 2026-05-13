import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// CPL Product data table
export const cplProducts = mysqlTable("cpl_products", {
  id: int("id").autoincrement().primaryKey(),
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
});

export type CplProduct = typeof cplProducts.$inferSelect;
export type InsertCplProduct = typeof cplProducts.$inferInsert;

// CPL Summary / Changelog table
export const cplSummary = mysqlTable("cpl_summary", {
  id: int("id").autoincrement().primaryKey(),
  content: text("content").notNull(),
  version: varchar("version", { length: 256 }),
  importedAt: timestamp("importedAt").defaultNow().notNull(),
});

export type CplSummary = typeof cplSummary.$inferSelect;
export type InsertCplSummary = typeof cplSummary.$inferInsert;

// Sheet metadata table
export const cplSheets = mysqlTable("cpl_sheets", {
  id: int("id").autoincrement().primaryKey(),
  sheetName: varchar("sheetName", { length: 128 }).notNull().unique(),
  displayOrder: int("displayOrder").notNull().default(0),
  productCount: int("productCount").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CplSheet = typeof cplSheets.$inferSelect;
export type InsertCplSheet = typeof cplSheets.$inferInsert;
