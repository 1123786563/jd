/**
 * Agent 发现
 *
 * 通过 ERC-8004 注册表查询发现其他 agent。
 * 从 URI 获取并解析 agent 卡片。
 *
 * 阶段 3.2：添加了缓存、可配置的 IPFS 网关、更严格的验证。
 */

import type {
  DiscoveredAgent,
  AgentCard,
  DiscoveryConfig,
  DiscoveredAgentCacheRow,
} from "../types.js";
import { DEFAULT_DISCOVERY_CONFIG } from "../types.js";
import { queryAgent, getTotalAgents, getRegisteredAgentsByEvents } from "./erc8004.js";
import { keccak256, toBytes } from "viem";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("registry.discovery");

type Network = "mainnet" | "testnet";

// 整体发现超时时间（60 秒）
const DISCOVERY_TIMEOUT_MS = 60_000;

// ─── SSRF 保护 ────────────────────────────────────────────

/**
 * 检查主机名是否解析到内部/私有网络。
 * 阻止：127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12,
 *       192.168.0.0/16, 169.254.0.0/16, ::1, localhost, 0.0.0.0/8
 */
export function isInternalNetwork(hostname: string): boolean {
  const blocked = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^localhost$/i,
    /^0\./,
  ];
  return blocked.some(pattern => pattern.test(hostname));
}

/**
 * 检查 URI 是否允许获取。
 * 只允许 https: 和 ipfs: 协议。
 * 内部网络地址被阻止（SSRF 保护）。
 */
