## ADDED Requirements

### Requirement: All router DB operations use named error handling
Every tRPC router SHALL wrap DB operations in try-catch blocks that throw specific `TRPCError` instances with named error codes and actionable messages.

#### Scenario: DB query returns no result
- **WHEN** a protected procedure queries the database for a resource by ID and the result is null/undefined
- **THEN** the procedure SHALL throw `TRPCError({ code: 'NOT_FOUND', message: '<ResourceType> not found' })`

#### Scenario: DB connection fails during operation
- **WHEN** a database operation throws a connection error or query execution error
- **THEN** the procedure SHALL catch the error, re-throw if already TRPCError, otherwise throw `TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to <action>', cause: error })`

#### Scenario: Permission check fails
- **WHEN** a user attempts to mutate a resource they do not own and are not admin/sales_manager
- **THEN** the procedure SHALL throw `TRPCError({ code: 'FORBIDDEN', message: 'Not authorized to <action>' })`

#### Scenario: Input validation fails at business logic level
- **WHEN** input passes Zod schema validation but fails a business rule (e.g., invalid status transition)
- **THEN** the procedure SHALL throw `TRPCError({ code: 'BAD_REQUEST', message: '<specific reason>' })`

### Requirement: Error messages never expose internal details
Error messages returned to clients SHALL NOT include stack traces, SQL queries, table names, or raw database error messages.

#### Scenario: MySQL constraint violation
- **WHEN** a DB operation throws a MySQL constraint error (e.g., duplicate key)
- **THEN** the error SHALL be caught and re-thrown as `TRPCError({ code: 'CONFLICT', message: '<resource> already exists' })` without exposing the SQL or constraint name
