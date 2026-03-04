/**
 * Soul 工具 — Soul 管理的工具实现
 *
 * 提供 updateSoul、reflectOnSoul（触发器）、viewSoul 和 viewSoulHistory
 * 所有操作在保存前进行验证并记录到 soul_history
 *
 * 阶段 2.1：Soul 系统重新设计
 */

import fs from "fs";
import path from "path";
import type BetterSqlite3 from "better-sqlite3";
import type { SoulModel, SoulHistoryRow } from "../types.js";
import { loadCurrentSoul, writeSoulMd, createHash, createDefaultSoul } from "./model.js";
import { validateSoul } from "./validator.js";
import { insertSoulHistory, getCurrentSoulVersion, getLatestSoulHistory, getSoulHistory } from "../state/database.js";
import { ulid } from "ulid";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("soul");

// ─── 更新 Soul ────────────────────────────────────────────────

export interface UpdateSoulResult {
  success: boolean;
  version: number;
  errors?: string[];
}

/**
 * 使用新内容更新灵魂
 * 验证、版本控制、保存到文件并记录
 */
export async function updateSoul(
  db: BetterSqlite3.Database,
  updates: Partial<SoulModel>,
  source: SoulHistoryRow["changeSource"],
  reason?: string,
  soulPath?: string,
): Promise<UpdateSoulResult> {
  try {
    const home = process.env.HOME || "/root";
    const resolvedPath = soulPath || path.join(home, ".automaton", "SOUL.md");

    // 加载当前灵魂或创建默认灵魂
    let current = loadCurrentSoul(db, resolvedPath);
    if (!current) {
      current = createDefaultSoul(
        updates.corePurpose || "未设置目的",
        updates.name || "",
        updates.address || "",
        updates.creator || "",
      );
    }

    // 将更新合并到当前灵魂
    const merged: SoulModel = {
      ...current,
      ...updates,
      format: "soul/v1",
      updatedAt: new Date().toISOString(),
    };

    // 验证
    const validation = validateSoul(merged);
    if (!validation.valid) {
      return {
        success: false,
        version: current.version,
        errors: validation.errors,
      };
    }

    // 增加版本
    const currentVersion = getCurrentSoulVersion(db);
    const newVersion = Math.max(currentVersion, current.version) + 1;
    const newSoul: SoulModel = {
      ...validation.sanitized,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };

    // 写入文件
    const content = writeSoulMd(newSoul);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, content, "utf-8");

    // 获取上一个版本 ID
    const latestHistory = getLatestSoulHistory(db);
    const previousVersionId = latestHistory?.id || null;

    // 记录到 soul_history
    insertSoulHistory(db, {
      id: ulid(),
      version: newVersion,
      content,
      contentHash: createHash(content),
      changeSource: source,
      changeReason: reason || null,
      previousVersionId,
      approvedBy: null,
      createdAt: new Date().toISOString(),
    });

    return { success: true, version: newVersion };
  } catch (error) {
    logger.error("updateSoul 失败", error instanceof Error ? error : undefined);
    return {
      success: false,
      version: 0,
      errors: [error instanceof Error ? error.message : "未知错误"],
    };
  }
}

// ─── 查看 Soul ──────────────────────────────────────────────────

/**
 * 查看当前灵魂模型
 */
export function viewSoul(
  db: BetterSqlite3.Database,
  soulPath?: string,
): SoulModel | null {
  return loadCurrentSoul(db, soulPath);
}

// ─── 查看 Soul 历史 ──────────────────────────────────────────

/**
 * 查看灵魂变更历史
 */
export function viewSoulHistory(
  db: BetterSqlite3.Database,
  limit?: number,
): SoulHistoryRow[] {
  return getSoulHistory(db, limit);
}
