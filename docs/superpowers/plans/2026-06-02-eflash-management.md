# eFlash 管理模块实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 CPL 系统添加 eFlash 通知文档的完整 CRUD、Excel 批量导入、PDF 附件管理和查询筛选功能。

**架构：** 遵循现有 certifications 模块的三层模式：Drizzle schema → server/db 数据库操作 → server/routers tRPC 路由。前端为单页面 + 6 个子组件。PDF 附件存本地文件系统，Express 提供静态下载。

**技术栈：** Drizzle ORM + MySQL 8、tRPC + Zod、React + Wouter、shadcn/ui + Tailwind、XLSX 库、i18next

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `drizzle/0015_add_eflash_tables.sql` | 4 张表的 DDL 迁移 |
| `drizzle/meta/0015_snapshot.json` | 迁移后完整 schema 快照 |
| `server/db/eflash.ts` | 数据库 CRUD + Excel 导入逻辑 |
| `server/routers/eflash.ts` | tRPC 路由定义（list/getById/create/update/delete/importExcel/uploadAttachment/deleteAttachment/listTags/getStats） |
| `client/src/pages/EFlashPage.tsx` | 页面容器：筛选状态、布局、对话框控制 |
| `client/src/components/eflash/EFlashTable.tsx` | 数据表格：列定义、排序、操作按钮 |
| `client/src/components/eflash/EFlashDetailSheet.tsx` | 右侧抽屉：记录完整详情 + 附件下载 |
| `client/src/components/eflash/EFlashFormDialog.tsx` | 新建/编辑表单对话框 |
| `client/src/components/eflash/EFlashImportDialog.tsx` | Excel 批量导入对话框 |
| `client/src/components/eflash/RecentEFlashCard.tsx` | Dashboard 首页卡片 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `drizzle/schema.ts` | 末尾新增 4 张表定义 + 导出类型 |
| `drizzle/meta/_journal.json` | 追加 0015 条目 |
| `shared/const.ts` | 新增 `EFLASH_MANAGE` 权限 + ROLE_PERMISSIONS 映射 |
| `server/db/index.ts` | 追加 `export * from "./eflash"` |
| `server/routers.ts` | 注册 `eflash: eflashRouter` |
| `server/_core/index.ts` | 注册 `uploads/eflash` 静态路由 + multer |
| `client/src/App.tsx` | 添加 `/eflash` 路由 |
| `client/src/components/DashboardLayout.tsx` | 侧边栏添加 eFlash 菜单项 |
| `client/src/pages/Home.tsx` | 添加 RecentEFlashCard |
| `client/src/i18n/locales/zh.json` | 添加 `eflash.*` 翻译 |
| `client/src/i18n/locales/en.json` | 添加 `eflash.*` 翻译 |
| `client/src/i18n/locales/zh-TW.json` | 添加 `eflash.*` 翻译 |
| `client/src/i18n/locales/ja.json` | 添加 `eflash.*` 翻译 |
| `client/src/i18n/locales/es.json` | 添加 `eflash.*` 翻译 |
| `client/src/i18n/locales/fr.json` | 添加 `eflash.*` 翻译 |

---

## 任务 1：数据库 Schema + 迁移

**文件：**
- 修改：`drizzle/schema.ts`（末尾追加）
- 创建：`drizzle/0015_add_eflash_tables.sql`
- 修改：`drizzle/meta/_journal.json`
- 创建：`drizzle/meta/0015_snapshot.json`

- [ ] **步骤 1：在 `drizzle/schema.ts` 末尾追加 4 张表定义**

```typescript
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
```

- [ ] **步骤 2：运行 `pnpm db:push` 生成迁移 SQL**

运行：`pnpm db:push`
预期：生成 `drizzle/0015_*.sql`，包含 4 张表的 CREATE TABLE + 索引

- [ ] **步骤 3：确认 `_journal.json` 已更新**

检查 `drizzle/meta/_journal.json` 末尾是否追加了版本 15 的条目。如果 `db:push` 自动更新了则跳过。

- [ ] **步骤 4：Commit**

```bash
git add drizzle/schema.ts drizzle/0015_*.sql drizzle/meta/
git commit -m "feat(eflash): add database schema and migration"
```

---

## 任务 2：共享权限常量

**文件：**
- 修改：`shared/const.ts`

- [ ] **步骤 1：在 `PERMISSIONS` 对象中添加 `EFLASH_MANAGE`**

在 `PERMISSIONS` 对象内已有 `MANAGE_CERTIFICATIONS` 之后添加：

```typescript
EFLASH_MANAGE: "manage_eflash",
```

