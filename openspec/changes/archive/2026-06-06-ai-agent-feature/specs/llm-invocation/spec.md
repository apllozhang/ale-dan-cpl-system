## MODIFIED Requirements

### Requirement: invokeLLM supports multiple providers
The system SHALL accept an optional `providerConfig` parameter on `invokeLLM`. When provided, the system SHALL route the request to the configured provider's API endpoint. When not provided, the system SHALL use the existing forge.manus.im endpoint (backward compatible).

#### Scenario: Call with provider config
- **WHEN** invokeLLM is called with providerConfig = { provider: "openai_compatible", apiBaseUrl: "https://api.deepseek.com/v1", apiKey: "sk-xxx", modelName: "deepseek-chat" }
- **THEN** system sends the request to https://api.deepseek.com/v1/chat/completions with the provided API key
- **AND** returns InvokeResult in the same format as existing calls

#### Scenario: Call without provider config (backward compatible)
- **WHEN** invokeLLM is called without providerConfig
- **THEN** system uses the existing forge.manus.im endpoint and Gemini 2.5 Flash model
- **AND** existing callers continue to work without changes

### Requirement: Stream LLM responses
The system SHALL provide a `streamLLM` async generator function that yields text chunks from the LLM in real-time via SSE parsing.

#### Scenario: Stream response
- **WHEN** streamLLM is called with valid params and providerConfig
- **THEN** system opens a streaming connection to the provider
- **AND** yields each text delta as it arrives
- **AND** terminates when "data: [DONE]" is received
