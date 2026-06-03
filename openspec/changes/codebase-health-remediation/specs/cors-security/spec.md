## ADDED Requirements

### Requirement: CORS middleware restricts origins
The Express server SHALL use CORS middleware with an explicit origin allowlist configured via the `CORS_ORIGINS` environment variable (comma-separated).

#### Scenario: Request from allowed origin
- **WHEN** a request arrives with `Origin: https://www.extremecloudiq.cn`
- **THEN** the response SHALL include `Access-Control-Allow-Origin: https://www.extremecloudiq.cn` and `Access-Control-Allow-Credentials: true`

#### Scenario: Request from disallowed origin
- **WHEN** a request arrives with `Origin: https://evil.example.com`
- **THEN** the response SHALL NOT include `Access-Control-Allow-Origin` header

#### Scenario: No CORS_ORIGINS env var set
- **WHEN** the `CORS_ORIGINS` environment variable is not set
- **THEN** the default allowlist SHALL be `['https://www.extremecloudiq.cn']`

### Requirement: CORS allows credentials for cookie-based auth
The CORS configuration SHALL allow `credentials: true` to support the `app_session_id` cookie used for authentication.

#### Scenario: Preflight request includes credentials
- **WHEN** a preflight OPTIONS request includes `Access-Control-Request-Headers: Content-Type` and the client sends cookies
- **THEN** the CORS preflight response SHALL include `Access-Control-Allow-Credentials: true`
