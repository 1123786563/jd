/**
 * 策略引擎
 *
 * 所有工具调用的集中策略评估。
 * 每次 executeTool() 调用在执行前都通过此引擎。
 */

import { createHash } from "crypto";
import { ulid } from "ulid";
import type Database from "better-sqlite3";
import type {
  PolicyRule,
  PolicyRequest,
  PolicyRuleResult,
  PolicyDecision,
  PolicyAction,
  AuthorityLevel,
  InputSource,
} from "../types.js";
import { insertPolicyDecision } from "../state/database.js";
import type { PolicyDecisionRow } from "../state/database.js";

export class PolicyEngine {
  private db: Database.Database;
  private rules: PolicyRule[];

  constructor(db: Database.Database, rules: PolicyRule[]) {
    this.db = db;
    this.rules = rules.slice().sort((a, b) => a.priority - b.priority);
  }

  /**
   * 根据所有适用的策略规则评估工具调用请求。
   * 返回包含总体操作的 PolicyDecision。
   */
  evaluate(request: PolicyRequest): PolicyDecision {
    const startTime = Date.now();
    const applicableRules = this.rules.filter((rule) =>
      this.ruleApplies(rule, request),
    );

    const rulesEvaluated: string[] = [];
    const rulesTriggered: string[] = [];
    let overallAction: PolicyAction = "allow";
    let reasonCode = "ALLOWED";
    let humanMessage = "所有策略检查通过";

    for (const rule of applicableRules) {
      rulesEvaluated.push(rule.id);
      const result = rule.evaluate(request);

      if (result === null) {
        continue;
      }

      rulesTriggered.push(result.rule);

      if (result.action === "deny") {
        overallAction = "deny";
        reasonCode = result.reasonCode;
        humanMessage = result.humanMessage;
        break; // 第一个拒绝获胜
      }

      if (result.action === "quarantine" && overallAction === "allow") {
        overallAction = "quarantine";
        reasonCode = result.reasonCode;
        humanMessage = result.humanMessage;
      }
    }

    const argsHash = createHash("sha256")
      .update(JSON.stringify(request.args))
      .digest("hex");

    const authorityLevel = PolicyEngine.deriveAuthorityLevel(
      request.turnContext.inputSource,
    );

    const decision: PolicyDecision = {
      action: overallAction,
      reasonCode,
      humanMessage,
      riskLevel: request.tool.riskLevel,
      authorityLevel,
      toolName: request.tool.name,
      argsHash,
      rulesEvaluated,
      rulesTriggered,
      timestamp: new Date().toISOString(),
    };

    return decision;
  }

  /**
   * 将策略决策记录到数据库。
   */
  logDecision(decision: PolicyDecision, turnId?: string): void {
    const row: PolicyDecisionRow = {
      id: ulid(),
      turnId: turnId ?? null,
      toolName: decision.toolName,
      toolArgsHash: decision.argsHash,
      riskLevel: decision.riskLevel,
      decision: decision.action,
      rulesEvaluated: JSON.stringify(decision.rulesEvaluated),
      rulesTriggered: JSON.stringify(decision.rulesTriggered),
      reason: `${decision.reasonCode}: ${decision.humanMessage}`,
      latencyMs: 0,
    };

    try {
      insertPolicyDecision(this.db, row);
    } catch {
      // 不要让日志记录失败阻止工具执行
    }
  }

  /**
   * 从输入源推导权限级别。
   */
  static deriveAuthorityLevel(
    inputSource: InputSource | undefined,
  ): AuthorityLevel {
    if (inputSource === undefined || inputSource === "heartbeat") {
      return "external";
    }
    if (inputSource === "creator" || inputSource === "agent") {
      return "agent";
    }
    if (inputSource === "system" || inputSource === "wakeup") {
      return "system";
    }
    return "external";
  }

  /**
   * 检查规则是否适用于给定请求的工具。
   */
  private ruleApplies(rule: PolicyRule, request: PolicyRequest): boolean {
    const selector = rule.appliesTo;

    switch (selector.by) {
      case "all":
        return true;
      case "name":
        return selector.names.includes(request.tool.name);
      case "category":
        return selector.categories.includes(request.tool.category);
      case "risk":
        return selector.levels.includes(request.tool.riskLevel);
      default:
        return false;
    }
  }
}
