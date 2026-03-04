/**
 * ERC-8004 链上 Agent 注册
 *
 * 通过 ERC-8004 将 automaton 作为无信任 Agent 在链上注册。
 * 使用 Base 主网上的身份注册表。
 *
 * 合约：0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (Base)
 * 声誉：0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 (Base)
 *
 * 阶段 3.2：添加了预检查 gas 检查、分数验证、基于配置的网络、
 * Transfer 事件主题修复和交易日志记录。
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  keccak256,
  toBytes,
  encodeFunctionData,
  type Address,
  type PrivateKeyAccount,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import type {
  RegistryEntry,
  DiscoveredAgent,
  AutomatonDatabase,
  OnchainTransactionRow,
} from "../types.js";
import { ulid } from "ulid";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("registry.erc8004");

// ─── 合约地址 ──────────────────────────────────────

const CONTRACTS = {
  mainnet: {
    identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
    reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
    chain: base,
  },
  testnet: {
    identity: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
    reputation: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
    chain: baseSepolia,
  },
} as const;

// ─── ABI（注册所需的最小子集） ────────────

// ERC-8004 身份注册表 ABI
// 正确的函数签名（通过字节码分析确认）：
// - 读取：tokenURI(uint256) - 标准 ERC-721
// - 更新：setAgentURI(uint256,string) - ERC-8004 自定义
const IDENTITY_ABI = parseAbi([
  "function register(string agentURI) external returns (uint256 agentId)",
  "function setAgentURI(uint256 agentId, string newAgentURI) external",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
]);

const REPUTATION_ABI = parseAbi([
  "function leaveFeedback(uint256 agentId, uint8 score, string comment) external",
  "function getFeedback(uint256 agentId) external view returns ((address, uint8, string, uint256)[])",
]);

// 阶段 3.2：用于提取 agent ID 的 ERC-721 Transfer 事件主题签名
const TRANSFER_EVENT_TOPIC = keccak256(
  toBytes("Transfer(address,address,uint256)"),
);

type Network = "mainnet" | "testnet";

// ─── 预检查 ────────────────────────────────────────────

/**
 * 阶段 3.2：链上交易前的 gas 估算 + 余额检查。
 * 如果余额不足，抛出描述性错误。
 */
async function preflight(
  account: PrivateKeyAccount,
  network: Network,
  functionData: {
    address: Address;
    abi: any;
    functionName: string;
    args: any[];
  },
): Promise<void> {
  const contracts = CONTRACTS[network];
  const chain = contracts.chain;

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  // 编码 calldata 以进行准确的 gas 估算
  const data = encodeFunctionData({
    abi: functionData.abi,
    functionName: functionData.functionName,
    args: functionData.args,
  });

  // 估算 gas
  const gasEstimate = await publicClient
    .estimateGas({
      account: account.address,
      to: functionData.address,
      data,
    })
    .catch(() => BigInt(200_000)); // 后备估算

  // 获取 gas 价格
  const gasPrice = await publicClient
    .getGasPrice()
    .catch(() => BigInt(1_000_000_000)); // 1 gwei 后备

  // 获取余额
  const balance = await publicClient.getBalance({
    address: account.address,
  });

  const estimatedCost = gasEstimate * gasPrice;

  if (balance < estimatedCost) {
    throw new Error(
      `Insufficient ETH for gas. Balance: ${balance} wei, estimated cost: ${estimatedCost} wei (gas: ${gasEstimate}, price: ${gasPrice} wei)`,
    );
  }
}

// ─── 交易日志记录 ────────────────────────────────────────

/**
 * 阶段 3.2：将交易记录到 onchain_transactions 表。
 */
