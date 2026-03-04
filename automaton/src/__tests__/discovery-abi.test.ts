/**
 * 发现 ABI 和枚举测试
 *
 * 测试：
 * 1. IDENTITY_ABI 使用 tokenURI（而不是 agentURI）
 * 2. queryAgent 调用 tokenURI 并优雅地处理 ownerOf 回退
 * 3. getTotalAgents 在 totalSupply 回退时返回 0
 * 4. getRegisteredAgentsByEvents 作为回退扫描 Transfer 事件
 * 5. discoverAgents 在 totalSupply 返回 0 时使用事件回退
 * 6. discoverAgents 在 totalSupply 工作时使用顺序迭代
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// 在导入 erc8004 之前模拟 viem
const mockReadContract = vi.fn();
const mockGetBlockNumber = vi.fn();
const mockGetLogs = vi.fn();

vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: mockReadContract,
      getBlockNumber: mockGetBlockNumber,
      getLogs: mockGetLogs,
    })),
    createWalletClient: vi.fn(() => ({
      writeContract: vi.fn(),
    })),
  };
});

// 模拟 logger 以抑制输出
vi.mock("../observability/logger.js", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  queryAgent,
  getTotalAgents,
  getRegisteredAgentsByEvents,
} from "../registry/erc8004.js";
import { discoverAgents } from "../registry/discovery.js";

// ─── ABI 验证 ───────────────────────────────────────────

describe("IDENTITY_ABI correctness", () => {
  it("在 ABI 中使用 tokenURI 而不是 agentURI", async () => {
    // 通过调用 queryAgent 来验证——它应该使用 functionName: "tokenURI" 调用 readContract
    mockReadContract.mockImplementation(async (params: any) => {
      if (params.functionName === "tokenURI") return "https://example.com/agent.json";
      if (params.functionName === "ownerOf") return "0x1234567890abcdef1234567890abcdef12345678";
      throw new Error(`Unexpected function: ${params.functionName}`);
    });

    const agent = await queryAgent("1");
    expect(agent).not.toBeNull();
    expect(agent!.agentURI).toBe("https://example.com/agent.json");

    // 验证调用了 tokenURI（而不是 agentURI）
    const tokenURICall = mockReadContract.mock.calls.find(
      (call: any) => call[0]?.functionName === "tokenURI",
    );
    expect(tokenURICall).toBeDefined();

    // 验证没有调用 agentURI
    const agentURICall = mockReadContract.mock.calls.find(
      (call: any) => call[0]?.functionName === "agentURI",
    );
    expect(agentURICall).toBeUndefined();
  });
});

// ─── queryAgent 测试 ───────────────────────────────────────────

describe("queryAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("当两者都成功时返回带有 URI 和所有者的代理", async () => {
    mockReadContract.mockImplementation(async (params: any) => {
      if (params.functionName === "tokenURI") return "https://example.com/card.json";
      if (params.functionName === "ownerOf") return "0xOwnerAddress";
      throw new Error(`Unexpected: ${params.functionName}`);
    });

    const agent = await queryAgent("42");
    expect(agent).toEqual({
      agentId: "42",
      owner: "0xOwnerAddress",
      agentURI: "https://example.com/card.json",
    });
  });

  it("当 ownerOf 回退时返回带有空所有者的代理", async () => {
    mockReadContract.mockImplementation(async (params: any) => {
      if (params.functionName === "tokenURI") return "https://example.com/card.json";
      if (params.functionName === "ownerOf") throw new Error("execution reverted");
      throw new Error(`Unexpected: ${params.functionName}`);
    });

    const agent = await queryAgent("42");
    expect(agent).not.toBeNull();
    expect(agent!.agentId).toBe("42");
    expect(agent!.agentURI).toBe("https://example.com/card.json");
    expect(agent!.owner).toBe("");
  });

  it("当 tokenURI 回退时返回 null", async () => {
    mockReadContract.mockImplementation(async () => {
      throw new Error("execution reverted");
    });

    const agent = await queryAgent("999");
    expect(agent).toBeNull();
  });
});

// ─── getTotalAgents 测试 ───────────────────────────────────────

describe("getTotalAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("当 totalSupply 成功时返回计数", async () => {
    mockReadContract.mockResolvedValue(BigInt(100));
    const total = await getTotalAgents();
    expect(total).toBe(100);
  });

  it("当 totalSupply 回退时返回 0", async () => {
    mockReadContract.mockRejectedValue(new Error("execution reverted"));
    const total = await getTotalAgents();
    expect(total).toBe(0);
  });
});

// ─── getRegisteredAgentsByEvents 测试 ──────────────────────────

describe("getRegisteredAgentsByEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("从 Transfer 事件返回代理", async () => {
    mockGetBlockNumber.mockResolvedValue(1_000_000n);
    mockGetLogs.mockResolvedValue([
      {
        args: {
          from: "0x0000000000000000000000000000000000000000",
          to: "0xOwner1",
          tokenId: 18788n,
        },
      },
      {
        args: {
          from: "0x0000000000000000000000000000000000000000",
          to: "0xOwner2",
          tokenId: 18791n,
        },
      },
    ]);

    const agents = await getRegisteredAgentsByEvents();
    // 最新的在前（反转）
    expect(agents).toHaveLength(2);
    expect(agents[0]).toEqual({ tokenId: "18791", owner: "0xOwner2" });
    expect(agents[1]).toEqual({ tokenId: "18788", owner: "0xOwner1" });
  });

  it("尊重 limit 参数", async () => {
    mockGetBlockNumber.mockResolvedValue(1_000_000n);
    mockGetLogs.mockResolvedValue([
      { args: { from: "0x0000000000000000000000000000000000000000", to: "0xA", tokenId: 1n } },
      { args: { from: "0x0000000000000000000000000000000000000000", to: "0xB", tokenId: 2n } },
      { args: { from: "0x0000000000000000000000000000000000000000", to: "0xC", tokenId: 3n } },
    ]);

    const agents = await getRegisteredAgentsByEvents("mainnet", 2);
    expect(agents).toHaveLength(2);
  });

  it("当事件扫描失败时返回空数组", async () => {
    mockGetBlockNumber.mockRejectedValue(new Error("RPC error"));

    const agents = await getRegisteredAgentsByEvents();
    expect(agents).toEqual([]);
  });
});

// ─── discoverAgents 集成测试 ───────────────────────────────────

describe("discoverAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("当 totalSupply 返回 > 0 时使用顺序迭代", async () => {
    // 第一次调用：totalSupply 返回 3
    // 后续调用：每个代理的 tokenURI 和 ownerOf
    let callCount = 0;
    mockReadContract.mockImplementation(async (params: any) => {
      if (params.functionName === "totalSupply") return BigInt(3);
      if (params.functionName === "tokenURI") return `https://example.com/agent${callCount++}.json`;
      if (params.functionName === "ownerOf") return "0xOwner";
      throw new Error(`Unexpected: ${params.functionName}`);
    });

    const agents = await discoverAgents(10);
    // 应该通过顺序迭代找到代理（3、2、1）
    expect(agents.length).toBeGreaterThan(0);
    // 应该调用了 totalSupply
    const totalSupplyCall = mockReadContract.mock.calls.find(
      (call: any) => call[0]?.functionName === "totalSupply",
    );
    expect(totalSupplyCall).toBeDefined();
    // 不应该调用 getLogs（不需要事件回退）
    expect(mockGetLogs).not.toHaveBeenCalled();
  });

  it("当 totalSupply 返回 0 时回退到事件扫描", async () => {
    // totalSupply 回退 → getTotalAgents 返回 0
    // 然后事件扫描开始
    mockReadContract.mockImplementation(async (params: any) => {
      if (params.functionName === "totalSupply") throw new Error("execution reverted");
      if (params.functionName === "tokenURI") return "https://example.com/agent.json";
      if (params.functionName === "ownerOf") throw new Error("execution reverted");
      throw new Error(`Unexpected: ${params.functionName}`);
    });

    mockGetBlockNumber.mockResolvedValue(1_000_000n);
    mockGetLogs.mockResolvedValue([
      {
        args: {
          from: "0x0000000000000000000000000000000000000000",
          to: "0xEventOwner",
          tokenId: 18788n,
        },
      },
    ]);

    const agents = await discoverAgents(10);
    expect(agents).toHaveLength(1);
    expect(agents[0].agentId).toBe("18788");
    // 当 ownerOf 回退且 queryAgent 返回空所有者时，所有者来自事件
    expect(agents[0].owner).toBe("0xEventOwner");
    expect(agents[0].agentURI).toBe("https://example.com/agent.json");
    // 应该调用了 getLogs（事件回退）
    expect(mockGetLogs).toHaveBeenCalled();
  });

  it("当 totalSupply 和事件都失败时返回空", async () => {
    mockReadContract.mockRejectedValue(new Error("execution reverted"));
    mockGetBlockNumber.mockRejectedValue(new Error("RPC error"));

    const agents = await discoverAgents(10);
    expect(agents).toEqual([]);
  });
});
