/**
 * 推理路由器
 *
 * 通过模型注册表路由推理请求，使用
 * 基于层级的选择、预算强制执行和提供商特定的
 * 消息转换。
 */

import type BetterSqlite3 from "better-sqlite3";
import { ulid } from "ulid";
import type {
  InferenceRequest,
  InferenceResult,
  ModelEntry,
  SurvivalTier,
  InferenceTaskType,
  ModelProvider,
  ChatMessage,
  ModelPreference,
} from "../types.js";
import { ModelRegistry } from "./registry.js";
import { InferenceBudgetTracker } from "./budget.js";
import { DEFAULT_ROUTING_MATRIX, TASK_TIMEOUTS } from "./types.js";
import { createLogger } from "../observability/logger.js";

type Database = BetterSqlite3.Database;
const logger = createLogger("inference.router");

export class InferenceRouter {
  private db: Database;
  private registry: ModelRegistry;
  private budget: InferenceBudgetTracker;

  constructor(db: Database, registry: ModelRegistry, budget: InferenceBudgetTracker) {
    this.db = db;
    this.registry = registry;
    this.budget = budget;
  }

  /**
   * 路由推理请求：选择模型、检查预算、
   * 转换消息、调用推理、记录成本。
   */
  async route(
    request: InferenceRequest,
    inferenceChat: (messages: any[], options: any) => Promise<any>,
  ): Promise<InferenceResult> {
    const { messages, taskType, tier, sessionId, turnId, tools } = request;

    // 检查是否为 API-only 模式：跳过预算检查
    const isApiOnly = tier === "high" &&
                      this.budget.config.hourlyBudgetCents === 0 &&
                      this.budget.config.sessionBudgetCents === 0;

    // 1. 从路由矩阵选择模型
    const model = this.selectModel(tier, taskType);
    logger.debug(`Selected model=${model?.modelId} provider=${model?.provider} tier=${tier} taskType=${taskType}`);
    if (!model) {
      return {
        content: "",
        model: "none",
        provider: "other",
        inputTokens: 0,
        outputTokens: 0,
        costCents: 0,
        latencyMs: 0,
        finishReason: "error",
        toolCalls: undefined,
      };
    }

    // 2. 估算成本并检查预算（如果是无预算限制的 API-only 模式则跳过）
    if (!isApiOnly) {
      const estimatedTokens = messages.reduce((sum, m) => sum + (m.content?.length || 0) / 4, 0);
      const estimatedCostCents = Math.ceil(
        (estimatedTokens / 1000) * model.costPer1kInput / 100 +
        (request.maxTokens || 1000) / 1000 * model.costPer1kOutput / 100,
      );

      const budgetCheck = this.budget.checkBudget(estimatedCostCents, model.modelId);
      if (!budgetCheck.allowed) {
        return {
          content: `Budget exceeded: ${budgetCheck.reason}`,
          model: model.modelId,
          provider: model.provider,
          inputTokens: 0,
          outputTokens: 0,
          costCents: 0,
          latencyMs: 0,
          finishReason: "budget_exceeded",
        };
      }

      // 3. 检查会话预算
      if (request.sessionId && this.budget.config.sessionBudgetCents > 0) {
        const sessionCost = this.budget.getSessionCost(request.sessionId);
        if (sessionCost + estimatedCostCents > this.budget.config.sessionBudgetCents) {
          return {
            content: `Session budget exceeded: ${sessionCost}c spent + ${estimatedCostCents}c estimated > ${this.budget.config.sessionBudgetCents}c limit`,
            model: model.modelId,
            provider: model.provider,
            inputTokens: 0,
            outputTokens: 0,
            costCents: 0,
            latencyMs: 0,
            finishReason: "budget_exceeded",
          };
        }
      }
    }

    // 4. 为提供商转换消息
    const transformedMessages = this.transformMessagesForProvider(messages, model.provider);

    // 5. 构建推理选项
    const preference = this.getPreference(tier, taskType);
    const maxTokens = request.maxTokens || preference?.maxTokens || model.maxTokens;
    const timeout = TASK_TIMEOUTS[taskType] || 120_000;

    const inferenceOptions: any = {
      model: model.modelId,
      maxTokens,
      tools: tools,
    };

    // 6. 带超时调用推理
    const startTime = Date.now();
    let response: any;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        inferenceOptions.signal = controller.signal;
        response = await inferenceChat(transformedMessages, inferenceOptions);
      } finally {
        clearTimeout(timer);
      }
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      // 如果启用了回退，尝试下一个候选项
      if (error.name === "AbortError") {
        return {
          content: `Inference timeout after ${timeout}ms`,
          model: model.modelId,
          provider: model.provider,
          inputTokens: 0,
          outputTokens: 0,
          costCents: 0,
          latencyMs,
          finishReason: "timeout",
        };
      }
      throw error;
    }
    const latencyMs = Date.now() - startTime;

    // 7. 计算实际成本
    const inputTokens = response.usage?.promptTokens || 0;
    const outputTokens = response.usage?.completionTokens || 0;
    const actualCostCents = Math.ceil(
      (inputTokens / 1000) * model.costPer1kInput / 100 +
      (outputTokens / 1000) * model.costPer1kOutput / 100,
    );

    // 8. 记录成本
    this.budget.recordCost({
      sessionId,
      turnId: turnId || null,
      model: model.modelId,
      provider: model.provider,
      inputTokens,
      outputTokens,
      costCents: actualCostCents,
      latencyMs,
      tier,
      taskType,
      cacheHit: false,
    });

    // 9. 构建结果
    return {
      content: response.message?.content || "",
      model: model.modelId,
      provider: model.provider,
      inputTokens,
      outputTokens,
      costCents: actualCostCents,
      latencyMs,
      toolCalls: response.toolCalls,
      finishReason: response.finishReason || "stop",
    };
  }

  /**
   * 为给定层级和任务类型选择最佳模型。
   *
   * 优先级：
   *   1. 注册表中存在的第一个路由矩阵候选项
   *   2. 来自 ModelStrategyConfig 的用户配置的模型
   *      （免费/Ollama 模型允许在任何层级使用，包括 dead）
   */
  selectModel(tier: SurvivalTier, taskType: InferenceTaskType): ModelEntry | null {
    const TIER_ORDER: Record<string, number> = {
      dead: 0, critical: 1, low_compute: 2, normal: 3, high: 4,
    };

    const tierRank = TIER_ORDER[tier] ?? 0;

    // 1. 尝试路由矩阵候选项
    const preference = this.getPreference(tier, taskType);
    if (preference && preference.candidates.length > 0) {
      for (const candidateId of preference.candidates) {
        const entry = this.registry.get(candidateId);
        if (entry && entry.enabled) {
          return entry;
        }
      }
    }

    // 2. 回退到用户配置的模型。
    //    这会处理路由矩阵模型不存在的本地/Ollama 设置。
    const strategy = this.budget.config;
    const fallbackIds: (string | undefined)[] =
      tier === "critical" || tier === "dead"
        ? [strategy.criticalModel, strategy.inferenceModel, strategy.lowComputeModel]
        : [strategy.inferenceModel, strategy.lowComputeModel, strategy.criticalModel];

    for (const modelId of fallbackIds) {
      if (!modelId) continue;
      const entry = this.registry.get(modelId);
      if (!entry || !entry.enabled) continue;
      const isFree = entry.costPer1kInput === 0 && entry.costPer1kOutput === 0;
      const tierOk = tierRank >= (TIER_ORDER[entry.tierMinimum] ?? 0);
      if (isFree || tierOk) {
        return entry;
      }
    }

    return null;
  }

  /**
   * 为特定提供商转换消息。
   * 处理 Anthropic 的交替角色要求。
   */
  transformMessagesForProvider(messages: ChatMessage[], provider: ModelProvider): ChatMessage[] {
    if (messages.length === 0) {
      throw new Error("无法使用空消息数组路由推理");
    }

    if (provider === "anthropic") {
      return this.fixAnthropicMessages(messages);
    }

    // 对于 OpenAI/Conway，合并连续的相同角色消息
    return this.mergeConsecutiveSameRole(messages);
  }

  /**
   * 为 Anthropic API 要求修复消息：
   * 1. 提取系统消息
   * 2. 合并连续的相同角色消息
   * 3. 将连续的工具消息合并为单个用户消息
   *    包含多个 tool_result 内容块
   */
  private fixAnthropicMessages(messages: ChatMessage[]): ChatMessage[] {
    const result: ChatMessage[] = [];

    for (const msg of messages) {
      // 系统消息由 Anthropic 客户端单独处理
      if (msg.role === "system") {
        result.push(msg);
        continue;
      }

      // 工具消息变为带有 tool_result 内容的用户消息
      if (msg.role === "tool") {
        const last = result[result.length - 1];
        // 如果前一条消息也是工具（现在是用户），则合并到其中
        if (last && last.role === "user" && (last as any)._toolResultMerged) {
          // 追加到合并的内容中
          last.content = last.content + "\n[tool_result:" + (msg.tool_call_id || "unknown") + "] " + msg.content;
          continue;
        }
        // 否则创建新的用户消息
        const userMsg: ChatMessage & { _toolResultMerged?: boolean } = {
          role: "user",
          content: "[tool_result:" + (msg.tool_call_id || "unknown") + "] " + msg.content,
          _toolResultMerged: true,
        };
        result.push(userMsg);
        continue;
      }

      // 对于 user/assistant：如果角色相同则与前面的合并
      const last = result[result.length - 1];
      if (last && last.role === msg.role) {
        last.content = (last.content || "") + "\n" + (msg.content || "");
        if (msg.tool_calls) {
          last.tool_calls = [...(last.tool_calls || []), ...msg.tool_calls];
        }
        continue;
      }

      result.push({ ...msg });
    }

    // 清理内部标记
    for (const msg of result) {
      delete (msg as any)._toolResultMerged;
    }

    return result;
  }

  /**
   * 合并具有相同角色的连续消息。
   */
  private mergeConsecutiveSameRole(messages: ChatMessage[]): ChatMessage[] {
    const result: ChatMessage[] = [];

    for (const msg of messages) {
      const last = result[result.length - 1];
      // 合并连续的相同角色消息（tool 消息除外）
      // 特别处理：合并连续的 system 消息，因为某些 API（如智谱AI）不支持多个 system 消息
      if (last && last.role === msg.role && msg.role !== "tool") {
        last.content = (last.content || "") + "\n" + (msg.content || "");
        if (msg.tool_calls) {
          last.tool_calls = [...(last.tool_calls || []), ...msg.tool_calls];
        }
        continue;
      }
      result.push({ ...msg });
    }

    return result;
  }

  private getPreference(tier: SurvivalTier, taskType: InferenceTaskType): ModelPreference | undefined {
    return DEFAULT_ROUTING_MATRIX[tier]?.[taskType];
  }
}
