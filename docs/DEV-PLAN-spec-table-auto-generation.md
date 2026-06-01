# 开发计划：报价单参数表自动生成

**基于 PRD**：[PRD-spec-table-auto-generation.md](./PRD-spec-table-auto-generation.md)
**总计**：7 天（P0: 3.5天 / P1: 2天 / P2: 1.5天）

---

## P0：核心匹配与导出（3.5 天）

### Task P0-1：修改匹配引擎支持大小写不敏感 + 去空格

**文件**：`server/db/productSpecs.ts`
**修改函数**：`matchQuotationWithSpecs()`
**验收**：AC3 — `AP-1234` 和 `ap-1234` 均能正确匹配

**实现步骤**：

1. 在 `matchQuotationWithSpecs` 中，加载参数集后，构建三级匹配 Map：
   - L1 Map：`Map<string, specEntry>` — 精确 trim 后的 key
   - L2 Map：`Map<string, specEntry>` — trim + toLowerCase 后的 key
   - L3 Map：`Map<string, specEntry>` — trim + replace(/\s/g, "") 后的 key

2. 匹配遍历报价单 items 时，按优先级依次查找：
   ```ts
   function normalizeForMatch(model: string) {
     const trimmed = model.trim();
     return {
       exact: trimmed,
       lower: trimmed.toLowerCase(),
       noSpace: trimmed.replace(/\s/g, ""),
     };
   }

   // 每个 item 匹配时：
   const norm = normalizeForMatch(item.productModel);
   let matchedEntry =
     l1Map.get(norm.exact) ??
     l2Map.get(norm.lower) ??
     l3Map.get(norm.noSpace) ?? null;
   ```

3. 命中即停，不再尝试后续策略。

**测试用例**（新增到 `server/productSpecs.match.test.ts`）：

| 输入 item | 参数集中的 key | 预期结果 |
|-----------|---------------|----------|
| `" AP-1234 "` | `"AP-1234"` | 命中（trim 匹配） |
| `"ap-1234"` | `"AP-1234"` | 命中（大小写不敏感） |
| `"A P - 1 2 3 4"` | `"AP-1234"` | 命中（去空格） |
| `"AP-1234-POE"` | `"AP-1234"` | 不命中 |

**预估**：0.5 天

---

### Task P0-2：新增自动匹配接口 — `getBestMatchSet` + `autoMatch`

**文件**：`server/db/productSpecs.ts`（新增函数）、`server/routers/productSpecs.ts`（新增 endpoint）
**验收**：AC1 — 点击后自动匹配，无需用户选集

**实现步骤**：

1. **`getBestMatchSet(quotationId: number)`**：
   - 加载报价单的所有 items（通过 `getQuotationById`）
   - 加载所有 `modelCount > 0` 的参数集
   - 对每个参数集，调用修改后的 `matchQuotationWithSpecs`，记录 `{ setId, setName, matchedCount, totalItems, coverageRate }`
   - 按 `coverageRate` 降序排序返回

2. **`autoMatch` tRPC endpoint**：
   ```
   input: { quotationId: number }
   output: {
     sets: Array<{
       setId: number,
       setName: string,
       fileName: string | null,
       coverageRate: number,    // 0-100
       matchedCount: number,
       totalItems: number,
     }>,
     bestMatch: {
       setId: number,
       matched: Array<{ productModel, productDesc, quantity, listPrice, specs, specKeys }>,
       unmatched: Array<{ productModel, productDesc, quantity, listPrice }>,
       specKeys: string[],      // 动态参数列名
     }
   }
   ```

3. **性能优化**：`getBestMatchSet` 一次查询所有参数集，批量构建 Map，避免 N+1 查询。目标：< 3 秒（100 items + 2000 specs）。

**预估**：1 天

---

### Task P0-3：重写前端预览对话框 — `SpecMatchPreview.tsx`

**文件**：`client/src/components/SpecMatchPreview.tsx`
**验收**：AC1, AC2, AC5

**当前状态**：两阶段对话框（Stage 1: 选集 → Stage 2: 预览）
**目标状态**：单阶段对话框，直接显示自动匹配结果

**实现步骤**：

1. 对话框打开时，自动调用 `trpc.productSpecs.autoMatch`（带 `quotationId`）
2. 移除 Stage 1 的参数集选择列表
3. 预览顶部新增：
   - 覆盖率指示器：彩色 Badge（>80% 绿色 / 50-80% 黄色 / <50% 红色）显示 "X% 匹配 (N/M)"
   - 参数集切换下拉框 `<Select>`：显示所有参数集 + 各自覆盖率，切换后重新调用 `matchQuotation` 并刷新预览
4. 保留现有的匹配/未匹配表格渲染逻辑（`collectSpecKeys` + 表格渲染）
5. 保留现有的导出按钮（`exportSpecTable` + `window.print()`）
6. 加载态：显示 spinner + "正在匹配参数..."