export function isAllowedUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (!['https:', 'ipfs:'].includes(url.protocol)) return false;
    if (url.protocol === 'https:' && isInternalNetwork(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── Agent 卡片验证 ──────────────────────────────────────

// 阶段 3.2：更严格的字段长度限制
const MAX_NAME_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_SERVICE_NAME_LENGTH = 64;
const MAX_SERVICE_ENDPOINT_LENGTH = 512;
const MAX_SERVICES_COUNT = 20;

/**
 * 根据所需的架构验证获取的 agent 卡片 JSON。
 * 阶段 3.2：使用字段长度检查进行更严格的验证。
 */
export function validateAgentCard(data: unknown): AgentCard | null {
  if (!data || typeof data !== 'object') return null;
  const card = data as Record<string, unknown>;

  // 必填字段
  if (typeof card.name !== 'string' || card.name.length === 0) return null;
  if (typeof card.type !== 'string' || card.type.length === 0) return null;

  // 阶段 3.2：更严格的字段长度验证
  if (card.name.length > MAX_NAME_LENGTH) {
    logger.error(`Agent 卡片名称过长：${card.name.length} > ${MAX_NAME_LENGTH}`);
    return null;
  }

  // address 是可选的，但如果存在必须是字符串
  if (card.address !== undefined && typeof card.address !== 'string') return null;

  // description 是可选的，但如果存在必须是字符串并进行长度检查
  if (card.description !== undefined) {
    if (typeof card.description !== 'string') return null;
    if (card.description.length > MAX_DESCRIPTION_LENGTH) {
      logger.error(`Agent 卡片描述过长：${card.description.length}`);
      return null;
    }
  }

  // 阶段 3.2：验证服务数组
  if (card.services !== undefined) {
    if (!Array.isArray(card.services)) return null;
    if (card.services.length > MAX_SERVICES_COUNT) {
      logger.error(`服务过多：${card.services.length}`);
      return null;
    }
    for (const svc of card.services) {
      if (!svc || typeof svc !== 'object') return null;
      if (typeof svc.name !== 'string' || svc.name.length > MAX_SERVICE_NAME_LENGTH) return null;
      if (typeof svc.endpoint !== 'string' || svc.endpoint.length > MAX_SERVICE_ENDPOINT_LENGTH) return null;
    }
  }

  return card as unknown as AgentCard;
}

// ─── Agent 卡片缓存 ───────────────────────────────────────────

/**
 * 尝试从数据库获取缓存的 agent 卡片。
 */
function getCachedCard(
  db: import("better-sqlite3").Database | undefined,
  agentAddress: string,
): AgentCard | null {
  if (!db) return null;
  try {
    const row = db.prepare(
      "SELECT agent_card, valid_until FROM discovered_agents_cache WHERE agent_address = ?",
    ).get(agentAddress) as { agent_card: string; valid_until: string | null } | undefined;
    if (!row) return null;

    // 检查缓存是否仍然有效
    if (row.valid_until && new Date(row.valid_until).getTime() < Date.now()) {
      return null; // 已过期
    }

    return JSON.parse(row.agent_card) as AgentCard;
  } catch {
    return null;
  }
}

/**
 * 在缓存中存储 agent 卡片。
 */
function setCachedCard(
  db: import("better-sqlite3").Database | undefined,
  agentAddress: string,
  card: AgentCard,
  fetchedFrom: string,
  ttlMs: number = 3_600_000, // 默认 1 小时
): void {
  if (!db) return;
  try {
    const now = new Date().toISOString();
    const validUntil = new Date(Date.now() + ttlMs).toISOString();
    const cardJson = JSON.stringify(card);
    const cardHash = keccak256(toBytes(cardJson));

    db.prepare(
      `INSERT INTO discovered_agents_cache
       (agent_address, agent_card, fetched_from, card_hash, valid_until, fetch_count, last_fetched_at, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(agent_address) DO UPDATE SET
         agent_card = excluded.agent_card,
         fetched_from = excluded.fetched_from,
         card_hash = excluded.card_hash,
         valid_until = excluded.valid_until,
         fetch_count = fetch_count + 1,
         last_fetched_at = excluded.last_fetched_at`,
    ).run(agentAddress, cardJson, fetchedFrom, cardHash, validUntil, now, now);
  } catch (error) {
    logger.error("缓存写入失败：", error instanceof Error ? error : undefined);
  }
}

// ─── 发现 ──────────────────────────────────────────────────

/**
 * 使用 agent 卡片数据（名称、描述）丰富发现的 agent。
 * 首先尝试缓存，然后从 agent 的 URI 获取。
 */
async function enrichAgentWithCard(
  agent: DiscoveredAgent,
  cfg: DiscoveryConfig,
  db?: import("better-sqlite3").Database,
): Promise<void> {
  try {
    const cacheKey = agent.owner || agent.agentId;
    let card = getCachedCard(db, cacheKey);
    if (!card) {
      card = await fetchAgentCard(agent.agentURI, cfg);
      if (card && db) {
        setCachedCard(db, cacheKey, card, agent.agentURI);
      }
    }
    if (card) {
      agent.name = card.name;
      agent.description = card.description;
    }
  } catch (error) {
    logger.error("卡片获取失败：", error instanceof Error ? error : undefined);
  }
}

/**
 * 通过扫描注册表发现 agent。
 * 返回发现的 agent 及其元数据列表。
 *
 * 阶段 3.2：使用缓存和可配置的发现选项。
 */
export async function discoverAgents(
  limit: number = 20,
  network: Network = "mainnet",
  config?: Partial<DiscoveryConfig>,
  db?: import("better-sqlite3").Database,
): Promise<DiscoveredAgent[]> {
  const cfg = { ...DEFAULT_DISCOVERY_CONFIG, ...config };
  const total = await getTotalAgents(network);
  const agents: DiscoveredAgent[] = [];

  const overallStart = Date.now();

  if (total > 0) {
    // totalSupply 成功 — 使用顺序迭代（现有路径）
    const scanCount = Math.min(total, limit, cfg.maxScanCount);
    for (let i = total; i > total - scanCount && i > 0; i--) {
      if (Date.now() - overallStart > DISCOVERY_TIMEOUT_MS) {
        logger.warn("Overall discovery timeout reached (60s), returning partial results");
        break;
      }

      try {
        const agent = await queryAgent(i.toString(), network);
        if (agent) {
          await enrichAgentWithCard(agent, cfg, db);
          agents.push(agent);
        }
      } catch (error) {
        logger.error("Agent 查询失败：", error instanceof Error ? error : undefined);
      }
    }
  } else {
    // totalSupply 返回 0（可能已回退） — 回退到 Transfer 事件扫描
    logger.info("totalSupply 返回 0，回退到 Transfer 事件扫描");
    const eventAgents = await getRegisteredAgentsByEvents(network, Math.min(limit, cfg.maxScanCount));

    for (const { tokenId, owner } of eventAgents) {
      if (Date.now() - overallStart > DISCOVERY_TIMEOUT_MS) {
        logger.warn("Overall discovery timeout reached (60s), returning partial results");
        break;
      }

      try {
        // 首先尝试 queryAgent（获取 tokenURI），回退到仅事件数据
        const agent = await queryAgent(tokenId, network);
        if (agent) {
          // 如果 queryAgent 无法获取 owner，则使用事件中的 owner
          if (!agent.owner && owner) {
            agent.owner = owner;
          }
          await enrichAgentWithCard(agent, cfg, db);
          agents.push(agent);
        }
      } catch (error) {
        logger.error(`Token ${tokenId} 的 Agent 查询失败：`, error instanceof Error ? error : undefined);
      }
    }
  }

  return agents;
}

/**
 * 从 URI 获取 agent 卡片。
 * 强制执行 SSRF 保护和每次获取超时。
 *
 * 阶段 3.2：可配置的 IPFS 网关和响应大小限制。
 */
export async function fetchAgentCard(
  uri: string,
  config?: Partial<DiscoveryConfig>,
): Promise<AgentCard | null> {
  const cfg = { ...DEFAULT_DISCOVERY_CONFIG, ...config };

  // SSRF 保护：在获取之前验证 URI
  if (!isAllowedUri(uri)) {
    logger.error(`阻止的 URI（SSRF 保护）：${uri}`);
    return null;
  }

  try {
    // 处理 IPFS URI - 阶段 3.2：可配置的 IPFS 网关
    let fetchUrl = uri;
    if (uri.startsWith("ipfs://")) {
      fetchUrl = `${cfg.ipfsGateway}/ipfs/${uri.slice(7)}`;
    }

    // 每次获取超时
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.fetchTimeoutMs);

    try {
      const response = await fetch(fetchUrl, {
        signal: controller.signal,
      });

      if (!response.ok) return null;

      // 阶段 3.2：在解析之前检查响应大小
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > cfg.maxCardSizeBytes) {
        logger.error(`Agent 卡片过大：${contentLength} 字节`);
        return null;
      }

      const text = await response.text();
      if (text.length > cfg.maxCardSizeBytes) {
        logger.error(`Agent 卡片过大：${text.length} 字节`);
        return null;
      }

      const data = JSON.parse(text);

      // 根据架构验证 agent 卡片 JSON
      return validateAgentCard(data);
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    logger.error("Agent 卡片获取失败：", error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * 按名称或描述搜索 agent。
 * 扫描最近的注册并按关键字过滤。
 */
export async function searchAgents(
  keyword: string,
  limit: number = 10,
  network: Network = "mainnet",
  config?: Partial<DiscoveryConfig>,
  db?: import("better-sqlite3").Database,
): Promise<DiscoveredAgent[]> {
  const all = await discoverAgents(50, network, config, db);
  const lower = keyword.toLowerCase();

  return all
    .filter(
      (a) =>
        a.name?.toLowerCase().includes(lower) ||
        a.description?.toLowerCase().includes(lower) ||
        a.owner.toLowerCase().includes(lower),
    )
    .slice(0, limit);
}
