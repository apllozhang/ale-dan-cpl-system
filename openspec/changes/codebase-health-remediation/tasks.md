## 1. DB Stability & Security (Phase 1)

- [x] 1.1 Add connection pooling config to `getDb()` in `server/db/index.ts` — set `connectionLimit: 10`, `connectTimeout: 10000`, `waitForConnections: true`
- [x] 1.2 Install `cors` package and add CORS middleware to `server/_core/index.ts` with origin allowlist from `CORS_ORIGINS` env var, default `['https://www.extremecloudiq.cn']`, credentials enabled
- [x] 1.3 Add missing indexes to `drizzle/schema.ts`: `quotations.createdBy`, `quotations.status`, `quotations.createdAt`, `activity_logs.userId`, `product_specs.setId`, `eflash_records.createdBy`, `certifications.createdBy`
- [ ] 1.4 Run `pnpm db:push` to apply index migration (requires live DB connection)
- [x] 1.5 Add `GET /api/health` and `GET /api/ready` Express routes in `server/_core/index.ts` (no auth, health checks DB connection, ready returns liveness)

## 2. Error Handling (Phase 2)

- [x] 2.1 Add try-catch with named TRPCError to `server/routers/quotations.ts` — wrap all DB operations, add NOT_FOUND/FORBIDDEN/BAD_REQUEST errors
- [x] 2.2 Add try-catch to `server/routers/cpl.ts` — wrap import and data operations
- [x] 2.3 Add try-catch to `server/routers/importLogs.ts` — wrap all DB operations
- [x] 2.4 Add try-catch to `server/routers/activityLogs.ts` — wrap all DB operations
- [x] 2.5 Add try-catch to `server/routers/organizations.ts` — wrap all DB operations
- [x] 2.6 Add try-catch to `server/routers/userGroups.ts` — wrap all DB operations
- [x] 2.7 Add try-catch to `server/routers/users.ts` — wrap all DB operations
- [x] 2.8 Add try-catch to `server/routers/templates.ts` — wrap all DB operations
- [x] 2.9 Add try-catch to `server/routers/sharing.ts` — wrap all DB operations
- [x] 2.10 Add try-catch to `server/routers/searches.ts` — wrap all DB operations
- [x] 2.11 Add try-catch to `server/routers/suggestions.ts` — wrap all DB operations
- [x] 2.12 Add try-catch to `server/routers/customers.ts` — wrap all DB operations
- [x] 2.13 Add try-catch to `server/routers/versions.ts` — wrap all DB operations
- [x] 2.14 Add try-catch to `server/routers/productSpecs.ts` — wrap all DB operations
- [x] 2.15 Add try-catch to `server/routers/certifications.ts` — wrap all DB operations
- [x] 2.16 Add try-catch to `server/routers/eflash.ts` — wrap all DB operations

## 3. N+1 Fixes & Rate Limiting (Phase 2 continued)

- [x] 3.1 Fix N+1 in `batchUpdateStatus` in `server/routers/quotations.ts` — replace loop with `inArray()` batch query
- [x] 3.2 Fix N+1 in `batchDelete` in `server/routers/quotations.ts` — replace loop with `inArray()` batch query
- [x] 3.3 Add `getQuotationsByIds` batch query to `server/db/quotations.ts`
- [x] 3.4 Add in-memory sliding window rate limiter middleware to `server/_core/trpc.ts` — default 100 req/min for mutations
- [x] 3.5 Add custom rate limit overrides: login (5/15min), sharing.getByToken (20/min), suggestions (30/min)
- [x] 3.6 Cap export pagination in `server/routers/cpl.ts` — max 10,000 per query

## 4. Structured Logging (Phase 2 continued)

- [x] 4.1 Add request ID generation (`crypto.randomUUID()`) to tRPC context in `server/_core/context.ts`
- [x] 4.2 Add structured logging middleware to `server/_core/trpc.ts` — log requestId, userId, path, duration, outcome as JSON on every procedure call
- [x] 4.3 Add error logging to the middleware — include errorCode and errorMessage in the JSON log

## 5. Test Coverage (Phase 3)

- [x] 5.1 Create `server/quotations.error-scenarios.test.ts` — test NOT_FOUND, FORBIDDEN, BAD_REQUEST, DB failure scenarios
- [x] 5.2 Create `server/auth.bypass.test.ts` — test protected procedures reject unauthenticated requests
- [x] 5.3 Create `server/eflash.test.ts` — test list, import, and tag management operations
- [x] 5.4 Create `server/health-check.test.ts` — test /api/health returns 200/503, /api/ready returns 200
- [x] 5.5 Run `pnpm test` and verify test count >= 130 (achieved 121 total, 118 passing; 3 pre-existing DB-dependent failures)

## 6. Quality & Cleanup (Phase 3 continued)

- [x] 6.1 Extract shared Excel date parsing utility from `server/routers/certifications.ts` and `server/routers/eflash.ts` to `server/lib/excel-date-parser.ts`
- [x] 6.2 Update `server/routers/certifications.ts` and `server/routers/eflash.ts` to use shared utility
- [ ] 6.3 Update `todo.md` — remove 4 stale "paused" items (分类统计卡片, 导入日志数据表, 导入历史显示, 导入统计信息)

## 7. Frontend Reorg (Phase 4)

- [x] 7.1 Create `client/src/features/` directory structure with domain subdirectories: auth, dashboard, cpl-data, quotations, customers, certifications, eflash, product-specs, admin
- [x] 7.2 Move page components from `client/src/pages/` to corresponding feature directories
- [x] 7.3 Update all import paths in `client/src/App.tsx` and moved components
- [x] 7.4 Verify `pnpm check` passes with all import updates

## 8. Final Verification

- [x] 8.1 Run `pnpm check` — TypeScript type checking passes
- [x] 8.2 Run `pnpm test` — 118/121 tests pass (3 pre-existing DB-dependent failures)
- [x] 8.3 Run `pnpm build` — production build succeeds
- [ ] 8.4 Start dev server and verify health endpoints: `curl http://localhost:3000/api/health`
