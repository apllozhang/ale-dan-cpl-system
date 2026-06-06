## ADDED Requirements

### Requirement: Admin can create LLM model configuration
The system SHALL allow admin/superAdmin users to create LLM provider configurations with name, provider type, API base URL, API key, model name, and optional parameters (max tokens, temperature). API keys SHALL be encrypted with AES-256-GCM before storage.

#### Scenario: Create new model config
- **WHEN** admin fills in the model form (name="DeepSeek V4", provider="openai_compatible", apiBaseUrl="https://api.deepseek.com/v1", apiKey="sk-xxx", modelName="deepseek-chat") and clicks Save
- **THEN** system encrypts the API key and stores the configuration in ai_provider_configs table
- **AND** returns the created config with API key masked (sk-7f3d...a1b2)

#### Scenario: Non-admin attempts to create model
- **WHEN** a non-admin user calls models.create mutation
- **THEN** system returns a 403 permission error

### Requirement: Admin can test model connectivity
The system SHALL allow admin to test a model configuration by sending a minimal request ("Hi") and reporting success/failure with latency.

#### Scenario: Successful connectivity test
- **WHEN** admin clicks "测试" on a valid model config
- **THEN** system decrypts the API key, sends "Hi" to the configured endpoint
- **AND** returns { success: true, model: "deepseek-chat", latencyMs: 1234 }

#### Scenario: Failed connectivity test
- **WHEN** admin clicks "测试" on an invalid config (wrong API key)
- **THEN** system returns { success: false, error: "401 Unauthorized" }

### Requirement: Admin can create search service configuration
The system SHALL allow admin to configure search API providers (Serper, SerpAPI, Tavily, Bing, Google Custom, or custom) with name, API base URL, API key, extra params, and daily limit.

#### Scenario: Create Serper config
- **WHEN** admin creates a search config with provider="serper", apiBaseUrl="https://google.serper.dev/search", apiKey="xxx"
- **THEN** system encrypts the API key and stores the configuration

#### Scenario: Test search service
- **WHEN** admin clicks "测试搜索" with query "test"
- **THEN** system executes a real search and returns { success: true, resultCount: 5, latencyMs: 300, sampleResult: "..." }

### Requirement: API keys are never returned in plaintext
The system SHALL mask API keys in all API responses to show only first 4 and last 4 characters.

#### Scenario: List model configs
- **WHEN** admin calls models.list
- **THEN** each config's apiKey field shows "sk-7f3d...a1b2" format, never the full key

### Requirement: Exactly one default model
The system SHALL ensure at most one model config has isDefault=true. When setting a model as default, the system MUST clear isDefault on all other configs.

#### Scenario: Set new default model
- **WHEN** admin sets model B as default while model A was default
- **THEN** model A's isDefault becomes false, model B's isDefault becomes true
