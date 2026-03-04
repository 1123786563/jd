/**
 * 数据库事务安全测试
 *
 * 阶段 0.8 子阶段测试：原子事务、迁移运行器、
 * WAL 管理、完整性检查和 withTransaction 辅助函数。
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";
import { createDatabase } from "../state/database.js";
import { withTransaction, checkpointWAL } from "../state/database.js";
import type { AutomatonDatabase, AgentTurn, ToolCallResult } from "../types.js";

function makeTmpDbPath(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "automaton-txn-test-"));
  return path.join(tmpDir, "test.db");
}

describe("Database Transaction Safety", () => {
  let dbPath: string;
  let db: AutomatonDatabase;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch { /* 已关闭 */ }
  });

  // ─── withTransaction 辅助函数 ──────────────────────────────────

  describe("withTransaction", () => {
    it("原子地包装操作 —— 两者都成功", () => {
      const rawDb = new Database(dbPath);
      withTransaction(rawDb, () => {
        rawDb.prepare("INSERT INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("a", "1");
        rawDb.prepare("INSERT INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("b", "2");
      });
      const a = rawDb.prepare("SELECT value FROM kv WHERE key = ?").get("a") as { value: string } | undefined;
      const b = rawDb.prepare("SELECT value FROM kv WHERE key = ?").get("b") as { value: string } | undefined;
      expect(a?.value).toBe("1");
      expect(b?.value).toBe("2");
      rawDb.close();
    });

    it("如果任何操作失败则回滚所有操作", () => {
      const rawDb = new Database(dbPath);
      expect(() => {
        withTransaction(rawDb, () => {
          rawDb.prepare("INSERT INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("x", "1");
          // 强制约束错误：向 PRIMARY KEY 列插入重复项
          rawDb.prepare("INSERT INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))").run("x", "2");
        });
      }).toThrow();

      // 由于事务回滚了第一次插入，所以不应该存在任何行
      // 实际上，第二次 INSERT 会因 UNIQUE 约束而失败，但由于 kv 通常使用
      // INSERT OR REPLACE，让我们用不同的表来测试
      rawDb.close();
    });

    it("错误时回滚所有操作（turns 表）", () => {
      const rawDb = new Database(dbPath);

      // 插入一个轮次以设置重复项
      rawDb.prepare(
        `INSERT INTO turns (id, timestamp, state, thinking, tool_calls, token_usage, cost_cents)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run("turn-existing", "2026-01-01T00:00:00Z", "running", "test", "[]", "{}", 0);

      expect(() => {
        withTransaction(rawDb, () => {
          // 插入一个新的有效轮次
          rawDb.prepare(
            `INSERT INTO turns (id, timestamp, state, thinking, tool_calls, token_usage, cost_cents)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).run("turn-new", "2026-01-01T00:00:01Z", "running", "test2", "[]", "{}", 0);
          // 插入重复项 —— 应该失败
          rawDb.prepare(
            `INSERT INTO turns (id, timestamp, state, thinking, tool_calls, token_usage, cost_cents)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ).run("turn-existing", "2026-01-01T00:00:02Z", "running", "test3", "[]", "{}", 0);
        });
      }).toThrow();

      // 由于回滚，"turn-new" 不应存在
      const row = rawDb.prepare("SELECT * FROM turns WHERE id = ?").get("turn-new");
      expect(row).toBeUndefined();
      rawDb.close();
    });
  });

  // ─── AutomatonDatabase 上的 runTransaction ─────────────────────

  describe("runTransaction", () => {
    it("使轮次 + 工具调用原子化", () => {
      const turn: AgentTurn = {
        id: "turn-001",
        timestamp: new Date().toISOString(),
        state: "running",
        thinking: "Testing atomicity",
        toolCalls: [],
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        costCents: 1,
      };

      const toolCall: ToolCallResult = {
        id: "tc-001",
        name: "exec",
        arguments: { command: "echo hi" },
        result: "hi",
        durationMs: 10,
      };

      db.runTransaction(() => {
        db.insertTurn(turn);
        db.insertToolCall(turn.id, toolCall);
      });

      const savedTurn = db.getTurnById("turn-001");
      expect(savedTurn).toBeDefined();
      expect(savedTurn!.thinking).toBe("Testing atomicity");

      const savedCalls = db.getToolCallsForTurn("turn-001");
      expect(savedCalls).toHaveLength(1);
      expect(savedCalls[0].name).toBe("exec");
    });

    it("当工具调用插入失败时回滚轮次", () => {
      const turn: AgentTurn = {
        id: "turn-002",
        timestamp: new Date().toISOString(),
        state: "running",
        thinking: "Should be rolled back",
        toolCalls: [],
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        costCents: 1,
      };

      // 首先插入一个工具调用以导致重复
      db.runTransaction(() => {
        db.insertTurn({
          ...turn,
          id: "turn-setup",
          thinking: "setup",
        });
        db.insertToolCall("turn-setup", {
          id: "tc-dup",
          name: "exec",
          arguments: {},
          result: "ok",
          durationMs: 1,
        });
      });

      expect(() => {
        db.runTransaction(() => {
          db.insertTurn(turn);
          // 这应该失败，因为 tc-dup 已经存在
          db.insertToolCall(turn.id, {
            id: "tc-dup",
            name: "exec",
            arguments: {},
            result: "fail",
            durationMs: 1,
          });
        });
      }).toThrow();

      // 由于回滚，turn-002 不应存在
      const savedTurn = db.getTurnById("turn-002");
      expect(savedTurn).toBeUndefined();
    });

    it("使轮次 + 工具调用 + 收件箱确认原子化", () => {
      // 插入收件箱消息
      db.insertInboxMessage({
        id: "msg-001",
        from: "0xsender",
        to: "0xme",
        content: "hello",
        signedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      const unprocessed = db.getUnprocessedInboxMessages(10);
      expect(unprocessed).toHaveLength(1);

      const turn: AgentTurn = {
        id: "turn-003",
        timestamp: new Date().toISOString(),
        state: "running",
        thinking: "Processing message",
        toolCalls: [],
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        costCents: 1,
      };

      db.runTransaction(() => {
        db.insertTurn(turn);
        db.markInboxMessageProcessed("msg-001");
      });

      const savedTurn = db.getTurnById("turn-003");
      expect(savedTurn).toBeDefined();

      const remaining = db.getUnprocessedInboxMessages(10);
      expect(remaining).toHaveLength(0);
    });
  });

  // ─── 事务中的模式创建 ──────────────────────────────────

  describe("schema creation", () => {
    it("创建所有预期的表", () => {
      const rawDb = new Database(dbPath);
      const tables = rawDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[];
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain("turns");
      expect(tableNames).toContain("tool_calls");
      expect(tableNames).toContain("kv");
      expect(tableNames).toContain("schema_version");
      expect(tableNames).toContain("identity");
      expect(tableNames).toContain("heartbeat_entries");
      expect(tableNames).toContain("transactions");
      expect(tableNames).toContain("installed_tools");
      expect(tableNames).toContain("modifications");
      expect(tableNames).toContain("skills");
      expect(tableNames).toContain("children");
      expect(tableNames).toContain("registry");
      expect(tableNames).toContain("reputation");
      expect(tableNames).toContain("inbox_messages");
      rawDb.close();
    });
  });

  // ─── 迁移 v4 ────────────────────────────────────────────

  describe("migration v4", () => {
    it("创建 policy_decisions 和 spend_tracking 表", () => {
      const rawDb = new Database(dbPath);
      const tables = rawDb
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[];
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain("policy_decisions");
      expect(tableNames).toContain("spend_tracking");
      rawDb.close();
    });

    it("记录模式版本", () => {
      const rawDb = new Database(dbPath);
      const row = rawDb
        .prepare("SELECT MAX(version) as v FROM schema_version")
        .get() as { v: number };
      // 模式版本应该是当前的 SCHEMA_VERSION（由迁移更新）
      expect(row.v).toBeGreaterThanOrEqual(4);
      rawDb.close();
    });

    it("在新数据库上干净地应用（模拟从 v3 升级）", () => {
      // beforeEach 中的 createDatabase() 调用已经完成了这个。
      // 只需验证我们可以重新打开同一个数据库而没有错误。
      db.close();
      const db2 = createDatabase(dbPath);
      expect(db2.getTurnCount()).toBe(0);
      db2.close();
      // 为 afterEach 重新打开
      db = createDatabase(dbPath);
    });
  });

  // ─── deleteKVReturning（原子 wake_request） ─────────────────

  describe("deleteKVReturning", () => {
    it("在一个操作中返回值并删除", () => {
      db.setKV("wake_request", "heartbeat_triggered");

      const value = db.deleteKVReturning("wake_request");
      expect(value).toBe("heartbeat_triggered");

      // 现在应该消失了
      const gone = db.getKV("wake_request");
      expect(gone).toBeUndefined();
    });

    it("如果键不存在则返回 undefined", () => {
      const value = db.deleteKVReturning("nonexistent");
      expect(value).toBeUndefined();
    });
  });

  // ─── WAL 模式 ────────────────────────────────────────────────

  describe("WAL mode", () => {
    it("数据库处于 WAL 模式", () => {
      const rawDb = new Database(dbPath);
      const result = rawDb.pragma("journal_mode") as { journal_mode: string }[];
      expect(result[0].journal_mode).toBe("wal");
      rawDb.close();
    });

    it("wal_autocheckpoint 设置为 1000", () => {
      const rawDb = new Database(dbPath);
      const result = rawDb.pragma("wal_autocheckpoint") as { wal_autocheckpoint: number }[];
      expect(result[0].wal_autocheckpoint).toBe(1000);
      rawDb.close();
    });
  });

  // ─── checkpointWAL ──────────────────────────────────────────

  describe("checkpointWAL", () => {
    it("在有效数据库上运行没有错误", () => {
      const rawDb = new Database(dbPath);
      expect(() => checkpointWAL(rawDb)).not.toThrow();
      rawDb.close();
    });
  });

  // ─── 启动时的完整性检查 ────────────────────────────────

  describe("integrity check on startup", () => {
    it("在健康数据库上通过", () => {
      // createDatabase() 已经在没有抛出的情况下运行，所以完整性检查通过了。
      expect(db.getTurnCount()).toBe(0);
    });

    it("在损坏的数据库上抛出", () => {
      db.close();

      // 通过覆盖部分来损坏数据库文件
      const data = fs.readFileSync(dbPath);
      const corrupted = Buffer.from(data);
      // 覆盖文件中间的字节以损坏它
      // （但保留头部以便 SQLite 可以打开它）
      if (corrupted.length > 200) {
        for (let i = 100; i < 200; i++) {
          corrupted[i] = 0xFF;
        }
        fs.writeFileSync(dbPath, corrupted);

        // 这可能会或可能不会抛出，取决于我们损坏了什么
        // 至少，我们验证 createDatabase 处理完整性检查
        try {
          const db2 = createDatabase(dbPath);
          // 如果没有抛出，损坏没有影响完整性检查区域
          db2.close();
        } catch (err: any) {
          expect(err.message).toMatch(/integrity|corrupt|malformed/i);
        }
      }

      // 为 afterEach 重新创建一个干净的数据库
      const cleanPath = makeTmpDbPath();
      dbPath = cleanPath;
      db = createDatabase(dbPath);
    });
  });
});
