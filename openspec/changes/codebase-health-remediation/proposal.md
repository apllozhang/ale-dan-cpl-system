## Why

The codebase has accumulated critical stability and security gaps: 14/16 routers lack error handling (raw DB errors leak to clients), DB connections have no pooling (risk of exhaustion under load), 7+ query columns lack indexes, no request tracing exists for debugging production incidents, no health check endpoints exist for uptime monitoring, rate limiting covers only login, N+1 batch queries cause performance degradation, and no CORS middleware is configured in production. The CEO and engineering reviews identified 13 tasks across 5 critical gaps.

## What Changes

- Add named error handling (try-catch with TRPCError) to all 16 router files, replacing raw `catch (error)` blocks
- Add connection pooling config to `getDb()` in `server/db/index.ts`
- Add missing DB indexes for `quotations.createdBy`, `quotations.status`, `quotations.createdAt`, `activity_logs.userId`, `product_specs.setId`, and other high-query columns
- Add structured JSON logging with request ID, user ID, action, and duration to tRPC context
- Add `GET /api/health` (DB reachability check) and `GET /api/ready` (liveness) endpoints
- Add rate limiting middleware for tRPC mutations, share tokens, and suggestion endpoints (configurable per-endpoint)
- Add CORS middleware with restricted origins
- Fix N+1 queries in `batchUpdateStatus` and `batchDelete` (replace loop-per-item with batch WHERE IN)
- Add streaming/pagination to large data exports (capped at 50K rows currently)
- Extract shared Excel date parsing utility (DRY violation between certifications and eFlash routers)
- Add error scenario tests and eFlash router tests
- Migrate frontend from flat `pages/` to domain-driven `features/` structure
- Update `todo.md`: remove 4 stale "paused" items

## Capabilities

### New Capabilities
- `error-handling`: Named error boundaries for all 16 tRPC routers with consistent TRPCError patterns
- `structured-logging`: JSON logging with request ID, user ID, action, duration, and outcome in tRPC context
- `health-checks`: Express endpoints for DB reachability and liveness monitoring
- `rate-limiting`: Configurable per-endpoint rate limiting middleware for tRPC procedures
- `db-performance`: Connection pooling, missing indexes, N+1 batch query fixes, export pagination
- `cors-security`: CORS middleware with origin allowlist and credentials support
- `test-coverage`: Error scenario tests, auth bypass tests, eFlash router tests, edge case coverage

### Modified Capabilities
(none — no existing specs)

## Impact

- **Backend**: All 16 router files modified, `server/db/index.ts`, `server/_core/trpc.ts`, `server/_core/context.ts`, `server/_core/index.ts`, `drizzle/schema.ts`
- **Frontend**: `client/src/pages/` restructured to `client/src/features/`, `client/src/App.tsx` import paths updated
- **Dependencies**: Likely adds `cors` package, possible `rate-limiter-flexible` or custom middleware
- **Tests**: New test files for error scenarios, eFlash router, auth bypass
- **DB**: New migration for indexes on `quotations`, `activity_logs`, `product_specs` columns
- **Risk**: Error handling changes are per-router and revertible independently. Frontend reorg is pure file moves + import updates, single revertible commit. Rate limiting behind config flag.
