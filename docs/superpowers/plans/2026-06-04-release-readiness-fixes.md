# Release Readiness 修复实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 release readiness review 中剩余的 P2 + 架构问题（cleanup 调度、parseExcelBuffer 提取、logger 拼写）

**架构：** 新建 `server/_core/maintenance.ts` 集中调度 cleanup；新建 `server/lib/excel.ts` 提取 Excel 解析逻辑，消除 worker → router 的架构倒置；修复 logger 拼写。`createTempUpload` 和 upload catch 块已确认无需修改（代码已正确）。

**技术栈：** TypeScript, Express, Drizzle ORM, xlsx

---

## 文件结构

| 文件 | 类型 | 职责 |
|------|------|------|
| `server/_core/maintenance.ts` | 新建 | 集中调度所有定时清理任务 |
| `server/lib/excel.ts` | 新建 | Excel 解析逻辑（从 router 提取） |
| `server/routers/cpl.ts` | 修改 | 删除 parseExcelBuffer 函数体，改为 re-export |
| `server/workers/importWorker.ts` | 修改 | import 路径从 router 改为 lib |
| `server/_core/logger.ts` | 修改 | 修复 "[REDACTTED]" 拼写 |
| `server/_core/index.ts` | 修改 | 启动时调用 startMaintenanceTasks |

**无需修改的文件（已确认正确）：**
- `server/db/tempUploads.ts` — `createTempUpload` 已使用 `requireDb()`（第 12 行）
- `server/_core/upload.ts` — catch 块已清理临时文件（第 147-153 行）

---

## 任务 1：修复 logger 拼写

**文件：**
- 修改：`server/_core/logger.ts:31`

- [ ] **步骤 1：修复拼写错误**

```ts
// server/_core/logger.ts 第 31 行
// Before:
result[key] = "[REDACTTED]";
// After:
result[key] = "[REDACTED]";
```

- [ ] **步骤 2：运行类型检查确认无影响**

运行：`pnpm check`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add server/_core/logger.ts
git commit -m "fix: correct typo in logger redaction placeholder"
```

---

## 任务 2：创建 `server/lib/excel.ts` — 提取 parseExcelBuffer

**文件：**
- 创建：`server/lib/excel.ts`

- [ ] **步骤 1：创建 `server/lib/excel.ts`，从 `server/routers/cpl.ts` 提取 COLUMN_MAP 和 parseExcelBuffer**

```ts
// server/lib/excel.ts
/**
 * Excel parsing utilities for CPL import.
 * Extracted from server/routers/cpl.ts to eliminate worker → router dependency.
 */

import * as XLSX from "xlsx";
import type { InsertCplProduct } from "../../drizzle/schema";

// Column name mapping for various sheet formats
export const COLUMN_MAP: Record<string, string> = {
  "产品组件": "productGroup",
  "OmniVista 2500 Partner Support Software": "productGroup",
  "税务小类": "taxCategory",
  "线缆": "taxCategory",
  "类别": "taxCategory",
  "产品型号": "productModel",
  "型号": "productModel",
  "产品说明": "productDesc",
  "描述": "productDesc",
  "销售类别": "salesCategory",
  "服务类别": "serviceCategory",
  "产品状态": "productStatus",
  "服务状态": "productStatus",
  "状态": "productStatus",
  "媒体价": "listPrice",
  "价格说明": "priceNote",
  "新品": "isNew",
  "备注": "remark",
  "注释": "remark",
  "子类别": "serviceCategory",
  // English column names
  "Section": "productGroup",
  "Model No": "productModel",
  "Model Description": "productDesc",
  "Sales Category": "salesCategory",
  "Service Category": "serviceCategory",
  "Availability": "productStatus",
  "List Price": "listPrice",
  "Price Description": "priceNote",
  "NEW": "isNew",
  "Comment": "remark",
};

