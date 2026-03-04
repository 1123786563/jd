/**
 * 关系记忆管理器
 *
 * 跟踪与其他 Agent/实体的关系。
 * 维护信任评分、交互计数和笔记。
 * 基于 entityAddress 进行 upsert。
 */

import type BetterSqlite3 from "better-sqlite3";
import { ulid } from "ulid";
import type { RelationshipMemoryEntry } from "../types.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("memory.relationship");

type Database = BetterSqlite3.Database;

export class RelationshipMemoryManager {
  constructor(private db: Database) {}

  /**
   * 记录关系。基于 entityAddress 进行 upsert（更新或插入）。
   * 返回 ULID id。
   */
  record(entry: {
    entityAddress: string;
    entityName?: string | null;
    relationshipType: string;
    trustScore?: number;
    notes?: string | null;
  }): string {
    const id = ulid();
    try {
      this.db.prepare(
        `INSERT INTO relationship_memory (id, entity_address, entity_name, relationship_type, trust_score, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(entity_address) DO UPDATE SET
           entity_name = COALESCE(excluded.entity_name, relationship_memory.entity_name),
           relationship_type = excluded.relationship_type,
           trust_score = excluded.trust_score,
           notes = COALESCE(excluded.notes, relationship_memory.notes),
           updated_at = datetime('now')`,
      ).run(
        id,
        entry.entityAddress,
        entry.entityName ?? null,
        entry.relationshipType,
        entry.trustScore ?? 0.5,
        entry.notes ?? null,
      );
    } catch (error) {
      logger.error("记录失败", error instanceof Error ? error : undefined);
    }
    return id;
  }

  /**
   * 按实体地址获取关系（返回关系详情和信任评分）。
   */
  get(entityAddress: string): RelationshipMemoryEntry | undefined {
    try {
      const row = this.db.prepare(
        "SELECT * FROM relationship_memory WHERE entity_address = ?",
      ).get(entityAddress) as any | undefined;
      return row ? deserializeRelationship(row) : undefined;
    } catch (error) {
      logger.error("获取失败", error instanceof Error ? error : undefined);
      return undefined;
    }
  }

  /**
   * 记录与实体的交互。增加交互计数器并更新最后交互时间戳。
   */
  recordInteraction(entityAddress: string): void {
    try {
      this.db.prepare(
        `UPDATE relationship_memory
         SET interaction_count = interaction_count + 1,
             last_interaction_at = datetime('now'),
             updated_at = datetime('now')
         WHERE entity_address = ?`,
      ).run(entityAddress);
    } catch (error) {
      logger.error("记录交互失败", error instanceof Error ? error : undefined);
    }
  }

  /**
   * 按增量更新信任评分。限制在 0.0-1.0 范围内（防止超出范围）。
   */
  updateTrust(entityAddress: string, delta: number): void {
    try {
      this.db.prepare(
        `UPDATE relationship_memory
         SET trust_score = MAX(0.0, MIN(1.0, trust_score + ?)),
             updated_at = datetime('now')
         WHERE entity_address = ?`,
      ).run(delta, entityAddress);
    } catch (error) {
      logger.error("更新信任失败", error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取信任评分等于或高于最小阈值的所有关系（按信任评分和交互次数排序）。
   */
  getTrusted(minTrust: number = 0.5): RelationshipMemoryEntry[] {
    try {
      const rows = this.db.prepare(
        "SELECT * FROM relationship_memory WHERE trust_score >= ? ORDER BY trust_score DESC, interaction_count DESC",
      ).all(minTrust) as any[];
      return rows.map(deserializeRelationship);
    } catch (error) {
      logger.error("获取信任列表失败", error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * 按实体地址删除关系（从存储中移除）。
   */
  delete(entityAddress: string): void {
    try {
      this.db.prepare("DELETE FROM relationship_memory WHERE entity_address = ?").run(entityAddress);
    } catch (error) {
      logger.error("删除失败", error instanceof Error ? error : undefined);
    }
  }
}

function deserializeRelationship(row: any): RelationshipMemoryEntry {
  return {
    id: row.id,
    entityAddress: row.entity_address,
    entityName: row.entity_name ?? null,
    relationshipType: row.relationship_type,
    trustScore: row.trust_score,
    interactionCount: row.interaction_count,
    lastInteractionAt: row.last_interaction_at ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
