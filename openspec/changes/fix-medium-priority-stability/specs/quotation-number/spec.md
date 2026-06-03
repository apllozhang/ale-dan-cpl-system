## MODIFIED Requirements

### Requirement: Atomic quotation number generation
The system SHALL generate quotation numbers atomically to prevent duplicate numbers under concurrent requests.

#### Scenario: Normal creation
- **WHEN** a user creates a quotation on 2026-06-03
- **THEN** the system generates `QT-20260603-001` (or next available sequence)
- **THEN** the number is guaranteed unique at the database level

#### Scenario: Concurrent creation
- **WHEN** two users simultaneously create quotations on the same day
- **THEN** each receives a different sequential number (e.g., `QT-20260603-001` and `QT-20260603-002`)
- **THEN** no duplicate `quotationNo` values are ever produced

#### Scenario: First quotation of the day
- **WHEN** the first quotation is created on a new day
- **THEN** the sequence starts at 001
