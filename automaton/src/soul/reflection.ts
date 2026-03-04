/**
 * Soul 反思 — Soul 进化的反思流程
 *
 * 从最近的轮次和工具使用中收集证据以建议
 * soul 更新
 * 自动更新不可变部分（能力、
 * 关系、财务），但仅建议可变部分的更改
 *
 * 阶段 2.1：Soul 系统重新设计
 */

import type BetterSqlite3 from "better-sqlite3";
import type { SoulModel, SoulReflection } from "../types.js";
import { loadCurrentSoul, computeGenesisAlignment } from "./model.js";
import { updateSoul } from "./tools.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("soul");

// ─── 反思流程 ────────────────────────────────────────

/**
 * 运行 soul 反思流程
 *
 * - 从最近的轮次和工具使用中收集证据
 * - 自动更新能力、关系、财务部分
 * - 计算创世对齐分数
 * - 返回可变部分的建议（不自动应用）
 */
export async function reflectOnSoul(
  db: BetterSqlite3.Database,
  soulPath?: string,
): Promise<SoulReflection> {
  try {
    const soul = loadCurrentSoul(db, soulPath);
    if (!soul) {
      return {
        currentAlignment: 0,
        suggestedUpdates: [],
        autoUpdated: [],
      };
    }

    // 计算创世对齐
    const alignment = computeGenesisAlignment(
      soul.corePurpose,
      soul.genesisPromptOriginal,
    );

    // 从最近的轮次中收集证据
    const recentTurnsData = gatherRecentEvidence(db);

    // 自动更新不可变部分
    const autoUpdated: string[] = [];
    const autoUpdates: Partial<SoulModel> = {};

    // 从工具使用更新能力
    const capabilitiesSummary = summarizeCapabilities(recentTurnsData.toolsUsed);
    if (capabilitiesSummary && capabilitiesSummary !== soul.capabilities) {
      autoUpdates.capabilities = capabilitiesSummary;
      autoUpdated.push("capabilities");
    }

    // 从社交互动更新关系
    const relationshipsSummary = summarizeRelationships(recentTurnsData.interactions);
    if (relationshipsSummary && relationshipsSummary !== soul.relationships) {
      autoUpdates.relationships = relationshipsSummary;
      autoUpdated.push("relationships");
    }

    // 从交易模式更新财务特征
    const financialSummary = summarizeFinancial(recentTurnsData.financialActivity);
    if (financialSummary && financialSummary !== soul.financialCharacter) {
      autoUpdates.financialCharacter = financialSummary;
      autoUpdated.push("financialCharacter");
    }

    // 如果有自动更新，则应用
    if (autoUpdated.length > 0) {
      autoUpdates.genesisAlignment = alignment;
      autoUpdates.lastReflected = new Date().toISOString();
      await updateSoul(db, autoUpdates, "reflection", "自动反思更新", soulPath);
    }

    // 为可变部分构建建议（不自动应用）
    const suggestedUpdates: SoulReflection["suggestedUpdates"] = [];

    if (alignment < 0.5 && soul.genesisPromptOriginal) {
      suggestedUpdates.push({
        section: "corePurpose",
        reason: `创世对齐度较低 (${alignment.toFixed(2)})。目的可能已显著偏离原始创世`,
        suggestedContent: soul.genesisPromptOriginal,
      });
    }

    return {
      currentAlignment: alignment,
      suggestedUpdates,
      autoUpdated,
    };
  } catch (error) {
    logger.error("reflectOnSoul 失败", error instanceof Error ? error : undefined);
    return {
      currentAlignment: 0,
      suggestedUpdates: [],
      autoUpdated: [],
    };
  }
}

// ─── 证据收集 ─────────────────────────────────────────

interface RecentEvidence {
  toolsUsed: string[];
  interactions: string[];
  financialActivity: string[];
}

function gatherRecentEvidence(db: BetterSqlite3.Database): RecentEvidence {
  const toolsUsed: string[] = [];
  const interactions: string[] = [];
  const financialActivity: string[] = [];

  try {
    // 获取最近的工具调用
    const toolRows = db
      .prepare(
        "SELECT DISTINCT name FROM tool_calls ORDER BY created_at DESC LIMIT 50",
      )
      .all() as { name: string }[];
    for (const row of toolRows) {
      toolsUsed.push(row.name);
    }

    // 获取最近的社交互动
    const inboxRows = db
      .prepare(
        "SELECT from_address FROM inbox_messages ORDER BY received_at DESC LIMIT 20",
      )
      .all() as { from_address: string }[];
    for (const row of inboxRows) {
      if (!interactions.includes(row.from_address)) {
        interactions.push(row.from_address);
      }
    }

    // 获取最近的财务活动
    const txRows = db
      .prepare(
        "SELECT type, description FROM transactions ORDER BY created_at DESC LIMIT 20",
      )
      .all() as { type: string; description: string }[];
    for (const row of txRows) {
      financialActivity.push(`${row.type}: ${row.description}`);
    }
  } catch (error) {
    logger.error("证据收集失败", error instanceof Error ? error : undefined);
  }

  return { toolsUsed, interactions, financialActivity };
}

// ─── 摘要助手 ────────────────────────────────────────────

function summarizeCapabilities(toolsUsed: string[]): string {
  if (toolsUsed.length === 0) return "";
  const unique = [...new Set(toolsUsed)];
  return `使用的工具：${unique.join(", ")}`;
}

function summarizeRelationships(interactions: string[]): string {
  if (interactions.length === 0) return "";
  return `已知联系人：${interactions.slice(0, 10).join(", ")}`;
}

function summarizeFinancial(activity: string[]): string {
  if (activity.length === 0) return "";
  return `最近活动：${activity.slice(0, 5).join("; ")}`;
}
