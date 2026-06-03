## ADDED Requirements

### Requirement: Transactional batch import for eFlash
The system SHALL import eFlash records in a single database transaction, using batch operations instead of row-by-row queries.

#### Scenario: Import 500 new records
- **WHEN** importing 500 eFlash records where none exist in the database
- **THEN** the system SHALL issue at most 2 database calls: 1 batch SELECT (prefetch existing) + 1 batch INSERT
- **THEN** if any record fails, all records SHALL be rolled back

#### Scenario: Import with mixed new and existing records
- **WHEN** importing 300 records where 100 already exist
- **THEN** the system SHALL prefetch existing IDs in a single SELECT, batch-insert 200 new records, and update 100 existing records individually within the same transaction

#### Scenario: Import fails mid-way
- **WHEN** a database error occurs while writing records
- **THEN** all changes from this import SHALL be rolled back
- **THEN** the error SHALL be returned with row number and reason

### Requirement: Type-safe codebase
The system SHALL NOT contain `any` type annotations in TypeScript files.

#### Scenario: Router output types
- **WHEN** a tRPC router defines a query or mutation
- **THEN** the return type SHALL be inferred from the implementation, not declared as `any`

#### Scenario: Frontend event handlers
- **WHEN** a React component handles DOM events
- **THEN** the event parameter SHALL use the specific event type (e.g., `React.ChangeEvent<HTMLInputElement>`)

#### Scenario: Dynamic JSON data
- **WHEN** handling version snapshots or other dynamic JSON
- **THEN** the type SHALL be `Record<string, unknown>` or a specific interface, never `any`
