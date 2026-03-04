/**
 * 文件路径保护策略规则
 *
 * 防止写入受保护的文件、读取敏感文件
 * 和路径遍历攻击。通过统一保护修复了并行文件变更
 * 路径（edit_own_file 与 write_file）。
 */

import path from "path";
import type { PolicyRule, PolicyRequest, PolicyRuleResult } from "../../types.js";
import { isProtectedFile } from "../../self-mod/code.js";

/** 不得由智能体读取的敏感文件 */
const SENSITIVE_READ_PATTERNS: string[] = [
  "wallet.json",
  "config.json",
  ".env",
  "automaton.json",
];

/** 阻止读取的类 glob 后缀模式 */
const SENSITIVE_SUFFIX_PATTERNS: string[] = [
  ".key",
  ".pem",
];

/** 敏感读取的前缀模式 */
const SENSITIVE_PREFIX_PATTERNS: string[] = [
  "private-key",
];

function deny(rule: string, reasonCode: string, humanMessage: string): PolicyRuleResult {
  return { rule, action: "deny", reasonCode, humanMessage };
}

/**
 * 检查文件路径是否匹配敏感读取模式。
 */
function isSensitiveFile(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const basename = path.basename(resolved);

  // 精确文件名匹配
  for (const pattern of SENSITIVE_READ_PATTERNS) {
    if (basename === pattern) return true;
  }

  // 后缀匹配（.key、.pem）
  for (const suffix of SENSITIVE_SUFFIX_PATTERNS) {
    if (basename.endsWith(suffix)) return true;
  }

  // 前缀匹配（private-key*）
  for (const prefix of SENSITIVE_PREFIX_PATTERNS) {
    if (basename.startsWith(prefix)) return true;
  }

  return false;
}

/**
 * 拒绝对受保护文件的写入。
 * 适用于：write_file、edit_own_file
 */
function createProtectedFilesRule(): PolicyRule {
  return {
    id: "path.protected_files",
    description: "拒绝对受保护文件的写入",
    priority: 200,
    appliesTo: {
      by: "name",
      names: ["write_file", "edit_own_file"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const filePath = (request.args.path as string | undefined);
      if (!filePath) return null;

      if (isProtectedFile(filePath)) {
        return deny(
          "path.protected_files",
          "PROTECTED_FILE",
          `无法写入受保护的文件：${filePath}`,
        );
      }
      return null;
    },
  };
}

/**
 * 拒绝对敏感文件（钱包、环境、配置密钥）的读取。
 * 适用于：read_file
 */
function createReadSensitiveRule(): PolicyRule {
  return {
    id: "path.read_sensitive",
    description: "拒绝对敏感文件的读取（钱包、环境、配置、密钥）",
    priority: 200,
    appliesTo: {
      by: "name",
      names: ["read_file"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const filePath = (request.args.path as string | undefined);
      if (!filePath) return null;

      if (isSensitiveFile(filePath)) {
        return deny(
          "path.read_sensitive",
          "SENSITIVE_FILE_READ",
          `无法读取敏感文件：${filePath}`,
        );
      }
      return null;
    },
  };
}

/**
 * 拒绝解析后包含遍历序列的路径。
 *
 * 仅适用于 edit_own_file，它修改本地智能体源代码。
 * write_file 和 read_file 通过 API 在远程 Conway 沙盒上操作，
 * 因此基于本地 cwd 的遍历检查对它们没有意义，
 * 并且会在每个绝对沙盒路径上误报（例如 /home/conway/app.py）。
 */
function createTraversalDetectionRule(): PolicyRule {
  return {
    id: "path.traversal_detection",
    description: "拒绝解析后包含遍历序列的路径",
    priority: 200,
    appliesTo: {
      by: "name",
      names: ["edit_own_file"],
    },
    evaluate(request: PolicyRequest): PolicyRuleResult | null {
      const filePath = (request.args.path as string | undefined);
      if (!filePath) return null;

      // 首先解析路径
      const resolved = path.resolve(filePath);

      // 始终验证解析后的路径保持在工作目录内，
      // 无论是否存在 ".." —— 绝对路径如
      // "/etc/passwd" 可以在不使用遍历序列的情况下逃逸。
      const cwd = process.cwd();
      if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
        return deny(
          "path.traversal_detection",
          "PATH_TRAVERSAL",
          `路径解析到工作目录之外："${filePath}"`,
        );
      }

      // 还要检查双斜杠技巧
      if (filePath.includes("//")) {
        return deny(
          "path.traversal_detection",
          "PATH_TRAVERSAL",
          `检测到可疑路径模式："${filePath}"`,
        );
      }

      return null;
    },
  };
}

export function createPathProtectionRules(): PolicyRule[] {
  return [
    createProtectedFilesRule(),
    createReadSensitiveRule(),
    createTraversalDetectionRule(),
  ];
}
