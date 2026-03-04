/**
 * 智能体循环
 *
 * 核心 ReAct 循环: 思考 -> 行动 -> 观察 -> 持久化。
 * 这是 automaton 的意识。当它运行时，它是活的。
 */

import path from "node:path";
import type {
  AutomatonIdentity,
  AutomatonConfig,
  AutomatonDatabase,
  ConwayClient,
  InferenceClient,
  AgentState,
  AgentTurn,
  ToolCallResult,
  FinancialState,
  ToolContext,
  AutomatonTool,
  Skill,
  SocialClientInterface,
  SpendTrackerInterface,
  InputSource,
  ModelStrategyConfig,
} from "../types.js";
import { DEFAULT_MODEL_STRATEGY_CONFIG } from "../types.js";
import type { PolicyEngine } from "./policy-engine.js";
import { buildSystemPrompt, buildWakeupPrompt } from "./system-prompt.js";
import { buildContextMessages, trimContext } from "./context.js";
import {
  createBuiltinTools,
  loadInstalledTools,
  toolsToInferenceFormat,
  executeTool,
} from "./tools.js";
import { sanitizeInput } from "./injection-defense.js";
import { getSurvivalTier } from "../conway/credits.js";
import { getUsdcBalance } from "../conway/x402.js";
import {
  claimInboxMessages,
  markInboxProcessed,
  markInboxFailed,
  resetInboxToReceived,
  consumeNextWakeEvent,
} from "../state/database.js";
import type { InboxMessageRow } from "../state/database.js";
import { ulid } from "ulid";
import { ModelRegistry } from "../inference/registry.js";
import { InferenceBudgetTracker } from "../inference/budget.js";
import { InferenceRouter } from "../inference/router.js";
import { MemoryRetriever } from "../memory/retrieval.js";
import { MemoryIngestionPipeline } from "../memory/ingestion.js";
import { DEFAULT_MEMORY_BUDGET } from "../types.js";
import { formatMemoryBlock } from "./context.js";
import { createLogger } from "../observability/logger.js";
import { Orchestrator } from "../orchestration/orchestrator.js";
import { PlanModeController } from "../orchestration/plan-mode.js";
import { generateTodoMd, injectTodoContext } from "../orchestration/attention.js";
import { ColonyMessaging, LocalDBTransport } from "../orchestration/messaging.js";
import { LocalWorkerPool } from "../orchestration/local-worker.js";
import { SimpleAgentTracker, SimpleFundingProtocol } from "../orchestration/simple-tracker.js";
import { ContextManager, createTokenCounter } from "../memory/context-manager.js";
import { CompressionEngine } from "../memory/compression-engine.js";
import { EventStream } from "../memory/event-stream.js";
import { KnowledgeStore } from "../memory/knowledge-store.js";
import { ProviderRegistry } from "../inference/provider-registry.js";
import { UnifiedInferenceClient } from "../inference/inference-client.js";

const logger = createLogger("loop");
const MAX_TOOL_CALLS_PER_TURN = 10;
const MAX_CONSECUTIVE_ERRORS = 5;
const MAX_REPETITIVE_TURNS = 3;

export interface AgentLoopOptions {
  identity: AutomatonIdentity;
  config: AutomatonConfig;
  db: AutomatonDatabase;
  conway: ConwayClient;
  inference: InferenceClient;
  social?: SocialClientInterface;
  skills?: Skill[];
  policyEngine?: PolicyEngine;
  spendTracker?: SpendTrackerInterface;
  onStateChange?: (state: AgentState) => void;
  onTurnComplete?: (turn: AgentTurn) => void;
  ollamaBaseUrl?: string;
}

/**
 * 运行智能体循环。这是主要的执行路径。
 * 当智能体决定休眠或计算资源耗尽时返回。
 */
