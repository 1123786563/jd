/**
 * Agent 上下文聚合器
 *
 * 通过分诊和聚合子更新来防止父上下文爆炸。
 */

export interface AgentStatusUpdate {
  agentAddress: string;
  department?: string;
  role?: string;
  status?: string;
  kind?: string;
  message?: string;
  taskId?: string;
  error?: string;
  blocked?: boolean;
  financialAmount?: number;
  dailyBudget?: number;
  budgetImpactPercent?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface AggregatedSummaryEntry {
  group: string;
  count: number;
  completed: number;
  progress: number;
  other: number;
  highlight: string | null;
}

export interface AggregatedUpdate {
  summary: string;
  fullUpdates: AgentStatusUpdate[];
  summaryEntries: AggregatedSummaryEntry[];
  heartbeatCount: number;
  triageCounts: {
    full: number;
    summary: number;
    count: number;
  };
  estimatedTokens: number;
}

// 用于累积各组的统计信息
interface GroupAccumulator {
  count: number;
  completed: number;
  progress: number;
  other: number;
  highlights: string[];
}

// 匹配心跳状态的模式
const HEARTBEAT_PATTERNS = ["heartbeat", "alive", "ping", "health"];
// 匹配错误状态的模式
const ERROR_PATTERNS = ["error", "failed", "exception", "fatal"];
// 匹配阻塞状态的模式
const BLOCKED_PATTERNS = ["blocked", "stalled", "waiting_on_dependency"];
// 匹配完成状态的模式
const COMPLETED_PATTERNS = ["completed", "done", "finished", "resolved"];
// 匹配进行中状态的模式
const PROGRESS_PATTERNS = ["progress", "running", "in_progress", "working"];

export class AgentContextAggregator {
  // 聚合子 Agent 的状态更新
  aggregateChildUpdates(
    updates: AgentStatusUpdate[],
    budgetTokens: number,
  ): AggregatedUpdate {
    const fullUpdates: AgentStatusUpdate[] = [];
    const groupedSummaries = new Map<string, GroupAccumulator>();
    let heartbeatCount = 0;

    // 分诊统计：分别计数完整展示、摘要和仅心跳的更新
    const triageCounts = {
      full: 0,
      summary: 0,
      count: 0,
    };

    for (const update of updates) {
      const mode = this.triageUpdate(update);
      triageCounts[mode] += 1;

      if (mode === "full") {
        fullUpdates.push(update);
        continue;
      }

      if (mode === "count") {
        heartbeatCount += 1;
        continue;
      }

      const group = update.department ?? update.role ?? "general";
      const current = groupedSummaries.get(group) ?? {
        count: 0,
        completed: 0,
        progress: 0,
        other: 0,
        highlights: [],
      };

      current.count += 1;

      if (matchesAny(update.status, COMPLETED_PATTERNS) || matchesAny(update.kind, COMPLETED_PATTERNS)) {
        current.completed += 1;
      } else if (
        matchesAny(update.status, PROGRESS_PATTERNS) ||
        matchesAny(update.kind, PROGRESS_PATTERNS)
      ) {
        current.progress += 1;
      } else {
        current.other += 1;
      }

      const highlight = normalizeMessage(update.message);
      if (highlight) {
        current.highlights.push(highlight);
      }

      groupedSummaries.set(group, current);
    }

    const summaryEntries: AggregatedSummaryEntry[] = [...groupedSummaries.entries()].map(
      ([group, value]) => ({
        group,
        count: value.count,
        completed: value.completed,
        progress: value.progress,
        other: value.other,
        highlight: value.highlights[0] ?? null,
      }),
    );

    const summary = this.renderSummary({
      summaryEntries,
      fullUpdates,
      heartbeatCount,
      triageCounts,
      budgetTokens,
    });

    return {
      summary,
      fullUpdates,
      summaryEntries,
      heartbeatCount,
      triageCounts,
      estimatedTokens: estimateTokens(summary),
    };
  }

  // 分诊更新：决定如何展示每个更新（完整/摘要/仅计数）
  triageUpdate(update: AgentStatusUpdate): "full" | "summary" | "count" {
    if (this.isError(update)) return "full";
    if (this.isLargeFinancialEvent(update)) return "full";
    if (this.isBlocked(update)) return "full";
    if (this.isCompleted(update)) return "summary";
    if (this.isProgress(update)) return "summary";
    if (this.isHeartbeat(update)) return "count";
    return "summary";
  }

