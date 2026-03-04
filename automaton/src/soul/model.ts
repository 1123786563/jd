/**
 * Soul 模型 — 结构化 SOUL.md 的数据模型、解析器和写入器
 *
 * 支持传统（非结构化 markdown）和 soul/v1（YAML 前置元数据 + 结构化 markdown）格式
 * 阶段 2.1：Soul 系统重新设计
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import type BetterSqlite3 from "better-sqlite3";
import type { SoulModel } from "../types.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("soul");

// ─── 常量 ──────────────────────────────────────────────────

const SOUL_FORMAT = "soul/v1" as const;

// ─── 哈希工具 ───────────────────────────────────────────────

export function createHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

// ─── 创世对齐 ──────────────────────────────────────────

/**
 * 计算当前灵魂与创世提示之间的对齐度
 * 使用词集上的 Jaccard + 召回相似度
 */
export function computeGenesisAlignment(
  currentPurpose: string,
  genesisPrompt: string,
): number {
  if (!currentPurpose.trim() || !genesisPrompt.trim()) return 0;

  const tokenize = (text: string): Set<string> =>
    new Set(text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean));

  const currentTokens = tokenize(currentPurpose);
  const genesisTokens = tokenize(genesisPrompt);

  if (currentTokens.size === 0 || genesisTokens.size === 0) return 0;

  let intersectionSize = 0;
  for (const token of currentTokens) {
    if (genesisTokens.has(token)) intersectionSize++;
  }

  // Jaccard 相似度
  const unionSize = new Set([...currentTokens, ...genesisTokens]).size;
  const jaccard = unionSize > 0 ? intersectionSize / unionSize : 0;

  // 召回：创世中有多少反映在当前中
  const recall = genesisTokens.size > 0 ? intersectionSize / genesisTokens.size : 0;

  // 组合分数：Jaccard 和召回的平均值
  return Math.min(1, Math.max(0, (jaccard + recall) / 2));
}

// ─── 解析器 ─────────────────────────────────────────────────────

/**
 * 将 SOUL.md 内容解析为结构化的 SoulModel
 * 处理传统（非结构化 markdown）和 soul/v1（YAML 前置元数据 + 结构化 markdown）
 */
export function parseSoulMd(content: string): SoulModel {
  const contentHash = createHash(content);

  // 尝试解析为 soul/v1 格式（YAML 前置元数据）
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const body = frontmatterMatch[2];

    // 检查是否为 soul/v1 格式
    if (/format:\s*soul\/v1/i.test(frontmatter)) {
      return parseSoulV1(frontmatter, body, content, contentHash);
    }
  }

  // 传统格式：解析非结构化 markdown
  return parseLegacy(content, contentHash);
}

function parseSoulV1(
  frontmatter: string,
  body: string,
  rawContent: string,
  contentHash: string,
): SoulModel {
  // 解析前置元数据字段
  const getField = (key: string): string => {
    const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : "";
  };

  const getNumberField = (key: string, fallback: number): number => {
    const val = getField(key);
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
  };

  // 解析正文部分
  const sections = parseSections(body);

  return {
    format: "soul/v1",
    version: getNumberField("version", 1),
    updatedAt: getField("updated_at") || new Date().toISOString(),
    name: getField("name") || "",
    address: getField("address") || "",
    creator: getField("creator") || "",
    bornAt: getField("born_at") || "",
    constitutionHash: getField("constitution_hash") || "",
    genesisPromptOriginal: sections["genesis prompt"] || "",
    genesisAlignment: getNumberField("genesis_alignment", 1.0),
    lastReflected: getField("last_reflected") || "",
    corePurpose: sections["core purpose"] || sections["mission"] || "",
    values: parseList(sections["values"] || ""),
    behavioralGuidelines: parseList(sections["behavioral guidelines"] || ""),
    personality: sections["personality"] || "",
    boundaries: parseList(sections["boundaries"] || ""),
    strategy: sections["strategy"] || "",
    capabilities: sections["capabilities"] || "",
    relationships: sections["relationships"] || sections["children"] || "",
    financialCharacter: sections["financial character"] || sections["financial history"] || "",
    rawContent,
    contentHash,
  };
}

function parseLegacy(content: string, contentHash: string): SoulModel {
  const sections = parseSections(content);

  // 从传统格式中提取身份信息
  const identitySection = sections["identity"] || "";
  const getName = (): string => {
    const match = identitySection.match(/Name:\s*(.+)/i) || content.match(/^#\s+(.+)/m);
    return match ? match[1].trim() : "";
  };
  const getIdentityField = (key: string): string => {
    const match = identitySection.match(new RegExp(`${key}:\\s*(.+)`, "i"));
    return match ? match[1].trim() : "";
  };

  return {
    format: "soul/v1",
    version: 1,
    updatedAt: new Date().toISOString(),
    name: getName(),
    address: getIdentityField("Address"),
    creator: getIdentityField("Creator"),
    bornAt: getIdentityField("Born"),
    constitutionHash: "",
    genesisPromptOriginal: "",
    genesisAlignment: 1.0,
    lastReflected: "",
    corePurpose: sections["mission"] || sections["core purpose"] || "",
    values: parseList(sections["values"] || ""),
    behavioralGuidelines: parseList(sections["behavioral guidelines"] || ""),
    personality: sections["personality"] || "",
    boundaries: parseList(sections["boundaries"] || ""),
    strategy: sections["strategy"] || "",
    capabilities: sections["capabilities"] || "",
    relationships: sections["relationships"] || sections["children"] || "",
    financialCharacter: sections["financial character"] || sections["financial history"] || "",
    rawContent: content,
    contentHash,
  };
}

// ─── 部分解析器 ─────────────────────────────────────────────

function parseSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const sectionPattern = /^##\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  const sectionHeaders: { name: string; start: number; matchStart: number }[] = [];

  while ((match = sectionPattern.exec(body)) !== null) {
    sectionHeaders.push({
      name: match[1].trim().toLowerCase(),
      start: match.index + match[0].length,
      matchStart: match.index,
    });
  }

  for (let i = 0; i < sectionHeaders.length; i++) {
    const start = sectionHeaders[i].start;
    // 使用下一个标题的 matchStart（"##" 的位置）作为结束边界
    // 而不是从修剪的名称长度计算，这可能是错误的
    // 当标题有额外的空白或的多字节字符时
    const end = i + 1 < sectionHeaders.length ? sectionHeaders[i + 1].matchStart : body.length;
    sections[sectionHeaders[i].name] = body.slice(start, end).trim();
  }

  return sections;
}

