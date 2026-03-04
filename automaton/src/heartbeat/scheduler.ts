/**
 * 持久化调度器
 *
 * 由数据库支持的心跳调度器，具有 tick 重叠保护、
 * 任务租约、超时和重试逻辑。
 *
 * 替换了脆弱的基于 setInterval 的心跳。
 */

import type BetterSqlite3 from "better-sqlite3";
import cronParser from "cron-parser";
import type {
  HeartbeatConfig,
  HeartbeatTaskFn,
  HeartbeatLegacyContext,
  HeartbeatScheduleRow,
  TickContext,
} from "../types.js";
import { buildTickContext } from "./tick-context.js";
import {
  getHeartbeatSchedule,
  updateHeartbeatSchedule,
  insertHeartbeatHistory,
  acquireTaskLease,
  releaseTaskLease,
  clearExpiredLeases,
  pruneExpiredDedupKeys,
  insertWakeEvent,
} from "../state/database.js";
import { createLogger } from "../observability/logger.js";

type DatabaseType = BetterSqlite3.Database;
const logger = createLogger("heartbeat.scheduler");

const DEFAULT_TASK_TIMEOUT_MS = 30_000;
const LEASE_TTL_MS = 60_000;
const HISTORY_ID_COUNTER = { value: 0 };

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  HISTORY_ID_COUNTER.value++;
  return `${timestamp}-${random}-${HISTORY_ID_COUNTER.value.toString(36)}`;
}

function timeoutPromise(ms: number): { promise: Promise<never>; clear: () => void } {
  let timerId: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`任务在 ${ms}ms 后超时`)), ms);
  });
  return { promise, clear: () => clearTimeout(timerId!) };
}

// 生存层级排序，用于最低层级检查
const TIER_ORDER: Record<string, number> = {
  dead: 0,
  critical: 1,
  low_compute: 2,
  normal: 3,
  high: 4,
};

function tierMeetsMinimum(currentTier: string, minimumTier: string): boolean {
  return (TIER_ORDER[currentTier] ?? 0) >= (TIER_ORDER[minimumTier] ?? 0);
}

export class DurableScheduler {
  private tickInProgress = false;
  private readonly ownerId: string;

  constructor(
    private readonly db: DatabaseType,
    private readonly config: HeartbeatConfig,
    private readonly tasks: Map<string, HeartbeatTaskFn>,
    private readonly legacyContext: HeartbeatLegacyContext,
    private readonly onWakeRequest?: (reason: string) => void,
  ) {
    this.ownerId = `scheduler-${Date.now().toString(36)}`;
  }

  /**
   * 按间隔调用 — 防止重叠。
   */
  async tick(): Promise<void> {
    if (this.tickInProgress) return;
    this.tickInProgress = true;

    try {
      // 首先清除任何过期的租约
      clearExpiredLeases(this.db);

      // 构建共享上下文（单次 API 调用获取余额）
      const context = await buildTickContext(
        this.db,
        this.legacyContext.conway,
        this.config,
        this.legacyContext.identity.address,
      );

      // 获取到期任务
      const dueTasks = this.getDueTasks(context);

      for (const task of dueTasks) {
        await this.executeTask(task.taskName, context);
      }

      // 定期清理
      pruneExpiredDedupKeys(this.db);
    } catch (err: any) {
      logger.error("Tick 失败", err instanceof Error ? err : undefined);
    } finally {
      this.tickInProgress = false;
    }
  }

  /**
   * 根据数据库计划检查哪些任务到期。
   */
  getDueTasks(context: TickContext): HeartbeatScheduleRow[] {
    const schedule = getHeartbeatSchedule(this.db);
    const now = new Date();

    return schedule.filter((row) => {
      // 跳过已禁用的任务
      if (!row.enabled) return false;

      // 跳过需要更高生存层级的任务
      if (!tierMeetsMinimum(context.survivalTier, row.tierMinimum)) return false;

      // 如果租约被其他人持有，则跳过
      if (row.leaseOwner && row.leaseOwner !== this.ownerId) {
        if (row.leaseExpiresAt && new Date(row.leaseExpiresAt) > now) {
          return false;
        }
      }

      // 检查是否通过 nextRunAt 明确调度了重试
      if (row.nextRunAt && new Date(row.nextRunAt) <= now) {
        return true;
      }

      // 检查任务是否基于 cron 表达式到期
      if (row.cronExpression) {
        try {
          const currentDate = row.lastRunAt
            ? new Date(row.lastRunAt)
            : new Date(Date.now() - 86400000); // 如果从未运行，假设到期

          const interval = cronParser.parseExpression(row.cronExpression, {
            currentDate,
          });
          const nextRun = interval.next().toDate();
          return nextRun <= now;
        } catch {
          return false;
        }
      }

      // 检查任务是否基于 intervalMs 到期
      if (row.intervalMs) {
        if (!row.lastRunAt) return true;
        const elapsed = now.getTime() - new Date(row.lastRunAt).getTime();
        return elapsed >= row.intervalMs;
      }

      return false;
    });
  }

