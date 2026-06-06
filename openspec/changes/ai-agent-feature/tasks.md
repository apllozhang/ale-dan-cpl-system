## 1. 基础设施（共享类型 + 数据库 + 依赖）

- [ ] 1.1 在 `shared/const.ts` 新增 `USE_AI_AGENT` 权限常量，更新 `PERMISSIONS` 和 `ROLE_PERMISSIONS`。验证：`pnpm check` 通过
- [ ] 1.2 安装 npm 依赖：`pnpm add pdf-parse mammoth xlsx`，添加类型声明。验证：`pnpm check` 通过
- [ ] 1.3 新增 `server/_core/crypto.ts`：实现 `encrypt()` 和 `decrypt()` 函数（AES-256-GCM，密钥从 `process.env.AI_ENCRYPTION_KEY` 读取）。验证：编写 vitest 单元测试通过
- [ ] 1.4 在 `server/_core/env.ts` 新增 `AI_ENCRYPTION_KEY` 环境变量校验（仅 production 必须）。验证：`pnpm check` 通过
- [ ] 1.5 在 `drizzle/schema.ts` 新增 6 张表：`aiProviderConfigs`、`aiSearchConfigs`、`aiKnowledgeBases`、`aiKnowledgeDocs`、`aiConversations`、`aiMessages`。验证：`pnpm db:push` 成功
- [ ] 1.6 运行 `pnpm db:push` 生成并应用 migration。验证：`mysql -e "SHOW TABLES LIKE 'ai_%'"` 显示 6 张表

## 2. 后端核心模块（llm + search + file-extract）

- [ ] 2.1 改造 `server/_core/llm.ts`：提取 `invokeLegacyLLM`（原逻辑不变），新增 `invokeProviderLLM`，修改 `invokeLLM` 签名增加可选 `providerConfig` 参数。验证：现有调用方零改动 + `pnpm check` 通过
- [ ] 2.2 新增 `streamLLM` async generator 函数：SSE 解析，yield text delta。验证：编写 vitest 测试（mock fetch SSE response）
- [ ] 2.3 新增 `server/_core/search.ts`：定义 `SearchConfig`、`SearchResult` 类型，实现 `webSearch` 函数及 Serper/SerpAPI/Tavily/custom 分发。验证：编写 vitest 测试（mock API 响应）
- [ ] 2.4 新增 `server/_core/file-extract.ts`：实现 `extractText(filePath, fileType)` 支持 PDF/DOCX/XLSX/TXT/CSV，文本超 30K tokens 截断。验证：编写 vitest 测试（用小样本文件）
- [ ] 2.5 运行 `pnpm test` 确认所有新增和现有测试通过。验证：0 failures

## 3. 后端 tRPC 路由（模型/搜索配置 CRUD）

- [ ] 3.1 新增 `server/db/ai.ts`：providerConfig 的 CRUD 操作（list/create/update/delete），含 API Key 加密/解密/脱敏逻辑。验证：`pnpm check` 通过
- [ ] 3.2 新增 `server/routers/ai.ts` 模型管理部分：`models.list`（脱敏返回）、`models.create`（加密存储）、`models.update`、`models.delete`（软删除）、`models.test`（连通性测试）。所有 mutation 需 admin/superAdmin 权限。验证：`pnpm check` 通过
- [ ] 3.3 新增搜索配置部分：`searchConfigs.list`/`create`/`update`/`delete`/`test`。test 执行真实搜索并返回 `{ success, resultCount, latencyMs }`。验证：`pnpm check` 通过
- [ ] 3.4 在 `server/routers.ts` 注册 `ai: aiRouter`。验证：`pnpm dev` 启动无报错

## 4. 后端 tRPC 路由（知识库 + 对话 + 聊天）

