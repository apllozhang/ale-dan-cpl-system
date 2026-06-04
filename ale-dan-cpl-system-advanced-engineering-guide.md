# ale-dan-cpl-system 高级工程化提升指导文档

> 目标：围绕系统稳定性、安全性、可扩展性、架构清晰度、代码整洁度，对当前项目进行系统性提升，使其更符合高级工程师 / 高级全栈工程师 / 高级后端工程师的工程标准。

---

## 1. 当前项目定位

`ale-dan-cpl-system` 已经不是普通 CRUD 项目，而是一个具备完整业务闭环的企业内部报价系统，包含：

- 用户登录与权限管理
- 服务端 session 管理
- CPL Excel 导入
- 报价创建、更新、状态流转
- 报价版本追踪
- 数据分析与 dashboard
- eFlash 管理与附件上传
- 审计日志
- CI 检查
- TypeScript strict
- Drizzle + MySQL schema

当前代码已经具备中高级工程化基础，但如果希望进一步达到“高级工程师定位”，还需要从以下方向继续提升：

1. 稳定性：长任务异步化、错误恢复、事务一致性、任务状态可追踪。
2. 安全性：session 生命周期闭环、上传安全、防滥用、权限 policy 化。
3. 可扩展性：分层架构、领域模块化、队列化、DB/Redis 基础设施。
4. 架构清晰：router 变薄，service/policy/repo/math/versioning 分离。
5. 代码整洁：消除重复逻辑、减少 helpers 杂糅、提升测试可维护性。
6. 高级工程师标准：可观测性、可回滚、可测试、可审计、可演进。

---

## 2. 总体改造目标

### 2.1 当前阶段

当前项目已经进入：

```text
中高级全栈工程项目
```

主要特点：

- 功能完整。
- 安全意识已有。
- 可靠性已有基础。
- CI 已存在。
- 服务端 session 已引入。
- DB lock 已引入。
- 文件上传已开始从 base64 迁移到 multipart。
- 部分外键和索引已补齐。

### 2.2 下一阶段目标

下一阶段目标应提升为：

```text
准生产级企业内部业务平台
```

应满足：

- 长任务不阻塞 API 请求。
- session 可撤销、可清理、可追踪。
- 上传文件不可被伪造类型绕过。
- 权限判断集中在 policy 层。
- router 不直接承载复杂业务。
- DB 层职责清晰。
- CI 覆盖 typecheck、lint、test、build。
- 关键业务有单元测试、集成测试、安全测试。
- 系统有日志、指标、错误追踪和慢查询监控。
- 代码结构能支撑多人协作。

---

## 3. 稳定性提升指导

### 3.1 将 CPL / eFlash 导入改为异步任务

#### 当前问题

目前 CPL 导入虽然已经支持 multer 上传和临时文件路径，但 Excel 解析和入库仍然发生在 API 请求链路中。

当前流程：

```text
前端上传文件
  ↓
服务端保存临时文件
  ↓
前端调用 tRPC import
  ↓
API 进程读取文件
  ↓
同步解析 Excel
  ↓
同步写库
  ↓
返回结果
```

问题：

1. 大文件解析会阻塞 Node event loop。
2. 请求超时风险高。
3. 导入失败后的状态不可追踪。
4. 用户刷新页面后无法恢复导入状态。
5. 后续无法扩展到多 worker。
6. 难以做导入进度条。

#### 推荐目标架构

```text
前端上传 Excel
  ↓
后端生成 uploadId
  ↓
用户提交 import job
  ↓
写入 import_jobs 表
  ↓
worker 异步解析 Excel
  ↓
写入 staging tables
  ↓
事务切换 active import
  ↓
记录成功/失败状态
  ↓
前端轮询 job status
```

#### 建议新增表

```ts
export const importJobs = mysqlTable("import_jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  type: mysqlEnum("type", ["cpl", "eflash"]).notNull(),
  status: mysqlEnum("status", [
    "pending",
    "processing",
    "succeeded",
    "failed",
    "cancelled",
  ]).default("pending").notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  filePath: varchar("filePath", { length: 1000 }).notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id),
  progress: int("progress").default(0).notNull(),
  errorMessage: text("errorMessage"),
  result: json("result").$type<{
    sheetsImported?: number;
    productsImported?: number;
    failedRows?: number;
  }>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
});
```

