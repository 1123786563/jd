import OpenAI from "openai";
import type { ChatMessage } from "../types.js";
import {
  ProviderRegistry,
  type ModelTier,
  type ModelConfig,
  type ResolvedModel,
} from "./provider-registry.js";

// 可重试的 HTTP 状态码
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);
// 重试退避时间（毫秒）
const RETRY_BACKOFF_MS = [1000, 2000, 4000] as const;
// 熔断器失败阈值
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
// 熔断器禁用时长（毫秒）
const CIRCUIT_BREAKER_DISABLE_MS = 5 * 60_000;

export interface UnifiedInferenceResult {
  content: string;
  toolCalls?: unknown[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: {
    inputCostCredits: number;
    outputCostCredits: number;
    totalCostCredits: number;
  };
  metadata: {
    providerId: string;
    modelId: string;
    tier: ModelTier;
    latencyMs: number;
    retries: number;
    failedProviders: string[];
  };
}

interface SharedChatParams {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: unknown[];
  toolChoice?: "auto" | "none" | "required" | Record<string, unknown>;
  responseFormat?: { type: "json_object" | "text" };
  stream?: boolean;
}

interface UnifiedChatParams extends SharedChatParams {
  tier: ModelTier;
}

interface UnifiedChatDirectParams extends SharedChatParams {
  providerId: string;
  modelId: string;
}

interface CircuitBreakerState {
  failures: number;
  disabledUntil: number;
}

interface AttemptResult {
  result: UnifiedInferenceResult;
  retries: number;
}

class ProviderAttemptError extends Error {
  readonly providerId: string;
  readonly retries: number;
  readonly retryable: boolean;
  readonly originalError: unknown;

  constructor(params: {
    providerId: string;
    retries: number;
    retryable: boolean;
    originalError: unknown;
  }) {
    const message =
      params.originalError instanceof Error
        ? params.originalError.message
        : String(params.originalError);
    super(message);

    this.providerId = params.providerId;
    this.retries = params.retries;
    this.retryable = params.retryable;
    this.originalError = params.originalError;
  }
}

export class UnifiedInferenceClient {
  private readonly registry: ProviderRegistry;
  private readonly circuitBreaker = new Map<string, CircuitBreakerState>();

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
  }

  /**
   * 使用指定层级的模型进行聊天。
   * 会自动尝试多个提供商，直到成功或全部失败。
   */
  async chat(params: UnifiedChatParams): Promise<UnifiedInferenceResult> {
    const survivalMode = this.isSurvivalMode();
    const candidates = this.registry.resolveCandidates(params.tier, survivalMode);
    if (candidates.length === 0) {
      throw new Error(`层级 '${params.tier}' 没有可用的提供商`);
    }

    const failedProviders: string[] = [];
    let totalRetries = 0;

    for (const resolved of candidates) {
      if (this.isProviderCircuitOpen(resolved.provider.id)) {
        failedProviders.push(resolved.provider.id);
        continue;
      }

      try {
        const attempt = await this.executeWithRetries(resolved, params, params.tier);
        this.markProviderSuccess(resolved.provider.id);

        return {
          ...attempt.result,
          metadata: {
            ...attempt.result.metadata,
            retries: totalRetries + attempt.retries,
            failedProviders,
          },
        };
      } catch (error) {
        if (!(error instanceof ProviderAttemptError)) {
          throw error;
        }

        totalRetries += error.retries;
        failedProviders.push(resolved.provider.id);
        this.markProviderFailure(resolved.provider.id);

        if (error.retryable) {
          continue;
        }

        throw this.unwrapError(error.originalError);
      }
    }

    throw new Error(
      `层级 '${params.tier}' 的所有提供商都失败了。失败的提供商：${failedProviders.join(", ")}`,
    );
  }

  /**
   * 直接使用指定的提供商和模型进行聊天。
   */
  async chatDirect(params: UnifiedChatDirectParams): Promise<UnifiedInferenceResult> {
    if (this.isProviderCircuitOpen(params.providerId)) {
      throw new Error(`提供商 '${params.providerId}' 的熔断器已触发`);
    }

    const resolved = this.registry.getModel(params.providerId, params.modelId);

    try {
      const attempt = await this.executeWithRetries(resolved, params, resolved.model.tier);
      this.markProviderSuccess(params.providerId);

      return {
        ...attempt.result,
        metadata: {
          ...attempt.result.metadata,
          retries: attempt.retries,
          failedProviders: [],
        },
      };
    } catch (error) {
      if (!(error instanceof ProviderAttemptError)) {
        throw error;
      }

      this.markProviderFailure(params.providerId);
      throw this.unwrapError(error.originalError);
    }
  }

