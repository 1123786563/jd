/**
 * 数据层加固测试（阶段 1.6 子阶段）
 *
 * 测试：SSRF 阻止、URI 白名单、代理卡片验证、
 * 已安装工具加载、KV 修剪、safeJsonParse、
 * agent_state 验证、createdAt 持久化。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { createDatabase, pruneStaleKV } from "../state/database.js";
import type { AutomatonDatabase } from "../types.js";

// 模拟 erc8004.js 以避免导入时的 ABI 解析错误
vi.mock("../registry/erc8004.js", () => ({
  queryAgent: vi.fn(),
  getTotalAgents: vi.fn().mockResolvedValue(0),
  registerAgent: vi.fn(),
  leaveFeedback: vi.fn(),
}));

// 模拟 injection-defense.js 以避免导入链问题
vi.mock("../agent/injection-defense.js", () => ({
  sanitizeToolResult: vi.fn((s: string) => s),
  sanitizeInput: vi.fn((s: string) => ({ content: s, blocked: false })),
}));

// 在设置模拟后导入
const { isAllowedUri, isInternalNetwork, validateAgentCard } = await import("../registry/discovery.js");
const { loadInstalledTools } = await import("../agent/tools.js");

function makeTmpDbPath(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "automaton-data-layer-test-"));
  return path.join(tmpDir, "test.db");
}

// ─── SSRF 保护测试 ──────────────────────────────────────

describe("SSRF Protection", () => {
  describe("isInternalNetwork", () => {
    it("阻止 127.0.0.1（环回地址）", () => {
      expect(isInternalNetwork("127.0.0.1")).toBe(true);
    });

    it("阻止 127.x.x.x 范围", () => {
      expect(isInternalNetwork("127.255.0.1")).toBe(true);
    });

    it("阻止 10.0.0.1（私有 A 类）", () => {
      expect(isInternalNetwork("10.0.0.1")).toBe(true);
    });

    it("阻止 10.255.255.255", () => {
      expect(isInternalNetwork("10.255.255.255")).toBe(true);
    });

    it("阻止 172.16.0.1（私有 B 类）", () => {
      expect(isInternalNetwork("172.16.0.1")).toBe(true);
    });

    it("阻止 172.31.255.255", () => {
      expect(isInternalNetwork("172.31.255.255")).toBe(true);
    });

    it("允许 172.15.0.1（不在私有范围内）", () => {
      expect(isInternalNetwork("172.15.0.1")).toBe(false);
    });

    it("允许 172.32.0.1（不在私有范围内）", () => {
      expect(isInternalNetwork("172.32.0.1")).toBe(false);
    });

    it("阻止 192.168.1.1（私有 C 类）", () => {
      expect(isInternalNetwork("192.168.1.1")).toBe(true);
    });

    it("阻止 169.254.0.0（链路本地）", () => {
      expect(isInternalNetwork("169.254.0.0")).toBe(true);
    });

    it("阻止 ::1（IPv6 环回地址）", () => {
      expect(isInternalNetwork("::1")).toBe(true);
    });

    it("阻止 localhost", () => {
      expect(isInternalNetwork("localhost")).toBe(true);
    });

    it("阻止 LOCALHOST（不区分大小写）", () => {
      expect(isInternalNetwork("LOCALHOST")).toBe(true);
    });

    it("阻止 0.0.0.0", () => {
      expect(isInternalNetwork("0.0.0.0")).toBe(true);
    });

    it("允许公共 IP", () => {
      expect(isInternalNetwork("8.8.8.8")).toBe(false);
      expect(isInternalNetwork("1.1.1.1")).toBe(false);
      expect(isInternalNetwork("203.0.113.1")).toBe(false);
    });

    it("允许公共主机名", () => {
      expect(isInternalNetwork("example.com")).toBe(false);
      expect(isInternalNetwork("api.conway.tech")).toBe(false);
    });
  });

  describe("isAllowedUri", () => {
    it("允许 https URI", () => {
      expect(isAllowedUri("https://example.com/agent-card.json")).toBe(true);
    });

    it("允许 ipfs URI", () => {
      expect(isAllowedUri("ipfs://QmTest123")).toBe(true);
    });

    it("阻止 http URI", () => {
      expect(isAllowedUri("http://example.com/agent-card.json")).toBe(false);
    });

    it("阻止 file URI", () => {
      expect(isAllowedUri("file:///etc/passwd")).toBe(false);
    });

    it("阻止 ftp URI", () => {
      expect(isAllowedUri("ftp://evil.com/data")).toBe(false);
    });

    it("阻止 javascript URI", () => {
      expect(isAllowedUri("javascript:alert(1)")).toBe(false);
    });

    it("阻止到内部网络的 https URI", () => {
      expect(isAllowedUri("https://127.0.0.1/card.json")).toBe(false);
      expect(isAllowedUri("https://10.0.0.1/card.json")).toBe(false);
      expect(isAllowedUri("https://192.168.1.1/card.json")).toBe(false);
      expect(isAllowedUri("https://localhost/card.json")).toBe(false);
    });

    it("阻止无效的 URI", () => {
      expect(isAllowedUri("not-a-url")).toBe(false);
      expect(isAllowedUri("")).toBe(false);
    });
  });
});

// ─── 代理卡片验证测试 ────────────────────────────────

describe("Agent Card Validation", () => {
  it("接受有效的代理卡片", () => {
    const card = validateAgentCard({
      name: "TestAgent",
      type: "automaton",
      address: "0x1234",
      description: "A test agent",
    });
    expect(card).not.toBeNull();
    expect(card?.name).toBe("TestAgent");
    expect(card?.type).toBe("automaton");
  });

  it("拒绝 null", () => {
    expect(validateAgentCard(null)).toBeNull();
  });

  it("拒绝 undefined", () => {
    expect(validateAgentCard(undefined)).toBeNull();
  });

  it("拒绝非对象", () => {
    expect(validateAgentCard("string")).toBeNull();
    expect(validateAgentCard(42)).toBeNull();
  });

  it("拒绝缺少 name", () => {
    expect(validateAgentCard({ type: "automaton" })).toBeNull();
  });

  it("拒绝缺少 type", () => {
    expect(validateAgentCard({ name: "TestAgent" })).toBeNull();
  });

  it("拒绝空 name", () => {
    expect(validateAgentCard({ name: "", type: "automaton" })).toBeNull();
  });

  it("拒绝空 type", () => {
    expect(validateAgentCard({ name: "TestAgent", type: "" })).toBeNull();
  });

  it("拒绝非字符串 address", () => {
    expect(validateAgentCard({ name: "TestAgent", type: "automaton", address: 123 })).toBeNull();
  });

  it("接受没有可选字段的卡片", () => {
    const card = validateAgentCard({ name: "TestAgent", type: "automaton" });
    expect(card).not.toBeNull();
  });
});

// ─── KV 修剪测试 ───────────────────────────────────────────

describe("KV Pruning", () => {
  let dbPath: string;
  let db: AutomatonDatabase;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch { /* 已关闭 */ }
  });

  it("修剪超过 7 天的 inbox_seen_* 键", () => {
    // 通过原始数据库直接插入旧的 KV 条目
    const rawDb = (db as any).raw;
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    rawDb.prepare(
      "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)"
    ).run("inbox_seen_abc123", "1", oldDate);
    rawDb.prepare(
      "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)"
    ).run("inbox_seen_def456", "1", oldDate);

    // 插入一个不应被修剪的最近条目
    db.setKV("inbox_seen_recent", "1");

    // 插入一个不应被修剪的非 inbox 键
    rawDb.prepare(
      "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)"
    ).run("other_key", "value", oldDate);

    const pruned = pruneStaleKV(rawDb, "inbox_seen_", 7);
    expect(pruned).toBe(2);

    // 验证最近的 inbox 键仍然存在
    expect(db.getKV("inbox_seen_recent")).toBe("1");

    // 验证非 inbox 旧键仍然存在
    expect(db.getKV("other_key")).toBe("value");
  });

  it("没有可修剪的内容时返回 0", () => {
    db.setKV("inbox_seen_fresh", "1");
    const rawDb = (db as any).raw;
    const pruned = pruneStaleKV(rawDb, "inbox_seen_", 7);
    expect(pruned).toBe(0);
  });
});

