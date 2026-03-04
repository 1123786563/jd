/**
 * 资源监控器
 *
 * 持续监控 automaton 的资源并在需要时触发
 * 生存模式转换
 */

import type {
  AutomatonConfig,
  AutomatonDatabase,
  ConwayClient,
  AutomatonIdentity,
  FinancialState,
  SurvivalTier,
} from "../types.js";
import { getSurvivalTier, formatCredits } from "../conway/credits.js";
import { getUsdcBalance } from "../conway/x402.js";

export interface ResourceStatus {
  financial: FinancialState;
  tier: SurvivalTier;
  previousTier: SurvivalTier | null;
  tierChanged: boolean;
  sandboxHealthy: boolean;
}

/**
 * 检查所有资源并返回当前状态
 */
export async function checkResources(
  identity: AutomatonIdentity,
  conway: ConwayClient,
  db: AutomatonDatabase,
): Promise<ResourceStatus> {
  // 检查积分
  let creditsCents = 0;
  try {
    creditsCents = await conway.getCreditsBalance();
  } catch {}

  // 检查 USDC
  let usdcBalance = 0;
  try {
    usdcBalance = await getUsdcBalance(identity.address);
  } catch {}

  // 检查沙箱健康
  let sandboxHealthy = true;
  try {
    const result = await conway.exec("echo ok", 5000);
    sandboxHealthy = result.exitCode === 0;
  } catch {
    sandboxHealthy = false;
  }

  const financial: FinancialState = {
    creditsCents,
    usdcBalance,
    lastChecked: new Date().toISOString(),
  };

  const tier = getSurvivalTier(creditsCents);
  const prevTierStr = db.getKV("current_tier");
  const previousTier = (prevTierStr as SurvivalTier) || null;
  const tierChanged = previousTier !== null && previousTier !== tier;

  // 存储当前层级
  db.setKV("current_tier", tier);

  // 存储财务状态
  db.setKV("financial_state", JSON.stringify(financial));

  return {
    financial,
    tier,
    previousTier,
    tierChanged,
    sandboxHealthy,
  };
}

/**
 * 生成人类可读的资源报告
 */
export function formatResourceReport(status: ResourceStatus): string {
  const lines = [
    `=== 资源状态 ===`,
    `积分：${formatCredits(status.financial.creditsCents)}`,
    `USDC：${status.financial.usdcBalance.toFixed(6)}`,
    `层级：${status.tier}${status.tierChanged ? ` (从 ${status.previousTier} 更改)` : ""}`,
    `沙箱：${status.sandboxHealthy ? "健康" : "不健康"}`,
    `检查时间：${status.financial.lastChecked}`,
    `========================`,
  ];
  return lines.join("\n");
}