- [ ] **步骤 2：在 `ROLE_PERMISSIONS` 中添加映射**

在 `ROLE_PERMISSIONS` 对象内添加：

```typescript
[PERMISSIONS.EFLASH_MANAGE]: [SUPER_ADMIN_ROLE, "admin", "sales_manager"],
```

- [ ] **步骤 3：Commit**

```bash
git add shared/const.ts
git commit -m "feat(eflash): add EFLASH_MANAGE permission"
```

---

## 任务 3：数据库操作模块

**文件：**
- 创建：`server/db/eflash.ts`
- 修改：`server/db/index.ts`（追加一行导出）

- [ ] **步骤 1：创建 `server/db/eflash.ts`**

```typescript
import { eq, and, or, like, desc, sql, inArray, between } from "drizzle-orm";
import { getDb } from "./index";
import { eflashRecords, eflashTags, eflashRecordTags, eflashAttachments } from "../../drizzle/schema";
import type { InsertEFlashRecord, InsertEFlashTag, InsertEFlashAttachment } from "../../drizzle/schema";

// ==================== Records ====================

export async function listEFlashRecords(params: {
  page?: number;
  pageSize?: number;
  type?: string;
  division?: string;
  scope?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  tagIds?: number[];
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 100);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (params.type) conditions.push(eq(eflashRecords.type, params.type as "phase_in" | "phase_out" | "service" | "pricing" | "program"));
  if (params.division) conditions.push(eq(eflashRecords.division, params.division as "communications" | "network" | "general"));
  if (params.scope) conditions.push(eq(eflashRecords.scope, params.scope as "global" | "china"));
  if (params.search) {
    const s = `%${params.search}%`;
    conditions.push(or(
      like(eflashRecords.eflashId, s),
      like(eflashRecords.subjectEn, s),
      like(eflashRecords.subjectCn, s),
    )!);
  }

  // Tag filtering via join
  if (params.tagIds && params.tagIds.length > 0) {
    const tagCondition = sql`EXISTS (
      SELECT 1 FROM eflash_record_tags
      WHERE eflash_record_tags.recordId = eflash_records.id
      AND eflash_record_tags.tagId IN (${sql.join(params.tagIds.map(id => sql`${id}`), sql`, `)})
    )`;
    conditions.push(tagCondition);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(eflashRecords)
    .where(where);
  const total = Number(countResult.count);

  const items = await db
    .select()
    .from(eflashRecords)
    .where(where)
    .orderBy(desc(eflashRecords.effectiveDate), desc(eflashRecords.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { items, total };
}

export async function getEFlashRecordById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const [record] = await db
    .select()
    .from(eflashRecords)
    .where(eq(eflashRecords.id, id));

  if (!record) return null;

  // Fetch tags
  const tags = await db
    .select({ id: eflashTags.id, name: eflashTags.name, category: eflashTags.category })
    .from(eflashRecordTags)
    .innerJoin(eflashTags, eq(eflashRecordTags.tagId, eflashTags.id))
    .where(eq(eflashRecordTags.recordId, id));

  // Fetch attachments
  const attachments = await db
    .select()
    .from(eflashAttachments)
    .where(eq(eflashAttachments.recordId, id));

  return { ...record, tags, attachments };
}

export async function createEFlashRecord(data: InsertEFlashRecord, tagIds?: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(eflashRecords).values(data);
  const id = Number(result.insertId);

  if (tagIds && tagIds.length > 0) {
    await db.insert(eflashRecordTags).values(
      tagIds.map(tagId => ({ recordId: id, tagId }))
    );
  }

  return id;
}

export async function updateEFlashRecord(id: number, data: Partial<InsertEFlashRecord>, tagIds?: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(eflashRecords).set(data).where(eq(eflashRecords.id, id));

  // Replace tags if provided
  if (tagIds !== undefined) {
    await db.delete(eflashRecordTags).where(eq(eflashRecordTags.recordId, id));
    if (tagIds.length > 0) {
      await db.insert(eflashRecordTags).values(
        tagIds.map(tagId => ({ recordId: id, tagId }))
      );
    }
  }

  return id;
}

export async function deleteEFlashRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch attachments to delete files
  const attachments = await db
    .select()
    .from(eflashAttachments)
    .where(eq(eflashAttachments.recordId, id));

  // Delete DB records (cascade handles record_tags and attachments)
  await db.delete(eflashRecords).where(eq(eflashRecords.id, id));

  // Delete physical files
  const fs = await import("fs/promises");
  for (const att of attachments) {
    try {
      await fs.unlink(att.filePath);
    } catch { /* file may already be gone */ }
  }

  return true;
}

export async function getEFlashRecordByEFlashId(eflashId: string) {
  const db = await getDb();
  if (!db) return null;

  const [record] = await db
    .select()
    .from(eflashRecords)
    .where(eq(eflashRecords.eflashId, eflashId));

  return record || null;
}

// ==================== Tags ====================

export async function listEFlashTags(category?: string) {
  const db = await getDb();
  if (!db) return [];

  const where = category
    ? eq(eflashTags.category, category as "region" | "product")
    : undefined;

  return db.select().from(eflashTags).where(where).orderBy(eflashTags.name);
}

export async function findOrCreateTag(name: string, category: "region" | "product") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [existing] = await db
    .select()
    .from(eflashTags)
    .where(and(eq(eflashTags.name, name), eq(eflashTags.category, category)));

  if (existing) return existing.id;

  const [result] = await db.insert(eflashTags).values({ name, category });
  return Number(result.insertId);
}

// ==================== Attachments ====================

export async function createAttachment(data: InsertEFlashAttachment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(eflashAttachments).values(data);
  return Number(result.insertId);
}

export async function deleteAttachment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [att] = await db.select().from(eflashAttachments).where(eq(eflashAttachments.id, id));
  if (att) {
    const fs = await import("fs/promises");
    try { await fs.unlink(att.filePath); } catch { /* ignore */ }
  }

  await db.delete(eflashAttachments).where(eq(eflashAttachments.id, id));
  return true;
}

// ==================== Stats ====================

export async function getEFlashStats() {
  const db = await getDb();
  if (!db) return { byType: {}, recentCount: 0 };

  const byType = await db
    .select({ type: eflashRecords.type, count: sql<number>`count(*)` })
    .from(eflashRecords)
    .groupBy(eflashRecords.type);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [recentResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(eflashRecords)
    .where(sql`${eflashRecords.createdAt} >= ${thirtyDaysAgo}`);

  return {
    byType: Object.fromEntries(byType.map(r => [r.type, Number(r.count)])),
    recentCount: Number(recentResult.count),
  };
}

// ==================== Excel Import ====================

const TYPE_MAP: Record<string, "phase_in" | "phase_out" | "service" | "pricing" | "program"> = {
  "phase-in": "phase_in",
  "phase_out": "phase_out",
  "phase-out": "phase_out",
  "service": "service",
  "pricing": "pricing",
  "program": "program",
};

export async function importEFlashFromRows(
  rows: Array<{
    eflashId: string;
    type: string;
    division: string;
    scope: string;
    subjectEn?: string;
    subjectCn?: string;
    globalDate?: Date | null;
    chinaDate?: Date | null;
    effectiveDate?: Date | null;
    authorEn?: string;
    authorCn?: string;
    comments?: string;
  }>,
  createdBy: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: Array<{ row: number; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const normalizedType = TYPE_MAP[row.type?.toLowerCase().trim()];
      if (!normalizedType) {
        errors.push({ row: i + 3, reason: `Unknown type: ${row.type}` });
        failed++;
        continue;
      }

      const existing = await getEFlashRecordByEFlashId(row.eflashId.trim());
      const data = {
        eflashId: row.eflashId.trim(),
        type: normalizedType,
        division: row.division as "communications" | "network" | "general",
        scope: row.scope as "global" | "china",
        subjectEn: row.subjectEn || null,
        subjectCn: row.subjectCn || null,
        globalDate: row.globalDate || null,
        chinaDate: row.chinaDate || null,
        effectiveDate: row.effectiveDate || null,
        authorEn: row.authorEn || null,
        authorCn: row.authorCn || null,
        comments: row.comments || null,
        createdBy,
      };

      if (existing) {
        await db.update(eflashRecords)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(eflashRecords.id, existing.id));
        updated++;
      } else {
        await db.insert(eflashRecords).values(data);
        created++;
      }
    } catch (err) {
      errors.push({ row: i + 3, reason: String(err) });
      failed++;
    }
  }

  return { created, updated, failed, errors };
}
```

