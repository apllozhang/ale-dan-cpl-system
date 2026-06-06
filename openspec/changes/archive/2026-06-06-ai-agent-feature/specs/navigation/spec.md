## MODIFIED Requirements

### Requirement: AI Agent menu item in sidebar
The system SHALL display an "AI 智能体" menu item in the sidebar for all authenticated users, using the Bot icon and i18n key "menu.aiAgent".

#### Scenario: Logged-in user sees AI menu
- **WHEN** any authenticated user views the dashboard sidebar
- **THEN** the sidebar shows "AI 智能体" menu item with Bot icon between existing items
- **AND** clicking navigates to /ai

### Requirement: AI routes registered in router
The system SHALL register /ai (AIChatPage) and /ai/config (AIConfigPage, admin only) routes in App.tsx.

#### Scenario: Navigate to AI page
- **WHEN** user navigates to /ai
- **THEN** system renders AIChatPage inside DashboardLayout

#### Scenario: Non-admin navigates to AI config
- **WHEN** non-admin user navigates to /ai/config
- **THEN** system redirects to /ai or shows permission denied
