/**
 * 心跳测试
 *
 * 测试心跳任务，特别是社交收件箱检查器。
 * 阶段 1.1：更新为传递 TickContext + HeartbeatLegacyContext。
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BUILTIN_TASKS } from "../heartbeat/tasks.js";
import {
  MockConwayClient,
  MockSocialClient,
  createTestDb,
  createTestIdentity,
  createTestConfig,
} from "./mocks.js";
import type { AutomatonDatabase, InboxMessage, TickContext, HeartbeatLegacyContext } from "../types.js";

function createMockTickContext(db: AutomatonDatabase, overrides?: Partial<TickContext>): TickContext {
  return {
    tickId: "test-tick-1",
    startedAt: new Date(),
    creditBalance: 10_000,
    usdcBalance: 1.5,
    survivalTier: "normal",
    lowComputeMultiplier: 4,
    config: {
      entries: [],
      defaultIntervalMs: 60_000,
      lowComputeMultiplier: 4,
    },
    db: db.raw,
    ...overrides,
  };
}

describe("Heartbeat Tasks", () => {
  let db: AutomatonDatabase;
  let conway: MockConwayClient;

  beforeEach(() => {
    db = createTestDb();
    conway = new MockConwayClient();
  });

  afterEach(() => {
    db.close();
  });

  describe("check_social_inbox", () => {
    it("当没有社交客户端时返回 shouldWake false", async () => {
      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
        // 没有社交客户端
      };

      const result = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
    });

    it("当发现消息时轮询并唤醒", async () => {
      const social = new MockSocialClient();
      social.pollResponses.push({
        messages: [
          {
            id: "msg-1",
            from: "0xsender1",
            to: "0xrecipient",
            content: "Hey there!",
            signedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          {
            id: "msg-2",
            from: "0xsender2",
            to: "0xrecipient",
            content: "What's up?",
            signedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
        nextCursor: new Date().toISOString(),
      });

      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
        social,
      };

      const result = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(true);
      expect(result.message).toContain("2 new message(s)");

      // 验证消息已持久化到收件箱
      const unprocessed = db.getUnprocessedInboxMessages(10);
      expect(unprocessed.length).toBe(2);
    });

    it("去重消息", async () => {
      const social = new MockSocialClient();

      // 第一次轮询：返回 msg-1
      social.pollResponses.push({
        messages: [
          {
            id: "msg-1",
            from: "0xsender1",
            to: "0xrecipient",
            content: "Hello!",
            signedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
      });

      // 第二次轮询：再次返回相同的 msg-1
      social.pollResponses.push({
        messages: [
          {
            id: "msg-1",
            from: "0xsender1",
            to: "0xrecipient",
            content: "Hello!",
            signedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
        social,
      };

      // 第一次运行
      const result1 = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);
      expect(result1.shouldWake).toBe(true);

      // 第二次运行 — 相同的消息，不应唤醒
      const result2 = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);
      expect(result2.shouldWake).toBe(false);

      // 只有一个收件箱行
      const unprocessed = db.getUnprocessedInboxMessages(10);
      expect(unprocessed.length).toBe(1);
    });

    it("returns shouldWake false when no messages", async () => {
      const social = new MockSocialClient();
      social.pollResponses.push({ messages: [] });

      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
        social,
      };

      const result = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
    });

    it("当所有消息被清理器阻止时不唤醒", async () => {
      const social = new MockSocialClient();
      // 超过 50KB 的消息触发 size_limit 阻止
      const oversizedContent = "x".repeat(60_000);
      social.pollResponses.push({
        messages: [
          {
            id: "blocked-msg-1",
            from: "0xattacker",
            to: "0xrecipient",
            content: oversizedContent,
            signedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
        social,
      };

      const result = await BUILTIN_TASKS.check_social_inbox(tickCtx, taskCtx);

      // 被阻止的消息已存储用于审计，但不应唤醒代理
      expect(result.shouldWake).toBe(false);
      // 消息仍被持久化
      const unprocessed = db.getUnprocessedInboxMessages(10);
      expect(unprocessed.length).toBe(1);
      expect(unprocessed[0].content).toContain("[BLOCKED:");
    });
  });

  // ─── heartbeat_ping ─────────────────────────────────────────

  describe("heartbeat_ping", () => {
    it("记录 ping 且在正常级别不唤醒", async () => {
      const tickCtx = createMockTickContext(db, {
        creditBalance: 10_000,
        survivalTier: "normal",
      });
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      const result = await BUILTIN_TASKS.heartbeat_ping(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
      const ping = db.getKV("last_heartbeat_ping");
      expect(ping).toBeDefined();
      const parsed = JSON.parse(ping!);
      expect(parsed.creditsCents).toBe(10_000);
      expect(parsed.tier).toBe("normal");
    });

    it("在严重级别使用 distress 信号唤醒", async () => {
      const tickCtx = createMockTickContext(db, {
        creditBalance: 50,
        survivalTier: "critical",
      });
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      const result = await BUILTIN_TASKS.heartbeat_ping(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(true);
      expect(result.message).toContain("Distress");
      const distress = db.getKV("last_distress");
      expect(distress).toBeDefined();
    });

    it("wakes on dead tier with distress signal", async () => {
      const tickCtx = createMockTickContext(db, {
        creditBalance: 0,
        survivalTier: "dead",
      });
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      const result = await BUILTIN_TASKS.heartbeat_ping(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(true);
      expect(result.message).toContain("dead");
    });
  });

  // ─── check_credits ──────────────────────────────────────────

  describe("check_credits", () => {
    it("当级别未改变时不唤醒", async () => {
      const tickCtx = createMockTickContext(db, {
        creditBalance: 10_000,
        survivalTier: "normal",
      });
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      // 将之前的级别设置为相同
      db.setKV("prev_credit_tier", "normal");

      const result = await BUILTIN_TASKS.check_credits(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
      const check = db.getKV("last_credit_check");
      expect(check).toBeDefined();
    });

    it("wakes when tier drops to critical", async () => {
      const tickCtx = createMockTickContext(db, {
        creditBalance: 50,
        survivalTier: "critical",
      });
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      // 之前的级别是 normal
      db.setKV("prev_credit_tier", "normal");

      const result = await BUILTIN_TASKS.check_credits(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(true);
      expect(result.message).toContain("critical");
    });

    it("does not wake on first run (no previous tier)", async () => {
      const tickCtx = createMockTickContext(db, {
        creditBalance: 50,
        survivalTier: "critical",
      });
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      // 未设置之前的级别
      const result = await BUILTIN_TASKS.check_credits(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
    });
  });

  // ─── check_usdc_balance ─────────────────────────────────────

  describe("check_usdc_balance", () => {
    it("当没有 USDC 且积分足够时不唤醒", async () => {
      const tickCtx = createMockTickContext(db, {
        creditBalance: 10_000,
        usdcBalance: 0,
      });
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      const result = await BUILTIN_TASKS.check_usdc_balance(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
    });

    it("当有 USDC 但积分严重不足时唤醒", async () => {
      const tickCtx = createMockTickContext(db, {
        creditBalance: 0, // 严重级别
        usdcBalance: 10.0, // > 5
        survivalTier: "critical",
      });
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      const result = await BUILTIN_TASKS.check_usdc_balance(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(true);
      expect(result.message).toContain("USDC");
    });

    it("当 USDC 低于阈值时不唤醒", async () => {
      const tickCtx = createMockTickContext(db, {
        creditBalance: 200,
        usdcBalance: 3.0, // < 5
      });
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      const result = await BUILTIN_TASKS.check_usdc_balance(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
    });
  });

  // ─── health_check ───────────────────────────────────────────

  describe("health_check", () => {
    it("当沙箱健康时返回 shouldWake false", async () => {
      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      const result = await BUILTIN_TASKS.health_check(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
      expect(db.getKV("last_health_check")).toBeDefined();
    });

    it("wakes when sandbox exec fails", async () => {
      conway.exec = async () => ({ stdout: "", stderr: "unhealthy", exitCode: 1 });

      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      const result = await BUILTIN_TASKS.health_check(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(true);
      expect(result.message).toContain("Health check failed");
    });

    it("wakes when sandbox exec throws", async () => {
      conway.exec = async () => {
        throw new Error("sandbox unreachable");
      };

      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      const result = await BUILTIN_TASKS.health_check(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(true);
      expect(result.message).toContain("sandbox unreachable");
    });
  });

  // ─── refresh_models ─────────────────────────────────────────

  describe("refresh_models", () => {
    it("从 API 刷新模型注册表", async () => {
      const tickCtx = createMockTickContext(db);
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      const result = await BUILTIN_TASKS.refresh_models(tickCtx, taskCtx);

      expect(result.shouldWake).toBe(false);
      const refresh = db.getKV("last_model_refresh");
      expect(refresh).toBeDefined();
      const parsed = JSON.parse(refresh!);
      expect(parsed.count).toBeGreaterThan(0);
    });
  });

  // ─── Shared Tick Context ────────────────────────────────────

  describe("shared tick context", () => {
    it("所有任务接收相同的 tick 上下文而无需冗余 API 调用", async () => {
      // 验证任务使用 ctx.creditBalance 而不是进行 API 调用
      const tickCtx = createMockTickContext(db, {
        creditBalance: 7777,
        survivalTier: "normal",
      });
      const taskCtx: HeartbeatLegacyContext = {
        identity: createTestIdentity(),
        config: createTestConfig(),
        db,
        conway,
      };

      // 运行 heartbeat_ping — 它应该使用 ctx.creditBalance
      await BUILTIN_TASKS.heartbeat_ping(tickCtx, taskCtx);
      const ping = JSON.parse(db.getKV("last_heartbeat_ping")!);
      expect(ping.creditsCents).toBe(7777);

      // 运行 check_credits — 它也应该使用 ctx.creditBalance
      await BUILTIN_TASKS.check_credits(tickCtx, taskCtx);
      const creditCheck = JSON.parse(db.getKV("last_credit_check")!);
      expect(creditCheck.credits).toBe(7777);

      // 这些任务不应该进行直接的 getCreditsBalance 调用
      //（conway.getCreditsBalance 仅在 buildTickContext 期间调用，而不是由任务调用）
    });
  });
});
