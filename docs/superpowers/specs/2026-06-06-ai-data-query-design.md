# AI Data Query — Function Calling 设计

**日期**: 2026-06-06
**状态**: 已批准
**方案**: LLM Function Calling — 预定义只读查询函数，AI 自动调用并回答

## 1. 概述

在 AI 智能体的"本地模式"中，当用户提问涉及 CPL 系统业务数据时，LLM 自动识别意图、调用预定义的只读查询函数获取数据，然后基于结果生成自然语言回答。用户无需写 SQL 或手动导出数据。

### 交互流程

```
用户: "本月有多少报价？"
  ↓
chat.send → LLM (带 tool definitions)
  ↓
LLM 返回 tool_call: queryQuotations({ status: "submitted", dateRange: "2026-06" })
  ↓
后端执行预定义函数 → 查询数据库 → 返回 JSON 结果
  ↓
结果注入对话 → LLM 生成自然语言回答
  ↓
"本月共有 1 条已提交的报价，总金额 ¥xxx"
```

## 2. 查询函数定义

### 2.1 报价域

#### `queryQuotations` — 查询报价列表

```typescript
{
  name: "queryQuotations",
  description: "查询报价单列表，支持按状态、日期范围、客户、关键词筛选",
  parameters: {
    status: { type: "string", enum: ["draft","submitted","approved","rejected","cancelled"], description: "报价状态" },
    dateFrom: { type: "string", description: "起始日期 YYYY-MM-DD" },
    dateTo: { type: "string", description: "截止日期 YYYY-MM-DD" },
    customerId: { type: "number", description: "客户/组织 ID" },
    keyword: { type: "string", description: "关键词搜索（报价名称/编号）" },
    limit: { type: "number", description: "返回条数，默认 20，最大 50" },
  }
}
```

返回：`{ items: QuotationSummary[], total: number }`

#### `getQuotationDetail` — 报价详情

```typescript
{
  name: "getQuotationDetail",
  description: "获取单个报价的完整信息，包含报价项和版本历史",
  parameters: {
    quotationId: { type: "number", required: true },
  }
}
```

### 2.2 产品域

#### `queryProducts` — 查询产品

```typescript
{
  name: "queryProducts",
  description: "查询产品列表，支持按型号、关键词、价格范围筛选",
  parameters: {
    keyword: { type: "string", description: "搜索关键词（型号/描述）" },
    productModel: { type: "string", description: "精确产品型号" },
    minPrice: { type: "number", description: "最低价格" },
    maxPrice: { type: "number", description: "最高价格" },
    limit: { type: "number", description: "返回条数，默认 20，最大 50" },
  }
}
```

#### `queryProductSpecs` — 查询产品规格参数

```typescript
{
  name: "queryProductSpecs",
  description: "查询产品的详细规格参数（如端口数、功耗、尺寸等）",
  parameters: {
    productModel: { type: "string", description: "产品型号" },
    specSetName: { type: "string", description: "规格参数集名称" },
  }
}
```

### 2.3 证书域

#### `queryCertifications` — 查询证书

```typescript
{
  name: "queryCertifications",
  description: "查询认证证书信息，支持按类型、状态、持有者、到期时间筛选",
  parameters: {
    certType: { type: "string", description: "证书类型（如 3C、CE、FCC）" },
    status: { type: "string", enum: ["active", "expired", "pending"], description: "证书状态" },
    keyword: { type: "string", description: "关键词搜索（证号/名称）" },
    holder: { type: "string", description: "持有者" },
    expiringWithinDays: { type: "number", description: "即将在 N 天内到期的证书" },
    limit: { type: "number", description: "返回条数，默认 20，最大 50" },
  }
}
```

### 2.4 eFlash 域

#### `queryEflash` — 查询 eFlash 公告

