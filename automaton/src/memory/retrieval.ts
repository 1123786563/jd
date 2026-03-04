/**
 * 记忆检索器
 *
 * 在 Token 预算内从所有层级检索相关记忆。
 * 优先级顺序: 工作 > 情景 > 语义 > 程序 > 关系。
 * 未使用的预算会滚动到下一层级。
 */

import type BetterSqlite3 from "better-sqlite3";
import type { MemoryBudget, MemoryRetrievalResult } from "../types.js";
import { DEFAULT_MEMORY_BUDGET } from "../types.js";
import { WorkingMemoryManager } from "./working.js";
import { EpisodicMemoryManager } from "./episodic.js";
import { SemanticMemoryManager } from "./semantic.js";
import { ProceduralMemoryManager } from "./procedural.js";
import { RelationshipMemoryManager } from "./relationship.js";
import { MemoryBudgetManager } from "./budget.js";
import { estimateTokens } from "../agent/context.js";
import { createLogger } from "../observability/logger.js";
const logger = createLogger("memory.retrieval");

type Database = BetterSqlite3.Database;

export class MemoryRetriever {
  private working: WorkingMemoryManager;
  private episodic: EpisodicMemoryManager;
  private semantic: SemanticMemoryManager;
  private procedural: ProceduralMemoryManager;
  private relationships: RelationshipMemoryManager;
  private budgetManager: MemoryBudgetManager;

  constructor(db: Database, budget?: MemoryBudget) {
    this.working = new WorkingMemoryManager(db);
    this.episodic = new EpisodicMemoryManager(db);
    this.semantic = new SemanticMemoryManager(db);
    this.procedural = new ProceduralMemoryManager(db);
    this.relationships = new RelationshipMemoryManager(db);
    this.budgetManager = new MemoryBudgetManager(budget ?? DEFAULT_MEMORY_BUDGET);
  }

  /**
   * 在 Token 预算内检索会话的相关记忆。
   * 优先级：工作 > 情景 > 语义 > 程序 > 关系。
   * 未使用的 Token 会滚动到下一层级（用于下一层级的检索）。
   */
  retrieve(sessionId: string, currentInput?: string): MemoryRetrievalResult {
    try {
      // 从每个层级获取原始记忆（工作、情景、语义、程序、关系）
      const workingEntries = this.working.getBySession(sessionId);

      const episodicEntries = this.episodic.getRecent(sessionId, 20);

      // 对于语义和程序记忆，如果可用则使用当前输入作为搜索查询（提高相关性）
      const semanticEntries = currentInput
        ? this.semantic.search(currentInput)
        : this.semantic.getByCategory("self");

      const proceduralEntries = currentInput
        ? this.procedural.search(currentInput)
        : [];

      const relationshipEntries = this.relationships.getTrusted(0.3);

      // 构建原始结果（包含所有层级的记忆）
      const raw: MemoryRetrievalResult = {
        workingMemory: workingEntries,
        episodicMemory: episodicEntries,
        semanticMemory: semanticEntries,
        proceduralMemory: proceduralEntries,
        relationships: relationshipEntries,
        totalTokens: 0,
      };

      // 应用预算分配（按优先级分配 token 预算）
      return this.budgetManager.allocate(raw);
    } catch (error) {
      logger.error("检索失败", error instanceof Error ? error : undefined);
      return {
        workingMemory: [],
        episodicMemory: [],
        semanticMemory: [],
        proceduralMemory: [],
        relationships: [],
        totalTokens: 0,
      };
    }
  }
}
