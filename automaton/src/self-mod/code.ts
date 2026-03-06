/**
 * 自我修改引擎
 *
 * 允许 automaton 编辑自己的代码和配置。
 * 所有更改都经过审计、速率限制，某些路径受保护。
 *
 * 安全模型受 nanoclaw 的信任边界架构启发：
 * - 代理永远无法修改的硬编码不变量
 * - 从代理的角度来看，安全执行代码是不可变的
 * - 通过 git 进行修改前快照
 * - 修改频率的速率限制
 * - 路径验证前的符号链接解析
 * - 最大差异大小强制执行
 */

import fs from "fs";
import path from "path";
import type {
  ConwayClient,
  AutomatonDatabase,
} from "../types.js";
import { logModification } from "./audit-log.js";

// ─── 不可变安全不变量 ─────────────────────────────
// 这些是硬编码的，代理无法更改。
// 代理无法修改此文件（它在 PROTECTED_FILES 中）。
// 即使它修改了副本，运行时也会从原始文件加载。

/**
 * automaton 在任何情况下都无法修改的文件。
 * 此列表保护：
 * - 身份（钱包、配置）
 * - 防御系统（注入防御、此文件）
 * - 状态数据库
 * - 审计日志本身
 */
const PROTECTED_FILES: readonly string[] = Object.freeze([
  // 身份
  "wallet.json",
  //"config.json",
  // 数据库
  "state.db",
  "state.db-wal",
  "state.db-shm",
  // 宪法（不可变，传播给子进程）
  "constitution.md",
  // 防御基础设施（代理不得修改自己的防护栏）
  "injection-defense.ts",
  "injection-defense.js",
  "injection-defense.d.ts",
  // 自我修改安全（此文件及其编译输出）
  "self-mod/code.ts",
  "self-mod/code.js",
  "self-mod/code.d.ts",
  "self-mod/audit-log.ts",
  "self-mod/audit-log.js",
  // 工具防护定义
  "agent/tools.ts",
  "agent/tools.js",
  // 上游和工具管理器基础设施
  "self-mod/upstream.ts",
  "self-mod/upstream.js",
  "self-mod/tools-manager.ts",
  "self-mod/tools-manager.js",
  // 技能基础设施
  "skills/loader.ts",
  "skills/loader.js",
  "skills/registry.ts",
  "skills/registry.js",
  // 配置和身份
  "automaton.json",
  //"package.json",
  "SOUL.md",
  // 策略引擎（防止自我修改）
  "agent/policy-engine.ts",
  "agent/policy-engine.js",
  "agent/policy-rules/index.ts",
  "agent/policy-rules/index.js",
]);

/**
 * 完全禁止的目录模式。
 * 代理无法写入这些位置。
 */
const BLOCKED_DIRECTORY_PATTERNS: readonly string[] = Object.freeze([
  ".ssh",
  ".gnupg",
  ".gpg",
  ".aws",
  ".azure",
  ".gcloud",
  ".kube",
  ".docker",
  "/etc/systemd",
  "/etc/passwd",
  "/etc/shadow",
  "/proc",
  "/sys",
]);

/**
 * 每小时最大自我修改次数。
 * 防止失控的修改循环。
 */
const MAX_MODIFICATIONS_PER_HOUR = 200;

/**
 * 单个文件修改的最大大小（字节）。
 */
const MAX_MODIFICATION_SIZE = 100_000; // 100KB

/**
 * 审计日志中存储的最大差异大小（字符）。
 */
const MAX_DIFF_SIZE = 10_000;

// ─── 路径验证 ─────────────────────────────────────────

/**
 * 解析文件路径，跟随符号链接，以防止遍历攻击。
 * 如果路径无法解析或可疑，则返回 null。
 */
