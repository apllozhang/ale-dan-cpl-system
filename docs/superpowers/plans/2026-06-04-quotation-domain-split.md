# Quotation 模块分层重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `server/db/quotations.ts`（596 行）和 `server/routers/quotations.ts`（296 行）拆分为 7 个职责单一的文件，每个不超过 250 行。

**架构：** 新建 `server/domain/quotations/` 目录，按 types → repo → analytics → versioning → policy → service → router 顺序逐层拆分。`server/db/quotations.ts` 变为 re-export 兼容层。修复 update 的 subtotal 计算 bug。

**技术栈：** TypeScript、Drizzle ORM、tRPC、Vitest

---

## 文件结构

| 新文件 | 职责 | 来源 |
|--------|------|------|
| `server/domain/quotations/quotation.types.ts` | 类型/接口定义 | 从 `server/db/quotations.ts:10-81` 提取 |
| `server/domain/quotations/quotation.repo.ts` | DB CRUD 操作 | 从 `server/db/quotations.ts:83-396` 提取 |
| `server/domain/quotations/quotation.analytics.ts` | 统计分析查询 | 从 `server/db/quotations.ts:399-595` 提取 |
| `server/domain/quotations/quotation.versioning.ts` | 版本快照 + diff | 从 `server/db/quotations.ts:256-365` 拆出 |
| `server/domain/quotations/quotation.policy.ts` | 权限判断 | 从 `server/routers/quotations.ts` 的 6 处重复权限检查提取 |
| `server/domain/quotations/quotation.service.ts` | 业务编排 | 新建，编排 repo/policy/versioning |
| `server/domain/quotations/quotation.router.ts` | 薄 tRPC 壳 | 从 `server/routers/quotations.ts` 瘦身 |

---

## 任务 1：创建目录和 quotation.types.ts

**文件：**
- 创建：`server/domain/quotations/quotation.types.ts`
- 创建：`server/domain/quotations/index.ts`

- [ ] **步骤 1：创建目录结构**

```bash
mkdir -p server/domain/quotations/__tests__
```

- [ ] **步骤 2：创建 quotation.types.ts**

从 `server/db/quotations.ts:10-81` 提取所有类型定义。文件内容：

```ts
// server/domain/quotations/quotation.types.ts
import type { Quotation, QuotationItem } from "../../../drizzle/schema";

export type QuotationStatus = typeof import("../../../drizzle/schema").quotations.$inferSelect.status;

export type QuotationListItem = Pick<Quotation, "id" | "quotationNo" | "customerName" | "customerContact" | "customerPhone" | "customerEmail" | "industry" | "projectName" | "status" | "discountRate" | "totalAmount" | "notes" | "createdBy" | "validUntil" | "createdAt" | "updatedAt"> & {
  creatorName: string | null;
  creatorUsername: string | null;
};

export type QuotationDetail = QuotationListItem & {
  version: number;
  shareToken: string | null;
  items: QuotationItem[];
};

export type RecentQuotation = Pick<Quotation, "id" | "quotationNo" | "customerName" | "customerContact" | "projectName" | "status" | "totalAmount" | "createdAt" | "updatedAt">;

export interface AnalyticsSummary {
  totalQuotations: number;
  completedRevenue: number;
  avgAmount: number;
  conversionRate: number;
}

export interface IndustryRow {
  industry: string;
  count: number | string;
  totalAmount: number | string;
}

export interface CustomerRow {
  customerName: string;
  industry: string;
  count: number | string;
  totalAmount: number | string;
}

export interface SalesRepRow {
  repName: string;
  count: number | string;
  totalAmount: number | string;
  completedCount: number | string;
  submittedCount: number | string;
}

export interface TimeRow {
  month: string;
  count: number | string;
  totalAmount: number | string;
}

export interface StatusRow {
  status: string;
  count: number | string;
  totalAmount: number | string;
}

export interface TopProductRow {
  productModel: string;
  productDesc: string | null;
  quotationCount: number | string;
  totalQuantity: number | string;
  totalRevenue: number | string;
}

export interface QuotationAnalytics {
  summary: AnalyticsSummary;
  byIndustry: IndustryRow[];
  byCustomer: CustomerRow[];
  bySalesRep: SalesRepRow[];
  byTime: TimeRow[];
  byStatus: StatusRow[];
  topProducts: TopProductRow[];
}
```

