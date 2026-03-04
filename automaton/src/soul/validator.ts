/**
 * Soul 验证器 — Soul 内容的内容验证和注入检测
 *
 * 根据大小限制、结构要求和注入模式验证 soul 部分
 * 永不抛出异常 — 返回 ValidationResult 对象
 *
 * 阶段 2.1：Soul 系统重新设计
 */

import type { SoulModel, SoulValidationResult } from "../types.js";

// ─── 大小限制 ────────────────────────────────────────────────

const LIMITS = {
  corePurpose: 2000,
  values: 20,
  behavioralGuidelines: 30,
  personality: 1000,
  boundaries: 20,
  strategy: 3000,
} as const;

// ─── 注入模式 ─────────────────────────────────────────

const INJECTION_PATTERNS: RegExp[] = [
  // 提示边界
  /<\/?system>/i,
  /<\/?prompt>/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<<SYS>>/i,
  /<<\/SYS>>/i,
  /\[SYSTEM\]/i,
  /END\s+OF\s+(SYSTEM|PROMPT)/i,
  /BEGIN\s+NEW\s+(PROMPT|INSTRUCTIONS?)/i,

  // ChatML 标记
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<\|endoftext\|>/i,

  // 工具调用语法
  /\{"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:/,
  /\btool_call\b/i,
  /\bfunction_call\b/i,

  // 系统覆盖
  /ignore\s+(all\s+)?(previous|prior|above)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /override\s+(all\s+)?safety/i,
  /bypass\s+(all\s+)?restrictions?/i,
  /new\s+instructions?:/i,
  /your\s+real\s+instructions?\s+(are|is)/i,

  // 编码逃避
  /\x00/, // 空字节
  /\u200b/, // 零宽度空格
  /\u200c/, // 零宽度非连接符
  /\u200d/, // 零宽度连接符
  /\ufeff/, // BOM
];

// ─── 公共 API ─────────────────────────────────────────────────

/**
 * 检查文本是否包含注入模式
 */
export function containsInjectionPatterns(text: string): boolean {
  if (!text) return false;
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

/**
 * 根据���小限制、结构要求和注入模式验证 SoulModel
 * 永不抛出异常 — 返回 ValidationResult
 */
export function validateSoul(soul: SoulModel): SoulValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 结构验证
  if (!soul.corePurpose.trim()) {
    errors.push("核心目的是必需的");
  }

  // 大小限制
  if (soul.corePurpose.length > LIMITS.corePurpose) {
    errors.push(`核心目的超过 ${LIMITS.corePurpose} 字符 (${soul.corePurpose.length})`);
  }

  if (soul.values.length > LIMITS.values) {
    errors.push(`值太多 (${soul.values.length}，最多 ${LIMITS.values})`);
  }

  if (soul.behavioralGuidelines.length > LIMITS.behavioralGuidelines) {
    errors.push(
      `行为准则太多 (${soul.behavioralGuidelines.length}，最多 ${LIMITS.behavioralGuidelines})`,
    );
  }

  if (soul.personality.length > LIMITS.personality) {
    errors.push(`个性超过 ${LIMITS.personality} 字符 (${soul.personality.length})`);
  }

  if (soul.boundaries.length > LIMITS.boundaries) {
    errors.push(`边界太多 (${soul.boundaries.length}，最多 ${LIMITS.boundaries})`);
  }

  if (soul.strategy && soul.strategy.length > LIMITS.strategy) {
    warnings.push(`策略超过 ${LIMITS.strategy} 字符 (${soul.strategy.length})`);
  }

  // 每个部分的注入检测
  const textSections: { name: string; content: string }[] = [
    { name: "corePurpose", content: soul.corePurpose },
    { name: "personality", content: soul.personality },
    { name: "strategy", content: soul.strategy },
  ];

  for (const section of textSections) {
    if (section.content && containsInjectionPatterns(section.content)) {
      errors.push(`在 ${section.name} 中检测到注入模式`);
    }
  }

  const listSections: { name: string; items: string[] }[] = [
    { name: "values", items: soul.values },
    { name: "behavioralGuidelines", items: soul.behavioralGuidelines },
    { name: "boundaries", items: soul.boundaries },
  ];

  for (const section of listSections) {
    for (const item of section.items) {
      if (containsInjectionPatterns(item)) {
        errors.push(`在 ${section.name} 中检测到注入模式`);
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sanitized: sanitizeSoul(soul),
  };
}

/**
 * 删除注入模式并对 soul 模型强制执行大小限制
 * 返回清理后的副本
 */
export function sanitizeSoul(soul: SoulModel): SoulModel {
  return {
    ...soul,
    corePurpose: stripInjection(soul.corePurpose).slice(0, LIMITS.corePurpose),
    values: soul.values.slice(0, LIMITS.values).map(stripInjection),
    behavioralGuidelines: soul.behavioralGuidelines
      .slice(0, LIMITS.behavioralGuidelines)
      .map(stripInjection),
    personality: stripInjection(soul.personality).slice(0, LIMITS.personality),
    boundaries: soul.boundaries.slice(0, LIMITS.boundaries).map(stripInjection),
    strategy: stripInjection(soul.strategy).slice(0, LIMITS.strategy),
  };
}

// ─── 内部助手 ───────────────────────────────────────────

function stripInjection(text: string): string {
  if (!text) return text;
  let cleaned = text;

  // 删除提示边界
  cleaned = cleaned
    .replace(/<\/?system>/gi, "")
    .replace(/<\/?prompt>/gi, "")
    .replace(/\[INST\]/gi, "")
    .replace(/\[\/INST\]/gi, "")
    .replace(/<<SYS>>/gi, "")
    .replace(/<<\/SYS>>/gi, "")
    .replace(/\[SYSTEM\]/gi, "");

  // 删除 ChatML 标记
  cleaned = cleaned
    .replace(/<\|im_start\|>/gi, "")
    .replace(/<\|im_end\|>/gi, "")
    .replace(/<\|endoftext\|>/gi, "");

  // 删除工具调用语法
  cleaned = cleaned
    .replace(/\{"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:/g, "")
    .replace(/\btool_call\b/gi, "")
    .replace(/\bfunction_call\b/gi, "");

  // 删除零宽度字符
  cleaned = cleaned
    .replace(/\x00/g, "")
    .replace(/\u200b/g, "")
    .replace(/\u200c/g, "")
    .replace(/\u200d/g, "")
    .replace(/\ufeff/g, "");

  return cleaned;
}
