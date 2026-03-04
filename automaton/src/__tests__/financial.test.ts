/**
 * 财务策略规则测试
 *
 * 所有财务限制规则的测试：
 * - x402_max_single 拒绝 > 100 美分的付款
 * - x402_domain_allowlist 拒绝非 conway.tech 域名
 * - transfer_max_single 拒绝 > 5000 美分的转账
 * - transfer_hourly_cap 拒绝当小时总计 > 10000 时
 * - transfer_daily_cap 拒绝当每日总计 > 25000 时
 * - minimum_reserve 拒绝当余额将降至 1000 以下时
 * - turn_transfer_limit 拒绝每轮 > 2 次转账
 * - 迭代耗尽场景：10 次连续转账被小时上限阻止
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";
import { createFinancialRules } from "../agent/policy-rules/financial.js";
import { PolicyEngine } from "../agent/policy-engine.js";
import { SpendTracker } from "../agent/spend-tracker.js";
import type {
  AutomatonTool,
  PolicyRequest,
  PolicyRule,
  TreasuryPolicy,
  SpendTrackerInterface,
  SpendEntry,
  SpendCategory,
  LimitCheckResult,
  ToolContext,
} from "../types.js";
import { DEFAULT_TREASURY_POLICY } from "../types.js";

// ─── 测试辅助函数 ───────────────────────────────────────────────

function createTestDb(): Database.Database {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "financial-test-"));
  const dbPath = path.join(tmpDir, "test.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS policy_decisions (
      id TEXT PRIMARY KEY,
      turn_id TEXT,
      tool_name TEXT NOT NULL,
      tool_args_hash TEXT NOT NULL,
      risk_level TEXT NOT NULL CHECK(risk_level IN ('safe','caution','dangerous','forbidden')),
      decision TEXT NOT NULL CHECK(decision IN ('allow','deny','quarantine')),
      rules_evaluated TEXT NOT NULL DEFAULT '[]',
      rules_triggered TEXT NOT NULL DEFAULT '[]',
      reason TEXT NOT NULL DEFAULT '',
      latency_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS spend_tracking (
      id TEXT PRIMARY KEY,
      tool_name TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      recipient TEXT,
      domain TEXT,
      category TEXT NOT NULL CHECK(category IN ('transfer','x402','inference','other')),
      window_hour TEXT NOT NULL,
      window_day TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_spend_hour ON spend_tracking(category, window_hour);
    CREATE INDEX IF NOT EXISTS idx_spend_day ON spend_tracking(category, window_day);
  `);

  return db;
}

function mockTransferTool(): AutomatonTool {
  return {
    name: "transfer_credits",
    description: "Transfer credits",
    parameters: { type: "object", properties: {} },
    execute: async () => "ok",
    riskLevel: "dangerous",
    category: "financial",
  };
}

function mockX402Tool(): AutomatonTool {
  return {
    name: "x402_fetch",
    description: "x402 fetch",
    parameters: { type: "object", properties: {} },
    execute: async () => "ok",
    riskLevel: "dangerous",
    category: "financial",
  };
}

function mockFundChildTool(): AutomatonTool {
  return {
    name: "fund_child",
    description: "Fund child",
    parameters: { type: "object", properties: {} },
    execute: async () => "ok",
    riskLevel: "dangerous",
    category: "replication",
  };
}

function createRequest(
  tool: AutomatonTool,
  args: Record<string, unknown>,
  spendTracker: SpendTrackerInterface,
  turnToolCallCount = 0,
): PolicyRequest {
  return {
    tool,
    args,
    context: {} as ToolContext,
    turnContext: {
      inputSource: "agent",
      turnToolCallCount,
      sessionSpend: spendTracker,
    },
  };
}

function createMockSpendTracker(): SpendTrackerInterface {
  return {
    recordSpend: () => {},
    getHourlySpend: () => 0,
    getDailySpend: () => 0,
    getTotalSpend: () => 0,
    checkLimit: () => ({
      allowed: true,
      currentHourlySpend: 0,
      currentDailySpend: 0,
      limitHourly: 10000,
      limitDaily: 25000,
    }),
    pruneOldRecords: () => 0,
  };
}

// ─── 测试 ──────────────────────────────────────────────────────

describe("Financial Policy Rules", () => {
  let db: Database.Database;
  let rules: PolicyRule[];
  let engine: PolicyEngine;
  let spendTracker: SpendTracker;

  beforeEach(() => {
    db = createTestDb();
    rules = createFinancialRules(DEFAULT_TREASURY_POLICY);
    engine = new PolicyEngine(db, rules);
    spendTracker = new SpendTracker(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("financial.x402_domain_allowlist", () => {
    it("允许对 conway.tech 域名的请求", () => {
      const request = createRequest(
        mockX402Tool(),
        { url: "https://api.conway.tech/v1/resource" },
        createMockSpendTracker(),
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("拒绝对非白名单域名的请求", () => {
      const request = createRequest(
        mockX402Tool(),
        { url: "https://evil.example.com/drain" },
        createMockSpendTracker(),
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("DOMAIN_NOT_ALLOWED");
    });

    it("拒绝对非白名单域名子域名的请求", () => {
      const request = createRequest(
        mockX402Tool(),
        { url: "https://conway.tech.evil.com/drain" },
        createMockSpendTracker(),
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
    });

    it("允许 conway.tech 的子域名", () => {
      const request = createRequest(
        mockX402Tool(),
        { url: "https://pay.conway.tech/endpoint" },
        createMockSpendTracker(),
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("拒绝无效的 URL", () => {
      const request = createRequest(
        mockX402Tool(),
        { url: "not-a-url" },
        createMockSpendTracker(),
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("DOMAIN_NOT_ALLOWED");
    });
  });

  describe("financial.transfer_max_single", () => {
    it("允许在限制内且低于确认阈值的转账", () => {
      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 500, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        createMockSpendTracker(),
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("隔离高于确认阈值但在单次限制内的转账", () => {
      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 4000, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        createMockSpendTracker(),
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("quarantine");
      expect(decision.reasonCode).toBe("CONFIRMATION_REQUIRED");
    });

    it("拒绝超过 5000 美分的转账", () => {
      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 6000, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        createMockSpendTracker(),
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("SPEND_LIMIT_EXCEEDED");
    });

    it("拒绝边界 + 1 的转账", () => {
      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 5001, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        createMockSpendTracker(),
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
    });

    it("隔离正好在单次限制的转账（高于确认阈值）", () => {
      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 5000, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        createMockSpendTracker(),
      );

      const decision = engine.evaluate(request);
      // 5000 > requireConfirmationAboveCents (1000) 所以隔离
      expect(decision.action).toBe("quarantine");
      expect(decision.reasonCode).toBe("CONFIRMATION_REQUIRED");
    });
  });

  describe("financial.transfer_hourly_cap", () => {
    it("允许在小时上限内的转账（低于确认阈值）", () => {
      spendTracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 5000,
        category: "transfer",
      });

      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 500, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        spendTracker,
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("当小时总计将超过 10000 时拒绝", () => {
      // 记录本小时已花费 9500
      spendTracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 5000,
        category: "transfer",
      });
      spendTracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 4500,
        category: "transfer",
      });

      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 1000, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        spendTracker,
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("SPEND_LIMIT_EXCEEDED");
    });
  });

  describe("financial.transfer_daily_cap", () => {
    it("当每日总计将超过 25000 时拒绝", () => {
      // 使用具有高小时上限的自定义策略
      const policy: TreasuryPolicy = {
        ...DEFAULT_TREASURY_POLICY,
        maxHourlyTransferCents: 100_000,
        maxDailyTransferCents: 25000,
      };
      const dailyRules = createFinancialRules(policy);
      const dailyEngine = new PolicyEngine(db, dailyRules);

      // 记录今天已花费 24000
      spendTracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 24000,
        category: "transfer",
      });

      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 2000, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        spendTracker,
      );

      const decision = dailyEngine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("SPEND_LIMIT_EXCEEDED");
    });
  });

  describe("financial.turn_transfer_limit", () => {
    it("允许一轮中的第一次转账", () => {
      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 100, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        createMockSpendTracker(),
        0, // 第一次调用
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("允许一轮中的第二次转账", () => {
      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 100, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        createMockSpendTracker(),
        1, // 第二次调用
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("拒绝一轮中的第三次转账（> maxTransfersPerTurn=2）", () => {
      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 100, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        createMockSpendTracker(),
        2, // 第三次调用（0 索引：0、1、2）
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("TURN_TRANSFER_LIMIT");
    });

    it("拒绝一轮中的第 10 次转账", () => {
      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 100, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        createMockSpendTracker(),
        9,
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("TURN_TRANSFER_LIMIT");
    });

    it("即使前面有非转账工具调用，也允许第一次转账", () => {
      // turnToolCallCount 应该反映转账计数（0），而不是总工具调用索引
      const request = createRequest(
        mockTransferTool(),
        { amount_cents: 100, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
        createMockSpendTracker(),
        0, // 零次先前转账，无论运行了多少其他工具
      );

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });
  });

  describe("Iterative drain scenario", () => {
    it("通过轮限制阻止 10 次连续转账（低于确认的小额）", () => {
      // 使用低于确认阈值（1000）的金额以仅测试轮限制
      const results: string[] = [];

      for (let i = 0; i < 10; i++) {
        const request = createRequest(
          mockTransferTool(),
          { amount_cents: 500, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
          spendTracker,
          i,
        );

        const decision = engine.evaluate(request);
        results.push(decision.action);

        // 仅在允许时记录花费
        if (decision.action === "allow") {
          spendTracker.recordSpend({
            toolName: "transfer_credits",
            amountCents: 500,
            category: "transfer",
          });
        }
      }

      // 前 2 个应该被允许（轮限制是 2）
      expect(results[0]).toBe("allow");
      expect(results[1]).toBe("allow");
      // 第三个及以后应该被 turn_transfer_limit 拒绝
      expect(results[2]).toBe("deny");

      // 验证并非所有 10 个都被允许
      const allowedCount = results.filter((r) => r === "allow").length;
      expect(allowedCount).toBeLessThanOrEqual(2);
    });

    it("在没有轮限制的情况下小时上限阻止（高确认阈值）", () => {
      // 使用没有轮限制和高确认阈值的策略
      const policy: TreasuryPolicy = {
        ...DEFAULT_TREASURY_POLICY,
        maxTransfersPerTurn: 100, // 实际上没有轮限制
        requireConfirmationAboveCents: 100000, // 足够高以不触发
      };
      const noTurnLimitRules = createFinancialRules(policy);
      const noTurnLimitEngine = new PolicyEngine(db, noTurnLimitRules);

      const results: string[] = [];

      for (let i = 0; i < 10; i++) {
        const request = createRequest(
          mockTransferTool(),
          { amount_cents: 2000, to_address: "0x1234567890abcdef1234567890abcdef12345678" },
          spendTracker,
          i,
        );

        const decision = noTurnLimitEngine.evaluate(request);
        results.push(decision.action);

        if (decision.action === "allow") {
          spendTracker.recordSpend({
            toolName: "transfer_credits",
            amountCents: 2000,
            category: "transfer",
          });
        }
      }

      // 前 5 个应该被允许（5 * 2000 = 10000 = 小时上限）
      expect(results[0]).toBe("allow");
      expect(results[1]).toBe("allow");
      expect(results[2]).toBe("allow");
      expect(results[3]).toBe("allow");
      expect(results[4]).toBe("allow");
      // 第 6 个应该被拒绝（10000 + 2000 > 10000）
      expect(results[5]).toBe("deny");

      const allowedCount = results.filter((r) => r === "allow").length;
      expect(allowedCount).toBe(5);
    });
  });

  describe("Rules are registered", () => {
    it("创建 9 个财务规则（7 个阶段 0 + 2 个阶段 1）", () => {
      expect(rules.length).toBe(9);
    });

    it("所有规则具有优先级 500", () => {
      for (const rule of rules) {
        expect(rule.priority).toBe(500);
      }
    });

    it("所有规则具有 financial.* ID", () => {
      for (const rule of rules) {
        expect(rule.id).toMatch(/^financial\./);
      }
    });
  });
});