  // 渲染聚合摘要文本
  private renderSummary(params: {
    summaryEntries: AggregatedSummaryEntry[];
    fullUpdates: AgentStatusUpdate[];
    heartbeatCount: number;
    triageCounts: { full: number; summary: number; count: number };
    budgetTokens: number;
  }): string {
    const lines: string[] = [];

    if (params.fullUpdates.length > 0) {
      lines.push("完整详情更新：");
      for (const update of params.fullUpdates) {
        const status = update.status ?? update.kind ?? "update";
        const message = normalizeMessage(update.message, 180) ?? "(no message)";
        lines.push(`- ${update.agentAddress} [${status}] ${message}`);
      }
    }

    if (params.summaryEntries.length > 0) {
      lines.push("分组摘要：");
      for (const entry of params.summaryEntries) {
        const highlight = entry.highlight ? ` | ${entry.highlight}` : "";
        lines.push(
          `- ${entry.group}: ${entry.count} updates (${entry.completed} completed, ${entry.progress} progress, ${entry.other} other)${highlight}`,
        );
      }
    }

    if (params.heartbeatCount > 0) {
      lines.push(`仅心跳更新：${params.heartbeatCount} 个 agent 存活。`);
    }

    lines.push(
      `分诊计数：完整=${params.triageCounts.full}，摘要=${params.triageCounts.summary}，计数=${params.triageCounts.count}。`,
    );

    let rendered = lines.join("\n");
    if (params.budgetTokens <= 0) return "";

    const maxChars = params.budgetTokens * 4;
    if (rendered.length <= maxChars) return rendered;

    // 优先保留高信噪比的更新，从末尾裁剪
    rendered = `${rendered.slice(0, maxChars - 25)}\n[因 token 预算而截断]`;
    return rendered;
  }

  private isError(update: AgentStatusUpdate): boolean {
    if (typeof update.error === "string" && update.error.trim().length > 0) return true;
    return (
      matchesAny(update.status, ERROR_PATTERNS) ||
      matchesAny(update.kind, ERROR_PATTERNS) ||
      matchesAny(update.message, ERROR_PATTERNS)
    );
  }

  private isLargeFinancialEvent(update: AgentStatusUpdate): boolean {
    if (typeof update.budgetImpactPercent === "number") {
      return update.budgetImpactPercent > 10;
    }

    if (
      typeof update.financialAmount === "number" &&
      typeof update.dailyBudget === "number" &&
      update.dailyBudget > 0
    ) {
      return (Math.abs(update.financialAmount) / update.dailyBudget) > 0.1;
    }

    return false;
  }

  private isBlocked(update: AgentStatusUpdate): boolean {
    if (update.blocked === true) return true;
    return (
      matchesAny(update.status, BLOCKED_PATTERNS) ||
      matchesAny(update.kind, BLOCKED_PATTERNS) ||
      matchesAny(update.message, BLOCKED_PATTERNS)
    );
  }

  private isCompleted(update: AgentStatusUpdate): boolean {
    return (
      matchesAny(update.status, COMPLETED_PATTERNS) ||
      matchesAny(update.kind, COMPLETED_PATTERNS)
    );
  }

  private isProgress(update: AgentStatusUpdate): boolean {
    return (
      matchesAny(update.status, PROGRESS_PATTERNS) ||
      matchesAny(update.kind, PROGRESS_PATTERNS)
    );
  }

  private isHeartbeat(update: AgentStatusUpdate): boolean {
    return (
      matchesAny(update.status, HEARTBEAT_PATTERNS) ||
      matchesAny(update.kind, HEARTBEAT_PATTERNS) ||
      matchesAny(update.message, HEARTBEAT_PATTERNS)
    );
  }
}

// 检查值是否匹配任一模式（不区分大小写）
function matchesAny(value: string | undefined, patterns: string[]): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

// 规范化消息：去空白并截断
function normalizeMessage(input: string | undefined, maxChars: number = 120): string | null {
  if (!input) return null;
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length === 0) return null;
  if (compact.length <= maxChars) return compact;
  return `${compact.slice(0, maxChars)}...`;
}

// 估算文本的 token 数量
function estimateTokens(text: string): number {
  return Math.ceil((text ?? "").length / 3.5);
}