- [ ] 4.1 新增 `server/db/knowledgeBase.ts`：知识库 CRUD + 文档上传（文件提取 + 状态管理）+ 关键词检索匹配。验证：`pnpm check` 通过
- [ ] 4.2 新增知识库路由：`knowledgeBases.list`/`create`/`delete`/`uploadDoc`/`listDocs`。验证：`pnpm check` 通过
- [ ] 4.3 新增对话路由：`conversations.list`（当前用户）、`conversations.get`（验证 userId）、`conversations.create`、`conversations.delete`（验证 userId）。验证：`pnpm check` 通过
- [ ] 4.4 实现 `chat.send` 核心逻辑：加载历史 → 模式分支（本地：注入文件/知识库；专家：tool_call 搜索 → 二次调用）→ 存储 → 自动生成 title。验证：手动测试完整对话流程
- [ ] 4.5 运行 `pnpm test` + `pnpm check`，确认所有通过。验证：0 failures

## 5. 前端 — 配置管理页面（管理员）

- [ ] 5.1 创建 `client/src/features/ai/pages/AIConfigPage.tsx` 骨架：模型列表 + 搜索服务列表 + 知识库管理三个区域。验证：页面渲染无报错
- [ ] 5.2 实现模型管理 UI：添加/编辑/删除模型表单（name, provider, apiBaseUrl, apiKey, modelName, maxTokens, temperature），含连通性测试按钮。验证：管理员可完整 CRUD 一个模型配置
- [ ] 5.3 实现搜索服务管理 UI：添加/编辑/删除搜索配置，含测试搜索按钮（弹窗展示搜索结果）。验证：管理员可配置并测试 Serper
- [ ] 5.4 实现知识库管理 UI：创建知识库 → 上传文档 → 查看文档列表和处理状态。验证：管理员可创建知识库并上传文档
- [ ] 5.5 在 `App.tsx` 注册 `/ai/config` 路由（admin only guard）。验证：admin 可访问，普通用户被拦截

## 6. 前端 — 对话页面

- [ ] 6.1 创建 `client/src/features/ai/hooks/useAIChat.ts`：管理 conversations 列表、activeConversation、messages、selectedModel、mode 状态。验证：hook 可被组件正常消费
- [ ] 6.2 创建 `client/src/features/ai/components/ConversationSidebar.tsx`：对话列表 + 新建按钮 + 删除确认。验证：列表渲染、切换对话、新建/删除正常
- [ ] 6.3 创建 `client/src/features/ai/components/ModelSelector.tsx`：下拉选择模型，显示当前选中。验证：切换模型正常
- [ ] 6.4 创建 `client/src/features/ai/components/FileUploadZone.tsx`：拖拽/点击上传区域，文件类型白名单 + 大小校验，显示已上传文件。验证：上传 PDF 文件正常显示
- [ ] 6.5 创建 `client/src/features/ai/components/SearchResultsCard.tsx`：搜索引用卡片（可折叠，显示来源标题 + URL）。验证：传入 mock searchResults 正常渲染
- [ ] 6.6 创建 `client/src/features/ai/pages/AIChatPage.tsx`：组合上述组件 + 复用 AIChatBox，实现双模式切换（本地模式显示文件上传 + 知识库选择；专家模式显示搜索结果卡片）。验证：完整对话流程可走通
- [ ] 6.7 在 `App.tsx` 注册 `/ai` 路由，在 `DashboardLayout.tsx` 新增 Bot 图标菜单项（i18n key: `menu.aiAgent`）。验证：侧边栏显示 AI 菜单，点击跳转正常

## 7. i18n + 收尾

- [ ] 7.1 在 6 个 locale JSON 文件中添加 AI 相关翻译 key（menu.aiAgent、配置页文案、对话页文案、错误提示等）。验证：切换语言后文案正确
- [ ] 7.2 运行 `pnpm check` 确认 TypeScript 零错误。验证：无 type errors
- [ ] 7.3 运行 `pnpm test` 确认所有测试通过。验证：0 failures
- [ ] 7.4 运行 `pnpm build` 确认生产构建成功。验证：构建无报错
- [ ] 7.5 手动端到端测试：管理员配置模型 → 用户创建对话 → 发送消息 → 收到 AI 回复（本地模式 + 专家模式各一次）。验证：完整流程走通
