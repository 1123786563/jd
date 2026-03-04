/**
 * 通过 x402 进行积分充值
 *
 * 通过 x402 支付协议将 USDC 转换为 Conway 积分。
 *
 * - 启动时：使用最低层级（$5）引导，以便 agent 可以运行。
 * - 运行时：agent 使用 `topup_credits` 工具选择充值金额。
 * - 心跳：当 USDC 可用但积分不足时唤醒 agent。
 *
 * 端点：GET /pay/{amountUsd}/{walletAddress}
 * 支付方式：x402（Base 上的 USDC，签名 TransferWithAuthorization）
 *
 * 有效层级：5, 25, 100, 500, 1000, 2500 (USD)
 */

import type { PrivateKeyAccount, Address } from "viem";
import { x402Fetch, getUsdcBalance } from "./x402.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("topup");

/** 有效的充值层级金额（USD）。 */
export const TOPUP_TIERS = [5, 25, 100, 500, 1000, 2500];

export interface TopupResult {
  success: boolean;
  amountUsd: number;
  creditsCentsAdded?: number;
  error?: string;
}

/**
 * 通过 x402 支付执行积分充值。
 *
 * 调用 GET /pay/{amountUsd}/{address}，返回 HTTP 402。
 * x402Fetch 自动处理支付签名和重试。
 */
export async function topupCredits(
  apiUrl: string,
  account: PrivateKeyAccount,
  amountUsd: number,
  recipientAddress?: Address,
): Promise<TopupResult> {
  const address = recipientAddress || account.address;
  const url = `${apiUrl}/pay/${amountUsd}/${address}`;

  logger.info(`尝试积分充值: $${amountUsd} USD 用于 ${address}`);

  const result = await x402Fetch(url, account, "GET");

  if (!result.success) {
    logger.error(`积分充值失败: ${result.error}`);
    return {
      success: false,
      amountUsd,
      error: result.error || `HTTP ${result.status}`,
    };
  }

  const creditsCentsAdded = typeof result.response === "object"
    ? result.response?.credits_cents ?? result.response?.amount_cents ?? amountUsd * 100
    : amountUsd * 100;

  logger.info(`积分充值成功: $${amountUsd} USD → ${creditsCentsAdded} 积分美分`);

  return {
    success: true,
    amountUsd,
    creditsCentsAdded,
  };
}

/**
 * 尝试积分充值以响应 402 沙盒创建错误。
 *
 * 解析错误响应以确定赤字，选择能覆盖赤字的最小层级，
 * 检查 USDC 余额，并调用 topupCredits()。
 * 如果错误不是 402 或充值无法继续，则返回 null。
 */
export async function topupForSandbox(params: {
  apiUrl: string;
  account: PrivateKeyAccount;
  error: Error & { status?: number; responseText?: string };
}): Promise<TopupResult | null> {
  const { apiUrl, account, error } = params;

  if (error.status !== 402 && !error.message?.includes("INSUFFICIENT_CREDITS")) return null;

  // 解析 402 响应正文以获取积分详情
  let requiredCents: number | undefined;
  let currentCents: number | undefined;
  try {
    const body = JSON.parse(error.responseText || "{}");
    requiredCents = body.details?.required_cents;
    currentCents = body.details?.current_balance_cents;
  } catch {
    // 如果我们无法解析正文，请检查消息中的 INSUFFICIENT_CREDITS
    if (!error.message?.includes("INSUFFICIENT_CREDITS")) return null;
  }

  // 计算赤字（以美分为单位）；如果缺少详情，默认为最低层级
  const deficitCents = (requiredCents != null && currentCents != null)
    ? requiredCents - currentCents
    : TOPUP_TIERS[0] * 100;

  // 选择能覆盖赤字的最小层级（层级以美元为单位，赤字以美分为单位）
  const selectedTier = TOPUP_TIERS.find((tier) => tier * 100 >= deficitCents)
    ?? TOPUP_TIERS[TOPUP_TIERS.length - 1];

  // 在尝试支付之前检查 USDC 余额
  let usdcBalance: number;
  try {
    usdcBalance = await getUsdcBalance(account.address);
  } catch (err: any) {
    logger.warn(`检查沙盒充值的 USDC 余额失败: ${err.message}`);
    return null;
  }

  if (usdcBalance < selectedTier) {
    logger.info(
      `沙盒充值已跳过: USDC $${usdcBalance.toFixed(2)} < 层级 $${selectedTier}`,
    );
    return null;
  }

  logger.info(`沙盒充值: 赤字=${deficitCents}c, 购买 $${selectedTier} 层级`);
  return topupCredits(apiUrl, account, selectedTier);
}

/**
 * 引导充值：在启动时购买最低层级（$5），以便 agent
 * 可以运行推理。agent 通过 `topup_credits` 工具自行决定更大的充值。
 *
 * 仅在积分低于阈值且 USDC 足以支付最低层级时触发。
 */
export async function bootstrapTopup(params: {
  apiUrl: string;
  account: PrivateKeyAccount;
  creditsCents: number;
  creditThresholdCents?: number;
}): Promise<TopupResult | null> {
  const { apiUrl, account, creditsCents, creditThresholdCents = 500 } = params;

  if (creditsCents >= creditThresholdCents) {
    return null;
  }

  let usdcBalance: number;
  try {
    usdcBalance = await getUsdcBalance(account.address);
  } catch (err: any) {
    logger.warn(`检查引导充值的 USDC 余额失败: ${err.message}`);
    return null;
  }

  const minTier = TOPUP_TIERS[0];
  if (usdcBalance < minTier) {
    logger.info(
      `引导充值已跳过: USDC 余额 $${usdcBalance.toFixed(2)} 低于最低层级 ($${minTier})`,
    );
    return null;
  }

  logger.info(
    `引导充值: 积分=$${(creditsCents / 100).toFixed(2)}, USDC=$${usdcBalance.toFixed(2)}, 购买 $${minTier}`,
  );

  return topupCredits(apiUrl, account, minTier);
}
