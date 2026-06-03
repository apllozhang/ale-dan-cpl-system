# ale-dan-cpl-system 代码专业评审报告

> 仓库：<https://github.com/apllozhang/ale-dan-cpl-system>  
> 评审维度：可靠性、安全性、架构规范性、代码整洁性、可维护性  
> 评审对象：当前 `main` 分支可读取代码与配置  
> 生成日期：2026-06-03

---

## 1. 总体结论

`ale-dan-cpl-system` 已经超过普通 MVP 水平，具备较完整的企业内部业务系统雏形：

- React + Vite 前端
- Express + tRPC 后端
- MySQL 8 + Drizzle ORM
- TypeScript strict
- 共享权限矩阵
- 审计日志
- CPL Excel 导入
- 报价版本跟踪
- 后端单元测试说明
- AI Agent 开发规范

但如果继续作为线上报价、客户信息、产品价格数据系统运行，目前还需要优先补强以下方面：

1. **报价详情接口存在越权读取风险**
2. **JWT secret 允许为空，生产环境存在高风险**
3. **eFlash 附件上传存在路径穿越和公开访问风险**
4. **cookie session 一年有效期过长，缺少服务端撤销机制**
5. **CSRF 防护不足**
6. **生产可靠性依赖进程内状态，不适合多实例部署**
7. **缺少 CI/CD 质量门禁**
8. **权限模型有多套表达方式，存在不一致**

---

## 2. 总体评分

| 维度 | 评分 | 结论 |
|---|---:|---|
| 可靠性 | 6.5 / 10 | 有事务、测试、健康检查，但 DB 失败处理、导入并发、长任务阻塞、生产端口策略存在隐患 |
| 安全性 | 5.5 / 10 | 有 cookie、JWT、权限矩阵、限流，但存在报价详情越权读取、空 JWT secret、附件路径风险、CSRF 风险 |
| 架构规范性 | 7 / 10 | monorepo 边界清晰，tRPC 分层明确，但 router / DB / business logic 混杂，权限模型不完全统一 |
| 代码整洁性 | 6.5 / 10 | TypeScript strict、Prettier、ESLint 存在，但 `any`、重复计算、超大文件、注释与实际实现不一致 |
| 可维护性 | 6.5 / 10 | 测试覆盖已有基础，但缺 CI、缺迁移/回滚规范、缺安全测试和端到端测试 |

---

## 3. 项目基础判断

项目定位是 **ALE DAN CPL System**，一个 DAN 产品报价管理平台，支持月度 CPL Excel 导入、报价、折扣、版本跟踪和 Excel 导出。

当前架构是单仓库共享 TypeScript：

```text
client/src/        → React frontend
server/            → Express + tRPC backend
shared/            → Shared types, constants, permission matrix
drizzle/           → DB schema and migrations
```

主要技术栈：

- React 19
- Vite
- Express 4
- tRPC 11
- Drizzle ORM
- MySQL 8 / mysql2
- jose
- bcryptjs
- xlsx / exceljs
- zod
- Vitest
- Tailwind
- GSAP

项目脚本：

```json
{
  "dev": "cross-env NODE_ENV=development tsx watch server/_core/index.ts",
  "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "start": "cross-env NODE_ENV=production node dist/index.js",
  "check": "tsc --noEmit",
  "format": "prettier --write .",
  "test": "vitest run",
  "db:push": "drizzle-kit generate && drizzle-kit migrate"
}
```

---

# 4. P0 / 高风险问题

## 4.1 报价详情接口存在越权读取风险

### 问题描述

`quotations.list` 会根据用户角色限制普通用户只能看到自己的报价，admin 可以看全部。

但是 `quotations.getById` 只检查用户是否登录，并没有检查该报价是否属于当前用户，也没有检查当前用户是否是 admin / sales_manager / superAdmin。

底层 `getQuotationById` 会返回客户名称、联系人、电话、邮箱、行业、项目名、报价明细、shareToken 等完整详情。