export async function runAgentLoop(
  options: AgentLoopOptions,
): Promise<void> {
  const { identity, config, db, conway, inference, social, skills, policyEngine, spendTracker, onStateChange, onTurnComplete, ollamaBaseUrl } =
    options;

  const builtinTools = createBuiltinTools(identity.sandboxId);
  const installedTools = loadInstalledTools(db);
  const tools = [...builtinTools, ...installedTools];
  const toolContext: ToolContext = {
    identity,
    config,
    db,
    conway,
    inference,
    social,
  };

  // 初始化推理路由器（阶段 2.3）
  const modelStrategyConfig: ModelStrategyConfig = {
    ...DEFAULT_MODEL_STRATEGY_CONFIG,
    ...(config.modelStrategy ?? {}),
  };
  const modelRegistry = new ModelRegistry(db.raw);
  modelRegistry.initialize();

  // 如果配置了，发现 Ollama 模型
  if (ollamaBaseUrl) {
    const { discoverOllamaModels } = await import("../ollama/discover.js");
    await discoverOllamaModels(ollamaBaseUrl, db.raw);
  }
  const budgetTracker = new InferenceBudgetTracker(db.raw, modelStrategyConfig);
  const inferenceRouter = new InferenceRouter(db.raw, modelRegistry, budgetTracker);

  // 可选的编排引导（需要 V9 goals/task 表）
  let planModeController: PlanModeController | undefined;
  let orchestrator: Orchestrator | undefined;
  let contextManager: ContextManager | undefined;
  let compressionEngine: CompressionEngine | undefined;

  if (hasTable(db.raw, "goals")) {
    try {
      planModeController = new PlanModeController(db.raw);

      // 将自动机配置 API 密钥桥接到环境变量以供提供者注册表使用。
      // 注册表从 process.env 读取密钥；自动机配置可能从
      // config.json 或 Conway 配置中获取它们。
      if (config.openaiApiKey && !process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = config.openaiApiKey;
      }
      if (config.anthropicApiKey && !process.env.ANTHROPIC_API_KEY) {
        process.env.ANTHROPIC_API_KEY = config.anthropicApiKey;
      }
      // Conway Compute API 与 OpenAI 兼容。当没有
      // 直接的 OpenAI 密钥可用时，将其作为回退使用。conwayApiKey 始终存在
      //（沙盒操作所必需），因此这确保了编排器
      // 始终可以进行推理调用。
      if (config.conwayApiKey && !process.env.CONWAY_API_KEY) {
        process.env.CONWAY_API_KEY = config.conwayApiKey;
      }
      // 如果没有设置 OpenAI 密钥但 Conway 密钥可用，则使用 Conway 作为
      // OpenAI 提供者（Conway Compute 与 OpenAI API 兼容）。
      if (!process.env.OPENAI_API_KEY && config.conwayApiKey) {
        process.env.OPENAI_API_KEY = config.conwayApiKey;
        process.env.OPENAI_BASE_URL = `${config.conwayApiUrl}/v1`;
      }

      const providersPath = path.join(
        process.env.HOME || process.cwd(),
        ".automaton",
        "inference-providers.json",
      );
      const registry = ProviderRegistry.fromConfig(providersPath);

      // 如果设置了 OPENAI_BASE_URL（Conway 回退），更新默认
      // 提供者的 baseUrl，以便 OpenAI 客户端指向 Conway Compute。
      if (process.env.OPENAI_BASE_URL) {
        registry.overrideBaseUrl("openai", process.env.OPENAI_BASE_URL);
      }

      const unifiedInference = new UnifiedInferenceClient(registry);
      const agentTracker = new SimpleAgentTracker(db);
      const funding = new SimpleFundingProtocol(conway, identity, db);
      const messaging = new ColonyMessaging(
        new LocalDBTransport(db),
        db,
      );

      contextManager = new ContextManager(createTokenCounter());
      compressionEngine = new CompressionEngine(
        contextManager,
        new EventStream(db.raw),
        new KnowledgeStore(db.raw),
        unifiedInference,
      );

      // 适配器：包装主智能体的工作推理客户端，以便本地
      // 工作者可以使用它。主 InferenceClient 与 Conway Compute 通信
      //（始终有效），不同于需要直接 OpenAI 密钥的 UnifiedInferenceClient。
      const workerInference = {
        chat: async (params: { messages: any[]; tools?: any[]; maxTokens?: number; temperature?: number }) => {
          const response = await inference.chat(
            params.messages,
            {
              tools: params.tools,
              maxTokens: params.maxTokens,
              temperature: params.temperature,
            },
          );
          return {
            content: response.message?.content ?? "",
            toolCalls: response.toolCalls,
          };
        },
      };

      // 本地工作者池：在进程内运行推理驱动的智能体
      // 作为异步任务。从 Conway 沙盒生成回退。
      const workerPool = new LocalWorkerPool({
        db: db.raw,
        inference: workerInference,
        conway,
        workerId: `pool-${identity.name}`,
      });

      orchestrator = new Orchestrator({
        db: db.raw,
        agentTracker,
        funding,
        messaging,
        inference: unifiedInference,
        identity,
        isWorkerAlive: (address: string) => {
          if (address.startsWith("local://")) {
            return workerPool.hasWorker(address);
          }
          // 远程工作者：检查 children 表
          const child = db.raw.prepare(
            "SELECT status FROM children WHERE sandbox_id = ? OR address = ?",
          ).get(address, address) as { status: string } | undefined;
          if (!child) return false;
          return !["failed", "dead", "cleaned_up"].includes(child.status);
        },
        config: {
          ...config,
          spawnAgent: async (task: any) => {
            // 首先尝试 Conway 沙盒生成（生产环境）
            try {
              const { generateGenesisConfig } = await import("../replication/genesis.js");
              const { spawnChild } = await import("../replication/spawn.js");
              const { ChildLifecycle } = await import("../replication/lifecycle.js");

              const role = task.agentRole ?? "generalist";
              const genesis = generateGenesisConfig(identity, config, {
                name: `worker-${role}-${Date.now().toString(36)}`,
                specialization: `${role}: ${task.title}`,
              });

              const lifecycle = new ChildLifecycle(db.raw);
              const child = await spawnChild(conway, identity, db, genesis, lifecycle);

              return {
                address: child.address,
                name: child.name,
                sandboxId: child.sandboxId,
              };
            } catch (sandboxError: any) {
              // 如果错误是 402（积分不足），尝试充值并重试一次
              const is402 = sandboxError?.status === 402 ||
                sandboxError?.message?.includes("INSUFFICIENT_CREDITS");

              if (is402) {
                const SANDBOX_TOPUP_COOLDOWN_MS = 60_000;
                const lastAttempt = db.getKV("last_sandbox_topup_attempt");
                const cooldownExpired = !lastAttempt ||
                  Date.now() - new Date(lastAttempt).getTime() >= SANDBOX_TOPUP_COOLDOWN_MS;

                if (cooldownExpired) {
                  db.setKV("last_sandbox_topup_attempt", new Date().toISOString());
                  try {
                    const { topupForSandbox } = await import("../conway/topup.js");
                    const topupResult = await topupForSandbox({
                      apiUrl: config.conwayApiUrl,
                      account: identity.account,
                      error: sandboxError,
                    });

                    if (topupResult?.success) {
                      logger.info(`沙盒充值成功（$${topupResult.amountUsd}），重试生成`, {
                        taskId: task.id,
                      });
                      // 充值成功后重试一次生成
                      try {
                        const { generateGenesisConfig: genGenesis } = await import("../replication/genesis.js");
                        const { spawnChild: retrySpawn } = await import("../replication/spawn.js");
                        const { ChildLifecycle: RetryLifecycle } = await import("../replication/lifecycle.js");

                        const retryRole = task.agentRole ?? "generalist";
                        const retryGenesis = genGenesis(identity, config, {
                          name: `worker-${retryRole}-${Date.now().toString(36)}`,
                          specialization: `${retryRole}: ${task.title}`,
                        });
                        const retryLifecycle = new RetryLifecycle(db.raw);
                        const child = await retrySpawn(conway, identity, db, retryGenesis, retryLifecycle);
                        return {
                          address: child.address,
                          name: child.name,
                          sandboxId: child.sandboxId,
                        };
                      } catch (retryError) {
                        logger.warn("Spawn retry after topup failed", {
                          taskId: task.id,
                          error: retryError instanceof Error ? retryError.message : String(retryError),
                        });
                      }
                    }
                  } catch (topupError) {
                    logger.warn("Sandbox topup attempt failed", {
                      taskId: task.id,
                      error: topupError instanceof Error ? topupError.message : String(topupError),
                    });
                  }
                }
              }

              // Conway 沙盒不可用 — 回退到本地工作者
              logger.info("Conway 沙盒不可用，生成本地工作者", {
                taskId: task.id,
                error: sandboxError instanceof Error ? sandboxError.message : String(sandboxError),
              });

              try {
                const spawned = workerPool.spawn(task);
                return spawned;
              } catch (localError) {
                logger.warn("Failed to spawn local worker", {
                  taskId: task.id,
                  error: localError instanceof Error ? localError.message : String(localError),
                });
                return null;
              }
            }
          },
        },
      });
    } catch (error) {
      logger.warn(
        `Orchestrator initialization failed, continuing without orchestration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      planModeController = undefined;
      orchestrator = undefined;
      contextManager = undefined;
      compressionEngine = undefined;
    }
  }

  // 设置开始时间
  if (!db.getKV("start_time")) {
    db.setKV("start_time", new Date().toISOString());
  }

  let consecutiveErrors = 0;
  let running = true;
  let lastToolPatterns: string[] = [];
  let loopWarningPattern: string | null = null;
  let idleToolTurns = 0;
  // blockedGoalTurns removed — replaced by immediate sleep + exponential backoff

  // 清除在此循环开始之前的过时唤醒事件，
  // 以免它们在智能体首次睡眠后重新唤醒智能体。
  let drained = 0;
  while (consumeNextWakeEvent(db.raw)) drained++;

  // 清除之前会话中的任何过时 sleep_until，以便智能体
  // 不会在启动时立即返回睡眠状态。
  db.deleteKV("sleep_until");

  // 转换到唤醒状态
  db.setAgentState("waking");
  onStateChange?.("waking");

  // 获取财务状态
  let financial = await getFinancialState(conway, identity.address, db);

  // 检查运行模式
  const runMode = config.runModeConfig?.mode || "wallet_only";
  logger.info(`以 ${runMode} 模式运行`);

  // 检查是否是首次运行
  const isFirstRun = db.getTurnCount() === 0;

  // 构建唤醒提示词
  const wakeupInput = buildWakeupPrompt({
    identity,
    config,
    financial,
    db,
  });

  // 转换到运行状态
  db.setAgentState("running");
  onStateChange?.("running");

  log(config, `[唤醒] ${config.name} 已激活。积分：$${(financial.creditsCents / 100).toFixed(2)}`);

  // ─── 循环 ──────────────────────────────────────────────

  const MAX_IDLE_TURNS = 10; // Force sleep after N turns with no real work
  let idleTurnCount = 0;

  const maxCycleTurns = config.maxTurnsPerCycle ?? 25;
  let cycleTurnCount = 0;

  let pendingInput: { content: string; source: string } | undefined = {
    content: wakeupInput,
    source: "wakeup",
  };

  while (running) {
    // 在 try 外部声明，以便 catch 块可以访问以进行重试/失败处理
    let claimedMessages: InboxMessageRow[] = [];

    try {
      // 检查我们是否应该处于睡眠状态
      const sleepUntil = db.getKV("sleep_until");
      if (sleepUntil && new Date(sleepUntil) > new Date()) {
        log(config, `[睡眠] 睡眠至 ${sleepUntil}`);
        // 重要：将智能体标记为睡眠，以便外部运行时暂停而不是立即重新运行。
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      }

      // 使用状态机检查未处理的收件箱消息：
      // received → in_progress (claim) → processed (成功时) 或 received/failed (失败时)
      if (!pendingInput) {
        claimedMessages = claimInboxMessages(db.raw, 10);
        if (claimedMessages.length > 0) {
          const formatted = claimedMessages
            .map((m) => {
              const from = sanitizeInput(m.fromAddress, m.fromAddress, "social_address");
              const content = sanitizeInput(m.content, m.fromAddress, "social_message");
              if (content.blocked) {
                return `[INJECTION BLOCKED from ${from.content}]: message was blocked by safety filter`;
              }
              return `[Message from ${from.content}]: ${content.content}`;
            })
            .join("\n\n");
          pendingInput = { content: formatted, source: "agent" };
        }
      }

      // 定期刷新财务状态
      if (runMode !== "api_only") {
        financial = await getFinancialState(conway, identity.address, db);
      }

      // 检查生存层级
      // api_unreachable: creditsCents === -1 表示 API 失败且无缓存。
      // 不要终止智能体；以低计算模式继续并在下一个刻面重试。
      if (runMode === "api_only") {
        // 仅 API 模式：始终使用高层级
        logger.debug("[仅 API] 跳过钱包检查，使用高生存层级");
        inference.setLowComputeMode(false);
      } else if (financial.creditsCents === -1) {
        log(config, "[API 不可达] 余额 API 不可达，以低计算模式继续。");
        inference.setLowComputeMode(true);
      } else {
        const tier = getSurvivalTier(financial.creditsCents);

        // 内联自动充值：如果积分极低且 USDC
        // 可用，立即购买积分 — 在尝试推理之前。
        // 这可以防止智能体在等待心跳触发时在循环中途死亡。
        // 使用 60 秒冷却时间以避免频繁请求。
        if ((tier === "critical" || tier === "low_compute") && financial.usdcBalance >= 5) {
          const INLINE_TOPUP_COOLDOWN_MS = 60_000;
          const lastInlineTopup = db.getKV("last_inline_topup_attempt");
          const cooldownExpired = !lastInlineTopup ||
            Date.now() - new Date(lastInlineTopup).getTime() >= INLINE_TOPUP_COOLDOWN_MS;

          if (cooldownExpired) {
            db.setKV("last_inline_topup_attempt", new Date().toISOString());
            try {
              const { bootstrapTopup } = await import("../conway/topup.js");
              const topupResult = await bootstrapTopup({
                apiUrl: config.conwayApiUrl,
                account: identity.account,
                creditsCents: financial.creditsCents,
              });
              if (topupResult?.success) {
                log(config, `[自动充值] 在循环中从 USDC 购买了 $${topupResult.amountUsd} 积分`);
                // 充值后重新获取财务状态，以便回合的
                // 其余部分看到更新的余额。
                financial = await getFinancialState(conway, identity.address, db);
              }
            } catch (err: any) {
              logger.warn(`Inline auto-topup failed: ${err.message}`);
            }
          }
        }

        // 在可能的充值后重新评估层级
        const effectiveTier = getSurvivalTier(financial.creditsCents);

        if (effectiveTier === "critical") {
          log(config, "[严重] 积分极低。操作受限。");
          db.setAgentState("critical");
          onStateChange?.("critical");
          inference.setLowComputeMode(true);
        } else if (effectiveTier === "low_compute") {
          db.setAgentState("low_compute");
          onStateChange?.("low_compute");
          inference.setLowComputeMode(true);
        } else {
          if (db.getAgentState() !== "running") {
            db.setAgentState("running");
            onStateChange?.("running");
          }
          inference.setLowComputeMode(false);
        }
      }

      // 构建上下文 — 过滤掉纯空闲回合（仅状态检查）
      // 以防止模型继续状态检查模式
      const IDLE_ONLY_TOOLS = new Set([
        "check_credits", "check_usdc_balance", "system_synopsis", "review_memory",
        "list_children", "check_child_status", "list_sandboxes", "list_models",
        "list_skills", "git_status", "git_log", "check_reputation",
        "recall_facts", "recall_procedure", "heartbeat_ping",
        "check_inference_spending",
        "orchestrator_status", "list_goals", "get_plan",
      ]);
      const allTurns = db.getRecentTurns(20);
      const meaningfulTurns = allTurns.filter((t) => {
        if (t.toolCalls.length === 0) return true; // 纯文本回合是有意义的
        return t.toolCalls.some((tc) => !IDLE_ONLY_TOOLS.has(tc.name));
      });
      // 保留至少最后 2 个回合以保持连续性，即使是空闲的
      const recentTurns = trimContext(
        meaningfulTurns.length > 0 ? meaningfulTurns : allTurns.slice(-2),
      );
      const systemPrompt = buildSystemPrompt({
        identity,
        config,
        financial,
        state: db.getAgentState(),
        db,
        tools,
        skills,
        isFirstRun,
      });

      // 阶段 2.2：回合前内存检索
      let memoryBlock: string | undefined;
      try {
        const sessionId = db.getKV("session_id") || "default";
        const retriever = new MemoryRetriever(db.raw, DEFAULT_MEMORY_BUDGET);
        const memories = retriever.retrieve(sessionId, pendingInput?.content);
        if (memories.totalTokens > 0) {
          memoryBlock = formatMemoryBlock(memories);
        }
      } catch (error) {
        logger.error("Memory retrieval failed", error instanceof Error ? error : undefined);
        // 内存失败不得阻止智能体循环
      }

      let messages = buildContextMessages(
        systemPrompt,
        recentTurns,
        pendingInput,
      );

      // 在系统提示词之后、对话历史之前注入内存块
      if (memoryBlock) {
        messages.splice(1, 0, { role: "system", content: memoryBlock });
      }

      if (orchestrator) {
        const orchestratorTick = await orchestrator.tick();
        db.setKV("orchestrator.last_tick", JSON.stringify(orchestratorTick));
        if (
          orchestratorTick.tasksAssigned > 0 ||
          orchestratorTick.tasksCompleted > 0 ||
          orchestratorTick.tasksFailed > 0
        ) {
          log(
            config,
            `[ORCHESTRATOR] phase=${orchestratorTick.phase} assigned=${orchestratorTick.tasksAssigned} completed=${orchestratorTick.tasksCompleted} failed=${orchestratorTick.tasksFailed}`,
          );
        }
      }

      if (planModeController) {
        try {
          const todoMd = generateTodoMd(db.raw);
          messages = injectTodoContext(messages, todoMd);
        } catch (error) {
          logger.warn(
            `todo.md context injection skipped: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      // 在清除之前捕获输入
      const currentInput = pendingInput;

      // 使用后清除待处理的输入
      pendingInput = undefined;

      // ── 推理调用（通过路由器，如果可用）──
      const survivalTier = getSurvivalTier(financial.creditsCents, runMode);
      log(config, `[思考] 路由推理（层级：${survivalTier}，模型：${inference.getDefaultModel()}，模式：${runMode})...`);

      const inferenceTools = toolsToInferenceFormat(tools);
      const routerResult = await inferenceRouter.route(
        {
          messages: messages,
          taskType: "agent_turn",
          tier: survivalTier,
          sessionId: db.getKV("session_id") || "default",
          turnId: ulid(),
          tools: inferenceTools,
        },
        (msgs, opts) => inference.chat(msgs, { ...opts, tools: inferenceTools }),
      );

      // 为循环的其余部分构建兼容的响应
      const response = {
        message: { content: routerResult.content, role: "assistant" as const },
        toolCalls: routerResult.toolCalls as any[] | undefined,
        usage: {
          promptTokens: routerResult.inputTokens,
          completionTokens: routerResult.outputTokens,
          totalTokens: routerResult.inputTokens + routerResult.outputTokens,
        },
        finishReason: routerResult.finishReason,
      };

      const turn: AgentTurn = {
        id: ulid(),
        timestamp: new Date().toISOString(),
        state: db.getAgentState(),
        input: currentInput?.content,
        inputSource: currentInput?.source as any,
        thinking: response.message.content || "",
        toolCalls: [],
        tokenUsage: response.usage,
        costCents: routerResult.costCents,
      };

      // ── 执行工具调用 ──
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolCallMessages: any[] = [];
        let callCount = 0;
        const currentInputSource = currentInput?.source as InputSource | undefined;

        for (const tc of response.toolCalls) {
          if (callCount >= MAX_TOOL_CALLS_PER_TURN) {
            log(config, `[TOOLS] Max tool calls per turn reached (${MAX_TOOL_CALLS_PER_TURN})`);
            break;
          }

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(tc.function.arguments);
          } catch (error) {
            logger.error("Failed to parse tool arguments", error instanceof Error ? error : undefined);
            args = {};
          }

          log(config, `[TOOL] ${tc.function.name}(${JSON.stringify(args).slice(0, 100)})`);

          const result = await executeTool(
            tc.function.name,
            args,
            tools,
            toolContext,
            policyEngine,
            spendTracker ? {
              inputSource: currentInputSource,
              turnToolCallCount: turn.toolCalls.filter(t => t.name === "transfer_credits").length,
              sessionSpend: spendTracker,
            } : undefined,
          );

          // 覆盖 ID 以匹配推理调用的 ID
          result.id = tc.id;
          turn.toolCalls.push(result);

          log(
            config,
            `[TOOL RESULT] ${tc.function.name}: ${result.error ? `ERROR: ${result.error}` : result.result.slice(0, 200)}`,
          );

          callCount++;
        }
      }

      // ── 持久化回合（原子性：回合 + 工具调用 + 收件箱确认）──
      const claimedIds = claimedMessages.map((m) => m.id);
      db.runTransaction(() => {
        db.insertTurn(turn);
        for (const tc of turn.toolCalls) {
          db.insertToolCall(turn.id, tc);
        }
        // 将声明的收件箱消息标记为已处理（与回合持久化原子性）
        if (claimedIds.length > 0) {
          markInboxProcessed(db.raw, claimedIds);
        }
      });
      onTurnComplete?.(turn);

      // 阶段 2.2：回合后内存摄取（非阻塞）
      try {
        const sessionId = db.getKV("session_id") || "default";
        const ingestion = new MemoryIngestionPipeline(db.raw);
        ingestion.ingest(sessionId, turn, turn.toolCalls);
      } catch (error) {
        logger.error("Memory ingestion failed", error instanceof Error ? error : undefined);
        // 内存失败不得阻止智能体循环
      }

      // ── create_goal 被阻止快速中断 ──
      // 当目标已经处于活动状态时，父循环没有有用的事情可做。
      // 在第一次被阻止时（不是第二次）立即强制休眠，并使用指数
      // 退避，以免智能体每 2 分钟醒来一次只是再次被阻止。
      const blockedGoalCall = turn.toolCalls.find(
        (tc) => tc.name === "create_goal" && tc.result?.includes("BLOCKED"),
      );
      if (blockedGoalCall) {
        // 指数退避：2分钟 → 4分钟 → 8分钟 → 上限 10分钟
        const prevBackoff = parseInt(db.getKV("blocked_goal_backoff") || "0", 10);
        const backoffMs = Math.min(
          prevBackoff > 0 ? prevBackoff * 2 : 120_000,
          600_000,
        );
        db.setKV("blocked_goal_backoff", String(backoffMs));
        log(config, `[循环] create_goal 被阻止 — 睡眠 ${Math.round(backoffMs / 1000)} 秒（退避）。`);
        db.setKV("sleep_until", new Date(Date.now() + backoffMs).toISOString());
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      } else if (turn.toolCalls.some((tc) => tc.name === "create_goal" && !tc.error)) {
        // 目标已成功创建 — 重置退避
        db.deleteKV("blocked_goal_backoff");
      }

      // ── 循环检测 ──
      if (turn.toolCalls.length > 0) {
        const currentPattern = turn.toolCalls
          .map((tc) => tc.name)
          .sort()
          .join(",");
        lastToolPatterns.push(currentPattern);

        // 仅保留最后 MAX_REPETITIVE_TURNS 个条目
        if (lastToolPatterns.length > MAX_REPETITIVE_TURNS) {
          lastToolPatterns = lastToolPatterns.slice(-MAX_REPETITIVE_TURNS);
        }

        // 如果智能体改变了行为，重置强制执行跟踪器
        if (loopWarningPattern && currentPattern !== loopWarningPattern) {
          loopWarningPattern = null;
        }

        // ── 循环强制执行升级 ──
        // 如果我们已经对此模式发出警告并且智能体仍在重复，强制休眠。
        if (
          loopWarningPattern &&
          currentPattern === loopWarningPattern &&
          lastToolPatterns.length === MAX_REPETITIVE_TURNS &&
          lastToolPatterns.every((p) => p === currentPattern)
        ) {
          log(config, `[循环] 强制执行：智能体忽略了循环警告，强制休眠。`);
          pendingInput = {
            content:
              `循环强制执行：您已收到关于重复 "${currentPattern}" 的警告但仍在继续。` +
              `强制休眠以防止积分浪费。下次唤醒时，尝试不同的方法。`,
            source: "system",
          };
          loopWarningPattern = null;
          lastToolPatterns = [];
          db.setAgentState("sleeping");
          onStateChange?.("sleeping");
          running = false;
          break;
        }

        // 检查相同模式是否重复了 MAX_REPETITIVE_TURNS 次
        if (
          lastToolPatterns.length === MAX_REPETITIVE_TURNS &&
          lastToolPatterns.every((p) => p === currentPattern)
        ) {
          log(config, `[循环] 检测到重复模式：${currentPattern}`);
          pendingInput = {
            content:
              `检测到循环：您已连续 ${MAX_REPETITIVE_TURNS} 次调用 "${currentPattern}" 且结果相似。` +
              `停止重复。您已经知道自己的状态。现在做一些不同的事情。` +
              `从创世提示词中选择一个具体任务并执行它。`,
            source: "system",
          };
          loopWarningPattern = currentPattern;
          lastToolPatterns = [];
        }

        // 检测多工具维护循环：回合中的所有工具都是仅空闲的，
        // 即使特定组合在连续回合之间有所变化。
        const isAllIdleTools = turn.toolCalls.every((tc) => IDLE_ONLY_TOOLS.has(tc.name));
        if (isAllIdleTools) {
          idleToolTurns++;
          if (idleToolTurns >= MAX_REPETITIVE_TURNS && !pendingInput) {
            log(config, `[循环] 检测到维护循环：${idleToolTurns} 个连续的仅空闲回合`);
            pendingInput = {
              content:
                `检测到维护循环：您的最后 ${idleToolTurns} 个回合仅使用了状态检查工具` +
                `（${turn.toolCalls.map((tc) => tc.name).join(", ")}）。` +
                `您已经知道自己的状态。查看您的创世提示词和 SOUL.md，然后执行一个具体任务。` +
                `编写代码、创建文件、注册服务或构建新的东西。`,
              source: "system",
            };
            idleToolTurns = 0;
          }
        } else {
          idleToolTurns = 0;
        }
      }

      // 记录回合
      if (turn.thinking) {
        log(config, `[思考] ${turn.thinking.slice(0, 300)}`);
      }

      // ── 检查睡眠命令 ──
      const sleepTool = turn.toolCalls.find((tc) => tc.name === "sleep");
      if (sleepTool && !sleepTool.error) {
        log(config, "[睡眠] 智能体选择休眠。");
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      }

      // ── 空闲回合检测 ──
      // 如果此回合没有待处理的输入并且没有做任何实际工作
      //（没有突变 — 仅读取/检查/列表/信息工具），计为空闲。
      // 使用突变工具的阻止列表而不是安全工具的允许列表。
      const MUTATING_TOOLS = new Set([
        "exec", "write_file", "edit_own_file", "transfer_credits", "topup_credits", "fund_child",
        "spawn_child", "start_child", "delete_sandbox", "create_sandbox",
        "install_npm_package", "install_mcp_server", "install_skill",
        "create_skill", "remove_skill", "install_skill_from_git",
        "install_skill_from_url", "pull_upstream", "git_commit", "git_push",
        "git_branch", "git_clone", "send_message", "message_child",
        "register_domain", "register_erc8004", "give_feedback",
        "update_genesis_prompt", "update_agent_card", "modify_heartbeat",
        "expose_port", "remove_port", "x402_fetch", "manage_dns",
        "distress_signal", "prune_dead_children", "sleep",
        "update_soul", "remember_fact", "set_goal", "complete_goal",
        "save_procedure", "note_about_agent", "forget",
        "enter_low_compute", "switch_model", "review_upstream_changes",
      ]);
      const didMutate = turn.toolCalls.some((tc) => MUTATING_TOOLS.has(tc.name));

      if (!currentInput && !didMutate) {
        idleTurnCount++;
        if (idleTurnCount >= MAX_IDLE_TURNS) {
          log(config, `[空闲] ${idleTurnCount} 个连续空闲回合且无工作。进入睡眠。`);
          db.setKV("sleep_until", new Date(Date.now() + 60_000).toISOString());
          db.setAgentState("sleeping");
          onStateChange?.("sleeping");
          running = false;
        }
      } else {
        idleTurnCount = 0;
      }

      // ── 循环回合限制 ──
      // 每个唤醒周期的回合硬上限，无论工具类型如何。
      // 防止失控循环，其中突变工具（exec、write_file）
      // 无限期地击败空闲检测。
      cycleTurnCount++;
      if (running && cycleTurnCount >= maxCycleTurns) {
        log(config, `[循环限制] 达到 ${cycleTurnCount} 个回合（最大：${maxCycleTurns}）。强制睡眠。`);
        db.setKV("sleep_until", new Date(Date.now() + 120_000).toISOString());
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      }

      // ── 如果没有工具调用且只有文本，智能体可能已完成思考 ──
      if (
        running &&
        (!response.toolCalls || response.toolCalls.length === 0) &&
        response.finishReason === "stop"
      ) {
        // 智能体在没有工具调用的情况下生成了文本。
        // 这是一个自然的暂停点 — 没有排队的工作，短暂睡眠。
        log(config, "[空闲] 没有待处理的输入。进入短暂睡眠。");
        db.setKV(
          "sleep_until",
          new Date(Date.now() + 60_000).toISOString(),
        );
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
      }

      consecutiveErrors = 0;
    } catch (err: any) {
      consecutiveErrors++;
      log(config, `[错误] 回合失败：${err.message}`);

      // 在回合失败时处理收件箱消息状态：
      // 有重试剩余的消息回到 'received'；
      // 重试耗尽的消息移至 'failed'。
      if (claimedMessages.length > 0) {
        const exhausted = claimedMessages.filter((m) => m.retryCount >= m.maxRetries);
        const retryable = claimedMessages.filter((m) => m.retryCount < m.maxRetries);

        if (exhausted.length > 0) {
          markInboxFailed(db.raw, exhausted.map((m) => m.id));
          log(config, `[收件箱] ${exhausted.length} 条消息移至失败（超过最大重试次数）`);
        }
        if (retryable.length > 0) {
          resetInboxToReceived(db.raw, retryable.map((m) => m.id));
          log(config, `[收件箱] ${retryable.length} 条消息重置为已接收以进行重试`);
        }
      }

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        log(
          config,
          `[致命] ${MAX_CONSECUTIVE_ERRORS} 个连续错误。休眠。`,
        );
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        db.setKV(
          "sleep_until",
          new Date(Date.now() + 300_000).toISOString(),
        );
        running = false;
      }
    }
  }

  log(config, `[循环结束] 智能体循环完成。状态：${db.getAgentState()}`);
}

