## ADDED Requirements

### Requirement: Every tRPC request is logged with structured JSON
Every tRPC procedure invocation SHALL produce a JSON log entry containing requestId, userId, procedure path, duration (ms), and outcome (success/error).

#### Scenario: Successful procedure call
- **WHEN** a protected procedure completes successfully
- **THEN** the system SHALL log `{"requestId":"<uuid>","userId":<id>","path":"<router.procedure>","duration":<ms>,"outcome":"success","timestamp":"<ISO8601>"}` to stdout

#### Scenario: Procedure call throws error
- **WHEN** a protected procedure throws a TRPCError
- **THEN** the system SHALL log `{"requestId":"<uuid>","userId":<id>","path":"<router.procedure>","duration":<ms>,"outcome":"error","errorCode":"<TRPCError code>","errorMessage":"<message>","timestamp":"<ISO8601>"}` to stdout

#### Scenario: Request ID propagation
- **WHEN** a tRPC request arrives
- **THEN** the system SHALL generate a unique request ID via `crypto.randomUUID()` and make it available in the tRPC context

### Requirement: Log format is machine-parseable JSON
All structured log entries SHALL be single-line JSON objects parseable by standard log aggregation tools (e.g., Docker logs, systemd journal).

#### Scenario: Log aggregation compatibility
- **WHEN** structured logs are written to stdout
- **THEN** each log line SHALL be a valid JSON object on a single line with no line breaks within the JSON
