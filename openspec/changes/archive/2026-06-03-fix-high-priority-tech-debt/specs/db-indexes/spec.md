## ADDED Requirements

### Requirement: Activity logs query performance
The system SHALL provide database indexes that cover the standard query patterns for `activity_logs` filtering by `createdAt`, `userId`, `action`, and `resourceType`.

#### Scenario: Filter by user and date range
- **WHEN** querying activity logs with `userId` filter and `ORDER BY createdAt DESC`
- **THEN** the query SHALL use the composite index `(createdAt, userId, action)` and not perform a full table scan

#### Scenario: Filter by action type
- **WHEN** querying activity logs with `action` and `resourceType` filters
- **THEN** the query SHALL use the covering indexes to avoid full table scan

#### Scenario: Migration is zero-downtime
- **WHEN** the index migration runs on an existing database
- **THEN** no data SHALL be modified, deleted, or reordered
- **THEN** the migration SHALL be idempotent (safe to run multiple times)

### Requirement: Product search excludes price from LIKE
The system SHALL NOT apply LIKE pattern matching to the `listPrice` column during product search.

#### Scenario: Search with numeric-looking term
- **WHEN** user searches for "500" in product data
- **THEN** the system SHALL search all text columns but SHALL NOT match `listPrice` values like 500, 1500, 5000

#### Scenario: Search with model name
- **WHEN** user searches for "AP5010"
- **THEN** the system SHALL return matching products via LIKE on text columns as before