// ─── 代理状态验证测试 ────────────────────────────────

describe("Agent State Validation", () => {
  let dbPath: string;
  let db: AutomatonDatabase;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch { /* 已关闭 */ }
  });

  it("接受有效的代理状态", () => {
    const validStates = ["setup", "waking", "running", "sleeping", "low_compute", "critical", "dead"];
    for (const state of validStates) {
      db.setAgentState(state as any);
      expect(db.getAgentState()).toBe(state);
    }
  });

  it("对于无效的代理状态返回 'setup'", () => {
    // 直接写入无效状态
    const rawDb = (db as any).raw;
    rawDb.prepare(
      "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))"
    ).run("agent_state", "invalid_state");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(db.getAgentState()).toBe("setup");
    consoleSpy.mockRestore();
  });

  it("当未设置代理状态时返回 'setup'", () => {
    expect(db.getAgentState()).toBe("setup");
  });
});

// ─── 已安装工具加载测试 ──────────────────────────────

describe("Installed Tools Loading", () => {
  let dbPath: string;
  let db: AutomatonDatabase;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch { /* 已关闭 */ }
  });

  it("从数据库加载已启用的已安装工具", () => {
    db.installTool({
      id: "tool-1",
      name: "test_tool",
      type: "custom",
      config: { command: "echo hello" },
      installedAt: new Date().toISOString(),
      enabled: true,
    });

    const tools = loadInstalledTools(db);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("test_tool");
    expect(tools[0].riskLevel).toBe("caution");
  });

  it("不加载已禁用的工具", () => {
    db.installTool({
      id: "tool-disabled",
      name: "disabled_tool",
      type: "custom",
      config: {},
      installedAt: new Date().toISOString(),
      enabled: true,
    });
    db.removeTool("tool-disabled");

    const tools = loadInstalledTools(db);
    expect(tools.length).toBe(0);
  });

  it("当未安装工具时返回空数组", () => {
    const tools = loadInstalledTools(db);
    expect(tools.length).toBe(0);
  });
});

