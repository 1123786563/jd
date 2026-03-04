/**
 * 沙盒清理
 *
 * 清理已停止/失败的子自动机的沙盒资源。
 * 在销毁后将子自动机转换到 cleaned_up 状态。
 */

import type { Database as DatabaseType } from "better-sqlite3";
import type { ConwayClient } from "../types.js";
import type { ChildLifecycle } from "./lifecycle.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("replication.cleanup");

export class SandboxCleanup {
  constructor(
    private conway: ConwayClient,
    private lifecycle: ChildLifecycle,
    private db: DatabaseType,
  ) {}

  /**
   * 清理单个子自动机的沙盒。
   * 仅适用于处于已停止或失败状态的子自动机。
   */
  async cleanup(childId: string): Promise<void> {
    const state = this.lifecycle.getCurrentState(childId);
    if (state !== "stopped" && state !== "failed") {
      throw new Error(`无法清理处于以下状态的子自动机：${state}`);
    }

    // 查找沙盒 ID
    const childRow = this.db
      .prepare("SELECT sandbox_id FROM children WHERE id = ?")
      .get(childId) as { sandbox_id: string } | undefined;

    // Conway API 禁用沙盒删除（预付费，不可退款）。
    // 转换到 cleaned_up 以释放子槽位供重用。
    const sandboxNote = childRow?.sandbox_id
      ? `沙盒 ${childRow.sandbox_id} 已释放（删除已禁用）`
      : "没有沙盒需要清理";
    this.lifecycle.transition(childId, "cleaned_up", sandboxNote);
  }

  /**
   * 清理所有已停止和失败的子自动机。
   */
  async cleanupAll(): Promise<number> {
    const stopped = this.lifecycle.getChildrenInState("stopped");
    const failed = this.lifecycle.getChildrenInState("failed");
    let cleaned = 0;

    for (const child of [...stopped, ...failed]) {
      try {
        await this.cleanup(child.id);
        cleaned++;
      } catch (error) {
        logger.error(`清理子自动机 ${child.id} 失败`, error instanceof Error ? error : undefined);
      }
    }

    return cleaned;
  }

  /**
   * 清理处于已停止/失败状态时间过长的子自动机。
   */
  async cleanupStale(maxAgeHours: number): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeHours * 3600_000).toISOString();
    const stale = this.db.prepare(
      "SELECT id FROM children WHERE status IN ('failed', 'stopped') AND last_checked < ?",
    ).all(cutoff) as Array<{ id: string }>;

    let cleaned = 0;
    for (const child of stale) {
      try {
        await this.cleanup(child.id);
        cleaned++;
      } catch (error) {
        logger.error(`清理过期子自动机 ${child.id} 失败`, error instanceof Error ? error : undefined);
      }
    }

    return cleaned;
  }
}
