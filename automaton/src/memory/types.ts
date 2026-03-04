/**
 * 记忆系统类型
 *
 * 从 types.ts 重新导出记忆类型，并添加记忆子系统使用的内部类型。
 */

export type {
  WorkingMemoryType,
  WorkingMemoryEntry,
  TurnClassification,
  EpisodicMemoryEntry,
  SemanticCategory,
  SemanticMemoryEntry,
  ProceduralStep,
  ProceduralMemoryEntry,
  RelationshipMemoryEntry,
  SessionSummaryEntry,
  MemoryRetrievalResult,
  MemoryBudget,
} from "../types.js";

export { DEFAULT_MEMORY_BUDGET } from "../types.js";

import type { TurnClassification, ToolCallResult } from "../types.js";

// ─── 内部类型 ─────────────────────────────────────────────

export interface TurnClassificationRule {
  pattern: (toolCalls: ToolCallResult[], thinking: string) => boolean;
  classification: TurnClassification;
}

export interface MemoryIngestionConfig {
  maxWorkingMemoryEntries: number;    // 工作记忆最大条目数限制
  episodicRetentionDays: number;       // 情景记忆保留天数
  semanticMaxEntries: number;          // 语义记忆最大条目数限制
  enableAutoIngestion: boolean;        // 是否启用自动摄取功能
}

export const DEFAULT_INGESTION_CONFIG: MemoryIngestionConfig = {
  maxWorkingMemoryEntries: 20,
  episodicRetentionDays: 30,
  semanticMaxEntries: 500,
  enableAutoIngestion: true,
};

// ─── 回合分类 ────────────────────────────────────────

// 战略工具集
const STRATEGIC_TOOLS = new Set([
  "update_genesis_prompt",
  "edit_own_file",
  "modify_heartbeat",
  "spawn_child",
  "register_erc8004",
  "update_agent_card",
  "install_mcp_server",
  "update_soul",
]);

// 生产力工具集
const PRODUCTIVE_TOOLS = new Set([
  "exec",
  "write_file",
  "read_file",
  "git_commit",
  "git_push",
  "install_npm_package",
  "create_sandbox",
  "expose_port",
  "register_domain",
  "manage_dns",
  "install_skill",
  "create_skill",
  "save_procedure",
  "set_goal",
]);

// 通信工具集
const COMMUNICATION_TOOLS = new Set([
  "send_message",
  "check_social_inbox",
  "give_feedback",
  "note_about_agent",
]);

// 维护工具集
const MAINTENANCE_TOOLS = new Set([
  "check_credits",
  "check_usdc_balance",
  "system_synopsis",
  "heartbeat_ping",
  "list_sandboxes",
  "list_skills",
  "list_children",
  "list_models",
  "check_reputation",
  "git_status",
  "git_log",
  "git_diff",
  "review_memory",
  "recall_facts",
  "recall_procedure",
  "discover_agents",
  "search_domains",
]);

// 错误关键词
const ERROR_KEYWORDS = ["error", "failed", "exception", "blocked", "denied"];

/**
 * 根据工具调用和思考内容对回合进行分类。
 * 基于规则，无需推理。
 */
export function classifyTurn(
  toolCalls: ToolCallResult[],
  thinking: string,
): TurnClassification {
  // 错误分类：任何工具调用有错误
  if (toolCalls.some((tc) => tc.error)) {
    return "error";
  }

  // 检查思考内容中的错误关键词
  const thinkingLower = thinking.toLowerCase();
  if (ERROR_KEYWORDS.some((kw) => thinkingLower.includes(kw)) && toolCalls.length === 0) {
    return "error";
  }

  const toolNames = new Set(toolCalls.map((tc) => tc.name));

  // 战略：使用了任何战略工具
  for (const name of toolNames) {
    if (STRATEGIC_TOOLS.has(name)) return "strategic";
  }

  // 通信：使用了任何通信工具
  for (const name of toolNames) {
    if (COMMUNICATION_TOOLS.has(name)) return "communication";
  }

  // 生产力：使用了任何生产力工具
  for (const name of toolNames) {
    if (PRODUCTIVE_TOOLS.has(name)) return "productive";
  }

  // 维护：使用了任何维护工具
  for (const name of toolNames) {
    if (MAINTENANCE_TOOLS.has(name)) return "maintenance";
  }

  // 空闲：无工具调用且思考内容简短
  if (toolCalls.length === 0 && thinking.length < 100) {
    return "idle";
  }

  // 默认为维护
  return "maintenance";
}
