import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MIGRATION_V9 } from "../../state/schema.js";
import {
  EventStream,
  estimateTokens,
  type EventType,
} from "../../memory/event-stream.js";

let db: BetterSqlite3.Database;
let stream: EventStream;

function createTestDb(): BetterSqlite3.Database {
  const testDb = new Database(":memory:");
  testDb.pragma("journal_mode = WAL");
  testDb.pragma("foreign_keys = ON");
  testDb.exec(MIGRATION_V9);
  return testDb;
}

function appendAt(params: {
  type?: EventType;
  agentAddress?: string;
  goalId?: string | null;
  taskId?: string | null;
  content?: string;
  tokenCount?: number;
  compactedTo?: string | null;
  createdAt: string;
}): string {
  const id = stream.append({
    type: params.type ?? "observation",
    agentAddress: params.agentAddress ?? "agent-a",
    goalId: params.goalId ?? null,
    taskId: params.taskId ?? null,
    content: params.content ?? "payload",
    tokenCount: params.tokenCount ?? 0,
    compactedTo: params.compactedTo ?? null,
  });

  db.prepare("UPDATE event_stream SET created_at = ? WHERE id = ?").run(params.createdAt, id);
  return id;
}

beforeEach(() => {
  db = createTestDb();
  stream = new EventStream(db);
});

afterEach(() => {
  db.close();
});