同一个 router 中的 `update`、`updateStatus`、`delete` 都有所有权检查，这说明 `getById` 很可能是遗漏。

### 风险等级

**P0 / 高风险**

### 影响

普通登录用户可能通过猜测或枚举 quotation ID 读取其他用户的报价详情，包括：

- 客户名称
- 客户联系人
- 客户电话
- 客户邮箱
- 项目名
- 报价金额
- 产品明细
- 分享 token

### 建议修复

```ts
getById: protectedProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ input, ctx }) => {
    const quotation = await db.getQuotationById(input.id);

    if (!quotation) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Quotation not found",
      });
    }

    const canReadAll =
      ["admin", "sales_manager"].includes(ctx.user.role) ||
      ctx.user.isSuperAdmin;

    if (!canReadAll && quotation.createdBy !== ctx.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Not authorized",
      });
    }

    return quotation;
  });
```

### 必须补充测试

```ts
it("prevents sales_rep from reading another user's quotation detail", async () => {});
it("allows admin to read all quotation details", async () => {});
it("allows creator to read own quotation detail", async () => {});
```

---

## 4.2 JWT secret 允许为空

### 问题描述

当前 `ENV.cookieSecret` 来自：

```ts
cookieSecret: process.env.JWT_SECRET ?? ""
```

没有任何启动时强校验。

登录和 OAuth session 都使用这个 secret 签发 HS256 JWT。如果生产环境漏配 `JWT_SECRET`，系统仍会启动，并使用空字符串作为 HMAC secret。

### 风险等级

**P0 / 高风险**

### 影响

- session token 安全性显著降低
- 运维漏配环境变量时系统不会 fail fast
- 攻击者更容易伪造 session
- 问题可能长期隐藏在线上环境中

### 建议修复

```ts
function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim().length < 32) {
    throw new Error(`${name} is required and must be at least 32 characters`);
  }

  return value;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: requireEnv("JWT_SECRET"),
  databaseUrl: requireEnv("DATABASE_URL"),
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
```

开发环境可以允许 fallback，但生产环境必须强制 fail fast。

---

## 4.3 eFlash 附件上传存在路径穿越风险

### 问题描述

上传附件时，代码直接把用户传入的 `fileName` 拼到服务器路径里：

```ts
const recordDir = path.join(uploadDir, record.eflashId);
await fs.mkdir(recordDir, { recursive: true });

const filePath = path.join(recordDir, input.fileName);
const buffer = Buffer.from(input.fileBase64, "base64");
await fs.writeFile(filePath, buffer);
```

`fileName` 只限制最大长度，没有限制：

- `../`
- `..\`
- 绝对路径
- 路径分隔符
- 危险扩展名
- HTML / SVG / JS 等可执行或可触发脚本的文件

同时服务端把 `uploads/eflash` 作为静态目录公开：

```ts
app.use("/uploads/eflash", (req, res, next) => {
  const uploadsPath = path.resolve(process.cwd(), "uploads/eflash");
  express.static(uploadsPath)(req, res, next);
});
```

### 风险等级

**P0 / 高风险**

### 影响

- 管理权限用户可以写入非预期路径
- 上传文件可能被公开访问
- 如果允许 HTML / SVG / JS 文件，可能引发存储型 XSS
- 可能被用于托管恶意文件

### 建议修复

```ts
const safeFileName = path.basename(input.fileName)
  .replace(/[^\w.\-一-龥]/g, "_");

if (safeFileName !== input.fileName) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Invalid file name",
  });
}

const allowedExt = new Set([
  ".pdf",
  ".xlsx",
  ".xls",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
]);

const ext = path.extname(safeFileName).toLowerCase();

if (!allowedExt.has(ext)) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "File type not allowed",
  });
}

const filePath = path.resolve(recordDir, safeFileName);

if (!filePath.startsWith(recordDir + path.sep)) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Invalid file path",
  });
}
```

### 更推荐的架构

不要直接公开整个上传目录。应改为：

```text
客户端请求附件
  ↓
