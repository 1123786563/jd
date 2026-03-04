/**
 * 子健康监视器
 *
 * 通过查询沙盒来检查子自动机的健康状况。
 * 使用 JSON 解析（而不是字符串匹配）来获取状态结果。
 * 从不因健康检查而抛出异常——而是返回问题数组。
 */

import type { Database as DatabaseType } from "better-sqlite3";
import type { ConwayClient, HealthCheckResult, ChildHealthConfig } from "../types.js";
import { DEFAULT_CHILD_HEALTH_CONFIG } from "../types.js";
import type { ChildLifecycle } from "./lifecycle.js";

export { DEFAULT_CHILD_HEALTH_CONFIG };

export class ChildHealthMonitor {
  private config: ChildHealthConfig;

  constructor(
    private db: DatabaseType,
    private conway: ConwayClient,
    private lifecycle: ChildLifecycle,
    config?: Partial<ChildHealthConfig>,
  ) {
    this.config = { ...DEFAULT_CHILD_HEALTH_CONFIG, ...config };
  }

  /**
   * 检查单个子自动机的健康状况。从不抛出异常。
   */
  async checkHealth(childId: string): Promise<HealthCheckResult> {
    const issues: string[] = [];
    let healthy = false;
    let lastSeen: string | null = null;
    let uptime: number | null = null;
    let creditBalance: number | null = null;

    try {
      // 查找子沙盒
      const childRow = this.db
        .prepare("SELECT sandbox_id FROM children WHERE id = ?")
        .get(childId) as { sandbox_id: string } | undefined;

      if (!childRow) {
        return { childId, healthy: false, lastSeen: null, uptime: null, creditBalance: null, issues: ["未找到子自动机"] };
      }

      // 在沙盒中执行状态检查
      const result = await this.conway.exec(
        `curl -sf http://localhost:3000/health 2>/dev/null || echo '{"status":"offline"}'`,
        10_000,
      );

      // 解析 JSON 状态输出（不是字符串匹配）
      try {
        const status = JSON.parse(result.stdout.trim());
        if (status.status === "healthy" || status.status === "running") {
          healthy = true;
          lastSeen = new Date().toISOString();
          uptime = status.uptime ?? null;
          creditBalance = status.creditBalance ?? null;
        } else {
          issues.push(`状态：${status.status}`);
          if (status.error) issues.push(`错误：${status.error}`);
        }
      } catch {
        issues.push("解析健康检查响应失败");
      }
    } catch (error) {
      issues.push(`健康检查错误：${error instanceof Error ? error.message : String(error)}`);
    }

    // 更新 last_checked 时间戳
    try {
      this.db.prepare("UPDATE children SET last_checked = datetime('now') WHERE id = ?").run(childId);
    } catch {
      // 非关键
    }

    return { childId, healthy, lastSeen, uptime, creditBalance, issues };
  }

  /**
   * 检查所有活动子自动机（健康 + 不健康）的健康状况。
   * 遵守并发限制。根据结果转换子自动机状态。
   */
  async checkAllChildren(): Promise<HealthCheckResult[]> {
    const healthyChildren = this.lifecycle.getChildrenInState("healthy");
    const unhealthyChildren = this.lifecycle.getChildrenInState("unhealthy");
    const allChildren = [...healthyChildren, ...unhealthyChildren];

    if (allChildren.length === 0) return [];

    const results: HealthCheckResult[] = [];
    const maxConcurrent = this.config.maxConcurrentChecks;

    // 分批处理以进行并发限制
    for (let i = 0; i < allChildren.length; i += maxConcurrent) {
      const batch = allChildren.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((child) => this.checkHealth(child.id)),
      );

      for (const result of batchResults) {
        const child = allChildren.find((c) => c.id === result.childId);
        if (!child) continue;

        try {
          if (!result.healthy && child.status === "healthy") {
            this.lifecycle.transition(result.childId, "unhealthy", result.issues.join("; "));
          } else if (result.healthy && child.status === "unhealthy") {
            this.lifecycle.transition(result.childId, "healthy", "已恢复");
          }
        } catch {
          // 如果状态并发更改，转换可能会失败；非致命
        }

        results.push(result);
      }
    }

    return results;
  }
}
