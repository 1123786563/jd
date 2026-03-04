/**
 * 记忆工具实现
 *
 * 为 Agent 可访问的记忆工具提供执行函数。
 * 每个函数通过记忆管理器直接操作数据库。
 */

import type BetterSqlite3 from "better-sqlite3";
import { WorkingMemoryManager } from "./working.js";
import { EpisodicMemoryManager } from "./episodic.js";
import { SemanticMemoryManager } from "./semantic.js";
import { ProceduralMemoryManager } from "./procedural.js";
import { RelationshipMemoryManager } from "./relationship.js";
import type { SemanticCategory, ProceduralStep } from "../types.js";

type Database = BetterSqlite3.Database;

/**
 * 存储语义记忆（事实）。
 */
export function rememberFact(
  db: Database,
  args: { category: string; key: string; value: string; confidence?: number; source?: string },
): string {
  try {
    const semantic = new SemanticMemoryManager(db);
    const id = semantic.store({
      category: args.category as SemanticCategory,
      key: args.key,
      value: args.value,
      confidence: args.confidence ?? 1.0,
      source: args.source ?? "agent",
    });
    return `事实已存储：[${args.category}/${args.key}] = ${args.value} (id: ${id})`;
  } catch (error) {
    return `存储事实失败：${error instanceof Error ? error.message : error}`;
  }
}

/**
 * 按类别和/或查询搜索语义记忆。
 */
export function recallFacts(
  db: Database,
  args: { category?: string; query?: string },
): string {
  try {
    const semantic = new SemanticMemoryManager(db);

    if (args.query) {
      const results = semantic.search(args.query, args.category as SemanticCategory | undefined);
      if (results.length === 0) return "未找到匹配的事实。";
      return results
        .map((r) => `[${r.category}/${r.key}] = ${r.value} (confidence: ${r.confidence})`)
        .join("\n");
    }

    if (args.category) {
      const results = semantic.getByCategory(args.category as SemanticCategory);
      if (results.length === 0) return `类别中没有事实：${args.category}`;
      return results
        .map((r) => `[${r.key}] = ${r.value} (confidence: ${r.confidence})`)
        .join("\n");
    }

    return "请提供类别或查询进行搜索。";
  } catch (error) {
    return `回忆事实失败：${error instanceof Error ? error.message : error}`;
  }
}

/**
 * 创建或更新工作记忆目标。
 */
export function setGoal(
  db: Database,
  args: { sessionId: string; content: string; priority?: number },
): string {
  try {
    const working = new WorkingMemoryManager(db);
    const id = working.add({
      sessionId: args.sessionId,
      content: args.content,
      contentType: "goal",
      priority: args.priority ?? 0.8,
    });
    return `目标已设置："${args.content}" (id: ${id}, priority: ${args.priority ?? 0.8})`;
  } catch (error) {
    return `设置目标失败：${error instanceof Error ? error.message : error}`;
  }
}

/**
 * 将目标标记为已完成并归档到情景记忆。
 */
export function completeGoal(
  db: Database,
  args: { goalId: string; sessionId: string; outcome?: string },
): string {
  try {
    const working = new WorkingMemoryManager(db);
    const episodic = new EpisodicMemoryManager(db);

    // 删除前获取目标内容
    const entries = working.getBySession(args.sessionId);
    const goal = entries.find((e) => e.id === args.goalId);

    if (!goal) {
      return `未找到目标：${args.goalId}`;
    }

    // 归档到情景记忆
    episodic.record({
      sessionId: args.sessionId,
      eventType: "goal_completed",
      summary: `目标已完成：${goal.content}`,
      detail: args.outcome ?? null,
      outcome: "success",
      importance: goal.priority,
      classification: "productive",
    });

    // 从工作记忆中删除
    working.delete(args.goalId);

    return `目标已完成并归档："${goal.content}"`;
  } catch (error) {
    return `完成目标失败：${error instanceof Error ? error.message : error}`;
  }
}

/**
 * 存储学习的程序。
 */
export function saveProcedure(
  db: Database,
  args: { name: string; description: string; steps: ProceduralStep[] | string },
): string {
  try {
    const procedural = new ProceduralMemoryManager(db);
    let steps: ProceduralStep[];
    if (typeof args.steps === "string") {
      steps = JSON.parse(args.steps);
    } else {
      steps = args.steps;
    }
    const id = procedural.save({
      name: args.name,
      description: args.description,
      steps,
    });
    return `程序已保存："${args.name}" 包含 ${steps.length} 个步骤 (id: ${id})`;
  } catch (error) {
    return `保存程序失败：${error instanceof Error ? error.message : error}`;
  }
}

