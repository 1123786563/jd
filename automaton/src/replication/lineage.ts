/**
 * 世系追踪
 *
 * 追踪自动机之间的父子关系。
 * 父自动机在 SQLite 中记录子自动机。
 * 子自动机在配置中记录其父自动机。
 * ERC-8004 注册包括 parentAgent 字段。
 *
 * 阶段 3.1：实际的修剪 + 并发限制的刷新。
 */

import type {
  AutomatonDatabase,
  ChildAutomaton,
  AutomatonConfig,
  ConwayClient,
} from "../types.js";
import type { ChildLifecycle } from "./lifecycle.js";
import type { ChildHealthMonitor } from "./health.js";
import type { SandboxCleanup } from "./cleanup.js";
import { deleteChild } from "../state/database.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("replication.lineage");

/**
 * 获取完整的世系树（父 -> 子）。
 */
export function getLineage(db: AutomatonDatabase): {
  children: ChildAutomaton[];
  alive: number;
  dead: number;
  total: number;
} {
  const children = db.getChildren();
  const alive = children.filter(
    (c) => c.status === "running" || c.status === "sleeping" || c.status === "healthy",
  ).length;
  const dead = children.filter((c) => c.status === "dead" || c.status === "failed" || c.status === "cleaned_up").length;

  return {
    children,
    alive,
    dead,
    total: children.length,
  };
}

/**
 * 检查此自动机是否有父自动机（即自身是子自动机）。
 */
export function hasParent(config: AutomatonConfig): boolean {
  return !!config.parentAddress;
}

/**
 * 获取用于系统提示的世系摘要。
 */
export function getLineageSummary(
  db: AutomatonDatabase,
  config: AutomatonConfig,
): string {
  const lineage = getLineage(db);
  const parts: string[] = [];

  if (hasParent(config)) {
    parts.push(`Parent: ${config.parentAddress}`);
  }

  if (lineage.total > 0) {
    parts.push(
      `Children: ${lineage.total} total (${lineage.alive} alive, ${lineage.dead} dead)`,
    );
    for (const child of lineage.children) {
      parts.push(
        `  - ${child.name} [${child.status}] sandbox:${child.sandboxId}`,
      );
    }
  }

  return parts.length > 0 ? parts.join("\n") : "No lineage (first generation)";
}

/**
 * 修剪已死亡的子自动机：实际从数据库中删除并清理沙盒。
 * 阶段 3.1 修复：之前是空操作。
 */
export async function pruneDeadChildren(
  db: AutomatonDatabase,
  cleanup?: SandboxCleanup,
  keepLast: number = 5,
): Promise<number> {
  const children = db.getChildren();
  const dead = children.filter(
    (c) => c.status === "dead" || c.status === "failed" || c.status === "stopped",
  );

  if (dead.length <= keepLast) return 0;

  // 按创建日期排序，最旧的在前
  dead.sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  // 保留最近的 `keepLast` 个已死亡的子自动机
  const toRemove = dead.slice(0, dead.length - keepLast);
  let removed = 0;

  for (const child of toRemove) {
    try {
      // 如果清理可用且子自动机处于可清理状态，则清理沙盒
      if (cleanup && (child.status === "stopped" || child.status === "failed" || child.status === "dead")) {
        try {
          await cleanup.cleanup(child.id);
        } catch {
          // 清理可能失败；仍删除记录
        }
      }

      // 实际从数据库中删除
      deleteChild(db.raw, child.id);
      removed++;
    } catch (error) {
      logger.error(`修剪子自动机 ${child.id} 失败`, error instanceof Error ? error : undefined);
    }
  }

  return removed;
}

/**
 * 使用健康监视器刷新所有子自动机的状态。
 * 并发限制为 3 个同时检查。
 */
export async function refreshChildrenStatus(
  conway: ConwayClient,
  db: AutomatonDatabase,
  healthMonitor?: ChildHealthMonitor,
): Promise<void> {
  if (healthMonitor) {
    // 使用具有内置并发限制的健康监视器
    await healthMonitor.checkAllChildren();
    return;
  }

  // 传统路径：并发限制为 3 的顺序检查
  const children = db.getChildren().filter((c) => c.status !== "dead" && c.status !== "cleaned_up");
  const maxConcurrent = 3;

  for (let i = 0; i < children.length; i += maxConcurrent) {
    const batch = children.slice(i, i + maxConcurrent);
    await Promise.all(
      batch.map(async (child) => {
        try {
          const result = await conway.exec("echo alive", 10_000);
          if (result.exitCode !== 0) {
            db.updateChildStatus(child.id, "unknown" as any);
          }
        } catch {
          db.updateChildStatus(child.id, "unknown" as any);
        }
      }),
    );
  }
}
