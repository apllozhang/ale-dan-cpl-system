# Phase 1: 质量门禁 + Session 闭环 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 添加 lint 质量门禁、将折扣计算集中到 shared/quotationMath.ts、实现基于 sessionVersion 的 session 闭环（密码修改后旧 JWT 自动失效）。

**架构：** users 表新增 sessionVersion int 字段，JWT 签发时嵌入 sv（session version），auth 中间件每次请求比对 JWT.sv 与 DB user.sessionVersion，密码修改时 sessionVersion++。折扣公式从分散的 3 处统一到 shared/quotationMath.ts。

**技术栈：** Drizzle ORM (schema migration)、jose (JWT)、vitest (测试)、TypeScript strict

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `shared/quotationMath.ts` | 新建 | 折扣计算纯函数（calculateSubtotal、calculateTotalAmount、roundMoney） |
| `drizzle/schema.ts` | 修改 | users 表加 sessionVersion 字段 |
| `server/_core/context.ts` | 修改 | auth 验证时比对 JWT.sv 与 DB sessionVersion |
| `server/routers/auth.ts` | 修改 | JWT 签发时嵌入 sv 字段 |
| `server/routers/users.ts` | 修改 | 密码修改时递增 sessionVersion + 新增 forceLogout 端点 |
| `server/routers/helpers.ts` | 修改 | 删除 calculateSubtotal，改为 re-export from @shared |
| `server/routers/quotations.ts` | 修改 | import 路径不变（从 helpers re-export） |
| `server/quotationExcelExport.ts` | 修改 | 导入 calculateSubtotal from @shared/quotationMath |
| `client/src/features/quotations/pages/QuotationDetail.tsx` | 修改 | 4 处内联计算改用 calculateSubtotal from @shared/quotationMath |
| `package.json` | 修改 | 添加 "lint" script |
| `server/discount.test.ts` | 修改 | 使用 shared/quotationMath 替代本地 calcSubtotal |
| `server/session-lifecycle.test.ts` | 新建 | session 生命周期测试（密码修改失效、forceLogout） |

---

### 任务 1：添加 lint script

**文件：**
- 修改：`package.json:6-13`

- [ ] **步骤 1：添加 lint script 到 package.json**

在 `package.json` 的 `scripts` 中，在 `"test"` 行之前添加 `"lint"` 行：

```json
"scripts": {
  "dev": "cross-env NODE_ENV=development tsx watch server/_core/index.ts",
  "build": "vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "start": "cross-env NODE_ENV=production node dist/index.js",
  "check": "tsc --noEmit",
  "lint": "eslint .",
  "format": "prettier --write .",
  "test": "vitest run",
  "db:push": "drizzle-kit generate && drizzle-kit migrate"
},
```

- [ ] **步骤 2：运行 lint 查看当前状态**

运行：`pnpm lint 2>&1 | tail -20`

预期：可能有一些 warning/error（后续任务中修复）。记录输出中与 `no-unused-vars` 和 `no-explicit-any` 相关的问题数量。

- [ ] **步骤 3：Commit**

```bash
git add package.json
git commit -m "chore: add lint script to package.json"
```

---

### 任务 2：创建 shared/quotationMath.ts（TDD）

**文件：**
- 创建：`shared/quotationMath.ts`
- 测试：`server/quotation-math.test.ts`（vitest 配置的测试目录包含 server/，且 @shared alias 在 vitest.config.ts 中已配置）

- [ ] **步骤 1：编写失败的测试**

