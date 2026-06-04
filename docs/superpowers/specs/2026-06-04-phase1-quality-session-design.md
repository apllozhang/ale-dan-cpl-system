# Phase 1: 质量门禁 + Session 闭环 设计规格

> 参考文档: `docs/ale-dan-cpl-system-advanced-engineering-guide.md`
> 日期: 2026-06-04

## 目标

在最小改动范围内，修复最明显的代码质量和安全短板，使项目通过完整的质量门禁（lint → check → test → build），并实现密码修改后旧 session 自动失效。

## 背景

当前项目状态：
- 无 `lint` script（eslint 配置已存在）
- 金额折扣公式分散在 3 处（helpers.ts、quotationExcelExport.ts、QuotationDetail.tsx）
- Session 使用无状态 JWT，密码修改后旧 token 仍有效
- 无 session 生命周期测试

## 模块 1: 质量门禁

### 1.1 添加 lint script

**文件:** `package.json`

在 `scripts` 中添加：
```json
"lint": "eslint ."
```

形成完整门禁：`pnpm lint → pnpm check → pnpm test → pnpm build`

### 1.2 金额计算集中化

**问题:** 折扣公式 `unitPrice × quantity × (discountRate / 100)` 分散在 3 处：
- `server/routers/helpers.ts:31-32` — `calculateSubtotal()` 函数
- `server/quotationExcelExport.ts:137` — 内联 `item.listPrice * item.quantity * (item.discountRate / 100)`
- `client/src/features/quotations/pages/QuotationDetail.tsx` — 4 处内联

**方案:** 新建 `shared/quotationMath.ts`

```ts
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

/** 四舍五入到 2 位小数 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
```

**迁移:**
1. `server/routers/helpers.ts` — 删除 `calculateSubtotal`，改为 re-export from `@shared/quotationMath`
2. `server/quotationExcelExport.ts` — 导入 `calculateSubtotal` from `@shared/quotationMath`
3. `client/src/features/quotations/pages/QuotationDetail.tsx` — 导入 from `@shared/quotationMath`

**兼容性:** 前端用 `parseFloat(listPrice || "0")` 将 string 转数字再传入函数，公式逻辑不变。

## 模块 2: Session 闭环（sessionVersion）

### 2.1 架构选择

采用 **sessionVersion** 方案：users 表加 `sessionVersion` int 字段，JWT 签发时嵌入版本号，auth 验证时与 DB 比对。

优势：
- 改动最小（加 1 个字段 + 改 3 个文件）
- 当前 context.ts 每次请求已查 `db.getUserByOpenId()`，零额外开销
- 密码修改只需 `sessionVersion++`，所有旧 token 自动失效
- 不需要新表、不需要定时清理

### 2.2 Schema 变更

**文件:** `drizzle/schema.ts`

`users` 表添加字段：
```ts
sessionVersion: int("session_version").default(0).notNull(),
```

运行 `pnpm db:push` 应用迁移。

### 2.3 JWT 签发嵌入版本号

**文件:** `server/routers/auth.ts`

`createLocalSession` 修改，接收 user 对象（包含 sessionVersion），在 payload 中加入 `sv`：
```ts
async function createLocalSession(openId: string, name: string, sessionVersion: number): Promise<string> {
  return new SignJWT({ openId, appId: ENV.appId, name, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(...)
    .sign(getSessionSecret());
}
```

Login 调用处传入 `user.sessionVersion`（默认 0）。

### 2.4 Auth 验证时比对版本号

**文件:** `server/_core/context.ts`

`getUserFromRequest` 和 `createContext` 两个函数中：
1. JWT 解析后取 `payload.sv as number`
2. 查 DB 获取用户后比对 `user.sessionVersion === sv`
3. 不匹配返回 `null`（视为未登录）

```ts
const sv = payload.sv as number | undefined;
if (dbUser && dbUser.sessionVersion !== (sv ?? 0)) {
  return null; // session 已失效
}
```

### 2.5 密码修改时递增版本号

**文件:** `server/routers/users.ts`

管理员更新用户信息时，如果包含 password：
```ts
if (password) {
  updateData.passwordHash = await hash(password, 10);
  updateData.sessionVersion = sql`session_version + 1`;
}
```

用户自行修改密码同理（如有此端点）。

### 2.6 管理员强制踢人

**文件:** `server/routers/users.ts`

新增 `forceLogout` 端点：
```ts
forceLogout: adminProcedure
  .input(z.object({ userId: z.number() }))
  .mutation(async ({ input, ctx }) => {
    // 权限检查: 只有 admin/superAdmin
    const target = await db.getUserById(input.userId);
    if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    if (target.isSuperAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot force logout super admin" });

    await db.updateUser(input.userId, {
      sessionVersion: sql`session_version + 1`,
    });

    await logActivity(ctx, {
      action: "force_logout",
      resourceType: "user",
      resourceId: input.userId,
    });

    return { success: true };
  })
```

**文件:** `server/db/users.ts`

`updateUser` 函数的 `data` 类型需允许传入 SQL 表达式作为 `sessionVersion` 值。当前实现使用 `Record<string, unknown>` 的 updateData，已经支持。

## 模块 3: 测试补充

### 3.1 Session 生命周期测试

**文件:** `server/session-lifecycle.test.ts`

测试用例：
1. 登录后 JWT 包含 `sv` 字段，值为用户当前 `sessionVersion`
2. 密码修改后 `sessionVersion` 递增
3. 旧 JWT（旧 sv）auth 验证失败
4. 新登录获得新 JWT（新 sv），auth 验证成功
5. 管理员 forceLogout 后目标用户 sessionVersion 递增

### 3.2 确保已有测试不受影响

| 测试文件 | 关注点 |
|---------|--------|
| `server/discount.test.ts` | 迁移 quotationMath 后公式不变 |
| `server/auth.logout.test.ts` | logout 仍正常清 cookie |
| `server/authz.quotations.test.ts` | 权限测试不受 sessionVersion 影响 |

## 变更文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `shared/quotationMath.ts` | **新建** | 折扣计算纯函数 |
| `drizzle/schema.ts` | 修改 | users 加 sessionVersion |
| `server/_core/context.ts` | 修改 | auth 验证比对 sessionVersion |
| `server/routers/auth.ts` | 修改 | JWT 签发嵌入 sv |
| `server/routers/users.ts` | 修改 | 密码修改递增 sessionVersion + forceLogout |
| `server/routers/helpers.ts` | 修改 | 删除 calculateSubtotal，re-export from shared |
| `server/quotationExcelExport.ts` | 修改 | 使用 @shared/quotationMath |
| `client/src/features/quotations/pages/QuotationDetail.tsx` | 修改 | 使用 @shared/quotationMath |
| `package.json` | 修改 | 添加 lint script |
| `server/session-lifecycle.test.ts` | **新建** | Session 生命周期测试 |

## 验证标准

1. `pnpm lint` 通过
2. `pnpm check` 通过
3. `pnpm test` 全部通过（含新增测试）
4. `pnpm build` 成功
5. 折扣公式在 create/update/export/frontend 四处结果一致
6. 密码修改后旧 JWT 自动失效
7. 管理员 forceLogout 后目标用户被踢出
