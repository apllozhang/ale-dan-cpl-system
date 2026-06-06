# AI 智能体功能设计规格

**日期**: 2026-06-05
**状态**: 待审查
**方案**: A — 扩展现有 invokeLLM + AIChatBox

## 1. 概述

为 CPL 系统新增"AI 智能体"主菜单功能，包含两种工作模式：

- **本地模式**：上传文件或对接知识库，AI 基于本地文档回答问题
- **专家模式**：联网搜索，AI 基于实时网络信息回答问题

管理员统一配置第三方 LLM API（DeepSeek V4、Xiaomi Mimo 等）和搜索 API（Serper、SerpAPI 等），所有登录用户可用。

## 2. 需求确认

| 维度 | 决策 |
|------|------|
| 使用场景 | 业务 + 通用（CPL 业务问答 + 通用搜索/文档分析） |
| API Key 管理 | 管理员统一配置，加密存储 |
| 联网搜索 | 后端代理搜索 API，管理员可配置 |
| 对话持久化 | 完整保存到数据库，可回顾、可搜索 |
| 权限控制 | 所有登录用户可用，管理员才能配置模型/搜索 |

## 3. 架构

```
Frontend (client/src/features/ai/)
  ├─ AIChatPage.tsx        ← /ai 对话主页面（双模式）
  ├─ AIConfigPage.tsx      ← /ai/config 模型+搜索管理（管理员）
  ├─ ConversationSidebar   ← 左侧对话列表
  ├─ ModelSelector         ← 顶部模型切换
  └─ SearchResultsCard     ← 搜索引用卡片
       │ tRPC
Backend (server/)
  ├─ routers/ai.ts         ← AI 路由（对话 CRUD + 模型管理 + 搜索配置）
  ├─ _core/llm.ts (改造)   ← invokeLLM 增加 providerConfig，新增 streamLLM
  ├─ _core/search.ts (新增)← webSearch 抽象（Serper/SerpAPI/Tavily/自定义）
  ├─ _core/crypto.ts (新增)← AES-256-GCM 加解密
  └─ _core/file-extract.ts (新增) ← PDF/Word/Excel 文本提取
       │
Database (MySQL, 新增 5 张表)
  ├─ ai_provider_configs   ← LLM 模型配置
  ├─ ai_search_configs     ← 搜索服务配置
  ├─ ai_knowledge_bases    ← 知识库
  ├─ ai_knowledge_docs     ← 知识库文档
  ├─ ai_conversations      ← 对话
  └─ ai_messages           ← 消息
```

## 4. 数据库 Schema

### 4.1 LLM 模型配置

```sql
CREATE TABLE ai_provider_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,                     -- "DeepSeek V4"
  provider ENUM('openai_compatible','google_gemini') NOT NULL,
  api_base_url VARCHAR(500) NOT NULL,             -- "https://api.deepseek.com/v1"
  api_key TEXT NOT NULL,                           -- AES-256-GCM 加密
  model_name VARCHAR(100) NOT NULL,               -- "deepseek-chat"
  max_tokens INT DEFAULT 4096,
  temperature DECIMAL(3,2) DEFAULT 0.70,
  is_enabled BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,               -- 默认模型（仅一个）
  cost_per_input_token DECIMAL(10,8) DEFAULT 0,
  cost_per_output_token DECIMAL(10,8) DEFAULT 0,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

### 4.2 搜索服务配置

```sql
CREATE TABLE ai_search_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,                     -- "Serper"
  provider ENUM('serper','serpapi','google_custom','bing','tavily','custom') NOT NULL,
  api_base_url VARCHAR(500) NOT NULL,
  api_key TEXT NOT NULL,                           -- AES-256-GCM 加密
  extra_params JSON,                              -- {"gl":"cn","hl":"zh-cn"}
  is_default BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  daily_limit INT DEFAULT 1000,                   -- 每日搜索上限
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);
```

### 4.3 知识库

```sql
CREATE TABLE ai_knowledge_bases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,                     -- "CPL产品库"
  description TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ai_knowledge_docs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  knowledge_base_id INT REFERENCES ai_knowledge_bases(id),
  file_name VARCHAR(500),
  file_type VARCHAR(20),                          -- pdf/docx/xlsx/txt/csv
  file_size INT,
  extracted_text LONGTEXT,                        -- 提取的纯文本
  chunk_count INT,
  status ENUM('processing','ready','failed'),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4.4 对话与消息