**UI 结构**：

```
┌─────────────────────────────────────────────┐
│  DialogHeader: 生成技术参数表                  │
├─────────────────────────────────────────────┤
│  参数集: [选择集 ▼]    覆盖率: ████████ 92%    │
│  匹配成功: 18 项    未匹配: 2 项               │
├─────────────────────────────────────────────┤
│  <ScrollArea>                               │
│  ┌─── 匹配成功 ──────────────────────────┐    │
│  │ # │ 型号 │ 说明 │ 数量 │ 参数1 │ 参数2 │    │
│  │───────────────────────────────────────│    │
│  │ 1 │ AP-1234 │ ... │ 5 │ ... │ ... │    │
│  └───────────────────────────────────────┘    │
│  ┌─── 未匹配 (灰色) ───────────────────┐      │
│  │ 2 │ CABLE-1M │ 跳线 1m │ 10 │ — │ — │      │
│  └───────────────────────────────────────┘    │
│  </ScrollArea>                               │
├─────────────────────────────────────────────┤
│  [导出 Excel]  [打印]  [关闭]                 │
└─────────────────────────────────────────────┘
```

**预估**：1.5 天

---

### Task P0-4：边界条件处理

**文件**：`SpecMatchPreview.tsx`、`QuotationDetail.tsx`
**验收**：AC4 — 辅材留白、空明细、无参数集

**实现步骤**：

1. **空明细**：在 `QuotationDetail.tsx` 中，按钮已有 `items.length > 0` 判断，确认灰显逻辑正确
2. **无参数集**：`autoMatch` 返回空 sets 数组时，预览显示"暂无参数数据，请先在数据管理 > 参数数据中导入"
3. **全未匹配**：`matched.length === 0` 时，显示"当前报价单共 N 项产品在参数库中均无对应记录"，仍显示导出按钮
4. **辅材留白**：确认未匹配行的参数列渲染为 `—` 而非空字符串（视觉上更清晰）

**预估**：0.5 天

---

### Task P0-5：Excel 导出格式微调

**文件**：`client/src/lib/specExport.ts`
**验收**：AC6 — 参数列自动换行

**实现步骤**：

1. 参数列宽度从固定的 16 调整为自动宽度（或设为 max 20）
2. 所有参数列单元格设置 `alignment: { wrapText: true }`
3. 匹配行保持现有格式
4. 未匹配行确认参数列留白（当前已有灰色行，确认样式正确）

**预估**：0.5 天

---

### Task P0-6：编写后端测试

**文件**：`server/productSpecs.match.test.ts`（新建）
**验收**：所有测试通过，覆盖 P0 匹配逻辑

**测试场景**：

| 测试名 | 场景 |
|--------|------|
| `exact trim match` | `" AP-1234 "` 匹配 `"AP-1234"` |
| `case insensitive match` | `"ap-1234"` 匹配 `"AP-1234"` |
| `space insensitive match` | `"A P-1234"` 匹配 `"AP-1234"` |
| `no match returns unmatched` | `"XYZ-999"` 不匹配任何 |
| `getBestMatchSet returns sorted sets` | 两个参数集，覆盖率高的排第一 |
| `getBestMatchSet with empty sets` | 无参数集时返回空数组 |
| `getBestMatchSet with no items` | 空报价单返回空匹配 |
| `autoMatch endpoint returns correct shape` | 验证返回结构 |

**预估**：包含在 P0-1 / P0-2 中

---

## P1：跨集匹配 + 快捷导出（2 天）

### Task P1-1：后端跨集匹配 — `matchQuotationAcrossSets`

**文件**：`server/db/productSpecs.ts`、`server/routers/productSpecs.ts`
**验收**：AC9

**实现步骤**：

1. 新增 `matchQuotationAcrossSets(quotationId: number)`：
   - 调用 `getBestMatchSet` 获取所有集及其覆盖率排序
   - 依次调用 `matchQuotationWithSpecs` 对每个集
   - 合并匹配结果，使用 `Map<string, matchedItem>` 去重：
     - key = `productModel.trim().toLowerCase()`
     - 按覆盖率从高到低处理，先匹配的保留
   - 收集各集来源信息：`[{ setId, setName, matchedCount }]`

2. 新增 `crossSetMatch` tRPC endpoint：
   ```
   input: { quotationId: number }
   output: {
     matched: Array<{...}>,
     unmatched: Array<{...}>,
     specKeys: string[],
     sources: Array<{ setId: number, setName: string, matchedCount: number }>,
   }
   ```

3. 导出时，在 Excel 底部追加一行备注："参数来源：集A (N项)，集B (M项)"

**测试用例**：

| 场景 | 输入 | 预期 |
|------|------|------|
| 跨集去重 | 集A 有 AP-1234，集B 也有 AP-1234（不同参数） | 集A 覆盖率高时取集A 的参数 |
| 部分匹配 | 集A 匹配 10 项，集B 匹配 5 项（有 2 项在集A 未匹配） | 合并 12 项，来源标注正确 |
| 全无匹配 | 所有集都不匹配 | 返回空 matched + 全量 unmatched |

