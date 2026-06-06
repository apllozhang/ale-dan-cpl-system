## ADDED Requirements

### Requirement: User can upload files in local mode
The system SHALL allow users to upload files (PDF, DOCX, XLSX, TXT, CSV) up to 20MB in local mode. The system SHALL extract text content and make it available to the AI.

#### Scenario: Upload PDF file
- **WHEN** user uploads a 2MB PDF file in local mode
- **THEN** system extracts text from the PDF using pdf-parse
- **AND** stores extracted text in the message's attached_files JSON field
- **AND** injects the text into the LLM context

#### Scenario: Upload unsupported format
- **WHEN** user uploads a .exe file
- **THEN** system rejects the upload with error "不支持的文件格式"

#### Scenario: Upload exceeds size limit
- **WHEN** user uploads a 25MB file
- **THEN** system rejects the upload with error "文件大小超过 20MB 限制"

### Requirement: File text is injected into LLM context
The system SHALL prepend extracted file text to the user's message as context. For text exceeding 30K tokens, the system SHALL truncate and notify the user.

#### Scenario: Small file analysis
- **WHEN** user uploads a 5-page PDF and asks "总结这个文档"
- **THEN** system injects the full extracted text into the system prompt
- **AND** AI response references the document content

#### Scenario: Large file truncation
- **WHEN** user uploads a 200-page PDF (> 30K tokens)
- **THEN** system truncates to the first 30K tokens
- **AND** prepends a notice: "文档过长，仅包含前部分内容"
- **AND** AI response is based on the truncated content