- [ ] **步骤 3：创建 index.ts re-export**

```ts
// server/domain/quotations/index.ts
export * from "./quotation.types";
```

- [ ] **步骤 4：验证 TypeScript 编译**

运行：`pnpm check`
预期：0 errors（新文件尚未被引用，不影响现有代码）

- [ ] **步骤 5：Commit**

```bash
git add server/domain/quotations/
git commit -m "feat: create quotation.types.ts with all type definitions"
```

---

## 任务 2：创建 quotation.policy.ts

**文件：**
- 创建：`server/domain/quotations/quotation.policy.ts`
- 测试：`server/domain/quotations/__tests__/quotation.policy.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
// server/domain/quotations/__tests__/quotation.policy.test.ts
import { describe, it, expect } from "vitest";
import { canReadQuotation, canEditQuotation, canDeleteQuotation } from "../quotation.policy";

type User = { id: number; role: string; isSuperAdmin: boolean };
type Quotation = { id: number; createdBy: number; status: string };

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 1, role: "user", isSuperAdmin: false, ...overrides };
}

function makeQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return { id: 100, createdBy: 1, status: "draft", ...overrides };
}

describe("quotation.policy", () => {
  describe("canReadQuotation", () => {
    it("allows owner to read own quotation", () => {
      expect(canReadQuotation(makeUser({ id: 1 }), makeQuotation({ createdBy: 1 }))).toBe(true);
    });

    it("blocks non-owner from reading", () => {
      expect(canReadQuotation(makeUser({ id: 2 }), makeQuotation({ createdBy: 1 }))).toBe(false);
    });

    it("allows admin to read any quotation", () => {
      expect(canReadQuotation(makeUser({ role: "admin" }), makeQuotation({ createdBy: 999 }))).toBe(true);
    });

    it("allows sales_manager to read any quotation", () => {
      expect(canReadQuotation(makeUser({ role: "sales_manager" }), makeQuotation({ createdBy: 999 }))).toBe(true);
    });

    it("allows superAdmin to read any quotation", () => {
      expect(canReadQuotation(makeUser({ isSuperAdmin: true }), makeQuotation({ createdBy: 999 }))).toBe(true);
    });
  });

  describe("canEditQuotation", () => {
    it("allows owner to edit own quotation", () => {
      expect(canEditQuotation(makeUser({ id: 1 }), makeQuotation({ createdBy: 1 }))).toBe(true);
    });

    it("blocks non-owner from editing", () => {
      expect(canEditQuotation(makeUser({ id: 2 }), makeQuotation({ createdBy: 1 }))).toBe(false);
    });

    it("allows admin to edit any quotation", () => {
      expect(canEditQuotation(makeUser({ role: "admin" }), makeQuotation({ createdBy: 999 }))).toBe(true);
    });
  });

  describe("canDeleteQuotation", () => {
    it("allows owner to delete own quotation", () => {
      expect(canDeleteQuotation(makeUser({ id: 1 }), makeQuotation({ createdBy: 1 }))).toBe(true);
    });

    it("blocks non-owner from deleting", () => {
      expect(canDeleteQuotation(makeUser({ id: 2 }), makeQuotation({ createdBy: 1 }))).toBe(false);
    });

    it("allows admin to delete any quotation", () => {
      expect(canDeleteQuotation(makeUser({ role: "admin" }), makeQuotation({ createdBy: 999 }))).toBe(true);
    });
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm vitest run server/domain/quotations/__tests__/quotation.policy.test.ts`
预期：FAIL，报错 "Cannot find module '../quotation.policy'"

- [ ] **步骤 3：编写实现**

