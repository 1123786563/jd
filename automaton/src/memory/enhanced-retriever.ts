/**
 * 增强的记忆检索，具有基于元数据的相关性评分。
 *
 * 此模块有意不使用嵌入/向量搜索。
 * 使用多因素评分（时间、频率、置信度、任务关联性、类别匹配）来排序记忆。
 */

import type BetterSqlite3 from "better-sqlite3";
import type { MemoryBudget } from "../types.js";
import { estimateTokens } from "../agent/context.js";
import type { ContextUtilization } from "./context-manager.js";
import {
  KnowledgeStore,
  type KnowledgeCategory,
  type KnowledgeEntry,
} from "./knowledge-store.js";
import { MemoryRetriever } from "./retrieval.js";

type Database = BetterSqlite3.Database;

// 评分权重配置
const RECENCY_WEIGHT = 0.3;           // 时间权重
const FREQUENCY_WEIGHT = 0.2;         // 频率权重
const CONFIDENCE_WEIGHT = 0.2;        // 置信度权重
const TASK_AFFINITY_WEIGHT = 0.2;     // 任务关联性权重
const CATEGORY_MATCH_WEIGHT = 0.1;    // 类别匹配权重

// 反馈窗口和预算限制
const MAX_ROLLING_FEEDBACK_WINDOW = 20;   // 最大滚动反馈窗口
const MIN_MEMORY_BUDGET = 2_000;          // 最小记忆预算
const MAX_MEMORY_BUDGET = 20_000;         // 最大记忆预算
const KNOWLEDGE_SEARCH_LIMIT = 50;        // 知识搜索限制

// 停用词集合（用于提取术语时过滤）
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "how", "i", "in", "is", "it", "of", "on", "or", "that", "the",
  "this", "to", "was", "we", "what", "when", "where", "who", "why", "with",
]);

// 缩写扩展映射
const ABBREVIATION_EXPANSIONS: Record<string, string[]> = {
  aa: ["account abstraction"],
  api: ["application programming interface"],
  ci: ["continuous integration"],
  cd: ["continuous deployment"],
  db: ["database"],
  llm: ["large language model"],
  mcp: ["model context protocol"],
  pnl: ["profit and loss"],
  qa: ["quality assurance"],
  rag: ["retrieval augmented generation"],
  sre: ["site reliability engineering"],
  ts: ["typescript"],
  ui: ["user interface"],
  ux: ["user experience"],
};

// 类别关键词映射
const CATEGORY_KEYWORDS: Record<KnowledgeCategory, string[]> = {
  market: ["market", "competitor", "pricing", "trend", "demand"],
  technical: ["code", "bug", "api", "database", "architecture", "deploy", "infra"],
  social: ["community", "user", "customer", "support", "feedback", "partner"],
  financial: ["revenue", "cost", "budget", "finance", "profit", "loss", "invoice"],
  operational: ["process", "runbook", "incident", "handoff", "workflow", "sla"],
};

// 反馈窗口和数据库
const feedbackPrecisionWindow: number[] = [];
const feedbackByTurn = new Map<string, RetrievalFeedback>();
let lastRollingPrecision: number | undefined;
let feedbackDb: Database | null = null;

export interface ScoredMemoryEntry {
  entry: any; // 类似 MemoryEntry 的对象（知识/记忆层条目）
  relevanceScore: number;  // 相关性得分（0-1）
  scoringFactors: {
    recency: number;       // 时间得分
    frequency: number;     // 频率得分
    confidence: number;    // 置信度得分
    taskAffinity: number;  // 任务关联性得分
    categoryMatch: number; // 类别匹配得分
  };
}

export interface ScoredMemoryRetrievalResult {
  entries: ScoredMemoryEntry[];
  totalTokens: number;
  truncated: boolean;          // 是否因预算限制而截断
  retrievalPrecision?: number; // 检索精度（滚动平均）
}

export interface RetrievalFeedback {
  turnId: string;
  retrieved: string[];         // 检索到的条目 ID
  matched: string[];           // 实际使用的条目 ID
  retrievalPrecision: number;  // 当前回合的检索精度
  rollingPrecision: number;    // 滚动平均精度
}

export interface EnhancedQuery {
  terms: string[];                    // 搜索词列表
  categories: KnowledgeCategory[];     // 相关类别
  timeRange?: { since: string };      // 时间范围过滤
}

/**
 * 根据上下文利用率计算记忆预算。
 */
