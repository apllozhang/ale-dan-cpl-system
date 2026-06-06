## ADDED Requirements

### Requirement: Admin can create knowledge bases
The system SHALL allow admin/superAdmin to create named knowledge bases and upload documents to them.

#### Scenario: Create knowledge base
- **WHEN** admin creates a knowledge base named "CPL产品库" with description "DAN产品规格和参数"
- **THEN** system creates the knowledge base record in ai_knowledge_bases table

### Requirement: Admin can upload documents to knowledge base
The system SHALL accept document uploads (PDF, DOCX, XLSX, TXT, CSV) to a knowledge base, extract text, and mark status as processing/ready/failed.

#### Scenario: Upload document to knowledge base
- **WHEN** admin uploads "产品规格表.xlsx" to "CPL产品库"
- **THEN** system extracts text and stores in ai_knowledge_docs with status="ready"
- **AND** chunk_count reflects the number of paragraphs

#### Scenario: Upload fails to extract
- **WHEN** admin uploads a corrupted PDF
- **THEN** system sets status="failed" and shows error message

### Requirement: User can select knowledge base in local mode
The system SHALL allow users to select a knowledge base when in local mode. The system SHALL inject relevant text chunks from the knowledge base into the LLM context.

#### Scenario: Ask question with knowledge base
- **WHEN** user selects "CPL产品库" and asks "S5600交换机的端口速率是多少？"
- **THEN** system searches extracted_text using keyword matching ("S5600", "端口速率")
- **AND** injects the top 3-5 matching paragraphs into context
- **AND** AI response cites the source: "📎 来源: 产品规格表.xlsx"

#### Scenario: No matching content in knowledge base
- **WHEN** user asks a question unrelated to the knowledge base content
- **THEN** AI responds based on general knowledge and notes "知识库中未找到相关内容"
