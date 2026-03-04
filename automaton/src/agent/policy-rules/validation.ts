/**
 * 输入验证策略规则
 *
 * 在执行前验证工具参数。在到达任何 shell 命令或 API 调用之前
 * 捕获格式错误的输入。
 */

import type { PolicyRule, PolicyRequest, PolicyRuleResult } from "../../types.js";

const PACKAGE_NAME_RE = /^[@a-zA-Z0-9._/-]+$/;
const SKILL_NAME_RE = /^[a-zA-Z0-9-]+$/;
const GIT_HASH_RE = /^[a-f0-9]{7,40}$/;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const CRON_PARTS_RE = /^(\*|[\d,*/-]+)\s+(\*|[\d,*/-]+)\s+(\*|[\d,*/-]+)\s+(\*|[\d,*/-]+)\s+(\*|[\d,*/-]+)$/;

function deny(rule: string, reasonCode: string, humanMessage: string): PolicyRuleResult {
  return { rule, action: "deny", reasonCode, humanMessage };
}

/**
 * 验证 npm 包名称格式。
 */
function createPackageNameRule(): PolicyRule {
  return {
    id: "validate.package_name",
    description: "验证 npm 包名称格式",
    priority: 100,
    appliesTo: {
      by: "name",
      names: ["install_npm_package", "install_mcp_server"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const pkg = request.args.package as string | undefined;
      if (pkg === undefined) return null;

      if (!PACKAGE_NAME_RE.test(pkg)) {
        return deny(
          "validate.package_name",
          "VALIDATION_FAILED",
          `无效的包名称："${pkg}"。必须匹配 ${PACKAGE_NAME_RE.source}`,
        );
      }
      return null;
    },
  };
}

/**
 * 验证技能名称格式。
 */
function createSkillNameRule(): PolicyRule {
  return {
    id: "validate.skill_name",
    description: "验证技能名称格式（仅字母数字和连字符）",
    priority: 100,
    appliesTo: {
      by: "name",
      names: ["install_skill", "create_skill", "remove_skill"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const name = request.args.name as string | undefined;
      if (name === undefined) return null;

      if (!SKILL_NAME_RE.test(name)) {
        return deny(
          "validate.skill_name",
          "VALIDATION_FAILED",
          `无效的技能名称："${name}"。必须匹配 ${SKILL_NAME_RE.source}`,
        );
      }
      return null;
    },
  };
}

/**
 * 验证 git 提交哈希格式。
 */
function createGitHashRule(): PolicyRule {
  return {
    id: "validate.git_hash",
    description: "验证 git 提交哈希格式",
    priority: 100,
    appliesTo: {
      by: "name",
      names: ["pull_upstream"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const commit = request.args.commit as string | undefined;
      if (commit === undefined) return null; // commit 是可选的

      if (!GIT_HASH_RE.test(commit)) {
        return deny(
          "validate.git_hash",
          "VALIDATION_FAILED",
          `无效的 git 哈希："${commit}"。必须是 7-40 位小写十六进制字符。`,
        );
      }
      return null;
    },
  };
}

/**
 * 验证端口号范围。
 */
function createPortRangeRule(): PolicyRule {
  return {
    id: "validate.port_range",
    description: "验证端口号在有效范围内（1-65535）",
    priority: 100,
    appliesTo: {
      by: "name",
      names: ["expose_port", "remove_port"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const port = request.args.port as number | undefined;
      if (port === undefined) return null;

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return deny(
          "validate.port_range",
          "VALIDATION_FAILED",
          `无效的端口号：${port}。必须是 1-65535 之间的整数。`,
        );
      }
      return null;
    },
  };
}

/**
 * 验证 cron 表达式结构。
 */
function createCronExpressionRule(): PolicyRule {
  return {
    id: "validate.cron_expression",
    description: "验证 cron 表达式格式",
    priority: 100,
    appliesTo: {
      by: "name",
      names: ["modify_heartbeat"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const schedule = request.args.schedule as string | undefined;
      if (schedule === undefined) return null;

      if (!CRON_PARTS_RE.test(schedule.trim())) {
        return deny(
          "validate.cron_expression",
          "VALIDATION_FAILED",
          `无效的 cron 表达式："${schedule}"。必须是 5 个空格分隔的字段。`,
        );
      }
      return null;
    },
  };
}

/**
 * 验证以太坊地址格式。
 */
function createAddressFormatRule(): PolicyRule {
  return {
    id: "validate.address_format",
    description: "验证以太坊地址格式（0x + 40 位十六进制字符）",
    priority: 100,
    appliesTo: {
      by: "name",
      names: ["transfer_credits", "send_message", "fund_child"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const address = (request.args.to_address as string | undefined)
        ?? (request.args.agent_address as string | undefined);
      if (address === undefined) return null;

      if (!ADDRESS_RE.test(address)) {
        return deny(
          "validate.address_format",
          "VALIDATION_FAILED",
          `无效的地址格式："${address}"。必须是 0x 后跟 40 位十六进制字符。`,
        );
      }
      return null;
    },
  };
}

export function createValidationRules(): PolicyRule[] {
  return [
    createPackageNameRule(),
    createSkillNameRule(),
    createGitHashRule(),
    createPortRangeRule(),
    createCronExpressionRule(),
    createAddressFormatRule(),
  ];
}