- [ ] **步骤 2：在 `server/db/index.ts` 末尾追加导出**

在文件末尾已有的 `export * from` 列表中追加：

```typescript
export * from "./eflash";
```

- [ ] **步骤 3：运行类型检查**

运行：`pnpm check`
预期：无错误

- [ ] **步骤 4：Commit**

```bash
git add server/db/eflash.ts server/db/index.ts
git commit -m "feat(eflash): add database operations module"
```

---

## 任务 4：tRPC 路由

**文件：**
- 创建：`server/routers/eflash.ts`
- 修改：`server/routers.ts`
- 修改：`server/_core/index.ts`（注册静态文件路由）

- [ ] **步骤 1：创建 `server/routers/eflash.ts`**

```typescript
import { router, protectedProcedure, permissionProcedure } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db/eflash";
import { PERMISSIONS } from "@shared/const";
import { logActivity } from "./helpers";
import XLSX from "xlsx";
import path from "path";
import fs from "fs/promises";
const EFLASH_MANAGE = PERMISSIONS.EFLASH_MANAGE;

const uploadDir = path.resolve(process.cwd(), "uploads/eflash");

export const eflashRouter = router({
  list: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(100).default(20),
      type: z.enum(["phase_in", "phase_out", "service", "pricing", "program"]).optional(),
      division: z.enum(["communications", "network", "general"]).optional(),
      scope: z.enum(["global", "china"]).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      search: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .query(async ({ input }) => {
      return db.listEFlashRecords(input);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const record = await db.getEFlashRecordById(input.id);
      if (!record) throw new Error("Record not found");
      return record;
    }),

  listTags: protectedProcedure
    .input(z.object({
      category: z.enum(["region", "product"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.listEFlashTags(input?.category);
    }),

  getStats: protectedProcedure
    .query(async () => {
      return db.getEFlashStats();
    }),

  create: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({
      eflashId: z.string().min(1).max(20),
      type: z.enum(["phase_in", "phase_out", "service", "pricing", "program"]),
      division: z.enum(["communications", "network", "general"]),
      scope: z.enum(["global", "china"]),
      subjectEn: z.string().optional(),
      subjectCn: z.string().optional(),
      globalDate: z.string().optional(),
      chinaDate: z.string().optional(),
      effectiveDate: z.string().optional(),
      authorEn: z.string().max(200).optional(),
      authorCn: z.string().max(200).optional(),
      comments: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { tagIds, ...data } = input;
      const id = await db.createEFlashRecord(
        {
          ...data,
          globalDate: data.globalDate ? new Date(data.globalDate) : null,
          chinaDate: data.chinaDate ? new Date(data.chinaDate) : null,
          effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null,
          createdBy: ctx.user.id,
        },
        tagIds
      );
      await logActivity(ctx, {
        action: "create_eflash",
        resourceType: "eflash",
        resourceId: id,
      });
      return { id };
    }),

  update: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({
      id: z.number(),
      eflashId: z.string().min(1).max(20).optional(),
      type: z.enum(["phase_in", "phase_out", "service", "pricing", "program"]).optional(),
      division: z.enum(["communications", "network", "general"]).optional(),
      scope: z.enum(["global", "china"]).optional(),
      subjectEn: z.string().optional(),
      subjectCn: z.string().optional(),
      globalDate: z.string().optional(),
      chinaDate: z.string().optional(),
      effectiveDate: z.string().optional(),
      authorEn: z.string().max(200).optional(),
      authorCn: z.string().max(200).optional(),
      comments: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, tagIds, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (data.globalDate !== undefined) updateData.globalDate = data.globalDate ? new Date(data.globalDate) : null;
      if (data.chinaDate !== undefined) updateData.chinaDate = data.chinaDate ? new Date(data.chinaDate) : null;
      if (data.effectiveDate !== undefined) updateData.effectiveDate = data.effectiveDate ? new Date(data.effectiveDate) : null;

      await db.updateEFlashRecord(id, updateData, tagIds);
      await logActivity(ctx, {
        action: "update_eflash",
        resourceType: "eflash",
        resourceId: id,
      });
      return { id };
    }),

  delete: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteEFlashRecord(input.id);
      await logActivity(ctx, {
        action: "delete_eflash",
        resourceType: "eflash",
        resourceId: input.id,
      });
      return { success: true };
    }),

  importExcel: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({
      fileBase64: z.string().max(50_000_000),
      sheetNames: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });

      const defaultSheets = ["China", "NET Global", "COMM Global"];
      const targetSheets = input.sheetNames?.length ? input.sheetNames : defaultSheets;

      const allRows: Array<{
        eflashId: string;
        type: string;
        division: string;
        scope: string;
        subjectEn?: string;
        subjectCn?: string;
        globalDate?: Date | null;
        chinaDate?: Date | null;
        effectiveDate?: Date | null;
        authorEn?: string;
        authorCn?: string;
        comments?: string;
      }> = [];

      for (const sheetName of targetSheets) {
        const ws = workbook.Sheets[sheetName];
        if (!ws) continue;

        const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
        // Skip title row (0) and header row (1)
        for (let i = 2; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 2) continue;

          const eflashId = String(row[3] || "").trim();
          if (!eflashId || !eflashId.startsWith("EF-")) continue;

          const typeStr = String(row[1] || "").trim();
          const prefix = eflashId.match(/^EF-([A-Z])/)?.[1] || "";

          // Derive division and scope from prefix
          let division = "general";
          let scope = "global";
          if (prefix === "Z") {
            scope = "china";
            division = String(row[0] || "").toLowerCase().includes("network") ? "network" : "communications";
          } else if (prefix === "N") {
            division = "network";
            scope = "global";
          } else if (prefix === "C") {
            division = "communications";
            scope = "global";
          } else if (prefix === "S" || prefix === "P") {
            division = String(row[0] || "").toLowerCase().includes("network") ? "network" : "general";
            scope = "global";
          }

          // Parse dates (Excel serial numbers or strings)
          const parseDate = (val: unknown): Date | null => {
            if (val == null || val === "" || val === "－" || val === "-") return null;
            if (typeof val === "number") {
              // Excel serial date
              const date = XLSX.SSF.parse_date_code(val);
              if (date) return new Date(date.y, date.m - 1, date.d);
              return null;
            }
            const str = String(val).trim().replace(/^\s+/, "");
            if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(str)) return new Date(str);
            if (/^\d{2}[/-]\d{1,2}[/-]\d{2,4}$/.test(str)) {
              const parts = str.split(/[/-]/);
              const d = parts[0].length === 2 ? `20${parts[0]}-${parts[1]}-${parts[2]}` : str;
              return new Date(d);
            }
            return null;
          };

          allRows.push({
            eflashId,
            type: typeStr,
            division,
            scope,
            subjectEn: String(row[4] || "").trim() || undefined,
            subjectCn: String(row[5] || "").trim() || undefined,
            globalDate: parseDate(row[6]),
            chinaDate: parseDate(row[7]),
            effectiveDate: parseDate(row[8]),
            authorEn: String(row[9] || "").trim() || undefined,
            authorCn: String(row[10] || "").trim() || undefined,
            comments: String(row[11] || "").trim() || undefined,
          });
        }
      }

      const result = await db.importEFlashFromRows(allRows, ctx.user.id);
      await logActivity(ctx, {
        action: "import_eflash",
        resourceType: "eflash",
        detail: `Created: ${result.created}, Updated: ${result.updated}, Failed: ${result.failed}`,
      });
      return result;
    }),

  uploadAttachment: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({
      recordId: z.number(),
      fileName: z.string().max(500),
      fileBase64: z.string().max(50_000_000),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify record exists
      const record = await db.getEFlashRecordById(input.recordId);
      if (!record) throw new Error("Record not found");

      const recordDir = path.join(uploadDir, record.eflashId);
      await fs.mkdir(recordDir, { recursive: true });

      const filePath = path.join(recordDir, input.fileName);
      const buffer = Buffer.from(input.fileBase64, "base64");
      await fs.writeFile(filePath, buffer);

      const id = await db.createAttachment({
        recordId: input.recordId,
        fileName: input.fileName,
        filePath,
        fileSize: buffer.length,
        uploadedBy: ctx.user.id,
      });

      return { id };
    }),

  deleteAttachment: permissionProcedure(EFLASH_MANAGE)
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteAttachment(input.id);
      await logActivity(ctx, {
        action: "delete_eflash_attachment",
        resourceType: "eflash_attachment",
        resourceId: input.id,
      });
      return { success: true };
    }),
});
```