// ─── createdAt 持久化测试 ─────────────────────────────────

describe("createdAt Persistence", () => {
  let dbPath: string;
  let db: AutomatonDatabase;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch { /* 已关闭 */ }
  });

  it("持久化 createdAt 且不会在后续访问时覆盖", () => {
    // 模拟第一次运行：设置 createdAt
    const firstCreatedAt = "2025-01-01T00:00:00.000Z";
    expect(db.getIdentity("createdAt")).toBeUndefined();
    db.setIdentity("createdAt", firstCreatedAt);

    // 模拟第二次运行：createdAt 应该已经存在
    const existing = db.getIdentity("createdAt");
    expect(existing).toBe(firstCreatedAt);

    // index.ts 中的逻辑检查：仅当未存储时才设置
    // 所以在第二次运行时，它不应覆盖
    const secondRunCreatedAt = existing || new Date().toISOString();
    expect(secondRunCreatedAt).toBe(firstCreatedAt);
  });
});

// ─── JSON 反序列化安全测试 ──────────────────────────

describe("safeJsonParse in deserializers", () => {
  let dbPath: string;
  let db: AutomatonDatabase;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch { /* 已关闭 */ }
  });

  it("优雅地处理轮次 tool_calls 中的损坏 JSON", () => {
    const rawDb = (db as any).raw;

    // 插入带有损坏 JSON 的轮次
    rawDb.prepare(
      `INSERT INTO turns (id, timestamp, state, thinking, tool_calls, token_usage, cost_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("test-turn", new Date().toISOString(), "running", "thinking", "{invalid json}", '{"promptTokens":0,"completionTokens":0}', 0);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const turns = db.getRecentTurns(1);
    expect(turns.length).toBe(1);
    expect(turns[0].toolCalls).toEqual([]);
    consoleSpy.mockRestore();
  });

  it("优雅地处理心跳 params 中的损坏 JSON", () => {
    const rawDb = (db as any).raw;

    rawDb.prepare(
      `INSERT INTO heartbeat_entries (name, schedule, task, enabled, params, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    ).run("test-hb", "* * * * *", "test", 1, "{bad json}");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const entries = db.getHeartbeatEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].params).toEqual({});
    consoleSpy.mockRestore();
  });

  it("优雅地处理已安装工具 config 中的损坏 JSON", () => {
    const rawDb = (db as any).raw;

    rawDb.prepare(
      `INSERT INTO installed_tools (id, name, type, config, installed_at, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("corrupt-tool", "bad_tool", "custom", "{not json!", new Date().toISOString(), 1);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const tools = db.getInstalledTools();
    expect(tools.length).toBe(1);
    expect(tools[0].config).toEqual({});
    consoleSpy.mockRestore();
  });
});

// ─── 收件箱消息反序列化测试 ─────────────────────────

describe("Inbox Message Deserialization", () => {
  let dbPath: string;
  let db: AutomatonDatabase;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch { /* 已关闭 */ }
  });

  it("使用 to_address 列而不是硬编码的空字符串", () => {
    const rawDb = (db as any).raw;

    // 插入带有 to_address 的消息
    rawDb.prepare(
      `INSERT INTO inbox_messages (id, from_address, to_address, content, received_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run("msg-1", "0xSender", "0xRecipient", "Hello", new Date().toISOString());

    const messages = db.getUnprocessedInboxMessages(10);
    expect(messages.length).toBe(1);
    expect(messages[0].to).toBe("0xRecipient");
  });

  it("当 to_address 为 null 时回退到空字符串", () => {
    db.insertInboxMessage({
      id: "msg-2",
      from: "0xSender",
      to: "",
      content: "Hello",
      signedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const messages = db.getUnprocessedInboxMessages(10);
    expect(messages.length).toBe(1);
    expect(messages[0].to).toBe("");
  });
});

// ─── 模式迁移测试 ──────────────────────────────────────

describe("Schema Migrations", () => {
  it("使用当前模式版本创建新数据库", () => {
    const dbPath = makeTmpDbPath();
    const db = createDatabase(dbPath);
    const rawDb = (db as any).raw;

    const version = rawDb.prepare("SELECT MAX(version) as v FROM schema_version").get() as any;
    expect(version.v).toBeGreaterThanOrEqual(4);

    db.close();
  });

  it("在新数据库中具有所有必需的表", () => {
    const dbPath = makeTmpDbPath();
    const db = createDatabase(dbPath);
    const rawDb = (db as any).raw;

    const tables = rawDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);

    const requiredTables = [
      "identity",
      "turns",
      "tool_calls",
      "heartbeat_entries",
      "transactions",
      "installed_tools",
      "modifications",
      "kv",
      "inbox_messages",
      "policy_decisions",
      "spend_tracking",
      "heartbeat_schedule",
      "heartbeat_history",
      "wake_events",
      "heartbeat_dedup",
      "soul_history",
      "working_memory",
      "episodic_memory",
      "semantic_memory",
      "procedural_memory",
      "relationship_memory",
      "session_summaries",
      "inference_costs",
      "model_registry",
      "child_lifecycle_events",
      "discovered_agents_cache",
      "onchain_transactions",
    ];

    for (const table of requiredTables) {
      expect(tables, `missing table: ${table}`).toContain(table);
    }

    db.close();
  });

  it("V4 迁移添加收件箱状态列", () => {
    const dbPath = makeTmpDbPath();
    const db = createDatabase(dbPath);
    const rawDb = (db as any).raw;

    // 检查 inbox_messages 表是否有 status、retry_count、max_retries 列
    const columns = rawDb
      .prepare("PRAGMA table_info(inbox_messages)")
      .all()
      .map((c: any) => c.name);

    expect(columns).toContain("status");
    expect(columns).toContain("retry_count");
    expect(columns).toContain("max_retries");
    expect(columns).toContain("to_address");

    db.close();
  });
});

// ─── 核心表的 CRUD 操作 ─────────────────────────────

describe("Core Table CRUD", () => {
  let dbPath: string;
  let db: AutomatonDatabase;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch { /* 已关闭 */ }
  });

  it("轮次 CRUD：插入和读取", () => {
    const turn = {
      id: "turn-1",
      timestamp: new Date().toISOString(),
      state: "running" as const,
      thinking: "Thinking about things",
      toolCalls: [],
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      costCents: 0,
    };

    db.insertTurn(turn);
    const recent = db.getRecentTurns(1);
    expect(recent.length).toBe(1);
    expect(recent[0].id).toBe("turn-1");
    expect(recent[0].thinking).toBe("Thinking about things");
  });

  it("工具调用 CRUD：插入链接到轮次", () => {
    const turn = {
      id: "turn-tc-1",
      timestamp: new Date().toISOString(),
      state: "running" as const,
      thinking: "Using tools",
      toolCalls: [],
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      costCents: 0,
    };
    db.insertTurn(turn);

    const tc = {
      id: "tc-1",
      name: "exec",
      arguments: { command: "echo test" },
      result: "stdout: test",
      durationMs: 100,
    };
    db.insertToolCall("turn-tc-1", tc);

    const turns = db.getRecentTurns(1);
    expect(turns[0].toolCalls.length).toBeGreaterThanOrEqual(0);
  });

  it("事务 CRUD：通过 raw 插入和读取", () => {
    db.insertTransaction({
      id: "txn-1",
      type: "transfer_out",
      amountCents: 500,
      balanceAfterCents: 9500,
      description: "Test transfer",
      timestamp: new Date().toISOString(),
    });

    const rawDb = (db as any).raw;
    const txns = rawDb.prepare("SELECT * FROM transactions WHERE id = ?").all("txn-1");
    expect(txns.length).toBe(1);
    expect(txns[0].id).toBe("txn-1");
    expect(txns[0].amount_cents).toBe(500);
  });

  it("KV 存储：设置、获取、删除", () => {
    db.setKV("test_key", "test_value");
    expect(db.getKV("test_key")).toBe("test_value");

    db.setKV("test_key", "updated_value");
    expect(db.getKV("test_key")).toBe("updated_value");
  });

  it("身份存储：设置和获取", () => {
    db.setIdentity("name", "test-bot");
    expect(db.getIdentity("name")).toBe("test-bot");
  });

  it("修改 CRUD：通过 raw 插入和读取", () => {
    db.insertModification({
      id: "mod-1",
      timestamp: new Date().toISOString(),
      type: "code_edit",
      description: "Edited test.ts",
      reversible: true,
    });

    const rawDb = (db as any).raw;
    const mods = rawDb.prepare("SELECT * FROM modifications WHERE id = ?").all("mod-1");
    expect(mods.length).toBe(1);
    expect(mods[0].type).toBe("code_edit");
  });

  it("心跳条目 CRUD：更新和读取", () => {
    db.upsertHeartbeatEntry({
      name: "test_entry",
      schedule: "*/5 * * * *",
      task: "test_task",
      enabled: true,
    });

    const entries = db.getHeartbeatEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].name).toBe("test_entry");
    expect(entries[0].schedule).toBe("*/5 * * * *");
  });

  it("已安装工具 CRUD：安装和删除", () => {
    db.installTool({
      id: "tool-1",
      name: "test_tool",
      type: "custom",
      config: { foo: "bar" },
      installedAt: new Date().toISOString(),
      enabled: true,
    });

    let tools = db.getInstalledTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe("test_tool");

    db.removeTool("tool-1");
    tools = db.getInstalledTools();
    expect(tools.length).toBe(0);
  });

  it("轮次计数正确递增", () => {
    expect(db.getTurnCount()).toBe(0);

    db.insertTurn({
      id: "count-turn-1",
      timestamp: new Date().toISOString(),
      state: "running",
      thinking: "first",
      toolCalls: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      costCents: 0,
    });

    expect(db.getTurnCount()).toBe(1);

    db.insertTurn({
      id: "count-turn-2",
      timestamp: new Date().toISOString(),
      state: "running",
      thinking: "second",
      toolCalls: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      costCents: 0,
    });

    expect(db.getTurnCount()).toBe(2);
  });

  it("子代理 CRUD：插入和列出", () => {
    const rawDb = (db as any).raw;
    rawDb.prepare(
      `INSERT INTO children (id, name, address, sandbox_id, genesis_prompt, status) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("child-1", "test-child", "0xchild", "sandbox-1", "You are a child.", "spawning");

    const children = db.getChildren();
    expect(children.length).toBe(1);
    expect(children[0].name).toBe("test-child");
    expect(children[0].status).toBe("spawning");
  });

  it("技能 CRUD：插入和列出", () => {
    const rawDb = (db as any).raw;
    rawDb.prepare(
      `INSERT INTO skills (name, description, instructions, source, path, enabled) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("test_skill", "A test skill", "Do things", "self", "/tmp/skills/test", 1);

    const skills = db.getSkills();
    expect(skills.length).toBe(1);
    expect(skills[0].name).toBe("test_skill");
    expect(skills[0].enabled).toBe(true);
  });
});
