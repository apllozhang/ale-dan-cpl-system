# Quotation 模块分层重构设计规格

> Phase 2 of 工程化提升路线图。将 quotations 从单体文件拆分为 domain 分层架构。

## 1. 目标

将 `server/db/quotations.ts`（596 行）和 `server/routers/quotations.ts`（296 行）拆分为职责单一的模块，使：

- 没有单个文件超过 250 行
- router 不承载复杂业务逻辑
- 权限判断集中在 policy 层
- DB 查询集中在 repo 层
- 金额计算使用 `shared/quotationMath.ts`（Phase 1 已完成）
- 版本 diff 逻辑可独立测试
- analytics 查询与 CRUD 隔离

## 2. 目录结构

```
server/domain/quotations/
├── quotation.types.ts       # 类型/接口定义（零逻辑）
├── quotation.repo.ts        # DB CRUD 操作
├── quotation.analytics.ts   # 统计分析查询
├── quotation.versioning.ts  # 版本快照 + diff 计算
├── quotation.policy.ts      # 权限判断
├── quotation.service.ts     # 业务编排
├── quotation.router.ts      # 薄 tRPC 壳
└── __tests__/
    ├── quotation.policy.test.ts
    ├── quotation.versioning.test.ts
    └── quotation.service.test.ts
```

兼容层：`server/db/quotations.ts` 变为 re-export，不破坏其他模块 import。

## 3. 文件职责

### 3.1 quotation.types.ts

从 `server/db/quotations.ts` 提取全部类型定义：

- `QuotationStatus` — schema 推断的联合类型
- `QuotationListItem` — 列表项字段 pick
- `QuotationDetail` — 详情，含 items 数组
- `RecentQuotation` — dashboard 最近报价
- `AnalyticsSummary`、`IndustryRow`、`CustomerRow`、`SalesRepRow`、`TimeRow`、`StatusRow`、`TopProductRow`、`QuotationAnalytics`

### 3.2 quotation.repo.ts

纯 DB 操作，无业务逻辑，无权限判断：

| 函数 | 说明 | 行数 |
|------|------|------|
| `getQuotations(params)` | 分页列表，join users 表 | ~80 |
| `getQuotationById(id)` | 单条详情，join items | ~35 |
| `getQuotationsByIds(ids)` | 批量查询（仅 id/createdBy/status） | ~10 |
| `createQuotation(data, items)` | 事务内创建，quotationNo 原子生成（SELECT FOR UPDATE） | ~40 |
| `updateQuotationFields(id, data)` | 纯字段更新（从原 updateQuotation 拆出） | ~15 |
| `replaceQuotationItems(quotationId, items)` | 事务内 items 替换（从原 updateQuotation 拆出） | ~20 |
| `updateQuotationStatus(id, status)` | 单条状态更新 | ~5 |
| `batchUpdateQuotationStatus(ids, status)` | 批量状态更新 | ~8 |
| `deleteQuotation(id)` | 级联删除（items → versions → quotation） | ~10 |
| `batchDeleteQuotations(ids)` | 批量级联删除 | ~10 |

### 3.3 quotation.analytics.ts

统计查询隔离，与 CRUD 互不干扰：

| 函数 | 说明 | 行数 |
|------|------|------|
| `getMyDashboardStats(userId, startDate, endDate)` | 用户仪表盘 KPI | ~35 |
| `getMyRecentQuotations(userId, limit)` | 最近 N 条报价 | ~20 |
| `getQuotationAnalytics(params)` | 7 条并行查询（概览/行业/客户/销售/趋势/状态/热门产品） | ~120 |

优化：提取 tuple unwrap helper 减少重复代码。

### 3.4 quotation.versioning.ts

版本快照和 diff 计算，从 `updateQuotation`（110 行）中拆出：

| 函数 | 说明 | 行数 |
|------|------|------|
| `computeItemDiff(oldItems, newItems)` | 计算 added/removed/modified（按 productModel） | ~30 |
| `buildChangeSummary(oldData, newData, itemDiff)` | 生成变更摘要（字段变更 + items 变更） | ~25 |
| `createVersionSnapshot(tx, quotationId, data, items, userId, changeSummary)` | 事务内版本插入 | ~15 |

### 3.5 quotation.policy.ts

权限判断集中化，消除 router 中 6 处重复的权限检查：

| 函数 | 说明 |
|------|------|
| `canReadQuotation(user, quotation)` | admin/sales_manager/superAdmin 可读所有，否则只能读自己的 |
| `canEditQuotation(user, quotation)` | 同上 |
| `canDeleteQuotation(user, quotation)` | 同上 |
| `assertCanReadQuotation(user, quotation)` | 不满足则抛 `TRPCError({ code: "FORBIDDEN" })` |
| `assertCanEditQuotation(user, quotation)` | 同上 |
| `assertCanDeleteQuotation(user, quotation)` | 同上 |

### 3.6 quotation.service.ts

业务编排层，router 只调用 service：