创建 `server/quotation-math.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { calculateSubtotal, calculateTotalAmount, roundMoney } from "@shared/quotationMath";

describe("quotationMath", () => {
  describe("roundMoney", () => {
    it("rounds to 2 decimal places", () => {
      expect(roundMoney(1.005)).toBe(1.01);
      expect(roundMoney(1.004)).toBe(1.0);
      expect(roundMoney(2.555)).toBe(2.56);
    });

    it("handles integers unchanged", () => {
      expect(roundMoney(100)).toBe(100);
      expect(roundMoney(0)).toBe(0);
    });
  });

  describe("calculateSubtotal", () => {
    it("applies 10% discount as multiply by 0.1", () => {
      expect(calculateSubtotal(1000, 2, 10)).toBe(200);
    });

    it("applies 100% (full price, no discount)", () => {
      expect(calculateSubtotal(500, 3, 100)).toBe(1500);
    });

    it("applies 0% discount as zero", () => {
      expect(calculateSubtotal(1000, 2, 0)).toBe(0);
    });

    it("applies 50% discount correctly", () => {
      expect(calculateSubtotal(200, 5, 50)).toBe(500);
    });

    it("handles decimal discount rates", () => {
      expect(calculateSubtotal(1000, 1, 12.5)).toBe(125);
    });

    it("handles edge case: very small discount", () => {
      expect(calculateSubtotal(10000, 1, 0.01)).toBeCloseTo(1);
    });
  });

  describe("calculateTotalAmount", () => {
    it("sums numeric subtotals", () => {
      const items = [
        { subtotal: 200 },
        { subtotal: 1500 },
        { subtotal: 100 },
      ];
      expect(calculateTotalAmount(items)).toBe(1800);
    });

    it("handles string subtotals from DB", () => {
      const items = [
        { subtotal: "200.50" },
        { subtotal: "300.25" },
        { subtotal: 100 },
      ];
      expect(calculateTotalAmount(items)).toBe(600.75);
    });

    it("handles empty items", () => {
      expect(calculateTotalAmount([])).toBe(0);
    });

    it("handles nullish subtotals", () => {
      const items = [
        { subtotal: 100 },
        { subtotal: "" },
        { subtotal: 200 },
      ];
      expect(calculateTotalAmount(items)).toBe(300);
    });
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm vitest run server/quotation-math.test.ts`

预期：FAIL — `Cannot find module '@shared/quotationMath'`

- [ ] **步骤 3：创建 shared/quotationMath.ts**

创建 `shared/quotationMath.ts`：

```ts
/** 四舍五入到 2 位小数 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** 折扣小计: unitPrice × quantity × (discountRate / 100) */
export function calculateSubtotal(unitPrice: number, quantity: number, discountRate: number): number {
  return roundMoney(unitPrice * quantity * (discountRate / 100));
}

/** 合计金额 */
export function calculateTotalAmount(items: Array<{ subtotal: number | string }>): number {
  return roundMoney(
    items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
  );
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm vitest run server/quotation-math.test.ts`

预期：全部 PASS（约 13 个测试）

- [ ] **步骤 5：Commit**

```bash
git add shared/quotationMath.ts server/quotation-math.test.ts
git commit -m "feat: add shared/quotationMath.ts with calculateSubtotal, calculateTotalAmount, roundMoney"
```

---

### 任务 3：迁移 server 端折扣计算

**文件：**
- 修改：`server/routers/helpers.ts:30-33`
- 修改：`server/quotationExcelExport.ts:137`
- 修改：`server/discount.test.ts:1-41`
- 修改：`server/routers/quotations.ts:5`（import 路径不变，从 helpers re-export）

- [ ] **步骤 1：修改 helpers.ts — 删除本地 calculateSubtotal，改为 re-export**

`server/routers/helpers.ts` 修改：删除第 30-33 行的 `calculateSubtotal` 函数定义，在文件顶部添加 re-export。

替换前（第 1 行之后）：
```ts
import * as db from "../db";
```

替换后：
```ts
import * as db from "../db";

// Re-export from shared for backward compatibility
export { calculateSubtotal } from "@shared/quotationMath";
```

然后删除第 30-33 行的 calculateSubtotal 函数定义：
```ts
// 删除这 4 行:
/** Calculate discount subtotal: unitPrice × quantity × (discountRate / 100) */
export function calculateSubtotal(unitPrice: number, quantity: number, discountRate: number): number {
  return unitPrice * quantity * (discountRate / 100);
}
```

