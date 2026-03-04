/**
 * 记忆预算管理器
 *
 * 管理记忆检索的 Token 预算分配。
 * 修剪记忆检索结果以适应配置的预算。
 */

import type { MemoryBudget, MemoryRetrievalResult } from "../types.js";
import { estimateTokens } from "../agent/context.js";

export class MemoryBudgetManager {
  constructor(private budget: MemoryBudget) {}

  /**
   * 在预算范围内分配记忆，根据需要修剪每一层。
   * 返回适合预算的新 MemoryRetrievalResult。
   */
  allocate(memories: MemoryRetrievalResult): MemoryRetrievalResult {
    let totalTokens = 0;

    // 工作记忆层
    const { items: workingMemory, tokens: workingTokens } = this.trimTier(
      memories.workingMemory,
      this.budget.workingMemoryTokens,
      (entry) => estimateTokens(entry.content),
    );
    totalTokens += workingTokens;

    // 情景记忆层
    const { items: episodicMemory, tokens: episodicTokens } = this.trimTier(
      memories.episodicMemory,
      this.budget.episodicMemoryTokens,
      (entry) => estimateTokens(entry.summary + (entry.detail || "")),
    );
    totalTokens += episodicTokens;

    // 语义记忆层
    const { items: semanticMemory, tokens: semanticTokens } = this.trimTier(
      memories.semanticMemory,
      this.budget.semanticMemoryTokens,
      (entry) => estimateTokens(`${entry.category}/${entry.key}: ${entry.value}`),
    );
    totalTokens += semanticTokens;

    // 程序记忆层
    const { items: proceduralMemory, tokens: proceduralTokens } = this.trimTier(
      memories.proceduralMemory,
      this.budget.proceduralMemoryTokens,
      (entry) => estimateTokens(`${entry.name}: ${entry.description} (${entry.steps.length} steps)`),
    );
    totalTokens += proceduralTokens;

    // 关系记忆层
    const { items: relationships, tokens: relationshipTokens } = this.trimTier(
      memories.relationships,
      this.budget.relationshipMemoryTokens,
      (entry) => estimateTokens(`${entry.entityAddress}: ${entry.relationshipType} trust=${entry.trustScore}`),
    );
    totalTokens += relationshipTokens;

    return {
      workingMemory,
      episodicMemory,
      semanticMemory,
      proceduralMemory,
      relationships,
      totalTokens,
    };
  }

  /**
   * 估算文本字符串的 token 数量。
   */
  estimateTokens(text: string): number {
    return estimateTokens(text);
  }

  /**
   * 获取所有层的总预算。
   */
  getTotalBudget(): number {
    return (
      this.budget.workingMemoryTokens +
      this.budget.episodicMemoryTokens +
      this.budget.semanticMemoryTokens +
      this.budget.proceduralMemoryTokens +
      this.budget.relationshipMemoryTokens
    );
  }

  /**
   * 修剪层的项目以适应 token 预算。
   */
  private trimTier<T>(
    items: T[],
    budgetTokens: number,
    estimateFn: (item: T) => number,
  ): { items: T[]; tokens: number } {
    const result: T[] = [];
    let tokens = 0;

    for (const item of items) {
      const itemTokens = estimateFn(item);
      if (tokens + itemTokens > budgetTokens) break;
      result.push(item);
      tokens += itemTokens;
    }

    return { items: result, tokens };
  }
}
