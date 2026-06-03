## Why

上一轮修复了高优先级技术债（any 类型、DB 索引、eFlash 批量导入）。本轮聚焦运行稳定性和安全底线：报价单号并发重复会导致数据损坏，CPL 接口无鉴权可被恶意刷取导致服务不可用，全表加载到内存存在 OOM 风险，静默 catch 导致故障无法定位。

## What Changes

- **#7 报价单号竞态修复**：将 `COUNT + 1` 改为 `INSERT ... SELECT MAX(seq)+1` 子查询，保证并发安全
- **#2 CPL API 鉴权收紧**：7 个 `publicProcedure` 改为 `protectedProcedure`，阻止未登录访问
- **#3 缺少分页的查询加 limit**：`matchQuotationWithAllSpecs` 等 6 个函数添加分页或 limit
- **#1 静默 catch 加日志**：4 处 `catch {}` 改为 `catch (e) { console.warn(...) }`
- **#4 残留 `as any` 清理**：8 处 `as any` 替换为正确类型

## Capabilities

### Modified Capabilities
- `quotations`: 原子单号生成，消除并发竞态
- `cpl`: 接口鉴权收紧，防止未授权数据访问
- `product-specs`: 查询加 limit，防止 OOM

## Impact

- **Database**: 无 schema 变更，仅查询逻辑修改
- **Server**: `server/db/quotations.ts`（单号生成）、`server/routers/cpl.ts`（鉴权）、`server/db/productSpecs.ts` + 5 个 db 文件（分页）、4 个文件（catch 日志）、3 个文件（as any）
- **API**: 7 个 CPL 端点从公开变为需登录，前端已有 cookie 鉴权，用户无感知
- **Dependencies**: 无
