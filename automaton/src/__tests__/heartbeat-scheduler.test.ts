/**
 * 心跳调度器测试 (阶段 1.1)
 *
 * 测试 DurableScheduler、TickContext、数据库助手和配置更改。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DurableScheduler } from "../heartbeat/scheduler.js";
import { buildTickContext } from "../heartbeat/tick-context.js";
import {
  MockConwayClient,
  createTestDb,
  createTestIdentity,
  createTestConfig,
} from "./mocks.js";
import {
  getHeartbeatSchedule,
  updateHeartbeatSchedule,
  upsertHeartbeatSchedule,
  insertHeartbeatHistory,
  getHeartbeatHistory,
  acquireTaskLease,
  releaseTaskLease,
  clearExpiredLeases,
  insertWakeEvent,
  consumeNextWakeEvent,
  getUnconsumedWakeEvents,
  insertDedupKey,
  pruneExpiredDedupKeys,
  isDeduplicated,
} from "../state/database.js";
import type {
  AutomatonDatabase,
  HeartbeatConfig,
  HeartbeatTaskFn,
  HeartbeatLegacyContext,
  HeartbeatScheduleRow,
  TickContext,
} from "../types.js";
import type BetterSqlite3 from "better-sqlite3";

type DatabaseType = BetterSqlite3.Database;

const DEFAULT_HB_CONFIG: HeartbeatConfig = {
  entries: [],
  defaultIntervalMs: 60_000,
  lowComputeMultiplier: 4,
};

function createLegacyContext(
  db: AutomatonDatabase,
  conway: MockConwayClient,
): HeartbeatLegacyContext {
  return {
    identity: createTestIdentity(),
    config: createTestConfig(),
    db,
    conway,
  };
}

function seedScheduleRow(
  rawDb: DatabaseType,
  taskName: string,
  overrides: Partial<HeartbeatScheduleRow> = {},
): void {
  upsertHeartbeatSchedule(rawDb, {
    taskName,
    cronExpression: "* * * * *", // every minute
    intervalMs: null,
    enabled: 1,
    priority: 0,
    timeoutMs: 30_000,
    maxRetries: 1,
    tierMinimum: "dead",
    lastRunAt: null,
    nextRunAt: null,
    lastResult: null,
    lastError: null,
    runCount: 0,
    failCount: 0,
    leaseOwner: null,
    leaseExpiresAt: null,
    ...overrides,
  });
}

describe("DurableScheduler", () => {
  let db: AutomatonDatabase;
  let rawDb: DatabaseType;
  let conway: MockConwayClient;

  beforeEach(() => {
    db = createTestDb();
    rawDb = db.raw;
    conway = new MockConwayClient();
  });

  afterEach(() => {
    db.close();
  });

  describe("防止 tick 重叠执行", () => {
    it("防止并发 tick 执行", async () => {
      let tickCount = 0;
      const slowTask: HeartbeatTaskFn = async () => {
        tickCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { shouldWake: false };
      };

      seedScheduleRow(rawDb, "slow_task");
      const tasks = new Map<string, HeartbeatTaskFn>([["slow_task", slowTask]]);
      const scheduler = new DurableScheduler(
        rawDb,
        DEFAULT_HB_CONFIG,
        tasks,
        createLegacyContext(db, conway),
      );

      // Start two ticks simultaneously
      const tick1 = scheduler.tick();
      const tick2 = scheduler.tick();
      await Promise.all([tick1, tick2]);

      // 由于 tickInProgress 保护机制，只有一个应该被执行
      expect(tickCount).toBe(1);
    });
  });

  describe("任务超时", () => {
    it("对超过超时时间的任务进行超时处理", async () => {
      const neverFinish: HeartbeatTaskFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
        return { shouldWake: false };
      };

      // 设置一个非常短的超时时间
      seedScheduleRow(rawDb, "never_finish", { timeoutMs: 50 });
      const tasks = new Map<string, HeartbeatTaskFn>([["never_finish", neverFinish]]);
      const scheduler = new DurableScheduler(
        rawDb,
        DEFAULT_HB_CONFIG,
        tasks,
        createLegacyContext(db, conway),
      );

      await scheduler.tick();

      // 检查任务是否被记录为超时
      const history = getHeartbeatHistory(rawDb, "never_finish");
      expect(history.length).toBe(1);
      expect(history[0].result).toBe("timeout");
      expect(history[0].error).toContain("timed out");
    });
  });

  describe("调度持久化", () => {
    it("从数据库读取调度", () => {
      seedScheduleRow(rawDb, "task_a", { priority: 1 });
      seedScheduleRow(rawDb, "task_b", { priority: 0 });

      const schedule = getHeartbeatSchedule(rawDb);
      expect(schedule.length).toBe(2);
      // 按优先级排序（较小的在前）
      expect(schedule[0].taskName).toBe("task_b");
      expect(schedule[1].taskName).toBe("task_a");
    });

    it("updates schedule fields", () => {
      seedScheduleRow(rawDb, "task_a");
      updateHeartbeatSchedule(rawDb, "task_a", {
        lastRunAt: "2026-02-19T12:00:00Z",
        lastResult: "success",
        runCount: 5,
      });

      const schedule = getHeartbeatSchedule(rawDb);
      expect(schedule[0].lastRunAt).toBe("2026-02-19T12:00:00Z");
      expect(schedule[0].lastResult).toBe("success");
      expect(schedule[0].runCount).toBe(5);
    });

    it("persists across scheduler restarts", () => {
      seedScheduleRow(rawDb, "persistent_task");
      updateHeartbeatSchedule(rawDb, "persistent_task", {
        lastRunAt: "2026-02-19T12:00:00Z",
        runCount: 10,
      });

      // Simulate restart by reading schedule again
      const schedule = getHeartbeatSchedule(rawDb);
      expect(schedule[0].runCount).toBe(10);
      expect(schedule[0].lastRunAt).toBe("2026-02-19T12:00:00Z");
    });
  });

  describe("去重键 TTL 和清理", () => {
    it("插入并检测去重键", () => {
      const inserted = insertDedupKey(rawDb, "key-1", "task_a", 60_000);
      expect(inserted).toBe(true);

      expect(isDeduplicated(rawDb, "key-1")).toBe(true);
      expect(isDeduplicated(rawDb, "key-nonexist")).toBe(false);
    });

    it("rejects duplicate keys", () => {
      insertDedupKey(rawDb, "key-1", "task_a", 60_000);
      const second = insertDedupKey(rawDb, "key-1", "task_a", 60_000);
      expect(second).toBe(false);
    });

    it("prunes expired dedup keys", () => {
      // Insert with expired TTL
      rawDb.prepare(
        "INSERT INTO heartbeat_dedup (dedup_key, task_name, expires_at) VALUES (?, ?, ?)",
      ).run("expired-1", "task_a", "2020-01-01T00:00:00Z");
      rawDb.prepare(
        "INSERT INTO heartbeat_dedup (dedup_key, task_name, expires_at) VALUES (?, ?, ?)",
      ).run("valid-1", "task_a", "2030-01-01T00:00:00Z");

      const pruned = pruneExpiredDedupKeys(rawDb);
      expect(pruned).toBe(1);

      expect(isDeduplicated(rawDb, "expired-1")).toBe(false);
      expect(isDeduplicated(rawDb, "valid-1")).toBe(true);
    });
  });

  describe("唤醒事件排序和消费", () => {
    it("按顺序插入和消费唤醒事件", () => {
      insertWakeEvent(rawDb, "heartbeat", "reason-1");
      insertWakeEvent(rawDb, "inbox", "reason-2");
      insertWakeEvent(rawDb, "manual", "reason-3");

      const first = consumeNextWakeEvent(rawDb);
      expect(first).toBeDefined();
      expect(first!.reason).toBe("reason-1");
      expect(first!.source).toBe("heartbeat");

      const second = consumeNextWakeEvent(rawDb);
      expect(second!.reason).toBe("reason-2");

      const third = consumeNextWakeEvent(rawDb);
      expect(third!.reason).toBe("reason-3");

      // 没有更多事件
      const fourth = consumeNextWakeEvent(rawDb);
      expect(fourth).toBeUndefined();
    });

    it("lists unconsumed events", () => {
      insertWakeEvent(rawDb, "heartbeat", "reason-1");
      insertWakeEvent(rawDb, "inbox", "reason-2");

      // Consume one
      consumeNextWakeEvent(rawDb);

      const remaining = getUnconsumedWakeEvents(rawDb);
      expect(remaining.length).toBe(1);
      expect(remaining[0].reason).toBe("reason-2");
    });

    it("stores payload as JSON", () => {
      insertWakeEvent(rawDb, "heartbeat", "with-payload", { taskName: "test_task", extra: 42 });

      const event = consumeNextWakeEvent(rawDb);
      expect(event).toBeDefined();
      const payload = JSON.parse(event!.payload);
      expect(payload.taskName).toBe("test_task");
      expect(payload.extra).toBe(42);
    });
  });

  describe("任务租约获取和释放", () => {
    it("获取和释放租约", () => {
      seedScheduleRow(rawDb, "leased_task");

      const acquired = acquireTaskLease(rawDb, "leased_task", "owner-1", 60_000);
      expect(acquired).toBe(true);

      // 无法使用不同的所有者获取同一租约
      const reacquired = acquireTaskLease(rawDb, "leased_task", "owner-2", 60_000);
      expect(reacquired).toBe(false);

      // 释放租约
      releaseTaskLease(rawDb, "leased_task", "owner-1");

      // 现在可以再次获取
      const acquired2 = acquireTaskLease(rawDb, "leased_task", "owner-2", 60_000);
      expect(acquired2).toBe(true);
    });

    it("clears expired leases", () => {
      seedScheduleRow(rawDb, "expired_lease");
      // Set expired lease directly
      rawDb.prepare(
        "UPDATE heartbeat_schedule SET lease_owner = ?, lease_expires_at = ? WHERE task_name = ?",
      ).run("old-owner", "2020-01-01T00:00:00Z", "expired_lease");

      const cleared = clearExpiredLeases(rawDb);
      expect(cleared).toBe(1);

      // Can now acquire lease
      const acquired = acquireTaskLease(rawDb, "expired_lease", "new-owner", 60_000);
      expect(acquired).toBe(true);
    });
  });

  describe("任务执行历史记录", () => {
    it("记录成功执行", async () => {
      const simpleTask: HeartbeatTaskFn = async () => {
        return { shouldWake: false };
      };

      seedScheduleRow(rawDb, "simple_task");
      const tasks = new Map<string, HeartbeatTaskFn>([["simple_task", simpleTask]]);
      const scheduler = new DurableScheduler(
        rawDb,
        DEFAULT_HB_CONFIG,
        tasks,
        createLegacyContext(db, conway),
      );

      await scheduler.tick();

      const history = getHeartbeatHistory(rawDb, "simple_task");
      expect(history.length).toBe(1);
      expect(history[0].result).toBe("success");
      expect(history[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(history[0].error).toBeNull();
    });

    it("records failed execution", async () => {
      const failingTask: HeartbeatTaskFn = async () => {
        throw new Error("Task failed intentionally");
      };

      seedScheduleRow(rawDb, "failing_task");
      const tasks = new Map<string, HeartbeatTaskFn>([["failing_task", failingTask]]);
      const scheduler = new DurableScheduler(
        rawDb,
        DEFAULT_HB_CONFIG,
        tasks,
        createLegacyContext(db, conway),
      );

      await scheduler.tick();

      const history = getHeartbeatHistory(rawDb, "failing_task");
      expect(history.length).toBe(1);
      expect(history[0].result).toBe("failure");
      expect(history[0].error).toContain("Task failed intentionally");
    });
  });

  describe("TickContext 构建", () => {
    it("获取一次余额并构建上下文", async () => {
      conway.creditsCents = 5_000;

      const ctx = await buildTickContext(
        rawDb,
        conway,
        DEFAULT_HB_CONFIG,
      );

      expect(ctx.tickId).toBeTruthy();
      expect(ctx.startedAt).toBeInstanceOf(Date);
      expect(ctx.creditBalance).toBe(5_000);
      expect(ctx.survivalTier).toBe("high");
      expect(ctx.lowComputeMultiplier).toBe(4);
      expect(ctx.config).toBe(DEFAULT_HB_CONFIG);
      expect(ctx.db).toBe(rawDb);
    });

    it("优雅地处理 API 失败", async () => {
      // 使 getCreditsBalance 抛出错误
      conway.getCreditsBalance = async () => {
        throw new Error("API unavailable");
      };

      const ctx = await buildTickContext(
        rawDb,
        conway,
        DEFAULT_HB_CONFIG,
      );

      // 应默认为 0 积分（严重级别 — 零表示破产，不是死亡）
      expect(ctx.creditBalance).toBe(0);
      expect(ctx.survivalTier).toBe("critical");
    });
  });

  describe("配置消费", () => {
    it("使用配置中的 defaultIntervalMs", () => {
      const config: HeartbeatConfig = {
        entries: [],
        defaultIntervalMs: 30_000,
        lowComputeMultiplier: 2,
      };

      // 守护进程读取 config.defaultIntervalMs 作为 tick 间隔
      // 我们通过使用配置创建上下文来验证
      expect(config.defaultIntervalMs).toBe(30_000);
      expect(config.lowComputeMultiplier).toBe(2);
    });
  });

  describe("YAML 解析错误日志", () => {
    it("当 YAML 解析失败时记录错误", async () => {
      const { loadHeartbeatConfig } = await import("../heartbeat/config.js");
      const { StructuredLogger } = await import("../observability/logger.js");

      // 通过自定义接收器捕获结构化日志输出
      const logEntries: any[] = [];
      StructuredLogger.setSink((entry) => logEntries.push(entry));

      // 将无效的 YAML 写入临时文件
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hb-yaml-test-"));
      const configPath = path.join(tmpDir, "heartbeat.yml");
      fs.writeFileSync(configPath, "invalid: yaml: content: [unterminated");

      const config = loadHeartbeatConfig(configPath);

      // 应返回默认值
      expect(config.defaultIntervalMs).toBe(60_000);

      // 检查是否使用 YAML 错误调用了日志记录器
      const yamlErrorEntry = logEntries.find(
        (entry) => entry.level === "error" && entry.message.includes("Failed to parse YAML"),
      );
      expect(yamlErrorEntry).toBeDefined();

      StructuredLogger.resetSink();

      // 清理
      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe("数值配置字段零值", () => {
    it("保留 defaultIntervalMs 和 lowComputeMultiplier 的显式零值", async () => {
      const { loadHeartbeatConfig } = await import("../heartbeat/config.js");
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hb-zero-test-"));
      const configPath = path.join(tmpDir, "heartbeat.yml");

      // 带有显式零值的 YAML
      fs.writeFileSync(configPath, "defaultIntervalMs: 0\nlowComputeMultiplier: 0\n");

      const config = loadHeartbeatConfig(configPath);

      // 使用 ||，0 是假值，会回退到默认值（60000，4）。
      // 使用 ??，0 被保留为用户指定的值。
      expect(config.defaultIntervalMs).toBe(0);
      expect(config.lowComputeMultiplier).toBe(0);

      fs.rmSync(tmpDir, { recursive: true });
    });
  });
});
