import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export type ProviderConfig = {
  provider: "openai_compatible" | "google_gemini" | "anthropic";
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  maxTokens?: number;
  temperature?: number;
};

function buildBasePayload(params: InvokeParams): Record<string, unknown> {
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  return payload;
}

// ── Error classification ──
function classifyHttpError(status: number, _provider: string, errorBody: string): string {
  switch (status) {
    case 401: return "认证失败：API Key 无效或已过期";
    case 402: return "配额不足：请检查账户余额";
    case 403: return "访问被拒绝：权限不足或 IP 受限";
    case 404: return "模型不存在：请确认模型名称是否正确";
    case 429: return "请求过于频繁：请稍后重试或检查配额";
    default: {
      try {
        const parsed = JSON.parse(errorBody);
        const msg = parsed.error?.message || parsed.message || errorBody;
        return `连接失败 (${status}): ${msg}`;
      } catch {
        return `连接失败 (${status}): ${errorBody.slice(0, 200)}`;
      }
    }
  }
}

// ── Anthropic message conversion ──
type AnthropicImageSource =
  | { type: "base64"; media_type: string; data: string }
  | { type: "url"; url: string };

type AnthropicContent =
  | { type: "text"; text: string }
  | { type: "image"; source: AnthropicImageSource };

function toAnthropicContentPart(part: MessageContent): AnthropicContent {
  if (typeof part === "string") return { type: "text", text: part };
  if (part.type === "text") return { type: "text", text: part.text };
  if (part.type === "image_url") {
    const match = part.image_url.url.match(/^data:(image\/[\w+]+);base64,(.+)$/);
    if (match) {
      return {
        type: "image",
        source: { type: "base64", media_type: match[1], data: match[2] },
      };
    }
    return {
      type: "image",
      source: { type: "url", url: part.image_url.url },
    };
  }
  // Fallback for file_url or unknown types
  return { type: "text", text: JSON.stringify(part) };
}

function toAnthropicMessages(
  messages: Message[]
): Array<{ role: string; content: string | AnthropicContent[] }> {
  return messages.map((msg) => {
    if (typeof msg.content === "string") {
      return { role: msg.role, content: msg.content };
    }
    const parts = ensureArray(msg.content).map(toAnthropicContentPart);
    return { role: msg.role, content: parts };
  });
}

/**
 * Invoke Anthropic Messages API and normalize to InvokeResult.
 */
