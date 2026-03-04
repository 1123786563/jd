/**
 * 工作记忆管理器
 *
 * 会话范围的记忆，用于当前目标、观察、计划和反思。
 * 条目按优先级排序，超出预算时进行修剪。
 */

import type BetterSqlite3 from "better-sqlite3";
import { ulid } from "ulid";
import type { WorkingMemoryEntry, WorkingMemoryType } from "../types.js";
import { estimateTokens } from "../agent/context.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("memory.working");

type Database = BetterSqlite3.Database;

export class WorkingMemoryManager {
  constructor(private db: Database) {}

  /**
   * 添加一个新的工作记忆条目。返回 ULID id。
   * 自动估算内容的 token 数量用于预算管理。
   */
  add(entry: {
    sessionId: string;
    content: string;
    contentType: WorkingMemoryType;
    priority?: number;
    expiresAt?: string | null;
    sourceTurn?: string | null;
  }): string {
    const id = ulid();
    const tokenCount = estimateTokens(entry.content);
    try {
      this.db.prepare(
        `INSERT INTO working_memory (id, session_id, content, content_type, priority, token_count, expires_at, source_turn)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        entry.sessionId,
        entry.content,
        entry.contentType,
        entry.priority ?? 0.5,
        tokenCount,
        entry.expiresAt ?? null,
        entry.sourceTurn ?? null,
      );
    } catch (error) {
      logger.error("添加条目失败", error instanceof Error ? error : undefined);
    }
    return id;
  }

  /**
   * 获取会话的所有工作记忆条目，按优先级降序排列（高优先级在前）。
   */
  getBySession(sessionId: string): WorkingMemoryEntry[] {
    try {
      const rows = this.db.prepare(
        "SELECT * FROM working_memory WHERE session_id = ? ORDER BY priority DESC, created_at DESC",
      ).all(sessionId) as any[];
      return rows.map(deserializeWorkingMemory);
    } catch (error) {
      logger.error("获取条目失败", error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * 更新现有的工作记忆条目（支持部分字段更新，自动更新 token 计数）。
   */
  update(id: string, updates: Partial<Pick<WorkingMemoryEntry, "content" | "priority" | "expiresAt" | "contentType">>): void {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.content !== undefined) {
      setClauses.push("content = ?");
      params.push(updates.content);
      setClauses.push("token_count = ?");
      params.push(estimateTokens(updates.content));
    }
    if (updates.priority !== undefined) {
      setClauses.push("priority = ?");
      params.push(updates.priority);
    }
    if (updates.expiresAt !== undefined) {
      setClauses.push("expires_at = ?");
      params.push(updates.expiresAt);
    }
    if (updates.contentType !== undefined) {
      setClauses.push("content_type = ?");
      params.push(updates.contentType);
    }

    if (setClauses.length === 0) return;

    params.push(id);
    try {
      this.db.prepare(
        `UPDATE working_memory SET ${setClauses.join(", ")} WHERE id = ?`,
      ).run(...params);
    } catch (error) {
      logger.error("更新条目失败", error instanceof Error ? error : undefined);
    }
  }

  /**
   * 按 id 删除工作记忆条目（从存储中移除）。
   */
  delete(id: string): void {
    try {
      this.db.prepare("DELETE FROM working_memory WHERE id = ?").run(id);
    } catch (error) {
      logger.error("删除条目失败", error instanceof Error ? error : undefined);
    }
  }

  /**
   * 当会话超过 maxEntries 时修剪最低优先级的条目。
   * 返回删除的条目数（用于内存管理，防止工作记忆过大）。
   */
  prune(sessionId: string, maxEntries: number = 20): number {
    if (maxEntries < 0) return 0;
    try {
      const count = this.db.prepare(
        "SELECT COUNT(*) as cnt FROM working_memory WHERE session_id = ?",
      ).get(sessionId) as { cnt: number };

      if (count.cnt <= maxEntries) return 0;

      const toRemove = count.cnt - maxEntries;
      const result = this.db.prepare(
        `DELETE FROM working_memory WHERE id IN (
          SELECT id FROM working_memory WHERE session_id = ?
          ORDER BY priority ASC, created_at ASC
          LIMIT ?
        )`,
      ).run(sessionId, toRemove);
      return result.changes;
    } catch (error) {
      logger.error("修剪失败", error instanceof Error ? error : undefined);
      return 0;
    }
  }

  /**
   * 清除所有会话中所有过期的条目。
   * 返回删除的条目数（定期清理过期数据）。
   */
  clearExpired(): number {
    try {
      const result = this.db.prepare(
        "DELETE FROM working_memory WHERE expires_at IS NOT NULL AND expires_at < datetime('now')",
      ).run();
      return result.changes;
    } catch (error) {
      logger.error("清除过期条目失败", error instanceof Error ? error : undefined);
      return 0;
    }
  }
}

function deserializeWorkingMemory(row: any): WorkingMemoryEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    content: row.content,
    contentType: row.content_type,
    priority: row.priority,
    tokenCount: row.token_count,
    expiresAt: row.expires_at ?? null,
    sourceTurn: row.source_turn ?? null,
    createdAt: row.created_at,
  };
}