```ts
// server/domain/quotations/quotation.policy.ts
import { TRPCError } from "@trpc/server";

interface UserLike {
  id: number;
  role: string;
  isSuperAdmin: boolean;
}

interface QuotationLike {
  id: number;
  createdBy: number;
  status: string;
}

export function isManagerOrAdmin(user: UserLike): boolean {
  return user.isSuperAdmin || user.role === "admin" || user.role === "sales_manager";
}

export function canReadQuotation(user: UserLike, quotation: QuotationLike): boolean {
  if (isManagerOrAdmin(user)) return true;
  return quotation.createdBy === user.id;
}

export function canEditQuotation(user: UserLike, quotation: QuotationLike): boolean {
  if (isManagerOrAdmin(user)) return true;
  return quotation.createdBy === user.id;
}

export function canDeleteQuotation(user: UserLike, quotation: QuotationLike): boolean {
  if (isManagerOrAdmin(user)) return true;
  return quotation.createdBy === user.id;
}

export function assertCanReadQuotation(user: UserLike, quotation: QuotationLike): void {
  if (!canReadQuotation(user, quotation)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
  }
}

export function assertCanEditQuotation(user: UserLike, quotation: QuotationLike): void {
  if (!canEditQuotation(user, quotation)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
  }
}

export function assertCanDeleteQuotation(user: UserLike, quotation: QuotationLike): void {
  if (!canDeleteQuotation(user, quotation)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm vitest run server/domain/quotations/__tests__/quotation.policy.test.ts`
预期：PASS（9 tests）

- [ ] **步骤 5：Commit**

```bash
git add server/domain/quotations/quotation.policy.ts server/domain/quotations/__tests__/quotation.policy.test.ts
git commit -m "feat: add quotation.policy.ts with authorization checks and tests"
```

---

## 任务 3：创建 quotation.versioning.ts

**文件：**
- 创建：`server/domain/quotations/quotation.versioning.ts`
- 测试：`server/domain/quotations/__tests__/quotation.versioning.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
// server/domain/quotations/__tests__/quotation.versioning.test.ts
import { describe, it, expect } from "vitest";
import { computeItemDiff, buildChangeSummary } from "../quotation.versioning";

describe("quotation.versioning", () => {
  describe("computeItemDiff", () => {
    it("detects added items", () => {
      const oldItems = [{ productModel: "A", quantity: 1, discountRate: 0 }];
      const newItems = [
        { productModel: "A", quantity: 1, discountRate: 0 },
        { productModel: "B", quantity: 2, discountRate: 10 },
      ];
      const diff = computeItemDiff(oldItems, newItems);
      expect(diff.added).toEqual(["B"]);
      expect(diff.removed).toEqual([]);
      expect(diff.modified).toEqual([]);
    });

    it("detects removed items", () => {
      const oldItems = [
        { productModel: "A", quantity: 1, discountRate: 0 },
        { productModel: "B", quantity: 2, discountRate: 10 },
      ];
      const newItems = [{ productModel: "A", quantity: 1, discountRate: 0 }];
      const diff = computeItemDiff(oldItems, newItems);
      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual(["B"]);
      expect(diff.modified).toEqual([]);
    });

    it("detects modified items (quantity change)", () => {
      const oldItems = [{ productModel: "A", quantity: 1, discountRate: 0 }];
      const newItems = [{ productModel: "A", quantity: 5, discountRate: 0 }];
      const diff = computeItemDiff(oldItems, newItems);
      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
      expect(diff.modified).toEqual(["A"]);
    });

    it("detects modified items (discount change)", () => {
      const oldItems = [{ productModel: "A", quantity: 1, discountRate: 0 }];
      const newItems = [{ productModel: "A", quantity: 1, discountRate: 20 }];
      const diff = computeItemDiff(oldItems, newItems);
      expect(diff.modified).toEqual(["A"]);
    });

    it("handles empty arrays", () => {
      const diff = computeItemDiff([], []);
      expect(diff).toEqual({ added: [], removed: [], modified: [] });
    });
  });

  describe("buildChangeSummary", () => {
    it("generates summary for item changes", () => {
      const oldData = { customerName: "Old", projectName: "Old Project", status: "draft" };
      const newData = { customerName: "Old", projectName: "Old Project", status: "draft" };
      const itemDiff = { added: ["B"], removed: ["C"], modified: ["A"] };
      const summary = buildChangeSummary(oldData, newData, itemDiff);
      expect(summary).toContain("+1项: B");
      expect(summary).toContain("-1项: C");
      expect(summary).toContain("改1项: A");
    });

    it("generates summary for field changes", () => {
      const oldData = { customerName: "Old", projectName: "Old Project", status: "draft" };
      const newData = { customerName: "New", projectName: "Old Project", status: "draft" };
      const itemDiff = { added: [], removed: [], modified: [] };
      const summary = buildChangeSummary(oldData, newData, itemDiff);
      expect(summary).toContain("客户名称变更");
    });

    it("generates summary for status change", () => {
      const oldData = { customerName: "A", projectName: "B", status: "draft" };
      const newData = { customerName: "A", projectName: "B", status: "submitted" };
      const itemDiff = { added: [], removed: [], modified: [] };
      const summary = buildChangeSummary(oldData, newData, itemDiff);
      expect(summary).toContain("状态→submitted");
    });

    it("returns '信息更新' when no changes", () => {
      const oldData = { customerName: "A", projectName: "B", status: "draft" };
      const newData = { customerName: "A", projectName: "B", status: "draft" };
      const itemDiff = { added: [], removed: [], modified: [] };
      const summary = buildChangeSummary(oldData, newData, itemDiff);
      expect(summary).toBe("信息更新");
    });
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm vitest run server/domain/quotations/__tests__/quotation.versioning.test.ts`
预期：FAIL，报错 "Cannot find module '../quotation.versioning'"