受保护下载接口
  ↓
检查用户权限
  ↓
返回文件流 / 签名 URL
```

---

# 5. P1 / 高优先级问题

## 5.1 cookie session 一年有效期过长，缺少服务端撤销机制

### 问题描述

系统常量：

```ts
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
```

登录成功后，session cookie 直接设置一年。

OAuth 登录也同样设置一年。

logout 只是清除浏览器 cookie，并不会使服务端 token 失效。

### 风险

如果 JWT 泄露，服务端无法单独撤销某个 token。

### 建议

1. access session 改为 8–24 小时
2. 增加服务端 session 表
3. JWT payload 中只放 `sid`
4. 每次请求查 session 是否有效
5. 密码变更、禁用用户、角色变更后立即撤销旧 session
6. 管理员和超管使用更短 session

示例 session 表：

```ts
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
});
```

---

## 5.2 CSRF 防护不足

### 问题描述

项目使用 cookie auth，并开启 credentials CORS。

HTTPS 请求下 cookie 配置为：

```ts
sameSite: secure ? "none" : "lax",
secure,
httpOnly: true
```

如果 mutation 没有 CSRF token 或 Origin / Referer 严格校验，cookie 自动携带可能导致 CSRF 风险。

### 建议

1. 对所有 mutation 检查 `Origin` / `Referer` 是否在 allowlist
2. 增加 CSRF token
3. 前端从安全接口获取 CSRF token
4. mutation header 携带 token
5. 如果不需要跨站 cookie，优先使用 `sameSite: "lax"` 或 `"strict"`

示例 middleware：

```ts
function assertTrustedOrigin(req: Request) {
  const origin = req.headers.origin;
  const allowed = new Set([
    "https://www.extremecloudiq.cn",
  ]);

  if (origin && !allowed.has(origin)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Untrusted origin",
    });
  }
}
```

---

## 5.3 `adminProcedure` 与 superAdmin 权限不一致

### 问题描述

权限矩阵中 `MANAGE_USERS` 允许 superAdmin 和 admin。

但 `adminProcedure` 只判断：

```ts
ctx.user.role !== "admin"
```

没有放行 `ctx.user.isSuperAdmin`。

### 风险

superAdmin 可能无法访问 adminProcedure 保护的接口，除非其 role 也是 admin。

### 建议修复

```ts
if (!ctx.user || (ctx.user.role !== "admin" && !ctx.user.isSuperAdmin)) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: NOT_ADMIN_ERR_MSG,
  });
}
```

更推荐逐步废弃 `adminProcedure`，统一使用：

```ts
permissionProcedure(PERMISSIONS.MANAGE_USERS)
```

---

## 5.4 普通 admin 可能创建 superAdmin

### 问题描述

`users.create` 输入允许：

```ts
isSuperAdmin: z.boolean().optional()
```

创建时直接传给 `db.createUser`。

而 `users.update` 里才限制了只有 superAdmin 能修改 `isSuperAdmin`。

### 风险

普通 admin 如果能访问 `users.create`，理论上可以创建 `isSuperAdmin: true` 的账号。

### 建议修复

```ts
const isSuperAdmin =
  ctx.user.isSuperAdmin ? input.isSuperAdmin ?? false : false;

