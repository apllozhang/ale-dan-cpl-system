## Context

ALE DAN CPL System is a full-stack enterprise quotation management platform (Express + tRPC + React + Drizzle ORM + MySQL 8). The CEO and engineering reviews identified 5 critical gaps: unhandled DB errors in 14/16 routers, no connection pooling, missing indexes on high-query columns, no request tracing, and no CORS configuration. The codebase has 16 router files, 14 modular DB modules, 11 test files (~98 cases), and 19 frontend pages in a flat structure.

## Goals / Non-Goals

**Goals:**
- Every router mutation catches named errors, never raw `catch (error)`
- Every tRPC request logs: request ID, user ID, action, duration, outcome
- GET /api/health returns 200 when DB reachable, 503 when not
- Rate limiting: 100 req/min per user on mutations, configurable per-endpoint
- DB connection pool with explicit limits and timeout
- Missing indexes added for 7+ columns
- N+1 batch queries replaced with batch WHERE IN
- CORS middleware with restricted origins
- Frontend migrated to features/ structure
- Test count increases by 30%+

**Non-Goals:**
- Distributed rate limiting (single-instance memory store is sufficient)
- Full integration test suite against real DB (unit tests with mocked DB)
- Frontend visual redesign (pure file reorganization)
- API versioning or breaking API changes
- APM/monitoring service integration (structured logs to stdout only)

## Decisions

### D1: Error handling pattern — try-catch with named TRPCError

Wrap every DB operation in try-catch blocks that throw specific `TRPCError` instances. Pattern:
```typescript
try {
  const result = await db.someOperation();
  if (!result) throw new TRPCError({ code: 'NOT_FOUND', message: '...' });
  return result;
} catch (error) {
  if (error instanceof TRPCError) throw error;
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to ...', cause: error });
}
```

**Why not a tRPC middleware for auto-wrapping?** Middleware wraps at the procedure level and can't provide specific error messages per operation. Named errors in each procedure give actionable messages. The middleware approach would produce generic "Operation failed" errors that don't help debugging.

**Alternatives considered:** Express error middleware (too far from tRPC), custom error class hierarchy (over-engineering for 16 routers).

### D2: Connection pooling — mysql2 connectionLimit

Add explicit `connectionLimit: 10`, `connectTimeout: 10000`, and `acquireTimeout: 15000` to the drizzle/mysql2 config in `getDb()`.

**Why not an external pool like PgBouncer?** MySQL doesn't need external poolers at this scale. mysql2's built-in connection pooling is sufficient for the expected load (single-server deployment at extremecloudiq.cn).

### D3: Structured logging — tRPC middleware in trpc.ts

Add a tRPC middleware at the `protectedProcedure` level that logs `{requestId, userId, action, duration, outcome}` as JSON to stdout. Use `crypto.randomUUID()` for request IDs.

**Why not a separate logging library (Winston/Pino)?** `console.log(JSON.stringify({...}))` is sufficient for stdout JSON logging. The deployment environment (Docker/systemd) handles log aggregation. Adding Pino would be a dependency for marginal benefit.

### D4: Rate limiting — in-memory sliding window

Implement a simple in-memory sliding window rate limiter as tRPC middleware. Configurable per-procedure via `meta.rateLimit`. Default: 100 req/min for mutations.

**Why not `rate-limiter-flexible`?** Single-instance deployment means in-memory is sufficient. No Redis needed. A 30-line implementation covers the use case without a dependency.

### D5: CORS — cors package with origin allowlist

Use the `cors` npm package with an explicit origin allowlist from env var `CORS_ORIGINS`. Default: `['https://www.extremecloudiq.cn']`. Enable credentials for cookie-based auth.

### D6: Index migration — Drizzle schema update + db:push

Add indexes in `drizzle/schema.ts` for the 7 identified columns, then run `pnpm db:push` to apply.

### D7: N+1 fix — batch WHERE IN

Replace `for (const id of input.ids) { await db.getById(id) }` with `const items = await db.getByIds(input.ids)` using `inArray()` from Drizzle ORM.

### D8: Frontend reorg — single commit file moves

Migrate `client/src/pages/` to `client/src/features/` with domain-driven subdirectories. Pure file moves + import path updates, no logic changes.

## Risks / Trade-offs

- **[In-memory rate limiting]** → Data lost on server restart. Acceptable: limits reset, no persistent state needed.
- **[Frontend reorg]** → Large diff that touches all page imports. Mitigation: single commit, revertible, no logic changes.
- **[Index migration on production DB]** → Adding indexes on large tables can lock. Mitigation: `db:push` uses online DDL in MySQL 8. Run during low-traffic window.
- **[Error handling in 16 routers]** → Each router changes independently, revertible per-router. No cross-router dependencies.
- **[CORS origin allowlist]** → If env var is misconfigured, API becomes inaccessible. Mitigation: sensible default, documented in CLAUDE.md.