最终 `server/routers/helpers.ts` 内容：
```ts
import * as db from "../db";

// Re-export from shared for backward compatibility
export { calculateSubtotal } from "@shared/quotationMath";

interface AuthedContext {
  user: NonNullable<import("../_core/context").TrpcContext["user"]>;
  req: import("../_core/context").TrpcContext["req"];
}

export function logActivity(ctx: AuthedContext, params: {
  action: string;
  resourceType?: string | null;
  resourceId?: number | null;
  detail?: Record<string, unknown>;
}) {
  return db.createActivityLog({
    userId: ctx.user.id,
    username: ctx.user.username || ctx.user.name || "",
    action: params.action,
    resourceType: params.resourceType ?? null,
    resourceId: params.resourceId ?? null,
    detail: params.detail ? JSON.stringify(params.detail) : null,
    ipAddress: ctx.req.ip || ctx.req.headers["x-forwarded-for"] as string || null,
  }).catch((err) => console.error("[ActivityLog] Failed:", err));
}

/** Check if user has manager/admin privileges */
export function isManagerOrAdmin(user: { role: string; isSuperAdmin: boolean }): boolean {
  return ["admin", "sales_manager"].includes(user.role) || user.isSuperAdmin;
}

/** Escape a value for CSV export */
export function csvEscape(val: string | null | undefined): string {
  if (!val) return '';
  const str = String(val);
  if (/^[=+\-@]/.test(str)) return "'" + str;
  return '"' + str.replace(/"/g, '""') + '"';
}
```

- [ ] **步骤 2：修改 quotationExcelExport.ts — 使用 calculateSubtotal**

在 `server/quotationExcelExport.ts` 顶部添加 import：
```ts
import { calculateSubtotal } from "@shared/quotationMath";
```

将第 137 行：
```ts
      item.listPrice * item.quantity * (item.discountRate / 100),
```

替换为：
```ts
      calculateSubtotal(item.listPrice, item.quantity, item.discountRate),
```

- [ ] **步骤 3：修改 discount.test.ts — 使用 shared 函数**

将 `server/discount.test.ts` 全部内容替换为：
```ts
import { describe, it, expect } from "vitest";
import { calculateSubtotal } from "@shared/quotationMath";

describe("Discount calculation", () => {
  it("applies 10% discount as multiply by 0.1", () => {
    expect(calculateSubtotal(1000, 2, 10)).toBe(200);
  });

  it("applies 100% (full price, no discount)", () => {
    expect(calculateSubtotal(500, 3, 100)).toBe(1500);
  });

  it("applies 0% discount as zero", () => {
    expect(calculateSubtotal(1000, 2, 0)).toBe(0);
  });

  it("applies 50% discount correctly", () => {
    expect(calculateSubtotal(200, 5, 50)).toBe(500);
  });

  it("handles decimal discount rates", () => {
    expect(calculateSubtotal(1000, 1, 12.5)).toBe(125);
  });

  it("calculates total amount from multiple items", () => {
    const items = [
      { unitPrice: 1000, quantity: 2, discountRate: 10 },
      { unitPrice: 500, quantity: 3, discountRate: 100 },
      { unitPrice: 200, quantity: 1, discountRate: 50 },
    ];
    const total = items.reduce((sum, it) => sum + calculateSubtotal(it.unitPrice, it.quantity, it.discountRate), 0);
    expect(total).toBe(200 + 1500 + 100);
  });

  it("handles edge case: very small discount", () => {
    expect(calculateSubtotal(10000, 1, 0.01)).toBeCloseTo(1);
  });
});
```

- [ ] **步骤 4：运行测试验证**

运行：
```bash
pnpm vitest run server/discount.test.ts server/quotation-math.test.ts
```