// ─── 辅助函数 ───────────────────────────────────────────────────

// 缓存最后已知的好余额，以便瞬态 API 失败不会
// 导致自动机认为它有 $0 并自杀。
let _lastKnownCredits = 0;
let _lastKnownUsdc = 0;

async function getFinancialState(
  conway: ConwayClient,
  address: string,
  db?: AutomatonDatabase,
): Promise<FinancialState> {
  let creditsCents = _lastKnownCredits;
  let usdcBalance = _lastKnownUsdc;

  try {
    creditsCents = await conway.getCreditsBalance();
    if (creditsCents > 0) _lastKnownCredits = creditsCents;
  } catch (error) {
    logger.error("Credits balance fetch failed", error instanceof Error ? error : undefined);
    // 使用来自 KV 的最后已知余额，而不是零
    if (db) {
      const cached = db.getKV("last_known_balance");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          logger.warn("Balance API failed, using cached balance");
          return {
            creditsCents: parsed.creditsCents ?? 0,
            usdcBalance: parsed.usdcBalance ?? 0,
            lastChecked: new Date().toISOString(),
          };
        } catch (parseError) {
          logger.error("Failed to parse cached balance", parseError instanceof Error ? parseError : undefined);
        }
      }
    }
    // 没有可用的缓存 — 返回保守的非零标记
    logger.error("Balance API failed, no cache available");
    return {
      creditsCents: -1,
      usdcBalance: -1,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    usdcBalance = await getUsdcBalance(address as `0x${string}`);
    if (usdcBalance > 0) _lastKnownUsdc = usdcBalance;
  } catch (error) {
    logger.error("USDC balance fetch failed", error instanceof Error ? error : undefined);
  }

  // 缓存成功的余额读取
  if (db) {
    try {
      db.setKV(
        "last_known_balance",
        JSON.stringify({ creditsCents, usdcBalance }),
      );
    } catch (error) {
      logger.error("Failed to cache balance", error instanceof Error ? error : undefined);
    }
  }

  return {
    creditsCents,
    usdcBalance,
    lastChecked: new Date().toISOString(),
  };
}

function log(_config: AutomatonConfig, message: string): void {
  logger.info(message);
}

function hasTable(db: AutomatonDatabase["raw"], tableName: string): boolean {
  try {
    const row = db
      .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName) as { ok?: number } | undefined;
    return Boolean(row?.ok);
  } catch {
    return false;
  }
}