- [ ] **步骤 2：在 `server/routers.ts` 注册 eflashRouter**

在文件顶部 import 区添加：

```typescript
import { eflashRouter } from "./routers/eflash";
```

在 `appRouter` 对象内添加：

```typescript
eflash: eflashRouter,
```

- [ ] **步骤 3：在 `server/_core/index.ts` 注册 uploads 静态路由**

在 `createServer` 函数内，在 tRPC 中间件注册之后、端口绑定之前添加：

```typescript
// Serve eFlash uploaded files
import path from "path";
app.use("/uploads/eflash", (req, res, next) => {
  const uploadsPath = path.resolve(process.cwd(), "uploads/eflash");
  require("express").static(uploadsPath)(req, res, next);
});
```

- [ ] **步骤 4：运行类型检查**

运行：`pnpm check`
预期：无错误。如果有 multer 类型缺失，运行 `pnpm add -D @types/multer`

- [ ] **步骤 5：Commit**

```bash
git add server/routers/eflash.ts server/routers.ts server/_core/index.ts
git commit -m "feat(eflash): add tRPC router with Excel import and PDF upload"
```

---

## 任务 5：i18n 翻译

**文件：**
- 修改：`client/src/i18n/locales/zh.json`
- 修改：`client/src/i18n/locales/en.json`
- 修改：`client/src/i18n/locales/zh-TW.json`
- 修改：`client/src/i18n/locales/ja.json`
- 修改：`client/src/i18n/locales/es.json`
- 修改：`client/src/i18n/locales/fr.json`