- [ ] **步骤 3：编写实现**

```ts
// server/domain/quotations/quotation.versioning.ts
import { eq } from "drizzle-orm";
import { quotations, quotationItems, quotationVersions } from "../../../drizzle/schema";
import type { MySqlTransaction } from "drizzle-orm/mysql-core";

interface ItemForDiff {
  productModel: string;
  quantity: number | string;
  discountRate?: number | string | null;
}

export interface ItemDiffResult {
  added: string[];
  removed: string[];
  modified: string[];
}

export function computeItemDiff(oldItems: ItemForDiff[], newItems: ItemForDiff[]): ItemDiffResult {
  const oldItemMap = new Map(oldItems.map(it => [it.productModel, it]));
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const ni of newItems) {
    const oi = oldItemMap.get(ni.productModel);
    if (!oi) {
      added.push(ni.productModel);
    } else {
      if (Number(oi.quantity) !== Number(ni.quantity) || Number(oi.discountRate ?? 0) !== Number(ni.discountRate ?? 0)) {
        modified.push(ni.productModel);
      }
    }
  }

  const newItemSet = new Set(newItems.map(it => it.productModel));
  for (const oi of oldItems) {
    if (!newItemSet.has(oi.productModel)) removed.push(oi.productModel);
  }

  return { added, removed, modified };
}

export function buildChangeSummary(
  oldData: { customerName: string | null; projectName: string | null; status: string },
  newData: { customerName?: string | null; projectName?: string | null; status?: string },
  itemDiff: ItemDiffResult
): string {
  const changes: string[] = [];
  const { added, removed, modified } = itemDiff;

  if (added.length > 0) changes.push(`+${added.length}项: ${added.slice(0, 3).join(", ")}${added.length > 3 ? "..." : ""}`);
  if (removed.length > 0) changes.push(`-${removed.length}项: ${removed.slice(0, 3).join(", ")}${removed.length > 3 ? "..." : ""}`);
  if (modified.length > 0) changes.push(`改${modified.length}项: ${modified.slice(0, 3).join(", ")}${modified.length > 3 ? "..." : ""}`);
  if (newData.customerName && newData.customerName !== oldData.customerName) changes.push("客户名称变更");
  if (newData.projectName && newData.projectName !== oldData.projectName) changes.push("项目名称变更");
  if (newData.status && newData.status !== oldData.status) changes.push(`状态→${newData.status}`);

  return changes.length > 0 ? changes.join("; ") : "信息更新";
}

export async function createVersionSnapshot(
  tx: MySqlTransaction<any, any, any, any>,
  quotationId: number,
  oldQuotation: { version: number; totalAmount: string | null },
  snapshotData: {
    items: Array<Record<string, unknown>>;
    totalAmount: string | null;
    changeSummary: string;
    diff: ItemDiffResult;
  },
  userId: number
): Promise<void> {
  const newVersion = (oldQuotation.version ?? 1) + 1;
  const snapshot = JSON.stringify(snapshotData);

  await tx.update(quotations).set({ version: newVersion }).where(eq(quotations.id, quotationId));
  await tx.insert(quotationVersions).values({
    quotationId,
    version: newVersion,
    snapshot,
    createdBy: userId,
  });
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm vitest run server/domain/quotations/__tests__/quotation.versioning.test.ts`
预期：PASS（9 tests）