export function calculateMemoryBudget(
  utilization: ContextUtilization,
  tokensAfterSystemPrompt: number,
): number {
  let ratio = 0.1;

  // 根据利用率调整比例
  if (utilization.utilizationPercent > 70) {
    ratio = 0.05;  // 高利用率时减少记忆预算
  } else if (utilization.utilizationPercent < 50) {
    ratio = 0.15;  // 低利用率时增加记忆预算
  }

  const rawBudget = Math.floor(Math.max(0, tokensAfterSystemPrompt) * ratio);
  return clampNumber(rawBudget, MIN_MEMORY_BUDGET, MAX_MEMORY_BUDGET);
}

/**
 * 增强查询：提取术语、类别和时间范围。
 */
export function enhanceQuery(params: {
  currentInput: string;
  taskSpec?: string;
  agentRole?: string;
  recentGoals?: string[];
}): EnhancedQuery {
  const currentInput = params.currentInput ?? "";
  const taskSpec = params.taskSpec ?? "";
  const recentGoals = params.recentGoals ?? [];

  const allText = [currentInput, taskSpec, ...recentGoals]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ");

  const terms = dedupeStrings([
    ...extractTerms(currentInput),
    ...extractTerms(taskSpec),
    ...recentGoals.map((goal) => goal.trim().toLowerCase()).filter(Boolean),
  ]);

  const expandedTerms = dedupeStrings(expandAbbreviations(terms)).slice(0, 25);
  const categories = dedupeCategories([
    ...categoriesFromRole(params.agentRole),
    ...categoriesFromText(allText),
  ]);

  const timeRange = inferTimeRange(allText);
  return {
    terms: expandedTerms,
    categories,
    ...(timeRange ? { timeRange } : {}),
  };
}

/**
 * 记录检索反馈，用于计算滚动精度。
 */
export function recordRetrievalFeedback(feedback: RetrievalFeedback): void {
  const retrieved = dedupeStrings(feedback.retrieved).filter((id) => id.length > 0);
  const retrievedSet = new Set(retrieved);

  let matched = dedupeStrings(feedback.matched).filter((id) => retrievedSet.has(id));

  // 如果有数据库上下文，对回合响应执行子字符串匹配
  if (feedbackDb && retrieved.length > 0) {
    const response = getTurnResponse(feedbackDb, feedback.turnId);
    if (response.length > 0) {
      const autoMatched = matchRetrievedKnowledgeInResponse(feedbackDb, retrieved, response);
      if (autoMatched.length > 0) {
        matched = dedupeStrings([...matched, ...autoMatched]).filter((id) => retrievedSet.has(id));
        incrementKnowledgeAccessCount(feedbackDb, autoMatched);
      }
    }
  }

  const retrievalPrecision = retrieved.length === 0
    ? 0
    : matched.length / retrieved.length;
  const rollingPrecision = pushRollingPrecision(retrievalPrecision);

  feedbackByTurn.set(feedback.turnId, {
    turnId: feedback.turnId,
    retrieved,
    matched,
    retrievalPrecision,
    rollingPrecision,
  });
}

export class EnhancedRetriever extends MemoryRetriever {
  private readonly db: Database;
  private readonly knowledgeStore: KnowledgeStore;
  private readonly taskStore?: any;

  constructor(db: Database, budget?: MemoryBudget, taskStore?: any) {
    super(db, budget);
    this.db = db;
    this.taskStore = taskStore;
    this.knowledgeStore = new KnowledgeStore(db);
    feedbackDb = db;
  }