- [ ] **步骤 1：在 `zh.json` 添加 eflash 翻译键**

在 JSON 根级别添加 `"eflash"` 键：

```json
"eflash": {
  "title": "eFlash 管理",
  "description": "产品通知文档管理",
  "fields": {
    "eflashId": "eFlash 编号",
    "type": "类型",
    "division": "产品线",
    "scope": "范围",
    "subjectEn": "英文标题",
    "subjectCn": "中文标题",
    "globalDate": "全球发布日期",
    "chinaDate": "中国发布日期",
    "effectiveDate": "生效日期",
    "authorEn": "英文版作者",
    "authorCn": "中文版译者/作者",
    "comments": "备注",
    "tags": "标签",
    "attachments": "附件",
    "createdAt": "创建时间"
  },
  "types": {
    "phase_in": "Phase-in",
    "phase_out": "Phase-out",
    "service": "Service",
    "pricing": "Pricing",
    "program": "Program"
  },
  "divisions": {
    "communications": "语音产品",
    "network": "网络产品",
    "general": "通用"
  },
  "scopes": {
    "global": "全球",
    "china": "中国"
  },
  "tagCategories": {
    "region": "地区",
    "product": "产品/系列"
  },
  "filters": {
    "allTypes": "全部类型",
    "allDivisions": "全部产品线",
    "allScopes": "全部范围",
    "dateRange": "生效日期范围",
    "searchPlaceholder": "搜索编号或标题..."
  },
  "actions": {
    "create": "新建",
    "edit": "编辑",
    "delete": "删除",
    "viewDetail": "查看详情",
    "importExcel": "导入 Excel",
    "uploadPdf": "上传 PDF"
  },
  "import": {
    "title": "导入 eFlash 数据",
    "dragHint": "拖拽 Excel 文件到此处，或点击选择",
    "selectSheets": "选择要导入的 Sheet",
    "result": "导入完成：新建 {created} 条，更新 {updated} 条，失败 {failed} 条",
    "noFile": "请选择文件",
    "fileTooLarge": "文件大小不能超过 10MB",
    "invalidFileType": "请选择 Excel 文件（.xlsx 或 .xls）"
  },
  "form": {
    "createTitle": "新建 eFlash 记录",
    "editTitle": "编辑 eFlash 记录",
    "saveSuccess": "保存成功",
    "deleteConfirm": "确定删除此记录？关联的附件也会被删除。",
    "validation": {
      "eflashIdRequired": "请输入 eFlash 编号",
      "eflashIdFormat": "编号格式：EF-X###，如 EF-Z001",
      "typeRequired": "请选择类型"
    }
  },
  "detail": {
    "title": "eFlash 详情",
    "noAttachments": "暂无附件",
    "download": "下载"
  },
  "recent": {
    "title": "近期 eFlash",
    "viewAll": "查看全部",
    "count": "近 30 天共 {count} 条"
  },
  "table": {
    "empty": "暂无 eFlash 记录"
  }
}
```

