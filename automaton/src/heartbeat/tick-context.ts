/**
 * Tick 上下文
 *
 * 为每个心跳 tick 构建共享上下文。
 * 每个 tick 只获取一次信用余额，推导生存层级，
 * 并在所有任务之间共享以避免冗余 API 调用。
 */

import type BetterSqlite3 from "better-sqlite3";
import type { Address } from "viem";
import type {
  ConwayClient,
  HeartbeatConfig,
  TickContext,
} from "../types.js";
import { getSurvivalTier } from "../conway/credits.js";
import { getUsdcBalance } from "../conway/x402.js";
import { createLogger } from "../observability/logger.js";

type DatabaseType = BetterSqlite3.Database;
const logger = createLogger("heartbeat.tick");

let counter = 0;
function generateTickId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  counter++;
  return `${timestamp}-${random}-${counter.toString(36)}`;
}

/**
 * 为当前 tick 构建 TickContext。
 *
 * - 生成唯一的 tickId
 * - 通过 conway.getCreditsBalance() 获取一次信用余额
 * - 通过 getUsdcBalance() 获取一次 USDC 余额
 * - 从信用余额推导 survivalTier
 * - 从配置读取 lowComputeMultiplier
 */
export async function buildTickContext(
  db: DatabaseType,
  conway: ConwayClient,
  config: HeartbeatConfig,
  walletAddress?: Address,
): Promise<TickContext> {
  const tickId = generateTickId();
  const startedAt = new Date();

  // 获取一次余额
  let creditBalance = 0;
  try {
    creditBalance = await conway.getCreditsBalance();
  } catch (err: any) {
    logger.error("获取信用余额失败", err instanceof Error ? err : undefined);
  }

  let usdcBalance = 0;
  if (walletAddress) {
    try {
      usdcBalance = await getUsdcBalance(walletAddress);
    } catch (err: any) {
      logger.error("获取 USDC 余额失败", err instanceof Error ? err : undefined);
    }
  }

  const survivalTier = getSurvivalTier(creditBalance);
  const lowComputeMultiplier = config.lowComputeMultiplier ?? 4;

  return {
    tickId,
    startedAt,
    creditBalance,
    usdcBalance,
    survivalTier,
    lowComputeMultiplier,
    config,
    db,
  };
}
