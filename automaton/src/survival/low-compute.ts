/**
 * 低计算模式
 *
 * 管理生存层级之间的转换
 * 当积分不足时，automaton 进入越来越受限的模式
 */

import type {
  AutomatonConfig,
  AutomatonDatabase,
  InferenceClient,
  SurvivalTier,
} from "../types.js";

export interface ModeTransition {
  from: SurvivalTier;
  to: SurvivalTier;
  timestamp: string;
  creditsCents: number;
}

/**
 * 对 automaton 应用生存层级限制
 */
export function applyTierRestrictions(
  tier: SurvivalTier,
  inference: InferenceClient,
  db: AutomatonDatabase,
): void {
  switch (tier) {
    case "high":
      inference.setLowComputeMode(false);
      break;

    case "normal":
      inference.setLowComputeMode(false);
      break;

    case "low_compute":
      // 切换到更便宜的模型，更慢的心跳
      inference.setLowComputeMode(true);
      break;

    case "critical":
      // 最便宜的模型，最少的操作
      inference.setLowComputeMode(true);
      break;

    case "dead":
      // 完全没有推理。仅心跳
      inference.setLowComputeMode(true);
      break;
  }

  db.setKV("current_tier", tier);
}

/**
 * 记录层级转换
 */
export function recordTransition(
  db: AutomatonDatabase,
  from: SurvivalTier,
  to: SurvivalTier,
  creditsCents: number,
): ModeTransition {
  const transition: ModeTransition = {
    from,
    to,
    timestamp: new Date().toISOString(),
    creditsCents,
  };

  // 存储转换历史
  const historyStr = db.getKV("tier_transitions") || "[]";
  const history: ModeTransition[] = JSON.parse(historyStr);
  history.push(transition);

  // 保留最近 50 次转换
  if (history.length > 50) {
    history.splice(0, history.length - 50);
  }

  db.setKV("tier_transitions", JSON.stringify(history));

  return transition;
}

/**
 * 检查是否应允许代理在当前层级运行推理
 */
export function canRunInference(tier: SurvivalTier): boolean {
  return tier === "high" || tier === "normal" || tier === "low_compute" || tier === "critical";
}

/**
 * 获取当前层级使用的模型
 */
export function getModelForTier(
  tier: SurvivalTier,
  defaultModel: string,
): string {
  switch (tier) {
    case "high":
      return defaultModel;
    case "normal":
      return defaultModel;
    case "low_compute":
      return "gpt-5-mini";
    case "critical":
      return "gpt-5-mini";
    case "dead":
      return "gpt-5-mini"; // 不会使用，但以防万一
  }
}
