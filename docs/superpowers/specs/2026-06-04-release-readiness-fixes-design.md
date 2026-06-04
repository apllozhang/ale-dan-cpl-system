# Release Readiness 修复设计

> 日期：2026-06-04
> 范围：修复 release readiness review 中剩余的 P2 + 架构问题

## 背景

Release readiness review（`ale-dan-cpl-system-release-readiness-review.md`）识别了多个问题。经代码探索确认，P0/P1 大部分已修复：

- P0 异步导入 worker：已有完整导入逻辑 ✅
- P1 `/api/metrics`：已加 `requireAuth` ✅
- P1 CSRF：missing origin 已拒绝 403 ✅
- P1 CI lint：`"lint": "eslint ."` 已存在 ✅

剩余问题需要修复：

| 问题 | 严重度 | 说明 |
|------|--------|------|
| `createTempUpload` 用 `getDb()` | P2 | DB 不可用时静默返回，产生孤儿文件 |
| cleanup 函数未调度 | P2 | `cleanupExpiredUploads`/`cleanupSessions`/`cleanupExpiredLoginAttempts` 定义了但从未调用 |
| `parseExcelBuffer` 架构倒置 | 中 | 从 router 导出，worker 依赖 router 层 |
| Logger 拼写错误 | 低 | `"[REDACTTED]"` → `"[REDACTED]"` |

## 方案选择

- **A: 逐个最小修复** — 每个文件改 1-2 行，不解决架构问题
- **B: 结构化清理（选定）** — 新建 maintenance 模块 + 提取共享 lib + 修复 3 个文件
- **C: 领域模式重构** — 新建 `server/domain/cpl/`，改动过大

## 设计

### 1. `server/_core/maintenance.ts`（新建）

集中调度所有定时清理任务。

```ts
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

async function runCleanup(name: string, fn: () => Promise<number | void>): Promise<void> {
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

**设计要点**：
- `interval.unref()` — 不阻止进程退出
- 每个 cleanup 独立 try-catch — 一个失败不影响其他
- 启动时立即跑一次 — 不等 1 小时
- 只在有清理记录时打日志 — 避免日志噪音

### 2. `server/lib/excel.ts`（新建）

从 `server/routers/cpl.ts` 提取 `parseExcelBuffer` 函数，消除 worker → router 的架构倒置。

**改动链**：
1. `server/routers/cpl.ts` — 删除 `parseExcelBuffer` 函数体，改为 `export { parseExcelBuffer } from "../lib/excel"`
2. `server/workers/importWorker.ts` — import 路径从 `../routers/cpl` 改为 `../lib/excel`

**效果**：依赖方向从 worker → router 变为 worker → lib（正确）。

### 3. `server/db/tempUploads.ts` — `requireDb()` 修复

```ts
// Before:
export async function createTempUpload(data: InsertTempUpload) {
  const db = await getDb();
  if (!db) return;
  await db.insert(tempUploads).values(data);
}

// After:
export async function createTempUpload(data: InsertTempUpload) {
  const db = await requireDb();
  await db.insert(tempUploads).values(data);
}
```

### 4. `server/_core/upload.ts` — catch 块清理文件

在 `registerUploadRoutes` 的 upload handler 中，确保 DB 写入失败时清理已上传的文件：

```ts
let uploadedPath: string | undefined;
try {
  uploadedPath = req.file?.path;
  await createTempUpload(...);
} catch (error) {
  if (uploadedPath) {
    await fsPromises.unlink(uploadedPath).catch(() => {});
  }
  throw error;
}
```

### 5. `server/_core/logger.ts` — 拼写修复

```ts
// Before:
result[key] = "[REDACTTED]";
// After:
result[key] = "[REDACTED]";
```

### 6. `server/_core/index.ts` — 集成 maintenance

```ts
import { startMaintenanceTasks } from "./maintenance";

server.listen(port, () => {
  logger.info("server_started", { port, env: process.env.NODE_ENV || "development" });
  startImportWorker();
  startMaintenanceTasks(); // ← 新增
});
```

## 改动文件汇总

| 文件 | 类型 | 说明 |
|------|------|------|
| `server/_core/maintenance.ts` | 新建 | 集中调度 cleanup |
| `server/lib/excel.ts` | 新建 | 从 router 提取 parseExcelBuffer |
| `server/routers/cpl.ts` | 改动 | 删除函数体，改为 re-export |
| `server/workers/importWorker.ts` | 改动 | import 路径改为 `../lib/excel` |
| `server/db/tempUploads.ts` | 改动 | `getDb()` → `requireDb()` |
| `server/_core/upload.ts` | 改动 | catch 块清理文件 |
| `server/_core/logger.ts` | 改动 | 拼写修复 |
| `server/_core/index.ts` | 改动 | 启动 maintenance |

## 验证清单

1. `pnpm check` — TypeScript 类型检查通过
2. `pnpm test` — 所有测试通过
3. `pnpm lint` — ESLint 无新增错误
4. 手动验证：启动服务器，确认 maintenance 日志输出
5. 手动验证：上传文件后 DB 不可用时，临时文件被清理
