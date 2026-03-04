/**
 * 心跳守护进程
 *
 * 在同一 Node.js 进程内按 cron 计划运行定期任务。
 * 即使 Agent 处于睡眠状态，心跳也会继续运行。
 * 它就是 Automaton 的脉搏。当它停止时，Automaton 就死亡了。
 *
 * 阶段 1.1：用 DurableScheduler 替换了脆弱的 setInterval。
 * - 不再使用 setInterval；使用递归 setTimeout 防止重叠
 * - Tick 频率来自 config.defaultIntervalMs，而非日志级别
 * - lowComputeMultiplier 通过调度器应用于非必要任务
 */

import type {
  AutomatonConfig,
  AutomatonDatabase,
  ConwayClient,
  AutomatonIdentity,
  HeartbeatConfig,
  HeartbeatTaskFn,
  HeartbeatLegacyContext,
  SocialClientInterface,
} from "../types.js";
import { BUILTIN_TASKS } from "./tasks.js";
import { DurableScheduler } from "./scheduler.js";
import { upsertHeartbeatSchedule } from "../state/database.js";
import type BetterSqlite3 from "better-sqlite3";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("heartbeat");

type DatabaseType = BetterSqlite3.Database;

export interface HeartbeatDaemonOptions {
  identity: AutomatonIdentity;
  config: AutomatonConfig;
  heartbeatConfig: HeartbeatConfig;
  db: AutomatonDatabase;
  rawDb: DatabaseType;
  conway: ConwayClient;
  social?: SocialClientInterface;
  onWakeRequest?: (reason: string) => void;
}

export interface HeartbeatDaemon {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  forceRun(taskName: string): Promise<void>;
}

/**
 * 创建并返回心跳守护进程。
 *
 * 使用由数据库支持的 DurableScheduler 而非 setInterval。
 * Tick 间隔来自 heartbeatConfig.defaultIntervalMs。
 */
export function createHeartbeatDaemon(
  options: HeartbeatDaemonOptions,
): HeartbeatDaemon {
  const { identity, config, heartbeatConfig, db, rawDb, conway, social, onWakeRequest } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const legacyContext: HeartbeatLegacyContext = {
    identity,
    config,
    db,
    conway,
    social,
  };

  // 从 BUILTIN_TASKS 构建任务映射
  const taskMap = new Map<string, HeartbeatTaskFn>();
  for (const [name, fn] of Object.entries(BUILTIN_TASKS)) {
    taskMap.set(name, fn);
  }

  // 如果不存在，从配置条目初始化 heartbeat_schedule
  for (const entry of heartbeatConfig.entries) {
    upsertHeartbeatSchedule(rawDb, {
      taskName: entry.name,
      cronExpression: entry.schedule,
      intervalMs: null,
      enabled: entry.enabled ? 1 : 0,
      priority: 0,
      timeoutMs: 30_000,
      maxRetries: 1,
      tierMinimum: "dead",
      lastRunAt: entry.lastRun ?? null,
      nextRunAt: entry.nextRun ?? null,
      lastResult: null,
      lastError: null,
      runCount: 0,
      failCount: 0,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
  }

  const scheduler = new DurableScheduler(
    rawDb,
    heartbeatConfig,
    taskMap,
    legacyContext,
    onWakeRequest,
  );

  // Tick 间隔来自配置（而非日志级别）
  const tickMs = heartbeatConfig.defaultIntervalMs ?? 60_000;

  /**
   * 用于重叠保护的递归 setTimeout 循环。
   * 每个 tick 必须完成后才能调度下一个。
   */
  function scheduleTick(): void {
    if (!running) return;
    timeoutId = setTimeout(async () => {
      try {
        await scheduler.tick();
      } catch (err: any) {
        logger.error("Tick 失败", err instanceof Error ? err : undefined);
      }
      scheduleTick();
    }, tickMs);
  }

  // ─── 公共 API ──────────────────────────────────────────────

  const start = (): void => {
    if (running) return;
    running = true;

    // 立即运行第一个 tick
    scheduler.tick().catch((err) => {
      logger.error("首次 Tick 失败", err instanceof Error ? err : undefined);
    });

    // 调度后续的 tick
    scheduleTick();

    logger.info(`守护进程已启动。Tick 间隔：${tickMs / 1000}s（来自配置）`);
  };

  const stop = (): void => {
    if (!running) return;
    running = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    logger.info("守护进程已停止。");
  };

  const isRunning = (): boolean => running;

  const forceRun = async (taskName: string): Promise<void> => {
    const context = await import("./tick-context.js").then((m) =>
      m.buildTickContext(rawDb, conway, heartbeatConfig, identity.address),
    );
    await scheduler.executeTask(taskName, context);
  };

  return { start, stop, isRunning, forceRun };
}