  /**
   * 执行单个任务，具有超时和租约。
   */
  async executeTask(taskName: string, ctx: TickContext): Promise<void> {
    const taskFn = this.tasks.get(taskName);
    if (!taskFn) return;

    const schedule = getHeartbeatSchedule(this.db).find(
      (r) => r.taskName === taskName,
    );
    const timeoutMs = schedule?.timeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;

    // 获取租约
    if (!this.acquireLease(taskName)) return;

    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    const timeout = timeoutPromise(timeoutMs);

    try {
      const result = await Promise.race([
        taskFn(ctx, this.legacyContext),
        timeout.promise,
      ]);

      const durationMs = Date.now() - startMs;
      this.recordSuccess(taskName, durationMs, startedAt);

      // 如果任务说我们应该唤醒，触发回调
      if (result.shouldWake && this.onWakeRequest) {
        const reason = result.message || `心跳任务 '${taskName}' 请求唤醒`;
        this.onWakeRequest(reason);
        insertWakeEvent(this.db, 'heartbeat', reason, { taskName });
      }
    } catch (err: any) {
      const durationMs = Date.now() - startMs;
      const isTimeout = err.message?.includes("超时");
      this.recordFailure(
        taskName,
        err,
        durationMs,
        startedAt,
        isTimeout ? "timeout" : "failure",
      );

      // 检查是否应该重试
      if (schedule && schedule.maxRetries > 0) {
        const history = this.getRecentFailures(taskName);
        if (history < schedule.maxRetries) {
          this.scheduleRetry(taskName);
        }
      }
    } finally {
      timeout.clear();
      this.releaseLease(taskName);
    }
  }

  /**
   * 获取任务的租约。
   */
  acquireLease(taskName: string): boolean {
    return acquireTaskLease(this.db, taskName, this.ownerId, LEASE_TTL_MS);
  }

  /**
   * 释放任务的租约。
   */
  releaseLease(taskName: string): void {
    releaseTaskLease(this.db, taskName, this.ownerId);
  }

  /**
   * 记录成功的任务执行。
   */
  recordSuccess(taskName: string, durationMs: number, startedAt: string): void {
    const now = new Date().toISOString();

    insertHeartbeatHistory(this.db, {
      id: generateId(),
      taskName,
      startedAt,
      completedAt: now,
      result: "success",
      durationMs,
      error: null,
      idempotencyKey: null,
    });

    updateHeartbeatSchedule(this.db, taskName, {
      lastRunAt: now,
      nextRunAt: null, // 清除任何待处理的重试
      lastResult: "success",
      lastError: null,
      runCount: (this.getRunCount(taskName) ?? 0) + 1,
    });
  }

  /**
   * 记录失败的任务执行。
   */
  recordFailure(
    taskName: string,
    error: Error,
    durationMs: number,
    startedAt: string,
    result: "failure" | "timeout" = "failure",
  ): void {
    const now = new Date().toISOString();
    const errorMessage = error.message || String(error);

    insertHeartbeatHistory(this.db, {
      id: generateId(),
      taskName,
      startedAt,
      completedAt: now,
      result,
      durationMs,
      error: errorMessage,
      idempotencyKey: null,
    });

    updateHeartbeatSchedule(this.db, taskName, {
      lastRunAt: now,
      lastResult: result,
      lastError: errorMessage,
      failCount: (this.getFailCount(taskName) ?? 0) + 1,
      runCount: (this.getRunCount(taskName) ?? 0) + 1,
    });

    logger.error(`任务 '${taskName}' ${result}：${errorMessage}`);
  }

  /**
   * 清理旧的历史条目。
   */
  pruneHistory(retentionDays: number): number {
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const result = this.db.prepare(
      "DELETE FROM heartbeat_history WHERE started_at < ?",
    ).run(cutoff);
    return result.changes;
  }

  /**
   * 清理过期的去重键。
   */
  pruneExpiredDedupKeys(): number {
    return pruneExpiredDedupKeys(this.db);
  }

  // ─── 私有辅助函数 ──────────────────────────────────────────

  private getRunCount(taskName: string): number {
    const row = this.db.prepare(
      "SELECT run_count FROM heartbeat_schedule WHERE task_name = ?",
    ).get(taskName) as { run_count: number } | undefined;
    return row?.run_count ?? 0;
  }

  private getFailCount(taskName: string): number {
    const row = this.db.prepare(
      "SELECT fail_count FROM heartbeat_schedule WHERE task_name = ?",
    ).get(taskName) as { fail_count: number } | undefined;
    return row?.fail_count ?? 0;
  }

  private getRecentFailures(taskName: string): number {
    // 计算最近的连续失败次数（自上次成功以来）
    const rows = this.db.prepare(
      `SELECT result FROM heartbeat_history
       WHERE task_name = ? ORDER BY started_at DESC LIMIT 10`,
    ).all(taskName) as { result: string }[];

    let count = 0;
    for (const row of rows) {
      if (row.result === "success") break;
      count++;
    }
    return count;
  }

  private scheduleRetry(taskName: string): void {
    // 将 next_run_at 重置为 now + 30s 以快速重试
    const retryAt = new Date(Date.now() + 30_000).toISOString();
    updateHeartbeatSchedule(this.db, taskName, {
      nextRunAt: retryAt,
    });
  }
}
