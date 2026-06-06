## ADDED Requirements

### Requirement: AI can trigger web search in expert mode
The system SHALL expose a web_search tool to the LLM in expert mode. When the LLM returns a tool_call for web_search, the system SHALL execute the search via the configured search provider and inject results back into context.

#### Scenario: AI decides to search
- **WHEN** user asks "最新的 DAN S5600 固件版本是什么？" in expert mode
- **THEN** system sends messages to LLM with web_search tool defined
- **AND** LLM returns tool_call: { name: "web_search", arguments: { query: "DAN S5600 firmware latest version" } }
- **AND** system executes search via configured provider
- **AND** system sends search results back as tool result
- **AND** LLM generates final response citing the sources

#### Scenario: AI decides not to search
- **WHEN** user asks "帮我写一个 SQL 查询" in expert mode
- **THEN** LLM responds directly without triggering web_search tool

### Requirement: Search results are displayed as inline cards
The system SHALL display search results as a collapsible card showing source title, URL, and snippet below the AI response.

#### Scenario: Response with search results
- **WHEN** AI response includes search_results JSON
- **THEN** system renders a 📎 card showing "搜索了: <query>" with expandable source list
- **AND** each source shows title + domain as clickable link

### Requirement: Search daily limit enforcement
The system SHALL enforce the configured daily_limit on search API calls. When limit is exceeded, the system SHALL return an error message instead of executing the search.

#### Scenario: Daily limit exceeded
- **WHEN** global search count for today reaches daily_limit (e.g., 1000)
- **THEN** system skips the search call
- **AND** AI responds: "今日搜索次数已达上限，无法执行联网搜索"

### Requirement: Multiple search providers supported
The system SHALL support Serper, SerpAPI, Tavily, Bing, Google Custom Search, and custom endpoints via provider enum dispatch.

#### Scenario: Switch search provider
- **WHEN** admin sets SerpAPI as default (was Serper)
- **THEN** subsequent expert mode conversations use SerpAPI for searches
