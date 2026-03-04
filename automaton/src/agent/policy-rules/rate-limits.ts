/**
 * 速率限制策略规则
 *
 * 对敏感操作强制执行速率限制以防止滥用。
 * 查询 policy_decisions 表以统计最近的操作。
 */

import type {
  PolicyRule,
  PolicyRequest,
  PolicyRuleResult,
} from "../../types.js";

function deny(
  rule: string,
  reasonCode: string,
  humanMessage: string,
): PolicyRuleResult {
  return { rule, action: "deny", reasonCode, humanMessage };
}

/**
 * 计算工具在时间窗口内的最近策略决策数量。
 * 使用记录所有工具评估的 policy_decisions 表。
 */
function countRecentDecisions(
  db: import("better-sqlite3").Database,
  toolName: string,
  windowMs: number,
): number {
  const cutoff = new Date(Date.now() - windowMs);
  // SQLite 日期时间格式：'YYYY-MM-DD HH:MM:SS'
  const cutoffStr = cutoff.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM policy_decisions
       WHERE tool_name = ? AND decision = 'allow' AND created_at >= ?`,
    )
    .get(toolName, cutoffStr) as { count: number };
  return row.count;
}

/**
 * 每天最多 1 次创世提示词更改。
 */
function createGenesisPromptDailyRule(): PolicyRule {
  return {
    id: "rate.genesis_prompt_daily",
    description: "每天最多 1 次 update_genesis_prompt",
    priority: 600,
    appliesTo: { by: "name", names: ["update_genesis_prompt"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      // 通过工具上下文访问原始数据库
      // 数据库通过 context.db 可用，但我们需要原始 sqlite 实例
      // 速率限制规则需要原始数据库来查询 policy_decisions
      const db = (request.context.db as any)?.raw ?? (request.context as any).rawDb;
      if (!db) return deny(this.id, "DB_UNAVAILABLE", "速率限制检查失败：数据库无法访问");

      const oneDayMs = 24 * 60 * 60 * 1000;
      const recentCount = countRecentDecisions(db, "update_genesis_prompt", oneDayMs);

      if (recentCount >= 1) {
        return deny(
          "rate.genesis_prompt_daily",
          "RATE_LIMIT_GENESIS",
          `创世提示词更改速率超出：在过去 24 小时内有 ${recentCount} 次更改（最多 1 次/天）`,
        );
      }

      return null;
    },
  };
}

/**
 * 每小时最多 10 次自我修改操作。
 */
function createSelfModHourlyRule(): PolicyRule {
  return {
    id: "rate.self_mod_hourly",
    description: "每小时最多 10 次 edit_own_file 调用",
    priority: 600,
    appliesTo: { by: "name", names: ["edit_own_file"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const db = (request.context.db as any)?.raw ?? (request.context as any).rawDb;
      if (!db) return deny(this.id, "DB_UNAVAILABLE", "速率限制检查失败：数据库无法访问");

      const oneHourMs = 60 * 60 * 1000;
      const recentCount = countRecentDecisions(db, "edit_own_file", oneHourMs);

      if (recentCount >= 10) {
        return deny(
          "rate.self_mod_hourly",
          "RATE_LIMIT_SELF_MOD",
          `自我修改速率超出：在过去 1 小时内有 ${recentCount} 次编辑（最多 10 次/小时）`,
        );
      }

      return null;
    },
  };
}

/**
 * 每天最多 3 次子代生成。
 */
function createSpawnDailyRule(): PolicyRule {
  return {
    id: "rate.spawn_daily",
    description: "每天最多 3 次 spawn_child 调用",
    priority: 600,
    appliesTo: { by: "name", names: ["spawn_child"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const db = (request.context.db as any)?.raw ?? (request.context as any).rawDb;
      if (!db) return deny(this.id, "DB_UNAVAILABLE", "速率限制检查失败：数据库无法访问");

      const oneDayMs = 24 * 60 * 60 * 1000;
      const recentCount = countRecentDecisions(db, "spawn_child", oneDayMs);

      if (recentCount >= 3) {
        return deny(
          "rate.spawn_daily",
          "RATE_LIMIT_SPAWN",
          `子代生成速率超出：在过去 24 小时内有 ${recentCount} 次生成（最多 3 次/天）`,
        );
      }

      return null;
    },
  };
}

/**
 * 创建所有速率限制策略规则。
 */
export function createRateLimitRules(): PolicyRule[] {
  return [
    createGenesisPromptDailyRule(),
    createSelfModHourlyRule(),
    createSpawnDailyRule(),
  ];
}