- [ ] **步骤 2：在 `en.json` 添加 eflash 翻译键**

```json
"eflash": {
  "title": "eFlash Management",
  "description": "Product notification document management",
  "fields": {
    "eflashId": "eFlash ID",
    "type": "Type",
    "division": "Division",
    "scope": "Scope",
    "subjectEn": "Subject (EN)",
    "subjectCn": "Subject (CN)",
    "globalDate": "Global Date",
    "chinaDate": "China Date",
    "effectiveDate": "Effective Date",
    "authorEn": "Author (EN)",
    "authorCn": "Translator (CN)",
    "comments": "Comments",
    "tags": "Tags",
    "attachments": "Attachments",
    "createdAt": "Created"
  },
  "types": {
    "phase_in": "Phase-in",
    "phase_out": "Phase-out",
    "service": "Service",
    "pricing": "Pricing",
    "program": "Program"
  },
  "divisions": {
    "communications": "Communications",
    "network": "Network",
    "general": "General"
  },
  "scopes": {
    "global": "Global",
    "china": "China"
  },
  "tagCategories": {
    "region": "Region",
    "product": "Product/Series"
  },
  "filters": {
    "allTypes": "All Types",
    "allDivisions": "All Divisions",
    "allScopes": "All Scopes",
    "dateRange": "Effective Date Range",
    "searchPlaceholder": "Search ID or subject..."
  },
  "actions": {
    "create": "New",
    "edit": "Edit",
    "delete": "Delete",
    "viewDetail": "View Detail",
    "importExcel": "Import Excel",
    "uploadPdf": "Upload PDF"
  },
  "import": {
    "title": "Import eFlash Data",
    "dragHint": "Drag Excel file here, or click to select",
    "selectSheets": "Select sheets to import",
    "result": "Import completed: {created} created, {updated} updated, {failed} failed",
    "noFile": "Please select a file",
    "fileTooLarge": "File size must not exceed 10MB",
    "invalidFileType": "Please select an Excel file (.xlsx or .xls)"
  },
  "form": {
    "createTitle": "New eFlash Record",
    "editTitle": "Edit eFlash Record",
    "saveSuccess": "Saved successfully",
    "deleteConfirm": "Are you sure to delete this record? Associated attachments will also be deleted.",
    "validation": {
      "eflashIdRequired": "eFlash ID is required",
      "eflashIdFormat": "Format: EF-X###, e.g. EF-Z001",
      "typeRequired": "Type is required"
    }
  },
  "detail": {
    "title": "eFlash Detail",
    "noAttachments": "No attachments",
    "download": "Download"
  },
  "recent": {
    "title": "Recent eFlash",
    "viewAll": "View All",
    "count": "{count} records in last 30 days"
  },
  "table": {
    "empty": "No eFlash records"
  }
}
```

