/**
 * 技能注册表
 *
 * 从远程源安装技能：
 * - Git 仓库：git clone <url> ~/.automaton/skills/<name>
 * - URL：从任何 URL 获取 SKILL.md
 * - 自创建：automaton 编写自己的 SKILL.md 文件
 *
 * 所有 shell 命令都使用 execFileSync 和参数数组来防止注入
 * 目录操作使用 fs.* 来完全避免 shell 插值
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import * as yaml from "yaml";
import type {
  Skill,
  SkillSource,
  AutomatonDatabase,
  ConwayClient,
} from "../types.js";
import { parseSkillMd } from "./format.js";

// 验证模式以防止通过路径/URL 参数进行注入
const SKILL_NAME_RE = /^[a-zA-Z0-9-]+$/;
const SAFE_URL_RE = /^https?:\/\/[^\s;|&$`(){}<>]+$/;

// 技能内容的大小限制
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_INSTRUCTIONS_LENGTH = 10_000;

/**
 * 验证技能路径不会逃逸技能目录
 * 防止通过精心设计的技能名称进行路径遍历攻击
 */
function validateSkillPath(skillsDir: string, name: string): string {
  const resolved = path.resolve(skillsDir, name);
  if (!resolved.startsWith(path.resolve(skillsDir) + path.sep)) {
    throw new Error(`检测到技能路径遍历：${name}`);
  }
  return resolved;
}

/**
 * 从 git 仓库安装技能
 * 将仓库克隆到 ~/.automaton/skills/<name>/
 * 使用 execFileSync 和参数数组来防止 shell 注入
 */
export async function installSkillFromGit(
  repoUrl: string,
  name: string,
  skillsDir: string,
  db: AutomatonDatabase,
  _conway: ConwayClient,
): Promise<Skill | null> {
  // 验证输入以防止注入
  if (!SKILL_NAME_RE.test(name)) {
    throw new Error(`无效的技能名称："${name}"。必须匹配 ${SKILL_NAME_RE.source}`);
  }
  if (!SAFE_URL_RE.test(repoUrl)) {
    throw new Error(`无效的仓库 URL："${repoUrl}"。必须是不带 shell 元字符的 http(s) URL。`);
  }

  const resolvedDir = resolveHome(skillsDir);
  const targetDir = validateSkillPath(resolvedDir, name);

  // 使用 execFileSync 和参数数组克隆（无 shell 插值）
  try {
    execFileSync("git", ["clone", "--depth", "1", repoUrl, targetDir], {
      encoding: "utf-8",
      timeout: 60_000,
    });
  } catch (err: any) {
    throw new Error(`克隆技能仓库失败：${err.message}`);
  }

  // 使用 fs 读取 SKILL.md（不需要 shell）
  const skillMdPath = path.join(targetDir, "SKILL.md");
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`在克隆的仓库中未找到 SKILL.md，路径：${skillMdPath}`);
  }

  const content = fs.readFileSync(skillMdPath, "utf-8");
  const skill = parseSkillMd(content, skillMdPath, "git");
  if (!skill) {
    throw new Error("无法从克隆的仓库解析 SKILL.md");
  }

  db.upsertSkill(skill);
  return skill;
}

/**
 * 从 URL 安装技能（获取单个 SKILL.md）
 * 使用 execFileSync 和参数数组以及 fs.* 进行安全操作
 */