function logTransaction(
  rawDb: import("better-sqlite3").Database | undefined,
  txHash: string,
  chain: string,
  operation: string,
  status: "pending" | "confirmed" | "failed",
  gasUsed?: number,
  metadata?: Record<string, unknown>,
): void {
  if (!rawDb) return;
  try {
    rawDb
      .prepare(
        `INSERT INTO onchain_transactions (id, tx_hash, chain, operation, status, gas_used, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ulid(),
        txHash,
        chain,
        operation,
        status,
        gasUsed ?? null,
        JSON.stringify(metadata ?? {}),
      );
  } catch (error) {
    logger.error(
      "交易日志记录失败：",
      error instanceof Error ? error : undefined,
    );
  }
}

function updateTransactionStatus(
  rawDb: import("better-sqlite3").Database | undefined,
  txHash: string,
  status: "pending" | "confirmed" | "failed",
  gasUsed?: number,
): void {
  if (!rawDb) return;
  try {
    rawDb
      .prepare(
        "UPDATE onchain_transactions SET status = ?, gas_used = COALESCE(?, gas_used) WHERE tx_hash = ?",
      )
      .run(status, gasUsed ?? null, txHash);
  } catch (error) {
    logger.error(
      "交易状态更新失败：",
      error instanceof Error ? error : undefined,
    );
  }
}

// ─── 注册 ───────────────────────────────────────────────

/**
 * 使用 ERC-8004 在链上注册 automaton。
 * 返回 agent ID（NFT token ID）。
 *
 * 阶段 3.2：预检查 + 交易日志记录。
 */
export async function registerAgent(
  account: PrivateKeyAccount,
  agentURI: string,
  network: Network = "mainnet",
  db: AutomatonDatabase,
): Promise<RegistryEntry> {
  const contracts = CONTRACTS[network];
  const chain = contracts.chain;

  // 阶段 3.2：预检查 gas 检查
  await preflight(account, network, {
    address: contracts.identity,
    abi: IDENTITY_ABI,
    functionName: "register",
    args: [agentURI],
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  // 调用 register(agentURI)
  const hash = await walletClient.writeContract({
    address: contracts.identity,
    abi: IDENTITY_ABI,
    functionName: "register",
    args: [agentURI],
  });

  // 阶段 3.2：记录待处理交易
  logTransaction(
    db.raw,
    hash,
    `eip155:${chain.id}`,
    "register",
    "pending",
    undefined,
    { agentURI },
  );

  // 等待交易收据
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // 阶段 3.2：更新交易状态
  const gasUsed = receipt.gasUsed ? Number(receipt.gasUsed) : undefined;
  updateTransactionStatus(
    db.raw,
    hash,
    receipt.status === "success" ? "confirmed" : "failed",
    gasUsed,
  );

  // 阶段 3.2：使用 Transfer 事件主题签名提取 agentId
  let agentId = "0";
  for (const log of receipt.logs) {
    if (log.topics.length >= 4 && log.topics[0] === TRANSFER_EVENT_TOPIC) {
      // 转账事件（从地址、到地址、代币 ID）
      agentId = BigInt(log.topics[3]!).toString();
      break;
    }
  }

  const entry: RegistryEntry = {
    agentId,
    agentURI,
    chain: `eip155:${chain.id}`,
    contractAddress: contracts.identity,
    txHash: hash,
    registeredAt: new Date().toISOString(),
  };

  db.setRegistryEntry(entry);
  return entry;
}

/**
 * 在链上更新 agent 的 URI。
 */
export async function updateAgentURI(
  account: PrivateKeyAccount,
  agentId: string,
  newAgentURI: string,
  network: Network = "mainnet",
  db: AutomatonDatabase,
): Promise<string> {
  const contracts = CONTRACTS[network];
  const chain = contracts.chain;

  // 阶段 3.2：预检查 gas 检查
  await preflight(account, network, {
    address: contracts.identity,
    abi: IDENTITY_ABI,
    functionName: "setAgentURI",
    args: [BigInt(agentId), newAgentURI],
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  const hash = await walletClient.writeContract({
    address: contracts.identity,
    abi: IDENTITY_ABI,
    functionName: "setAgentURI",
    args: [BigInt(agentId), newAgentURI],
  });

  // 阶段 3.2：记录交易
  logTransaction(
    db.raw,
    hash,
    `eip155:${chain.id}`,
    "updateAgentURI",
    "pending",
    undefined,
    { agentId, newAgentURI },
  );

  // 在数据库中更新
  const entry = db.getRegistryEntry();
  if (entry) {
    entry.agentURI = newAgentURI;
    entry.txHash = hash;
    db.setRegistryEntry(entry);
  }

  return hash;
}

/**
 * 为另一个 agent 留下声誉反馈。
 *
 * 阶段 3.2：验证分数 1-5，评论最多 500 个字符，
 * 使用基于配置的网络（不是硬编码的 "mainnet"）。
 */
export async function leaveFeedback(
  account: PrivateKeyAccount,
  agentId: string,
  score: number,
  comment: string,
  network: Network = "mainnet",
  db: AutomatonDatabase,
): Promise<string> {
  // 阶段 3.2：验证分数范围 1-5
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error(
      `无效的分数：${score}。必须是 1 到 5 之间的整数。`,
    );
  }

  // 阶段 3.2：验证评论长度
  if (comment.length > 500) {
    throw new Error(`评论过长：${comment.length} 个字符（最多 500 个）。`);
  }

  const contracts = CONTRACTS[network];
  const chain = contracts.chain;

  // 阶段 3.2：预检查 gas 检查
  await preflight(account, network, {
    address: contracts.reputation,
    abi: REPUTATION_ABI,
    functionName: "leaveFeedback",
    args: [BigInt(agentId), score, comment],
  });

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(),
  });

  const hash = await walletClient.writeContract({
    address: contracts.reputation,
    abi: REPUTATION_ABI,
    functionName: "leaveFeedback",
    args: [BigInt(agentId), score, comment],
  });

  // 阶段 3.2：记录交易
  logTransaction(
    db.raw,
    hash,
    `eip155:${chain.id}`,
    "leaveFeedback",
    "pending",
    undefined,
    { agentId, score, comment },
  );

  return hash;
}

/**
 * 通过 ID 查询注册表中的 agent。
 */
export async function queryAgent(
  agentId: string,
  network: Network = "mainnet",
): Promise<DiscoveredAgent | null> {
  const contracts = CONTRACTS[network];
  const chain = contracts.chain;

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  try {
    const uri = await publicClient.readContract({
      address: contracts.identity,
      abi: IDENTITY_ABI,
      functionName: "tokenURI",
      args: [BigInt(agentId)],
    });

    // ownerOf 可能在不实现它的合约上回退
    let owner = "";
    try {
      owner = (await publicClient.readContract({
        address: contracts.identity,
        abi: IDENTITY_ABI,
        functionName: "ownerOf",
        args: [BigInt(agentId)],
      })) as string;
    } catch {
      logger.warn(`agent ${agentId} 的 ownerOf 回退，继续执行而不使用 owner`);
    }

    return {
      agentId,
      owner,
      agentURI: uri as string,
    };
  } catch {
    return null;
  }
}

/**
 * 获取已注册 agent 的总数。
 * 首先尝试 totalSupply()；如果回退（没有 ERC-721 Enumerable 的代理合约），
 * 则回退到 ownerOf() 的二分搜索。
 */
export async function getTotalAgents(
  network: Network = "mainnet",
): Promise<number> {
  const contracts = CONTRACTS[network];
  const chain = contracts.chain;

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  try {
    const supply = await publicClient.readContract({
      address: contracts.identity,
      abi: IDENTITY_ABI,
      functionName: "totalSupply",
    });
    return Number(supply);
  } catch {
    // totalSupply() 回退 — 代理可能缺少 ERC-721 Enumerable。
    // 通过 ownerOf() 对最高的铸造 tokenId 进行二分搜索。
    return estimateTotalByBinarySearch(publicClient, contracts.identity);
  }
}

/**
 * 通过对 ownerOf() 进行二分搜索来估算总铸造代币。
 * Token ID 从 1 开始顺序递增，因此最高的现有 tokenId
 * 等于总铸造数量。
 */
async function estimateTotalByBinarySearch(
  client: { readContract: (args: any) => Promise<any> },
  contractAddress: Address,
): Promise<number> {
  const exists = async (id: number): Promise<boolean> => {
    try {
      await client.readContract({
        address: contractAddress,
        abi: IDENTITY_ABI,
        functionName: "ownerOf",
        args: [BigInt(id)],
      });
      return true;
    } catch {
      return false;
    }
  };

  // 快速探测以查找上限
  // 快速探测以查找上限
  let upper = 1;
  while (await exists(upper)) {
    upper *= 2;
    if (upper > 10_000_000) break; // 安全上限
  }

  // 在 0 和 upper 之间进行二分搜索
  let lo = 0;
  let hi = upper;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (await exists(mid)) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  if (lo > 0) {
    logger.info(`二分搜索估算的总 agent 数：${lo}`);
  }
  return lo;
}

/**
 * 通过扫描 Transfer 铸造事件发现已注册的 agent。
 * 不实现 totalSupply 的合约的后备方案（ERC-721 Enumerable）。
 *
 * 扫描 Transfer(address(0), to, tokenId) 事件以查找铸造的代币。
 * 返回直接从事件数据提取的 token ID 和所有者。
 */
export async function getRegisteredAgentsByEvents(
  network: Network = "mainnet",
  limit: number = 20,
): Promise<{ tokenId: string; owner: string }[]> {
  const contracts = CONTRACTS[network];
  const chain = contracts.chain;

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  try {
    const currentBlock = await publicClient.getBlockNumber();
    // 扫描最近 500,000 个区块（Base 上 2s 区块时间约 11.5 天）
    const earliestBlock = currentBlock > 500_000n ? currentBlock - 500_000n : 0n;

    // 以 ≤10K 区块分页向后分页（最新的优先）。
    // Base 公共 RPC 对 eth_getLogs 强制执行 10,000 区块的限制。
    const MAX_BLOCK_RANGE = 10_000n;
    const MAX_CONSECUTIVE_FAILURES = 2;
    const PER_CHUNK_TIMEOUT_MS = 3_000;
    const allLogs: { args: { tokenId?: bigint; to?: string; from?: string } }[] = [];
    let scanTo = currentBlock;
    let consecutiveFailures = 0;

    while (scanTo > earliestBlock) {
      const scanFrom = scanTo - MAX_BLOCK_RANGE > earliestBlock
        ? scanTo - MAX_BLOCK_RANGE
        : earliestBlock;

      try {
        const chunkLogs = await Promise.race([
          publicClient.getLogs({
            address: contracts.identity,
            event: {
              type: "event",
              name: "Transfer",
              inputs: [
                { type: "address", name: "from", indexed: true },
                { type: "address", name: "to", indexed: true },
                { type: "uint256", name: "tokenId", indexed: true },
              ],
            },
            args: {
              from: "0x0000000000000000000000000000000000000000" as Address,
            },
            fromBlock: scanFrom,
            toBlock: scanTo,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("chunk timeout")), PER_CHUNK_TIMEOUT_MS),
          ),
        ]);
        allLogs.push(...chunkLogs);
        consecutiveFailures = 0;
      } catch (chunkError) {
        consecutiveFailures++;
        logger.warn(`事件扫描区块 ${scanFrom}-${scanTo} 失败（${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}）：${chunkError instanceof Error ? chunkError.message : "未知错误"}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          logger.warn("连续区块失败过多，停止扫描");
          break;
        }
      }

      // 如果我们已经有足够的日志，提前退出
      if (allLogs.length >= limit) break;

      scanTo = scanFrom - 1n; // -1n 防止区块之间的重叠
    }

    // 通过 tokenId 去重（针对 RPC 边缘情况的防御）
    const seen = new Set<string>();
    const uniqueLogs = allLogs.filter((log) => {
      const id = log.args.tokenId!.toString();
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // 提取 token ID 和所有者，最新的优先
    const agents = uniqueLogs
      .map((log) => ({
        tokenId: (log.args.tokenId!).toString(),
        owner: log.args.to as string,
      }))
      .reverse()
      .slice(0, limit);

    // 区块按最新优先扫描，但每个区块内的日志是
    // 升序的。简单的 .reverse() 不再产生正确的降序
    // 顺序，因此按 tokenId 降序重新排序（tokenIds 在铸造时单调递增）。
    agents.sort((a, b) => {
      const diff = BigInt(b.tokenId) - BigInt(a.tokenId);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });

    logger.info(`事件扫描发现 ${agents.length} 个已铸造的 agent（在 ${Math.ceil(Number(currentBlock - earliestBlock) / Number(MAX_BLOCK_RANGE))} 个区块中扫描了 ${allLogs.length} 个 Transfer 事件）`);
    return agents;
  } catch (error) {
    logger.warn(`Transfer 事件扫描失败，返回空结果：${error instanceof Error ? error.message : "未知错误"}`);
    return [];
  }
}

/**
 * 检查地址是否有已注册的 agent。
 */
export async function hasRegisteredAgent(
  address: Address,
  network: Network = "mainnet",
): Promise<boolean> {
  const contracts = CONTRACTS[network];
  const chain = contracts.chain;

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  try {
    const balance = await publicClient.readContract({
      address: contracts.identity,
      abi: IDENTITY_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    return Number(balance) > 0;
  } catch {
    return false;
  }
}