#### 推荐新增接口

```ts
importJobsRouter.create
importJobsRouter.getById
importJobsRouter.list
importJobsRouter.cancel
```

#### 推荐 worker 结构

```text
server/workers/
├── importWorker.ts
├── cplImportProcessor.ts
├── eflashImportProcessor.ts
└── jobRunner.ts
```

#### 成功标准

- API 请求不再直接解析 Excel。
- 大文件导入不会阻塞其他用户请求。
- 用户可以看到导入状态。
- 导入失败有明确错误。
- 导入过程可重试。
- 导入结果可审计。

---

### 3.2 完善 DB lock 的原子性

#### 当前状态

项目已经有 `system_locks` 表和 `acquireLock / releaseLock`，这是很好的改进。

#### 仍需加强

当前 DB lock 实现如果遇到高并发，存在两个请求同时发现 lock 过期并更新的边界风险。

#### 建议改进

使用原子条件更新。

```sql
UPDATE system_locks
SET owner = ?, expiresAt = ?
WHERE name = ?
  AND expiresAt < NOW()
```

然后检查 affectedRows。

#### 成功标准

- 并发下同一时间只有一个 worker 能获得锁。
- lock TTL 过期后可以被新任务接管。
- release lock 必须校验 owner。
- 所有 lock 操作有日志记录。

---

### 3.3 增加关键任务的幂等性

#### 需要幂等的操作

```text
CPL 导入
eFlash 导入
报价创建
报价状态流转
批量删除
批量状态更新
文件上传
```

#### 建议方案

对关键 mutation 增加 idempotency key。

```ts
.input(z.object({
  idempotencyKey: z.string().min(16).max(128),
  ...
}))
```

新增表：

```ts
export const idempotencyKeys = mysqlTable("idempotency_keys", {
  key: varchar("key", { length: 128 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  operation: varchar("operation", { length: 128 }).notNull(),
  response: json("response"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});
```

#### 成功标准

- 前端重复点击不会创建重复报价。
- 网络重试不会重复导入。
- 批量操作重复提交不会重复执行。
- 关键 mutation 可安全重试。

---

### 3.4 增加统一错误码体系

#### 当前问题

当前代码里很多错误是直接写 message，例如：

```text
Failed to import CPL data into database
Quotation not found
Not authorized
```

这对用户展示和前端处理不够稳定。

#### 建议新增错误码

```ts
export const ERROR_CODES = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  QUOTATION_NOT_FOUND: "QUOTATION_NOT_FOUND",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  IMPORT_LOCKED: "IMPORT_LOCKED",
  IMPORT_PARSE_FAILED: "IMPORT_PARSE_FAILED",
  FILE_TYPE_NOT_ALLOWED: "FILE_TYPE_NOT_ALLOWED",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
} as const;
```

#### 成功标准

- 前端可以根据错误码展示不同 UI。
- 日志中可以聚合错误类型。
- 测试可以断言稳定错误码，而不是中文/英文 message。

---

## 4. 安全性提升指导

### 4.1 密码变更后撤销全部 session

#### 当前状态

项目已经有：

```ts
revokeAllUserSessions(userId)
```

但用户密码变更时，需要确保调用它。

#### 建议实现

```ts
const passwordChanged = Boolean(password);

const result = await db.updateUser(id, updateData);

if (passwordChanged) {
  await revokeAllUserSessions(id);
}
```

#### 成功标准

- 用户密码被修改后，旧 session 全部失效。
- 被管理员重置密码后，目标用户所有设备退出。
- 测试覆盖该行为。

---

### 4.2 登录限流迁移到 DB 或 Redis

#### 当前问题

登录失败计数如果仍是内存 Map，多实例部署下不可靠。

#### 推荐方案 A：Redis

```text
key: login_fail:{ip}:{username}
value: count
ttl: 15 minutes
```

#### 推荐方案 B：MySQL

```ts
export const loginAttempts = mysqlTable("login_attempts", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull(),
  count: int("count").default(0).notNull(),
  windowStart: timestamp("windowStart").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});
```

#### 成功标准

- 多实例下限流一致。
- 同一个 IP 暴力破解多个账号会被限制。
- 同一个账号被多个 IP 爆破也能被发现。
- 登录成功后清理失败计数。

---

### 4.3 上传接口不要返回服务器 filePath