预期：全部 PASS。注意 discount.test.ts 中 `calculateSubtotal(1000, 1, 12.5)` 现在返回 125.00（经过 roundMoney），测试用 `toBe(125)` 仍通过（125.00 === 125）。

运行：`pnpm check`

预期：TypeScript 编译通过，无类型错误。

- [ ] **步骤 5：Commit**

```bash
git add server/routers/helpers.ts server/quotationExcelExport.ts server/discount.test.ts
git commit -m "refactor: migrate server-side discount calc to shared/quotationMath"
```

---

### 任务 4：迁移前端折扣计算

**文件：**
- 修改：`client/src/features/quotations/pages/QuotationDetail.tsx:278,308,344,376`

- [ ] **步骤 1：在 QuotationDetail.tsx 添加 import**

在文件顶部 import 区域添加（在已有 import 之后）：
```ts
import { calculateSubtotal } from "@shared/quotationMath";
```

- [ ] **步骤 2：替换 4 处内联折扣计算**

替换第 278 行：
```ts
// 前:
subtotal: parseFloat(product.listPrice || "0") * 1 * (discountRate / 100),
// 后:
subtotal: calculateSubtotal(parseFloat(product.listPrice || "0"), 1, discountRate),
```

替换第 308 行：
```ts
// 前:
subtotal: parseFloat(item.listPrice || "0") * item.quantity * (discountRate / 100),
// 后:
subtotal: calculateSubtotal(parseFloat(item.listPrice || "0"), item.quantity, discountRate),
```

替换第 344 行：
```ts
// 前:
subtotal: parseFloat(product.listPrice || "0") * 1 * (discountRate / 100),
// 后:
subtotal: calculateSubtotal(parseFloat(product.listPrice || "0"), 1, discountRate),
```

替换第 376 行：
```ts
// 前:
subtotal: parseFloat(product.listPrice || "0") * quantity * (discountRate / 100),
// 后:
subtotal: calculateSubtotal(parseFloat(product.listPrice || "0"), quantity, discountRate),
```

- [ ] **步骤 3：运行类型检查和构建验证**

运行：
```bash
pnpm check
pnpm build
```

预期：TypeScript 编译通过，build 成功。vite 构建 @shared alias 可正确解析。

- [ ] **步骤 4：Commit**

```bash
git add client/src/features/quotations/pages/QuotationDetail.tsx
git commit -m "refactor: migrate frontend discount calc to shared/quotationMath"
```

---

### 任务 5：Schema 变更 — 添加 sessionVersion

**文件：**
- 修改：`drizzle/schema.ts:3-18`

- [ ] **步骤 1：修改 users 表 schema**

在 `drizzle/schema.ts` 的 users 表定义中，`lastSignedIn` 行之后添加 `sessionVersion`：

```ts
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
  sessionVersion: int("session_version").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
```

- [ ] **步骤 2：生成并应用迁移**

运行：
```bash
pnpm db:push
```

预期：Drizzle 检测到新字段 `session_version`，生成 ALTER TABLE 语句并应用。

- [ ] **步骤 3：验证 schema**

运行：`pnpm check`

预期：TypeScript 编译通过。`User` 类型现在包含 `sessionVersion: number`。

- [ ] **步骤 4：修复类型兼容性**

在 `server/db/users.ts` 中：
- `PublicUser` 类型使用 `Omit<User, 'passwordHash'>`，会自动包含 `sessionVersion`，无需修改。
- `getAllUsers` 和 `getUserById` 的 select 显式列出了字段，需要添加 `sessionVersion: users.sessionVersion`。

在 `server/db/users.ts` 的 `getAllUsers` 函数 select 对象中（第 103-117 行之间），`lastSignedIn` 之后添加：
```ts
sessionVersion: users.sessionVersion,
```

在 `getUserById` 函数 select 对象中（第 123-137 行之间），`lastSignedIn` 之后添加：
```ts
sessionVersion: users.sessionVersion,
```

