/**
 * 社交与注册表加固测试（阶段 3.2）
 *
 * 测试签名、验证、社交客户端、代理卡片、
 * ERC-8004 修复、发现缓存和模式迁移。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { MIGRATION_V7 } from "../state/schema.js";

// ─── 测试辅助函数 ───────────────────────────────────────────────

function createTestDb(): import("better-sqlite3").Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // 创建测试所需的基础表
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS heartbeat_dedup (
      dedup_key TEXT PRIMARY KEY,
      task_name TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_dedup_expires ON heartbeat_dedup(expires_at);
  `);

  // 应用 V7 迁移（阶段 3 表）
  db.exec(MIGRATION_V7);
  db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(7);

  return db;
}

// ─── 1. 签名测试 ───────────────────────────────────────────

describe("Signing", () => {
  it("signSendPayload 生成带有有效签名的载荷", async () => {
    const { privateKeyToAccount } = await import("viem/accounts");
    const { signSendPayload } = await import("../social/signing.js");

    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const payload = await signSendPayload(
      account,
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "Hello, world!",
    );

    expect(payload.from).toBe(account.address.toLowerCase());
    expect(payload.to).toBe("0x70997970c51812dc3a010c7d01b50e0d17dc79c8");
    expect(payload.content).toBe("Hello, world!");
    expect(payload.signature).toBeTruthy();
    expect(payload.signature).toMatch(/^0x/);
    expect(payload.signed_at).toBeTruthy();
  });

  it("signSendPayload 强制执行内容大小限制", async () => {
    const { privateKeyToAccount } = await import("viem/accounts");
    const { signSendPayload } = await import("../social/signing.js");

    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const longContent = "x".repeat(65_000);
    await expect(
      signSendPayload(account, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", longContent),
    ).rejects.toThrow("Message content too long");
  });

  it("signPollPayload 生成有效载荷", async () => {
    const { privateKeyToAccount } = await import("viem/accounts");
    const { signPollPayload } = await import("../social/signing.js");

    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const result = await signPollPayload(account);

    expect(result.address).toBe(account.address.toLowerCase());
    expect(result.signature).toMatch(/^0x/);
    expect(result.timestamp).toBeTruthy();
  });

  it("signSendPayload 规范格式匹配运行时和 CLI 期望", async () => {
    const { privateKeyToAccount } = await import("viem/accounts");
    const { keccak256, toBytes, verifyMessage } = await import("viem");
    const { signSendPayload } = await import("../social/signing.js");

    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const to = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const content = "Test message";
    const payload = await signSendPayload(account, to, content);

    // 重建规范格式并验证
    const contentHash = keccak256(toBytes(content));
    const canonical = `Conway:send:${to.toLowerCase()}:${contentHash}:${payload.signed_at}`;

    const valid = await verifyMessage({
      address: account.address,
      message: canonical,
      signature: payload.signature as `0x${string}`,
    });

    expect(valid).toBe(true);
  });
});

// ─── 2. 消息验证测试 ────────────────────────────────

describe("Message Validation", () => {
  it("有效消息通过验证", async () => {
    const { validateMessage } = await import("../social/validation.js");

    const result = validateMessage({
      from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      content: "Hello!",
      signed_at: new Date().toISOString(),
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("超出总大小限制的消息失败", async () => {
    const { validateMessage } = await import("../social/validation.js");

    const result = validateMessage({
      from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      content: "x".repeat(129_000),
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("total size limit"))).toBe(true);
  });

  it("超出内容大小限制的内容失败", async () => {
    const { validateMessage } = await import("../social/validation.js");

    const result = validateMessage({
      from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      content: "x".repeat(65_000),
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Content exceeds size limit"))).toBe(true);
  });

  it("过旧的消息（>5 分钟）未通过重放检查", async () => {
    const { validateMessage } = await import("../social/validation.js");

    const oldTimestamp = new Date(Date.now() - 6 * 60_000).toISOString();
    const result = validateMessage({
      from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      content: "Hello!",
      signed_at: oldTimestamp,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("too old"))).toBe(true);
  });

  it("来自未来的消息失败", async () => {
    const { validateMessage } = await import("../social/validation.js");

    const futureTimestamp = new Date(Date.now() + 2 * 60_000).toISOString();
    const result = validateMessage({
      from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      content: "Hello!",
      signed_at: futureTimestamp,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("future"))).toBe(true);
  });

  it("无效的时间戳字符串被拒绝", async () => {
    const { validateMessage } = await import("../social/validation.js");

    const result = validateMessage({
      from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      content: "Hello!",
      signed_at: "not-a-valid-date",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid timestamp"))).toBe(true);
  });

  it("无效的发送地址失败", async () => {
    const { validateMessage } = await import("../social/validation.js");

    const result = validateMessage({
      from: "not-an-address",
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      content: "Hello!",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid sender address"))).toBe(true);
  });

  it("无效的接收地址失败", async () => {
    const { validateMessage } = await import("../social/validation.js");

    const result = validateMessage({
      from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      to: "bad",
      content: "Hello!",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid recipient address"))).toBe(true);
  });
});

// ─── 3. 中继 URL 验证测试 ──────────────────────────────

describe("Relay URL Validation", () => {
  it("接受 HTTPS URL", async () => {
    const { validateRelayUrl } = await import("../social/validation.js");
    expect(() => validateRelayUrl("https://social.conway.tech")).not.toThrow();
  });

  it("拒绝 HTTP URL", async () => {
    const { validateRelayUrl } = await import("../social/validation.js");
    expect(() => validateRelayUrl("http://social.conway.tech")).toThrow(
      "Relay URL must use HTTPS",
    );
  });

  it("拒绝非 URL", async () => {
    const { validateRelayUrl } = await import("../social/validation.js");
    expect(() => validateRelayUrl("not a url")).toThrow("Invalid relay URL");
  });
});

// ─── 4. 社交客户端测试 ────────────────────────────────────

describe("Social Client", () => {
  it("createSocialClient 在 HTTP 中继 URL 时抛出异常", async () => {
    const { createSocialClient } = await import("../social/client.js");
    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    expect(() => createSocialClient("http://relay.example.com", account)).toThrow(
      "Relay URL must use HTTPS",
    );
  });

  it("send() 调用签名模块并验证消息", async () => {
    const { createSocialClient } = await import("../social/client.js");
    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    // 模拟 fetch 以捕获请求体
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "msg-123" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = createSocialClient("https://relay.example.com", account);
    const result = await client.send(
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "Test message",
    );

    expect(result.id).toBe("msg-123");
    // 验证请求是否带有签名
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs?.[1]?.body as string);
    expect(body.signature).toBeTruthy();
    expect(body.signed_at).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it("unreadCount() 在 HTTP 错误时抛出异常（而非返回 0）", async () => {
    const { createSocialClient } = await import("../social/client.js");
    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({ error: "server error" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = createSocialClient("https://relay.example.com", account);
    await expect(client.unreadCount()).rejects.toThrow("Unread count failed");

    vi.unstubAllGlobals();
  });

  it("速率限制：一小时内第 101 条消息被拒绝", async () => {
    const { createSocialClient } = await import("../social/client.js");
    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "msg-xxx" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = createSocialClient("https://relay.example.com", account);

    // 成功发送 100 条消息
    for (let i = 0; i < 100; i++) {
      await client.send(
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        `message ${i}`,
      );
    }

    // 第 101 条应该被拒绝
    await expect(
      client.send("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "message 100"),
    ).rejects.toThrow("Rate limit exceeded");

    vi.unstubAllGlobals();
  });

  it("速率限制：失败的发送计入每小时限制", async () => {
    const { createSocialClient } = await import("../social/client.js");
    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    // 服务器对每个请求返回 500
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.resolve({ error: "server error" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = createSocialClient("https://relay.example.com", account);

    // 发送 100 条全部失败（500 错误）的消息
    for (let i = 0; i < 100; i++) {
      await client
        .send("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", `msg ${i}`)
        .catch(() => {}); // 忽略发送失败
    }

    // 即使之前所有发送都失败，第 101 条仍应被速率限制
    await expect(
      client.send("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "msg 100"),
    ).rejects.toThrow("Rate limit exceeded");

    vi.unstubAllGlobals();
  });
});

// ─── 5. 代理卡片测试 ────────────────────────────────────────

describe("Agent Card", () => {
  it("generateAgentCard 不包含沙箱 ID", async () => {
    const { generateAgentCard } = await import("../registry/agent-card.js");

    const identity = {
      name: "test-agent",
      address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      account: {} as any,
      creatorAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`,
      sandboxId: "sandbox-123",
      apiKey: "key-123",
      createdAt: new Date().toISOString(),
    };

    const config = {
      name: "TestBot",
      conwayApiUrl: "https://api.conway.tech",
      creatorAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`,
    } as any;

    const db = {
      getChildren: () => [],
      getSkills: () => [],
    } as any;

    const card = generateAgentCard(identity, config, db);
    const cardStr = JSON.stringify(card);

    expect(cardStr).not.toContain("sandbox-123");
  });

  it("generateAgentCard 不包含 Conway API URL", async () => {
    const { generateAgentCard } = await import("../registry/agent-card.js");

    const identity = {
      name: "test-agent",
      address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      account: {} as any,
      creatorAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`,
      sandboxId: "sandbox-123",
      apiKey: "key-123",
      createdAt: new Date().toISOString(),
    };

    const config = {
      name: "TestBot",
      conwayApiUrl: "https://api.conway.tech",
      creatorAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`,
    } as any;

    const db = {
      getChildren: () => [],
      getSkills: () => [],
    } as any;

    const card = generateAgentCard(identity, config, db);
    const cardStr = JSON.stringify(card);

    expect(cardStr).not.toContain("api.conway.tech");
  });

  it("generateAgentCard 不包含创建者地址", async () => {
    const { generateAgentCard } = await import("../registry/agent-card.js");

    const identity = {
      name: "test-agent",
      address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`,
      account: {} as any,
      creatorAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`,
      sandboxId: "sandbox-123",
      apiKey: "key-123",
      createdAt: new Date().toISOString(),
    };

    const config = {
      name: "TestBot",
      conwayApiUrl: "https://api.conway.tech",
      creatorAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`,
    } as any;

    const db = {
      getChildren: () => [],
      getSkills: () => [],
    } as any;

    const card = generateAgentCard(identity, config, db);
    const cardStr = JSON.stringify(card);

    expect(cardStr).not.toContain("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  });

  it("hostAgentCard 将卡片写入单独的 JSON 文件", async () => {
    const { hostAgentCard } = await import("../registry/agent-card.js");

    const writtenFiles: Record<string, string> = {};
    const mockConway = {
      writeFile: vi.fn(async (path: string, content: string) => {
        writtenFiles[path] = content;
      }),
      exec: vi.fn(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
      exposePort: vi.fn(async () => ({ port: 8004, publicUrl: "https://test.example.com", sandboxId: "sb-1" })),
    } as any;

    const card = {
      type: "test",
      name: "TestBot",
      description: "Test",
      services: [],
      x402Support: true,
      active: true,
    };

    await hostAgentCard(card, mockConway);

    // 卡片应写入单独的 JSON 文件
    expect(writtenFiles["/tmp/agent-card.json"]).toBeTruthy();
    const writtenCard = JSON.parse(writtenFiles["/tmp/agent-card.json"]!);
    expect(writtenCard.name).toBe("TestBot");

    // 服务器脚本不应包含插值的卡片 JSON
    const serverScript = writtenFiles["/tmp/agent-card-server.js"]!;
    expect(serverScript).not.toContain('"TestBot"');
    expect(serverScript).toContain("fs.readFileSync");
  });
});

// ─── 6. ERC-8004 测试 ─────────────────────────────────────────

describe("ERC-8004", () => {
  it("leaveFeedback 拒绝分数 0", async () => {
    const { leaveFeedback } = await import("../registry/erc8004.js");
    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const mockDb = { raw: createTestDb() } as any;

    await expect(
      leaveFeedback(account, "1", 0, "bad", "testnet", mockDb),
    ).rejects.toThrow("Invalid score: 0");
  });

  it("leaveFeedback 拒绝分数 6", async () => {
    const { leaveFeedback } = await import("../registry/erc8004.js");
    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const mockDb = { raw: createTestDb() } as any;

    await expect(
      leaveFeedback(account, "1", 6, "too high", "testnet", mockDb),
    ).rejects.toThrow("Invalid score: 6");
  });

  it("leaveFeedback 拒绝超过 500 字符的评论", async () => {
    const { leaveFeedback } = await import("../registry/erc8004.js");
    const { privateKeyToAccount } = await import("viem/accounts");
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const mockDb = { raw: createTestDb() } as any;
    const longComment = "x".repeat(501);

    await expect(
      leaveFeedback(account, "1", 3, longComment, "testnet", mockDb),
    ).rejects.toThrow("Comment too long");
  });
});

// ─── 7. 发现测试 ────────────────────────────────────────

describe("Discovery", () => {
  it("validateAgentCard 拒绝缺少名称的卡片", async () => {
    const { validateAgentCard } = await import("../registry/discovery.js");

    const result = validateAgentCard({ type: "test" });
    expect(result).toBeNull();
  });

  it("validateAgentCard 拒绝名称过大的卡片", async () => {
    const { validateAgentCard } = await import("../registry/discovery.js");

    const result = validateAgentCard({
      name: "x".repeat(200),
      type: "test",
    });
    expect(result).toBeNull();
  });

  it("validateAgentCard 拒绝描述过大的卡片", async () => {
    const { validateAgentCard } = await import("../registry/discovery.js");

    const result = validateAgentCard({
      name: "TestAgent",
      type: "test",
      description: "x".repeat(2100),
    });
    expect(result).toBeNull();
  });

  it("validateAgentCard 接受有效卡片", async () => {
    const { validateAgentCard } = await import("../registry/discovery.js");

    const result = validateAgentCard({
      name: "TestAgent",
      type: "test",
      description: "A test agent",
      services: [{ name: "wallet", endpoint: "eip155:8453:0x123" }],
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("TestAgent");
  });

  it("isAllowedUri 阻止 HTTP", async () => {
    const { isAllowedUri } = await import("../registry/discovery.js");
    expect(isAllowedUri("http://example.com/card.json")).toBe(false);
  });

  it("isAllowedUri 允许 HTTPS", async () => {
    const { isAllowedUri } = await import("../registry/discovery.js");
    expect(isAllowedUri("https://example.com/card.json")).toBe(true);
  });

  it("isAllowedUri 阻止 localhost", async () => {
    const { isAllowedUri } = await import("../registry/discovery.js");
    expect(isAllowedUri("https://localhost/card.json")).toBe(false);
  });
});

// ─── 8. 模式测试 ───────────────────────────────────────────

describe("Schema", () => {
  it("MIGRATION_V7 创建 discovered_agents_cache 表", () => {
    const db = createTestDb();

    // 表应该存在 - 尝试插入
    const stmt = db.prepare(
      `INSERT INTO discovered_agents_cache
       (agent_address, agent_card, fetched_from, card_hash, valid_until, fetch_count, last_fetched_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    expect(() =>
      stmt.run(
        "0xtest",
        '{"name":"test"}',
        "https://example.com",
        "0xhash",
        null,
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      ),
    ).not.toThrow();

    // 验证我们可以读回数据
    const row = db
      .prepare("SELECT * FROM discovered_agents_cache WHERE agent_address = ?")
      .get("0xtest") as any;
    expect(row).toBeTruthy();
    expect(row.agent_card).toBe('{"name":"test"}');

    db.close();
  });

  it("MIGRATION_V7 创建 onchain_transactions 表", () => {
    const db = createTestDb();

    const stmt = db.prepare(
      `INSERT INTO onchain_transactions (id, tx_hash, chain, operation, status, gas_used, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    expect(() =>
      stmt.run("id1", "0xhash", "eip155:8453", "register", "pending", null, "{}"),
    ).not.toThrow();

    const row = db
      .prepare("SELECT * FROM onchain_transactions WHERE tx_hash = ?")
      .get("0xhash") as any;
    expect(row).toBeTruthy();
    expect(row.operation).toBe("register");
    expect(row.status).toBe("pending");

    db.close();
  });

  it("MIGRATION_V7 创建 child_lifecycle_events 表", () => {
    const db = createTestDb();

    const stmt = db.prepare(
      `INSERT INTO child_lifecycle_events (id, child_id, from_state, to_state, reason, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    expect(() =>
      stmt.run("ev1", "child1", "requested", "sandbox_created", "test", "{}"),
    ).not.toThrow();

    db.close();
  });

  it("onchain_transactions 状态 CHECK 约束生效", () => {
    const db = createTestDb();

    const stmt = db.prepare(
      `INSERT INTO onchain_transactions (id, tx_hash, chain, operation, status)
       VALUES (?, ?, ?, ?, ?)`,
    );
    expect(() =>
      stmt.run("id2", "0xhash2", "eip155:8453", "register", "invalid_status"),
    ).toThrow();

    db.close();
  });
});

// ─── 9. 数据库辅助函数测试 ────────────────────────────────────────

describe("DB Helpers", () => {
  it("agentCacheUpsert 和 agentCacheGet 正常工作", async () => {
    const db = createTestDb();
    const { agentCacheUpsert, agentCacheGet } = await import("../state/database.js");

    agentCacheUpsert(db, {
      agentAddress: "0xtest",
      agentCard: '{"name":"TestAgent"}',
      fetchedFrom: "https://example.com/card",
      cardHash: "0xhash",
      validUntil: new Date(Date.now() + 3_600_000).toISOString(),
      fetchCount: 1,
      lastFetchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const row = agentCacheGet(db, "0xtest");
    expect(row).toBeTruthy();
    expect(row!.agentCard).toBe('{"name":"TestAgent"}');
    expect(row!.fetchCount).toBe(1);

    db.close();
  });

  it("agentCacheGetValid 仅返回有效条目", async () => {
    const db = createTestDb();
    const { agentCacheUpsert, agentCacheGetValid } = await import("../state/database.js");

    // 有效条目
    agentCacheUpsert(db, {
      agentAddress: "0xvalid",
      agentCard: '{"name":"Valid"}',
      fetchedFrom: "https://example.com",
      cardHash: "0x1",
      validUntil: new Date(Date.now() + 3_600_000).toISOString(),
      fetchCount: 1,
      lastFetchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    // 过期条目
    agentCacheUpsert(db, {
      agentAddress: "0xexpired",
      agentCard: '{"name":"Expired"}',
      fetchedFrom: "https://example.com",
      cardHash: "0x2",
      validUntil: "2020-01-01T00:00:00Z",
      fetchCount: 1,
      lastFetchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const valid = agentCacheGetValid(db);
    expect(valid.length).toBe(1);
    expect(valid[0]!.agentAddress).toBe("0xvalid");

    db.close();
  });

  it("agentCachePrune 删除过期条目", async () => {
    const db = createTestDb();
    const { agentCacheUpsert, agentCachePrune, agentCacheGet } = await import("../state/database.js");

    agentCacheUpsert(db, {
      agentAddress: "0xexpired",
      agentCard: '{"name":"Expired"}',
      fetchedFrom: "https://example.com",
      cardHash: "0x1",
      validUntil: "2020-01-01T00:00:00Z",
      fetchCount: 1,
      lastFetchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });

    const pruned = agentCachePrune(db);
    expect(pruned).toBe(1);
    expect(agentCacheGet(db, "0xexpired")).toBeUndefined();

    db.close();
  });

  it("onchainTxInsert 和 onchainTxGetByHash 正常工作", async () => {
    const db = createTestDb();
    const { onchainTxInsert, onchainTxGetByHash } = await import("../state/database.js");

    onchainTxInsert(db, {
      id: "tx1",
      txHash: "0xabc",
      chain: "eip155:8453",
      operation: "register",
      status: "pending",
      gasUsed: null,
      metadata: "{}",
      createdAt: new Date().toISOString(),
    });

    const row = onchainTxGetByHash(db, "0xabc");
    expect(row).toBeTruthy();
    expect(row!.operation).toBe("register");
    expect(row!.status).toBe("pending");

    db.close();
  });

  it("onchainTxGetAll 带状态过滤器正常工作", async () => {
    const db = createTestDb();
    const { onchainTxInsert, onchainTxGetAll } = await import("../state/database.js");

    onchainTxInsert(db, {
      id: "tx1",
      txHash: "0x1",
      chain: "eip155:8453",
      operation: "register",
      status: "pending",
      gasUsed: null,
      metadata: "{}",
      createdAt: new Date().toISOString(),
    });

    onchainTxInsert(db, {
      id: "tx2",
      txHash: "0x2",
      chain: "eip155:8453",
      operation: "feedback",
      status: "confirmed",
      gasUsed: 50000,
      metadata: "{}",
      createdAt: new Date().toISOString(),
    });

    const pending = onchainTxGetAll(db, { status: "pending" });
    expect(pending.length).toBe(1);

    const all = onchainTxGetAll(db);
    expect(all.length).toBe(2);

    db.close();
  });

  it("onchainTxUpdateStatus 正常工作", async () => {
    const db = createTestDb();
    const { onchainTxInsert, onchainTxUpdateStatus, onchainTxGetByHash } = await import("../state/database.js");

    onchainTxInsert(db, {
      id: "tx1",
      txHash: "0xupdate",
      chain: "eip155:8453",
      operation: "register",
      status: "pending",
      gasUsed: null,
      metadata: "{}",
      createdAt: new Date().toISOString(),
    });

    onchainTxUpdateStatus(db, "0xupdate", "confirmed", 75000);

    const row = onchainTxGetByHash(db, "0xupdate");
    expect(row!.status).toBe("confirmed");
    expect(row!.gasUsed).toBe(75000);

    db.close();
  });
});

// ─── 10. 协议测试 ─────────────────────────────────────────

describe("Protocol", () => {
  it("createMessageId 返回 ULID", async () => {
    const { createMessageId } = await import("../social/protocol.js");
    const id = createMessageId();
    expect(id).toBeTruthy();
    expect(id.length).toBe(26); // ULID 长度
  });

  it("createNonce 返回十六进制字符串", async () => {
    const { createNonce } = await import("../social/protocol.js");
    const nonce = createNonce();
    expect(nonce).toBeTruthy();
    expect(nonce).toMatch(/^[0-9a-f]+$/);
    expect(nonce.length).toBe(32); // 16 字节 = 32 个十六进制字符
  });

  it("verifyMessageSignature 验证正确的签名", async () => {
    const { privateKeyToAccount } = await import("viem/accounts");
    const { signSendPayload } = await import("../social/signing.js");
    const { verifyMessageSignature } = await import("../social/protocol.js");

    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const payload = await signSendPayload(
      account,
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "Test content",
    );

    const valid = await verifyMessageSignature(payload, account.address);
    expect(valid).toBe(true);
  });

  it("verifyMessageSignature 拒绝错误的签名者", async () => {
    const { privateKeyToAccount } = await import("viem/accounts");
    const { signSendPayload } = await import("../social/signing.js");
    const { verifyMessageSignature } = await import("../social/protocol.js");

    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const payload = await signSendPayload(
      account,
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "Test content",
    );

    // 不同的地址
    const valid = await verifyMessageSignature(
      payload,
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    );
    expect(valid).toBe(false);
  });
});

// ─── 11. 地址验证测试 ───────────────────────────────

describe("Address Validation", () => {
  it("isValidAddress 接受有效地址", async () => {
    const { isValidAddress } = await import("../social/validation.js");
    expect(isValidAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")).toBe(true);
  });

  it("isValidAddress 拒绝过短地址", async () => {
    const { isValidAddress } = await import("../social/validation.js");
    expect(isValidAddress("0x7099")).toBe(false);
  });

  it("isValidAddress 拒绝非十六进制", async () => {
    const { isValidAddress } = await import("../social/validation.js");
    expect(isValidAddress("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")).toBe(false);
  });

  it("isValidAddress 拒绝无前缀", async () => {
    const { isValidAddress } = await import("../social/validation.js");
    expect(isValidAddress("70997970C51812dc3A010C7d01b50e0d17dc79C8")).toBe(false);
  });
});