```typescript
{
  name: "queryEflash",
  description: "查询 eFlash 产品公告（phase_in/phase_out/service/pricing/program）",
  parameters: {
    type: { type: "string", enum: ["phase_in","phase_out","service","pricing","program"], description: "公告类型" },
    division: { type: "string", enum: ["communications","network","general"], description: "部门" },
    scope: { type: "string", enum: ["global","china"], description: "范围" },
    dateFrom: { type: "string", description: "起始日期 YYYY-MM-DD" },
    dateTo: { type: "string", description: "截止日期 YYYY-MM-DD" },
    keyword: { type: "string", description: "关键词搜索" },
    limit: { type: "number", description: "返回条数，默认 20，最大 50" },
  }
}
```

### 2.5 客户域

#### `queryCustomers` — 查询客户

```typescript
{
  name: "queryCustomers",
  description: "查询客户/组织信息",
  parameters: {
    keyword: { type: "string", description: "关键词搜索（名称）" },
  }
}
```

### 2.6 操作域

#### `queryActivityLogs` — 查询操作日志

```typescript
{
  name: "queryActivityLogs",
  description: "查询用户操作日志，支持按用户、操作类型、日期筛选",
  parameters: {
    userId: { type: "number", description: "用户 ID" },
    actionType: { type: "string", description: "操作类型" },
    dateFrom: { type: "string", description: "起始日期 YYYY-MM-DD" },
    dateTo: { type: "string", description: "截止日期 YYYY-MM-DD" },
    limit: { type: "number", description: "返回条数，默认 20，最大 50" },
  }
}
```

### 2.7 聚合

#### `getDashboardSummary` — 数据概览

```typescript
{
  name: "getDashboardSummary",
  description: "获取系统数据概览：报价统计、产品数量、证书状态、近期 eFlash 等",
  parameters: {}
}
```

## 3. 技术实现

### 3.1 LLM Tool Calling 循环

`chat.send` mutation 的执行流程：

```
1. 构建 messages (system + context + history + user message)
2. 调用 LLM，带上 tools 参数（9 个函数的 JSON Schema）
3. 检查 LLM 响应：
   a. 如果有 tool_calls → 执行对应查询函数 → 将结果作为 tool message 追加 → 回到步骤 2
   b. 如果无 tool_calls（纯文本回复）→ 跳到步骤 4
4. 保存 assistant 消息，返回给前端
```

最多 3 轮 tool calling（防止无限循环）。

### 3.2 Provider 适配

| Provider | Tool 格式 | Tool Call 格式 |
|----------|----------|---------------|
| OpenAI Compatible | `tools[].function` | `message.tool_calls[].function` |
| Anthropic | `tools[].input_schema` | `content[].type === "tool_use"` → `tool_result` |
| Google Gemini | `tools[].functionDeclarations` | `functionCall` |

当前只需实现 OpenAI Compatible + Anthropic（Gemini 后续跟进）。

### 3.3 文件改动

| 文件 | 改什么 | 行数 |
|------|--------|------|
| `server/_core/llm.ts` | 新增 `tools` 参数到 `InvokeParams`，解析 tool_call 响应 | ~50 行 |
| `server/db/ai-data-query.ts` (新) | 9 个查询函数实现 | ~200 行 |
| `server/routers/ai.ts` | `chat.send` 加入 tool 执行循环 | ~60 行 |

**总计约 310 行新增代码，客户端零改动。**

## 4. 安全

| 风险 | 防护 |
|------|------|
| SQL 注入 | 查询函数使用 Drizzle ORM 参数化查询，不拼接原始 SQL |
| 数据泄露 | 查询函数自动过滤当前用户权限（普通用户只能查自己的报价） |
| 过量数据 | 每个查询 limit 上限 50，LLM 上下文 window 限制 |
| 无限循环 | 最多 3 轮 tool calling |
| 写操作 | 查询函数全部只读，不支持 INSERT/UPDATE/DELETE |
| 敏感字段 | 用户密码、API Key 等字段不返回给 LLM |

## 5. 约束

- 仅在"本地模式"下启用数据查询，"专家模式"（联网搜索）不涉及
- LLM 仅能调用预定义的 9 个函数，不能执行任意 SQL
- 查询结果不超过 50 条，超出时 LLM 应提示用户缩小范围
- 当前仅支持 mimo/OpenAI Compatible provider 的 tool calling，Anthropic adapter 后续补齐