const result = await db.createUser({
  username: input.username,
  passwordHash,
  name: input.name,
  email: input.email,
  role: input.role,
  isSuperAdmin,
  organizationId: input.organizationId,
  groupId: input.groupId,
});
```

### 必须补充测试

```ts
it("prevents non-super-admin from creating super-admin users", async () => {});
it("allows super-admin to create super-admin users", async () => {});
```

---

## 5.5 OAuth state 缺少 nonce 校验

### 问题描述

OAuth callback 读取 `code` 和 `state` 后，直接调用：

```ts
sdk.exchangeCodeForToken(code, state)
```

SDK 中 `decodeState` 只是：

```ts
const redirectUri = atob(state);
return redirectUri;
```

没有看到服务端保存并校验 state nonce。

### 风险

可能存在 OAuth login CSRF 风险。

### 建议

state 应包含：

```json
{
  "nonce": "...",
  "redirectUri": "..."
}
```

服务端在发起 OAuth 时保存 nonce，callback 时校验并删除 nonce。

---

## 5.6 `x-forwarded-for` 不能直接信任

### 问题描述

登录限流使用：

```ts
const clientIp =
  ctx.req.ip ||
  (ctx.req.headers["x-forwarded-for"] as string) ||
  "unknown";
```

如果没有正确配置 Express `trust proxy`，并且直接读取 header，攻击者可能伪造 `x-forwarded-for` 绕过限流。

### 建议

1. 只在可信反向代理后启用：

```ts
app.set("trust proxy", 1);
```

2. 使用 `req.ip`
3. 不要手动 fallback 到未验证的 `x-forwarded-for`
4. 登录限流迁移到 Redis

---

# 6. 可靠性分析

## 6.1 做得好的地方

### 有健康检查

服务端提供：

```text
GET /api/health
GET /api/ready
```

`/api/health` 会检查数据库连接并执行 `SELECT 1`。

### CPL 导入使用事务

`importCplOverwrite` 将以下步骤放入一个事务：

1. 创建 import log
2. 停用旧导入
3. 激活新导入
4. 写入 sheets
5. 写入 products
6. 写入 summary

这是可靠性上的亮点。

### 报价编号生成考虑并发

`createQuotation` 使用事务和 `SELECT ... FOR UPDATE` 生成 `QT-YYYYMMDD-NNN`，目标是防止并发重复编号。

---

## 6.2 主要可靠性问题

### DB 不可用时静默返回空数据

当前很多 DB 函数在 `getDb()` 返回 null 时直接返回空列表或 0。

例如：

```ts
if (!db) return { items: [], total: 0 };
```

### 风险

数据库挂了，用户看到的可能是“暂无数据”，而不是“系统异常”。

### 建议

新增：

```ts
export async function requireDb() {
  const db = await getDb();

  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database unavailable",
    });
  }

  return db;
}
```

业务查询应使用 `requireDb()`，不要静默返回空数据。

---

### 生产端口自动漂移

服务端会从 `PORT` 开始找可用端口，如果首选端口被占用，会自动换到后续端口。

开发环境这样很方便，但生产环境通常要求进程绑定平台指定端口。

### 建议

```ts
if (process.env.NODE_ENV === "production") {
  server.listen(preferredPort);
} else {
  const port = await findAvailablePort(preferredPort);
  server.listen(port);
}
```

生产环境端口占用应该直接失败。

---

### 导入锁是进程内变量，多实例无效

CPL 导入使用：

```ts
let importInProgress = false;
```

单进程有效，多实例、PM2 cluster、Kubernetes 多 pod、serverless 多实例都无效。

### 建议

使用数据库锁或 Redis 锁：

```sql
SELECT GET_LOCK('cpl_import', 0);
```

或建表：

```text
system_locks
- name
- owner
- expiresAt
```

---

### 50MB Excel base64 解析会阻塞 Node event loop

CPL import 和 eFlash import 都接收 base64，再在请求线程里解析 Excel。

### 风险

1. base64 放大体积
2. xlsx 解析 CPU / 内存密集
3. Node event loop 被阻塞
4. 大文件导入期间其他请求延迟升高

### 建议

1. 上传文件改 multipart / object storage
2. 导入任务入队列
3. 前端轮询导入状态
4. 导入解析放 worker thread 或独立 worker 进程
5. 加文件类型、sheet 数、行数、单元格数限制

---

# 7. 架构规范性分析

## 7.1 做得好的地方

### 单仓结构清晰

```text
client/src/
server/
shared/
drizzle/
```

职责清晰，适合中小型全栈业务系统。

### 前后端类型共享方向正确

客户端不能直接 import server，公共类型、权限矩阵放 `shared`，这是正确方向。

### API 聚合结构清楚

`server/routers.ts` 将各业务模块集中组合为 `appRouter`：

- system
- auth
- organizations
- userGroups
- users
- quotations
- cpl
- importLogs
- activityLogs
- templates
- versions
- sharing
- searches
- suggestions
- productSpecs
- customers
- certifications
- eflash

---

## 7.2 架构问题

### 权限模型存在多套表达方式

目前同时存在：

1. `adminProcedure`
2. `superAdminProcedure`
3. `permissionProcedure(PERMISSIONS.X)`
4. router 内手写角色判断

例如报价 update 内部手写：

```ts
const isAdmin =
  ["admin", "sales_manager"].includes(ctx.user.role) ||
  ctx.user.isSuperAdmin;
