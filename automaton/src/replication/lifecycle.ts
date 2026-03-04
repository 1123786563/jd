/**
 * 子生命周期状态机
 *
 * 管理子自动机生命周期转换并进行验证。
 * 每个转换都记录在 child_lifecycle_events 表中。
 */

import type { Database as DatabaseType } from "better-sqlite3";
import { ulid } from "ulid";
import type { ChildLifecycleState, ChildLifecycleEventRow } from "../types.js";
import { VALID_TRANSITIONS } from "../types.js";
import {
  lifecycleInsertEvent,
  lifecycleGetEvents,
  lifecycleGetLatestState,
  getChildrenByStatus,
  updateChildStatus as dbUpdateChildStatus,
} from "../state/database.js";

export class ChildLifecycle {
  constructor(private db: DatabaseType) {}

  /**
   * 初始化子记录并插入第一个生命周期事件。
   */
  initChild(childId: string, name: string, sandboxId: string, genesisPrompt: string): void {
    // 在子表中插入子行
    this.db.prepare(
      `INSERT INTO children (id, name, address, sandbox_id, genesis_prompt, status, created_at)
       VALUES (?, ?, '', ?, ?, 'requested', datetime('now'))`,
    ).run(childId, name, sandboxId, genesisPrompt);

    // 记录初始事件
    const event: ChildLifecycleEventRow = {
      id: ulid(),
      childId,
      fromState: "none",
      toState: "requested",
      reason: "子自动机已创建",
      metadata: "{}",
      createdAt: new Date().toISOString(),
    };
    lifecycleInsertEvent(this.db, event);
    dbUpdateChildStatus(this.db, childId, "requested");
  }

  /**
   * 将子自动机转换到新状态并进行验证。
   * 在无效转换时抛出错误。
   */
  transition(childId: string, toState: ChildLifecycleState, reason?: string, metadata?: Record<string, unknown>): void {
    const current = this.getCurrentState(childId);
    const allowed = VALID_TRANSITIONS[current];

    if (!allowed || !allowed.includes(toState)) {
      throw new Error(`无效的生命周期转换：${current} → ${toState}`);
    }

    // 记录转换事件
    const event: ChildLifecycleEventRow = {
      id: ulid(),
      childId,
      fromState: current,
      toState,
      reason: reason ?? null,
      metadata: JSON.stringify(metadata ?? {}),
      createdAt: new Date().toISOString(),
    };
    lifecycleInsertEvent(this.db, event);

    // 更新子表
    dbUpdateChildStatus(this.db, childId, toState);
  }

  /**
   * 获取子自动机的当前生命周期状态。
   */
  getCurrentState(childId: string): ChildLifecycleState {
    const state = lifecycleGetLatestState(this.db, childId);
    if (!state) {
      throw new Error(`在生命周期事件中未找到子自动机 ${childId}`);
    }
    return state;
  }

  /**
   * 获取子自动机的完整生命周期事件历史。
   */
  getHistory(childId: string): ChildLifecycleEventRow[] {
    return lifecycleGetEvents(this.db, childId);
  }

  /**
   * 获取给定生命周期状态中的所有子自动机。
   */
  getChildrenInState(state: ChildLifecycleState): Array<{ id: string; name: string; sandboxId: string; status: string; createdAt: string; lastChecked: string | null }> {
    const rows = getChildrenByStatus(this.db, state);
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      sandboxId: row.sandbox_id,
      status: row.status,
      createdAt: row.created_at,
      lastChecked: row.last_checked ?? null,
    }));
  }
}
