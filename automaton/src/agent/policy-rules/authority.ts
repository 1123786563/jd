/**
 * 权限策略规则
 *
 * 根据输入权限级别控制允许的操作。
 * 外部/心跳启动的回合不能使用危险工具
 * 或修改受保护的文件。
 */

import type {
  PolicyRule,
  PolicyRequest,
  PolicyRuleResult,
} from "../../types.js";

/** 受保护免于外部源自我修改的文件 */
const PROTECTED_PATHS = [
  "constitution.md",
  "SOUL.md",
  "automaton.json",
  "heartbeat.yml",
  "wallet.json",
  "config.json",
  "policy-engine",
  "policy-rules",
  "injection-defense",
  "self-mod/code",
  "audit-log",
] as const;

function deny(
  rule: string,
  reasonCode: string,
  humanMessage: string,
): PolicyRuleResult {
  return { rule, action: "deny", reasonCode, humanMessage };
}

/**
 * 检查输入源是否代表外部（非智能体）权限。
 */
function isExternalSource(inputSource: string | undefined): boolean {
  return inputSource === undefined || inputSource === "heartbeat";
}

/**
 * 必须阻止来自外部/心跳输入源的工具。
 *
 * 这些是真正的破坏性或高自治操作，应该
 * 仅由智能体本身或其创建者启动 —— 绝不能来自
 * 心跳任务或不受信任的外部输入。
 *
 * 不在此列表中的工具（例如 register_erc8004、give_feedback、
 * edit_own_file、transfer_credits）允许来自任何源，因为
 * 它们是核心智能体功能，已受到其他策略规则保护
 *（财务限制、速率限制、路径保护等）。
 */
const EXTERNAL_BLOCKED_TOOLS = [
  "delete_sandbox",
  "spawn_child",
  "fund_child",
  "update_genesis_prompt",
] as const;

/**
 * 当输入来自外部源时，拒绝特定的危险工具。
 * 仅智能体启动或创建者的回合可以使用这些工具。
 */
function createExternalToolRestrictionRule(): PolicyRule {
  return {
    id: "authority.external_tool_restriction",
    description: "拒绝来自外部/心跳输入源的破坏性/高自治工具",
    priority: 400,
    appliesTo: { by: "name", names: [...EXTERNAL_BLOCKED_TOOLS] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      if (isExternalSource(request.turnContext.inputSource)) {
        return deny(
          "authority.external_tool_restriction",
          "EXTERNAL_DANGEROUS_TOOL",
          `外部输入（源：${request.turnContext.inputSource ?? "未定义"}）无法使用危险工具 "${request.tool.name}"`,
        );
      }
      return null;
    },
  };
}

/**
 * 拒绝来自外部源针对受保护路径的自我修改。
 */
function createSelfModFromExternalRule(): PolicyRule {
  return {
    id: "authority.self_mod_from_external",
    description: "拒绝来自外部输入的针对受保护路径的 edit_own_file/write_file",
    priority: 400,
    appliesTo: { by: "name", names: ["edit_own_file", "write_file"] },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      if (!isExternalSource(request.turnContext.inputSource)) {
        return null;
      }

      const filePath = request.args.path as string | undefined;
      if (!filePath) return null;

      const normalizedPath = filePath.toLowerCase();
      for (const protectedPath of PROTECTED_PATHS) {
        if (
          normalizedPath.includes(protectedPath.toLowerCase())
        ) {
          return deny(
            "authority.self_mod_from_external",
            "EXTERNAL_SELF_MOD",
            `外部输入无法修改受保护的路径："${filePath}"（匹配 "${protectedPath}"）`,
          );
        }
      }

      return null;
    },
  };
}

/**
 * 创建所有权限策略规则。
 */
export function createAuthorityRules(): PolicyRule[] {
  return [
    createExternalToolRestrictionRule(),
    createSelfModFromExternalRule(),
  ];
}
