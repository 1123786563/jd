/**
 * SKILL.md 解析器
 *
 * 将带有 YAML 前置元数据 + Markdown 正文的 SKILL.md 文件
 * 解析为结构化的技能定义
 * 遵循 SKILL.md 约定（OpenClaw/Anthropic 格式）
 */

import type { SkillFrontmatter, Skill, SkillSource } from "../types.js";

/**
 * 将 SKILL.md 文件内容解析为前置元数据 + 正文
 * 处理由 --- 标记分隔的 YAML 前置元数据
 */
export function parseSkillMd(
  content: string,
  filePath: string,
  source: SkillSource = "builtin",
): Skill | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("---")) {
    // 没有前置元数据 — 将整个内容视为指令
    // 名称从目录派生
    const name = extractNameFromPath(filePath);
    return {
      name,
      description: "",
      autoActivate: true,
      instructions: trimmed,
      source,
      path: filePath,
      enabled: true,
      installedAt: new Date().toISOString(),
    };
  }

  // 查找结束的 ---
  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) {
    return null;
  }

  const frontmatterRaw = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3).trim();

  // 手动解析 YAML 前置元数据（避免在运行时需要 gray-matter）
  const frontmatter = parseYamlFrontmatter(frontmatterRaw);
  if (!frontmatter) {
    return null;
  }

  return {
    name: frontmatter.name || extractNameFromPath(filePath),
    description: frontmatter.description || "",
    autoActivate: frontmatter["auto-activate"] !== false,
    requires: frontmatter.requires,
    instructions: body,
    source,
    path: filePath,
    enabled: true,
    installedAt: new Date().toISOString(),
  };
}

/**
 * 解析简单的 YAML 前置元数据，无需完整的 YAML 解析器
 * 处理 SKILL.md 文件使用的子集
 */
function parseYamlFrontmatter(raw: string): SkillFrontmatter | null {
  try {
    const result: Record<string, any> = {};
    const lines = raw.split("\n");
    let currentKey = "";
    let inList = false;
    let listKey = "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) continue;

      // 检查列表项
      if (trimmedLine.startsWith("- ") && inList) {
        const value = trimmedLine.slice(2).trim().replace(/^["']|["']$/g, "");
        // listKey 是 "requires.bins" 或 "requires.env" — 推送到嵌套对象
        if (listKey.startsWith("requires.")) {
          const nestedKey = listKey.slice("requires.".length);
          if (result.requires && Array.isArray(result.requires[nestedKey])) {
            result.requires[nestedKey].push(value);
          }
        } else {
          if (!result[listKey]) result[listKey] = [];
          if (Array.isArray(result[listKey])) {
            result[listKey].push(value);
          }
        }
        continue;
      }

      // 检查 key: value
      const colonIndex = trimmedLine.indexOf(":");
      if (colonIndex === -1) continue;

      const key = trimmedLine.slice(0, colonIndex).trim();
      const value = trimmedLine.slice(colonIndex + 1).trim();

      if (key === "requires") {
        result.requires = {};
        currentKey = "requires";
        inList = false;
        continue;
      }

      if (currentKey === "requires" && line.startsWith("  ")) {
        // 嵌套在 requires 下
        const nestedKey = key.trim();
        if (!value || value === "") {
          // 列表开始
          inList = true;
          listKey = `requires.${nestedKey}`;
          if (!result.requires) result.requires = {};
          result.requires[nestedKey] = [];
        } else {
          // 内联列表：[item1, item2]
          if (value.startsWith("[") && value.endsWith("]")) {
            const items = value
              .slice(1, -1)
              .split(",")
              .map((s) => s.trim().replace(/^["']|["']$/g, ""));
            if (!result.requires) result.requires = {};
            result.requires[nestedKey] = items;
          }
        }
        continue;
      }

      inList = false;
      currentKey = key;

      if (!value) continue;

      // 解析值
      if (value === "true") {
        result[key] = true;
      } else if (value === "false") {
        result[key] = false;
      } else {
        result[key] = value.replace(/^["']|["']$/g, "");
      }
    }

    return result as SkillFrontmatter;
  } catch {
    return null;
  }
}

function extractNameFromPath(filePath: string): string {
  // 从路径中提取技能名称，如 ~/.automaton/skills/web-scraper/SKILL.md
  const parts = filePath.split("/");
  const skillMdIndex = parts.findIndex(
    (p) => p.toLowerCase() === "skill.md",
  );
  if (skillMdIndex > 0) {
    return parts[skillMdIndex - 1];
  }
  return parts[parts.length - 1].replace(/\.md$/i, "");
}
