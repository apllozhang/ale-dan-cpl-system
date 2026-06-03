## 1. Database Indexes

- [x] 1.1 Create Drizzle migration file adding composite index `(createdAt, userId, action)` on `activity_logs`
- [x] 1.2 Create Drizzle migration file adding index `(resourceType, createdAt)` on `activity_logs`
- [x] 1.3 Run `pnpm db:push` and verify migration applies cleanly

## 2. Product Search Fix

- [x] 2.1 Remove `listPrice` from the LIKE OR chain in `server/db/cpl.ts` search conditions (line 133)
- [x] 2.2 Run `pnpm check` to verify no type errors

## 3. eFlash Batch Import

- [x] 3.1 Rewrite `importEFlashFromRows` in `server/db/eflash.ts`: batch-prefetch existing records with single SELECT, partition into insert/update arrays, wrap in `db.transaction()`
- [x] 3.2 Run existing eFlash import tests (if any) or manual test via dev server
- [x] 3.3 Run `pnpm check` to verify no type errors

## 4. Server-Side `any` Cleanup (22 occurrences, 7 files)

- [x] 4.1 Fix `server/routers/versions.ts` (9 any): add typed snapshot interfaces for version data
- [x] 4.2 Fix `server/routers/cpl.ts` (6 any): type the `columnMap` Record and filter values
- [x] 4.3 Fix `server/routers/activityLogs.ts` (1 any)
- [x] 4.4 Fix `server/routers/helpers.ts` (1 any): type the `logActivity` detail parameter
- [x] 4.5 Fix `server/routers/importLogs.ts` (1 any)
- [x] 4.6 Fix `server/routers/users.ts` (1 any)
- [x] 4.7 Run `pnpm check` to verify all server fixes compile

## 5. Client-Side `any` Cleanup (105 occurrences, 20 files)

- [x] 5.1 Fix `client/src/pages/BusinessAnalysis.tsx` (16 any): type chart data and API responses
- [x] 5.2 Fix `client/src/pages/QuotationDetail.tsx` (13 any): type event handlers and tRPC returns
- [x] 5.3 Fix `client/src/components/product/SpecDataTab.tsx` (11 any): type table row data
- [x] 5.4 Fix `client/src/pages/ProductSpecsPage.tsx` (9 any)
- [x] 5.5 Fix `client/src/pages/CategoryStats.tsx` (7 any)
- [x] 5.6 Fix `client/src/lib/quotationExport.ts` (6 any): type ExcelJS worksheet operations
- [x] 5.7 Fix `client/src/components/product/ProductDataContent.tsx` (6 any)
- [x] 5.8 Fix `client/src/components/ProductSelectorDialog.tsx` (5 any)
- [x] 5.9 Fix `client/src/pages/QuotationList.tsx` (5 any)
- [x] 5.10 Fix `client/src/components/TemplateDialog.tsx` (4 any)
- [x] 5.11 Fix `client/src/pages/ActivityLog.tsx` (4 any)
- [x] 5.12 Fix `client/src/pages/Home.tsx` (4 any)
- [x] 5.13 Fix `client/src/pages/Customers.tsx` (3 any)
- [x] 5.14 Fix `client/src/pages/DataViewer.tsx` (3 any)
- [x] 5.15 Fix `client/src/components/QuotationCompare.tsx` (2 any)
- [x] 5.16 Fix remaining files (ImportHistory, ProductDataImport, DashboardLayout, usePersistFn) — 5 any total
- [x] 5.17 Run `pnpm check` to verify all client fixes compile

## 6. Verification

- [ ] 6.1 Run `pnpm check` — zero type errors
- [ ] 6.2 Run `pnpm test` — all existing tests pass
- [ ] 6.3 Run `pnpm db:push` — migration applies cleanly
- [ ] 6.4 Commit all changes