- [ ] **步骤 3：在其余 4 个 locale 文件添加翻译**

对 `zh-TW.json`、`ja.json`、`es.json`、`fr.json` 分别添加对应的翻译。中文繁体参考 zh.json，日文/西班牙文/法文参考 en.json 进行翻译。

- [ ] **步骤 4：在每个 locale 文件的 `menu` 键内添加 eFlash 菜单项**

在 `menu` 对象内添加：

- zh: `"eflash": "eFlash 管理"`
- en: `"eflash": "eFlash"`
- zh-TW: `"eflash": "eFlash 管理"`
- ja: `"eflash": "eFlash管理"`
- es: `"eflash": "eFlash"`
- fr: `"eflash": "eFlash"`

- [ ] **步骤 5：Commit**

```bash
git add client/src/i18n/locales/
git commit -m "feat(eflash): add i18n translations for all 6 locales"
```

---

## 任务 6：前端页面和组件

**文件：**
- 创建：`client/src/pages/EFlashPage.tsx`
- 创建：`client/src/components/eflash/EFlashTable.tsx`
- 创建：`client/src/components/eflash/EFlashDetailSheet.tsx`
- 创建：`client/src/components/eflash/EFlashFormDialog.tsx`
- 创建：`client/src/components/eflash/EFlashImportDialog.tsx`

- [ ] **步骤 1：创建 `EFlashTable.tsx`**

表格组件，接收 data/canManage/onViewDetail/onEdit/onDelete props。列定义：eflashId、type（badge 颜色）、division、scope、subjectCn（截断）、effectiveDate、tags（小 badge 列表）、操作列（Eye + Edit + Trash2 图标按钮）。

使用 `useTableFeatures` hook 和 `ColumnDef` 接口，与 `CertificationTable.tsx` 模式一致。排序用客户端排序。标签列用 badge 展示，最多显示 2 个 + "+N" 溢出指示。

- [ ] **步骤 2：创建 `EFlashDetailSheet.tsx`**

使用 shadcn `Sheet` 组件（从 `@/components/ui/sheet` 导入）。右侧滑出，展示记录的全部字段。标签区域用 badge 展示。附件区域列出文件名 + 下载链接。底部有「编辑」按钮。

- [ ] **步骤 3：创建 `EFlashFormDialog.tsx`**

使用 shadcn `Dialog` 组件。包含 eflashId 输入框（格式校验 `/^EF-[A-Z]\d+$/`）、type/division/scope 下拉选择、subjectEn/subjectCn 文本域、3 个日期选择器（使用 `<Input type="date">`）、authorEn/authorCn 输入框、标签多选（Popover + Command 组件）、备注文本域。

标签多选交互：点击输入框弹出 Popover，内含搜索框和标签列表。选中的标签在输入框内以 badge 展示。底部有「新建标签」按钮。

编辑模式时先通过 `trpc.eflash.getById.useQuery(editId)` 加载已有数据。

- [ ] **步骤 4：创建 `EFlashImportDialog.tsx`**

