/**
 * 程序记忆管理器
 *
 * 存储学习的程序（分步说明）并跟踪成功/失败。
 * 基于程序名称进行 upsert。
 */

import type BetterSqlite3 from "better-sqlite3";
import { ulid } from "ulid";
import type { ProceduralMemoryEntry, ProceduralStep } from "../types.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("memory.procedural");

type Database = BetterSqlite3.Database;

export class ProceduralMemoryManager {
  constructor(private db: Database) {}

  /**
   * 保存程序。基于名称进行 upsert（更新或插入）。
   * 返回 ULID id。
   */
  save(entry: {
    name: string;
    description: string;
    steps: ProceduralStep[];
  }): string {
    const id = ulid();
    try {
      this.db.prepare(
        `INSERT INTO procedural_memory (id, name, description, steps)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           description = excluded.description,
           steps = excluded.steps,
           updated_at = datetime('now')`,
      ).run(
        id,
        entry.name,
        entry.description,
        JSON.stringify(entry.steps),
      );
    } catch (error) {
      logger.error("保存失败", error instanceof Error ? error : undefined);
    }
    return id;
  }

  /**
   * 按名称获取程序（返回程序详情和步骤）。
   */
  get(name: string): ProceduralMemoryEntry | undefined {
    try {
      const row = this.db.prepare(
        "SELECT * FROM procedural_memory WHERE name = ?",
      ).get(name) as any | undefined;
      return row ? deserializeProcedural(row) : undefined;
    } catch (error) {
      logger.error("获取失败", error instanceof Error ? error : undefined);
      return undefined;
    }
  }

  /**
   * 记录命名程序的成功或失败结果（用于统计程序执行效果）。
   */
  recordOutcome(name: string, success: boolean): void {
    try {
      const column = success ? "success_count" : "failure_count";
      this.db.prepare(
        `UPDATE procedural_memory SET ${column} = ${column} + 1, last_used_at = datetime('now'), updated_at = datetime('now') WHERE name = ?`,
      ).run(name);
    } catch (error) {
      logger.error("记录结果失败", error instanceof Error ? error : undefined);
    }
  }

  /**
   * 按名称或描述搜索程序（支持模糊匹配）。
   */
  search(query: string): ProceduralMemoryEntry[] {
    try {
      // 转义 SQL LIKE 通配符，使查询中的字面 '%' 和 '_'
      // 不匹配任意字符。
      const escaped = query.replace(/[%_]/g, (ch) => `\\${ch}`);
      const rows = this.db.prepare(
        `SELECT * FROM procedural_memory
         WHERE name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'
         ORDER BY success_count DESC, updated_at DESC`,
      ).all(`%${escaped}%`, `%${escaped}%`) as any[];
      return rows.map(deserializeProcedural);
    } catch (error) {
      logger.error("搜索失败", error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * 按名称删除程序（从存储中移除）。
   */
  delete(name: string): void {
    try {
      this.db.prepare("DELETE FROM procedural_memory WHERE name = ?").run(name);
    } catch (error) {
      logger.error("删除失败", error instanceof Error ? error : undefined);
    }
  }
}

function deserializeProcedural(row: any): ProceduralMemoryEntry {
  let steps: ProceduralStep[] = [];
  try {
    steps = JSON.parse(row.steps || "[]");
  } catch {
    logger.error("解析步骤 JSON 失败：" + row.name);
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    steps,
    successCount: row.success_count,
    failureCount: row.failure_count,
    lastUsedAt: row.last_used_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