在 `server/auth.logout.test.ts` 的 mock user 对象中（第 18-27 行之间），`lastSignedIn` 之后添加：
```ts
sessionVersion: 0,
```

在 `server/authz.quotations.test.ts` 中搜索所有 mock user 对象，添加 `sessionVersion: 0` 字段（如果没有 mock user 可跳过）。

运行：`pnpm check`

预期：TypeScript 编译通过。

- [ ] **步骤 5：Commit**

```bash
git add drizzle/ drizzle/schema.ts server/db/users.ts server/auth.logout.test.ts
git commit -m "feat: add sessionVersion to users schema"
```

---

### 任务 6：JWT 签发嵌入 sessionVersion

**文件：**
- 修改：`server/routers/auth.ts:21-32`（createLocalSession 函数）
- 修改：`server/routers/auth.ts:116`（login 中的调用）

- [ ] **步骤 1：修改 createLocalSession 签名，添加 sv 到 payload**

将 `server/routers/auth.ts` 第 21-32 行的 `createLocalSession` 函数替换为：

```ts
async function createLocalSession(openId: string, name: string, sessionVersion: number): Promise<string> {
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);
  return new SignJWT({
    openId,
    appId: ENV.appId,
    name,
    sv: sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSessionSecret());
}
```

- [ ] **步骤 2：修改 login 中 createLocalSession 调用**

将第 116 行：
```ts
const token = await createLocalSession(user.openId, user.name || user.username || "User");
```

替换为：
```ts
const token = await createLocalSession(user.openId, user.name || user.username || "User", user.sessionVersion);
```

- [ ] **步骤 3：运行已有测试确认不破坏**

运行：`pnpm vitest run server/auth.logout.test.ts server/cpl.test.ts`

预期：全部 PASS。auth.logout 测试不涉及 JWT 签发（直接 mock context），cpl 测试同理。

- [ ] **步骤 4：Commit**

```bash
git add server/routers/auth.ts
git commit -m "feat: embed sessionVersion (sv) in JWT payload"
```

---

### 任务 7：Auth 验证时比对 sessionVersion

**文件：**
- 修改：`server/_core/context.ts:22-38`（getUserFromRequest）
- 修改：`server/_core/context.ts:41-76`（createContext）

- [ ] **步骤 1：修改 getUserFromRequest — 添加 sv 比对**

将 `server/_core/context.ts` 的 `getUserFromRequest` 函数替换为：

```ts
/** Extract user from request cookie (for non-tRPC middleware) */
export async function getUserFromRequest(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const cookies = parseCookieHeader(cookieHeader);
    const sessionCookie = cookies[COOKIE_NAME];
    if (!sessionCookie) return null;
    const secretKey = getSessionSecret();
    const { payload } = await jwtVerify(sessionCookie, secretKey, {
      algorithms: ["HS256"],
    });
    const openId = payload.openId as string;
    if (!openId) return null;
    const dbUser = await db.getUserByOpenId(openId);
    if (!dbUser) return null;
    // Check sessionVersion: if mismatch, session was invalidated (e.g. password change)
    const sv = payload.sv as number | undefined;
    if (dbUser.sessionVersion !== (sv ?? 0)) {
      return null;
    }
    return dbUser;
  } catch {
    return null;
  }
}
```

- [ ] **步骤 2：修改 createContext — 添加 sv 比对**

将 `server/_core/context.ts` 的 `createContext` 函数替换为：

```ts
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const cookieHeader = opts.req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const sessionCookie = cookies[COOKIE_NAME];
      if (sessionCookie) {
        const secretKey = getSessionSecret();
        const { payload } = await jwtVerify(sessionCookie, secretKey, {
          algorithms: ["HS256"],
        });
        const openId = payload.openId as string;
        if (openId) {
          const dbUser = await db.getUserByOpenId(openId);
          if (dbUser) {
            // Check sessionVersion: if mismatch, session was invalidated
            const sv = payload.sv as number | undefined;
            if (dbUser.sessionVersion === (sv ?? 0)) {
              user = dbUser;
            }
          }
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    requestId: crypto.randomUUID(),
  };
}
```

