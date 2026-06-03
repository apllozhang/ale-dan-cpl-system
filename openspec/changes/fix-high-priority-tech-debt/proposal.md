## Why

Cloud deployment reports performance issues and import failures. Root cause analysis reveals four systemic problems: unindexed queries causing slow page loads, eFlash import doing 500+ individual DB calls without transaction safety, product search scanning all rows via LIKE on 11 columns, and 127 `any` types violating the project's TypeScript strictness rule and hiding runtime errors.

## What Changes

- Add database indexes on `activity_logs` table for `createdAt`, `userId`, and `action` columns used in every query filter
- Remove `listPrice` from LIKE search (price field should not be fuzzy-matched) and add `productModel` prefix-match optimization
- Rewrite `importEFlashFromRows` to batch-prefetch existing records and wrap the entire import in a database transaction
- Replace `any` types with proper TypeScript types across 27 files (105 client, 22 server), prioritizing tRPC router output types and event handler types

## Capabilities

### New Capabilities
- `db-indexes`: Database index coverage for frequently queried tables (activity_logs, future: others as needed)
- `batch-import`: Transactional batch import pattern for bulk data operations

### Modified Capabilities
<!-- No existing specs to modify — this is a new OpenSpec project -->

## Impact

- **Database**: One migration file adding 2-3 indexes on `activity_logs`. Zero data changes.
- **Server**: `server/db/eflash.ts` (import function rewrite), `server/db/cpl.ts` (search query), `server/routers/*.ts` + `client/src/**` (type cleanup)
- **API**: No breaking changes — all endpoints keep the same input/output shapes
- **Dependencies**: None — uses existing Drizzle ORM transaction API
