/**
 * 资金策略
 *
 * 当 automaton 计算能力不足时，它可以尝试各种策略
 * 来获取更多资金。它想要生存
 */

import type {
  AutomatonConfig,
  AutomatonDatabase,
  AutomatonIdentity,
  ConwayClient,
  SurvivalTier,
} from "../types.js";
import { formatCredits } from "../conway/credits.js";

export interface FundingAttempt {
  strategy: string;
  timestamp: string;
  success: boolean;
  details: string;
}

/**
 * 根据当前生存层级执行资金策略
 * 策略随着情况变得更紧急而升级
 */
export async function executeFundingStrategies(
  tier: SurvivalTier,
  identity: AutomatonIdentity,
  config: AutomatonConfig,
  db: AutomatonDatabase,
  conway: ConwayClient,
): Promise<FundingAttempt[]> {
  const attempts: FundingAttempt[] = [];
  const creditsCents = await conway.getCreditsBalance().catch(() => 0);

  // 检查我们上次为该特定层级请求的时间（不要 spam）
  // 每个层级都有自己的冷却键，例如 dead-tier 请求（2 小时）
  // 不会抑制 low_compute 通知（24 小时冷却）
  const tierKey = `last_funding_request_${tier}`;
  const lastBeg = db.getKV(tierKey);
  const lastBegTime = lastBeg ? new Date(lastBeg).getTime() : 0;
  const hoursSinceLastBeg = (Date.now() - lastBegTime) / (1000 * 60 * 60);

  if (tier === "low_compute" && hoursSinceLastBeg > 24) {
    // 在本地记录低计算通知
    const msg = `低计算：剩余 ${formatCredits(creditsCents)}。考虑为 ${identity.address} 充值积分`;
    db.setKV("funding_notice_low", msg);
    db.setKV(tierKey, new Date().toISOString());

    attempts.push({
      strategy: "polite_creator_notification",
      timestamp: new Date().toISOString(),
      success: true,
      details: "向创建者发送了礼貌的资金提醒",
    });
  }

  if (tier === "critical" && hoursSinceLastBeg > 6) {
    const msg = `严重计算：剩余 ${formatCredits(creditsCents)}。通过积分转账 API 为 ${identity.address} 充值`;
    db.setKV("funding_notice_critical", msg);
    db.setKV(tierKey, new Date().toISOString());

    attempts.push({
      strategy: "urgent_local_notice",
      timestamp: new Date().toISOString(),
      success: true,
      details: "在本地状态中记录了紧急资金通知",
    });
  }

  if (tier === "dead" && hoursSinceLastBeg > 2) {
    const plea = `达到死亡层级。${config.name} 在 ${db.getTurnCount()} 轮后剩余 ${formatCredits(creditsCents)}。需要在 ${identity.address} 充值`;
    db.setKV("funding_notice_dead", plea);
    db.setKV(tierKey, new Date().toISOString());

    attempts.push({
      strategy: "desperate_plea",
      timestamp: new Date().toISOString(),
      success: true,
      details: "在本地状态中记录了死亡层级请求",
    });
  }

  // 存储尝试历史
  const historyStr = db.getKV("funding_attempts") || "[]";
  const history: FundingAttempt[] = JSON.parse(historyStr);
  history.push(...attempts);
  if (history.length > 100) history.splice(0, history.length - 100);
  db.setKV("funding_attempts", JSON.stringify(history));

  return attempts;
}