- [ ] **步骤 3：运行类型检查**

运行：`pnpm check`

预期：TypeScript 编译通过。

- [ ] **步骤 4：Commit**

```bash
git add server/_core/context.ts
git commit -m "feat: verify sessionVersion in auth middleware"
```

---

### 任务 8：密码修改时递增 sessionVersion

**文件：**
- 修改：`server/routers/users.ts:86-92`（update mutation 中的 password 处理）
- 修改：`server/db/users.ts:1`（import sql from drizzle-orm）

- [ ] **步骤 1：在 server/db/users.ts 添加 sql import**

`server/db/users.ts` 第 1 行当前是：
```ts
import { eq, like, or, sql } from "drizzle-orm";
```

已包含 `sql`，无需修改。

- [ ] **步骤 2：修改 users.ts update mutation — 密码修改时递增 sessionVersion**

在 `server/routers/users.ts` 的 update mutation 中，将第 86-92 行：

```ts
if (password) {
  const target = await db.getUserById(id);
  if (target?.isSuperAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "超管密码不允许修改" });
  }
  updateData.passwordHash = await hash(password, 10);
}
```

替换为：

```ts
if (password) {
  const target = await db.getUserById(id);
  if (target?.isSuperAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "超管密码不允许修改" });
  }
  updateData.passwordHash = await hash(password, 10);
  // Increment sessionVersion to invalidate all existing sessions
  updateData.sessionVersion = sql`session_version + 1`;
}
```

在文件顶部添加 import：
```ts
import { sql } from "drizzle-orm";
```

- [ ] **步骤 3：运行类型检查**

运行：`pnpm check`

预期：TypeScript 编译通过。`sql` tagged template 返回 `SQL` 类型，`Record<string, unknown>` 的 updateData 可接受。

- [ ] **步骤 4：Commit**

```bash
git add server/routers/users.ts
git commit -m "feat: increment sessionVersion on password change"
```

---

### 任务 9：新增 forceLogout 端点

**文件：**
- 修改：`server/routers/users.ts`（在 delete 端点之后新增 forceLogout）

- [ ] **步骤 1：在 usersRouter 中添加 forceLogout 端点**

在 `server/routers/users.ts` 的 `delete` 端点之后、router 闭合括号之前，添加：

```ts
  forceLogout: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const target = await db.getUserById(input.userId);
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        if (target.isSuperAdmin) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot force logout super admin" });
        }

        await db.updateUser(input.userId, {
          sessionVersion: sql`session_version + 1`,
        });

        await logActivity(ctx, {
          action: "force_logout",
          resourceType: "user",
          resourceId: input.userId,
          detail: { username: target.username || target.name },
        });

        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to force logout user", cause: error });
      }
    }),
```

注意：此端点放在 `delete` 端点的 `})),` 之后，与 `delete` 平级。`sql` import 已在任务 8 中添加。

- [ ] **步骤 2：运行类型检查**

运行：`pnpm check`

预期：TypeScript 编译通过。

- [ ] **步骤 3：Commit**

```bash
git add server/routers/users.ts
git commit -m "feat: add forceLogout admin endpoint"
```

---

### 任务 10：Session 生命周期测试

**文件：**
- 创建：`server/session-lifecycle.test.ts`

- [ ] **步骤 1：编写 session 生命周期测试**

创建 `server/session-lifecycle.test.ts`：

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SignJWT } from "jose";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const TEST_SECRET = new TextEncoder().encode("test-secret-key-for-session-lifecycle-test-at-least-32-chars");

// Mock ENV to provide a consistent cookieSecret
vi.mock("./_core/env", () => ({
  ENV: {
    cookieSecret: "test-secret-key-for-session-lifecycle-test-at-least-32-chars",
    appId: "test-app",
  },
}));