```sql
CREATE TABLE ai_conversations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL REFERENCES users(id),
  title VARCHAR(200),                             -- 自动生成（首条消息摘要）
  mode ENUM('local','expert') DEFAULT 'expert',   -- 对话模式
  provider_config_id INT REFERENCES ai_provider_configs(id),
  search_config_id INT REFERENCES ai_search_configs(id),
  knowledge_base_id INT REFERENCES ai_knowledge_bases(id), -- 本地模式关联知识库
  system_prompt TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW()
);

CREATE TABLE ai_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  conversation_id INT NOT NULL REFERENCES ai_conversations(id),
  role ENUM('system','user','assistant') NOT NULL,
  content LONGTEXT NOT NULL,
  mode ENUM('local','expert'),
  attached_files JSON,                            -- [{name,size,type,extractedText}]
  search_results JSON,                            -- [{title,url,snippet,date}]
  token_count INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 5. 后端 API

### 5.1 LLM Provider 抽象层

改造 `server/_core/llm.ts`：

- `invokeLLM(params, providerConfig?)` — 向后兼容，不传 providerConfig 走原 forge.manus.im
- `streamLLM(params, config)` — 新增流式调用，返回 `AsyncGenerator<string>`
- `ProviderConfig` 类型：`{ provider, apiBaseUrl, apiKey, modelName, maxTokens, temperature }`
- 支持 OpenAI 兼容协议（DeepSeek、Mimo 等均兼容）和 Google Gemini（保留 forge）

### 5.2 搜索抽象层

新增 `server/_core/search.ts`：

- `webSearch(query, config, maxResults)` — 统一搜索接口
- 支持 Serper、SerpAPI、Tavily、Bing、Google Custom、自定义 API
- 返回 `SearchResult[]`：`{ title, url, snippet, date }`

### 5.3 文件提取

新增 `server/_core/file-extract.ts`：

- PDF → `pdf-parse`
- Word → `mammoth`
- Excel → `xlsx`（提取表格为 CSV 文本）
- TXT/CSV → 直接读取
- 文本 < 30K tokens → 整段注入 context
- 文本 ≥ 30K tokens → 截断（v1），v2 上向量检索

### 5.4 加密模块

新增 `server/_core/crypto.ts`：

- `encrypt(plaintext)` → base64 编码（iv + tag + encrypted）
- `decrypt(ciphertext)` → 明文
- 算法 AES-256-GCM，密钥从 `AI_ENCRYPTION_KEY` 环境变量读取

### 5.5 tRPC 路由

`server/routers/ai.ts`：

**模型管理（admin/superAdmin）：**
- `models.list` — 返回所有配置，API Key 脱敏
- `models.create` — 创建模型配置，API Key 加密存储
- `models.update` — 更新配置
- `models.delete` — 软删除（is_enabled=false）
- `models.test` — 测试连通性，返回 `{ success, model, latencyMs }`

**搜索配置（admin/superAdmin）：**
- `searchConfigs.list` / `create` / `update` / `delete` / `test`
- `test` 执行一次真实搜索，返回 `{ success, resultCount, latencyMs }`

**知识库（admin/superAdmin）：**
- `knowledgeBases.list` / `create` / `delete`
- `knowledgeBases.uploadDoc` — 上传文档，提取文本
- `knowledgeBases.listDocs` — 查看知识库文档列表

**对话（所有登录用户）：**
- `conversations.list` — 当前用户对话列表
- `conversations.get` — 对话详情 + 消息（验证 userId 归属）
- `conversations.create` — `{ mode, providerConfigId?, searchConfigId?, knowledgeBaseId?, systemPrompt? }`
- `conversations.delete` — 删除对话（验证 userId）

**核心对话（所有登录用户）：**
- `chat.send` — `{ conversationId, message, files? }`
  1. 加载对话配置 + 历史消息（最近 20 条）
  2. 本地模式：注入文件文本/知识库检索结果到 context
  3. 专家模式：AI tool_call 触发搜索 → 搜索结果注入 context → 二次调用 LLM
  4. 存储用户消息 + AI 回复
  5. 新对话自动生成 title
  6. 返回 AI 回复 + searchResults/attachedFiles
- `chat.sendStream` — SSE 流式版本

## 6. 前端

### 6.1 文件结构

```
client/src/features/ai/
├── pages/
│   ├── AIChatPage.tsx
│   └── AIConfigPage.tsx
├── components/
│   ├── ConversationSidebar.tsx
│   ├── ModelSelector.tsx
│   ├── SearchResultsCard.tsx
│   └── FileUploadZone.tsx
├── hooks/
│   └── useAIChat.ts
└── i18n keys in client/src/i18n/locales/
```

### 6.2 页面布局

**对话页面（/ai）：**
- 左侧：对话列表 + 新建对话按钮
- 右侧上方：模式切换 Tab（📁 本地模式 | 🌐 专家模式）+ 模型选择下拉
- 右侧中间：对话区域（复用 AIChatBox 组件）
- 本地模式：显示文件上传区域 + 知识库选择下拉
- 专家模式：搜索结果以卡片形式内联显示

**配置页面（/ai/config，仅管理员）：**
- 上半区：LLM 模型列表（添加/编辑/删除/测试/设默认）
- 下半区：搜索服务列表（添加/编辑/删除/测试/设默认）
- 知识库管理：创建知识库 → 上传文档 → 查看处理状态

### 6.3 路由注册

`App.tsx`：
```tsx
<Route path="/ai" element={<AIChatPage />} />
<Route path="/ai/config" element={<AIConfigPage />} />
```

`DashboardLayout.tsx`：
```tsx
{ icon: Bot, labelKey: "menu.aiAgent", path: "/ai" }
```

`shared/const.ts` 新增权限：
```ts
USE_AI_AGENT: "use_ai_agent"
```

## 7. 安全

| 风险 | 防护措施 |
|------|---------|
| API Key 泄露 | AES-256-GCM 加密；API 返回脱敏；仅 admin 可管理 |
| Prompt 注入 | 用户输入不拼入 system prompt；搜索结果标记为 untrusted |
| Token 爆炸 | 单条 ≤ 10,000 字符；历史 ≤ 20 条；文件 ≤ 30K tokens |
| 搜索滥用 | daily_limit 按日计数 |
| 文件上传 | 白名单格式；≤ 20MB；提取后丢弃原始文件 |
| 非授权访问 | 配置 mutation 需 admin；对话 CRUD 验证 userId |

## 8. 环境变量

```env
AI_ENCRYPTION_KEY=<64-char-hex>   # 必须，API Key 加解密
```

现有 `BUILT_IN_FORGE_API_URL` 和 `BUILT_IN_FORGE_API_KEY` 保持不变，向后兼容。

## 9. 依赖

| 包 | 用途 | 大小 |
|---|------|------|
| `pdf-parse` | PDF 文本提取 | ~200KB |
| `mammoth` | Word 文档提取 | ~500KB |
| `xlsx` | Excel 文件解析 | ~2MB |

## 10. v1 vs v2 边界

| 能力 | v1（本次） | v2（未来） |
|------|-----------|-----------|
| 文件上传分析 | ✅ 整段注入 context | 🔮 向量检索（embedding） |
| 知识库 | ✅ 关键词匹配检索 | 🔮 向量数据库（pgvector/Milvus） |
| 云盘对接 | ❌ | 🔜 百度网盘/阿里云盘 OAuth |
| 联网搜索 | ✅ Serper/SerpAPI/Tavily | ✅ 多搜索引擎 |
| 费用追踪 | ✅ 记录 token 用量 | 🔜 用户级月度配额 |
| 流式输出 | ✅ SSE | ✅ — |
| 多模态（图片） | ❌ | 🔜 图片理解 |