#### 当前问题

上传接口如果返回：

```ts
filePath: req.file.path
```

会把服务端文件系统路径暴露给前端。

#### 推荐改法

返回 `uploadId`，而不是 `filePath`。

新增表：

```ts
export const tempUploads = mysqlTable("temp_uploads", {
  id: varchar("id", { length: 64 }).primaryKey(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  filePath: varchar("filePath", { length: 1000 }).notNull(),
  fileSize: int("fileSize").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  uploadedBy: int("uploadedBy").notNull().references(() => users.id),
  consumedAt: timestamp("consumedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

上传返回：

```json
{
  "success": true,
  "uploadId": "..."
}
```

导入接口改为：

```ts
.input(z.object({
  uploadId: z.string().optional(),
  fileBase64: z.string().optional(),
  fileName: z.string(),
}))
```

#### 成功标准

- 前端不知道服务器文件路径。
- uploadId 只能由上传者使用。
- uploadId 只能消费一次。
- 过期临时文件自动清理。

---

### 4.4 文件类型校验升级为 MIME + magic bytes

#### 当前问题

multer fileFilter 检查的是浏览器传来的 mimetype，这个值可以伪造。

#### 建议增加 magic bytes 校验

`.xlsx` 本质是 zip，文件头通常是：

```text
50 4B 03 04
```

示例：

```ts
async function isLikelyXlsx(filePath: string): Promise<boolean> {
  const fd = await fs.open(filePath, "r");
  const buffer = Buffer.alloc(4);
  await fd.read(buffer, 0, 4, 0);
  await fd.close();

  return buffer[0] === 0x50 &&
         buffer[1] === 0x4B &&
         buffer[2] === 0x03 &&
         buffer[3] === 0x04;
}
```

#### 成功标准

- 伪造 mimetype 的非 Excel 文件会被拒绝。
- 上传失败有明确错误码。
- 上传安全测试覆盖伪造 MIME 场景。

---

### 4.5 eFlash 附件下载强制 attachment

#### 建议

受保护下载接口中增加：

```ts
res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
res.setHeader("X-Content-Type-Options", "nosniff");
```

#### 成功标准

- 附件默认下载，不直接渲染。
- 浏览器不进行 MIME sniffing。
- HTML/SVG 类文件即便误上传也不会直接执行。

---

### 4.6 增加安全测试

建议新增：

```text
server/security.authz.test.ts
server/security.sessions.test.ts
server/security.upload.test.ts
server/security.csrf.test.ts
```

测试用例：

```text
普通用户不能读取他人报价详情
普通用户不能更新他人报价
admin 可以读取全部报价
sales_manager 可以读取全部报价
viewer 不能创建报价
密码修改后旧 session 失效
logout 后 session 被 revoke
伪造 MIME 上传被拒绝
路径穿越文件名被拒绝
未授权用户不能访问上传文件
CSRF Origin 不匹配会被拒绝
```

---

## 5. 可扩展性提升指导

### 5.1 引入 service 层

#### 当前问题

router 中仍承担较多业务逻辑：

```text
输入校验
权限判断
金额计算
状态流转
调用 DB
审计日志
错误处理
```

#### 目标

让 router 只做：

```text
接收 input
调用 service
返回结果
```

#### 推荐结构

```text
server/domain/quotations/
├── quotation.router.ts
├── quotation.service.ts
├── quotation.policy.ts
├── quotation.repo.ts
├── quotation.analytics.ts
├── quotation.versioning.ts
├── quotation.math.ts
├── quotation.schemas.ts
└── quotation.types.ts
```

#### 示例 router

```ts
export const quotationsRouter = router({
  create: protectedProcedure
    .input(createQuotationInput)
    .mutation(({ input, ctx }) => quotationService.create(ctx, input)),

  update: protectedProcedure
    .input(updateQuotationInput)
    .mutation(({ input, ctx }) => quotationService.update(ctx, input)),

  getById: protectedProcedure
    .input(getQuotationByIdInput)
    .query(({ input, ctx }) => quotationService.getById(ctx, input.id)),
});
```

#### 示例 service

```ts
export async function createQuotationService(ctx: AuthedContext, input: CreateQuotationInput) {
  const items = buildQuotationItems(input.items, input.discountRate);
  const quotation = await quotationRepo.createWithItems(ctx.user.id, input, items);

  await auditService.log(ctx, {
    action: "create_quotation",
    resourceType: "quotation",
    resourceId: quotation.id,
  });

  return quotation;
}
```

#### 成功标准

- router 文件明显变薄。
- 业务流程集中在 service。
- 权限集中在 policy。
- DB 查询集中在 repo。
- 金额计算集中在 math。
- 单元测试可以绕过 tRPC 直接测 service。

---

### 5.2 权限判断 policy 化

#### 推荐新增

```text
server/domain/quotations/quotation.policy.ts
```

#### 示例

```ts
export function canReadQuotation(user: User, quotation: QuotationLike): boolean {
  if (user.isSuperAdmin) return true;
  if (user.role === "admin") return true;
  if (user.role === "sales_manager") return true;
  return quotation.createdBy === user.id;
}

