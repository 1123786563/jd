/**
 * 推理预算跟踪器
 *
 * 跟踪推理成本并强制执行每次调用、
 * 每小时、每个会话和每天的预算限制。
 */

import type BetterSqlite3 from "better-sqlite3";
import { ulid } from "ulid";
import type { InferenceCostRow, ModelStrategyConfig } from "../types.js";
import {
  inferenceInsertCost,
  inferenceGetSessionCosts,
  inferenceGetDailyCost,
  inferenceGetHourlyCost,
  inferenceGetModelCosts,
} from "../state/database.js";

type Database = BetterSqlite3.Database;

export class InferenceBudgetTracker {
  private db: Database;
  readonly config: ModelStrategyConfig;

  constructor(db: Database, config: ModelStrategyConfig) {
    this.db = db;
    this.config = config;
  }

  /**
   * 检查具有估算成本的调用是否在预算内。
   * 返回 { allowed: true } 或 { allowed: false, reason: "..." }。
   */
  checkBudget(
    estimatedCostCents: number,
    model: string,
  ): { allowed: boolean; reason?: string } {
    // 每次调用上限检查
    if (this.config.perCallCeilingCents > 0 && estimatedCostCents > this.config.perCallCeilingCents) {
      return {
        allowed: false,
        reason: `每次调用成本 ${estimatedCostCents}c 超过上限 ${this.config.perCallCeilingCents}c`,
      };
    }

    // 每小时预算检查
    if (this.config.hourlyBudgetCents > 0) {
      const hourlyCost = this.getHourlyCost();
      if (hourlyCost + estimatedCostCents > this.config.hourlyBudgetCents) {
        return {
          allowed: false,
          reason: `每小时预算已用尽：已花费 ${hourlyCost}c + 预估 ${estimatedCostCents}c > 限制 ${this.config.hourlyBudgetCents}c`,
        };
      }
    }

    // 会话预算检查
    if (this.config.sessionBudgetCents > 0) {
      // 当 sessionId 已知时，通过 getSessionCost 强制执行会话预算
      // 这是对整个会话的保护 —— 在 router.route() 中强制执行
    }

    return { allowed: true };
  }

  /**
   * 记录已完成的推理成本。
   */
  recordCost(cost: Omit<InferenceCostRow, "id" | "createdAt">): void {
    inferenceInsertCost(this.db, cost);
  }

  /**
   * 获取当前小时的总成本。
   */
  getHourlyCost(): number {
    return inferenceGetHourlyCost(this.db);
  }

  /**
   * 获取今天（或特定日期）的总成本。
   */
  getDailyCost(date?: string): number {
    return inferenceGetDailyCost(this.db, date);
  }

  /**
   * 获取特定会话的总成本。
   */
  getSessionCost(sessionId: string): number {
    const costs = inferenceGetSessionCosts(this.db, sessionId);
    return costs.reduce((sum, c) => sum + c.costCents, 0);
  }

  /**
   * 获取特定模型的成本细分。
   */
  getModelCosts(model: string, days?: number): { totalCents: number; callCount: number } {
    return inferenceGetModelCosts(this.db, model, days);
  }
}
