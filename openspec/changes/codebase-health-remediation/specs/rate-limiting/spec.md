## ADDED Requirements

### Requirement: tRPC mutations are rate-limited per user
All tRPC mutation procedures SHALL be rate-limited to a configurable maximum number of requests per time window per authenticated user.

#### Scenario: User within rate limit
- **WHEN** a user makes mutation requests below the configured threshold (default: 100 req/min)
- **THEN** all requests SHALL be processed normally

#### Scenario: User exceeds rate limit
- **WHEN** a user exceeds the configured mutation rate limit
- **THEN** the system SHALL respond with `TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Try again in <seconds>s' })`

### Requirement: Rate limits are configurable per-procedure
Individual tRPC procedures MAY override the default rate limit via procedure `meta.rateLimit` configuration.

#### Scenario: Custom rate limit on login
- **WHEN** the login procedure has `meta: { rateLimit: { max: 5, windowMs: 900000 } }` (5 per 15 min)
- **THEN** the login endpoint SHALL enforce 5 requests per 15 minutes, overriding the default 100/min

### Requirement: Share token and suggestion endpoints are rate-limited
The `sharing.getByToken` and `suggestions.*` procedures SHALL have explicit rate limiting to prevent brute-force and enumeration attacks.

#### Scenario: Brute-force attempt on share tokens
- **WHEN** more than 20 requests per minute are made to `sharing.getByToken`
- **THEN** subsequent requests SHALL be rejected with rate limit error
