/**
 * 知识存储
 *
 * 由 knowledge_store 表支持的跨 Agent 共享知识库。
 * 提供知识的增删改查、搜索、分类统计和过期清理功能。
 */

import type BetterSqlite3 from "better-sqlite3";
import {
  deleteKnowledge,
  getKnowledgeByCategory,
  insertKnowledge,
  searchKnowledge,
  updateKnowledge,
  type KnowledgeStoreRow,
} from "../state/database.js";

type Database = BetterSqlite3.Database;

export type KnowledgeCategory =
  | "market"        // 市场
  | "technical"     // 技术
  | "social"        // 社交
  | "financial"     // 财务
  | "operational";  // 运营

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  key: string;                // 知识键，用于索引知识条目
  content: string;            // 知识内容，存储实际知识
  source: string;             // 来源，标识知识的来源
  confidence: number;         // 置信度，0-1 之间的值
  lastVerified: string;       // 最后验证时间
  accessCount: number;        // 访问次数，记录被访问的次数
  tokenCount: number;         // Token 数量，估算的 token 使用量
  createdAt: string;          // 创建时间
  expiresAt: string | null;   // 过期时间，null 表示不过期
}

export interface KnowledgeStats {
  total: number;              // 总条目数
  byCategory: Record<KnowledgeCategory, number>;  // 各分类数量统计
  totalTokens: number;        // 总 token 数统计
}

const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  "market",
  "technical",
  "social",
  "financial",
  "operational",
];

function isKnowledgeCategory(value: string): value is KnowledgeCategory {
  return (KNOWLEDGE_CATEGORIES as string[]).includes(value);
}

function toKnowledgeEntry(row: KnowledgeStoreRow): KnowledgeEntry {
  if (!isKnowledgeCategory(row.category)) {
    throw new Error(`Invalid knowledge category: ${row.category}`);
  }

  return {
    id: row.id,
    category: row.category,
    key: row.key,
    content: row.content,
    source: row.source,
    confidence: row.confidence,
    lastVerified: row.lastVerified,
    accessCount: row.accessCount,
    tokenCount: row.tokenCount,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

function toKnowledgeUpdate(
  updates: Partial<KnowledgeEntry>,
): Partial<{
  category: string;
  key: string;
  content: string;
  source: string;
  confidence: number;
  lastVerified: string;
  accessCount: number;
  tokenCount: number;
  expiresAt: string | null;
}> {
  const mapped: Partial<{
    category: string;
    key: string;
    content: string;
    source: string;
    confidence: number;
    lastVerified: string;
    accessCount: number;
    tokenCount: number;
    expiresAt: string | null;
  }> = {};

  if (updates.category !== undefined) mapped.category = updates.category;
  if (updates.key !== undefined) mapped.key = updates.key;
  if (updates.content !== undefined) mapped.content = updates.content;
  if (updates.source !== undefined) mapped.source = updates.source;
  if (updates.confidence !== undefined) mapped.confidence = updates.confidence;
  if (updates.lastVerified !== undefined) mapped.lastVerified = updates.lastVerified;
  if (updates.accessCount !== undefined) mapped.accessCount = updates.accessCount;
  if (updates.tokenCount !== undefined) mapped.tokenCount = updates.tokenCount;
  if (updates.expiresAt !== undefined) mapped.expiresAt = updates.expiresAt;

  return mapped;
}

export class KnowledgeStore {
  constructor(private readonly db: Database) {}

  // 添加知识条目到存储
  add(entry: Omit<KnowledgeEntry, "id" | "accessCount" | "createdAt">): string {
    return insertKnowledge(this.db, {
      category: entry.category,
      key: entry.key,
      content: entry.content,
      source: entry.source,
      confidence: entry.confidence,
      lastVerified: entry.lastVerified,
      tokenCount: entry.tokenCount,
      expiresAt: entry.expiresAt,
    });
  }

  // 获取知识条目（自动增加访问计数，过滤已过期的条目）
  get(id: string): KnowledgeEntry | null {
    const now = new Date().toISOString();
    const row = this.db
      .prepare(
        `SELECT
           id,
           category,
           key,
           content,
           source,
           confidence,
           last_verified AS lastVerified,
           access_count AS accessCount,
           token_count AS tokenCount,
           created_at AS createdAt,
           expires_at AS expiresAt
         FROM knowledge_store
         WHERE id = ?
           AND (expires_at IS NULL OR expires_at >= ?)`,
      )
      .get(id, now) as KnowledgeStoreRow | undefined;

    if (!row) return null;

    this.db
      .prepare("UPDATE knowledge_store SET access_count = access_count + 1 WHERE id = ?")
      .run(id);

    return toKnowledgeEntry({
      ...row,
      accessCount: row.accessCount + 1,
    });
  }

  // 搜索知识条目（支持按类别过滤和限制结果数量）
  search(
    query: string,
    category?: KnowledgeCategory,
    limit: number = 100,
  ): KnowledgeEntry[] {
    const rows = searchKnowledge(this.db, query, category, limit);
    return rows.map(toKnowledgeEntry);
  }

  // 更新知识条目（支持部分字段更新）
  update(id: string, updates: Partial<KnowledgeEntry>): void {
    updateKnowledge(this.db, id, toKnowledgeUpdate(updates));
  }

  // 删除知识条目（根据 ID 删除）
  remove(id: string): void {
    deleteKnowledge(this.db, id);
  }

  // 清理过期和低置信度的知识（删除已过期或低置信度且长时间未验证的条目）
  prune(): number {
    const now = new Date().toISOString();
    const sevenDaysAgo = new Date(
      Date.now() - (7 * 24 * 60 * 60 * 1000),
    ).toISOString();

    const result = this.db.prepare(
      `DELETE FROM knowledge_store
       WHERE (expires_at IS NOT NULL AND expires_at < ?)
          OR (confidence < ? AND last_verified < ?)`,
    ).run(now, 0.3, sevenDaysAgo);

    return result.changes;
  }

  // 按分类获取知识（返回指定类别的所有知识条目）
  getByCategory(category: KnowledgeCategory): KnowledgeEntry[] {
    const rows = getKnowledgeByCategory(this.db, category);
    return rows.map(toKnowledgeEntry);
  }

  // 获取统计信息（包括总数、分类统计和 token 统计）
  getStats(): KnowledgeStats {
    const byCategory: Record<KnowledgeCategory, number> = {
      market: 0,
      technical: 0,
      social: 0,
      financial: 0,
      operational: 0,
    };

    const counts = this.db
      .prepare(
        "SELECT category, COUNT(*) AS count FROM knowledge_store GROUP BY category",
      )
      .all() as { category: string; count: number }[];

    for (const row of counts) {
      if (isKnowledgeCategory(row.category)) {
        byCategory[row.category] = row.count;
      }
    }

    const totals = this.db
      .prepare(
        "SELECT COUNT(*) AS total, COALESCE(SUM(token_count), 0) AS totalTokens FROM knowledge_store",
      )
      .get() as { total: number; totalTokens: number };

    return {
      total: totals.total,
      byCategory,
      totalTokens: totals.totalTokens,
    };
  }
}
