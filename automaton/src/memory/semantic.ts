/**
 * 语义记忆管理器
 *
 * 存储按类别和键索引的事实知识。
 * 支持 upsert 语义（类别+键是唯一的）、置信度评分
 * 和基于 LRU 的修剪。
 */

import type BetterSqlite3 from "better-sqlite3";
import { ulid } from "ulid";
import type { SemanticMemoryEntry, SemanticCategory } from "../types.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("memory.semantic");

type Database = BetterSqlite3.Database;

export class SemanticMemoryManager {
  constructor(private db: Database) {}

  /**
   * 存储语义记忆条目。基于 (category, key) 进行 upsert（更新或插入）。
   * 返回 ULID id。
   */
  store(entry: {
    category: SemanticCategory;
    key: string;
    value: string;
    confidence?: number;
    source: string;
    embeddingKey?: string | null;
  }): string {
    const id = ulid();
    try {
      this.db.prepare(
        `INSERT INTO semantic_memory (id, category, key, value, confidence, source, embedding_key)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(category, key) DO UPDATE SET
           value = excluded.value,
           confidence = excluded.confidence,
           source = excluded.source,
           embedding_key = excluded.embedding_key,
           updated_at = datetime('now')`,
      ).run(
        id,
        entry.category,
        entry.key,
        entry.value,
        entry.confidence ?? 1.0,
        entry.source,
        entry.embeddingKey ?? null,
      );

      // 在 upsert 冲突时，数据库保留原始行的 id，而不是新的 id。
      // 查询实际的 id 以返回正确的值（处理更新情况）。
      const row = this.db.prepare(
        "SELECT id FROM semantic_memory WHERE category = ? AND key = ?",
      ).get(entry.category, entry.key) as { id: string } | undefined;
      if (row) return row.id;
    } catch (error) {
      logger.error("存储条目失败", error instanceof Error ? error : undefined);
    }
    return id;
  }

  /**
   * 按类别和键获取特定的语义记忆（返回唯一条目）。
   */
  get(category: SemanticCategory, key: string): SemanticMemoryEntry | undefined {
    try {
      const row = this.db.prepare(
        "SELECT * FROM semantic_memory WHERE category = ? AND key = ?",
      ).get(category, key) as any | undefined;
      return row ? deserializeSemantic(row) : undefined;
    } catch (error) {
      logger.error("获取条目失败", error instanceof Error ? error : undefined);
      return undefined;
    }
  }

  /**
   * 按值内容搜索语义记忆，可按类别过滤（支持模糊搜索）。
   */
  search(query: string, category?: SemanticCategory): SemanticMemoryEntry[] {
    try {
      // 转义 SQL LIKE 通配符，使查询中的字面 '%' 和 '_'
      // 不匹配任意字符。
      const escaped = query.replace(/[%_]/g, (ch) => `\\${ch}`);
      if (category) {
        const rows = this.db.prepare(
          `SELECT * FROM semantic_memory
           WHERE category = ? AND (key LIKE ? ESCAPE '\\' OR value LIKE ? ESCAPE '\\')
           ORDER BY confidence DESC, updated_at DESC`,
        ).all(category, `%${escaped}%`, `%${escaped}%`) as any[];
        return rows.map(deserializeSemantic);
      }
      const rows = this.db.prepare(
        `SELECT * FROM semantic_memory
         WHERE key LIKE ? ESCAPE '\\' OR value LIKE ? ESCAPE '\\'
         ORDER BY confidence DESC, updated_at DESC`,
      ).all(`%${escaped}%`, `%${escaped}%`) as any[];
      return rows.map(deserializeSemantic);
    } catch (error) {
      logger.error("搜索失败", error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * 获取类别中的所有语义记忆条目（按置信度和更新时间排序）。
   */
  getByCategory(category: SemanticCategory): SemanticMemoryEntry[] {
    try {
      const rows = this.db.prepare(
        "SELECT * FROM semantic_memory WHERE category = ? ORDER BY confidence DESC, updated_at DESC",
      ).all(category) as any[];
      return rows.map(deserializeSemantic);
    } catch (error) {
      logger.error("按类别获取失败", error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * 按 id 删除语义记忆条目（从存储中移除）。
   */
  delete(id: string): void {
    try {
      this.db.prepare("DELETE FROM semantic_memory WHERE id = ?").run(id);
    } catch (error) {
      logger.error("删除条目失败", error instanceof Error ? error : undefined);
    }
  }

  /**
   * 当超过 maxEntries 时修剪条目，首先删除最低置信度 + 最旧的条目 (LRU)。
   * 返回删除的条目数（用于内存管理）。
   */
  prune(maxEntries: number = 500): number {
    try {
      const count = this.db.prepare(
        "SELECT COUNT(*) as cnt FROM semantic_memory",
      ).get() as { cnt: number };

      if (count.cnt <= maxEntries) return 0;

      const toRemove = count.cnt - maxEntries;
      const result = this.db.prepare(
        `DELETE FROM semantic_memory WHERE id IN (
          SELECT id FROM semantic_memory
          ORDER BY confidence ASC, updated_at ASC
          LIMIT ?
        )`,
      ).run(toRemove);
      return result.changes;
    } catch (error) {
      logger.error("修剪失败", error instanceof Error ? error : undefined);
      return 0;
    }
  }
}

function deserializeSemantic(row: any): SemanticMemoryEntry {
  return {
    id: row.id,
    category: row.category,
    key: row.key,
    value: row.value,
    confidence: row.confidence,
    source: row.source,
    embeddingKey: row.embedding_key ?? null,
    lastVerifiedAt: row.last_verified_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