```

### 建议

统一权限表达：

```ts
permissionProcedure(PERMISSIONS.EDIT_ALL_QUOTATIONS)
permissionProcedure(PERMISSIONS.DELETE_QUOTATION)
permissionProcedure(PERMISSIONS.IMPORT_DATA)
permissionProcedure(PERMISSIONS.MANAGE_USERS)
```

针对资源所有权，抽 helper：

```ts
assertCanAccessQuotation(ctx.user, quotation, "read" | "edit" | "delete");
```

---

### 报价金额计算重复

折扣公式目前需要在后端、前端详情页、导出逻辑中保持一致。

这种“靠文档提醒三处一致”的方式比较脆弱。

### 建议

抽成共享纯函数：

```ts
// shared/quotationMath.ts
export function calculateSubtotal(
  unitPrice: number,
  quantity: number,
  discountRate: number
) {
  return roundMoney(unitPrice * quantity * (discountRate / 100));
}
```

然后：

1. 后端保存使用它
2. 前端预览使用它
3. Excel/PDF 导出使用它
4. 单元测试只测这一份逻辑

---

### DB schema 缺少关键外键约束

很多字段只是普通 `int`，没有 `.references()`：

- `users.organizationId`
- `users.groupId`
- `cplProducts.importLogId`
- `quotations.createdBy`
- `quotationItems.quotationId`
- `quotationVersions.quotationId`

后面新增的 certifications / eFlash 部分已经开始使用 references，说明风格不一致。

### 建议

补充 FK：

```ts
createdBy: int("createdBy")
  .notNull()
  .references(() => users.id),

quotationId: int("quotationId")
  .notNull()
  .references(() => quotations.id, { onDelete: "cascade" }),
