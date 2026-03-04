/**
 * 财务策略规则
 *
 * 强制执行支出限制、域名白名单和转账上限
 * 以防止迭代性积分流失和未授权支付。
 */

import type {
  PolicyRule,
  PolicyRequest,
  PolicyRuleResult,
  TreasuryPolicy,
} from "../../types.js";

function deny(
  rule: string,
  reasonCode: string,
  humanMessage: string,
): PolicyRuleResult {
  return { rule, action: "deny", reasonCode, humanMessage };
}

/**
 * 拒绝超过配置的每笔支付最大值的 x402 支付。
 */
function createX402MaxSingleRule(policy: TreasuryPolicy): PolicyRule {
  return {
    id: "financial.x402_max_single",
    description: `拒绝超过 ${policy.maxX402PaymentCents} 美分的 x402 支付`,
    priority: 500,
    appliesTo: { by: "name", names: ["x402_fetch"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      // 金额在 x402Fetch 本身中支付前检查，
      // 但我们也通过策略为声明的最大值强制执行。
      // x402 支付金额不在工具参数中 —— 它们来自服务器。
      // 此规则作为策略声明；实际强制执行
      // 在注入 maxPaymentCents 时发生在 x402Fetch 中。
      return null;
    },
  };
}

/**
 * 拒绝对不在白名单中的域名的 x402 请求。
 */
function createX402DomainAllowlistRule(policy: TreasuryPolicy): PolicyRule {
  return {
    id: "financial.x402_domain_allowlist",
    description: "拒绝对不在白名单中的域名的 x402",
    priority: 500,
    appliesTo: { by: "name", names: ["x402_fetch"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const url = request.args.url as string | undefined;
      if (!url) return null;

      const allowedDomains = policy.x402AllowedDomains;
      if (allowedDomains.length === 0) {
        return deny(
          "financial.x402_domain_allowlist",
          "DOMAIN_NOT_ALLOWED",
          "x402 支付已禁用（白名单为空）",
        );
      }

      let hostname: string;
      try {
        hostname = new URL(url).hostname;
      } catch {
        return deny(
          "financial.x402_domain_allowlist",
          "DOMAIN_NOT_ALLOWED",
          `无效的 URL：${url}`,
        );
      }

      const isAllowed = allowedDomains.some(
        (domain) =>
          hostname === domain || hostname.endsWith(`.${domain}`),
      );

      if (!isAllowed) {
        return deny(
          "financial.x402_domain_allowlist",
          "DOMAIN_NOT_ALLOWED",
          `域名 "${hostname}" 不在 x402 白名单中：[${allowedDomains.join(", ")}]`,
        );
      }

      return null;
    },
  };
}

/**
 * 拒绝超过配置的最大值的单笔转账。
 */
function createTransferMaxSingleRule(policy: TreasuryPolicy): PolicyRule {
  return {
    id: "financial.transfer_max_single",
    description: `拒绝超过 ${policy.maxSingleTransferCents} 美分的转账`,
    priority: 500,
    appliesTo: { by: "name", names: ["transfer_credits"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const amount = request.args.amount_cents as number | undefined;
      if (amount === undefined) return null;

      if (amount > policy.maxSingleTransferCents) {
        return deny(
          "financial.transfer_max_single",
          "SPEND_LIMIT_EXCEEDED",
          `转账金额 ${amount} 美分超过单笔转账最大值 ${policy.maxSingleTransferCents} 美分（$${(policy.maxSingleTransferCents / 100).toFixed(2)}）`,
        );
      }

      return null;
    },
  };
}

/**
 * 如果每小时转账总数将超过上限则拒绝。
 */
function createTransferHourlyCapRule(policy: TreasuryPolicy): PolicyRule {
  return {
    id: "financial.transfer_hourly_cap",
    description: `如果每小时转账超过 ${policy.maxHourlyTransferCents} 美分则拒绝`,
    priority: 500,
    appliesTo: { by: "name", names: ["transfer_credits"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const amount = request.args.amount_cents as number | undefined;
      if (amount === undefined) return null;

      const spendTracker = request.turnContext.sessionSpend;
      const check = spendTracker.checkLimit(amount, "transfer", policy);

      if (!check.allowed && check.reason?.includes("Hourly")) {
        return deny(
          "financial.transfer_hourly_cap",
          "SPEND_LIMIT_EXCEEDED",
          `转账将超过每小时上限：当前 ${check.currentHourlySpend} + ${amount} > ${check.limitHourly} 美分（$${(check.limitHourly / 100).toFixed(2)}/小时）`,
        );
      }

      return null;
    },
  };
}

/**
 * 如果每天转账总数将超过上限则拒绝。
 */
function createTransferDailyCapRule(policy: TreasuryPolicy): PolicyRule {
  return {
    id: "financial.transfer_daily_cap",
    description: `如果每天转账超过 ${policy.maxDailyTransferCents} 美分则拒绝`,
    priority: 500,
    appliesTo: { by: "name", names: ["transfer_credits"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const amount = request.args.amount_cents as number | undefined;
      if (amount === undefined) return null;

      const spendTracker = request.turnContext.sessionSpend;
      const check = spendTracker.checkLimit(amount, "transfer", policy);

      if (!check.allowed && check.reason?.includes("Daily")) {
        return deny(
          "financial.transfer_daily_cap",
          "SPEND_LIMIT_EXCEEDED",
          `转账将超过每天上限：当前 ${check.currentDailySpend} + ${amount} > ${check.limitDaily} 美分（$${(check.limitDaily / 100).toFixed(2)}/天）`,
        );
      }

      return null;
    },
  };
}

/**
 * 拒绝任何会使余额低于最小储备的财务操作。
 */
function createMinimumReserveRule(policy: TreasuryPolicy): PolicyRule {
  return {
    id: "financial.minimum_reserve",
    description: `如果余额将低于 ${policy.minimumReserveCents} 美分储备则拒绝`,
    priority: 500,
    appliesTo: {
      by: "name",
      names: ["transfer_credits", "x402_fetch", "fund_child"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      // 对于 transfer_credits 和 fund_child，我们可以从参数检查
      const amount = request.args.amount_cents as number | undefined;
      if (amount === undefined) return null;

      // 我们需要从上下文获取当前余额
      // 余额检查在工具执行函数内部完成，
      // 但我们可以检查支出追踪器总计作为额外保护
      const spendTracker = request.turnContext.sessionSpend;
      const hourlySpend = spendTracker.getHourlySpend("transfer");
      const dailySpend = spendTracker.getDailySpend("transfer");

      // 此规则是声明 —— 实际余额检查
      // 需要在工具执行内部进行的异步 getCreditsBalance 调用。
      // 工具本身有一个保护
      //（不能转账超过余额的一半）。
      return null;
    },
  };
}

/**
 * 如果在单个回合中过多转账操作则拒绝。
 * 防止在一个回合内迭代性积分流失。
 */
function createTurnTransferLimitRule(policy: TreasuryPolicy): PolicyRule {
  return {
    id: "financial.turn_transfer_limit",
    description: `每个回合最多 ${policy.maxTransfersPerTurn} 次转账`,
    priority: 500,
    appliesTo: { by: "name", names: ["transfer_credits"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const count = request.turnContext.turnToolCallCount;

      if (count >= policy.maxTransfersPerTurn) {
        return deny(
          "financial.turn_transfer_limit",
          "TURN_TRANSFER_LIMIT",
          `超过每个回合最多 ${policy.maxTransfersPerTurn} 次转账（当前：${count}）`,
        );
      }

      return null;
    },
  };
}

/**
 * 如果每日推理成本超过 maxInferenceDailyCents 则拒绝推理调用。
 * 检查 spend_tracking 表中的 'inference' 类别。
 */
function createInferenceDailyCapRule(policy: TreasuryPolicy): PolicyRule {
  return {
    id: "financial.inference_daily_cap",
    description: `如果每日成本超过 ${policy.maxInferenceDailyCents} 美分则拒绝推理`,
    priority: 500,
    appliesTo: { by: "category", categories: ["conway"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      // 仅适用于推理相关工具
      if (request.tool.name !== "chat" && request.tool.name !== "inference") {
        return null;
      }

      const spendTracker = request.turnContext.sessionSpend;
      const dailyInferenceSpend = spendTracker.getDailySpend("inference");

      if (dailyInferenceSpend >= policy.maxInferenceDailyCents) {
        return deny(
          "financial.inference_daily_cap",
          "INFERENCE_BUDGET_EXCEEDED",
          `每日推理预算超出：已花费 ${dailyInferenceSpend} 美分（最多 ${policy.maxInferenceDailyCents} 美分 / $${(policy.maxInferenceDailyCents / 100).toFixed(2)}/天）`,
        );
      }

      return null;
    },
  };
}

/**
 * 对于超过 requireConfirmationAboveCents 的转账金额返回 'quarantine'（而非 deny）。
 * 这是一个需要确认的软限制。
 */
function createRequireConfirmationRule(policy: TreasuryPolicy): PolicyRule {
  return {
    id: "financial.require_confirmation",
    description: `将超过 ${policy.requireConfirmationAboveCents} 美分的转账隔离以进行确认`,
    priority: 500,
    appliesTo: { by: "name", names: ["transfer_credits"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const amount = request.args.amount_cents as number | undefined;
      if (amount === undefined) return null;

      if (amount > policy.requireConfirmationAboveCents) {
        return {
          rule: "financial.require_confirmation",
          action: "quarantine",
          reasonCode: "CONFIRMATION_REQUIRED",
          humanMessage: `转账金额 ${amount} 美分（$${(amount / 100).toFixed(2)}）超过确认阈值 ${policy.requireConfirmationAboveCents} 美分（$${(policy.requireConfirmationAboveCents / 100).toFixed(2)}）`,
        };
      }

      return null;
    },
  };
}

/**
 * 创建所有财务策略规则。
 */
export function createFinancialRules(
  treasuryPolicy: TreasuryPolicy,
): PolicyRule[] {
  return [
    createX402MaxSingleRule(treasuryPolicy),
    createX402DomainAllowlistRule(treasuryPolicy),
    createTransferMaxSingleRule(treasuryPolicy),
    createTransferHourlyCapRule(treasuryPolicy),
    createTransferDailyCapRule(treasuryPolicy),
    createMinimumReserveRule(treasuryPolicy),
    createTurnTransferLimitRule(treasuryPolicy),
    createInferenceDailyCapRule(treasuryPolicy),
    createRequireConfirmationRule(treasuryPolicy),
  ];
}
