## ADDED Requirements

### Requirement: User can create AI conversation
The system SHALL allow any authenticated user to create a new AI conversation with a selected mode (local or expert), model, and optional system prompt.

#### Scenario: Create conversation with default model
- **WHEN** user clicks "新对话" button
- **THEN** system creates a new conversation with the default LLM model and expert mode
- **AND** redirects user to the empty conversation view

#### Scenario: Create conversation with specific model and mode
- **WHEN** user selects "本地模式" and chooses a model from the dropdown, then clicks "新对话"
- **THEN** system creates a conversation with the selected model and local mode

### Requirement: User can send messages in conversation
The system SHALL allow users to send text messages (≤10,000 characters) and receive AI responses. The system SHALL store both user messages and AI responses in the database.

#### Scenario: Send message in expert mode
- **WHEN** user types a message and presses Enter or clicks Send
- **THEN** system sends the message along with the last 20 historical messages to the configured LLM
- **AND** displays the AI response with Markdown rendering
- **AND** stores both messages in ai_messages table

#### Scenario: Send message exceeds length limit
- **WHEN** user types a message longer than 10,000 characters
- **THEN** system SHALL NOT send the message and shows a validation error

### Requirement: Conversation title auto-generation
The system SHALL automatically generate a conversation title from the first user message (truncated to 200 characters) if no title is provided.

#### Scenario: First message in new conversation
- **WHEN** user sends the first message in a new conversation
- **THEN** system generates a title from the message content (first 50 characters + "...")
- **AND** updates the conversation record

### Requirement: User can view conversation history
The system SHALL display a sidebar listing all conversations for the current user, sorted by most recently updated. Each item shows title, model name, and mode icon.

#### Scenario: User has multiple conversations
- **WHEN** user opens the AI page
- **THEN** system lists all conversations belonging to the user, newest first
- **AND** each item shows title, model name, and 📁/🌐 mode icon

### Requirement: User can delete own conversation
The system SHALL allow users to delete their own conversations. The system MUST verify userId ownership before deletion.

#### Scenario: Delete own conversation
- **WHEN** user clicks delete on a conversation they created
- **THEN** system deletes the conversation and all associated messages
- **AND** removes the conversation from the sidebar

#### Scenario: Attempt to delete another user's conversation
- **WHEN** user attempts to delete a conversation belonging to another user
- **THEN** system returns a 403 forbidden error