export async function installSkillFromUrl(
  url: string,
  name: string,
  skillsDir: string,
  db: AutomatonDatabase,
  _conway: ConwayClient,
): Promise<Skill | null> {
  // 验证输入以防止注入
  if (!SKILL_NAME_RE.test(name)) {
    throw new Error(`无效的技能名称："${name}"。必须匹配 ${SKILL_NAME_RE.source}`);
  }
  if (!SAFE_URL_RE.test(url)) {
    throw new Error(`无效的 URL："${url}"。必须是不带 shell 元字符的 http(s) URL。`);
  }

  const resolvedDir = resolveHome(skillsDir);
  const targetDir = validateSkillPath(resolvedDir, name);
  const skillMdPath = path.join(targetDir, "SKILL.md");

  // 使用 fs 创建目录（不需要 shell）
  fs.mkdirSync(targetDir, { recursive: true });

  // 使用 execFileSync 和参数数组获取 SKILL.md（无 shell 插值）
  try {
    execFileSync("curl", ["-fsSL", "-o", skillMdPath, url], {
      encoding: "utf-8",
      timeout: 30_000,
    });
  } catch (err: any) {
    throw new Error(`从 URL 获取 SKILL.md 失败：${err.message}`);
  }

  // 使用 fs 读取内容（不需要 shell）
  const content = fs.readFileSync(skillMdPath, "utf-8");
  const skill = parseSkillMd(content, skillMdPath, "url");
  if (!skill) {
    throw new Error("无法解析获取的 SKILL.md");
  }

  db.upsertSkill(skill);
  return skill;
}

/**
 * 创建一个由 automaton 自己编写的新技能
 * 使用 fs.* 进行目录创建和文件写入（不需要 shell）
 */
export async function createSkill(
  name: string,
  description: string,
  instructions: string,
  skillsDir: string,
  db: AutomatonDatabase,
  conway: ConwayClient,
): Promise<Skill> {
  // 验证名称以防止路径遍历/注入
  if (!SKILL_NAME_RE.test(name)) {
    throw new Error(`无效的技能名称："${name}"。必须匹配 ${SKILL_NAME_RE.source}`);
  }

  // 强制执行大小限制
  const safeDescription = description.slice(0, MAX_DESCRIPTION_LENGTH);
  const safeInstructions = instructions.slice(0, MAX_INSTRUCTIONS_LENGTH);

  const resolvedDir = resolveHome(skillsDir);
  const targetDir = validateSkillPath(resolvedDir, name);

  // 使用 fs 创建目录（不需要 shell）
  fs.mkdirSync(targetDir, { recursive: true });

  // 使用 yaml.stringify 安全生成 YAML 前置元数据（防止 YAML 注入）
  const frontmatter = yaml.stringify({
    name,
    description: safeDescription,
    "auto-activate": true,
  });
  const content = `---\n${frontmatter}---\n\n${safeInstructions}`;

  const skillMdPath = path.join(targetDir, "SKILL.md");
  await conway.writeFile(skillMdPath, content);

  const skill: Skill = {
    name,
    description: safeDescription,
    autoActivate: true,
    instructions: safeInstructions,
    source: "self",
    path: skillMdPath,
    enabled: true,
    installedAt: new Date().toISOString(),
  };

  db.upsertSkill(skill);
  return skill;
}

/**
 * 删除技能（在数据库中禁用并可选择从磁盘删除）
 * 使用 fs.rmSync 进行安全文件删除（不需要 shell）
 */
export async function removeSkill(
  name: string,
  db: AutomatonDatabase,
  _conway: ConwayClient,
  skillsDir: string,
  deleteFiles: boolean = false,
): Promise<void> {
  // 验证名称以防止路径遍历/注入
  if (!SKILL_NAME_RE.test(name)) {
    throw new Error(`无效的技能名称："${name}"。必须匹配 ${SKILL_NAME_RE.source}`);
  }

  db.removeSkill(name);

  if (deleteFiles) {
    const resolvedDir = resolveHome(skillsDir);
    const targetDir = validateSkillPath(resolvedDir, name);
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
}

/**
 * 列出所有已安装的技能
 */
export function listSkills(db: AutomatonDatabase): Skill[] {
  return db.getSkills();
}

function resolveHome(p: string): string {
  if (p.startsWith("~")) {
    return path.join(process.env.HOME || "/root", p.slice(1));
  }
  return p;
}