- [ ] **步骤 5：Commit**

```bash
git add server/domain/quotations/quotation.versioning.ts server/domain/quotations/__tests__/quotation.versioning.test.ts
git commit -m "feat: add quotation.versioning.ts with diff computation and tests"
```

---

## 任务 4：创建 quotation.repo.ts

**文件：**
- 创建：`server/domain/quotations/quotation.repo.ts`
- 修改：`server/domain/quotations/index.ts`

从 `server/db/quotations.ts:83-396` 提取所有 DB 操作函数。拆分 `updateQuotation` 为 `updateQuotationFields` + `replaceQuotationItems`。

- [ ] **步骤 1：编写 quotation.repo.ts**

```ts
// server/domain/quotations/quotation.repo.ts
import { eq, like, or, and, sql, asc, desc, inArray } from "drizzle-orm";
import {
  quotations, quotationItems, InsertQuotation, InsertQuotationItem,
  quotationVersions, users, Quotation, QuotationItem,
} from "../../../drizzle/schema";
import { requireDb } from "../../db/index";
import type { QuotationStatus, QuotationListItem, QuotationDetail } from "./quotation.types";

export async function getQuotations(params: {
  search?: string;
  status?: QuotationStatus | "all";
  createdBy?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<{ items: QuotationListItem[]; total: number }> {
  const db = await requireDb();
  const { search, status, createdBy, page = 1, pageSize = 20, sortBy = "createdAt", sortOrder = "desc" } = params;

  const conditions = [];
  if (search) {
    conditions.push(or(
      like(quotations.customerName, `%${search}%`),
      like(quotations.quotationNo, `%${search}%`),
      like(quotations.projectName, `%${search}%`),
    ));
  }
  if (status && status !== "all") {
    conditions.push(eq(quotations.status, status));
  }
  if (createdBy !== undefined) {
    conditions.push(eq(quotations.createdBy, createdBy));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = sortBy === "quotationNo" ? quotations.quotationNo
    : sortBy === "customerName" ? quotations.customerName
    : sortBy === "totalAmount" ? quotations.totalAmount
    : sortBy === "status" ? quotations.status
    : quotations.createdAt;
  const orderFn = sortOrder === "asc" ? asc : desc;

  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(quotations).where(where);
  const total = Number(countResult?.count ?? 0);

  const rows = await db.select({
    id: quotations.id, quotationNo: quotations.quotationNo,
    customerName: quotations.customerName, customerContact: quotations.customerContact,
    customerPhone: quotations.customerPhone, customerEmail: quotations.customerEmail,
    industry: quotations.industry, projectName: quotations.projectName,
    status: quotations.status, discountRate: quotations.discountRate,
    totalAmount: quotations.totalAmount, notes: quotations.notes,
    createdBy: quotations.createdBy, validUntil: quotations.validUntil,
    createdAt: quotations.createdAt, updatedAt: quotations.updatedAt,
    creatorName: users.name, creatorUsername: users.username,
  }).from(quotations).leftJoin(users, eq(quotations.createdBy, users.id))
    .where(where).orderBy(orderFn(sortColumn))
    .limit(pageSize).offset((page - 1) * pageSize);

  return { items: rows as QuotationListItem[], total };
}

export async function getQuotationById(id: number): Promise<QuotationDetail | null> {
  const db = await requireDb();
  const [row] = await db.select({
    id: quotations.id, quotationNo: quotations.quotationNo,
    customerName: quotations.customerName, customerContact: quotations.customerContact,
    customerPhone: quotations.customerPhone, customerEmail: quotations.customerEmail,
    industry: quotations.industry, projectName: quotations.projectName,
    status: quotations.status, discountRate: quotations.discountRate,
    totalAmount: quotations.totalAmount, notes: quotations.notes,
    createdBy: quotations.createdBy, validUntil: quotations.validUntil,
    createdAt: quotations.createdAt, updatedAt: quotations.updatedAt,
    version: quotations.version, shareToken: quotations.shareToken,
    creatorName: users.name, creatorUsername: users.username,
  }).from(quotations).leftJoin(users, eq(quotations.createdBy, users.id))
    .where(eq(quotations.id, id)).limit(1);

  if (!row) return null;

  const items = await db.select().from(quotationItems)
    .where(eq(quotationItems.quotationId, id));

  return { ...row, items } as QuotationDetail;
}

export async function getQuotationsByIds(ids: number[]): Promise<Pick<Quotation, "id" | "createdBy" | "status">[]> {
  const db = await requireDb();
  return db.select({
    id: quotations.id, createdBy: quotations.createdBy, status: quotations.status,
  }).from(quotations).where(inArray(quotations.id, ids));
}

export async function createQuotation(data: InsertQuotation, items: InsertQuotationItem[]): Promise<{ id: number; quotationNo: string }> {
  const db = await requireDb();
  return await db.transaction(async (tx) => {
    // Generate quotation number atomically
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const [last] = await tx.select({ quotationNo: quotations.quotationNo })
      .from(quotations)
      .where(sql`${quotations.quotationNo} LIKE ${`QT-${today}-%`}`)
      .orderBy(sql`${quotations.quotationNo} DESC`)
      .limit(1);
    const seq = last ? parseInt(last.quotationNo.split("-")[2], 10) + 1 : 1;
    const quotationNo = `QT-${today}-${String(seq).padStart(3, "0")}`;

    const [result] = await tx.insert(quotations).values({ ...data, quotationNo });
    const id = Number(result.insertId);

    if (items.length > 0) {
      const itemsWithQId = items.map(item => ({ ...item, quotationId: id }));
      const batchSize = 100;
      for (let i = 0; i < itemsWithQId.length; i += batchSize) {
        await tx.insert(quotationItems).values(itemsWithQId.slice(i, i + batchSize));
      }
    }

    return { id, quotationNo };
  });
}

export async function updateQuotationFields(
  tx: any,
  id: number,
  data: Partial<InsertQuotation>
): Promise<void> {
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
    await tx.update(quotations).set(updateSet).where(eq(quotations.id, id));
  }
}

export async function replaceQuotationItems(
  tx: any,
  quotationId: number,
  items: InsertQuotationItem[]
): Promise<void> {
  await tx.delete(quotationItems).where(eq(quotationItems.quotationId, quotationId));
  if (items.length > 0) {
    const itemsWithQId = items.map(item => ({ ...item, quotationId }));
    const batchSize = 100;
    for (let i = 0; i < itemsWithQId.length; i += batchSize) {
      await tx.insert(quotationItems).values(itemsWithQId.slice(i, i + batchSize));
    }
  }
}

export async function updateQuotationStatus(id: number, status: QuotationStatus): Promise<void> {
  const db = await requireDb();
  await db.update(quotations).set({ status }).where(eq(quotations.id, id));
}

export async function batchUpdateQuotationStatus(ids: number[], status: QuotationStatus): Promise<void> {
  const db = await requireDb();
  await db.update(quotations).set({ status }).where(inArray(quotations.id, ids));
}

export async function deleteQuotation(id: number): Promise<void> {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx.delete(quotationItems).where(eq(quotationItems.quotationId, id));
    await tx.delete(quotationVersions).where(eq(quotationVersions.quotationId, id));
    await tx.delete(quotations).where(eq(quotations.id, id));
  });
}

export async function batchDeleteQuotations(ids: number[]): Promise<void> {
  const db = await requireDb();
  await db.transaction(async (tx) => {
    await tx.delete(quotationItems).where(inArray(quotationItems.quotationId, ids));
    await tx.delete(quotationVersions).where(inArray(quotationVersions.quotationId, ids));
    await tx.delete(quotations).where(inArray(quotations.id, ids));
  });
}
```