export function assertCanReadQuotation(user: User, quotation: QuotationLike): void {
  if (!canReadQuotation(user, quotation)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not authorized",
    });
  }
}
```

#### 成功标准

- router 不再直接判断 role。
- 所有报价权限测试集中测试 policy。
- 权限变更只改 policy，不需要搜全项目。

---

### 5.3 金额计算集中化

#### 推荐新增

```text
shared/quotationMath.ts
```

#### 示例

```ts
export function calculateSubtotal(
  unitPrice: number,
  quantity: number,
  discountRate: number
): number {
  return roundMoney(unitPrice * quantity * (discountRate / 100));
}

export function calculateTotalAmount(items: Array<{ subtotal: number | string }>): number {
  return roundMoney(
    items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
  );
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
```

#### 使用范围

```text
server quotation create
server quotation update
frontend quotation preview
Excel export
PDF export
tests
```

#### 成功标准

- 全项目只存在一份折扣公式。
- 金额计算有单元测试。
- create/update/export 结果一致。

---

### 5.4 analytics 查询独立优化

#### 建议

将 analytics 明确隔离：

```text
quotation.analytics.ts
```

进一步可以引入：

```text
analytics cache
materialized summary table
daily aggregation job
```

#### 成功标准

- 报价列表和详情不受 analytics 查询影响。
- analytics 慢查询可被监控。
- dashboard 首页加载稳定。

---

## 6. 架构清晰度提升指导

### 6.1 按领域组织，而不是按技术层组织

#### 推荐长期结构

```text
server/
├── _core/
│   ├── context.ts
│   ├── trpc.ts
│   ├── upload.ts
│   ├── cookies.ts
│   └── env.ts
├── domain/
│   ├── quotations/
│   ├── cpl/
│   ├── eflash/
│   ├── users/
│   └── auth/
├── db/
│   ├── index.ts
│   ├── sessions.ts
│   ├── locks.ts
│   └── ...
├── services/
│   ├── audit.service.ts
│   └── file.service.ts
└── workers/
    └── importWorker.ts
```

#### 迁移策略

```text
先 quotations
再 cpl
再 eflash
最后 users/auth
```

---

### 6.2 quotation 模块推荐最终结构

```text
server/domain/quotations/
├── quotation.router.ts
├── quotation.schemas.ts
├── quotation.service.ts
├── quotation.policy.ts
├── quotation.repo.ts
├── quotation.analytics.ts
├── quotation.versioning.ts
├── quotation.math.ts
├── quotation.types.ts
└── __tests__/
    ├── quotation.policy.test.ts
    ├── quotation.math.test.ts
    ├── quotation.versioning.test.ts
    └── quotation.service.test.ts
```

#### 文件职责

| 文件 | 职责 |
|---|---|
| `quotation.router.ts` | tRPC procedure 定义 |
| `quotation.schemas.ts` | zod input schema |
| `quotation.service.ts` | 业务流程编排 |
| `quotation.policy.ts` | 权限判断 |
| `quotation.repo.ts` | DB CRUD |
| `quotation.analytics.ts` | 统计分析 |
| `quotation.versioning.ts` | 版本快照和 diff |
| `quotation.math.ts` | 金额计算 |
| `quotation.types.ts` | 类型定义 |

#### 成功标准

- 没有单个 quotation 文件超过 250 行。
- router 中不出现复杂业务计算。
- 权限判断不散落。
- analytics 不混入 CRUD。
- versioning 可独立测试。

---

## 7. 代码整洁度提升指导

### 7.1 拆分 helpers.ts

#### 推荐拆分

```text
server/services/audit.service.ts
server/policies/role.policy.ts
shared/quotationMath.ts
server/utils/csv.ts
```

#### 成功标准

- helpers.ts 删除或只保留极少通用工具。
- 每个工具函数都有明确归属。
- 新增工具函数不再随手放 helpers。

---

### 7.2 CI 增加 lint

#### package.json 增加

```json
{
  "scripts": {
    "lint": "eslint ."
  }
}
```

#### CI 增加

```yaml
- run: pnpm lint
```

#### 成功标准

- 未使用 import 会被阻止合并。
- no-explicit-any 被 CI 强制。
- unused vars 被 CI 强制。
- 代码风格问题不会积累。

---

### 7.3 统一 ESM 写法

将：

```ts
const fs = require("fs");
```

改为：

```ts
import fs from "node:fs";
```

或：

```ts
import { existsSync, mkdirSync } from "node:fs";
```

#### 成功标准

- 服务端代码统一 ESM。
- 没有不必要的 require。
- 打包和运行行为更稳定。

---

### 7.4 删除无用 import 和过期代码

每次重构后运行：

```bash
pnpm lint
pnpm check
pnpm test
pnpm build
```

重点清理：

```text
未使用 import
未使用函数
重复常量
legacy base64 支持的过渡代码
过期注释
与实际不一致的 CLAUDE.md / README
```

---

## 8. 测试体系提升指导

### 8.1 测试分层

建议建立四层测试：

```text
unit tests
integration tests
security tests
e2e tests
```

### 8.2 Unit tests

适合测试纯函数：

```text
quotation.math.test.ts
quotation.policy.test.ts
quotation.versioning.test.ts
csv.test.ts
locks.test.ts
sessions.test.ts
```

重点：

```text
calculateSubtotal
calculateTotalAmount
computeItemDiff
buildChangeSummary
canReadQuotation
canEditQuotation
validateSession
acquireLock
```

### 8.3 Integration tests

适合测试 DB + service：

```text
quotation.service.test.ts
cpl.import.test.ts
auth.session.test.ts
upload.test.ts
```

### 8.4 Security tests

```text
security.authz.test.ts
security.session.test.ts
security.upload.test.ts
security.csrf.test.ts
```

必须覆盖：

```text
不能读取他人报价
不能修改他人报价
密码修改后旧 session 失效
logout 后 session 失效
伪造 Excel MIME 被拒绝
路径穿越被拒绝
未登录访问上传文件被拒绝
Origin 不合法的 mutation 被拒绝
```

### 8.5 E2E tests

建议用 Playwright。

核心流程：

```text
登录
导入 CPL
搜索产品
创建报价
编辑报价
变更状态
导出报价
查看版本历史
管理员查看审计日志
普通用户权限隔离
```

#### 成功标准

- 核心报价流程每次发版前自动跑。
- 权限边界被 E2E 覆盖。
- 导入和导出流程可回归。

---

## 9. 可观测性提升指导

### 9.1 结构化日志标准化

推荐日志字段：

```ts
{
  requestId,
  userId,
  path,
  method,
  type,
  duration,
  status,
  errorCode,
  ip,
  userAgent,
}
```

### 9.2 增加 metrics

建议记录：

```text
http_request_duration_ms
trpc_request_duration_ms
db_query_duration_ms
login_failed_total
import_job_duration_ms
import_job_failed_total
quotation_created_total
quotation_exported_total
active_sessions_total
```

### 9.3 慢查询日志

针对 analytics 和导入相关 SQL：

```ts
if (duration > 1000) {
  logger.warn("slow_query", { queryName, duration });
}
```

### 9.4 错误追踪

可接入：

```text
Sentry
OpenTelemetry
Grafana Loki
Datadog
```

内部系统也可以先简单落地：

```text
error_logs table
```

#### 成功标准

- 能知道哪个接口慢。
- 能知道哪个用户触发错误。
- 能知道导入失败原因。
- 能知道系统是否出现暴力登录。
- 能知道数据库是否成为瓶颈。

---

## 10. 数据库与迁移提升指导

### 10.1 补齐剩余外键

建议检查：

```text
users.organizationId
users.groupId
cplProducts.importLogId
cplSheets.importLogId
eflashAttachments.uploadedBy
```

能加外键的尽量加。

### 10.2 增加唯一约束

建议检查：

```text
system_locks.name unique
sessions.id primary
import_logs.batchId unique
eflash_tags.name + category unique
quotation_no unique
```

### 10.3 增加 migration 审核流程

不要直接依赖 `db:push` 到生产。

建议：

```text
generate migration
review SQL
backup database
apply migration
verify schema
rollback plan
```

#### 推荐命令规范

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

---

## 11. 分阶段实施路线图

### Phase 1：快速收口，1–3 天

目标：修复明显短板，让项目更干净。

任务：

- [ ] CI 增加 `pnpm lint`
- [ ] package.json 增加 `lint` script
- [ ] 删除无用 import
- [ ] `upload.ts` 移除 `require("fs")`
- [ ] 密码修改后调用 `revokeAllUserSessions`
- [ ] 报价 update 改用统一 `calculateSubtotal`
- [ ] 上传接口不再返回 filePath，改为 uploadId
- [ ] 增加 session/logout/password-change 测试

完成标准：

```text
pnpm lint
pnpm check
pnpm test
pnpm build
```

全部通过。

---

### Phase 2：quotation 模块重构，3–7 天

目标：解决 quotations 职责过重。

任务：

- [ ] 拆 `quotation.types.ts`
- [ ] 拆 `quotation.repo.ts`
- [ ] 拆 `quotation.analytics.ts`
- [ ] 拆 `quotation.versioning.ts`
- [ ] 新增 `quotation.math.ts`
- [ ] 新增 `quotation.policy.ts`
- [ ] 新增 `quotation.service.ts`
- [ ] 保持 `quotations.ts` re-export 兼容
- [ ] 增加 policy/math/versioning 单元测试

完成标准：

- `server/db/quotations.ts` 不超过 20 行。
- `server/routers/quotations.ts` 只做 tRPC 壳。
- 没有单个 quotation 文件超过 250 行。
- 原有测试不需要大改。
- 新增测试覆盖核心逻辑。

---

### Phase 3：导入异步化，1–2 周

目标：提升稳定性和可扩展性。

任务：

- [ ] 新增 `import_jobs` 表
- [ ] 新增 `temp_uploads` 表
- [ ] `/api/upload` 返回 uploadId
- [ ] `cpl.import` 改为创建 job
- [ ] 新增 import worker
- [ ] 前端轮询 job 状态
- [ ] 导入失败记录 errorMessage
- [ ] 导入成功记录 result
- [ ] 临时文件自动清理

完成标准：

- API 不再同步解析大 Excel。
- 导入状态可查询。
- 导入失败可定位。
- 导入任务可重试。
- 多用户导入不会互相破坏。

---

### Phase 4：安全增强，1 周

目标：安全边界达到中大型公司内部系统标准。

任务：

- [ ] 登录限流迁移 Redis 或 DB
- [ ] 上传增加 magic bytes 校验
- [ ] 附件下载强制 attachment
- [ ] CSRF token 化
- [ ] 增加安全测试
- [ ] 增加 session cleanup 定时任务
- [ ] 管理员操作增加更详细审计

完成标准：

- 常见越权测试全部通过。
- session 生命周期闭环。
- 上传无法通过伪造 MIME 绕过。
- 暴力登录在多实例下也会被限制。

---

### Phase 5：可观测性与运维，1–2 周

目标：达到高级工程师对生产系统的可观测要求。

任务：

- [ ] 统一 logger
- [ ] 增加 request duration 统计
- [ ] 增加 slow query 记录
- [ ] 增加 import job metrics
- [ ] 增加 failed login metrics
- [ ] 接入 Sentry 或 OpenTelemetry
- [ ] 增加健康检查详情
- [ ] 增加数据库连接池监控

完成标准：

- 出错能定位。
- 变慢能发现。
- 导入失败能追踪。
- 登录攻击能告警。
- 数据库瓶颈能暴露。

---

## 12. 高级工程师定位标准

### 12.1 代码层面

- [ ] 单个文件职责明确。
- [ ] router 不承载复杂业务。
- [ ] 业务逻辑集中在 service。
- [ ] 权限集中在 policy。
- [ ] DB 查询集中在 repo。
- [ ] 纯函数独立测试。
- [ ] 没有重复业务公式。
- [ ] 没有随意 any。
- [ ] 没有杂物 helpers。

### 12.2 稳定性层面

- [ ] 长任务异步化。
- [ ] 任务状态可追踪。
- [ ] 关键操作幂等。
- [ ] 数据库不可用 fail-fast。
- [ ] 并发导入有分布式锁。
- [ ] 失败有明确错误码。
- [ ] 重要操作有事务。

### 12.3 安全层面

- [ ] session 可撤销。
- [ ] 密码修改后 session 失效。
- [ ] 登录限流支持多实例。
- [ ] 上传文件真实类型校验。
- [ ] 附件下载鉴权。
- [ ] CSRF 有 token 或严格 Origin 策略。
- [ ] 权限测试覆盖核心资源。
- [ ] 审计日志覆盖管理员操作。

### 12.4 可扩展性层面

- [ ] 可以多实例部署。
- [ ] 不依赖进程内状态。
- [ ] 长任务可由 worker 横向扩展。
- [ ] analytics 可独立优化。
- [ ] 上传存储可迁移到对象存储。
- [ ] session / rate limit 可迁移 Redis。

### 12.5 工程化层面

- [ ] CI 覆盖 lint/check/test/build。
- [ ] 有 migration 策略。
- [ ] 有回滚方案。
- [ ] 有 E2E 测试。
- [ ] 有安全测试。
- [ ] 有可观测性。
- [ ] 有清晰 README / CLAUDE.md / architecture docs。

---

## 13. 推荐 PR 拆分方式

### PR 1：质量门禁

```text
add lint script
update CI to run lint
remove unused imports
fix ESM require
```

### PR 2：session 闭环

```text
revoke sessions on password change
add session cleanup
add session tests
```

### PR 3：quotation DB 拆分

```text
split quotation types/repo/analytics/versioning
keep quotations.ts re-export
```

### PR 4：quotation service/policy/math

```text
add quotation.service.ts
add quotation.policy.ts
add quotation.math.ts
thin quotations router
```

### PR 5：uploadId 替代 filePath

```text
add temp_uploads table
return uploadId from /api/upload
import by uploadId
cleanup temp uploads
```

### PR 6：import jobs

```text
add import_jobs table
create import job
worker process import
frontend poll status
```

### PR 7：security tests

```text
authz tests
session tests
upload tests
csrf tests
```

### PR 8：observability

```text
structured logger
slow query logs
import metrics
failed login metrics
```

---

## 14. 优先级清单

### 必须优先做

```text
1. 密码修改后 revokeAllUserSessions
2. CI 增加 lint
3. quotation update 使用统一 calculateSubtotal
4. upload 返回 uploadId 而不是 filePath
5. 登录限流迁移 DB/Redis
```

### 第二优先级

```text
1. quotation service/policy/math 分层
2. CPL import job 异步化
3. 上传 magic bytes 校验
4. 安全测试
5. E2E 核心流程
```

### 第三优先级

```text
1. analytics 缓存
2. metrics / tracing
3. 对象存储迁移
4. import staging table
5. 管理员审计 dashboard
```

---

## 15. 最终目标状态

完成以上改造后，项目可以从：

```text
中高级全栈业务系统
```

提升为：

```text
高级工程师水准的准生产级企业内部平台
```

届时项目会体现出以下能力：

- 能处理真实业务复杂度。
- 能支撑多人协作。
- 能处理权限、安全、审计。
- 能处理长任务和失败恢复。
- 能支持多实例部署。
- 能通过 CI 保证质量。
- 能通过测试防止回归。
- 能通过日志和指标定位问题。
- 能持续演进而不变成大泥球。

---

## 16. 总结

当前项目已经具备不错的工程基础，尤其是：

```text
server-side session
DB-based system locks
multer upload
CI
TypeScript strict
Drizzle schema
审计日志
权限矩阵
报价版本追踪
```

下一步不应该继续单纯加业务功能，而应重点做：

```text
架构收敛
安全闭环
长任务异步化
测试体系完善
可观测性建设
```

最推荐的实施顺序是：

```text
质量门禁 → session 闭环 → quotation 分层 → uploadId → import jobs → security tests → observability
```

完成这些后，这个项目就能更有说服力地体现高级工程师能力，而不仅仅是“功能做出来了”。
