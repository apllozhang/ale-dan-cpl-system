## MODIFIED Requirements

### Requirement: CPL API authentication
All CPL data endpoints SHALL require authenticated access.

#### Scenario: Unauthenticated request
- **WHEN** a request is made to any CPL endpoint without a valid session cookie
- **THEN** the system SHALL return UNAUTHORIZED (401)
- **THEN** no data SHALL be returned

#### Scenario: Authenticated request
- **WHEN** a logged-in user requests CPL data
- **THEN** the system SHALL return data as before (no behavior change)
- **THEN** all existing filters, pagination, and sorting work unchanged

#### Scenario: Import endpoint
- **WHEN** a non-superAdmin user attempts to import CPL data
- **THEN** the system SHALL return FORBIDDEN (403) (unchanged behavior)
