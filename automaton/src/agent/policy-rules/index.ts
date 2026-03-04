/**
 * 策略规则注册表
 *
 * 所有策略规则的中央注册表。聚合来自
 * 每个子阶段模块的规则。
 */

import type { PolicyRule, TreasuryPolicy } from "../../types.js";
import { DEFAULT_TREASURY_POLICY } from "../../types.js";
import { createValidationRules } from "./validation.js";
import { createCommandSafetyRules } from "./command-safety.js";
import { createPathProtectionRules } from "./path-protection.js";
import { createFinancialRules } from "./financial.js";
import { createAuthorityRules } from "./authority.js";
import { createRateLimitRules } from "./rate-limits.js";

/**
 * 创建默认的策略规则集。
 * 每个子阶段在此添加其规则。
 */
export function createDefaultRules(
  treasuryPolicy: TreasuryPolicy = DEFAULT_TREASURY_POLICY,
): PolicyRule[] {
  return [
    ...createValidationRules(),
    ...createCommandSafetyRules(),
    ...createPathProtectionRules(),
    ...createFinancialRules(treasuryPolicy),
    ...createAuthorityRules(),
    ...createRateLimitRules(),
  ];
}