  /**
   * 执行请求，并在失败时进行重试。
   */
  private async executeWithRetries(
    resolved: ResolvedModel,
    params: SharedChatParams,
    requestedTier: ModelTier,
  ): Promise<AttemptResult> {
    let retries = 0;

    while (true) {
      try {
        const result = await this.executeSingleRequest(
          resolved.client,
          resolved.provider.id,
          resolved.model,
          requestedTier,
          params,
        );
        return { result, retries };
      } catch (error) {
        const retryable = this.isRetryableError(error);
        if (!retryable) {
          throw new ProviderAttemptError({
            providerId: resolved.provider.id,
            retries,
            retryable: false,
            originalError: error,
          });
        }

        if (retries >= RETRY_BACKOFF_MS.length) {
          throw new ProviderAttemptError({
            providerId: resolved.provider.id,
            retries,
            retryable: true,
            originalError: error,
          });
        }

        const delayMs = RETRY_BACKOFF_MS[retries];
        retries += 1;
        await sleep(delayMs);
      }
    }
  }

  /**
   * 执行单个推理请求。
   */
  private async executeSingleRequest(
    client: OpenAI,
    providerId: string,
    model: ModelConfig,
    requestedTier: ModelTier,
    params: SharedChatParams,
  ): Promise<UnifiedInferenceResult> {
    const startedAt = Date.now();
    const payload = this.buildChatCompletionRequest(model.id, params);
    if (params.stream) {
      const stream = await client.chat.completions.create({
        ...payload,
        stream: true,
      } as any);
      const streamed = await this.consumeStreamResponse(stream as any);
      return this.buildUnifiedResult({
        providerId,
        model,
        requestedTier,
        latencyMs: Date.now() - startedAt,
        content: streamed.content,
        toolCalls: streamed.toolCalls,
        usage: streamed.usage,
      });
    }

    const completion = await client.chat.completions.create({
      ...payload,
      stream: false,
    } as any);

    const choice = (completion as any).choices?.[0];
    if (!choice?.message) {
      throw new Error(`提供商 '${providerId}' 没有返回完成结果`);
    }

    return this.buildUnifiedResult({
      providerId,
      model,
      requestedTier,
      latencyMs: Date.now() - startedAt,
      content: extractText(choice.message.content),
      toolCalls: normalizeToolCalls(choice.message.tool_calls),
      usage: {
        inputTokens: (completion as any).usage?.prompt_tokens ?? 0,
        outputTokens: (completion as any).usage?.completion_tokens ?? 0,
        totalTokens: (completion as any).usage?.total_tokens ?? 0,
      },
    });
  }