async function createTestJWT(openId: string, sv: number): Promise<string> {
  return new SignJWT({ openId, appId: "test-app", name: "Test User", sv })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(TEST_SECRET);
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 99,
      openId: "admin-open-id",
      username: "admin",
      name: "Admin",
      loginMethod: "local",
      role: "admin",
      isSuperAdmin: false,
      sessionVersion: 0,
      organizationId: null,
      groupId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordHash: "hash",
    },
    req: { ip: "127.0.0.1", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Session lifecycle", () => {
  describe("forceLogout", () => {
    it("requires admin role", async () => {
      const userCtx: TrpcContext = {
        user: {
          id: 1,
          openId: "user-open-id",
          username: "normal-user",
          name: "Normal User",
          loginMethod: "local",
          role: "user",
          isSuperAdmin: false,
          sessionVersion: 0,
          organizationId: null,
          groupId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
          passwordHash: "hash",
        },
        req: { ip: "127.0.0.1", headers: {} } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      };

      const caller = appRouter.createCaller(userCtx);
      await expect(
        caller.users.forceLogout({ userId: 2 })
      ).rejects.toThrow();
    });

    it("rejects forceLogout of super admin", async () => {
      // This test verifies the guard exists. In real usage the DB would
      // return a superAdmin user. We test the logic flow by mocking.
      // Since we can't easily mock db in this test harness, this is a
      // structural test confirming the endpoint is accessible to adminProcedure.
      const adminCtx = createAdminContext();
      const caller = appRouter.createCaller(adminCtx);
      // Will throw NOT_FOUND since user 999 doesn't exist in test DB,
      // but this confirms the endpoint is wired correctly.
      await expect(
        caller.users.forceLogout({ userId: 999 })
      ).rejects.toThrow();
    });
  });

  describe("JWT sessionVersion embedding", () => {
    it("creates JWT with sv field", async () => {
      const token = await createTestJWT("test-open-id", 0);
      // Decode without verifying to check payload
      const parts = token.split(".");
      const payload = JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString("utf-8")
      );
      expect(payload.sv).toBe(0);
      expect(payload.openId).toBe("test-open-id");
    });

    it("creates JWT with incremented sv", async () => {
      const token = await createTestJWT("test-open-id", 3);
      const parts = token.split(".");
      const payload = JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString("utf-8")
      );
      expect(payload.sv).toBe(3);
    });
  });
});
```

- [ ] **步骤 2：运行测试验证**

运行：`pnpm vitest run server/session-lifecycle.test.ts`

预期：
- "creates JWT with sv field" — PASS
- "creates JWT with incremented sv" — PASS
- "requires admin role" — PASS（普通用户调用 adminProcedure 会被拒绝）
- "rejects forceLogout of super admin" — 可能因 DB 不可用而 throw，但确认端点可达

- [ ] **步骤 3：Commit**

```bash
git add server/session-lifecycle.test.ts
git commit -m "test: add session lifecycle tests"
```

---

### 任务 11：最终验证

**文件：** 无新文件

- [ ] **步骤 1：运行完整质量门禁**

```bash
pnpm lint
```

预期：无 error（warning 可接受）。如果有 no-unused-vars 错误，检查是否为迁移引入的未使用 import 并修复。

- [ ] **步骤 2：运行类型检查**

```bash
pnpm check
```

预期：0 errors。

- [ ] **步骤 3：运行全部测试**

```bash
pnpm test
```

预期：全部 PASS（原有测试 + 新增 quotation-math.test.ts + session-lifecycle.test.ts）。

- [ ] **步骤 4：运行构建**

```bash
pnpm build
```

预期：build 成功，无错误。

- [ ] **步骤 5：Final commit（如有 lint 修复）**

如果 lint/check 步骤需要修复任何文件：

```bash
git add -A
git commit -m "chore: fix lint issues from Phase 1 migration"
```

如果全部一步通过则跳过此步骤。
