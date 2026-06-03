## Context

CPL v1.0.1 runs on MySQL 8 via Drizzle ORM. The `activity_logs` table (165 rows in schema.ts) has no secondary indexes despite being filtered by `userId`, `action`, `resourceType`, and `createdAt` in every query. The eFlash import processes rows one-by-one with individual SELECT+INSERT/UPDATE calls and no transaction wrapper. Product search applies `LIKE '%term%'` across 11 columns including `listPrice` (a numeric field). The codebase has 127 `any` type annotations (105 client, 22 server) violating the CLAUDE.md rule forbidding `any`.

## Goals / Non-Goals

**Goals:**
- Reduce activity_logs query latency by adding covering indexes
- Reduce eFlash import from ~1000 DB calls to ~10, with transaction safety
- Eliminate pointless LIKE on listPrice, add prefix-match for productModel
- Replace all `any` with proper types across server and client

**Non-Goals:**
- No FULLTEXT index migration (can be done later if needed)
- No React.lazy code splitting (separate change)
- No QueryClient caching config (separate change)
- No frontend test coverage (separate change)

## Decisions

### 1. Activity_logs: composite index vs individual indexes
**Decision:** Single composite index `(createdAt, userId, action)` plus separate `(resourceType, createdAt)`
**Rationale:** Queries always sort by `createdAt DESC` and typically filter by userId and/or action. A composite index covers the most common query pattern. The separate resourceType index covers admin filtering.
**Alternative:** Individual indexes on each column — rejected because MySQL can only use one index per table in a query, so individual indexes don't help composite filters.

### 2. eFlash import: batch prefetch + transaction
**Decision:** Fetch all existing eflashIds in one SELECT, partition into insert/update arrays, batch insert, loop updates, wrap in `db.transaction()`
**Rationale:** Drizzle ORM supports `db.transaction()` via callback. Batch insert is a single call. Updates still need a loop (no bulk update in Drizzle for MySQL without raw SQL), but the total DB calls drop from ~1000 to ~10 + updateCount.
**Alternative:** Raw SQL `INSERT ... ON DUPLICATE KEY UPDATE` — rejected because it bypasses Drizzle's type safety and the performance gain is marginal for typical imports (50-500 rows).

### 3. Product search: remove listPrice LIKE, keep prefix-match on productModel
**Decision:** Remove `listPrice` from the LIKE OR chain. No other column changes.
**Rationale:** Searching a price column with `LIKE '%500%'` returns false positives (matches 1500, 5000, etc.) and prevents index use. Removing it is pure improvement with no downside. Not adding prefix-match on other columns because `%term%` is the user expectation for general search.
**Alternative:** Add FULLTEXT index — deferred. Current product table size doesn't justify the migration complexity.

### 4. any cleanup strategy
**Decision:** Fix router output types first (benefits flow to frontend via tRPC inference), then fix frontend event handlers and local variables. Use `Record<string, unknown>` for truly dynamic JSON.
**Rationale:** Router type fixes cascade to all consumers. Event handlers are mostly `(e: React.ChangeEvent<HTMLInputElement>)` patterns. JSON snapshots from version tracking can use `Record<string, unknown>`.
**Priority order:** servers/routers > server/db > client/pages > client/components

## Risks / Trade-offs

- **Index migration on large table** → Risk: locks table during index creation. Mitigation: `activity_logs` is typically small (<10K rows). Use `ALGORITHM=INPLACE` if table is large.
- **Transaction rollback on eFlash import** → Risk: if one row fails validation, entire batch rolls back. Mitigation: validate all rows first (type normalization), then transactional write. Return per-row errors from validation, not from DB.
- **any cleanup** → Risk: might uncover hidden type errors that were masked. Mitigation: run `pnpm check` after each file, fix any revealed issues.
- **No FULLTEXT** → Trade-off: search still uses LIKE for non-productModel columns. Acceptable for current data volume.
