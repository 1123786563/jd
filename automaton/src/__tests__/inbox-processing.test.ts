/**
 * 收件箱处理测试 (子阶段 1.2)
 *
 * 测试收件箱消息状态机:
 *   received → in_progress → processed (成功)
 *   received → in_progress → received (重试失败)
 *   received → in_progress → failed (超过最大重试次数)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { createDatabase } from "../state/database.js";
import {
  claimInboxMessages,
  markInboxProcessed,
  markInboxFailed,
  resetInboxToReceived,
  getUnprocessedInboxCount,
} from "../state/database.js";
import type { AutomatonDatabase } from "../types.js";

function makeTmpDbPath(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "automaton-inbox-test-"));
  return path.join(tmpDir, "test.db");
}

function insertTestMessage(db: AutomatonDatabase, id: string, from = "0xsender"): void {
  db.insertInboxMessage({
    id,
    from,
    to: "0xme",
    content: `Message ${id}`,
    signedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
}

describe("Inbox Processing State Machine (Phase 1.2)", () => {
  let dbPath: string;
  let db: AutomatonDatabase;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch { /* 已关闭 */ }
  });

  // ─── Schema: inbox_messages 有新列 ────────────────────

  describe("schema", () => {
    it("inbox_messages has status, retry_count, max_retries columns", () => {
      const columns = db.raw
        .prepare("PRAGMA table_info(inbox_messages)")
        .all() as { name: string }[];
      const names = columns.map((c) => c.name);
      expect(names).toContain("status");
      expect(names).toContain("retry_count");
      expect(names).toContain("max_retries");
    });

    it("新消息默认为 status=received, retry_count=0, max_retries=3", () => {
      insertTestMessage(db, "msg-defaults");
      const row = db.raw
        .prepare("SELECT status, retry_count, max_retries FROM inbox_messages WHERE id = ?")
        .get("msg-defaults") as { status: string; retry_count: number; max_retries: number };
      expect(row.status).toBe("received");
      expect(row.retry_count).toBe(0);
      expect(row.max_retries).toBe(3);
    });
  });

  // ─── claimInboxMessages ────────────────────────────────────────

  describe("claimInboxMessages", () => {
    it("认领已接收消息并转换为 in_progress", () => {
      insertTestMessage(db, "msg-1");
      insertTestMessage(db, "msg-2");

      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(2);
      expect(claimed[0].status).toBe("in_progress");
      expect(claimed[1].status).toBe("in_progress");

      // 在数据库中验证
      const row = db.raw
        .prepare("SELECT status FROM inbox_messages WHERE id = ?")
        .get("msg-1") as { status: string };
      expect(row.status).toBe("in_progress");
    });

    it("每次认领时增加 retry_count", () => {
      insertTestMessage(db, "msg-retry");

      const claimed1 = claimInboxMessages(db.raw, 10);
      expect(claimed1).toHaveLength(1);
      expect(claimed1[0].retryCount).toBe(1);

      // 重置为 received 以再次认领
      resetInboxToReceived(db.raw, ["msg-retry"]);

      const claimed2 = claimInboxMessages(db.raw, 10);
      expect(claimed2).toHaveLength(1);
      expect(claimed2[0].retryCount).toBe(2);
    });

    it("遵守 limit 参数", () => {
      insertTestMessage(db, "msg-a");
      insertTestMessage(db, "msg-b");
      insertTestMessage(db, "msg-c");

      const claimed = claimInboxMessages(db.raw, 2);
      expect(claimed).toHaveLength(2);
    });

    it("不认领已处于 in_progress 的消息", () => {
      insertTestMessage(db, "msg-ip");

      // 首次认领
      claimInboxMessages(db.raw, 10);

      // 第二次认领应返回空 (msg-ip 是 in_progress)
      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(0);
    });

    it("不认领已用尽重试次数的消息", () => {
      insertTestMessage(db, "msg-exhausted");

      // 模拟用尽重试次数 (3 次认领 + 重置)
      for (let i = 0; i < 3; i++) {
        claimInboxMessages(db.raw, 10);
        resetInboxToReceived(db.raw, ["msg-exhausted"]);
      }

      // 现在不应被认领 (retry_count = 3 = max_retries)
      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(0);
    });

    it("没有可用消息时返回空数组", () => {
      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(0);
    });
  });

  // ─── markInboxProcessed ────────────────────────────────────────

  describe("markInboxProcessed", () => {
    it("转换消息状态为 processed", () => {
      insertTestMessage(db, "msg-p1");
      claimInboxMessages(db.raw, 10);

      markInboxProcessed(db.raw, ["msg-p1"]);

      const row = db.raw
        .prepare("SELECT status, processed_at FROM inbox_messages WHERE id = ?")
        .get("msg-p1") as { status: string; processed_at: string | null };
      expect(row.status).toBe("processed");
      expect(row.processed_at).not.toBeNull();
    });

    it("优雅地处理空 ids 数组", () => {
      expect(() => markInboxProcessed(db.raw, [])).not.toThrow();
    });

    it("一次处理多个消息", () => {
      insertTestMessage(db, "msg-batch-1");
      insertTestMessage(db, "msg-batch-2");
      claimInboxMessages(db.raw, 10);

      markInboxProcessed(db.raw, ["msg-batch-1", "msg-batch-2"]);

      const count = db.raw
        .prepare("SELECT COUNT(*) as c FROM inbox_messages WHERE status = 'processed'")
        .get() as { c: number };
      expect(count.c).toBe(2);
    });
  });

  // ─── markInboxFailed ──────────────────────────────────────────

  describe("markInboxFailed", () => {
    it("转换消息状态为 failed", () => {
      insertTestMessage(db, "msg-f1");
      claimInboxMessages(db.raw, 10);

      markInboxFailed(db.raw, ["msg-f1"]);

      const row = db.raw
        .prepare("SELECT status FROM inbox_messages WHERE id = ?")
        .get("msg-f1") as { status: string };
      expect(row.status).toBe("failed");
    });

    it("失败的消息无法被认领", () => {
      insertTestMessage(db, "msg-f2");
      claimInboxMessages(db.raw, 10);
      markInboxFailed(db.raw, ["msg-f2"]);

      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(0);
    });
  });

  // ─── resetInboxToReceived ─────────────────────────────────────

  describe("resetInboxToReceived", () => {
    it("将消息转换回 received 状态以重试", () => {
      insertTestMessage(db, "msg-r1");
      claimInboxMessages(db.raw, 10);

      resetInboxToReceived(db.raw, ["msg-r1"]);

      const row = db.raw
        .prepare("SELECT status FROM inbox_messages WHERE id = ?")
        .get("msg-r1") as { status: string };
      expect(row.status).toBe("received");
    });

    it("重置后的消息可再次被认领", () => {
      insertTestMessage(db, "msg-r2");
      claimInboxMessages(db.raw, 10);
      resetInboxToReceived(db.raw, ["msg-r2"]);

      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe("msg-r2");
    });
  });

  // ─── getUnprocessedInboxCount ─────────────────────────────────

  describe("getUnprocessedInboxCount", () => {
    it("计算 received 和 in_progress 消息", () => {
      insertTestMessage(db, "msg-c1");
      insertTestMessage(db, "msg-c2");
      insertTestMessage(db, "msg-c3");

      // 一个已认领 (in_progress)，两个 received
      claimInboxMessages(db.raw, 1);

      const count = getUnprocessedInboxCount(db.raw);
      expect(count).toBe(3);
    });

    it("不计算已处理的消息", () => {
      insertTestMessage(db, "msg-c4");
      claimInboxMessages(db.raw, 10);
      markInboxProcessed(db.raw, ["msg-c4"]);

      const count = getUnprocessedInboxCount(db.raw);
      expect(count).toBe(0);
    });

    it("不计算失败的消息", () => {
      insertTestMessage(db, "msg-c5");
      claimInboxMessages(db.raw, 10);
      markInboxFailed(db.raw, ["msg-c5"]);

      const count = getUnprocessedInboxCount(db.raw);
      expect(count).toBe(0);
    });

    it("没有消息时返回 0", () => {
      const count = getUnprocessedInboxCount(db.raw);
      expect(count).toBe(0);
    });
  });

  // ─── 完整状态机流程 ──────────────────────────────────

  describe("full state machine flow", () => {
    it("成功路径: received → in_progress → processed", () => {
      insertTestMessage(db, "msg-flow-1");

      // 验证初始状态
      let row = db.raw.prepare("SELECT status, retry_count FROM inbox_messages WHERE id = ?")
        .get("msg-flow-1") as { status: string; retry_count: number };
      expect(row.status).toBe("received");
      expect(row.retry_count).toBe(0);

      // 认领
      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(1);
      row = db.raw.prepare("SELECT status, retry_count FROM inbox_messages WHERE id = ?")
        .get("msg-flow-1") as { status: string; retry_count: number };
      expect(row.status).toBe("in_progress");
      expect(row.retry_count).toBe(1);

      // 处理
      markInboxProcessed(db.raw, ["msg-flow-1"]);
      row = db.raw.prepare("SELECT status, retry_count FROM inbox_messages WHERE id = ?")
        .get("msg-flow-1") as { status: string; retry_count: number };
      expect(row.status).toBe("processed");
      expect(row.retry_count).toBe(1);
    });

    it("重试路径: received → in_progress → received (×N) → in_progress → processed", () => {
      insertTestMessage(db, "msg-flow-2");

      // 第一次尝试: 认领然后失败
      claimInboxMessages(db.raw, 10);
      resetInboxToReceived(db.raw, ["msg-flow-2"]);

      // 第二次尝试: 认领然后失败
      claimInboxMessages(db.raw, 10);
      resetInboxToReceived(db.raw, ["msg-flow-2"]);

      // 第三次尝试: 认领然后成功
      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(1);
      expect(claimed[0].retryCount).toBe(3);

      markInboxProcessed(db.raw, ["msg-flow-2"]);
      const row = db.raw.prepare("SELECT status, retry_count FROM inbox_messages WHERE id = ?")
        .get("msg-flow-2") as { status: string; retry_count: number };
      expect(row.status).toBe("processed");
      expect(row.retry_count).toBe(3);
    });

    it("耗尽路径: received → in_progress → received (×3) → failed", () => {
      insertTestMessage(db, "msg-flow-3");

      // 耗尽所有 3 次重试
      for (let i = 0; i < 3; i++) {
        const claimed = claimInboxMessages(db.raw, 10);
        expect(claimed).toHaveLength(1);
        resetInboxToReceived(db.raw, ["msg-flow-3"]);
      }

      // 不应再被认领 (retry_count = 3 = max_retries)
      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(0);

      // 手动标记为失败 (循环会这样做)
      markInboxFailed(db.raw, ["msg-flow-3"]);
      const row = db.raw.prepare("SELECT status, retry_count FROM inbox_messages WHERE id = ?")
        .get("msg-flow-3") as { status: string; retry_count: number };
      expect(row.status).toBe("failed");
      expect(row.retry_count).toBe(3);
    });

    it("原子确认: 在事务中标记 markInboxProcessed", () => {
      insertTestMessage(db, "msg-txn-1");
      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(1);

      // 模拟循环的操作: 原子 turn + inbox 确认
      const turn = {
        id: "turn-inbox-test",
        timestamp: new Date().toISOString(),
        state: "running" as const,
        thinking: "处理收件箱消息",
        toolCalls: [],
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        costCents: 1,
      };

      db.runTransaction(() => {
        db.insertTurn(turn);
        markInboxProcessed(db.raw, ["msg-txn-1"]);
      });

      // 两者都应成功
      const savedTurn = db.getTurnById("turn-inbox-test");
      expect(savedTurn).toBeDefined();

      const row = db.raw.prepare("SELECT status FROM inbox_messages WHERE id = ?")
        .get("msg-txn-1") as { status: string };
      expect(row.status).toBe("processed");
    });

    it("原子确认回滚: turn 失败使消息保持 in_progress", () => {
      insertTestMessage(db, "msg-txn-2");

      // 首先插入一个 turn 来创建重复
      db.insertTurn({
        id: "turn-dup",
        timestamp: new Date().toISOString(),
        state: "running",
        thinking: "setup",
        toolCalls: [],
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        costCents: 0,
      });

      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(1);

      // 失败的事务 (重复的 turn ID)
      expect(() => {
        db.runTransaction(() => {
          db.insertTurn({
            id: "turn-dup", // 重复!
            timestamp: new Date().toISOString(),
            state: "running",
            thinking: "Should fail",
            toolCalls: [],
            tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            costCents: 0,
          });
          markInboxProcessed(db.raw, ["msg-txn-2"]);
        });
      }).toThrow();

      // 消息应仍为 in_progress (markInboxProcessed 已回滚)
      const row = db.raw.prepare("SELECT status FROM inbox_messages WHERE id = ?")
        .get("msg-txn-2") as { status: string };
      expect(row.status).toBe("in_progress");
    });

    it("通过 INSERT OR IGNORE 忽略重复消息插入", () => {
      insertTestMessage(db, "msg-dup-1");

      // 尝试再次插入相同消息
      expect(() => {
        insertTestMessage(db, "msg-dup-1");
      }).not.toThrow();

      // 应仍只有一个消息
      const count = db.raw
        .prepare("SELECT COUNT(*) as c FROM inbox_messages WHERE id = 'msg-dup-1'")
        .get() as { c: number };
      expect(count.c).toBe(1);
    });

    it("混合成功/失败: 部分消息已处理，其他重试", () => {
      insertTestMessage(db, "msg-mix-1");
      insertTestMessage(db, "msg-mix-2");
      insertTestMessage(db, "msg-mix-3");

      const claimed = claimInboxMessages(db.raw, 10);
      expect(claimed).toHaveLength(3);

      // 模拟: msg-mix-1 成功，msg-mix-2 重试，msg-mix-3 失败 (已达最大值)
      markInboxProcessed(db.raw, ["msg-mix-1"]);
      resetInboxToReceived(db.raw, ["msg-mix-2"]);
      markInboxFailed(db.raw, ["msg-mix-3"]);

      const s1 = db.raw.prepare("SELECT status FROM inbox_messages WHERE id = ?")
        .get("msg-mix-1") as { status: string };
      const s2 = db.raw.prepare("SELECT status FROM inbox_messages WHERE id = ?")
        .get("msg-mix-2") as { status: string };
      const s3 = db.raw.prepare("SELECT status FROM inbox_messages WHERE id = ?")
        .get("msg-mix-3") as { status: string };

      expect(s1.status).toBe("processed");
      expect(s2.status).toBe("received");
      expect(s3.status).toBe("failed");

      // 只有 msg-mix-2 应该是未处理的
      const unprocessed = getUnprocessedInboxCount(db.raw);
      expect(unprocessed).toBe(1);
    });
  });
});