| 函数 | 说明 |
|------|------|
| `createQuotation(ctx, input)` | calculateSubtotal → repo.createQuotation → logActivity |
| `updateQuotation(ctx, input)` | assertCanEdit → repo.updateQuotationFields → repo.replaceQuotationItems → versioning.createVersionSnapshot → logActivity |
| `deleteQuotation(ctx, input)` | assertCanDelete → repo.deleteQuotation → logActivity |
| `updateStatus(ctx, input)` | 验证状态转换 → repo.updateQuotationStatus → logActivity |
| `batchUpdateStatus(ctx, input)` | 过滤有权限 ID → 验证转换 → repo.batchUpdateQuotationStatus |
| `batchDelete(ctx, input)` | 过滤有权限 ID → repo.batchDeleteQuotations |
| `getAnalytics(ctx, input)` | 权限判断 → analytics.getQuotationAnalytics |
| `getDashboard(ctx)` | analytics.getMyDashboardStats + getMyRecentQuotations |

### 3.7 quotation.router.ts

薄 tRPC 壳，每个 procedure 只做：input 解析 → 调用 service → 返回结果。

不包含任何业务逻辑、权限判断或金额计算。

## 4. 数据流

### 4.1 createQuotation

```
router.create(input)
  → service.createQuotation(ctx, input)
    → input.items.map(item => calculateSubtotal(...))
    → repo.createQuotation(data, items)  [事务: quotation + items]
    → logActivity(ctx, { action: "create_quotation" })
  → return result
```

### 4.2 updateQuotation

```
router.update(input)
  → service.updateQuotation(ctx, input)
    → repo.getQuotationById(id)
    → policy.assertCanEditQuotation(ctx.user, quotation)
    → input.items.map(item => calculateSubtotal(...))
    → [事务开始]
      → repo.updateQuotationFields(id, data)
      → repo.replaceQuotationItems(id, items)
      → versioning.computeItemDiff(oldItems, newItems)
      → versioning.buildChangeSummary(oldData, newData, itemDiff)
      → versioning.createVersionSnapshot(tx, ...)
    → [事务提交]
    → logActivity(ctx, { action: "update_quotation" })
  → return result
```

### 4.3 updateStatus

```
router.updateStatus(input)
  → service.updateStatus(ctx, input)
    → repo.getQuotationById(id)
    → policy.assertCanEditQuotation(ctx.user, quotation)
    → 验证 status 转换合法性（QUOTATION_STATUS_TRANSITIONS）
    → repo.updateQuotationStatus(id, status)
    → logActivity(ctx, { action: "update_status" })
  → return result
```

## 5. 关键改进

### 5.1 修复 subtotal 计算 bug

当前 `router.update`（第 146 行）使用 `unitPrice * quantity * (discount / 100)` 手动计算，与 `router.create` 使用的 `calculateSubtotal` 不一致。

修复：service 层统一使用 `shared/quotationMath.ts` 的 `calculateSubtotal`。

### 5.2 消除 updateQuotation 的 110 行单体函数

原 `updateQuotation` 混合了：
- 字段更新（DB 操作）
- items 替换（DB 操作）
- diff 计算（纯逻辑）
- 变更摘要生成（纯逻辑）
- 版本插入（DB 操作）

拆分为：repo.updateQuotationFields + repo.replaceQuotationItems + versioning.computeItemDiff + versioning.buildChangeSummary + versioning.createVersionSnapshot。

### 5.3 消除 analytics 的 tuple unwrap 重复

`getQuotationAnalytics` 中 `db.execute(sql\`...\`)` 的结果解包重复 6 次。提取 helper：

```ts
function unwrapRows<T>(result: unknown): T[] {
  const rows = Array.isArray(result[0]) ? result[0] : result;
  return rows as T[];
}
```

### 5.4 消除 router 中的权限检查重复

6 个 procedure 重复 `isManagerOrAdmin(ctx.user) + quotation.createdBy !== ctx.user.id` 模式。统一为 `policy.assertCanEditQuotation(ctx.user, quotation)`。

## 6. 错误处理

| 层级 | 行为 |
|------|------|
| policy | 抛 `TRPCError({ code: "FORBIDDEN", message: "..." })` |
| repo | 不抛业务错误，只抛 DB 异常 |
| service | 捕获 repo 异常 → `TRPCError({ code: "INTERNAL_SERVER_ERROR" })`，业务验证 → `TRPCError({ code: "BAD_REQUEST" })` |
| router | 透传 service 抛出的错误 |

## 7. 测试策略

| 测试文件 | 测试内容 | 类型 |
|----------|----------|------|
| `quotation.policy.test.ts` | canRead/canEdit/canDelete 各角色组合 | 纯函数单元测试 |
| `quotation.versioning.test.ts` | computeItemDiff、buildChangeSummary | 纯函数单元测试 |
| `quotation.service.test.ts` | create/update/delete/status 流程 | 集成测试（mock repo） |
| 现有 `quotations.*.test.ts` | 保留，验证重构后行为不变 | 回归测试 |

## 8. 向后兼容

- `server/db/quotations.ts` 变为 re-export 层
- `server/routers.ts` 中的 `quotationsRouter` 指向 `domain/quotations/quotation.router.ts`
- `shared/quotationMath.ts` 不变
- `server/db/versions.ts`、`server/db/templates.ts` 不变

## 9. 后续子项目

本设计仅覆盖 Quotations 模块。后续子项目：

1. **CPL + eFlash** 模块分层（~1,449 行）
2. **ProductSpecs + Certifications** 模块分层（~1,013 行）
3. **Users + Auth** 模块分层（~397 行）