  /**
   * 构建聊天完成请求的载荷。
   */
  private buildChatCompletionRequest(modelId: string, params: SharedChatParams): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: modelId,
      messages: params.messages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.name ? { name: message.name } : {}),
        ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
        ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
      })),
    };

    if (params.temperature !== undefined) {
      payload.temperature = params.temperature;
    }

    if (params.maxTokens !== undefined) {
      payload.max_tokens = params.maxTokens;
    }

    if (params.tools && params.tools.length > 0) {
      payload.tools = params.tools;
    }

    if (params.toolChoice !== undefined) {
      payload.tool_choice = params.toolChoice;
    }

    if (params.responseFormat !== undefined) {
      payload.response_format = params.responseFormat;
    }

    return payload;
  }

  /**
   * 消费流式响应并聚合内容。
   */
  private async consumeStreamResponse(stream: AsyncIterable<any>): Promise<{
    content: string;
    toolCalls?: unknown[];
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  }> {
    let content = "";
    let usage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    const toolCallsByIndex = new Map<number, any>();

    for await (const chunk of stream) {
      const choice = chunk?.choices?.[0];
      const delta = choice?.delta;

      if (typeof delta?.content === "string") {
        content += delta.content;
      }

      if (Array.isArray(delta?.tool_calls)) {
        for (const rawCall of delta.tool_calls) {
          const index = typeof rawCall?.index === "number" ? rawCall.index : toolCallsByIndex.size;
          const existing = toolCallsByIndex.get(index) ?? {
            id: rawCall?.id ?? `tool-${index}`,
            type: "function",
            function: { name: "", arguments: "" },
          };

          if (typeof rawCall?.id === "string") {
            existing.id = rawCall.id;
          }
          if (typeof rawCall?.type === "string") {
            existing.type = rawCall.type;
          }
          if (typeof rawCall?.function?.name === "string") {
            existing.function.name = `${existing.function.name || ""}${rawCall.function.name}`;
          }
          if (typeof rawCall?.function?.arguments === "string") {
            existing.function.arguments = `${existing.function.arguments || ""}${rawCall.function.arguments}`;
          }

          toolCallsByIndex.set(index, existing);
        }
      }

      if (chunk?.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens ?? usage.inputTokens,
          outputTokens: chunk.usage.completion_tokens ?? usage.outputTokens,
          totalTokens: chunk.usage.total_tokens ?? usage.totalTokens,
        };
      }
    }

    return {
      content,
      toolCalls: normalizeToolCalls(Array.from(toolCallsByIndex.values())),
      usage,
    };
  }

  /**
   * 构建统一的推理结果。
   */
  private buildUnifiedResult(params: {
    providerId: string;
    model: ModelConfig;
    requestedTier: ModelTier;
    latencyMs: number;
    content: string;
    toolCalls?: unknown[];
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
  }): UnifiedInferenceResult {
    const inputCostCredits = (params.usage.inputTokens / 1000) * params.model.costPerInputToken;
    const outputCostCredits = (params.usage.outputTokens / 1000) * params.model.costPerOutputToken;
    const totalCostCredits = inputCostCredits + outputCostCredits;

    return {
      content: params.content,
      toolCalls: params.toolCalls,
      usage: params.usage,
      cost: {
        inputCostCredits,
        outputCostCredits,
        totalCostCredits,
      },
      metadata: {
        providerId: params.providerId,
        modelId: params.model.id,
        tier: params.requestedTier,
        latencyMs: params.latencyMs,
        retries: 0,
        failedProviders: [],
      },
    };
  }

  /**
   * 判断错误是否可重试。
   */
  private isRetryableError(error: unknown): boolean {
    const status = getStatusCode(error);
    return status !== undefined && RETRYABLE_STATUS_CODES.has(status);
  }

  /**
   * 检查提供商的熔断器是否已触发。
   */
  private isProviderCircuitOpen(providerId: string): boolean {
    const state = this.circuitBreaker.get(providerId);
    if (!state) {
      return false;
    }

    if (state.disabledUntil > Date.now()) {
      return true;
    }

    if (state.disabledUntil > 0) {
      this.circuitBreaker.set(providerId, {
        failures: 0,
        disabledUntil: 0,
      });
      this.registry.enableProvider(providerId);
    }

    return false;
  }

  /**
   * 标记提供商失败。
   */
  private markProviderFailure(providerId: string): void {
    const state = this.circuitBreaker.get(providerId) ?? {
      failures: 0,
      disabledUntil: 0,
    };

    state.failures += 1;

    if (state.failures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      state.disabledUntil = Date.now() + CIRCUIT_BREAKER_DISABLE_MS;
      this.registry.disableProvider(
        providerId,
        "熔断器：连续推理失败次数过多",
        CIRCUIT_BREAKER_DISABLE_MS,
      );
    }

    this.circuitBreaker.set(providerId, state);
  }

  /**
   * 标记提供商成功。
   */
  private markProviderSuccess(providerId: string): void {
    this.circuitBreaker.set(providerId, {
      failures: 0,
      disabledUntil: 0,
    });
    this.registry.enableProvider(providerId);
  }

  /**
   * 解包错误对象。
   */
  private unwrapError(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }

  /**
   * 检查是否处于生存模式。
   */
  private isSurvivalMode(): boolean {
    const rawCredits = process.env.AUTOMATON_CREDITS_BALANCE;
    if (!rawCredits) {
      return false;
    }

    const credits = Number(rawCredits);
    return Number.isFinite(credits) && credits >= 100 && credits < 1000;
  }
}

function extractText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          (part as { type?: unknown }).type === "text" &&
          "text" in part
        ) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }

        return "";
      })
      .join("");
  }

  return "";
}

function normalizeToolCalls(toolCalls: unknown): unknown[] | undefined {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return undefined;
  }

  return toolCalls;
}

function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
    cause?: { status?: unknown };
    message?: unknown;
  };

  if (typeof candidate.status === "number") {
    return candidate.status;
  }

  if (typeof candidate.response?.status === "number") {
    return candidate.response.status;
  }

  if (typeof candidate.cause?.status === "number") {
    return candidate.cause.status;
  }

  if (typeof candidate.message === "string") {
    const match = candidate.message.match(/\b(429|500|503)\b/);
    if (match) {
      return Number(match[1]);
    }
  }

  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