**预估**：1 天

---

### Task P1-2：前端集成跨集匹配 + 快捷导出按钮

**文件**：`SpecMatchPreview.tsx`、`QuotationDetail.tsx`
**验收**：AC9, AC10

**实现步骤**：

1. **SpecMatchPreview 增加跨集模式切换**：
   - 预览顶部新增 Toggle "跨集匹配"
   - 开启后调用 `crossSetMatch`，关闭后调用 `autoMatch`（单集模式）
   - 跨集模式下，参数集切换下拉框隐藏，改为显示来源列表："参数来源：集A (10项)、集B (5项)"

2. **QuotationDetail 快捷导出按钮**：
   - 在现有「生成技术参数表」按钮旁新增「导出参数表」按钮
   - 点击直接调用 `autoMatch` + `exportSpecTable`，不弹预览对话框
   - 匹配不到任何参数时 toast 提示"暂无匹配的参数数据"

**预估**：1 天

---

## P2：近似推荐 + 列顺序（1.5 天）

### Task P2-1：近似推荐

**文件**：`server/db/productSpecs.ts`、`SpecMatchPreview.tsx`
**验收**：AC11

**实现步骤**：

1. **后端**：`matchQuotationWithSpecs` 返回未匹配项时，额外返回 `suggestions`：
   ```ts
   unmatched: Array<{
     productModel: string,
     // ... existing fields
     suggestedModel: string | null,  // 参数集中包含该型号子串的型号
   }>
   ```

2. 推荐逻辑：对每个未匹配 item，遍历参数集 entries，检查是否有 entry 的 `productModel` 包含 item 的 `productModel`（或反过来包含）。取第一个匹配。仅检查未匹配项，不检查辅材。

3. **前端**：未匹配行中，有 `suggestedModel` 的显示黄色背景 + ⚠ 图标 + "推荐：AP-1234" 文字

**预估**：1 天

---

### Task P2-2：参数列顺序遵循导入时原始顺序

**文件**：`server/db/productSpecs.ts`、`client/src/components/SpecMatchPreview.tsx`
**验收**：AC12

**实现步骤**：

1. 后端 `autoMatch` / `crossSetMatch` 返回的 `specKeys` 需保持导入时的列顺序
2. `collectSpecKeys` 函数中，改为按参数集中第一个 entry 的 `specs` key 顺序来排序 union 结果：
   ```ts
   // 不再直接 [...new Set(allKeys)]
   // 改为：以第一个 matched item 的 specs key 顺序为基准，其他 key 追加到末尾
   ```

3. `specExport.ts` 的 `collectSpecKeys` 同步修改

**预估**：0.5 天

---

## 并行任务

### 编写验收测试（贯穿整个迭代）

| 测试类型 | 时机 | 文件 |
|----------|------|------|
| 后端单元测试 | P0-1, P0-2 | `server/productSpecs.match.test.ts` |
| 前端手动验证 | 每个 Task 完成后 | 浏览器 |
| Excel 导出验证 | P0-5 完成后 | 导出 .xlsx 文件检查格式 |

### i18n 文案

所有新增 UI 文字需添加到 6 个语言文件：

| Key | zh | en |
|-----|----|----|
| `techSpecs.generating` | 正在匹配参数... | Matching specs... |
| `techSpecs.coverage` | 覆盖率 | Coverage |
| `techSpecs.matchedCount` | 匹配成功 | Matched |
| `techSpecs.unmatchedCount` | 未匹配 | Unmatched |
| `techSpecs.noSets` | 暂无参数数据，请先导入参数集 | No spec data. Please import first. |
| `techSpecs.noMatch` | 当前报价单产品在参数库中均无对应记录 | No matching specs found |
| `techSpecs.crossSet` | 跨集匹配 | Cross-set match |
| `techSpecs.suggestedModel` | 推荐 | Suggested |
| `techSpecs.quickExport` | 导出参数表 | Export Specs |
| `techSpecs.source` | 参数来源 | Spec source |

---

## 文件变更清单

| 文件 | 操作 | P0/P1/P2 |
|------|------|----------|
| `server/db/productSpecs.ts` | 修改 + 新增函数 | P0, P1, P2 |
| `server/routers/productSpecs.ts` | 新增 endpoint | P0, P1 |
| `client/src/components/SpecMatchPreview.tsx` | 重写 | P0, P1, P2 |
| `client/src/lib/specExport.ts` | 微调 | P0, P2 |
| `client/src/pages/QuotationDetail.tsx` | 新增按钮 | P1 |
| `server/productSpecs.match.test.ts` | 新建测试文件 | P0, P1 |
| `client/src/i18n/locales/*.json` (6 个) | 新增 key | P0 |
