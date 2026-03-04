/**
 * 消费跟踪器测试
 *
 * 消费跟踪器类的测试：
 * - recordSpend 使用正确的 window_hour 和 window_day 插入
 * - getHourlySpend 返回当前小时的总和
 * - getDailySpend 返回当前天的总和
 * - checkLimit 在超过限制时返回 allowed=false
 * - pruneOldRecords 删除早于保留期的记录
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import os from "os";
import fs from "fs";
import { SpendTracker } from "../agent/spend-tracker.js";
import type { TreasuryPolicy, LimitCheckResult } from "../types.js";
import { DEFAULT_TREASURY_POLICY } from "../types.js";

// ─── 测试辅助函数 ───────────────────────────────────────────────

function createTestSpendDb(): Database.Database {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "spend-test-"));
  const dbPath = path.join(tmpDir, "test.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
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

describe("SpendTracker", () => {
  let db: Database.Database;
  let tracker: SpendTracker;

  beforeEach(() => {
    db = createTestSpendDb();
    tracker = new SpendTracker(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("recordSpend", () => {
    it("使用正确的 window_hour 和 window_day 插入记录", () => {
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 500,
        recipient: "0x1234",
        category: "transfer",
      });

      const row = db
        .prepare("SELECT * FROM spend_tracking LIMIT 1")
        .get() as any;
      expect(row).toBeDefined();
      expect(row.tool_name).toBe("transfer_credits");
      expect(row.amount_cents).toBe(500);
      expect(row.recipient).toBe("0x1234");
      expect(row.category).toBe("transfer");

      // window_hour should be ISO format like '2026-02-19T14'
      expect(row.window_hour).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}$/);
      // window_day should be ISO format like '2026-02-19'
      expect(row.window_day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("插入多条记录", () => {
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 100,
        category: "transfer",
      });
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 200,
        category: "transfer",
      });
      tracker.recordSpend({
        toolName: "x402_fetch",
        amountCents: 50,
        domain: "conway.tech",
        category: "x402",
      });

      const count = db
        .prepare("SELECT COUNT(*) as count FROM spend_tracking")
        .get() as { count: number };
      expect(count.count).toBe(3);
    });
  });

  describe("getHourlySpend", () => {
    it("返回当前小时的总和", () => {
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 100,
        category: "transfer",
      });
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 200,
        category: "transfer",
      });

      const hourly = tracker.getHourlySpend("transfer");
      expect(hourly).toBe(300);
    });

    it("当没有记录时返回 0", () => {
      const hourly = tracker.getHourlySpend("transfer");
      expect(hourly).toBe(0);
    });

    it("分离类别", () => {
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 100,
        category: "transfer",
      });
      tracker.recordSpend({
        toolName: "x402_fetch",
        amountCents: 50,
        category: "x402",
      });

      expect(tracker.getHourlySpend("transfer")).toBe(100);
      expect(tracker.getHourlySpend("x402")).toBe(50);
    });
  });

  describe("getDailySpend", () => {
    it("返回当前天的总和", () => {
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 1000,
        category: "transfer",
      });
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 2000,
        category: "transfer",
      });

      const daily = tracker.getDailySpend("transfer");
      expect(daily).toBe(3000);
    });
  });

  describe("getTotalSpend", () => {
    it("返回给定日期以来的总消费", () => {
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 500,
        category: "transfer",
      });

      const total = tracker.getTotalSpend(
        "transfer",
        new Date(Date.now() - 3600 * 1000),
      );
      expect(total).toBe(500);
    });

    it("对未来的 since 日期返回 0", () => {
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 500,
        category: "transfer",
      });

      const total = tracker.getTotalSpend(
        "transfer",
        new Date(Date.now() + 3600 * 1000),
      );
      expect(total).toBe(0);
    });
  });

  describe("checkLimit", () => {
    it("在限制内时返回 allowed=true", () => {
      const result = tracker.checkLimit(100, "transfer", DEFAULT_TREASURY_POLICY);
      expect(result.allowed).toBe(true);
      expect(result.currentHourlySpend).toBe(0);
      expect(result.currentDailySpend).toBe(0);
    });

    it("当超过每小时限制时返回 allowed=false", () => {
      // Fill up hourly limit
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 9500,
        category: "transfer",
      });

      // Try to add more that would exceed 10000 hourly cap
      const result = tracker.checkLimit(600, "transfer", DEFAULT_TREASURY_POLICY);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Hourly");
      expect(result.currentHourlySpend).toBe(9500);
    });

    it("当超过每日限制时返回 allowed=false", () => {
      // Use custom policy with low hourly cap but test daily
      const policy: TreasuryPolicy = {
        ...DEFAULT_TREASURY_POLICY,
        maxHourlyTransferCents: 100_000, // high hourly to not trigger
        maxDailyTransferCents: 5000,
      };

      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 4500,
        category: "transfer",
      });

      const result = tracker.checkLimit(600, "transfer", policy);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Daily");
    });
  });

  describe("pruneOldRecords", () => {
    it("删除早于保留期的记录", () => {
      // Insert a record with old created_at
      db.prepare(
        `INSERT INTO spend_tracking (id, tool_name, amount_cents, category, window_hour, window_day, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        "old-record",
        "transfer_credits",
        100,
        "transfer",
        "2020-01-01T00",
        "2020-01-01",
        "2020-01-01T00:00:00.000Z",
      );

      // Insert a current record
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 200,
        category: "transfer",
      });

      const deleted = tracker.pruneOldRecords(1); // 1 day retention
      expect(deleted).toBe(1);

      const remaining = db
        .prepare("SELECT COUNT(*) as count FROM spend_tracking")
        .get() as { count: number };
      expect(remaining.count).toBe(1);
    });

    it("当没有旧记录时返回 0", () => {
      tracker.recordSpend({
        toolName: "transfer_credits",
        amountCents: 100,
        category: "transfer",
      });

      const deleted = tracker.pruneOldRecords(30);
      expect(deleted).toBe(0);
    });

    it("使用 SQLite datetime 格式正确修剪（无 T/Z）", () => {
      // Insert a record with SQLite-format created_at (no T, no Z)
      db.prepare(
        `INSERT INTO spend_tracking (id, tool_name, amount_cents, category, window_hour, window_day, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        "sqlite-format-record",
        "transfer_credits",
        100,
        "transfer",
        "2020-01-01T00",
        "2020-01-01",
        "2020-01-01 00:00:00", // SQLite datetime format
      );

      const deleted = tracker.pruneOldRecords(1);
      expect(deleted).toBe(1);
    });
  });

  describe("inference limits", () => {
    it("使用有意义的每小时上限，小于每日限制", () => {
      // maxInferenceDailyCents is 50000 ($500/day)
      // The hourly limit should be a fraction of the daily limit, NOT equal to it
      const result = tracker.checkLimit(1, "inference", DEFAULT_TREASURY_POLICY);
      expect(result.allowed).toBe(true);
      expect(result.limitHourly).toBeLessThan(result.limitDaily);
    });

    it("在达到每日限制之前强制执行每小时推理限制", () => {
      const hourlyLimit = Math.ceil(DEFAULT_TREASURY_POLICY.maxInferenceDailyCents / 6);

      // Spend up to just below hourly limit
      tracker.recordSpend({
        toolName: "inference",
        amountCents: hourlyLimit - 1,
        category: "inference",
      });

      // This should be denied because hourly limit would be exceeded
      const result = tracker.checkLimit(2, "inference", DEFAULT_TREASURY_POLICY);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Hourly");
    });
  });

  describe("x402 limits", () => {
    it("使用 x402 特定限制，而非转账限制", () => {
      // Record some x402 spend
      tracker.recordSpend({
        toolName: "x402_fetch",
        amountCents: 900,
        domain: "conway.tech",
        category: "x402",
      });

      // maxX402PaymentCents is 100, so hourly = 100*10 = 1000
      // 900 + 200 = 1100 > 1000 should be denied
      const result = tracker.checkLimit(200, "x402", DEFAULT_TREASURY_POLICY);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Hourly");

      // But the same amount should be allowed for transfers (limit is 10000)
      const transferResult = tracker.checkLimit(200, "transfer", DEFAULT_TREASURY_POLICY);
      expect(transferResult.allowed).toBe(true);
    });
  });
});
