/**
 * 用于 Agent 记忆的仅追加事件流。
 *
 * 提供事件的持久化存储、检索和压缩功能。
 */

import type BetterSqlite3 from "better-sqlite3";
import { ulid } from "ulid";
import {
  getEventsByGoal,
  getEventsByType,
  getRecentEvents,
  type EventStreamRow,
} from "../state/database.js";

type Database = BetterSqlite3.Database;

export type EventType =
  | "user_input"           // 用户输入
  | "plan_created"         // 计划创建
  | "plan_updated"         // 计划更新
  | "task_assigned"        // 任务分配
  | "task_completed"       // 任务完成
  | "task_failed"          // 任务失败
  | "action"               // 动作
  | "observation"          // 观察
  | "inference"            // 推理
  | "financial"            // 财务
  | "agent_spawned"        // Agent 生成
  | "agent_died"           // Agent 终止
  | "knowledge"            // 知识
  | "market_signal"        // 市场信号
  | "revenue"              // 收入
  | "error"                // 错误
  | "reflection";          // 反思

export interface StreamEvent {
  id: string;
  type: EventType;
  agentAddress: string;
  goalId: string | null;
  taskId: string | null;
  content: string;
  tokenCount: number;
  compactedTo: string | null;  // 压缩后的引用，若未压缩则为 null
  createdAt: string;
}

export interface CompactionResult {
  compactedCount: number;     // 已压缩的事件数量
  tokensSaved: number;        // 节省的 token 数量
  strategy: string;           // 使用的压缩策略
}

// 估算文本的 token 数量（粗略估计：每 3.5 个字符约为 1 个 token）
export function estimateTokens(text: string): number {
  return Math.ceil((text ?? "").length / 3.5);
}

export class EventStream {
  constructor(private readonly db: Database) {}

  // 追加新事件到流中
  append(event: Omit<StreamEvent, "id" | "createdAt">): string {
    const id = ulid();
    const createdAt = new Date().toISOString();
    const tokenCount = event.tokenCount === 0
      ? estimateTokens(event.content)
      : event.tokenCount;

    this.db.prepare(
      `INSERT INTO event_stream (id, type, agent_address, goal_id, task_id, content, token_count, compacted_to, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      event.type,
      event.agentAddress,
      event.goalId,
      event.taskId,
      event.content,
      tokenCount,
      event.compactedTo,
      createdAt,
    );

    return id;
  }

  // 获取指定 agent 最近的N个事件
  getRecent(agentAddress: string, limit: number = 50): StreamEvent[] {
    return getRecentEvents(this.db, agentAddress, limit).map(toStreamEvent);
  }

  // 获取指定目标的所有事件
  getByGoal(goalId: string): StreamEvent[] {
    return getEventsByGoal(this.db, goalId).map(toStreamEvent);
  }

  // 获取指定类型的事件，可指定时间范围
  getByType(type: EventType, since?: string): StreamEvent[] {
    return getEventsByType(this.db, type, since).map(toStreamEvent);
  }

  // 压缩早于指定时间的事件以节省空间
  // 使用引用或摘要策略来减少 token 使用
  compact(
    olderThan: string,
    strategy: "reference" | "summarize",  // 引用或摘要
  ): CompactionResult {
    const rows = this.db.prepare(
      `SELECT id, type, content, token_count as tokenCount, created_at as createdAt
       FROM event_stream
       WHERE created_at < ? AND compacted_to IS NULL
       ORDER BY created_at ASC`,
    ).all(olderThan) as Array<{
      id: string;
      type: string;
      content: string;
      tokenCount: number;
      createdAt: string;
    }>;

    if (rows.length === 0) {
      return {
        compactedCount: 0,
        tokensSaved: 0,
        strategy,
      };
    }

    const updateStatement = this.db.prepare(
      "UPDATE event_stream SET compacted_to = ? WHERE id = ?",
    );

    let compactedCount = 0;
    let tokensSaved = 0;

    for (const row of rows) {
      const compactedTo = strategy === "reference"
        ? buildReference(row)
        : buildSummary(row);
      updateStatement.run(compactedTo, row.id);
      compactedCount += 1;
      tokensSaved += Math.max(
        0,
        row.tokenCount - estimateTokens(compactedTo),
      );
    }

    return {
      compactedCount,
      tokensSaved,
      strategy,
    };
  }

  // 获取指定 agent 的 token 总数，可指定时间范围
  getTokenCount(agentAddress: string, since?: string): number {
    if (since) {
      const row = this.db.prepare(
        `SELECT COALESCE(SUM(token_count), 0) as total
         FROM event_stream
         WHERE agent_address = ? AND created_at >= ?`,
      ).get(agentAddress, since) as { total: number };
      return row.total ?? 0;
    }

    const row = this.db.prepare(
      `SELECT COALESCE(SUM(token_count), 0) as total
       FROM event_stream
       WHERE agent_address = ?`,
    ).get(agentAddress) as { total: number };
    return row.total ?? 0;
  }

  // 删除早于指定时间的事件（永久删除，谨慎使用）
  prune(olderThan: string): number {
    const result = this.db.prepare(
      "DELETE FROM event_stream WHERE created_at < ?",
    ).run(olderThan);
    return result.changes;
  }
}

function toStreamEvent(row: EventStreamRow): StreamEvent {
  return {
    id: row.id,
    type: row.type as EventType,
    agentAddress: row.agentAddress,
    goalId: row.goalId,
    taskId: row.taskId,
    content: row.content,
    tokenCount: row.tokenCount,
    compactedTo: row.compactedTo,
    createdAt: row.createdAt,
  };
}

// 构建事件引用字符串（压缩策略：仅保留元数据）
function buildReference(row: {
  id: string;
  type: string;
  createdAt: string;
}): string {
  return `ref:${row.id.slice(0, 10)}:${row.type}:${row.createdAt}`;
}

// 构建事件摘要字符串（压缩策略：截断内容）
function buildSummary(row: {
  type: string;
  content: string;
}): string {
  const normalized = row.content.replace(/\s+/g, " ").trim();
  const snippet = normalized.length > 96
    ? `${normalized.slice(0, 96)}...`
    : normalized;
  return `summary:${row.type}:${snippet}`;
}
