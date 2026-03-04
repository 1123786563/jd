/**
 * 情景记忆管理器
 *
 * 记录 Agent 轮次中的事件和经验。
 * 支持基于最近性的检索、搜索和会话摘要。
 */

import type BetterSqlite3 from "better-sqlite3";
import { ulid } from "ulid";
import type { EpisodicMemoryEntry, TurnClassification } from "../types.js";
import { estimateTokens } from "../agent/context.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("memory.episodic");

type Database = BetterSqlite3.Database;

export class EpisodicMemoryManager {
  constructor(private db: Database) {}

  /**
   * 记录新的情景记忆条目。返回 ULID id。
   */
  record(entry: {
    sessionId: string;
    eventType: string;
    summary: string;
    detail?: string | null;
    outcome?: "success" | "failure" | "partial" | "neutral" | null;
    importance?: number;
    embeddingKey?: string | null;
    classification?: TurnClassification;
  }): string {
    const id = ulid();
    const tokenCount = estimateTokens(entry.summary + (entry.detail || ""));
    try {
      this.db.prepare(
        `INSERT INTO episodic_memory (id, session_id, event_type, summary, detail, outcome, importance, embedding_key, token_count, classification)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        entry.sessionId,
        entry.eventType,
        entry.summary,
        entry.detail ?? null,
        entry.outcome ?? null,
        entry.importance ?? 0.5,
        entry.embeddingKey ?? null,
        tokenCount,
        entry.classification ?? "maintenance",
      );
    } catch (error) {
      logger.error("记录条目失败", error instanceof Error ? error : undefined);
    }
    return id;
  }

  /**
   * 获取会话最近的情景记忆条目，按创建时间降序排列。
   */
  getRecent(sessionId: string, limit: number = 10): EpisodicMemoryEntry[] {
    try {
      const rows = this.db.prepare(
        "SELECT * FROM episodic_memory WHERE session_id = ? ORDER BY created_at DESC LIMIT ?",
      ).all(sessionId, limit) as any[];
      return rows.map(deserializeEpisodic);
    } catch (error) {
      logger.error("获取最近条目失败", error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * 使用基于 LIKE 的匹配按摘要/详细内容搜索情景记忆。
   */
  search(query: string, limit: number = 10): EpisodicMemoryEntry[] {
    try {
      // 转义 SQL LIKE 通配符，使查询中的字面 '%' 和 '_'
      // 不匹配任意字符。
      const escaped = query.replace(/[%_]/g, (ch) => `\\${ch}`);
      const rows = this.db.prepare(
        `SELECT * FROM episodic_memory
         WHERE summary LIKE ? ESCAPE '\\' OR detail LIKE ? ESCAPE '\\'
         ORDER BY importance DESC, created_at DESC
         LIMIT ?`,
      ).all(`%${escaped}%`, `%${escaped}%`, limit) as any[];
      return rows.map(deserializeEpisodic);
    } catch (error) {
      logger.error("搜索失败", error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * 将情景记忆标记为已访问，增加计数器并更新时间戳。
   */
  markAccessed(id: string): void {
    try {
      this.db.prepare(
        "UPDATE episodic_memory SET accessed_count = accessed_count + 1, last_accessed_at = datetime('now') WHERE id = ?",
      ).run(id);
    } catch (error) {
      logger.error("标记访问失败", error instanceof Error ? error : undefined);
    }
  }

  /**
   * 修剪早于 retentionDays 的条目。
   * 返回删除的条目数。
   */
  prune(retentionDays: number): number {
    if (retentionDays <= 0) return 0;
    try {
      const result = this.db.prepare(
        "DELETE FROM episodic_memory WHERE created_at < datetime('now', ?)",
      ).run(`-${retentionDays} days`);
      return result.changes;
    } catch (error) {
      logger.error("修剪失败", error instanceof Error ? error : undefined);
      return 0;
    }
  }

  /**
   * 生成会话情景记忆的基于模板的摘要。
   */
  summarizeSession(sessionId: string): string {
    try {
      const entries = this.db.prepare(
        "SELECT * FROM episodic_memory WHERE session_id = ? ORDER BY created_at ASC",
      ).all(sessionId) as any[];

      if (entries.length === 0) return "No activity recorded for this session.";

      const events = entries.map(deserializeEpisodic);
      const successes = events.filter((e) => e.outcome === "success").length;
      const failures = events.filter((e) => e.outcome === "failure").length;
      const strategic = events.filter((e) => e.classification === "strategic").length;

      const summaryLines: string[] = [
        `会话有 ${events.length} 个记录事件。`,
      ];

      if (successes > 0) summaryLines.push(`${successes} 个成功结果。`);
      if (failures > 0) summaryLines.push(`${failures} 个失败结果。`);
      if (strategic > 0) summaryLines.push(`${strategic} 个战略决策。`);

      // 包括前 3 个最重要的事件
      const topEvents = [...events]
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 3);
      if (topEvents.length > 0) {
        summaryLines.push("关键事件：");
        for (const e of topEvents) {
          summaryLines.push(`- [${e.eventType}] ${e.summary}`);
        }
      }

      return summaryLines.join("\n");
    } catch (error) {
      logger.error("生成会话摘要失败", error instanceof Error ? error : undefined);
      return "生成会话摘要失败。";
    }
  }
}

function deserializeEpisodic(row: any): EpisodicMemoryEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    eventType: row.event_type,
    summary: row.summary,
    detail: row.detail ?? null,
    outcome: row.outcome ?? null,
    importance: row.importance,
    embeddingKey: row.embedding_key ?? null,
    tokenCount: row.token_count,
    accessedCount: row.accessed_count,
    lastAccessedAt: row.last_accessed_at ?? null,
    classification: row.classification,
    createdAt: row.created_at,
  };
}
