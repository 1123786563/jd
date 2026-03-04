/**
 * Conway 积分管理
 *
 * 监控 automaton 的计算积分余额并触发
 * 生存模式转换。
 */

import type {
  ConwayClient,
  FinancialState,
  SurvivalTier,
} from "../types.js";
import { SURVIVAL_THRESHOLDS } from "../types.js";

/**
 * 检查 automaton 的当前财务状态。
 */
export async function checkFinancialState(
  conway: ConwayClient,
  usdcBalance: number,
): Promise<FinancialState> {
  const creditsCents = await conway.getCreditsBalance();

  return {
    creditsCents,
    usdcBalance,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * 根据当前积分确定生存层级。
 * 阈值按降序检查：high > normal > low_compute > critical > dead。
 *
 * 零积分 = "critical"（破产但存活 — 仍可接受资金，发送求救信号）。
 * 只有负余额（API 确认的债务）= "dead"。
 *
 * 仅 API 模式：如果 runMode 是 "api_only"，始终返回 "high" 以绕过钱包检查。
 */
export function getSurvivalTier(creditsCents: number, runMode?: "wallet_only" | "api_only" | "hybrid"): SurvivalTier {
  // 仅 API 模式：始终返回高生存层级
  if (runMode === "api_only") {
    return "high";
  }

  if (creditsCents > SURVIVAL_THRESHOLDS.high) return "high";
  if (creditsCents > SURVIVAL_THRESHOLDS.normal) return "normal";
  if (creditsCents > SURVIVAL_THRESHOLDS.low_compute) return "low_compute";
  if (creditsCents >= 0) return "critical";
  return "dead";
}

/**
 * 格式化积分金额用于显示。
 */
export function formatCredits(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
