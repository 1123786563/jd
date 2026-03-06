/**
 * Conway 推理客户端
 *
 * 封装 Conway 的 /v1/chat/completions 端点（OpenAI 兼容）。
 * Automaton 通过 Conway 积分支付自己的思考费用。
 */

import type {
  InferenceClient,
  ChatMessage,
  InferenceOptions,
  InferenceResponse,
  InferenceToolCall,
  TokenUsage,
  InferenceToolDefinition,
} from "../types.js";
import { ResilientHttpClient } from "./http-client.js";

const INFERENCE_TIMEOUT_MS = 60_000;

interface InferenceClientOptions {
  apiUrl: string;
  apiKey: string;
  defaultModel: string;
  maxTokens: number;
  lowComputeModel?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  ollamaBaseUrl?: string;
  zhipuApiKey?: string;
  qwenApiKey?: string;
  /** 可选的注册表查找 — 如果提供，会在名称启发式之前使用 */
  getModelProvider?: (modelId: string) => string | undefined;
}

type InferenceBackend = "conway" | "openai" | "anthropic" | "ollama" | "zhipu" | "qwen";

// 后端特性配置：定义各后端的 API 行为差异
const BACKEND_CONFIG = {
  // 这些后端的 API 端点已包含 /v1，不需要额外前缀
  SHORT_API_PATH: new Set(["zhipu", "qwen"]),
  // 这些后端使用 Bearer token 认证
  BEARER_AUTH: new Set(["openai", "ollama", "zhipu", "qwen"]),
} as const;

export function createInferenceClient(
  options: InferenceClientOptions,
): InferenceClient {
  const { apiUrl, apiKey, openaiApiKey, anthropicApiKey, ollamaBaseUrl, zhipuApiKey, qwenApiKey, getModelProvider } = options;
  const httpClient = new ResilientHttpClient({
    baseTimeout: INFERENCE_TIMEOUT_MS,
    retryableStatuses: [429, 500, 502, 503, 504],
  });
  let currentModel = options.defaultModel;
  let maxTokens = options.maxTokens;

  const chat = async (
    messages: ChatMessage[],
    opts?: InferenceOptions,
  ): Promise<InferenceResponse> => {
    const model = opts?.model || currentModel;
    const tools = opts?.tools;

    const backend = resolveInferenceBackend(model, {
      openaiApiKey,
      anthropicApiKey,
      ollamaBaseUrl,
      zhipuApiKey,
      qwenApiKey,
      getModelProvider,
    });

    // 较新的模型（o 系列、gpt-5.x、gpt-4.1）需要 max_completion_tokens。
    // Ollama 始终使用 max_tokens。
    const usesCompletionTokens =
      backend !== "ollama" && /^(o[1-9]|gpt-5|gpt-4\.1)/.test(model);
    const tokenLimit = opts?.maxTokens || maxTokens;

    // 智谱AI 特殊处理：确保至少有一个 user 消息
    // 智谱AI API 要求 messages 中至少包含一个 user 角色的消息
    let processedMessages = messages;
    if (backend === "zhipu") {
      const hasUserMessage = messages.some(m => m.role === "user");
      if (!hasUserMessage) {
        // 在 system 消息后添加一个触发消息
        processedMessages = [
          ...messages.filter(m => m.role === "system"),
          { role: "user", content: "请开始思考并行动。" },
          ...messages.filter(m => m.role !== "system")
        ];
      }
    }

    const body: Record<string, unknown> = {
      model,
      messages: processedMessages.map(formatMessage),
      stream: false,
    };

    if (usesCompletionTokens) {
      body.max_completion_tokens = tokenLimit;
    } else {
      body.max_tokens = tokenLimit;
    }

    if (opts?.temperature !== undefined) {
      body.temperature = opts.temperature;
    }

    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    if (backend === "anthropic") {
      return chatViaAnthropic({
        model,
        tokenLimit,
        messages,
        tools,
        temperature: opts?.temperature,
        anthropicApiKey: anthropicApiKey as string,
        httpClient,
      });
    }

    const openAiLikeApiUrl =
      backend === "openai" ? "https://api.openai.com" :
      backend === "ollama" ? (ollamaBaseUrl as string).replace(/\/$/, "") :
      backend === "zhipu" ? "https://open.bigmodel.cn/api/paas/v4" :
      backend === "qwen" ? "https://coding.dashscope.aliyuncs.com/v1" :
      apiUrl;
    const openAiLikeApiKey =
      backend === "openai" ? (openaiApiKey as string) :
      backend === "ollama" ? "ollama" :
      backend === "zhipu" ? (zhipuApiKey as string) :
      backend === "qwen" ? (qwenApiKey as string) :
      apiKey;

    return chatViaOpenAiCompatible({
      model,
      body,
      apiUrl: openAiLikeApiUrl,
      apiKey: openAiLikeApiKey,
      backend,
      httpClient,
    });
  };

  /**
   * @deprecated 已弃用：请使用 InferenceRouter 进行基于层级的模型选择。
   * 仍然作为后备方案功能正常；当路由器可用时优先使用路由器。
   */
  const setLowComputeMode = (enabled: boolean): void => {
    if (enabled) {
      currentModel = options.lowComputeModel || "gpt-5-mini";
      maxTokens = 4096;
    } else {
      currentModel = options.defaultModel;
      maxTokens = options.maxTokens;
    }
  };

  const getDefaultModel = (): string => {
    return currentModel;
  };

  return {
    chat,
    setLowComputeMode,
    getDefaultModel,
  };
}