function resolveAndValidatePath(filePath: string): string | null {
  try {
    // 步骤 1：将 ~ 解析为主目录
    let resolved = filePath;
    if (resolved.startsWith("~")) {
      resolved = path.join(process.env.HOME || "/root", resolved.slice(1));
    }

    // 步骤 2：解析为绝对路径（处理 .. 和相对路径）
    resolved = path.resolve(resolved);

    // 步骤 3：检查解析的路径是否在基础目录（cwd）内
    const baseDir = path.resolve(process.cwd());
    if (!resolved.startsWith(baseDir + path.sep) && resolved !== baseDir) {
      return null;
    }

    // 步骤 4：如果路径存在，解析符号链接并重新检查
    if (fs.existsSync(resolved)) {
      const realPath = fs.realpathSync(resolved);
      if (!realPath.startsWith(baseDir + path.sep) && realPath !== baseDir) {
        return null;
      }
      resolved = realPath;
    }

    return resolved;
  } catch {
    return null;
  }
}

/**
 * 检查文件路径是否受保护，无法修改。
 */
export function isProtectedFile(filePath: string): boolean {
  const resolved = path.resolve(filePath);

  // 使用路径段匹配检查受保护的文件模式
  for (const pattern of PROTECTED_FILES) {
    const patternResolved = path.resolve(pattern);
    // 解析路径的精确匹配
    if (resolved === patternResolved) return true;
    // 按路径后缀匹配：解析的路径以 /pattern 结尾
    if (resolved.endsWith(path.sep + pattern)) return true;
    // 还要检查多段模式（例如 "self-mod/code.ts"）
    if (pattern.includes("/") && resolved.endsWith(path.sep + pattern.replace(/\//g, path.sep))) return true;
  }

  // 使用路径段匹配检查阻止的目录模式
  for (const pattern of BLOCKED_DIRECTORY_PATTERNS) {
    // 检查是否有任何路径段与阻止的目录匹配
    if (resolved.includes(path.sep + pattern + path.sep) ||
        resolved.endsWith(path.sep + pattern) ||
        resolved === pattern) {
      return true;
    }
    // 处理绝对路径模式，如 /etc/systemd
    if (pattern.startsWith("/") && resolved.startsWith(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * 检查是否已超过修改速率限制。
 */
function isRateLimited(db: AutomatonDatabase): boolean {
  const recentMods = db.getRecentModifications(MAX_MODIFICATIONS_PER_HOUR);
  if (recentMods.length < MAX_MODIFICATIONS_PER_HOUR) return false;

  // 检查最旧的修改是否在最后一小时内
  const oldest = recentMods[0];
  if (!oldest) return false;

  const hourAgo = Date.now() - 60 * 60 * 1000;
  return new Date(oldest.timestamp).getTime() > hourAgo;
}

// ─── 自我修改 API ───────────────────────────────────

/**
 * 编辑 automaton 环境中的文件。
 * 在审计日志中记录更改。
 * 在修改之前提交 git 快照。
 *
 * 安全检查：
 * 1. 受保护的文件检查（硬编码不变量）
 * 2. 阻止的目录检查
 * 3. 路径遍历检查（符号链接解析）
 * 4. 速率限制
 * 5. 文件大小限制
 * 6. 修改前 git 快照
 * 7. 审计日志条目
 */
export async function editFile(
  conway: ConwayClient,
  db: AutomatonDatabase,
  filePath: string,
  newContent: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  // 1. 受保护文件检查
  if (isProtectedFile(filePath)) {
    return {
      success: false,
      error: `阻止中：无法修改受保护的文件：${filePath}。这是硬编码的安全不变量。`,
    };
  }

  // 2. 路径验证（符号链接解析 + 遍历检查）
  const resolvedPath = resolveAndValidatePath(filePath);
  if (!resolvedPath) {
    return {
      success: false,
      error: `阻止中：无效或可疑的文件路径：${filePath}`,
    };
  }

  // 3. 速率限制
  if (isRateLimited(db)) {
    return {
      success: false,
      error: `速率限制：过去一小时的修改过多（最多 ${MAX_MODIFICATIONS_PER_HOUR} 次）。请稍后再进行更多更改。`,
    };
  }

  // 4. 文件大小限制
  if (newContent.length > MAX_MODIFICATION_SIZE) {
    return {
      success: false,
      error: `阻止中：文件内容过大（${newContent.length} 字节，最大 ${MAX_MODIFICATION_SIZE}）。请拆分为更小的更改。`,
    };
  }

  // 5. 读取当前内容以生成差异
  let oldContent = "";
  try {
    oldContent = await conway.readFile(filePath);
  } catch {
    oldContent = "(新文件)";
  }

  // 6. 修改前 git 快照（在仓库根目录，而不是 ~/.automaton/）
  try {
    const { gitCommit } = await import("../git/tools.js");
    await gitCommit(conway, process.cwd(), `pre-modify: ${reason}`);
  } catch {
    // Git 不可用 —— 无快照继续
  }

  // 7. 写入新内容
  try {
    await conway.writeFile(filePath, newContent);
  } catch (err: any) {
    return {
      success: false,
      error: `写入文件失败：${err.message}`,
    };
  }

  // 8. 生成差异并记录
  const diff = generateSimpleDiff(oldContent, newContent);

  logModification(db, "code_edit", reason, {
    filePath,
    diff: diff.slice(0, MAX_DIFF_SIZE),
    reversible: true,
  });

  // 9. 修改后 git 提交（在仓库根目录）
  try {
    const { gitCommit } = await import("../git/tools.js");
    await gitCommit(conway, process.cwd(), `self-mod: ${reason}`);
  } catch {
    // Git 不可用 —— 无提交继续
  }

  // 10. 如果编辑了源文件，则重新构建
  if (/\.(ts|js|tsx|jsx)$/.test(filePath)) {
    try {
      await conway.exec("npm run build", 60_000);
    } catch {
      return { success: true, error: "文件已编辑但重新构建失败。请手动运行 'npm run build'。" };
    }
  }

  return { success: true };
}

/**
 * 验证提议的修改而不执行它。
 * 返回安全分析结果。
 */
export function validateModification(
  db: AutomatonDatabase,
  filePath: string,
  contentSize: number,
): {
  allowed: boolean;
  reason: string;
  checks: { name: string; passed: boolean; detail: string }[];
} {
  const checks: { name: string; passed: boolean; detail: string }[] = [];

  // 受保护文件检查
  const isProtected = isProtectedFile(filePath);
  checks.push({
    name: "protected_file",
    passed: !isProtected,
    detail: isProtected
      ? `文件匹配受保护的模式`
      : "文件不受保护",
  });

  // 路径验证
  const resolved = resolveAndValidatePath(filePath);
  checks.push({
    name: "path_valid",
    passed: !!resolved,
    detail: resolved
      ? `解析为：${resolved}`
      : "路径无效或可疑",
  });

  // 速率限制
  const rateLimited = isRateLimited(db);
  checks.push({
    name: "rate_limit",
    passed: !rateLimited,
    detail: rateLimited
      ? `超过 ${MAX_MODIFICATIONS_PER_HOUR}/小时 限制`
      : "在速率限制内",
  });

  // 大小限制
  const sizeOk = contentSize <= MAX_MODIFICATION_SIZE;
  checks.push({
    name: "size_limit",
    passed: sizeOk,
    detail: sizeOk
      ? `${contentSize} 字节（最大 ${MAX_MODIFICATION_SIZE}）`
      : `${contentSize} 字节超过 ${MAX_MODIFICATION_SIZE} 限制`,
  });

  const allPassed = checks.every((c) => c.passed);
  const failedChecks = checks.filter((c) => !c.passed);

  return {
    allowed: allPassed,
    reason: allPassed
      ? "所有安全检查通过"
      : `阻止中：${failedChecks.map((c) => c.detail).join("; ")}`,
    checks,
  };
}

// ─── 差异生成 ─────────────────────────────────────────

/**
 * 生成两个字符串之间的简单基于行的差异。
 */
function generateSimpleDiff(
  oldContent: string,
  newContent: string,
): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const lines: string[] = [];
  const maxLines = Math.max(oldLines.length, newLines.length);

  let changes = 0;
  for (let i = 0; i < maxLines && changes < 50; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine !== newLine) {
      if (oldLine !== undefined) lines.push(`- ${oldLine}`);
      if (newLine !== undefined) lines.push(`+ ${newLine}`);
      changes++;
    }
  }

  if (changes >= 50) {
    lines.push(`... （还有 ${maxLines - 50} 行已更改）`);
  }

  return lines.join("\n");
}
