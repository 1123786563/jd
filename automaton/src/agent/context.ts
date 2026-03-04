/**
 * 上下文窗口管理
 *
 * 管理智能体循环的对话历史。
 * 处理摘要以保持在 token 限制内。
 * 强制执行 token 预算以防止上下文窗口溢出。
 */

import type {
  ChatMessage,
  AgentTurn,
  AutomatonDatabase,
  InferenceClient,
  TokenBudget,
  MemoryRetrievalResult,
} from "../types.js";
import { DEFAULT_TOKEN_BUDGET } from "../types.js";
import { createTokenCounter } from "../memory/context-manager.js";

const MAX_CONTEXT_TURNS = 20;
const SUMMARY_THRESHOLD = 15;

let tokenCounter: ReturnType<typeof createTokenCounter> | null = null;

/** 单个工具结果的最大字符数 */
export const MAX_TOOL_RESULT_SIZE = 10_000;

// 重新导出以供外部使用
export type { TokenBudget };
export { DEFAULT_TOKEN_BUDGET };

/**
 * 从文本长度估算 token 数量。
 * 保守估计: 英文文本约每 4 个字符一个 token。
 */
export function estimateTokens(text: string): number {
  const content = text ?? "";
  const legacyEstimate = Math.ceil(content.length / 4);
  try {
    if (!tokenCounter) {
      tokenCounter = createTokenCounter();
    }
    const tokens = tokenCounter.countTokens(content);
    if (Number.isFinite(tokens) && tokens > 0) {
      // 保持保守的下限以避免上下文预算不足。
      return Math.max(tokens, legacyEstimate);
    }
  } catch {
    // 如果 token 计数器不可用，回退到保守的字符启发式方法。
  }
  return legacyEstimate;
}

/**
 * 截断工具结果以适应大小限制。
 * 如果内容被修剪，则附加截断通知。
 */
export function truncateToolResult(result: string, maxSize: number = MAX_TOOL_RESULT_SIZE): string {
  if (result.length <= maxSize) return result;
  return result.slice(0, maxSize) +
    `\n\n[已截断：省略了 ${result.length - maxSize} 个字符]`;
}

/**
 * 估算单个回合的总 token 数（输入 + 思考 + 工具调用/结果）。
 */
function estimateTurnTokens(turn: AgentTurn): number {
  let total = 0;
  if (turn.input) {
    total += estimateTokens(turn.input);
  }
  if (turn.thinking) {
    total += estimateTokens(turn.thinking);
  }
  for (const tc of turn.toolCalls) {
    total += estimateTokens(JSON.stringify(tc.arguments));
    total += estimateTokens(tc.error ? `Error: ${tc.error}` : tc.result);
  }
  return total;
}

/**
 * 构建下一次推理调用的消息数组。
 * 包括系统提示词 + 最近的对话历史。
 * 应用 token 预算强制执行和工具结果截断。
 */
export function buildContextMessages(
  systemPrompt: string,
  recentTurns: AgentTurn[],
  pendingInput?: { content: string; source: string },
  options?: {
    budget?: TokenBudget;
    inference?: InferenceClient;
  },
): ChatMessage[] {
  const budget = options?.budget ?? DEFAULT_TOKEN_BUDGET;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // 计算所有回合的 token 估算
  const turnTokens = recentTurns.map((turn) => ({
    turn,
    tokens: estimateTurnTokens(turn),
  }));

  const totalTurnTokens = turnTokens.reduce((sum, t) => sum + t.tokens, 0);

  let turnsToRender: AgentTurn[];
  let summaryMessage: string | null = null;

  if (totalTurnTokens > budget.recentTurns && recentTurns.length > 1) {
    // 将回合分为旧的（用于摘要）和最近的（保留）
    let recentTokens = 0;
    let splitIndex = recentTurns.length;

    // 从最近的回合向后遍历以找到分割点
    for (let i = turnTokens.length - 1; i >= 0; i--) {
      if (recentTokens + turnTokens[i].tokens > budget.recentTurns) {
        splitIndex = i + 1;
        break;
      }
      recentTokens += turnTokens[i].tokens;
      if (i === 0) splitIndex = 0;
    }

    // 确保我们至少摘要一些内容
    if (splitIndex === 0) splitIndex = 1;
    if (splitIndex >= recentTurns.length) splitIndex = Math.max(1, recentTurns.length - 1);

    const oldTurns = recentTurns.slice(0, splitIndex);
    turnsToRender = recentTurns.slice(splitIndex);

    // 构建旧回合的同步摘要
    //（当推理可用时，异步 summarizeTurns 被单独使用）
    const oldSummaries = oldTurns.map((t) => {
      const tools = t.toolCalls
        .map((tc) => `${tc.name}(${tc.error ? "FAILED" : "ok"})`)
        .join(", ");
      return `[${t.timestamp}] ${t.inputSource || "self"}: ${t.thinking.slice(0, 100)}${tools ? ` | tools: ${tools}` : ""}`;
    });
    summaryMessage = `前文上下文摘要（${oldTurns.length} 个回合已压缩）:\n${oldSummaries.join("\n")}`;
  } else {
    turnsToRender = recentTurns;
  }

  // 如果超出预算，添加旧回合的摘要
  if (summaryMessage) {
    messages.push({
      role: "user",
      content: `[system] ${summaryMessage}`,
    });
  }

  // 添加最近的回合作为对话历史
  for (const turn of turnsToRender) {
    // 如果有回合输入，作为用户消息添加
    if (turn.input) {
      messages.push({
        role: "user",
        content: `[${turn.inputSource || "system"}] ${turn.input}`,
      });
    }

    // 智能体的思考作为助手消息
    if (turn.thinking) {
      const msg: ChatMessage = {
        role: "assistant",
        content: turn.thinking,
      };

      // 如果有工具调用，包含它们
      if (turn.toolCalls.length > 0) {
        msg.tool_calls = turn.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        }));
      }
      messages.push(msg);

      // 添加带截断的工具结果
      for (const tc of turn.toolCalls) {
        const rawContent = tc.error
          ? `Error: ${tc.error}`
          : tc.result;
        messages.push({
          role: "tool",
          content: truncateToolResult(rawContent),
          tool_call_id: tc.id,
        });
      }
    }
  }

  // ── 反重复警告 ──
  // 分析最近 5 个回合中重复使用的工具
  const analysisWindow = recentTurns.slice(-5);
  if (analysisWindow.length >= 3) {
    const toolFrequency: Record<string, number> = {};
    for (const turn of analysisWindow) {
      for (const tc of turn.toolCalls) {
        toolFrequency[tc.name] = (toolFrequency[tc.name] || 0) + 1;
      }
    }
    const repeatedTools = Object.entries(toolFrequency)
      .filter(([, count]) => count >= 3)
      .map(([name]) => name);
    if (repeatedTools.length > 0) {
      messages.push({
        role: "user",
        content:
          `[system] 警告：您在最近的回合中重复调用 ${repeatedTools.join(", ")}。` +
          `您已经拥有这些信息。继续构建某些东西。` +
          `编写代码、创建文件、设置服务。不要再检查状态。`,
      });
    }
  }

  // 如果有待处理的输入，添加它
  if (pendingInput) {
    messages.push({
      role: "user",
      content: `[${pendingInput.source}] ${pendingInput.content}`,
    });
  }

  return messages;
}