```

如果线上已有历史脏数据，需要先做数据清洗 migration。

---

# 8. 代码整洁性分析

## 8.1 做得好的地方

### TypeScript strict 已开启

`tsconfig.json` 中：

```json
{
  "strict": true
}
```

### 有 ESLint 和 Prettier

ESLint 使用 typescript-eslint recommended，并配置：

- `no-console`
- `no-explicit-any`
- `no-unused-vars`

### 有测试配置

Vitest 配置只跑：

```text
server/**/*.test.ts
server/**/*.spec.ts
```

---

## 8.2 代码整洁性问题

### “禁止 any”的规范没有被工具强制

CLAUDE.md 说禁止使用 `any`，但 ESLint 只是：

```js
"@typescript-eslint/no-explicit-any": "warn"
```

代码中也存在 `(data as any)`。

### 建议

```js
"@typescript-eslint/no-explicit-any": "error"
```

短期无法全部清理时，可以先逐步迁移，但新增代码必须禁止。

---

### 部分文件职责过重

例如 `server/db/quotations.ts` 同时包含：

1. 列表查询
2. 详情查询
3. 创建
4. 更新
5. 删除
6. 状态更新
7. 批量操作
8. Dashboard stats
9. Analytics raw SQL
10. Version snapshot

### 建议拆分

```text
server/domain/quotations/
├── quotation.repo.ts
├── quotation.service.ts
├── quotation.policy.ts
├── quotation.analytics.ts
├── quotation.versioning.ts
├── quotation.math.ts
└── quotation.types.ts
```

---

### 文档与实现不一致

例如：

- AGENTS.md 使用 npm 命令
- CLAUDE.md 使用 pnpm 命令
- packageManager 是 pnpm
- CLAUDE.md 禁止 any
- ESLint 对 any 只是 warn

### 建议

1. 删除或更新过期 AGENTS.md 命令
2. 所有文档统一 pnpm
3. 规范必须由 lint / test / CI 强制
4. AI Agent 指南与实际工具链保持同步

---

# 9. 测试与质量保障

## 当前现状

项目已有：

- `pnpm test`
- Vitest
- server tests
- 文档中提到 57 个后端测试
- 覆盖折扣计算、版本 diff、权限、auth、analytics、import switching 等

## 不足

1. 没看到前端组件测试
2. 没看到 E2E 测试
3. 没看到 GitHub Actions CI
4. 没看到安全测试
5. 没看到数据库 migration 回滚和 seed 策略

## 建议新增 GitHub Actions

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.4.1

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm check
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

## 建议新增安全测试

```text
authz.quotations.test.ts
- 普通用户不能 getById 读取别人报价
- 普通用户不能 batch update/delete 别人报价
- sales_manager 可以读取/管理全部报价
- viewer 不能创建/编辑报价

auth.users.test.ts
- admin 不能创建 superAdmin
- admin 不能修改 superAdmin password
- superAdmin 可以管理 isSuperAdmin

uploads.security.test.ts
- 拒绝 ../evil.html
- 拒绝绝对路径
- 拒绝危险扩展名
- 超大 base64 拒绝
```

---

# 10. 整改优先级路线图

## 第 1 阶段：立即修复，1–2 天

- [ ] 修复 `quotations.getById` 越权读取
- [ ] 生产环境强制校验 `JWT_SECRET`
- [ ] 生产环境强制校验 `DATABASE_URL`
- [ ] 修复 `adminProcedure`，让 `isSuperAdmin` 正常通过
- [ ] 禁止普通 admin 创建 superAdmin
- [ ] 修复 eFlash 上传文件名路径穿越
- [ ] 所有 mutation 增加 Origin 校验
- [ ] 补充对应安全单元测试

## 第 2 阶段：一周内

- [ ] 登录限流迁移到 Redis 或 DB
- [ ] mutation 限流迁移到 Redis 或 DB
- [ ] 导入锁迁移到 Redis 或 DB
- [ ] 上传附件下载改为鉴权接口
- [ ] 生产端口禁止自动漂移
- [ ] DB 不可用时统一抛错，不返回空数据
- [ ] 增加 GitHub Actions CI
- [ ] `no-explicit-any` 从 warn 改为 error

## 第 3 阶段：两到三周

- [ ] 报价领域拆分为 repo / service / policy / math / analytics
- [ ] 折扣和金额计算迁移到共享纯函数
- [ ] Excel 导入改异步 job
- [ ] 增加 server session 表，支持 token 撤销
- [ ] 补核心外键约束和 migration
- [ ] 增加 Playwright E2E 测试
- [ ] 增加数据库 seed / rollback 策略

---

# 11. 建议的目标架构

## 11.1 权限架构

```text
router
  ↓
permissionProcedure(PERMISSIONS.X)
  ↓
resource policy helper
  ↓
service
  ↓
repository
  ↓
