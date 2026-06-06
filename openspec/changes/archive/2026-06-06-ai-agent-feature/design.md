## Context

CPL 系统是一个 Express + tRPC + React 单体应用。当前已有 LLM 基础设施：
- `server/_core/llm.ts` — 调用 Gemini 2.5 Flash via `forge.manus.im`，硬编码模型和 API 地址
- `client/src/components/AIChatBox.tsx` — 通用对话 UI 组件（Markdown 渲染、加载态、建议提示）
- `InvokeParams` / `InvokeResult` 类型系统设计良好且模型无关

**当前状态：**
```
AIChatBox → (未使用，无 tRPC 端点)
llm.ts → forge.manus.im → Gemini 2.5 Flash (硬编码)
```

**目标状态：**
```
AIChatPage → tRPC ai.chat.send → llm.ts(providerConfig) → 任意 OpenAI 兼容 API
                                     ↓
                               search.ts → Serper/SerpAPI
                               file-extract.ts → PDF/Word/Excel
```

## Goals / Non-Goals

**Goals:**
- 管理员可手动配置多个第三方 LLM（DeepSeek、Mimo 等）和搜索 API（Serper、SerpAPI 等）
- 用户可在两种模式间切换：本地模式（文件上传/知识库）和专家模式（联网搜索）
- 对话完整持久化，可回顾、可搜索
- API Key 加密存储，向后兼容现有 forge.manus.im

**Non-Goals:**
- 不做向量数据库（v2）
- 不做云盘 OAuth 对接（v2）
- 不做多模态图片理解
- 不做用户级月度费用配额
- 不改造现有 AIChatBox 的 Markdown 渲染

## Decisions

### D1：LLM 调用 — 扩展 invokeLLM 而非新建

**选择**：在现有 `invokeLLM` 增加 `providerConfig` 可选参数
**替代方案**：新建 `invokeProviderLLM` 独立函数
**理由**：`InvokeParams` / `InvokeResult` 类型已设计为模型无关，复用类型系统避免维护两套。不传 `providerConfig` 走原路径，零破坏性。

### D2：API Key 存储 — 数据库加密而非环境变量

**选择**：AES-256-GCM 加密后存 `ai_provider_configs.api_key`，密钥从 `AI_ENCRYPTION_KEY` 环境变量读取
**替代方案**：全部放 `.env` 文件
**理由**：管理员需要 UI 动态增删模型，环境变量需要重启服务。数据库方案支持运行时管理，加密后安全性相当。

### D3：搜索集成 — AI Tool Calling 而非关键词触发

**选择**：将搜索定义为 LLM tool，AI 自主决定何时调用
**替代方案**：检测用户消息中的关键词（"搜索"、"查询"）自动触发搜索
**理由**：AI tool calling 让模型自主判断是否需要搜索，减少误触发。DeepSeek V4 和 Mimo 均支持 function calling。

### D4：文件分析 — 整段注入而非向量检索

**选择**：v1 将提取的文本整段注入 system prompt（< 30K tokens），超出截断
**替代方案**：上向量数据库（pgvector/Milvus）做 RAG
**理由**：CPL 场景的文档多为产品规格表（几页到几十页），30K tokens 覆盖绝大多数文件。向量检索增加 3+ 个依赖和运维复杂度，v1 不值得。

### D5：前端架构 — feature-based 目录而非 pages/ 扁平结构

**选择**：新功能放 `client/src/features/ai/` 目录
**替代方案**：放 `client/src/pages/` + `client/src/components/`
**理由**：项目 CLAUDE.md 全局配置推荐 feature-based 结构，AI 模块有 5+ 个组件和 1 个 hook，适合独立 feature。

### D6：流式输出 — SSE via fetch ReadableStream

**选择**：后端返回 SSE stream，前端用 `fetch` + `ReadableStream` 消费
**替代方案**：tRPC subscription（WebSocket）
**理由**：SSE 是单向流，对话场景足够。tRPC subscription 需要额外的 WebSocket 基础设施，当前项目未使用。

## Risks / Trade-offs

| 风险 | 严重度 | 缓解措施 |
|------|--------|---------|
| 第三方 API 不稳定/下线 | 中 | 管理员可配置多个模型，自动 fallback 到默认模型 |
| API Key 泄露 | 高 | AES-256-GCM 加密存储；API 返回脱敏；仅 admin mutation |
| 大文件 token 爆炸 | 中 | 30K tokens 截断；文件大小 ≤ 20MB；白名单格式 |
| 搜索结果被 Prompt 注入 | 中 | 搜索结果包裹 untrusted 标记；AI 指令不执行搜索结果中的命令 |
| 新增 3 个 npm 依赖 | 低 | `pdf-parse`、`mammoth`、`xlsx` 均为成熟库，无安全告警 |
| `llm.ts` 改造破坏现有功能 | 高 | 向后兼容设计：不传 providerConfig 走原路径；改造前先补现有测试 |

## Migration Plan

1. **Phase 1 — 基础设施（无用户可见变化）**
   - 新增 `crypto.ts`、`search.ts`、`file-extract.ts`
   - 改造 `llm.ts`（向后兼容）
   - 新增 6 张数据库表（Drizzle migration）
   - 新增环境变量 `AI_ENCRYPTION_KEY`

2. **Phase 2 — 后端 API**
   - 新增 `server/routers/ai.ts` + `server/db/ai.ts` + `server/db/knowledgeBase.ts`
   - 注册 `aiRouter` 到 `server/routers.ts`

3. **Phase 3 — 前端**
   - 新增 `features/ai/` 目录下的页面和组件
   - 注册路由到 `App.tsx`
   - 新增菜单项到 `DashboardLayout.tsx`
   - 新增 6 个 locale 翻译 key

4. **Rollback**
   - 移除 `aiRouter` 注册（1 行代码）
   - 隐藏菜单项（1 行代码）
   - DROP 6 张表（无外键依赖现有表）
   - `llm.ts` 改造不影响原路径，无需回滚

## Affected Files

**后端（改造）：**
- `server/_core/llm.ts` — invokeLLM 增加 providerConfig 参数
- `server/_core/env.ts` — 新增 AI_ENCRYPTION_KEY 验证
- `server/routers.ts` — 注册 aiRouter
- `drizzle/schema.ts` — 新增 6 张表

**后端（新增）：**
- `server/_core/crypto.ts`
- `server/_core/search.ts`
- `server/_core/file-extract.ts`
- `server/routers/ai.ts`
- `server/db/ai.ts`
- `server/db/knowledgeBase.ts`

**前端（改造）：**
- `client/src/App.tsx` — 新增 /ai 路由
- `client/src/components/DashboardLayout.tsx` — 新增菜单项
- `client/src/i18n/locales/*.json` — 新增翻译 key（6 个文件）

**共享（改造）：**
- `shared/const.ts` — 新增 USE_AI_AGENT 权限

**前端（新增）：**
- `client/src/features/ai/pages/AIChatPage.tsx`
- `client/src/features/ai/pages/AIConfigPage.tsx`
- `client/src/features/ai/components/ConversationSidebar.tsx`
- `client/src/features/ai/components/ModelSelector.tsx`
- `client/src/features/ai/components/SearchResultsCard.tsx`
- `client/src/features/ai/components/FileUploadZone.tsx`
- `client/src/features/ai/hooks/useAIChat.ts`

## Open Questions

- 流式输出的具体前端消费方式：直接 fetch + ReadableStream，还是需要 tRPC middleware 适配？（倾向前者，但需验证 tRPC mutation 是否能返回 stream）
- 搜索每日上限计数粒度：按全局还是按用户？（建议 v1 按全局，简单实现）