  /**
   * 带评分的记忆检索。
   */
  retrieveScored(params: {
    sessionId: string;
    currentInput?: string;
    currentTaskId?: string;
    currentGoalId?: string;
    agentRole?: string;
    budgetTokens: number;
  }): ScoredMemoryRetrievalResult {
    const taskSpec = this.resolveTaskSpec(params.currentTaskId);
    const recentGoals = this.resolveRecentGoals(params.currentGoalId);

    const query = enhanceQuery({
      currentInput: params.currentInput ?? "",
      taskSpec,
      agentRole: params.agentRole,
      recentGoals,
    });

    const candidates = this.collectKnowledgeCandidates(query);

    const scored = candidates
      .map((entry) => {
        const scoringFactors = this.computeScoringFactors(entry, query, params);
        const relevanceScore = clamp01(
          (scoringFactors.recency * RECENCY_WEIGHT)
          + (scoringFactors.frequency * FREQUENCY_WEIGHT)
          + (scoringFactors.confidence * CONFIDENCE_WEIGHT)
          + (scoringFactors.taskAffinity * TASK_AFFINITY_WEIGHT)
          + (scoringFactors.categoryMatch * CATEGORY_MATCH_WEIGHT),
        );

        return {
          entry,
          relevanceScore,
          scoringFactors,
        } satisfies ScoredMemoryEntry;
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    if (scored.length === 0 || scored[0].relevanceScore < 0.3) {
      return this.buildResult([], 0, false);
    }

    const budgetTokens = Math.max(0, Math.floor(params.budgetTokens));
    if (budgetTokens === 0) {
      return this.buildResult([], 0, scored.length > 0);
    }

    const selected: ScoredMemoryEntry[] = [];
    let totalTokens = 0;
    let truncated = false;

    for (const candidate of scored) {
      const entryTokens = this.resolveEntryTokenCount(candidate.entry);
      if (entryTokens <= 0) continue;

      if (totalTokens + entryTokens > budgetTokens) {
        truncated = true;
        continue;
      }

      selected.push(candidate);
      totalTokens += entryTokens;
    }

    return this.buildResult(selected, totalTokens, truncated);
  }

  recordRetrievalFeedback(feedback: RetrievalFeedback): void {
    recordRetrievalFeedback(feedback);
  }

  private buildResult(
    entries: ScoredMemoryEntry[],
    totalTokens: number,
    truncated: boolean,
  ): ScoredMemoryRetrievalResult {
    const result: ScoredMemoryRetrievalResult = {
      entries,
      totalTokens,
      truncated,
    };

    if (lastRollingPrecision !== undefined) {
      result.retrievalPrecision = lastRollingPrecision;
    }

    return result;
  }

  /**
   * 收集知识候选条目。
   */
  private collectKnowledgeCandidates(query: EnhancedQuery): KnowledgeEntry[] {
    const byId = new Map<string, KnowledgeEntry>();

    if (query.terms.length === 0) {
      // 无术语时按类别获取
      for (const category of query.categories) {
        for (const entry of this.knowledgeStore.getByCategory(category)) {
          byId.set(entry.id, entry);
        }
      }
    } else {
      // 按术语搜索
      for (const term of query.terms) {
        const results = this.searchTermAcrossCategories(term, query.categories);
        for (const entry of results) {
          byId.set(entry.id, entry);
        }
      }
    }

    let entries = [...byId.values()];

    // 应用时间范围过滤
    if (query.timeRange?.since) {
      const sinceMs = Date.parse(query.timeRange.since);
      if (!Number.isNaN(sinceMs)) {
        entries = entries.filter((entry) => {
          const referenceTime = Date.parse(entry.lastVerified || entry.createdAt);
          return !Number.isNaN(referenceTime) && referenceTime >= sinceMs;
        });
      }
    }

    return entries;
  }

  /**
   * 跨类别搜索术语。
   */
  private searchTermAcrossCategories(
    term: string,
    categories: KnowledgeCategory[],
  ): KnowledgeEntry[] {
    if (term.trim().length === 0) return [];

    if (categories.length === 0) {
      return this.knowledgeStore.search(term, undefined, KNOWLEDGE_SEARCH_LIMIT);
    }

    const results: KnowledgeEntry[] = [];
    for (const category of categories) {
      results.push(
        ...this.knowledgeStore.search(term, category, KNOWLEDGE_SEARCH_LIMIT),
      );
    }
    return results;
  }

  /**
   * 计算评分因素。
   */
  private computeScoringFactors(
    entry: KnowledgeEntry,
    query: EnhancedQuery,
    params: {
      currentInput?: string;
      currentTaskId?: string;
      currentGoalId?: string;
    },
  ): ScoredMemoryEntry["scoringFactors"] {
    const recency = recencyScore(entry.lastVerified || entry.createdAt);
    const frequency = frequencyScore(entry.accessCount);
    const confidence = clamp01(entry.confidence);
    const taskAffinity = taskAffinityScore(entry, params);
    const categoryMatch = categoryMatchScore(entry.category, query.categories);

    return {
      recency,
      frequency,
      confidence,
      taskAffinity,
      categoryMatch,
    };
  }

  /**
   * 解析条目 token 数量。
   */
  private resolveEntryTokenCount(entry: KnowledgeEntry): number {
    if (entry.tokenCount > 0) return entry.tokenCount;
    return estimateTokens(`${entry.key}\n${entry.content}`);
  }

  /**
   * 解析任务规范。
   */
  private resolveTaskSpec(currentTaskId?: string): string | undefined {
    if (!this.taskStore || !currentTaskId) return undefined;

    try {
      if (typeof this.taskStore.getTaskSpec === "function") {
        const spec = this.taskStore.getTaskSpec(currentTaskId);
        if (typeof spec === "string" && spec.trim().length > 0) return spec.trim();
      }

      if (typeof this.taskStore.getTask === "function") {
        const task = this.taskStore.getTask(currentTaskId) as Record<string, unknown> | null;
        if (isRecord(task)) {
          const title = toOptionalString(task.title);
          const description = toOptionalString(task.description);
          const spec = toOptionalString(task.spec);

          return [title, description, spec]
            .filter((part): part is string => Boolean(part && part.trim().length > 0))
            .join("\n")
            .trim() || undefined;
        }
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  /**
   * 解析最近的目标。
   */
  private resolveRecentGoals(currentGoalId?: string): string[] | undefined {
    const goals = new Set<string>();

    if (currentGoalId && currentGoalId.trim().length > 0) {
      goals.add(currentGoalId.trim());
    }

    if (!this.taskStore) {
      return goals.size > 0 ? [...goals] : undefined;
    }

    try {
      if (typeof this.taskStore.getRecentGoals === "function") {
        const recentGoals = this.taskStore.getRecentGoals(5) as unknown;
        for (const goal of toStringArray(recentGoals)) {
          goals.add(goal);
        }
      }
    } catch {
      // 忽略可选的任务存储失败
    }

    return goals.size > 0 ? [...goals].slice(0, 5) : undefined;
  }
}

/**
 * 计算时间得分（指数衰减，30天半衰期）。
 */
function recencyScore(isoTime: string): number {
  const ts = Date.parse(isoTime);
  if (Number.isNaN(ts)) return 0.5;

  const ageMs = Math.max(0, Date.now() - ts);
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  return clamp01(Math.exp(-ageDays / 30));
}

/**
 * 计算频率得分（基于访问次数）。
 */
function frequencyScore(accessCount: number): number {
  if (accessCount <= 0) return 0;
  return clamp01(1 - Math.exp(-accessCount / 5));
}

/**
 * 计算任务关联性得分（基于术语匹配）。
 */
function taskAffinityScore(
  entry: KnowledgeEntry,
  params: {
    currentInput?: string;
    currentTaskId?: string;
    currentGoalId?: string;
  },
): number {
  const haystack = normalizeForMatch(`${entry.key} ${entry.content} ${entry.source}`);
  const affinityTerms = dedupeStrings([
    ...extractTerms(params.currentInput ?? ""),
    params.currentTaskId?.trim().toLowerCase() ?? "",
    params.currentGoalId?.trim().toLowerCase() ?? "",
  ]).filter(Boolean);

  if (affinityTerms.length === 0) return 0.5;

  let matches = 0;
  for (const term of affinityTerms) {
    if (term.length >= 2 && haystack.includes(term)) {
      matches += 1;
    }
  }

  return clamp01(matches / affinityTerms.length);
}

/**
 * 计算类别匹配得分。
 */
function categoryMatchScore(
  category: KnowledgeCategory,
  categories: KnowledgeCategory[],
): number {
  if (categories.length === 0) return 0.5;
  return categories.includes(category) ? 1 : 0;
}

/**
 * 根据角色推断相关类别。
 */
function categoriesFromRole(agentRole?: string): KnowledgeCategory[] {
  if (!agentRole) return [];
  const normalized = agentRole.toLowerCase();

  if (includesAny(normalized, ["finance", "treasury", "accounting", "billing"])) {
    return ["financial", "market"];
  }

  if (includesAny(normalized, ["research", "analyst", "strategist"])) {
    return ["market", "technical", "social"];
  }

  if (includesAny(normalized, ["engineer", "developer", "architect", "sre", "devops"])) {
    return ["technical", "operational"];
  }

  if (includesAny(normalized, ["support", "community", "success", "sales"])) {
    return ["social", "operational"];
  }

  return [];
}

/**
 * 从文本中提取类别。
 */
function categoriesFromText(text: string): KnowledgeCategory[] {
  const normalized = normalizeForMatch(text);
  const categories: KnowledgeCategory[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [KnowledgeCategory, string[]]
  >) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      categories.push(category);
    }
  }

  return categories;
}

/**
 * 从文本推断时间范围。
 */
function inferTimeRange(text: string): { since: string } | undefined {
  const normalized = normalizeForMatch(text);
  const now = Date.now();

  if (includesAny(normalized, ["today", "latest", "recent", "currently"])) {
    return { since: new Date(now - (7 * 24 * 60 * 60 * 1000)).toISOString() };
  }

  if (includesAny(normalized, ["yesterday", "last day"])) {
    return { since: new Date(now - (24 * 60 * 60 * 1000)).toISOString() };
  }

  if (includesAny(normalized, ["last week", "this week"])) {
    return { since: new Date(now - (7 * 24 * 60 * 60 * 1000)).toISOString() };
  }

  if (includesAny(normalized, ["last month", "this month"])) {
    return { since: new Date(now - (30 * 24 * 60 * 60 * 1000)).toISOString() };
  }

  return undefined;
}

/**
 * 从文本提取术语。
 */
function extractTerms(text: string): string[] {
  const normalized = text.trim().toLowerCase();
  if (normalized.length === 0) return [];

  const terms: string[] = [];

  // 保留显式引用短语作为高信噪比术语
  const quoteMatches = normalized.match(/"([^"]+)"/g) ?? [];
  for (const raw of quoteMatches) {
    const phrase = raw.replaceAll("\"", "").trim();
    if (phrase.length > 1) {
      terms.push(phrase);
    }
  }

  const tokenMatches = normalized.match(/[a-z0-9][a-z0-9_./-]{1,63}/g) ?? [];
  for (const token of tokenMatches) {
    if (token.length < 2 || STOP_WORDS.has(token)) continue;
    terms.push(token);
  }

  return dedupeStrings(terms);
}

/**
 * 扩展缩写为完整形式。
 */
function expandAbbreviations(terms: string[]): string[] {
  const expanded: string[] = [];

  for (const term of terms) {
    expanded.push(term);
    const expansions = ABBREVIATION_EXPANSIONS[term];
    if (expansions) {
      expanded.push(...expansions);
    }
  }

  return expanded;
}

/**
 * 在响应中匹配检索到的知识。
 */
function matchRetrievedKnowledgeInResponse(
  db: Database,
  retrievedIds: string[],
  response: string,
): string[] {
  if (retrievedIds.length === 0) return [];

  const placeholders = retrievedIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT id, key, content FROM knowledge_store WHERE id IN (${placeholders})`,
    )
    .all(...retrievedIds) as Array<{ id: string; key: string; content: string }>;

  const normalizedResponse = normalizeForMatch(response);
  const matched: string[] = [];

  for (const row of rows) {
    const key = normalizeForMatch(row.key);
    const contentSnippet = normalizeForMatch(row.content.slice(0, 200));

    const keyMatched = key.length >= 3 && normalizedResponse.includes(key);
    const contentMatched = contentSnippet.length >= 12
      && normalizedResponse.includes(contentSnippet);

    if (keyMatched || contentMatched) {
      matched.push(row.id);
    }
  }

  return dedupeStrings(matched);
}

/**
 * 增加知识访问计数。
 */
function incrementKnowledgeAccessCount(db: Database, ids: string[]): void {
  const uniqueIds = dedupeStrings(ids);
  if (uniqueIds.length === 0) return;

  const updateStatement = db.prepare(
    "UPDATE knowledge_store SET access_count = access_count + 1 WHERE id = ?",
  );

  const tx = db.transaction((txIds: string[]) => {
    for (const id of txIds) {
      updateStatement.run(id);
    }
  });
  tx(uniqueIds);
}

/**
 * 获取回合响应。
 */
function getTurnResponse(db: Database, turnId: string): string {
  const row = db
    .prepare("SELECT thinking FROM turns WHERE id = ?")
    .get(turnId) as { thinking: string } | undefined;
  return typeof row?.thinking === "string" ? row.thinking : "";
}

/**
 * 推送滚动精度。
 */
function pushRollingPrecision(precision: number): number {
  feedbackPrecisionWindow.push(clamp01(precision));

  while (feedbackPrecisionWindow.length > MAX_ROLLING_FEEDBACK_WINDOW) {
    feedbackPrecisionWindow.shift();
  }

  if (feedbackPrecisionWindow.length === 0) {
    lastRollingPrecision = undefined;
    return 0;
  }

  const total = feedbackPrecisionWindow.reduce((sum, value) => sum + value, 0);
  lastRollingPrecision = total / feedbackPrecisionWindow.length;
  return lastRollingPrecision;
}

/**
 * 去重字符串数组。
 */
function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length === 0 || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

/**
 * 去重类别数组。
 */
function dedupeCategories(values: KnowledgeCategory[]): KnowledgeCategory[] {
  const seen = new Set<KnowledgeCategory>();
  const deduped: KnowledgeCategory[] = [];

  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    deduped.push(value);
  }

  return deduped;
}

/**
 * 转换为字符串数组。
 */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

/**
 * 转换为可选字符串。
 */
function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * 检查是否为记录对象。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 检查文本是否包含任意候选词。
 */
function includesAny(text: string, candidates: string[]): boolean {
  return candidates.some((candidate) => text.includes(candidate));
}

/**
 * 规范化文本用于匹配。
 */
function normalizeForMatch(text: string): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * 将值限制在 [0, 1] 范围内。
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * 将数值限制在指定范围内。
 */
function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