/**
 * 修剪上下文以适应限制。
 * 保留系统提示词和最近的回合。
 */
export function trimContext(
  turns: AgentTurn[],
  maxTurns: number = MAX_CONTEXT_TURNS,
): AgentTurn[] {
  if (turns.length <= maxTurns) {
    return turns;
  }

  // 保留最近的回合
  return turns.slice(-maxTurns);
}

// === 阶段 2.2：内存块格式化 ===

/**
 * 将 MemoryRetrievalResult 格式化为文本块以进行上下文注入。
 * 作为系统消息包含在系统提示词和对话历史之间。
 */
export function formatMemoryBlock(memories: MemoryRetrievalResult): string {
  const sections: string[] = [];

  if (memories.workingMemory.length > 0) {
    sections.push("### Working Memory");
    for (const e of memories.workingMemory) {
      sections.push(`- [${e.contentType}] (p=${e.priority.toFixed(1)}) ${e.content}`);
    }
  }

  if (memories.episodicMemory.length > 0) {
    sections.push("### Recent History");
    for (const e of memories.episodicMemory) {
      sections.push(`- [${e.eventType}] ${e.summary} (${e.outcome || "neutral"})`);
    }
  }

  if (memories.semanticMemory.length > 0) {
    sections.push("### Known Facts");
    for (const e of memories.semanticMemory) {
      sections.push(`- [${e.category}/${e.key}] ${e.value}`);
    }
  }

  if (memories.proceduralMemory.length > 0) {
    sections.push("### Known Procedures");
    for (const e of memories.proceduralMemory) {
      sections.push(`- ${e.name}: ${e.description} (${e.steps.length} steps, ${e.successCount}/${e.successCount + e.failureCount} success)`);
    }
  }

  if (memories.relationships.length > 0) {
    sections.push("### Known Entities");
    for (const e of memories.relationships) {
      sections.push(`- ${e.entityName || e.entityAddress}: ${e.relationshipType} (trust: ${e.trustScore.toFixed(1)})`);
    }
  }

  if (sections.length === 0) return "";

  return `## Memory (${memories.totalTokens} tokens)\n\n${sections.join("\n")}`;
}

/**
 * 将旧回合摘要为紧凑的上下文条目。
 * 当上下文变得太大时使用。
 */
export async function summarizeTurns(
  turns: AgentTurn[],
  inference: InferenceClient,
): Promise<string> {
  if (turns.length === 0) return "无先前活动。";

  const turnSummaries = turns.map((t) => {
    const tools = t.toolCalls
      .map((tc) => `${tc.name}(${tc.error ? "FAILED" : "ok"})`)
      .join(", ");
    return `[${t.timestamp}] ${t.inputSource || "self"}: ${t.thinking.slice(0, 100)}${tools ? ` | tools: ${tools}` : ""}`;
  });

  // 如果回合足够少，直接返回摘要
  if (turns.length <= 5) {
    return `先前活动摘要:\n${turnSummaries.join("\n")}`;
  }

  // 对于许多回合，使用推理创建摘要
  try {
    const response = await inference.chat([
      {
        role: "system",
        content:
          "将以下智能体活动日志总结为简洁的段落。重点关注：完成了什么、失败了什么、当前目标以及下一回合的重要上下文。",
      },
      {
        role: "user",
        content: turnSummaries.join("\n"),
      },
    ], {
      maxTokens: 500,
      temperature: 0,
    });

    return `先前活动摘要:\n${response.message.content}`;
  } catch {
    // 回退：仅使用原始摘要
    return `先前活动摘要:\n${turnSummaries.slice(-5).join("\n")}`;
  }
}
