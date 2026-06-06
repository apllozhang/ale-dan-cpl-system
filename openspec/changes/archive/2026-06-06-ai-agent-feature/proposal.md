## Why

CPL 系统目前缺少 AI 辅助能力。销售团队在处理报价时需要手动查询产品参数、搜索竞品信息、分析上传的报价文档——这些场景 AI 可以大幅提效。同时现有 `llm.ts` 已硬编码 Gemini，无法灵活切换国产模型（DeepSeek V4、Mimo 2.5 Pro 等），存在供应商锁定风险。

## What Changes

- 新增 **AI 智能体**主菜单项（`/ai`），包含双模式对话页面（本地模式 + 专家模式）
- 新增 **模型配置管理页**（`/ai/config`，仅管理员），支持手动添加/编辑/测试第三方 LLM API（OpenAI 兼容协议）和搜索 API（Serper/SerpAPI/Tavily）
- 改造 `server/_core/llm.ts`：`invokeLLM` 增加 `providerConfig` 参数（向后兼容），新增 `streamLLM` 流式调用
- 新增 6 个后端模块：`crypto.ts`（AES-256-GCM 加解密）、`search.ts`（搜索抽象层）、`file-extract.ts`（文档文本提取）、`routers/ai.ts`（tRPC 路由）、`db/ai.ts`（数据访问层）、`db/knowledgeBase.ts`（知识库）
- 新增 6 张数据库表：`ai_provider_configs`、`ai_search_configs`、`ai_knowledge_bases`、`ai_knowledge_docs`、`ai_conversations`、`ai_messages`
- 新增 3 个 npm 依赖：`pdf-parse`、`mammoth`、`xlsx`（文件文本提取）
- 新增环境变量 `AI_ENCRYPTION_KEY`（API Key 加密密钥）

## Capabilities

### New Capabilities

- `ai-chat`: AI 对话核心——对话 CRUD、消息收发、流式输出、历史持久化、双模式切换（本地/专家）
- `ai-model-config`: 模型配置管理——LLM 供应商 CRUD、搜索服务 CRUD、连通性测试、API Key 加密存储
- `ai-file-analysis`: 本地文档分析——文件上传、PDF/Word/Excel 文本提取、内容注入 LLM context
- `ai-knowledge-base`: 知识库——创建知识库、上传文档、关键词检索匹配
- `ai-web-search`: 联网搜索——多搜索供应商抽象、AI tool_call 触发搜索、结果注入 context

### Modified Capabilities

- `llm-invocation`: `server/_core/llm.ts` 改造——invokeLLM 增加 providerConfig 参数（向后兼容），新增 streamLLM
- `navigation`: `DashboardLayout.tsx` + `App.tsx`——新增 AI 智能体菜单项和路由

## Non-goals

- 不做向量数据库（v2 考虑 pgvector/Milvus）
- 不做云盘 OAuth 对接（百度网盘/阿里云盘为 v2）
- 不做多模态图片理解
- 不做用户级月度配额（仅记录 token 用量）
- 不改造现有 `AIChatBox.tsx` 的 Markdown 渲染逻辑

## Impact

**后端文件（新增/改造）：**
- `server/_core/llm.ts` — 改造 invokeLLM，新增 streamLLM
- `server/_core/crypto.ts` — 新增
- `server/_core/search.ts` — 新增
- `server/_core/file-extract.ts` — 新增
- `server/routers/ai.ts` — 新增
- `server/db/ai.ts` — 新增
- `server/db/knowledgeBase.ts` — 新增
- `server/routers.ts` — 注册 aiRouter
- `drizzle/schema.ts` — 新增 6 张表

**前端文件（新增）：**
- `client/src/features/ai/pages/AIChatPage.tsx`
- `client/src/features/ai/pages/AIConfigPage.tsx`
- `client/src/features/ai/components/ConversationSidebar.tsx`
- `client/src/features/ai/components/ModelSelector.tsx`
- `client/src/features/ai/components/SearchResultsCard.tsx`
- `client/src/features/ai/components/FileUploadZone.tsx`
- `client/src/features/ai/hooks/useAIChat.ts`
- `client/src/App.tsx` — 新增路由
- `client/src/components/DashboardLayout.tsx` — 新增菜单项
- `client/src/i18n/locales/{zh,en,ja,es,fr,zh-TW}.json` — 新增翻译 key

**共享文件（改造）：**
- `shared/const.ts` — 新增 `USE_AI_AGENT` 权限

**依赖：** `pdf-parse`、`mammoth`、`xlsx`（约 2.7MB）

**数据库：** 新增 6 张表，1 个 migration

**环境变量：** 新增 `AI_ENCRYPTION_KEY`

## Rollback

- 功能独立：`aiRouter` 可以从 `routers.ts` 中移除，菜单项可隐藏，不影响现有功能
- 数据库：新增表不修改现有表，可直接 DROP
- `llm.ts` 改造：向后兼容，不传 providerConfig 时走原路径
- 最坏情况：回滚 migration + 移除路由注册 + 隐藏菜单项