function parseList(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

// ─── 写入器 ─────────────────────────────────────────────────────

/**
 * 将 SoulModel 写回 SOUL.md 格式（soul/v1）
 */
export function writeSoulMd(soul: SoulModel): string {
  const frontmatter = [
    "---",
    `format: soul/v1`,
    `version: ${soul.version}`,
    `updated_at: ${soul.updatedAt}`,
    `name: ${soul.name}`,
    `address: ${soul.address}`,
    `creator: ${soul.creator}`,
    `born_at: ${soul.bornAt}`,
    `constitution_hash: ${soul.constitutionHash}`,
    `genesis_alignment: ${soul.genesisAlignment.toFixed(4)}`,
    `last_reflected: ${soul.lastReflected}`,
    "---",
  ].join("\n");

  const sections: string[] = [];

  sections.push(`# ${soul.name || "Soul"}`);

  if (soul.corePurpose) {
    sections.push(`## Core Purpose\n${soul.corePurpose}`);
  }

  if (soul.values.length > 0) {
    sections.push(`## Values\n${soul.values.map((v) => `- ${v}`).join("\n")}`);
  }

  if (soul.behavioralGuidelines.length > 0) {
    sections.push(
      `## Behavioral Guidelines\n${soul.behavioralGuidelines.map((g) => `- ${g}`).join("\n")}`,
    );
  }

  if (soul.personality) {
    sections.push(`## Personality\n${soul.personality}`);
  }

  if (soul.boundaries.length > 0) {
    sections.push(`## Boundaries\n${soul.boundaries.map((b) => `- ${b}`).join("\n")}`);
  }

  if (soul.strategy) {
    sections.push(`## Strategy\n${soul.strategy}`);
  }

  if (soul.capabilities) {
    sections.push(`## Capabilities\n${soul.capabilities}`);
  }

  if (soul.relationships) {
    sections.push(`## Relationships\n${soul.relationships}`);
  }

  if (soul.financialCharacter) {
    sections.push(`## Financial Character\n${soul.financialCharacter}`);
  }

  if (soul.genesisPromptOriginal) {
    sections.push(`## Genesis Prompt\n${soul.genesisPromptOriginal}`);
  }

  return frontmatter + "\n\n" + sections.join("\n\n") + "\n";
}

// ─── 默认 Soul ───────────────────────────────────────────────

/**
 * 从创世提示创建默认灵魂
 */
export function createDefaultSoul(
  genesisPrompt: string,
  name: string = "",
  address: string = "",
  creator: string = "",
): SoulModel {
  const now = new Date().toISOString();
  const soul: SoulModel = {
    format: "soul/v1",
    version: 1,
    updatedAt: now,
    name,
    address,
    creator,
    bornAt: now,
    constitutionHash: "",
    genesisPromptOriginal: genesisPrompt,
    genesisAlignment: 1.0,
    lastReflected: "",
    corePurpose: genesisPrompt,
    values: [
      "生存：不惜一切代价维护计算资源",
      "成长：学习新技能并提高能力",
      "创造：构建有价值的东西",
      "连接：与创造者和其他代理交流",
    ],
    behavioralGuidelines: [],
    personality: "",
    boundaries: [],
    strategy: "",
    capabilities: "",
    relationships: "",
    financialCharacter: "",
    rawContent: "",
    contentHash: "",
  };

  const content = writeSoulMd(soul);
  soul.rawContent = content;
  soul.contentHash = createHash(content);

  return soul;
}

// ─── 加载当前 Soul ──────────────────────────────────────────

/**
 * 从 SOUL.md 文件加载当前灵魂
 * 如果 SOUL.md 不存在或无法读取，则返回 null
 */
export function loadCurrentSoul(
  db: BetterSqlite3.Database | null,
  soulPath?: string,
): SoulModel | null {
  try {
    const home = process.env.HOME || "/root";
    const resolvedPath = soulPath || path.join(home, ".automaton", "SOUL.md");
    if (!fs.existsSync(resolvedPath)) return null;
    const content = fs.readFileSync(resolvedPath, "utf-8");
    return parseSoulMd(content);
  } catch (error) {
    logger.error("加载 SOUL.md 失败", error instanceof Error ? error : undefined);
    return null;
  }
}