export function parseExcelBuffer(buffer: Buffer, selectedSheets?: string[]) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetsToSkip = ["Summary", "LBS场景化报价模型"];
  const products: InsertCplProduct[] = [];
  const sheetMeta: { sheetName: string; displayOrder: number; productCount: number }[] = [];

  // Parse Summary sheet
  let summaryContent = "";
  if (workbook.SheetNames.includes("Summary")) {
    const ws = workbook.Sheets["Summary"];
    const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const lines: string[] = [];
    for (const row of data) {
      if (Array.isArray(row)) {
        const text = row.filter((c) => c !== null && c !== undefined && c !== "").join(" ").trim();
        if (text) lines.push(text);
      }
    }
    summaryContent = lines.join("\n");
  }

  // Parse product sheets
  let order = 0;
  for (const sheetName of workbook.SheetNames) {
    if (sheetsToSkip.includes(sheetName)) continue;
    if (selectedSheets && !selectedSheets.includes(sheetName)) continue;
    const trimmedName = sheetName.trim();
    const ws = workbook.Sheets[sheetName];
    const rows: Record<string, string | number | boolean | null | undefined>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    let count = 0;
    for (const row of rows) {
      const mapped: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = COLUMN_MAP[key.trim()];
        if (mappedKey) {
          mapped[mappedKey] = value != null ? String(value).trim() : "";
        }
      }
      // Skip empty rows
      if (!mapped.productModel && !mapped.productDesc && !mapped.productGroup) continue;

      products.push({
        sheetName: trimmedName,
        productGroup: mapped.productGroup || "",
        taxCategory: mapped.taxCategory || "",
        productModel: mapped.productModel || "",
        productDesc: mapped.productDesc || "",
        salesCategory: mapped.salesCategory || "",
        serviceCategory: mapped.serviceCategory || "",
        productStatus: mapped.productStatus || "",
        listPrice: mapped.listPrice || "",
        priceNote: mapped.priceNote || "",
        isNew: mapped.isNew || "",
        remark: mapped.remark || "",
      } as InsertCplProduct);
      count++;
    }

    sheetMeta.push({ sheetName: trimmedName, displayOrder: order++, productCount: count });
  }

  return { products, sheetMeta, summaryContent };
}
```

- [ ] **步骤 2：运行类型检查**

运行：`pnpm check`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add server/lib/excel.ts
git commit -m "refactor: extract parseExcelBuffer to server/lib/excel.ts"
```

---

## 任务 3：更新 `server/routers/cpl.ts` — 改为 re-export

**文件：**
- 修改：`server/routers/cpl.ts:1-50`

- [ ] **步骤 1：删除 COLUMN_MAP 和 parseExcelBuffer，改为 re-export**

在 `server/routers/cpl.ts` 顶部，删除第 7 行的 `import * as XLSX from "xlsx"`（不再直接使用），然后：

删除第 16-48 行的 `COLUMN_MAP` 定义和第 50-113 行的 `parseExcelBuffer` 函数体。

在原位置添加：

```ts
export { parseExcelBuffer } from "../lib/excel";
```

保留其他所有 import 和 router 代码不变。最终顶部应为：

```ts
import { router, protectedProcedure, superAdminProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Organization, UserGroup, InsertCplProduct, InsertCplSheet } from "../../drizzle/schema";
import * as db from "../db";
import { acquireLock, releaseLock } from "../db/locks";
import { logActivity } from "./helpers";
import crypto from "crypto";

export { parseExcelBuffer } from "../lib/excel";

// Import lock name and TTL (10 minutes)
const IMPORT_LOCK_NAME = "cpl_import";
const IMPORT_LOCK_TTL_MS = 10 * 60 * 1000;
```

- [ ] **步骤 2：运行类型检查**

运行：`pnpm check`
预期：PASS

- [ ] **步骤 3：运行测试**

运行：`pnpm test`
预期：PASS（parseExcelBuffer 通过 re-export 仍可被测试使用）

- [ ] **步骤 4：Commit**

```bash
git add server/routers/cpl.ts
git commit -m "refactor: replace parseExcelBuffer body with re-export from lib"
```

---

## 任务 4：更新 `server/workers/importWorker.ts` — 改 import 路径

**文件：**
- 修改：`server/workers/importWorker.ts:13`