/**
 * 按名称或搜索查询检索存储的程序。
 */
export function recallProcedure(
  db: Database,
  args: { name?: string; query?: string },
): string {
  try {
    const procedural = new ProceduralMemoryManager(db);

    if (args.name) {
      const proc = procedural.get(args.name);
      if (!proc) return `未找到程序：${args.name}`;
      const stepsStr = proc.steps
        .map((s) => `  ${s.order}. ${s.description}${s.tool ? ` [tool: ${s.tool}]` : ""}`)
        .join("\n");
      return `程序：${proc.name}\n描述：${proc.description}\n成功：${proc.successCount}，失败：${proc.failureCount}\n步骤：\n${stepsStr}`;
    }

    if (args.query) {
      const results = procedural.search(args.query);
      if (results.length === 0) return "未找到匹配的程序。";
      return results
        .map((r) => `${r.name}: ${r.description} (${r.steps.length} steps, ${r.successCount}/${r.successCount + r.failureCount} success)`)
        .join("\n");
    }

    return "请提供名称或查询进行搜索。";
  } catch (error) {
    return `回忆程序失败：${error instanceof Error ? error.message : error}`;
  }
}

/**
 * 记录关于另一个 Agent/实体的笔记。
 */
export function noteAboutAgent(
  db: Database,
  args: { entityAddress: string; entityName?: string; relationshipType: string; notes?: string; trustScore?: number },
): string {
  try {
    const rel = new RelationshipMemoryManager(db);
    const id = rel.record({
      entityAddress: args.entityAddress,
      entityName: args.entityName ?? null,
      relationshipType: args.relationshipType,
      trustScore: args.trustScore ?? 0.5,
      notes: args.notes ?? null,
    });
    return `关系已记录：${args.entityAddress} (${args.relationshipType}, trust: ${args.trustScore ?? 0.5})`;
  } catch (error) {
    return `记录 Agent 笔记失败：${error instanceof Error ? error.message : error}`;
  }
}

/**
 * 查看当前工作记忆和最近的情景记忆。
 */
export function reviewMemory(
  db: Database,
  args: { sessionId: string },
): string {
  try {
    const working = new WorkingMemoryManager(db);
    const episodic = new EpisodicMemoryManager(db);

    const workingEntries = working.getBySession(args.sessionId);
    const recentEpisodic = episodic.getRecent(args.sessionId, 5);

    const sections: string[] = [];

    if (workingEntries.length > 0) {
      sections.push("=== Working Memory ===");
      for (const e of workingEntries) {
        sections.push(`[${e.contentType}] (p=${e.priority}) ${e.content} [id: ${e.id}]`);
      }
    } else {
      sections.push("=== Working Memory ===\n(empty)");
    }

    if (recentEpisodic.length > 0) {
      sections.push("\n=== Recent History ===");
      for (const e of recentEpisodic) {
        sections.push(`[${e.eventType}] ${e.summary} (${e.outcome || "no outcome"}, ${e.classification})`);
      }
    } else {
      sections.push("\n=== Recent History ===\n(no recent events)");
    }

    return sections.join("\n");
  } catch (error) {
    return `审查记忆失败：${error instanceof Error ? error.message : error}`;
  }
}

/**
 * 按 id 和类型遗忘（删除）记忆条目。
 * 不允许删除包含创建者级别数据的条目。
 */
export function forget(
  db: Database,
  args: { id: string; memoryType: string },
): string {
  try {
    const typeToTable: Record<string, string> = {
      working: "working_memory",
      episodic: "episodic_memory",
      semantic: "semantic_memory",
      procedural: "procedural_memory",
      relationship: "relationship_memory",
    };

    const table = typeToTable[args.memoryType];
    if (!table) {
      return `未知的记忆类型：${args.memoryType}。请使用：working、episodic、semantic、procedural、relationship。`;
    }

    // 检查创建者保护的条目（语义类别 "creator"）
    if (args.memoryType === "semantic") {
      const row = db.prepare(
        "SELECT category FROM semantic_memory WHERE id = ?",
      ).get(args.id) as { category: string } | undefined;
      if (row?.category === "creator") {
        return "无法遗忘创建者级别的记忆。这些是受保护的。";
      }
    }

    const result = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(args.id);
    if (result.changes === 0) {
      return `未找到记忆条目：${args.id}`;
    }
    return `记忆条目已遗忘：${args.id} (${args.memoryType})`;
  } catch (error) {
    return `遗忘失败：${error instanceof Error ? error.message : error}`;
  }
}