async function invokeAnthropicLLM(
  params: InvokeParams,
  config: ProviderConfig
): Promise<InvokeResult> {
  const allMessages = toAnthropicMessages(params.messages);

  // Anthropic requires system at top-level, not in messages
  const systemMessage = allMessages.find((m) => m.role === "system");
  const nonSystemMessages = allMessages.filter((m) => m.role !== "system");

  let systemContent: string | undefined;
  if (systemMessage) {
    const c = systemMessage.content;
    systemContent = typeof c === "string"
      ? c
      : Array.isArray(c)
        ? c.filter((p): p is { type: "text"; text: string } => "text" in p).map((p) => p.text).join("\n")
        : String(c);
  }

  const payload: Record<string, unknown> = {
    model: config.modelName,
    max_tokens: config.maxTokens ?? 4096,
    messages: nonSystemMessages,
    ...(systemContent ? { system: systemContent } : {}),
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
  };

  const url = `${config.apiBaseUrl.replace(/\/$/, "")}/v1/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const userMessage = classifyHttpError(response.status, config.provider, errorText);
    throw new Error(`LLM invoke failed (${config.modelName}): ${userMessage}`);
  }

  const data = (await response.json()) as {
    id: string;
    model: string;
    role: string;
    content: Array<{ type: string; text?: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const textContent = data.content?.find((c) => c.type === "text");
  return {
    id: data.id,
    created: Date.now(),
    model: data.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: textContent?.text ?? "" },
        finish_reason: "stop",
      },
    ],
    usage: data.usage
      ? {
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens: data.usage.input_tokens + data.usage.output_tokens,
        }
      : undefined,
  };
}

/**
 * Invoke LLM with an explicit provider configuration — OpenAI compatible.
 */
async function invokeOpenAILLM(
  params: InvokeParams,
  config: ProviderConfig
): Promise<InvokeResult> {
  const payload = buildBasePayload(params);
  payload.model = config.modelName;
  payload.max_tokens = config.maxTokens ?? 4096;
  if (config.temperature !== undefined) {
    payload.temperature = config.temperature;
  }

  const url = `${config.apiBaseUrl.replace(/\/$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const userMessage = classifyHttpError(response.status, config.provider, errorText);
    throw new Error(`LLM invoke failed (${config.modelName}): ${userMessage}`);
  }

  return (await response.json()) as InvokeResult;
}

/**
 * Invoke LLM with an explicit provider configuration (multi-model).
 * Routes to the correct adapter based on provider type.
 */
async function invokeProviderLLM(
  params: InvokeParams,
  config: ProviderConfig
): Promise<InvokeResult> {
  if (config.provider === "anthropic") {
    return invokeAnthropicLLM(params, config);
  }
  return invokeOpenAILLM(params, config);
}

/**
 * Invoke LLM using the legacy forge.manus.im endpoint (backward compatible).
 */
async function invokeLegacyLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const payload = buildBasePayload(params);
  payload.model = "gemini-2.5-flash";
  payload.max_tokens = 32768;
  payload.thinking = { budget_tokens: 128 };

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

/**
 * Invoke LLM — routes to configured provider or legacy forge endpoint.
 * Backward compatible: omit providerConfig to use existing forge.manus.im.
 */
export async function invokeLLM(
  params: InvokeParams,
  providerConfig?: ProviderConfig
): Promise<InvokeResult> {
  if (providerConfig) {
    return invokeProviderLLM(params, providerConfig);
  }
  return invokeLegacyLLM(params);
}

/**
 * Stream Anthropic LLM responses via SSE.
 * Anthropic uses content_block_delta events with text_delta.
 */
async function* streamAnthropicLLM(
  params: InvokeParams,
  config: ProviderConfig
): AsyncGenerator<string> {
  const allMessages = toAnthropicMessages(params.messages);

  const systemMessage = allMessages.find((m) => m.role === "system");
  const nonSystemMessages = allMessages.filter((m) => m.role !== "system");

  let systemContent: string | undefined;
  if (systemMessage) {
    const c = systemMessage.content;
    systemContent = typeof c === "string"
      ? c
      : Array.isArray(c)
        ? c.filter((p): p is { type: "text"; text: string } => "text" in p).map((p) => p.text).join("\n")
        : String(c);
  }

  const payload: Record<string, unknown> = {
    model: config.modelName,
    max_tokens: config.maxTokens ?? 4096,
    messages: nonSystemMessages,
    stream: true,
    ...(systemContent ? { system: systemContent } : {}),
    ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
  };

  const url = `${config.apiBaseUrl.replace(/\/$/, "")}/v1/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const userMessage = classifyHttpError(response.status, config.provider, errorText);
    throw new Error(`LLM stream failed (${config.modelName}): ${userMessage}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      try {
        const chunk = JSON.parse(data);
        if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
          const text = chunk.delta.text;
          if (text) yield text;
        }
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}

/**
 * Stream LLM responses via SSE. Yields text deltas in real-time.
 * Routes to the correct streaming adapter based on provider type.
 */
export async function* streamLLM(
  params: InvokeParams,
  config: ProviderConfig
): AsyncGenerator<string> {
  if (config.provider === "anthropic") {
    yield* streamAnthropicLLM(params, config);
    return;
  }

  // OpenAI-compatible streaming
  const payload = buildBasePayload(params);
  payload.model = config.modelName;
  payload.max_tokens = config.maxTokens ?? 4096;
  payload.stream = true;
  if (config.temperature !== undefined) {
    payload.temperature = config.temperature;
  }

  const url = `${config.apiBaseUrl.replace(/\/$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const userMessage = classifyHttpError(response.status, config.provider, errorText);
    throw new Error(
      `LLM stream failed (${config.modelName}): ${userMessage}`
    );
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") return;
      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Skip malformed JSON chunks
      }
    }
  }
}
