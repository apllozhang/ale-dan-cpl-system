## 1. 报价单号竞态修复

- [ ] 1.1 修改 `server/db/quotations.ts` `createQuotation` 函数：将 `COUNT + 1` 逻辑替换为 `INSERT ... SELECT` 子查询原子生成 quotationNo
- [ ] 1.2 运行 `pnpm check` 验证类型无误
- [ ] 1.3 手动测试：创建报价单，验证单号格式 `QT-YYYYMMDD-NNN` 正确

## 2. CPL API 鉴权收紧

- [ ] 2.1 修改 `server/routers/cpl.ts`：将 `sheets`、`products`、`productsByIds`、`exportProducts`、`summary`、`activeImport`、`hasData`、`stats` 从 `publicProcedure` 改为 `protectedProcedure`
- [ ] 2.2 运行 `pnpm check` 验证类型无误
- [ ] 2.3 验证前端调用不受影响（前端已有 cookie 鉴权）

## 3. 缺少分页的查询加 limit

- [ ] 3.1 修改 `server/db/productSpecs.ts` `matchQuotationWithAllSpecs`：添加 `.limit(500)`
- [ ] 3.2 修改 `server/db/searches.ts` `getSavedSearches`：添加 `.limit(100)`
- [ ] 3.3 修改 `server/db/versions.ts` `getQuotationVersions`：添加 `.limit(50)`
- [ ] 3.4 修改 `server/db/organizations.ts` `getAllOrganizations`：添加 `.limit(500)`
- [ ] 3.5 修改 `server/db/userGroups.ts` `getAllUserGroups`：添加 `.limit(500)`
- [ ] 3.6 修改 `server/db/templates.ts` `getQuotationTemplates`：添加 `.limit(100)`
- [ ] 3.7 运行 `pnpm check` 验证类型无误

## 4. 静默 catch 加日志

- [ ] 4.1 修改 `server/routers/versions.ts`：3 处 `catch {}` 改为 `catch (e) { console.warn("[versions] JSON parse failed:", e instanceof Error ? e.message : e) }`
- [ ] 4.2 修改 `server/routers/certifications.ts`：`catch {}` 改为 `catch (e) { console.warn("[certifications] Excel parse failed:", e instanceof Error ? e.message : e) }`
- [ ] 4.3 运行 `pnpm check` 验证类型无误

## 5. 残留 `as any` 清理

- [ ] 5.1 修改 `server/db/quotations.ts`：2 处 `status as any` 改为 `status as typeof quotations.status.enumValues[number]`，1 处 `[] as any[]` 改为正确返回类型
- [ ] 5.2 修改 `server/db/productSpecs.ts`：2 处 `(result as any)[0]?.insertId` 改为 `Number(result[0].insertId)`
- [ ] 5.3 修改 `server/db/activityLogs.ts`：`[] as any[]` 改为正确返回类型
- [ ] 5.4 运行 `pnpm check` 验证零 `any` 残留

## 6. 验证

- [ ] 6.1 运行 `pnpm check` — 零类型错误
- [ ] 6.2 运行 `pnpm test` — 所有测试通过
- [ ] 6.3 提交所有变更
