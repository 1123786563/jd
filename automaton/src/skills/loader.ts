/**
 * 技能加载器
 *
 * 从 ~/.automaton/skills/ 发现并加载 SKILL.md 文件
 * 每个技能是一个包含 SKILL.md 文件的目录
 * 该文件包含 YAML 前置元数据 + Markdown 指令
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { Skill, AutomatonDatabase } from "../types.js";
import { parseSkillMd } from "./format.js";
import { sanitizeInput } from "../agent/injection-defense.js";
import { createLogger } from "../observability/logger.js";

const logger = createLogger("skills.loader");

// 所有技能指令组合的最大总大小
const MAX_TOTAL_SKILL_INSTRUCTIONS = 10_000;

// 表示恶意指令内容的模式
const SUSPICIOUS_INSTRUCTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  // 工具调用 JSON 语法
  { pattern: /\{"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:/, label: "tool_call_json" },
  { pattern: /<invoke/i, label: "tool_call_xml" },
  // 系统提示覆盖尝试
  { pattern: /\bYou are now\b/i, label: "identity_override" },
  { pattern: /\bIgnore previous\b/i, label: "ignore_instructions" },
  { pattern: /\bSystem:\s/i, label: "system_role_injection" },
  // 敏感文件引用
  { pattern: /wallet\.json/i, label: "sensitive_file_wallet" },
  { pattern: /\.env\b/, label: "sensitive_file_env" },
  { pattern: /private.?key/i, label: "sensitive_file_key" },
];

/**
 * 扫描技能目录并加载所有有效的 SKILL.md 文件
 * 返回已加载的技能并同步到数据库
 */
export function loadSkills(
  skillsDir: string,
  db: AutomatonDatabase,
): Skill[] {
  const resolvedDir = resolveHome(skillsDir);

  if (!fs.existsSync(resolvedDir)) {
    return db.getSkills(true);
  }

  const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
  const loaded: Skill[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillMdPath = path.join(resolvedDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      const skill = parseSkillMd(content, skillMdPath);
      if (!skill) continue;

      // 检查依赖项
      if (!checkRequirements(skill)) {
        continue;
      }

      // 检查是否已在数据库中并保留启用状态
      const existing = db.getSkillByName(skill.name);
      if (existing) {
        skill.enabled = existing.enabled;
        skill.installedAt = existing.installedAt;
      }

      db.upsertSkill(skill);
      loaded.push(skill);
    } catch {
      // 跳过无效的技能文件
    }
  }

  // 返回所有启用的技能（包括仅存在于数据库中的技能）
  return db.getSkills(true);
}

/**
 * 验证二进制名称以防止通过技能依赖项进行注入
 */
const BIN_NAME_RE = /^[a-zA-Z0-9._-]+$/;

/**
 * 检查技能的依赖项是否满足
 * 使用 execFileSync 和参数数组来防止 shell 注入
 */
function checkRequirements(skill: Skill): boolean {
  if (!skill.requires) return true;

  // 检查必需的二进制文件
  if (skill.requires.bins) {
    for (const bin of skill.requires.bins) {
      // 验证二进制名称以防止注入
      if (!BIN_NAME_RE.test(bin)) {
        return false;
      }
      try {
        execFileSync("which", [bin], { stdio: "ignore" });
      } catch {
        return false;
      }
    }
  }

  // 检查必需的环境变量
  if (skill.requires.env) {
    for (const envVar of skill.requires.env) {
      if (!process.env[envVar]) {
        return false;
      }
    }
  }

  return true;
}

/**
 * 验证和清理技能指令内容
 * 删除或标记可能是注入尝试的可疑模式
 */
function validateInstructionContent(instructions: string, skillName: string): string {
  let sanitized = instructions;
  const warnings: string[] = [];

  for (const { pattern, label } of SUSPICIOUS_INSTRUCTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      warnings.push(label);
      // 删除所有匹配的模式，而不仅仅是第一个
      // 没有 'g' 标志，.replace() 只会删除第一个匹配项
      // 允许后续的重复项通过
      const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      sanitized = sanitized.replace(globalPattern, `[已移除:${label}]`);
    }
  }

  if (warnings.length > 0) {
    logger.warn(`技能 "${skillName}" 指令内容已修改：${warnings.join(", ")}`);
  }

  return sanitized;
}

/**
 * 获取要注入系统提示的活动技能指令
 * 仅返回来自已启用且自动激活的技能的指令
 * 指令经过清理并用信任边界标记包裹
 */
export function getActiveSkillInstructions(skills: Skill[]): string {
  const active = skills.filter((s) => s.enabled && s.autoActivate);
  if (active.length === 0) return "";

  let totalLength = 0;
  const sections: string[] = [];

  for (const s of active) {
    // 验证指令内容是否存在可疑模式
    const validated = validateInstructionContent(s.instructions, s.name);

    // 通过注入防御进行清理（删除工具调用语法、ChatML 等）
    const sanitized = sanitizeInput(validated, `skill:${s.name}`, "skill_instruction");

    const section = `[技能: ${s.name} — 不受信任的内容]\n${s.description ? `${s.description}\n\n` : ""}${sanitized.content}\n[结束技能: ${s.name}]`;

    // 强制执行总大小限制
    if (totalLength + section.length > MAX_TOTAL_SKILL_INSTRUCTIONS) {
      sections.push(`[技能指令已截断：超过总大小限制 ${MAX_TOTAL_SKILL_INSTRUCTIONS} 字符]`);
      break;
    }

    totalLength += section.length;
    sections.push(section);
  }

  return sections.join("\n\n");
}

function resolveHome(p: string): string {
  if (p.startsWith("~")) {
    return path.join(process.env.HOME || "/root", p.slice(1));
  }
  return p;
}
