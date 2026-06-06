# CC Switch — Anthropic Adapter + 图片上传

**日期**: 2026-06-06
**状态**: 已批准
**方案**: Adapter 模式 — canonical format (OpenAI) + 出口处转换

## 1. 概述

在 `server/_core/llm.ts` 抽象层新增 Anthropic 协议 adapter，使 CC Switch 支持 OpenAI 兼容 + Anthropic 兼容两种 LLM API 协议。同时新增图片上传能力，图片消息按 provider 自动转换为对应格式。

## 2. 设计

### Canonical Format

保持 OpenAI 格式作为内部统一消息格式（行业事实标准）。上层业务代码只接触 canonical 格式。

### Adapter 分流

```
invokeProviderLLM(params, config)
  ├─ config.provider === "openai_compatible" → invokeOpenAILLM (现有)
  ├─ config.provider === "anthropic"         → invokeAnthropicLLM (新增)
  └─ config.provider === "google_gemini"     → invokeLegacyLLM (现有)
```

### 图片消息格式转换

```
Canonical (OpenAI)                    Anthropic
{                                     {
  type: "image_url",           →       type: "image",
  image_url: {                         source: {
    url: "data:image/png;base64,..."     type: "base64",
  }                                       media_type: "image/png",
}                                         data: "..."
                                        }
                                      }
```

### Anthropic API 差异

| 维度 | OpenAI 兼容 | Anthropic 兼容 |
|------|------------|----------------|
| Endpoint | `/chat/completions` | `/v1/messages` |
| Auth | `Authorization: Bearer` | `x-api-key` + `anthropic-version` |
| max_tokens | 可选 | 必需 |
| 响应格式 | `choices[0].message.content` | `content[0].text` |
| 图片类型 | `image_url` | `image` + `source.base64` |
| 流式格式 | `data: {"choices":[...]}` | `event: content_block_delta` |

## 3. 改动范围

| 文件 | 改什么 | 行数 |
|------|--------|------|
| `server/_core/llm.ts` | 新增 `invokeAnthropicLLM` + `toAnthropicMessages` + `parseAnthropicResponse` + `streamAnthropicLLM` | ~80 行 |
| `drizzle/schema.ts` | provider enum 加 `"anthropic"` | 1 行 |
| `server/routers/ai.ts` | chat.send 支持图片输入，按 provider 格式化 | ~15 行 |
| `client/src/features/ai/components/FileUploadZone.tsx` | 扩展接受图片类型 | ~5 行 |
| `client/src/features/ai/pages/AIChatPage.tsx` | 图片 base64 传给 chat.send | ~10 行 |

**总计约 110 行。** 所有协议差异封装在 `llm.ts` 内部。

## 4. 连通性测试机制

每个模型配置添加后，必须可测试对接是否成功。`models.test` 路由按 provider 分流测试：

### 测试流程

```
管理员添加模型 → 点击"测试"按钮 → 后端按 provider 发测试请求 → 返回明确结果
```

### 成功响应

```json
{ "success": true, "model": "claude-sonnet-4-6", "provider": "anthropic", "latencyMs": 1203 }
```

前端 toast: `✅ 连接成功: claude-sonnet-4-6 (1203ms)`

### 失败响应 — 按错误类型分类提示

| 错误场景 | HTTP 状态码 | 提示信息 |
|---------|-----------|---------|
| API Key 无效/过期 | 401 | `❌ 认证失败：API Key 无效或已过期` |
| 余额不足/配额用尽 | 402/429 | `❌ 配额不足：请检查账户余额或等待重试` |
| 网络不通/URL 错误 | ENOTFOUND/ECONNREFUSED | `❌ 网络错误：无法连接到 API 地址，请检查 URL` |
| 模型名不存在 | 404 | `❌ 模型不存在：请确认模型名称是否正确` |
| Anthropic 缺少必需 header | 400 | `❌ 请求格式错误：请确认 provider 类型选择正确` |
| 超时（>15s） | TIMEOUT | `❌ 连接超时：服务器响应时间过长` |
| 其他未知错误 | - | `❌ 连接失败：{原始错误信息}` |

### 实现

在 `invokeAnthropicLLM` / `invokeOpenAILLM` 中，对 HTTP 响应码做结构化错误分类：

```typescript
if (!response.ok) {
  const errorText = await response.text();
  const userMessage = classifyHttpError(response.status, config.provider, errorText);
  throw new TRPCError({ code: mapStatusToTRPC(response.status), message: userMessage });
}
```

前端对 `TRPCError.message` 直接展示，无需额外解析。

## 5. 安全

| 风险 | 防护 |
|------|------|
| 图片过大 | 前端 5MB 限制 + 后端 base64 max 6.7MB |
| 图片格式 | 白名单: png, jpeg, gif, webp |
| base64 注入 | Zod schema 校验 type enum |
| 图片不持久化 | 不存数据库，仅在请求时 inline |

## 5. 约束

- 图片不存数据库，只在 LLM 请求时 inline 传递
- 流式输出 Anthropic v1 暂不实现（先支持同步调用）
- 每条消息最多 4 张图片