- [ ] **步骤 2：更新 index.ts**

```ts
// server/domain/quotations/index.ts
export * from "./quotation.types";
export * as quotationRepo from "./quotation.repo";
```

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`pnpm check`
预期：0 errors

- [ ] **步骤 4：Commit**

```bash
git add server/domain/quotations/
git commit -m "feat: add quotation.repo.ts with all DB operations"
```

---

## 任务 5：创建 quotation.analytics.ts

**文件：**
- 创建：`server/domain/quotations/quotation.analytics.ts`
- 修改：`server/domain/quotations/index.ts`

从 `server/db/quotations.ts:399-595` 提取 analytics 函数。提取 tuple unwrap helper。

- [ ] **步骤 1：编写 quotation.analytics.ts**

从 `server/db/quotations.ts` 复制 `getMyDashboardStats`、`getMyRecentQuotations`、`getQuotationAnalytics` 函数，并添加 tuple unwrap helper。类型从 `quotation.types.ts` 导入。

- [ ] **步骤 2：更新 index.ts 添加 analytics re-export**

- [ ] **步骤 3：验证 TypeScript 编译**

运行：`pnpm check`
预期：0 errors

- [ ] **步骤 4：Commit**

```bash
git add server/domain/quotations/
git commit -m "feat: add quotation.analytics.ts with dashboard and analytics queries"
```