describe("EventStream", () => {
  it("append创建带有ULID和时间戳的事件", () => {
    const id = stream.append({
      type: "action",
      agentAddress: "agent-1",
      goalId: "goal-1",
      taskId: "task-1",
      content: "run",
      tokenCount: 3,
      compactedTo: null,
    });

    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    const row = db
      .prepare("SELECT id, created_at AS createdAt FROM event_stream WHERE id = ?")
      .get(id) as { id: string; createdAt: string };

    expect(row.id).toBe(id);
    expect(() => new Date(row.createdAt)).not.toThrow();
  });

  it("append在输入tokenCount为0时估算token计数", () => {
    const id = stream.append({
      type: "observation",
      agentAddress: "agent-1",
      goalId: null,
      taskId: null,
      content: "1234567890",
      tokenCount: 0,
      compactedTo: null,
    });

    const row = db.prepare("SELECT token_count AS tokenCount FROM event_stream WHERE id = ?").get(id) as {
      tokenCount: number;
    };
    expect(row.tokenCount).toBe(estimateTokens("1234567890"));
  });

  it("append在非零时保留显式tokenCount", () => {
    const id = stream.append({
      type: "observation",
      agentAddress: "agent-1",
      goalId: null,
      taskId: null,
      content: "ignored",
      tokenCount: 42,
      compactedTo: null,
    });

    const row = db.prepare("SELECT token_count AS tokenCount FROM event_stream WHERE id = ?").get(id) as {
      tokenCount: number;
    };
    expect(row.tokenCount).toBe(42);
  });

  it("getRecent按时间顺序返回事件", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", content: "one" });
    appendAt({ createdAt: "2026-01-01T00:00:03.000Z", content: "three" });
    appendAt({ createdAt: "2026-01-01T00:00:02.000Z", content: "two" });

    const events = stream.getRecent("agent-a", 10);
    expect(events.map((event) => event.content)).toEqual(["one", "two", "three"]);
  });

  it("getRecent应用限制", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", content: "one" });
    appendAt({ createdAt: "2026-01-01T00:00:02.000Z", content: "two" });
    appendAt({ createdAt: "2026-01-01T00:00:03.000Z", content: "three" });

    const events = stream.getRecent("agent-a", 2);
    expect(events.map((event) => event.content)).toEqual(["two", "three"]);
  });

  it("getRecent按代理地址过滤", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", content: "a1", agentAddress: "a" });
    appendAt({ createdAt: "2026-01-01T00:00:02.000Z", content: "b1", agentAddress: "b" });
    appendAt({ createdAt: "2026-01-01T00:00:03.000Z", content: "a2", agentAddress: "a" });

    const events = stream.getRecent("a", 10);
    expect(events.map((event) => event.content)).toEqual(["a1", "a2"]);
  });

  it("getByGoal正确过滤", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", goalId: "goal-1", content: "g1" });
    appendAt({ createdAt: "2026-01-01T00:00:02.000Z", goalId: "goal-2", content: "g2" });

    const events = stream.getByGoal("goal-1");
    expect(events).toHaveLength(1);
    expect(events[0].content).toBe("g1");
  });

  it("getByGoal按created_at升序排列", () => {
    appendAt({ createdAt: "2026-01-01T00:00:03.000Z", goalId: "goal-1", content: "three" });
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", goalId: "goal-1", content: "one" });
    appendAt({ createdAt: "2026-01-01T00:00:02.000Z", goalId: "goal-1", content: "two" });

    const events = stream.getByGoal("goal-1");
    expect(events.map((event) => event.content)).toEqual(["one", "two", "three"]);
  });

  it("getByType按类型返回事件", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", type: "inference", content: "i1" });
    appendAt({ createdAt: "2026-01-01T00:00:02.000Z", type: "action", content: "a1" });
    appendAt({ createdAt: "2026-01-01T00:00:03.000Z", type: "inference", content: "i2" });

    const events = stream.getByType("inference");
    expect(events.map((event) => event.content)).toEqual(["i1", "i2"]);
  });

  it("getByType支持since过滤器", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", type: "inference", content: "old" });
    appendAt({ createdAt: "2026-01-01T00:00:02.000Z", type: "inference", content: "new" });

    const events = stream.getByType("inference", "2026-01-01T00:00:01.500Z");
    expect(events.map((event) => event.content)).toEqual(["new"]);
  });

  it("getByType的since过滤器包含边界值", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", type: "inference", content: "included" });
    appendAt({ createdAt: "2026-01-01T00:00:02.000Z", type: "inference", content: "later" });

    const events = stream.getByType("inference", "2026-01-01T00:00:01.000Z");
    expect(events.map((event) => event.content)).toEqual(["included", "later"]);
  });

  it("compact使用引用策略设置compacted_to字段", () => {
    const id = appendAt({ createdAt: "2026-01-01T00:00:01.000Z", content: "compact me", tokenCount: 100 });

    const result = stream.compact("2026-01-01T00:00:02.000Z", "reference");
    expect(result.compactedCount).toBe(1);

    const row = db.prepare("SELECT compacted_to AS compactedTo FROM event_stream WHERE id = ?").get(id) as {
      compactedTo: string;
    };
    expect(row.compactedTo).toMatch(/^ref:/);
  });

  it("compact使用摘要策略存储摘要标记", () => {
    const id = appendAt({
      createdAt: "2026-01-01T00:00:01.000Z",
      type: "action",
      content: "This is a long event that should become a summarized compacted payload.",
      tokenCount: 120,
    });

    stream.compact("2026-01-01T00:00:02.000Z", "summarize");

    const row = db.prepare("SELECT compacted_to AS compactedTo FROM event_stream WHERE id = ?").get(id) as {
      compactedTo: string;
    };
    expect(row.compactedTo).toMatch(/^summary:action:/);
  });

  it("compact在没有符合条件的行时返回零", () => {
    appendAt({ createdAt: "2026-01-01T00:00:03.000Z", content: "new" });

    const result = stream.compact("2026-01-01T00:00:01.000Z", "reference");
    expect(result).toEqual({ compactedCount: 0, tokensSaved: 0, strategy: "reference" });
  });

  it("compact不触及已压缩的行", () => {
    const id = appendAt({
      createdAt: "2026-01-01T00:00:01.000Z",
      content: "already compacted",
      compactedTo: "ref:existing",
    });

    const result = stream.compact("2026-01-01T00:00:02.000Z", "reference");
    expect(result.compactedCount).toBe(0);

    const row = db.prepare("SELECT compacted_to AS compactedTo FROM event_stream WHERE id = ?").get(id) as {
      compactedTo: string;
    };
    expect(row.compactedTo).toBe("ref:existing");
  });

  it("compact报告非负的已保存token", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", tokenCount: 10, content: "tiny" });

    const result = stream.compact("2026-01-01T00:00:02.000Z", "reference");
    expect(result.tokensSaved).toBeGreaterThanOrEqual(0);
  });

  it("getTokenCount汇总代理的所有token", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", agentAddress: "a", tokenCount: 10 });
    appendAt({ createdAt: "2026-01-01T00:00:02.000Z", agentAddress: "a", tokenCount: 20 });
    appendAt({ createdAt: "2026-01-01T00:00:03.000Z", agentAddress: "b", tokenCount: 50 });

    expect(stream.getTokenCount("a")).toBe(30);
  });

  it("getTokenCount尊重since过滤器", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", agentAddress: "a", tokenCount: 10 });
    appendAt({ createdAt: "2026-01-01T00:00:02.000Z", agentAddress: "a", tokenCount: 20 });

    expect(stream.getTokenCount("a", "2026-01-01T00:00:01.500Z")).toBe(20);
  });

  it("prune删除旧事件", () => {
    appendAt({ createdAt: "2026-01-01T00:00:01.000Z", content: "old" });
    appendAt({ createdAt: "2026-01-01T00:00:03.000Z", content: "new" });

    const removed = stream.prune("2026-01-01T00:00:02.000Z");
    expect(removed).toBe(1);

    const remaining = db.prepare("SELECT COUNT(*) AS count FROM event_stream").get() as { count: number };
    expect(remaining.count).toBe(1);
  });

  it("prune在没有任何删除时返回零", () => {
    appendAt({ createdAt: "2026-01-01T00:00:03.000Z", content: "new" });
    expect(stream.prune("2026-01-01T00:00:01.000Z")).toBe(0);
  });

  it("estimateTokens使用3.5字符/token的启发式方法", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("1234567")).toBe(2);
    expect(estimateTokens("12345678901234")).toBe(4);
  });
});