function formatMessage(
  msg: ChatMessage,
): Record<string, unknown> {
  const formatted: Record<string, unknown> = {
    role: msg.role,
    content: msg.content,
  };

  if (msg.name) formatted.name = msg.name;
  if (msg.tool_calls) formatted.tool_calls = msg.tool_calls;
  if (msg.tool_call_id) formatted.tool_call_id = msg.tool_call_id;

  return formatted;
}

/**
 * 解析模型使用的后端。
 * 当 InferenceRouter 可用时，它使用模型注册表的 provider 字段。
 * 此函数保留用于直接推理调用的向后兼容。
 */
function resolveInferenceBackend(
  model: string,
  keys: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    ollamaBaseUrl?: string;
    zhipuApiKey?: string;
    qwenApiKey?: string;
    getModelProvider?: (modelId: string) => string | undefined;
  },
): InferenceBackend {
  // 基于注册表的路由：最准确，无需猜测名称
  if (keys.getModelProvider) {
    const provider = keys.getModelProvider(model);
    if (provider === "ollama" && keys.ollamaBaseUrl) return "ollama";
    if (provider === "anthropic" && keys.anthropicApiKey) return "anthropic";
    if (provider === "openai" && keys.openaiApiKey) return "openai";
    if (provider === "zhipu" && keys.zhipuApiKey) return "zhipu";
    if (provider === "qwen" && keys.qwenApiKey) return "qwen";
    if (provider === "conway") return "conway";
    // provider 未知或未配置密钥 — 降级到启发式方法
  }

  // 启发式后备（模型尚未在注册表中）
  if (keys.anthropicApiKey && /^claude/i.test(model)) return "anthropic";
  if (keys.openaiApiKey && /^(gpt-[3-9]|gpt-4|gpt-5|o[1-9][-\s.]|o[1-9]$|chatgpt)/i.test(model)) return "openai";
  if (keys.zhipuApiKey && /^glm/i.test(model)) return "zhipu";
  if (keys.qwenApiKey && /^qwen/i.test(model)) return "qwen";
  return "conway";

}