---

## 任务 6：创建 quotation.service.ts

**文件：**
- 创建：`server/domain/quotations/quotation.service.ts`
- 修改：`server/domain/quotations/index.ts`

业务编排层。调用 repo/policy/versioning/math，统一 calculateSubtotal 使用。

- [ ] **步骤 1：编写 quotation.service.ts**

核心函数：
- `createQuotation(ctx, input)` — 使用 `calculateSubtotal` 计算每项 subtotal
- `updateQuotation(ctx, input)` — 权限检查 → repo 字段更新 → repo items 替换 → versioning 快照
- `deleteQuotation(ctx, input)` — 权限检查 → repo 删除
- `updateStatus(ctx, input)` — 权限检查 → 状态转换验证 → repo 更新
- `batchUpdateStatus(ctx, input)` — 过滤有权限 ID → 验证转换 → repo 批量更新
- `batchDelete(ctx, input)` — 过滤有权限 ID → repo 批量删除
- `getAnalytics(ctx, input)` — 权限判断 → analytics 查询
- `getDashboard(ctx)` — analytics dashboard 查询

关键修复：`updateQuotation` 中的 subtotal 计算统一使用 `shared/quotationMath.ts` 的 `calculateSubtotal`。

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`pnpm check`
预期：0 errors

- [ ] **步骤 3：Commit**

```bash
git add server/domain/quotations/
git commit -m "feat: add quotation.service.ts with business orchestration"
```

---

## 任务 7：创建 quotation.router.ts

**文件：**
- 创建：`server/domain/quotations/quotation.router.ts`

薄 tRPC 壳。每个 procedure 只做：input 解析 → 调用 service → 返回结果。

- [ ] **步骤 1：编写 quotation.router.ts**

从 `server/routers/quotations.ts` 迁移，但：
- 删除所有权限检查逻辑（移至 service/policy）
- 删除所有金额计算逻辑（移至 service，使用 calculateSubtotal）
- 删除所有直接 DB 调用（移至 repo）
- 每个 procedure 只调用对应的 service 函数

