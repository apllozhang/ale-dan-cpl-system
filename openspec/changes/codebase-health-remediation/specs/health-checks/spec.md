## ADDED Requirements

### Requirement: Health check endpoint returns DB reachability status
The system SHALL expose `GET /api/health` that returns HTTP 200 with JSON `{"status":"ok","db":"connected"}` when the database is reachable, and HTTP 503 with `{"status":"degraded","db":"unreachable"}` when the database is not reachable.

#### Scenario: Database is reachable
- **WHEN** a GET request is made to `/api/health` and the database connection is active
- **THEN** the response SHALL be HTTP 200 with body `{"status":"ok","db":"connected","timestamp":"<ISO8601>"}`

#### Scenario: Database is unreachable
- **WHEN** a GET request is made to `/api/health` and the database connection fails
- **THEN** the response SHALL be HTTP 503 with body `{"status":"degraded","db":"unreachable","timestamp":"<ISO8601>"}`

### Requirement: Readiness endpoint returns liveness status
The system SHALL expose `GET /api/ready` that returns HTTP 200 when the Express server is running and accepting connections.

#### Scenario: Server is running
- **WHEN** a GET request is made to `/api/ready`
- **THEN** the response SHALL be HTTP 200 with body `{"ready":true,"timestamp":"<ISO8601>"}`

### Requirement: Health endpoints do not require authentication
Both `/api/health` and `/api/ready` SHALL be accessible without authentication (not behind tRPC or session middleware).

#### Scenario: Unauthenticated request to health endpoint
- **WHEN** a GET request is made to `/api/health` without a session cookie
- **THEN** the response SHALL be HTTP 200 (or 503 if DB unreachable) without requiring login