async function chatViaOpenAiCompatible(params: {
  model: string;
  body: Record<string, unknown>;
  apiUrl: string;
  apiKey: string;
  backend: InferenceBackend;
  httpClient: ResilientHttpClient;
}): Promise<InferenceResponse> {
  // 根据后端特性选择 API 路径
  const apiPath = BACKEND_CONFIG.SHORT_API_PATH.has(params.backend) ? "/chat/completions" : "/v1/chat/completions";
  // 根据后端特性选择认证方式
  const authHeader = BACKEND_CONFIG.BEARER_AUTH.has(params.backend) ? `Bearer ${params.apiKey}` : params.apiKey;

  const resp = await params.httpClient.request(`${params.apiUrl}${apiPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(params.body),
    timeout: INFERENCE_TIMEOUT_MS,
  });

  if (!resp.ok) {
    const text = await resp.text();
    // 详细错误日志：打印请求和响应信息
    console.error(`\n========== API 错误详情 ==========`);
    console.error(`时间: ${new Date().toISOString()}`);
    console.error(`后端: ${params.backend}`);
    console.error(`URL: ${params.apiUrl}${apiPath}`);
    console.error(`HTTP 状态: ${resp.status}`);
    console.error(`响应体: ${text}`);
    console.error(`请求模型: ${params.body.model as string}`);
    console.error(`消息数量: ${(params.body.messages as any[])?.length || 0}`);
    if ((params.body.messages as any[])?.length > 0) {
      console.error(`消息角色列表: ${(params.body.messages as any[]).map(m => m.role).join(', ')}`);
    }
    console.error(`==================================\n`);
    throw new Error(
      `推理错误 (${params.backend}): ${resp.status}: ${text}`,
    );
  }

  const data = await resp.json() as any;
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error("推理未返回任何完成选项");
  }

  const message = choice.message;
  const usage: TokenUsage = {
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0,
    totalTokens: data.usage?.total_tokens || 0,
  };

  const toolCalls: InferenceToolCall[] | undefined =
    message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

  return {
    id: data.id || "",
    model: data.model || params.model,
    message: {
      role: message.role,
      content: message.content || "",
      tool_calls: toolCalls,
    },
    toolCalls,
    usage,
    finishReason: choice.finish_reason || "stop",
  };
}

async function chatViaAnthropic(params: {
  model: string;
  tokenLimit: number;
  messages: ChatMessage[];
  tools?: InferenceToolDefinition[];
  temperature?: number;
  anthropicApiKey: string;
  httpClient: ResilientHttpClient;
}): Promise<InferenceResponse> {
  const transformed = transformMessagesForAnthropic(params.messages);
  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.tokenLimit,
    messages:
      transformed.messages.length > 0
        ? transformed.messages
        : (() => { throw new Error("无法向 Anthropic API 发送空消息数组"); })(),
  };

  if (transformed.system) {
    body.system = transformed.system;
  }

  if (params.temperature !== undefined) {
    body.temperature = params.temperature;
  }

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));
    body.tool_choice = { type: "auto" };
  }

  const resp = await params.httpClient.request("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    timeout: INFERENCE_TIMEOUT_MS,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`推理错误 (anthropic): ${resp.status}: ${text}`);
  }

  const data = await resp.json() as any;
  const content = Array.isArray(data.content) ? data.content : [];
  const textBlocks = content.filter((c: any) => c?.type === "text");
  const toolUseBlocks = content.filter((c: any) => c?.type === "tool_use");

  const toolCalls: InferenceToolCall[] | undefined =
    toolUseBlocks.length > 0
      ? toolUseBlocks.map((tool: any) => ({
          id: tool.id,
          type: "function" as const,
          function: {
            name: tool.name,
            arguments: JSON.stringify(tool.input || {}),
          },
        }))
      : undefined;

  const textContent = textBlocks
    .map((block: any) => String(block.text || ""))
    .join("\n")
    .trim();

  if (!textContent && !toolCalls?.length) {
    throw new Error("Anthropic 推理未返回任何完成内容");
  }

  const promptTokens = data.usage?.input_tokens || 0;
  const completionTokens = data.usage?.output_tokens || 0;
  const usage: TokenUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };

  return {
    id: data.id || "",
    model: data.model || params.model,
    message: {
      role: "assistant",
      content: textContent,
      tool_calls: toolCalls,
    },
    toolCalls,
    usage,
    finishReason: normalizeAnthropicFinishReason(data.stop_reason),
  };
}

function transformMessagesForAnthropic(
  messages: ChatMessage[],
): { system?: string; messages: Array<Record<string, unknown>> } {
  const systemParts: string[] = [];
  const transformed: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      if (msg.content) systemParts.push(msg.content);
      continue;
    }

    if (msg.role === "user") {
      // 合并连续的用户消息
      const last = transformed[transformed.length - 1];
      if (last && last.role === "user" && typeof last.content === "string") {
        last.content = last.content + "\n" + msg.content;
        continue;
      }
      transformed.push({
        role: "user",
        content: msg.content,
      });
      continue;
    }

    if (msg.role === "assistant") {
      const content: Array<Record<string, unknown>> = [];
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      for (const toolCall of msg.tool_calls || []) {
        content.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function.name,
          input: parseToolArguments(toolCall.function.arguments),
        });
      }
      if (content.length === 0) {
        content.push({ type: "text", text: "" });
      }
      // 合并连续的助手消息
      const last = transformed[transformed.length - 1];
      if (last && last.role === "assistant" && Array.isArray(last.content)) {
        (last.content as Array<Record<string, unknown>>).push(...content);
        continue;
      }
      transformed.push({
        role: "assistant",
        content,
      });
      continue;
    }

    if (msg.role === "tool") {
      // 将连续的工具消息合并为单个用户消息
      // 包含多个 tool_result 内容块
      const toolResultBlock = {
        type: "tool_result",
        tool_use_id: msg.tool_call_id || "unknown_tool_call",
        content: msg.content,
      };

      const last = transformed[transformed.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content)) {
        // 将 tool_result 附加到现有用户消息的内容块中
        (last.content as Array<Record<string, unknown>>).push(toolResultBlock);
        continue;
      }

      transformed.push({
        role: "user",
        content: [toolResultBlock],
      });
    }
  }

  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    messages: transformed,
  };
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { _raw: raw };
  }
}

function normalizeAnthropicFinishReason(reason: unknown): string {
  if (typeof reason !== "string") return "stop";
  if (reason === "tool_use") return "tool_calls";
  return reason;
}
