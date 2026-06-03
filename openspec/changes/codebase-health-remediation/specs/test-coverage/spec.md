## ADDED Requirements

### Requirement: Error scenario tests for critical routers
The test suite SHALL include error scenario tests for quotation and auth routers that verify: DB connection failure handling, NOT_FOUND responses, FORBIDDEN responses for unauthorized mutations, and BAD_REQUEST for invalid status transitions.

#### Scenario: Quotation update by non-owner
- **WHEN** a non-owner, non-admin user attempts to update a quotation
- **THEN** the test SHALL verify the procedure throws TRPCError with code FORBIDDEN

#### Scenario: Quotation not found
- **WHEN** a procedure queries a non-existent quotation ID
- **THEN** the test SHALL verify the procedure throws TRPCError with code NOT_FOUND

### Requirement: eFlash router has test coverage
The test suite SHALL include tests for the eFlash router covering: list, import, and tag management operations.

#### Scenario: eFlash list returns records
- **WHEN** the eFlash list endpoint is called with valid auth
- **THEN** the test SHALL verify the response shape includes records with expected fields

### Requirement: Auth bypass tests exist
The test suite SHALL include tests that verify protected procedures reject unauthenticated requests.

#### Scenario: Unauthenticated mutation attempt
- **WHEN** a mutation procedure (e.g., quotations.create) is called without a valid session
- **THEN** the test SHALL verify the procedure throws UNAUTHORIZED error

### Requirement: Test count increases by 30%
After all tests are added, the total test count SHALL be at least 130 (from current ~98).

#### Scenario: Test count verification
- **WHEN** `pnpm test` is run
- **THEN** the total test count SHALL be at least 130, all passing