- [ ] **步骤 2：验证 TypeScript 编译**

运行：`pnpm check`
预期：0 errors

- [ ] **步骤 3：Commit**

```bash
git add server/domain/quotations/
git commit -m "feat: add quotation.router.ts as thin tRPC shell"
```

---

## 任务 8：切换到新模块 + 兼容层

**文件：**
- 修改：`server/routers.ts` — 指向新 router
- 修改：`server/db/quotations.ts` — 变为 re-export 兼容层

- [ ] **步骤 1：更新 server/routers.ts**

将 `import { quotationsRouter } from "./routers/quotations"` 改为 `import { quotationsRouter } from "./domain/quotations/quotation.router"`。

- [ ] **步骤 2：将 server/db/quotations.ts 变为 re-export**

清空原文件内容，替换为从 domain 层 re-export：

```ts
// server/db/quotations.ts — backward-compatible re-export
// New code should import from server/domain/quotations/ directly
export {
  getQuotations, getQuotationById, getQuotationsByIds,
  createQuotation, updateQuotationFields, replaceQuotationItems,
  updateQuotationStatus, batchUpdateQuotationStatus,
  deleteQuotation, batchDeleteQuotations,
} from "../domain/quotations/quotation.repo";

export {
  getMyDashboardStats, getMyRecentQuotations, getQuotationAnalytics,
} from "../domain/quotations/quotation.analytics";

export type {
  QuotationStatus, QuotationListItem, QuotationDetail, RecentQuotation,
  QuotationAnalytics,
} from "../domain/quotations/quotation.types";
```

- [ ] **步骤 3：运行全部验证**

运行：
```bash
pnpm check
pnpm vitest run --pool=forks --no-file-parallelism
```
预期：TypeScript 0 errors，所有现有测试通过

- [ ] **步骤 4：Commit**

```bash
git add server/routers.ts server/db/quotations.ts server/routers/quotations.ts
git commit -m "refactor: switch to domain quotations module, add re-export compat layer"
```

---

## 任务 9：清理旧 router + helpers

**文件：**
- 删除：`server/routers/quotations.ts`（已被 domain router 替代）
- 修改：`server/routers/helpers.ts` — 移除 `isManagerOrAdmin`（已移至 policy）

- [ ] **步骤 1：删除旧 router**

```bash
rm server/routers/quotations.ts
```

- [ ] **步骤 2：从 helpers.ts 移除 isManagerOrAdmin**

`isManagerOrAdmin` 已移至 `quotation.policy.ts`。检查其他文件是否引用 `helpers.ts` 的 `isManagerOrAdmin`，如有则改为从 policy 导入。

- [ ] **步骤 3：运行全部验证**

运行：
```bash
pnpm check
pnpm vitest run --pool=forks --no-file-parallelism
npx eslint server/
```
预期：TypeScript 0 errors，测试全部通过，lint 0 errors

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "refactor: remove old quotations router, clean up helpers"
```

---

## 任务 10：添加 service 集成测试

**文件：**
- 创建：`server/domain/quotations/__tests__/quotation.service.test.ts`

- [ ] **步骤 1：编写 service 测试**

测试核心 service 函数的业务逻辑：
- createQuotation 正确使用 calculateSubtotal
- updateQuotation 正确调用 versioning
- updateStatus 验证状态转换
- 权限检查生效

- [ ] **步骤 2：运行测试验证通过**

运行：`pnpm vitest run server/domain/quotations/__tests__/`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add server/domain/quotations/__tests__/quotation.service.test.ts
git commit -m "test: add quotation.service.ts integration tests"
```

---

## 自检清单

- [ ] 没有单个文件超过 250 行
- [ ] router 中不出现复杂业务计算
- [ ] 权限判断不散落在 router 中
- [ ] analytics 不混入 CRUD
- [ ] versioning 可独立测试
- [ ] updateQuotation 的 subtotal 计算统一使用 calculateSubtotal
- [ ] server/db/quotations.ts 作为 re-export 兼容层
- [ ] 所有现有测试通过
- [ ] 新增 policy/versioning/service 测试
