## ADDED Requirements

### Requirement: DB connection uses explicit connection pool
`getDb()` in `server/db/index.ts` SHALL configure mysql2 with explicit `connectionLimit`, `connectTimeout`, and `acquireTimeout` parameters.

#### Scenario: Concurrent requests under load
- **WHEN** 50 concurrent tRPC requests arrive simultaneously
- **THEN** the connection pool SHALL queue requests beyond `connectionLimit` (default: 10) and acquire connections within `acquireTimeout` (default: 15s)

#### Scenario: Connection acquisition timeout
- **WHEN** no connection is available within the acquire timeout
- **THEN** the system SHALL throw `TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database busy, try again' })`

### Requirement: Missing indexes are added for high-query columns
The schema SHALL include indexes on: `quotations.createdBy`, `quotations.status`, `quotations.createdAt`, `activity_logs.userId`, `product_specs.setId`, `eflash_records.createdBy`, `certifications.createdBy`.

#### Scenario: Quotation list filtered by user
- **WHEN** a user queries quotations filtered by `createdBy` (their own quotations)
- **THEN** the query SHALL use the `quotations_createdBy_idx` index and complete in < 50ms for tables under 100K rows

### Requirement: Batch operations use single query instead of N+1
`batchUpdateStatus` and `batchDelete` in `server/routers/quotations.ts` SHALL use a single DB query with `WHERE id IN (...)` instead of looping individual queries.

#### Scenario: Batch update 10 quotations
- **WHEN** `batchUpdateStatus` is called with 10 quotation IDs
- **THEN** the system SHALL execute at most 2 DB queries (1 batch fetch + 1 batch update) instead of 10+1 queries

### Requirement: Large data exports are paginated
Export endpoints SHALL NOT load more than 10,000 records in a single query.

#### Scenario: Export CPL products exceeding 10K rows
- **WHEN** a user exports CPL product data and the total exceeds 10,000 records
- **THEN** the system SHALL paginate the export in batches of 10,000, streaming results to the client
