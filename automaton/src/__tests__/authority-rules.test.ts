/**
 * 权限 + 速率限制 + 财务阶段 1 规则测试
 *
 * 阶段 1.4 子阶段测试：财务策略与资金库配置
 * - 权限规则：阻止来自危险工具的外部输入
 * - 权限规则：阻止来自外部对受保护路径的自我修改
 * - 速率限制规则：创世提示词、自我修改、生成
 * - 财务阶段 1 规则：推理每日上限、需要确认
 * - 资金库配置加载和验证
 * - promptWithDefault 行为
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";
import type {
  AutomatonTool,
  PolicyRule,
  PolicyRequest,
  PolicyRuleResult,
  ToolContext,
  InputSource,
  SpendTrackerInterface,
  SpendCategory,
  SpendEntry,
  TreasuryPolicy,
  LimitCheckResult,
} from "../types.js";
import { DEFAULT_TREASURY_POLICY } from "../types.js";
import { PolicyEngine } from "../agent/policy-engine.js";
import { createAuthorityRules } from "../agent/policy-rules/authority.js";
import { createRateLimitRules } from "../agent/policy-rules/rate-limits.js";
import { createFinancialRules } from "../agent/policy-rules/financial.js";
import { createDefaultRules } from "../agent/policy-rules/index.js";

// ─── 测试辅助函数 ───────────────────────────────────────────────

function createRawTestDb(): Database.Database {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "authority-test-"));
  const dbPath = path.join(tmpDir, "test.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

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
  `);

  return db;
}

function createMockSpendTracker(overrides: Partial<SpendTrackerInterface> = {}): SpendTrackerInterface {
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
    ...overrides,
  };
}

function createMockTool(overrides: Partial<AutomatonTool> = {}): AutomatonTool {
  return {
    name: "test_tool",
    description: "A test tool",
    parameters: { type: "object", properties: {} },
    execute: async () => "ok",
    riskLevel: "safe",
    category: "vm",
    ...overrides,
  };
}

function createMockContext(rawDb?: Database.Database): ToolContext {
  return {
    identity: {} as any,
    config: {} as any,
    db: rawDb ? { raw: rawDb } as any : {} as any,
    conway: {} as any,
    inference: {} as any,
  };
}

function createRequest(
  tool: AutomatonTool,
  args: Record<string, unknown>,
  inputSource: InputSource | undefined,
  rawDb?: Database.Database,
  spendTracker?: SpendTrackerInterface,
): PolicyRequest {
  return {
    tool,
    args,
    context: createMockContext(rawDb),
    turnContext: {
      inputSource,
      turnToolCallCount: 0,
      sessionSpend: spendTracker ?? createMockSpendTracker(),
    },
  };
}

// ─── 权限规则测试 ──────────────────────────────────────────────

describe("Authority Rules", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createRawTestDb();
  });

  afterEach(() => {
    db.close();
  });

  describe("authority.external_tool_restriction", () => {
    it("阻止来自外部（未定义）输入的破坏性工具", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "delete_sandbox",
        riskLevel: "dangerous",
        category: "conway",
      });
      const request = createRequest(tool, {}, undefined);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("EXTERNAL_DANGEROUS_TOOL");
    });

    it("阻止来自心跳输入的 spawn_child", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "spawn_child",
        riskLevel: "dangerous",
        category: "replication",
      });
      const request = createRequest(tool, {}, "heartbeat");

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("EXTERNAL_DANGEROUS_TOOL");
    });

    it("阻止来自外部输入的 fund_child", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "fund_child",
        riskLevel: "dangerous",
        category: "replication",
      });
      const request = createRequest(tool, {}, undefined);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("EXTERNAL_DANGEROUS_TOOL");
    });

    it("阻止来自外部输入的 update_genesis_prompt", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "update_genesis_prompt",
        riskLevel: "dangerous",
        category: "self_mod",
      });
      const request = createRequest(tool, {}, undefined);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("EXTERNAL_DANGEROUS_TOOL");
    });

    it("允许来自外部输入的 register_erc8004", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "register_erc8004",
        riskLevel: "dangerous",
        category: "registry",
      });
      const request = createRequest(tool, {}, undefined);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("允许来自心跳输入的 register_erc8004", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "register_erc8004",
        riskLevel: "dangerous",
        category: "registry",
      });
      const request = createRequest(tool, {}, "heartbeat");

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("允许来自外部输入的 give_feedback", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "give_feedback",
        riskLevel: "dangerous",
        category: "registry",
      });
      const request = createRequest(tool, {}, undefined);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("允许来自代理输入的破坏性工具", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "delete_sandbox",
        riskLevel: "dangerous",
        category: "conway",
      });
      const request = createRequest(tool, {}, "agent");

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("允许来自创建者输入的破坏性工具", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "spawn_child",
        riskLevel: "dangerous",
        category: "replication",
      });
      const request = createRequest(tool, {}, "creator");

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("允许来自外部输入的安全工具", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "read_file",
        riskLevel: "safe",
        category: "vm",
      });
      const request = createRequest(tool, {}, undefined);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });
  });

  describe("authority.self_mod_from_external", () => {
    it("阻止来自外部输入对受保护路径的 edit_own_file", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "edit_own_file",
        riskLevel: "dangerous",
        category: "self_mod",
      });
      const request = createRequest(tool, { path: "~/.automaton/SOUL.md" }, undefined);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("EXTERNAL_SELF_MOD");
    });

    it("阻止来自外部输入针对 policy-rules 的 write_file", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "write_file",
        riskLevel: "caution",
        category: "vm",
      });
      const request = createRequest(tool, { path: "/app/src/agent/policy-rules/financial.ts" }, undefined);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("EXTERNAL_SELF_MOD");
    });

    it("允许来自外部输入对非受保护路径的 write_file", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "write_file",
        riskLevel: "caution",
        category: "vm",
      });
      const request = createRequest(tool, { path: "/app/src/data/output.txt" }, undefined);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("允许来自代理输入对受保护路径的 edit_own_file", () => {
      const rules = createAuthorityRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "edit_own_file",
        riskLevel: "dangerous",
        category: "self_mod",
      });
      const request = createRequest(tool, { path: "~/.automaton/SOUL.md" }, "agent");

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });
  });
});

// ─── 速率限制规则测试 ─────────────────────────────────────

describe("Rate Limit Rules", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createRawTestDb();
  });

  afterEach(() => {
    db.close();
  });

  describe("rate.genesis_prompt_daily", () => {
    it("允许首次创世提示词更改", () => {
      const rules = createRateLimitRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "update_genesis_prompt",
        riskLevel: "dangerous",
        category: "self_mod",
      });
      const request = createRequest(tool, {}, "agent", db);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("每天超过 1 次后阻止创世提示词更改", () => {
      // 为 update_genesis_prompt 插入一个最近允许的决策
      db.prepare(
        `INSERT INTO policy_decisions (id, tool_name, tool_args_hash, risk_level, decision, reason, created_at)
         VALUES ('dec1', 'update_genesis_prompt', 'hash1', 'dangerous', 'allow', 'ALLOWED', datetime('now'))`,
      ).run();

      const rules = createRateLimitRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "update_genesis_prompt",
        riskLevel: "dangerous",
        category: "self_mod",
      });
      const request = createRequest(tool, {}, "agent", db);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("RATE_LIMIT_GENESIS");
    });
  });

  describe("rate.self_mod_hourly", () => {
    it("允许速率限制内的自我修改", () => {
      const rules = createRateLimitRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "edit_own_file",
        riskLevel: "dangerous",
        category: "self_mod",
      });
      const request = createRequest(tool, {}, "agent", db);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("每小时超过 10 次后阻止自我修改", () => {
      // 为 edit_own_file 插入 10 个最近允许的决策
      for (let i = 0; i < 10; i++) {
        db.prepare(
          `INSERT INTO policy_decisions (id, tool_name, tool_args_hash, risk_level, decision, reason, created_at)
           VALUES ('dec_edit_${i}', 'edit_own_file', 'hash${i}', 'dangerous', 'allow', 'ALLOWED', datetime('now'))`,
        ).run();
      }

      const rules = createRateLimitRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "edit_own_file",
        riskLevel: "dangerous",
        category: "self_mod",
      });
      const request = createRequest(tool, {}, "agent", db);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("RATE_LIMIT_SELF_MOD");
    });
  });

  describe("rate.spawn_daily", () => {
    it("允许速率限制内的生成", () => {
      const rules = createRateLimitRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "spawn_child",
        riskLevel: "dangerous",
        category: "replication",
      });
      const request = createRequest(tool, {}, "agent", db);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("每天超过 3 次后阻止生成", () => {
      for (let i = 0; i < 3; i++) {
        db.prepare(
          `INSERT INTO policy_decisions (id, tool_name, tool_args_hash, risk_level, decision, reason, created_at)
           VALUES ('dec_spawn_${i}', 'spawn_child', 'hash${i}', 'dangerous', 'allow', 'ALLOWED', datetime('now'))`,
        ).run();
      }

      const rules = createRateLimitRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "spawn_child",
        riskLevel: "dangerous",
        category: "replication",
      });
      const request = createRequest(tool, {}, "agent", db);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("RATE_LIMIT_SPAWN");
    });
  });

  describe("速率限制数据库不可用", () => {
    it("当数据库不可访问时拒绝（失败关闭）", () => {
      const rules = createRateLimitRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "update_genesis_prompt",
        riskLevel: "dangerous",
        category: "self_mod",
      });
      // 不传递数据库以模拟数据库不可用
      const request = createRequest(tool, {}, "agent");

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("DB_UNAVAILABLE");
    });

    it("当数据库不可访问时拒绝 edit_own_file", () => {
      const rules = createRateLimitRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "edit_own_file",
        riskLevel: "dangerous",
        category: "self_mod",
      });
      const request = createRequest(tool, {}, "agent");

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("DB_UNAVAILABLE");
    });

    it("当数据库不可访问时拒绝 spawn_child", () => {
      const rules = createRateLimitRules();
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "spawn_child",
        riskLevel: "dangerous",
        category: "replication",
      });
      const request = createRequest(tool, {}, "agent");

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("DB_UNAVAILABLE");
    });
  });
});

// ─── 财务阶段 1 规则测试 ──────────────────────────────

describe("Financial Phase 1 Rules", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createRawTestDb();
  });

  afterEach(() => {
    db.close();
  });

  describe("financial.inference_daily_cap", () => {
    it("当低于每日上限时允许推理", () => {
      const rules = createFinancialRules(DEFAULT_TREASURY_POLICY);
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "chat",
        riskLevel: "safe",
        category: "conway",
      });
      const spendTracker = createMockSpendTracker({
        getDailySpend: (category: SpendCategory) =>
          category === "inference" ? 1000 : 0,
      });
      const request = createRequest(tool, {}, "agent", undefined, spendTracker);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("allow");
    });

    it("当超过每日上限时拒绝推理", () => {
      const rules = createFinancialRules(DEFAULT_TREASURY_POLICY);
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "chat",
        riskLevel: "safe",
        category: "conway",
      });
      const spendTracker = createMockSpendTracker({
        getDailySpend: (category: SpendCategory) =>
          category === "inference" ? 60000 : 0, // Over the 50000 default cap
      });
      const request = createRequest(tool, {}, "agent", undefined, spendTracker);

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("deny");
      expect(decision.reasonCode).toBe("INFERENCE_BUDGET_EXCEEDED");
    });
  });

  describe("financial.require_confirmation", () => {
    it("允许低于确认阈值的转账", () => {
      const rules = createFinancialRules(DEFAULT_TREASURY_POLICY);
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "transfer_credits",
        riskLevel: "dangerous",
        category: "financial",
      });
      const request = createRequest(tool, { amount_cents: 500 }, "agent");

      const decision = engine.evaluate(request);
      // 不应该被隔离（500 < 1000 阈值）
      expect(decision.action).not.toBe("quarantine");
    });

    it("隔离高于确认阈值的转账", () => {
      const rules = createFinancialRules(DEFAULT_TREASURY_POLICY);
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "transfer_credits",
        riskLevel: "dangerous",
        category: "financial",
      });
      const request = createRequest(tool, { amount_cents: 2000 }, "agent");

      const decision = engine.evaluate(request);
      // 应该被隔离（2000 > 1000 阈值），但也可能被拒绝
      // 如果超过 transfer_max_single 限制。2000 < 5000 所以不会被拒绝。
      expect(decision.action).toBe("quarantine");
      expect(decision.reasonCode).toBe("CONFIRMATION_REQUIRED");
    });

    it("对于确认阈值返回隔离而不是拒绝", () => {
      // 使用具有非常高转账限制的自定义策略，以便仅触发确认
      const policy: TreasuryPolicy = {
        ...DEFAULT_TREASURY_POLICY,
        maxSingleTransferCents: 100000,
        requireConfirmationAboveCents: 500,
      };
      const rules = createFinancialRules(policy);
      const engine = new PolicyEngine(db, rules);

      const tool = createMockTool({
        name: "transfer_credits",
        riskLevel: "dangerous",
        category: "financial",
      });
      const request = createRequest(tool, { amount_cents: 1000 }, "agent");

      const decision = engine.evaluate(request);
      expect(decision.action).toBe("quarantine");
      expect(decision.reasonCode).toBe("CONFIRMATION_REQUIRED");
    });
  });
});

// ─── 资金库配置测试 ──────────────────────────────────────

describe("Treasury Config", () => {
  it("DEFAULT_TREASURY_POLICY 具有所有必需字段", () => {
    expect(DEFAULT_TREASURY_POLICY.maxSingleTransferCents).toBe(5000);
    expect(DEFAULT_TREASURY_POLICY.maxHourlyTransferCents).toBe(10000);
    expect(DEFAULT_TREASURY_POLICY.maxDailyTransferCents).toBe(25000);
    expect(DEFAULT_TREASURY_POLICY.minimumReserveCents).toBe(1000);
    expect(DEFAULT_TREASURY_POLICY.maxX402PaymentCents).toBe(100);
    expect(DEFAULT_TREASURY_POLICY.x402AllowedDomains).toEqual(["conway.tech"]);
    expect(DEFAULT_TREASURY_POLICY.transferCooldownMs).toBe(0);
    expect(DEFAULT_TREASURY_POLICY.maxTransfersPerTurn).toBe(2);
    expect(DEFAULT_TREASURY_POLICY.maxInferenceDailyCents).toBe(50000);
    expect(DEFAULT_TREASURY_POLICY.requireConfirmationAboveCents).toBe(1000);
  });

  it("所有默认值都是正数", () => {
    for (const [key, value] of Object.entries(DEFAULT_TREASURY_POLICY)) {
      if (key === "x402AllowedDomains") continue;
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── createDefaultRules 集成 ─────────────────────────────

describe("createDefaultRules", () => {
  it("包括权限和速率限制规则", () => {
    const rules = createDefaultRules();
    const ruleIds = rules.map((r) => r.id);

    expect(ruleIds).toContain("authority.external_tool_restriction");
    expect(ruleIds).toContain("authority.self_mod_from_external");
    expect(ruleIds).toContain("rate.genesis_prompt_daily");
    expect(ruleIds).toContain("rate.self_mod_hourly");
    expect(ruleIds).toContain("rate.spawn_daily");
    expect(ruleIds).toContain("financial.inference_daily_cap");
    expect(ruleIds).toContain("financial.require_confirmation");
  });

  it("权限规则具有优先级 400", () => {
    const rules = createDefaultRules();
    const authorityRules = rules.filter((r) => r.id.startsWith("authority."));
    for (const rule of authorityRules) {
      expect(rule.priority).toBe(400);
    }
  });

  it("速率限制规则具有优先级 600", () => {
    const rules = createDefaultRules();
    const rateRules = rules.filter((r) => r.id.startsWith("rate."));
    for (const rule of rateRules) {
      expect(rule.priority).toBe(600);
    }
  });

  it("财务阶段 1 规则具有优先级 500", () => {
    const rules = createDefaultRules();
    const financialRules = rules.filter(
      (r) => r.id === "financial.inference_daily_cap" || r.id === "financial.require_confirmation",
    );
    for (const rule of financialRules) {
      expect(rule.priority).toBe(500);
    }
  });

  it("接受自定义资金库策略", () => {
    const customPolicy: TreasuryPolicy = {
      ...DEFAULT_TREASURY_POLICY,
      maxSingleTransferCents: 100,
    };
    const rules = createDefaultRules(customPolicy);
    expect(rules.length).toBeGreaterThan(0);
  });
});

// ─── promptWithDefault 测试 ────────────────────────────────────

describe("promptWithDefault", () => {
  // 注意：promptWithDefault 是一个交互式提示函数。
  // 我们通过导入和测试行为期望来测试其逻辑。
  // 实际函数需要 readline，所以我们验证导出的签名。

  it("从 prompts 模块导出", async () => {
    const prompts = await import("../setup/prompts.js");
    expect(typeof prompts.promptWithDefault).toBe("function");
  });
});