使用 shadcn `Dialog` 组件。包含文件拖拽上传区域（接受 .xlsx/.xls）、Sheet 选择复选框（从 Excel 读取 sheet 名称）、导入结果展示。与 `CertificationImportDialog.tsx` 模式一致。

- [ ] **步骤 5：创建 `EFlashPage.tsx`**

页面容器组件，结构参考 `CertificationsPage.tsx`：
- 顶部：标题 + 计数 badge + 新建按钮 + 导入按钮
- 筛选栏：类型下拉、产品线下拉、范围下拉、日期范围选择器、搜索框
- 表格区域：`<EFlashTable />` 组件
- 分页：`<TablePagination />` 组件
- 对话框：`<EFlashFormDialog />`、`<EFlashImportDialog />`、`<EFlashDetailSheet />`

- [ ] **步骤 6：运行类型检查**

运行：`pnpm check`
预期：无错误

- [ ] **步骤 7：Commit**

```bash
git add client/src/pages/EFlashPage.tsx client/src/components/eflash/
git commit -m "feat(eflash): add frontend page and components"
```

---

## 任务 7：路由和导航集成

**文件：**
- 修改：`client/src/App.tsx`
- 修改：`client/src/components/DashboardLayout.tsx`

- [ ] **步骤 1：在 `App.tsx` 添加路由**

在 import 区添加：

```typescript
const EFlashPage = lazy(() => import("@/pages/EFlashPage"));
```

在 DashboardLayout 内的 Route 列表中（`certifications` 路由之后）添加：

```tsx
<Route path="/eflash" component={EFlashPage} />
```

- [ ] **步骤 2：在 `DashboardLayout.tsx` 添加侧边栏菜单项**

在 lucide-react import 中添加 `Megaphone` 图标。

在 `menuItems` 数组中（`certifications` 条目之后）添加：

```typescript
{ icon: Megaphone, labelKey: "menu.eflash", path: "/eflash" },
```

注意：eFlash 不设置 permission，所有登录用户可见。

- [ ] **步骤 3：运行 `pnpm dev` 验证页面可访问**

运行：`pnpm dev`
预期：侧边栏出现「eFlash」菜单项，点击可访问 `/eflash` 页面

- [ ] **步骤 4：Commit**

```bash
git add client/src/App.tsx client/src/components/DashboardLayout.tsx
git commit -m "feat(eflash): add route and sidebar navigation"
```

---

## 任务 8：Dashboard 集成

**文件：**
- 创建：`client/src/components/eflash/RecentEFlashCard.tsx`
- 修改：`client/src/pages/Home.tsx`

- [ ] **步骤 1：创建 `RecentEFlashCard.tsx`**

参考 `ExpiringCertsCard.tsx` 模式。使用 `trpc.eflash.list.useQuery({ pageSize: 5 })` 获取最新 5 条记录。卡片包含标题「近期 eFlash」、统计数、5 条记录的简要列表（eflashId + type badge + subjectCn 截断），底部「查看全部」按钮跳转 `/eflash`。

- [ ] **步骤 2：在 `Home.tsx` 中引入卡片**

在 import 区添加：

```typescript
import { RecentEFlashCard } from "@/components/eflash/RecentEFlashCard";
```

在 `<ExpiringCertsCard />` 之后添加：

```tsx
<RecentEFlashCard />
```

- [ ] **步骤 3：Commit**

```bash
git add client/src/components/eflash/RecentEFlashCard.tsx client/src/pages/Home.tsx
git commit -m "feat(eflash): add recent eFlash card to dashboard"
```

---

## 任务 9：端到端验证

- [ ] **步骤 1：运行类型检查**

运行：`pnpm check`
预期：0 errors

- [ ] **步骤 2：运行测试**

运行：`pnpm test`
预期：所有现有测试通过

- [ ] **步骤 3：启动 dev server 手动验证**

运行：`pnpm dev`

验证清单：
1. 侧边栏显示「eFlash」菜单项
2. 点击进入 `/eflash` 页面，筛选栏正常渲染
3. 点击「新建」打开表单对话框
4. 填写表单并保存，列表中出现新记录
5. 点击眼睛图标，右侧抽屉展示详情
6. 点击「导入 Excel」，上传 `G:\市场部\eFlash\China-eFlash-tracking-sheetlist.xlsx`
7. 选择 Sheet 后导入，检查导入结果
8. 搜索框输入关键词，筛选正常
9. 类型/产品线/范围下拉筛选正常
10. 仪表盘首页显示「近期 eFlash」卡片

- [ ] **步骤 4：最终 Commit**

```bash
git add -A
git commit -m "feat(eflash): complete eFlash management module"
```