- [ ] **步骤 1：修改 import 路径**

```ts
// Before (line 13):
import { parseExcelBuffer } from "../routers/cpl";

// After:
import { parseExcelBuffer } from "../lib/excel";
```

- [ ] **步骤 2：运行类型检查**

运行：`pnpm check`
预期：PASS

- [ ] **步骤 3：运行测试**

运行：`pnpm test`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add server/workers/importWorker.ts
git commit -m "refactor: import parseExcelBuffer from lib instead of router"
```

---

## 任务 5：创建 `server/_core/maintenance.ts` — 集中调度 cleanup

**文件：**
- 创建：`server/_core/maintenance.ts`

- [ ] **步骤 1：创建 maintenance 模块**

```ts
// server/_core/maintenance.ts
/**
 * Centralized maintenance tasks — scheduled cleanup of expired data.
 * Started by the server entry point after the server begins listening.
 */

import { cleanupExpiredUploads } from "../db/tempUploads";
import { cleanupSessions } from "../db/sessions";
import { cleanupExpiredLoginAttempts } from "../db/loginAttempts";
import { logger } from "./logger";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function startMaintenanceTasks(): void {
  // Run immediately on startup, then hourly
  runCleanup("expired_uploads", cleanupExpiredUploads);
  runCleanup("expired_sessions", cleanupSessions);
  runCleanup("expired_login_attempts", cleanupExpiredLoginAttempts);

  const interval = setInterval(() => {
    runCleanup("expired_uploads", cleanupExpiredUploads);
    runCleanup("expired_sessions", cleanupSessions);
    runCleanup("expired_login_attempts", cleanupExpiredLoginAttempts);
  }, CLEANUP_INTERVAL_MS);

  interval.unref(); // Don't prevent process exit
}

async function runCleanup(
  name: string,
  fn: () => Promise<number | void>,
): Promise<void> {
  try {
    const removed = await fn();
    if (removed && removed > 0) {
      logger.info("maintenance_cleanup", { task: name, removed });
    }
  } catch (error) {
    logger.error("maintenance_cleanup_failed", {
      task: name,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
```

- [ ] **步骤 2：运行类型检查**

运行：`pnpm check`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add server/_core/maintenance.ts
git commit -m "feat: add centralized maintenance tasks for scheduled cleanup"
```

---

## 任务 6：集成 maintenance 到 `server/_core/index.ts`

**文件：**
- 修改：`server/_core/index.ts:18,364-368`

- [ ] **步骤 1：添加 import**

在 `server/_core/index.ts` 第 18 行后添加：

```ts
import { startMaintenanceTasks } from "./maintenance";
```

- [ ] **步骤 2：在 server.listen 回调中调用 startMaintenanceTasks**

```ts
// Before (lines 364-368):
server.listen(port, () => {
  logger.info("server_started", { port, env: process.env.NODE_ENV || "development" });
  // Start background import worker
  startImportWorker();
});

// After:
server.listen(port, () => {
  logger.info("server_started", { port, env: process.env.NODE_ENV || "development" });
  // Start background import worker
  startImportWorker();
  // Start scheduled maintenance tasks (cleanup expired data)
  startMaintenanceTasks();
});
```

- [ ] **步骤 3：运行类型检查**

运行：`pnpm check`
预期：PASS

- [ ] **步骤 4：运行所有测试**

运行：`pnpm test`
预期：PASS

- [ ] **步骤 5：运行 lint**

运行：`pnpm lint`
预期：无新增错误

- [ ] **步骤 6：Commit**

```bash
git add server/_core/index.ts
git commit -m "feat: start maintenance tasks on server boot"
```

---

## 最终验证

- [ ] **步骤 1：完整类型检查**

运行：`pnpm check`
预期：PASS

- [ ] **步骤 2：完整测试套件**

运行：`pnpm test`
预期：所有测试通过

- [ ] **步骤 3：Lint 检查**

运行：`pnpm lint`
预期：无新增错误

- [ ] **步骤 4：构建验证**

运行：`pnpm build`
预期：构建成功
