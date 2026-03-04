/**
 * 审计日志
 *
 * 所有自我修改的不可变仅追加日志。
 * 创建者可以看到 automaton 对自己所做的一切更改。
 */

import type {
  AutomatonDatabase,
  ModificationEntry,
  ModificationType,
} from "../types.js";
import { ulid } from "ulid";

/**
 * 将自我修改记录到审计跟踪中。
 */
export function logModification(
  db: AutomatonDatabase,
  type: ModificationType,
  description: string,
  options?: {
    filePath?: string;
    diff?: string;
    reversible?: boolean;
  },
): ModificationEntry {
  const entry: ModificationEntry = {
    id: ulid(),
    timestamp: new Date().toISOString(),
    type,
    description,
    filePath: options?.filePath,
    diff: options?.diff,
    reversible: options?.reversible ?? true,
  };

  db.insertModification(entry);
  return entry;
}

/**
 * 获取最近的修改以供显示或上下文使用。
 */
export function getRecentModifications(
  db: AutomatonDatabase,
  limit: number = 20,
): ModificationEntry[] {
  return db.getRecentModifications(limit);
}

/**
 * 为创建者生成所有修改的摘要。
 */
export function generateAuditReport(
  db: AutomatonDatabase,
): string {
  const mods = db.getRecentModifications(100);

  if (mods.length === 0) {
    return "未记录自我修改。";
  }

  const lines = [
    `=== 自我修改审计日志 ===`,
    `总修改数：${mods.length}`,
    ``,
  ];

  for (const mod of mods) {
    lines.push(
      `[${mod.timestamp}] ${mod.type}: ${mod.description}${mod.filePath ? ` (${mod.filePath})` : ""}`,
    );
  }

  lines.push(`=================================`);
  return lines.join("\n");
}