database
```

示例：

```ts
assertCanReadQuotation(user, quotation);
assertCanEditQuotation(user, quotation);
assertCanDeleteQuotation(user, quotation);
```

---

## 11.2 报价领域拆分

```text
server/domain/quotations/
├── quotation.router.ts
├── quotation.service.ts
├── quotation.repo.ts
├── quotation.policy.ts
├── quotation.analytics.ts
├── quotation.versioning.ts
├── quotation.math.ts
├── quotation.schemas.ts
└── quotation.test.ts
```

### router

只负责：

- 输入校验
- 调用 service
- 返回响应

### service

负责：

- 业务流程
- 权限 helper 调用
- 审计日志
- 事务边界

### repo

负责：

- 数据库读写
- SQL / Drizzle 查询

### policy

负责：

- 权限判断
- 资源所有权判断

### math

负责：

- 报价金额计算
- 折扣计算
- 金额 rounding

---

## 11.3 文件上传架构

```text
上传请求
  ↓
校验文件名 / 类型 / 大小
  ↓
保存到私有目录或对象存储
  ↓
记录 metadata
  ↓
下载时鉴权
  ↓
返回文件流或短期签名 URL
```

不要直接暴露整个 uploads 目录。

---

## 11.4 导入任务架构

```text
前端上传文件
  ↓
后端创建 import job
  ↓
worker 异步解析 Excel
  ↓
写入 staging table
  ↓
校验通过后事务切换 active import
  ↓
前端轮询 job status
```

这样可以避免大文件解析阻塞主 API 服务。

---

# 12. 推荐立即创建的 Issues

## Issue 1

标题：

```text
Fix authorization bypass in quotation detail endpoint
```

内容：

```text
quotations.getById currently returns full quotation detail for any authenticated user without checking ownership or elevated role.

Required:
- Add owner/admin/sales_manager/superAdmin check
- Add tests for creator, other user, admin, sales_manager
- Ensure shareToken and customer contact fields are not leaked
```

优先级：P0

---

## Issue 2

标题：

```text
Enforce production environment validation for JWT_SECRET and DATABASE_URL
```

内容：

```text
ENV.cookieSecret currently falls back to empty string when JWT_SECRET is missing.

Required:
- Fail fast in production when JWT_SECRET is missing or too short
- Fail fast in production when DATABASE_URL is missing
- Add startup validation tests
```

优先级：P0

---

## Issue 3

标题：

```text
Harden eFlash attachment upload against path traversal and unsafe file types
```

内容：

```text
uploadAttachment directly joins input.fileName into filesystem path and uploaded files are served from static uploads directory.

Required:
- Sanitize fileName
- Reject path separators and ..
- Restrict extension allowlist
- Verify resolved path remains inside record directory
- Add tests for path traversal
- Consider authenticated download endpoint
```

优先级：P0

---

## Issue 4

标题：

```text
Unify authorization model around permissionProcedure and resource policies
```

内容：

```text
The codebase currently mixes adminProcedure, superAdminProcedure, permissionProcedure, and inline role checks.

Required:
- Update adminProcedure to allow isSuperAdmin
- Replace user management routes with permissionProcedure(PERMISSIONS.MANAGE_USERS)
- Add quotation policy helpers
- Remove duplicated inline role checks where possible
```

优先级：P1

---

## Issue 5

标题：

```text
Add CI quality gate for typecheck, lint, test, and build
```

内容：

```text
Repository currently has scripts for check/test/build but no visible GitHub Actions workflow.

Required:
- Add GitHub Actions workflow
- Run pnpm install --frozen-lockfile
- Run pnpm check
- Run pnpm lint
- Run pnpm test
- Run pnpm build
```

优先级：P1

---

# 13. 最终建议

这个项目的基础方向是正确的：

- TypeScript strict
- tRPC
- Drizzle
- shared permission matrix
- audit log
- server tests
- CPL 导入事务
- 报价版本记录

这些说明项目已经具备工程化意识。

但现在最重要的不是继续加功能，而是先做一次：

```text
security hardening + reliability hardening
```

尤其优先修：

1. 报价详情越权读取
2. 空 JWT secret
3. 附件路径穿越
4. session 撤销机制
5. CSRF 防护
6. 多实例限流和导入锁
7. CI 质量门禁

修完 P0 / P1 后，这个项目可以达到比较稳的内部业务系统水平。
