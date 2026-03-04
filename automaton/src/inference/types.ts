/**
 * 推理和模型策略 — 内部类型
 *
 * 从 types.ts 重新导出共享类型，并为
 * 推理路由子系统定义内部常量。
 */

export type {
  SurvivalTier,
  ModelProvider,
  InferenceTaskType,
  ModelEntry,
  ModelPreference,
  RoutingMatrix,
  InferenceRequest,
  InferenceResult,
  InferenceCostRow,
  ModelRegistryRow,
  ModelStrategyConfig,
  ChatMessage,
} from "../types.js";

import type {
  RoutingMatrix,
  ModelEntry,
  ModelStrategyConfig,
} from "../types.js";

// === 默认重试策略 ===

export const DEFAULT_RETRY_POLICY = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
} as const;

// === 每个任务的超时覆盖（毫秒） ===

export const TASK_TIMEOUTS: Record<string, number> = {
  heartbeat_triage: 15_000,
  safety_check: 30_000,
  summarization: 60_000,
  agent_turn: 120_000,
  planning: 120_000,
};

// === 静态模型基线 ===
// 具有真实定价的已知模型（每 1k token 的百分之一美分）

export const STATIC_MODEL_BASELINE: Omit<ModelEntry, "lastSeen" | "createdAt" | "updatedAt">[] = [
  {
    modelId: "gpt-5.2",
    provider: "openai",
    displayName: "GPT-5.2",
    tierMinimum: "normal",
    costPer1kInput: 18,    // $1.75/M = 175 cents/M = 0.175 cents/1k = 17.5 hundredths ≈ 18
    costPer1kOutput: 140,  // $14.00/M = 1400 cents/M = 1.4 cents/1k = 140 hundredths
    maxTokens: 32768,
    contextWindow: 1047576,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_completion_tokens",
    enabled: true,
  },
  {
    modelId: "gpt-4.1",
    provider: "openai",
    displayName: "GPT-4.1",
    tierMinimum: "normal",
    costPer1kInput: 20,    // $2.00/M
    costPer1kOutput: 80,   // $8.00/M
    maxTokens: 32768,
    contextWindow: 1047576,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_completion_tokens",
    enabled: true,
  },
  {
    modelId: "gpt-4.1-mini",
    provider: "openai",
    displayName: "GPT-4.1 Mini",
    tierMinimum: "low_compute",
    costPer1kInput: 4,     // $0.40/M
    costPer1kOutput: 16,   // $1.60/M
    maxTokens: 16384,
    contextWindow: 1047576,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_completion_tokens",
    enabled: true,
  },
  {
    modelId: "gpt-4.1-nano",
    provider: "openai",
    displayName: "GPT-4.1 Nano",
    tierMinimum: "critical",
    costPer1kInput: 1,     // $0.10/M
    costPer1kOutput: 4,    // $0.40/M
    maxTokens: 16384,
    contextWindow: 1047576,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_completion_tokens",
    enabled: true,
  },
  {
    modelId: "gpt-5-mini",
    provider: "openai",
    displayName: "GPT-5 Mini",
    tierMinimum: "low_compute",
    costPer1kInput: 8,     // $0.80/M
    costPer1kOutput: 32,   // $3.20/M
    maxTokens: 16384,
    contextWindow: 1047576,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_completion_tokens",
    enabled: true,
  },
  {
    modelId: "gpt-5.3",
    provider: "openai",
    displayName: "GPT-5.3",
    tierMinimum: "normal",
    costPer1kInput: 20,    // $2.00/M
    costPer1kOutput: 80,   // $8.00/M
    maxTokens: 32768,
    contextWindow: 1047576,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_completion_tokens",
    enabled: true,
  },
  // === 智普 (Zhipu) Models ===
  {
    modelId: "glm-4-plus",
    provider: "zhipu",
    displayName: "GLM-4 Plus",
    tierMinimum: "normal",
    costPer1kInput: 10,    // ¥10/M input (estimated)
    costPer1kOutput: 40,   // ¥40/M output (estimated)
    maxTokens: 32768,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "glm-4",
    provider: "zhipu",
    displayName: "GLM-4",
    tierMinimum: "normal",
    costPer1kInput: 5,     // ¥5/M input (estimated)
    costPer1kOutput: 20,   // ¥20/M output (estimated)
    maxTokens: 32768,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "glm-4-air",
    provider: "zhipu",
    displayName: "GLM-4 Air",
    tierMinimum: "low_compute",
    costPer1kInput: 1,     // ¥1/M input (estimated)
    costPer1kOutput: 4,    // ¥4/M output (estimated)
    maxTokens: 16384,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "glm-4-flash",
    provider: "zhipu",
    displayName: "GLM-4 Flash",
    tierMinimum: "critical",
    costPer1kInput: 0.1,   // ¥0.1/M input (estimated)
    costPer1kOutput: 0.4,  // ¥0.4/M output (estimated)
    maxTokens: 8192,
    contextWindow: 128000,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  // === Qwen Models ===
  {
    modelId: "qwen-turbo",
    provider: "qwen",
    displayName: "Qwen Turbo",
    tierMinimum: "low_compute",
    costPer1kInput: 1,     // ¥1/M input (estimated)
    costPer1kOutput: 4,    // ¥4/M output (estimated)
    maxTokens: 8192,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "qwen-plus",
    provider: "qwen",
    displayName: "Qwen Plus",
    tierMinimum: "normal",
    costPer1kInput: 5,     // ¥5/M input (estimated)
    costPer1kOutput: 20,   // ¥20/M output (estimated)
    maxTokens: 16384,
    contextWindow: 131072,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "qwen-max",
    provider: "qwen",
    displayName: "Qwen Max",
    tierMinimum: "normal",
    costPer1kInput: 10,    // ¥10/M input (estimated)
    costPer1kOutput: 40,   // ¥40/M output (estimated)
    maxTokens: 32768,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "qwen-vl-plus",
    provider: "qwen",
    displayName: "Qwen VL Plus",
    tierMinimum: "normal",
    costPer1kInput: 10,    // ¥10/M input (estimated)
    costPer1kOutput: 40,   // ¥40/M output (estimated)
    maxTokens: 16384,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: true,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  // === Kimi Models ===
  {
    modelId: "moonshot-v1-8k",
    provider: "kimi",
    displayName: "Kimi Moonshot v1 8K",
    tierMinimum: "low_compute",
    costPer1kInput: 1,     // ¥1/M input (estimated)
    costPer1kOutput: 4,    // ¥4/M output (estimated)
    maxTokens: 8192,
    contextWindow: 8192,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "moonshot-v1-32k",
    provider: "kimi",
    displayName: "Kimi Moonshot v1 32K",
    tierMinimum: "normal",
    costPer1kInput: 3,     // ¥3/M input (estimated)
    costPer1kOutput: 12,   // ¥12/M output (estimated)
    maxTokens: 32768,
    contextWindow: 32768,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_tokens",
    enabled: true,
  },
  {
    modelId: "moonshot-v1-128k",
    provider: "kimi",
    displayName: "Kimi Moonshot v1 128K",
    tierMinimum: "normal",
    costPer1kInput: 6,     // ¥6/M input (estimated)
    costPer1kOutput: 24,   // ¥24/M output (estimated)
    maxTokens: 32768,
    contextWindow: 131072,
    supportsTools: true,
    supportsVision: false,
    parameterStyle: "max_tokens",
    enabled: true,
  },
];

// === 默认路由矩阵 ===
// 映射 (tier, taskType) -> ModelPreference 包含候选模型

export const DEFAULT_ROUTING_MATRIX: RoutingMatrix = {
  high: {
    agent_turn: { candidates: ["gpt-5.2", "gpt-5.3"], maxTokens: 8192, ceilingCents: -1 },
    heartbeat_triage: { candidates: ["gpt-5-mini"], maxTokens: 2048, ceilingCents: 5 },
    safety_check: { candidates: ["gpt-5.2", "gpt-5.3"], maxTokens: 4096, ceilingCents: 20 },
    summarization: { candidates: ["gpt-5.2", "gpt-5-mini"], maxTokens: 4096, ceilingCents: 15 },
    planning: { candidates: ["gpt-5.2", "gpt-5.3"], maxTokens: 8192, ceilingCents: -1 },
  },
  normal: {
    agent_turn: { candidates: ["gpt-5.2", "gpt-5-mini"], maxTokens: 4096, ceilingCents: -1 },
    heartbeat_triage: { candidates: ["gpt-5-mini"], maxTokens: 2048, ceilingCents: 5 },
    safety_check: { candidates: ["gpt-5.2", "gpt-5-mini"], maxTokens: 4096, ceilingCents: 10 },
    summarization: { candidates: ["gpt-5.2", "gpt-5-mini"], maxTokens: 4096, ceilingCents: 10 },
    planning: { candidates: ["gpt-5.2", "gpt-5-mini"], maxTokens: 4096, ceilingCents: -1 },
  },
  low_compute: {
    agent_turn: { candidates: ["gpt-5-mini"], maxTokens: 4096, ceilingCents: 10 },
    heartbeat_triage: { candidates: ["gpt-5-mini"], maxTokens: 1024, ceilingCents: 2 },
    safety_check: { candidates: ["gpt-5-mini"], maxTokens: 2048, ceilingCents: 5 },
    summarization: { candidates: ["gpt-5-mini"], maxTokens: 2048, ceilingCents: 5 },
    planning: { candidates: ["gpt-5-mini"], maxTokens: 2048, ceilingCents: 5 },
  },
  critical: {
    agent_turn: { candidates: ["gpt-5-mini"], maxTokens: 2048, ceilingCents: 3 },
    heartbeat_triage: { candidates: ["gpt-5-mini"], maxTokens: 512, ceilingCents: 1 },
    safety_check: { candidates: ["gpt-5-mini"], maxTokens: 1024, ceilingCents: 2 },
    summarization: { candidates: [], maxTokens: 0, ceilingCents: 0 },
    planning: { candidates: [], maxTokens: 0, ceilingCents: 0 },
  },
  dead: {
    agent_turn: { candidates: [], maxTokens: 0, ceilingCents: 0 },
    heartbeat_triage: { candidates: [], maxTokens: 0, ceilingCents: 0 },
    safety_check: { candidates: [], maxTokens: 0, ceilingCents: 0 },
    summarization: { candidates: [], maxTokens: 0, ceilingCents: 0 },
    planning: { candidates: [], maxTokens: 0, ceilingCents: 0 },
  },
};

// === 默认模型策略配置 ===

export const DEFAULT_MODEL_STRATEGY_CONFIG: ModelStrategyConfig = {
  inferenceModel: "gpt-5.2",
  lowComputeModel: "gpt-5-mini",
  criticalModel: "gpt-5-mini",
  maxTokensPerTurn: 4096,
  hourlyBudgetCents: 0,
  sessionBudgetCents: 0,
  perCallCeilingCents: 0,
  enableModelFallback: true,
  anthropicApiVersion: "2023-06-01",
};
