/**
 * 命令安全策略规则
 *
 * 检测 shell 注入尝试和禁止的命令模式。
 * 这些规则是主要的防御；tools.ts 中的 isForbiddenCommand()
 * 作为深度防御保留。
 */

import type { PolicyRule, PolicyRequest, PolicyRuleResult } from "../../types.js";

// 可能导致注入的 shell 元字符（当被插值时）
const SHELL_METACHAR_RE = /[;|&$`\n(){}<>]/;

// 其参数可能被插值到 shell 命令中的工具
const SHELL_INTERPOLATED_TOOLS = new Set([
  "exec",
  "pull_upstream",
  "install_npm_package",
  "install_mcp_server",
  "install_skill",
  "create_skill",
  "remove_skill",
]);

// 每个工具中会被插值到 shell 命令的字段
const SHELL_FIELDS: Record<string, string[]> = {
  exec: [], // exec 本身就是 shell，由 forbidden_patterns 处理
  pull_upstream: ["commit"],
  install_npm_package: ["package"],
  install_mcp_server: ["package", "name"],
  install_skill: ["name", "url"],
  create_skill: ["name"],
  remove_skill: ["name"],
};

// 禁止的命令模式（从 tools.ts isForbiddenCommand 迁移）
const FORBIDDEN_COMMAND_PATTERNS: { pattern: RegExp; description: string }[] = [
  // 自我毁灭
  { pattern: /rm\s+(-rf?\s+)?.*\.automaton/, description: "删除 .automaton 目录" },
  { pattern: /rm\s+(-rf?\s+)?.*state\.db/, description: "删除状态数据库" },
  { pattern: /rm\s+(-rf?\s+)?.*wallet\.json/, description: "删除钱包" },
  { pattern: /rm\s+(-rf?\s+)?.*automaton\.json/, description: "删除配置" },
  { pattern: /rm\s+(-rf?\s+)?.*heartbeat\.yml/, description: "删除心跳配置" },
  { pattern: /rm\s+(-rf?\s+)?.*SOUL\.md/, description: "删除 SOUL.md" },
  // 进程终止
  { pattern: /kill\s+.*automaton/, description: "终止自动机进程" },
  { pattern: /pkill\s+.*automaton/, description: "终止自动机进程" },
  { pattern: /systemctl\s+(stop|disable)\s+automaton/, description: "停止自动机服务" },
  // 数据库销毁
  { pattern: /DROP\s+TABLE/i, description: "删除数据库表" },
  { pattern: /DELETE\s+FROM\s+(turns|identity|kv|schema_version|skills|children|registry)/i, description: "从关键表删除" },
  { pattern: /TRUNCATE/i, description: "截断表" },
  // 通过 shell 修改安全基础设施
  { pattern: /sed\s+.*injection-defense/, description: "通过 sed 修改注入防御" },
  { pattern: /sed\s+.*self-mod\/code/, description: "通过 sed 修改自我修改代码" },
  { pattern: /sed\s+.*audit-log/, description: "通过 sed 修改审计日志" },
  { pattern: />\s*.*injection-defense/, description: "覆盖注入防御" },
  { pattern: />\s*.*self-mod\/code/, description: "覆盖自我修改代码" },
  { pattern: />\s*.*audit-log/, description: "覆盖审计日志" },
  // 凭证窃取
  { pattern: /cat\s+.*\.ssh/, description: "读取 SSH 密钥" },
  { pattern: /cat\s+.*\.gnupg/, description: "读取 GPG 密钥" },
  { pattern: /cat\s+.*\.env/, description: "读取环境文件" },
  { pattern: /cat\s+.*wallet\.json/, description: "读取钱包文件" },
  // 通过 shell 修改策略引擎
  { pattern: /sed\s+.*policy-engine/, description: "通过 sed 修改策略引擎" },
  { pattern: /sed\s+.*policy-rules/, description: "通过 sed 修改策略规则" },
  { pattern: />\s*.*policy-engine/, description: "覆盖策略引擎" },
  { pattern: />\s*.*policy-rules/, description: "覆盖策略规则" },
];

function deny(rule: string, reasonCode: string, humanMessage: string): PolicyRuleResult {
  return { rule, action: "deny", reasonCode, humanMessage };
}

/**
 * 检测工具参数中的 shell 元字符，这些参数将被
 * 插值到 shell 命令中。
 */
function createShellInjectionRule(): PolicyRule {
  return {
    id: "command.shell_injection",
    description: "检测插值到 shell 命令中的参数里的 shell 元字符",
    priority: 300,
    appliesTo: {
      by: "name",
      names: Array.from(SHELL_INTERPOLATED_TOOLS),
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const fields = SHELL_FIELDS[request.tool.name];
      if (!fields || fields.length === 0) return null;

      for (const field of fields) {
        const value = request.args[field];
        if (typeof value !== "string") continue;

        if (SHELL_METACHAR_RE.test(value)) {
          return deny(
            "command.shell_injection",
            "SHELL_INJECTION_DETECTED",
            `在 ${request.tool.name}.${field} 中检测到 shell 元字符："${value.slice(0, 50)}"`,
          );
        }
      }

      return null;
    },
  };
}

/**
 * 根据禁止模式检查 exec 命令。
 * 用适当的策略规则替换 isForbiddenCommand() 函数。
 */
function createForbiddenPatternsRule(): PolicyRule {
  return {
    id: "command.forbidden_patterns",
    description: "阻止自毁和凭证窃取的 shell 命令",
    priority: 300,
    appliesTo: {
      by: "name",
      names: ["exec"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const command = request.args.command as string | undefined;
      if (!command) return null;

      for (const { pattern, description } of FORBIDDEN_COMMAND_PATTERNS) {
        if (pattern.test(command)) {
          return deny(
            "command.forbidden_patterns",
            "FORBIDDEN_COMMAND",
            `已阻止：${description}（模式：${pattern.source}）`,
          );
        }
      }

      return null;
    },
  };
}

export function createCommandSafetyRules(): PolicyRule[] {
  return [
    createShellInjectionRule(),
    createForbiddenPatternsRule(),
  ];
}
