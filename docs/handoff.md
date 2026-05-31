# Handoff: 报价单参数表自动生成 + 导出优化

**日期**: 2026-05-31
**分支**: main
**状态**: P0 完成，P1/P2 待做

---

## 任务目标

1. **参数表自动匹配**：点击"生成技术参数表"后自动匹配最优参数集，无需手动选择
2. **匹配引擎升级**：支持大小写不敏感、去空格、槽位式交换机前缀匹配
3. **导出手动选路径**：所有 Excel/CSV 导出使用 File System Access API 让用户选择保存位置
4. **PDF 导出**：基于 jsPDF 生成 PDF（代码已写好，按钮已隐藏）

---

## 已完成工作

### 匹配引擎（server/db/productSpecs.ts）

四级匹配策略：
```
L1: 精确匹配（trim）         → " 9907 " = "9907"
L2: 大小写不敏感             → "ap-1234" = "AP-1234"
L3: 去空格匹配               → "CABLE - CAT6" = "CABLE-CAT6"
L4: 前缀匹配（最长优先）     → "9907-E-AC" 匹配 "9907"
```

新增函数：
- `getBestMatchSet(quotationId)` — 遍历所有参数集计算覆盖率排序
- `autoMatch` endpoint — 自动匹配最优集并返回结果

### 前端预览（client/src/components/SpecMatchPreview.tsx）

- 重写为单阶段对话框：打开即自动匹配，无需手动选集
- 覆盖率彩色指示器（>80% 绿 / 50-80% 黄 / <50% 红）
- 参数集切换下拉框，切换后实时刷新
- 边界条件处理：无参数集、无明细、全未匹配

### 导出优化（client/src/lib/saveFile.ts）

- 新建共享保存工具：优先 `showSaveFilePicker`，降级为 `<a>.click()`
- 更新 6 个导出函数：specExport、quotationExport、exportUtils、ImportHistory、SpecImportHistory、ActivityLog

### Bug 修复

- `productId: null` → `undefined`（修复 quotations.update 400 错误）

### 测试

- 新增 22 个匹配引擎测试（精确、大小写、去空格、前缀、collectSpecKeys）
- 全部 79 个测试通过

---

## 未完成工作

### P1（2 天）

- [ ] 跨集匹配：`matchQuotationAcrossSets` 后端函数
- [ ] 快捷导出按钮：跳过预览直接导出 Excel

### P2（1.5 天）

- [ ] 近似推荐：未匹配行显示子串匹配建议
- [ ] 参数列顺序：遵循导入时原始列顺序

### 其他

- [ ] 提交当前更改到 git（18 个修改文件 + 7 个新文件）
- [ ] 浏览器测试自动匹配、覆盖率显示、导出选路径
- [ ] 启用 PDF 导出（代码在 `client/src/lib/pdfExport.ts`，按钮已隐藏）

---

## 关键文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `server/db/productSpecs.ts` | 修改 | 匹配引擎四级策略 + getBestMatchSet |
| `server/routers/productSpecs.ts` | 修改 | 新增 autoMatch endpoint |
| `client/src/components/SpecMatchPreview.tsx` | 重写 | 自动匹配预览对话框 |
| `client/src/lib/saveFile.ts` | 新建 | 共享保存工具 |
| `client/src/lib/pdfExport.ts` | 新建 | PDF 导出（已隐藏） |
| `server/productSpecs.match.test.ts` | 新建 | 22 个匹配测试 |
| `client/src/lib/specExport.ts` | 修改 | 改用 saveFile 工具 |
| `client/src/lib/quotationExport.ts` | 修改 | 改用 saveFile 工具 |
| `client/src/lib/exportUtils.ts` | 修改 | 改用 saveFile 工具 |
| `client/src/pages/QuotationDetail.tsx` | 修改 | 修复 productId null 问题 |

---

## 决策记录

1. **四级匹配而非模糊匹配**：精确匹配优先，前缀匹配兜底，避免误匹配
2. **前缀最短 3 字符**：防止 "99" 误匹配 "9907"
3. **showSaveFilePicker 优先**：现代浏览器体验更好，自动降级兼容旧浏览器
4. **PDF 按钮隐藏**：用户要求暂不启用，代码保留
5. **不新增数据库表**：匹配逻辑在应用层实现，复用现有 product_specs 表
