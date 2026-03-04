# Story 1a.1: 记忆压缩引擎实现

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **自主智能体运行时**,
I want **实现一个5阶段渐进式记忆压缩引擎**,
so that **能够处理长时间运行的对话，动态管理上下文窗口，在不同内存压力下应用不同的压缩策略，最大化上下文利用率同时保持关键信息**.

## Acceptance Criteria

1. **Stage 1: 工具结果压缩 (70% 利用率阈值)**
   - [ ] 实现 `compact_tool_results` 动作
   - [ ] 对5轮之前的工具调用结果进行引用压缩
   - [ ] 预估节省35%的token
   - [ ] 保留工具调用的元数据和结果摘要

2. **Stage 2: 回合压缩 (80% 利用率阈值)**
   - [ ] 实现 `compress_turns` 动作
   - [ ] 对10轮之前的回合进行摘要压缩
   - [ ] 预估节省45%的token
   - [ ] 保留关键决策和上下文

3. **Stage 3: 批量摘要 (85% 利用率阈值)**
   - [ ] 实现 `summarize_batch` 动作
   - [ ] 每5个回合为一批进行智能摘要
   - [ ] 使用 `cheap` tier LLM生成摘要 (maxTokens: 220)
   - [ ] 将摘要存储到知识库 (KnowledgeStore)
   - [ ] 创建反射事件记录摘要结果

4. **Stage 4: 检查点和重置 (90% 利用率阈值)**
   - [ ] 实现 `checkpoint_and_reset` 动作
   - [ ] 生成会话检查点 (保留最后5轮)
   - [ ] 将检查点保存到 `.omc/state/checkpoints/{checkpointId}.json`
   - [ ] 提取活跃任务和目标重新注入知识库
   - [ ] 提取关键决策、财务状态
   - [ ] 清空历史事件流并保留摘要
   - [ ] 预估节省55%的token

5. **Stage 5: 紧急截断 (95% 利用率阈值)**
   - [ ] 实现 `emergency_truncate` 动作
   - [ ] 仅保留最后3轮的完整上下文
   - [ ] 丢弃更早的历史事件
   - [ ] 创建警告事件记录截断操作
   - [ ] 预估节省75%的token

6. **评估和执行引擎**
   - [ ] 实现 `evaluate()` 方法 - 根据上下文利用率生成压缩计划
   - [ ] 实现 `execute()` 方法 - 执行压缩计划并返回结果
   - [ ] 实现 `estimateSavings()` 方法 - 预估每个动作节省的token
   - [ ] 实现错误处理和日志记录
   - [ ] 收集并记录压缩指标 (CompressionMetrics)

7. **集成和测试**
   - [ ] 与 ContextManager 集成
   - [ ] 与 EventStream 集成
   - [ ] 与 KnowledgeStore 集成
   - [ ] 与 UnifiedInferenceClient 集成
   - [ ] 通过所有现有测试 (`automaton/src/__tests__/memory/compression-engine.test.ts`)
   - [ ] 添加新的集成测试覆盖所有5个阶段

## Tasks / Subtasks

### Task 1: 核心引擎实现 (AC: 6) - 评估与执行

**关键方法:**
- [ ] Subtask 1.1: 完善 `CompressionEngine` 构造函数 - 验证依赖注入
- [ ] Subtask 1.2: 完善 `evaluate(utilization: ContextUtilization)` - 生成压缩计划
  - **注意:** 接收外部传入的 `ContextUtilization`，不直接调用 `contextManager.getUtilization()`
  - 正确用法: `const plan = await engine.evaluate(contextManager.getUtilization())`
- [ ] Subtask 1.3: 完善 `execute()` - 顺序执行各阶段，处理错误和回退
- [ ] Subtask 1.4: 完善 `estimateSavings()` - 预估每个动作节省的token
- [ ] Subtask 1.5: 实现缺失方法 - `logCompressionMetrics()` 和 `logCompressionError()`
  - 这两个方法在现有代码中标记为 async，需要补充完整实现
  - 已在故事文件末尾的"缺失方法清单"中详细说明

**执行流程:**
```typescript
// 1. 从 ContextManager 获取利用率
const utilization = contextManager.getUtilization();

// 2. evaluate() 生成计划 (接收 utilization 作为参数)
const plan = await compressionEngine.evaluate(utilization);

// 3. execute() 顺序执行各阶段
const result = await compressionEngine.execute(plan);

// 4. 记录指标
// (logCompressionMetrics 和 logCompressionError 已在 execute 内部调用)
```

### Task 2: Stage 1 和 Stage 2 (AC: 1, 2) - 基础压缩

**压缩动作:**
- [ ] Subtask 2.1: `compact_tool_results` - 工具结果引用压缩（节省35%）
- [ ] Subtask 2.2: `compress_turns` - 回合摘要压缩（节省45%）
- [ ] Subtask 2.3: `compactPrefixByTurnIds()` - 统一的压缩执行器
- [ ] Subtask 2.4: `resolveBoundary()` - 确定压缩边界（保留工具调用配对）

**技术要点:**
- 使用 `eventStream.compact(boundary, "reference" | "summarize")`
- 保留工具调用元数据（goalId, taskId, agentAddress）
- 预估节省：Stage 1: 35%, Stage 2: 45%

### Task 3: Stage 3 批量摘要 (AC: 3) - LLM 智能压缩

**智能摘要:**
- [ ] Subtask 3.1: `runStage3BatchSummaries()` - 批量处理（每5个回合）
- [ ] Subtask 3.2: `summarizeBatch()` - 调用 LLM 生成摘要（使用 `cheap` tier）
- [ ] Subtask 3.3: 知识库注入 - 将摘要存储到 `KnowledgeStore`
- [ ] Subtask 3.4: 反射事件记录 - 创建 `reflection` 类型事件

**LLM 调用:**
```typescript
// 使用 cheap tier 节省成本
const response = await inference.chat({
  tier: "cheap",
  maxTokens: 220,
  temperature: 0.1,
  messages: [{
    role: "system",
    content: "Summarize conversation events. Preserve agent IDs, financial amounts, task outcomes, and key decisions."
  }, {
    role: "user",
    content: eventPayload
  }]
});
```

**后备策略:**
- LLM 失败时使用 `buildHeuristicSummary()` 生成基础摘要
- 保留最近12个事件的关键信息

### Task 4: Stage 4 检查点 (AC: 4) - 会话快照

**检查点机制:**
- [ ] Subtask 4.1: `runStage4CheckpointAndReset()` - 主执行器（需要事务）
- [ ] Subtask 4.2: `summarizeForCheckpoint()` - 生成会话摘要（最多1500 tokens）
- [ ] Subtask 4.3: `rehydrateActiveTasks()` - 活跃任务重新注入知识库
- [ ] Subtask 4.4: 文件系统保存 - 写入 `.omc/state/checkpoints/{id}.json`
- [ ] Subtask 4.5: 状态提取 - 关键决策、财务状态、活跃任务

**事务边界说明:**

**当前实现状态:** 现有代码在 `runStage4CheckpointAndReset()` 和 `runStage5EmergencyTruncation()` 中**未使用数据库事务**。

**建议改进 (可选):**
```typescript
// 在 EventStream 或 KnowledgeStore 层添加事务支持
db.transaction(() => {
  // 1. 压缩事件流
  eventStream.compact(boundary, "summarize");

  // 2. 保存检查点文件
  fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint));

  // 3. 注入活跃任务
  rehydrateActiveTasks(activeTaskIds);

  // 4. 记录事件
  eventStream.append({ type: "reflection", ... });
});
```

**当前代码行为:**
- 检查点文件写入、事件流压缩、知识库注入按顺序执行
- 如果某个步骤失败，之前的操作不会回滚
- **生产环境建议:** 添加事务支持保证原子性

### Task 5: Stage 5 紧急截断 (AC: 5) - 最后防线

**紧急处理:**
- [ ] Subtask 5.1: `runStage5EmergencyTruncation()` - 强制截断（仅保留最后3轮）
- [ ] Subtask 5.2: `eventStream.prune()` - 删除旧事件（需要事务）
- [ ] Subtask 5.3: 警告事件记录 - 创建 `compression_warning` 事件

**截断逻辑:**
```typescript
// 仅保留最后3轮
const retainedWindow = selectRetainedTurnWindow(turnEvents, 3);
const boundary = retainedWindow[0].createdAt;
eventStream.prune(boundary);  // 删除边界之前的所有事件
```

### Task 6: 辅助方法和工具 (AC: 6) - 支撑功能

**事件处理:**
- [ ] Subtask 6.1: `getTurnEvents()` - 获取回合事件（inference > action + observation）
- [ ] Subtask 6.2: `getAllCompressionEvents()` - 获取所有可压缩事件（17种类型）
- [ ] Subtask 6.3: `buildEventIndex()` - 构建事件索引（Map<id, event>）

**工具方法:**
- [ ] Subtask 6.4: `pickAgentAddress()` - 选择智能体地址（从最近事件）
- [ ] Subtask 6.5: `selectRetainedTurnWindow()` - 保留回合窗口（保留工具调用配对）
- [ ] Subtask 6.6: `buildToolPairRanges()` - 工具调用配对范围识别

**状态提取:**
- [ ] Subtask 6.7: `collectActiveTasksAndGoals()` - 收集活跃任务和目标
- [ ] Subtask 6.8: `extractKeyDecisions()` - 提取关键决策（10条）
- [ ] Subtask 6.9: `extractFinancialState()` - 提取财务状态（最近10条 + 知识库）

### Task 7: 集成测试 (AC: 7) - 质量保障

**测试覆盖:**
- [ ] Subtask 7.1: 更新单元测试文件 `compression-engine.test.ts`
- [ ] Subtask 7.2: Stage 1-2 测试（边界条件、正常流程）
- [ ] Subtask 7.3: Stage 3 批量摘要测试（LLM 成功/失败）
- [ ] Subtask 7.4: Stage 4 检查点测试（文件读写、事务回滚）
- [ ] Subtask 7.5: Stage 5 紧急截断测试（强制截断、事件计数）
- [ ] Subtask 7.6: 完整集成测试（5阶段级联执行）
- [ ] Subtask 7.7: 错误处理测试（异常捕获、后备策略）

**测试标准:**
- 100% 单元测试通过
- 代码覆盖率: 语句≥80%, 分支≥70%, 函数≥85%
- 性能基准: Stage 3 < 500ms, Stage 4 < 300ms, Stage 5 < 100ms

## Dev Notes

### 架构模式

**5级渐进式压缩（Progressive 5-Stage Compression）**

压缩级联按照上下文利用率递增触发，每个阶段应用不同技术:

```
70% → Stage 1: 工具结果引用压缩 (节省 35%)
80% → Stage 2: 回合摘要压缩 (节省 45%)
85% → Stage 3: 批量智能摘要 (节省 50-60%)
90% → Stage 4: 检查点+重置 (节省 55%)
95% → Stage 5: 紧急截断 (节省 75%)
```

**关键特性:**
- 每个阶段独立可测试
- Stage 3 失败自动回退到 Stage 4
- 压缩操作记录为事件供审计
- 结果持久化到知识库和文件系统

### 完整类型定义参考

**核心接口:**

```typescript
// ContextUtilization (从 ContextManager 获取)
interface ContextUtilization {
  totalTokens: number;              // 总token容量
  usedTokens: number;               // 已使用token
  utilizationPercent: number;       // 利用率百分比 (0-100)
  turnsInContext: number;           // 当前上下文中的回合数
  compressedTurns: number;          // 已压缩的回合数
  compressionRatio: number;         // 压缩比率 (0-1)
  headroomTokens: number;           // 压缩缓冲区大小
  recommendation: "ok" | "compress" | "emergency";
}

// EventType (可压缩的事件类型)
type EventType =
  | "user_input" | "plan_created" | "plan_updated"
  | "task_assigned" | "task_completed" | "task_failed"
  | "action" | "observation" | "inference"
  | "financial" | "agent_spawned" | "agent_died"
  | "knowledge" | "market_signal" | "revenue"
  | "error" | "reflection";

// StreamEvent (事件流中的事件)
interface StreamEvent {
  id: string;
  type: EventType | string;
  agentAddress: string;
  goalId: string | null;
  taskId: string | null;
  content: string;
  tokenCount: number;
  compactedTo: string | null;
  createdAt: string;
}

// CompactedContext (压缩结果)
interface CompactedContext {
  events: CompactedEventReference[];
  originalTokens: number;
  compactedTokens: number;
  compressionRatio: number;
}

// CompressionMetrics (压缩指标)
interface CompressionMetrics {
  turnNumber: number;               // 当前回合数
  preCompressionTokens: number;     // 压缩前token数
  postCompressionTokens: number;    // 压缩后token数
  compressionRatio: number;         // 压缩比率
  stage: number;                    // 执行的阶段 (1-5)
  tokensSaved: number;              // 节省的token数
  latencyMs: number;                // 执行耗时 (毫秒)
  totalCheckpoints: number;         // 累计检查点数
  totalEmergencyTruncations: number; // 累计紧急截断数
  compressedTurnCount: number;      // 累计压缩回合数
  averageCompressionRatio: number;  // 平均压缩比率
  peakUtilizationPercent: number;   // 峰值利用率
  turnsWithoutCompression: number;  // 连续未压缩回合数
}
```

### Stage 3 后备策略（LLM 调用失败时）

**当 `summarizeBatch()` 或 `summarizeForCheckpoint()` 调用 LLM 失败时:**

```typescript
// 1. 捕获 LLM 错误
try {
  summary = await this.inference.chat({ ... });
} catch (error) {
  // 2. 使用启发式摘要作为后备
  summary = buildHeuristicSummary(eventsBeforeBoundary);
}

// 3. 启发式摘要逻辑 (buildHeuristicSummary)
function buildHeuristicSummary(events: StreamEvent[]): string {
  if (events.length === 0) return "No historical events available.";

  // 选取最近的12个事件
  const recent = events.slice(-12);

  // 提取每个事件的关键信息
  const lines = recent.map((event) => {
    const snippet = normalizeContent(event.content, 140);
    return `- [${event.type}] ${snippet}`;
  });

  // 构建摘要
  return [
    "Checkpoint summary (heuristic fallback):",
    `Processed events: ${events.length}`,
    ...lines,
  ].join("\n");
}
```

**后备策略要点:**
- 优先保留最近的事件（最近的12个）
- 提取事件类型和内容片段
- 保留关键元数据（goalId, taskId）
- 避免完全失败，确保至少有基础摘要

### 工具调用配对详细说明

**`buildToolPairRanges()` 方法如何识别工具调用和结果配对:**

```typescript
// 工具调用事件示例
{
  type: "action",
  content: '{"tool_call_id": "call_123", "name": "readFile", "arguments": {...}}'
}

// 工具结果事件示例
{
  type: "observation",
  content: '{"tool_call_id": "call_123", "result": "文件内容..."}'
}

// 配对识别逻辑
function extractToolCallIds(content: string): string[] {
  // 匹配模式: tool_call_id="xxx" 或 toolCallId: "xxx"
  const pattern = /tool(?:_|\s)?call(?:_|\s)?id["'\s:=]+([A-Za-z0-9_-]+)/gi;
  const ids: string[] = [];

  let match = pattern.exec(content);
  while (match) {
    if (match[1]) ids.push(match[1]);
    match = pattern.exec(content);
  }

  return [...new Set(ids)];  // 去重
}

// 构建配对范围
function buildToolPairRanges(events: StreamEvent[]): Array<{ start: number; end: number }> {
  const positions = new Map<string, { start: number; end: number }>();

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const ids = extractToolCallIds(event.content);

    for (const id of ids) {
      const existing = positions.get(id);
      if (existing) {
        // 找到配对：更新结束位置
        existing.end = index;
      } else {
        // 第一次出现：记录起始位置
        positions.set(id, { start: index, end: index });
      }
    }
  }

  // 返回完整的配对范围 (start !== end 表示有配对)
  return [...positions.values()].filter((range) => range.start !== range.end);
}
```

**保留回合窗口策略:**

当压缩到保留最后 N 轮时，如果工具调用配对被边界切断，自动扩展保留范围:

```typescript
// 示例: 保留最后5轮，但第5轮有未完成的工具调用
const ranges = buildToolPairRanges(orderedEvents);
for (const range of ranges) {
  if (range.start < startIndex && startIndex <= range.end) {
    // 工具调用配对跨越边界，扩展保留范围
    startIndex = range.start;  // 保留完整的工具调用对
  }
}
```

### 检查点恢复机制

**从检查点恢复对话状态的流程:**

```typescript
// 1. 加载检查点文件
const checkpoint: ConversationCheckpoint = JSON.parse(
  await fs.readFile(checkpointPath, 'utf8')
);

// 2. 恢复活跃任务到知识库
for (const taskId of checkpoint.activeTaskIds) {
  knowledgeStore.add({
    category: "operational",
    key: `active_task_spec_${taskId}`,
    content: taskSpecification,
    source: checkpoint.agentAddress,
    confidence: 0.85,
    // ...
  });
}

// 3. 注入检查点摘要到上下文
contextManager.assembleContext({
  // ...
  memories: checkpoint.summary,  // 注入摘要
  // ...
});

// 4. 继续处理新的回合
// (保留的最后5轮已经在事件流中)
```

**检查点文件结构:**

```json
{
  "checkpoint": {
    "id": "checkpointId",
    "agentAddress": "agent-1",
    "summary": "对话摘要文本...",
    "summaryTokens": 1200,
    "activeGoalIds": ["goal-1", "goal-2"],
    "activeTaskIds": ["task-1", "task-2"],
    "keyDecisions": [
      "选择使用 PostgreSQL 而非 MySQL",
      "决定实施缓存层"
    ],
    "financialState": {
      "latestFinancialEvents": [...],
      "knownFinancialFacts": [...]
    },
    "turnCount": 45,
    "tokensSaved": 15000,
    "createdAt": "2026-03-04T12:00:00.000Z",
    "filePath": ".omc/state/checkpoints/checkpointId.json"
  },
  "retainedTurnIds": ["turn-41", "turn-42", "turn-43", "turn-44", "turn-45"]
}
```

### 性能基准和监控指标

**每个阶段的预期性能:**

| 阶段 | 预期耗时 | CPU 使用 | 内存增量 | 触发频率 |
|------|---------|---------|---------|---------|
| Stage 1 | < 50ms | 低 | < 1MB | 高频 (利用率 70-80%) |
| Stage 2 | < 100ms | 中 | < 2MB | 中频 (利用率 80-85%) |
| Stage 3 | < 500ms | 高 | < 5MB | 低频 (利用率 85-90%) |
| Stage 4 | < 300ms | 中 | < 10MB | 很低频 (利用率 90-95%) |
| Stage 5 | < 100ms | 低 | < 1MB | 紧急 (利用率 > 95%) |

**关键监控指标:**

```typescript
// 在 CompressionMetrics 中记录
const metrics: CompressionMetrics = {
  turnNumber: currentTurn,
  preCompressionTokens: beforeTokens,
  postCompressionTokens: afterTokens,
  compressionRatio: afterTokens / beforeTokens,
  stage: executedStage,
  tokensSaved: savedTokens,
  latencyMs: executionTime,
  totalCheckpoints: checkpointCount,
  totalEmergencyTruncations: truncationCount,
  compressedTurnCount: totalCompressedTurns,
  averageCompressionRatio: avgRatio,
  peakUtilizationPercent: peakUtilization,
  turnsWithoutCompression: idleTurns,
};

// 性能警报阈值
const PERFORMANCE_ALERTS = {
  stage3Timeout: 2000,      // Stage 3 超时 2秒
  stage4Timeout: 1000,      // Stage 4 超时 1秒
  compressionRatioTooLow: 0.3,  // 压缩比率低于 30%
  frequentStage5: 5,        // 5分钟内触发 3 次 Stage 5
};
```

**建议的监控埋点:**

1. **入口埋点:** `evaluate()` 方法开始
2. **阶段埋点:** 每个 Stage 开始和结束
3. **LLM 埋点:** `summarizeBatch()` 和 `summarizeForCheckpoint()` 调用
4. **文件操作埋点:** 检查点文件读写
5. **出口埋点:** `execute()` 方法结束

**性能优化建议:**

- 使用 `Promise.all()` 并行处理多个批量摘要（Stage 3）
- 缓存频繁访问的事件索引（`buildEventIndex`）
- 使用流式文件写入避免大文件阻塞（Stage 4）
- 预计算常见边界条件（`resolveBoundary`）

### 核心接口和依赖

```typescript
// 依赖注入
constructor(
  private readonly contextManager: ContextManager,        // 上下文管理器
  private readonly eventStream: EventStream,              // 事件流
  private readonly knowledgeStore: KnowledgeStore,        // 知识库
  private readonly inference: UnifiedInferenceClient,     // 推理客户端
)
```

### 关键常量 (已定义在 `compression-engine.ts`)

```typescript
const STAGE_1_THRESHOLD = 70;      // 工具结果压缩阈值
const STAGE_2_THRESHOLD = 80;      // 回合压缩阈值
const STAGE_3_THRESHOLD = 85;      // 批量摘要阈值
const STAGE_4_THRESHOLD = 90;      // 检查点阈值
const STAGE_5_THRESHOLD = 95;      // 紧急截断阈值

const STAGE_3_BATCH_SIZE = 5;      // 批量大小
const STAGE_3_DEFAULT_MAX_TOKENS = 220;
const STAGE_4_SUMMARY_MAX_TOKENS = 1500;
const STAGE_4_KEEP_LAST_TURNS = 5;
const STAGE_5_KEEP_LAST_TURNS = 3;
```

### 压缩动作类型

```typescript
export type CompressionAction =
  | { type: "compact_tool_results"; turnIds: string[] }
  | { type: "compress_turns"; turnIds: string[] }
  | { type: "summarize_batch"; turnIds: string[]; maxTokens: number }
  | { type: "checkpoint_and_reset"; checkpointId: string }
  | { type: "emergency_truncate"; keepLastN: number };
```

### 文件路径

**检查点目录:** `.omc/state/checkpoints/`
**检查点文件格式:** `{checkpointId}.json`

### 重要注意事项

1. **ESM 模块系统** - Automaton 使用 ESM，所有导入必须带 `.js` 扩展名
2. **测试使用内存数据库** - 不要在测试中使用文件型 SQLite
3. **错误处理** - 所有异步操作必须使用 try/catch 包装
4. **日志记录** - 使用 `StructuredLogger` 记录压缩操作和错误
5. **向后兼容** - 现有的测试必须通过，不要破坏现有功能
6. **ContextManager.getUtilization()** - 这是**实例方法**，需要通过已初始化的 ContextManager 实例调用
   - **正确用法:** `const plan = await engine.evaluate(contextManager.getUtilization())`
   - `evaluate()` 方法接收 `ContextUtilization` 作为参数，不直接调用 `getUtilization()`
7. **不要重新实现已存在的工具函数** - 详见"已存在的工具函数"章节
8. **当前未使用数据库事务** - 现有实现按顺序执行，生产环境建议添加事务支持

### EventStream API 详细说明

**关键方法签名:**

```typescript
// 压缩事件前缀（引用或摘要策略）
compact(boundary: string, strategy: "reference" | "summarize"): {
  tokensSaved: number;
  events: CompactedEventReference[];
}

// 修剪事件（移除指定时间之前的所有事件）
prune(boundary: string): number;  // 返回删除的事件数量

// 添加新事件到流
append(event: StreamEvent): string;  // 返回事件ID

// 获取指定类型的事件
getByType(type: EventType): StreamEvent[];
```

**返回类型定义:**

```typescript
interface CompactedEventReference {
  id: string;
  type: string;
  createdAt: string;
  goalId: string | null;
  taskId: string | null;
  reference: string;           // 压缩后的引用文本
  originalTokens: number;      // 原始token数量
  compactedTokens: number;     // 压缩后token数量
}
```

### 数据库事务边界（必须使用事务的操作）

以下操作**必须**在数据库事务中执行以保证原子性:

1. **Stage 4 检查点保存** - 文件写入 + 事件流压缩 + 知识库注入必须原子完成
2. **Stage 5 紧急截断** - 事件修剪必须原子执行，避免部分删除
3. **活跃任务重新注入** - 知识库写入必须原子完成
4. **压缩指标记录** - 事件流追加必须原子完成

**事务示例:**

```typescript
// 在 EventStream 或 Database 层使用事务
db.transaction(() => {
  // 1. 保存检查点文件
  // 2. 压缩事件流
  // 3. 注入活跃任务到知识库
  // 4. 记录压缩事件
  // 全部成功才提交，任一失败则回滚
})();
```

### 测试验证标准

**必须通过的测试条件:**

1. **单元测试通过率** - 100% 通过 `automaton/src/__tests__/memory/compression-engine.test.ts`
2. **代码覆盖率要求:**
   - 语句覆盖率: ≥ 80%
   - 分支覆盖率: ≥ 70%
   - 函数覆盖率: ≥ 85%
   - 行覆盖率: ≥ 80%
3. **集成测试覆盖:**
   - 每个 Stage (1-5) 至少 3 个测试用例
   - 错误处理路径至少 2 个测试用例
   - 边界条件至少 2 个测试用例
4. **性能基准:**
   - Stage 1-2: < 50ms
   - Stage 3: < 500ms (含 LLM 调用)
   - Stage 4: < 300ms
   - Stage 5: < 100ms

**测试文件位置:**

- 单元测试: `automaton/src/__tests__/memory/compression-engine.test.ts`
- 集成测试: `automaton/src/__tests__/integration/compression-cascade.test.ts`

### 与现有代码集成指南

**现有 `compression-engine.ts` 状态:**

```typescript
// ✅ 已实现（保留）:
- CompressionEngine 类骨架
- 构造函数依赖注入
- CompressionAction 类型定义
- 关键常量定义 (STAGE_1_THRESHOLD 等)
- resolveStage() 工具函数
- normalizeTokenCount() 工具函数
- normalizeContent() 工具函数

// ⚠️ 需完善（修改）:
- evaluate() 方法 - 需要完整实现
- execute() 方法 - 需要完整实现
- estimateSavings() 方法 - 需要完整实现
- 所有私有方法 - 需要实现

// 🆕 需新增:
- runStage3BatchSummaries()
- runStage4CheckpointAndReset()
- runStage5EmergencyTruncation()
- rehydrateActiveTasks()
- logCompressionMetrics()
- logCompressionError()
- 所有辅助方法 (getTurnEvents, buildEventIndex 等)
```

**修改策略:**

1. **不要删除**现有的类定义、类型定义、常量定义
2. **完善**现有的骨架方法（evaluate, execute, estimateSavings）
3. **新增**缺失的方法 (仅限下面列出的缺失方法)
4. **保留**所有现有的工具函数（它们已被测试验证）

### ✅ 已存在的工具函数 (无需重新实现)

以下函数已在 `compression-engine.ts` 中完整实现，**不要重新实现**：

```typescript
// 位于文件底部 (第798-858行)
function resolveStage(utilizationPercent: number): 1 | 2 | 3 | 4 | 5
function normalizeTokenCount(event: StreamEvent): number
function normalizeContent(content: string, maxChars: number = 800): string
function plusOneMs(iso: string): string
function dedupeEvents(events: StreamEvent[]): StreamEvent[]
function extractToolCallIds(content: string): string[]
function buildHeuristicSummary(events: StreamEvent[]): string
```

### ❌ 缺失方法清单 (需要实现)

以下方法在现有代码中标记但未完整实现，**需要补充**：

```typescript
/**
 * 记录压缩指标到事件流
 * 位置: compression-engine.ts 第589-599行 (需要补充完整实现)
 */
private async logCompressionMetrics(metrics: CompressionMetrics): Promise<void> {
  this.eventStream.append({
    type: "compression" as unknown as EventType,
    agentAddress: this.pickAgentAddress(this.getAllCompressionEvents()),
    goalId: null,
    taskId: null,
    content: JSON.stringify(metrics),
    tokenCount: estimateTokens(JSON.stringify(metrics)),
    compactedTo: null,
  });
}

/**
 * 记录压缩错误到事件流
 * 位置: compression-engine.ts 第573-587行 (需要补充完整实现)
 */
private async logCompressionError(stage: number, error: unknown): Promise<void> {
  const details = error instanceof Error ? error.message : String(error);
  this.eventStream.append({
    type: "compression_error" as unknown as EventType,
    agentAddress: this.pickAgentAddress(this.getAllCompressionEvents()),
    goalId: null,
    taskId: null,
    content: JSON.stringify({ stage, error: details }),
    tokenCount: estimateTokens(details),
    compactedTo: null,
  });
}
```

### 可压缩事件类型

```typescript
const COMPRESSION_EVENT_TYPES: EventType[] = [
  "user_input", "plan_created", "plan_updated", "task_assigned",
  "task_completed", "task_failed", "action", "observation",
  "inference", "financial", "agent_spawned", "agent_died",
  "knowledge", "market_signal", "revenue", "error", "reflection"
];
```

### 调试和日志策略

**关键调试日志点:**

```typescript
// 1. evaluate() 入口
logger.debug("CompressionEngine.evaluate", {
  utilization: utilizationPercent,
  threshold: STAGE_1_THRESHOLD,
  plannedActions: plan.actions.length
});

// 2. 每个 Stage 开始
logger.info(`CompressionEngine.execute.stage.${stage}`, {
  stage,
  actions: stageActions.length,
  estimatedSavings: estimatedTokens
});

// 3. LLM 调用
logger.debug("CompressionEngine.summarizeBatch", {
  batchSize: events.length,
  maxTokens: maxTokens,
  modelTier: "cheap"
});

// 4. 文件操作
logger.info("CompressionEngine.checkpoint.save", {
  checkpointId,
  filePath,
  fileSize: Buffer.byteLength(JSON.stringify(checkpoint))
});

// 5. execute() 出口
logger.info("CompressionEngine.execute.complete", {
  success: result.success,
  stage: metrics.stage,
  tokensSaved: metrics.tokensSaved,
  latencyMs: metrics.latencyMs
});
```

**性能分析埋点:**

```typescript
// 使用 performance.now() 测量关键路径
const start = performance.now();

// 批量摘要执行
for (const batch of batches) {
  const batchStart = performance.now();
  await summarizeBatch(batch);
  const batchEnd = performance.now();

  logger.debug("CompressionEngine.batch.summary.time", {
    batchId: batch.id,
    durationMs: batchEnd - batchStart,
    eventsCount: batch.length
  });
}

const end = performance.now();
logger.info("CompressionEngine.execute.total.time", {
  totalMs: end - start,
  stagesExecuted: highestStage
});
```

**错误日志增强:**

```typescript
// 捕获并记录详细的错误信息
try {
  await executeStage(stage);
} catch (error) {
  logger.error("CompressionEngine.stage.error", {
    stage,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: {
      utilization: currentUtilization,
      actions: currentActions
    }
  });

  // 记录到事件流
  eventStream.append({
    type: "compression_error" as unknown as EventType,
    content: JSON.stringify({
      stage,
      error: error instanceof Error ? error.message : String(error)
    }),
    // ...
  });
}
```

**建议的监控仪表板指标:**

- 压缩触发频率（按阶段统计）
- 平均压缩比率（历史趋势）
- LLM 调用成功率（Stage 3）
- 检查点保存成功率（Stage 4）
- 紧急截断次数（Stage 5 警报）
- 平均执行耗时（按阶段）

## Project Structure Notes

### 项目结构对齐

**文件位置:** `automaton/src/memory/compression-engine.ts`
**测试位置:** `automaton/src/__tests__/memory/compression-engine.test.ts`
**相关文件:**
- `automaton/src/memory/event-stream.ts` - 事件流管理
- `automaton/src/memory/knowledge-store.ts` - 知识库存储
- `automaton/src/memory/context-manager.ts` - 上下文管理
- `automaton/src/inference/inference-client.ts` - 推理客户端

### 技术栈一致性

- **TypeScript:** 5.9.3，严格模式启用
- **运行时:** Node.js >= 20.0.0
- **包管理器:** pnpm 10.28.1
- **模块系统:** ESM (NodeNext)
- **测试框架:** Vitest 2.0.0
- **数据库:** better-sqlite3 11.0.0

### 命名规范

- 类名: `PascalCase` (CompressionEngine, ConversationCheckpoint)
- 函数名: `camelCase` (evaluate, execute, summarizeBatch)
- 常量: `SCREAMING_SNAKE_CASE` (STAGE_1_THRESHOLD)
- 接口: `PascalCase` (CompressionPlan, CompressionMetrics)

## References

### 现有代码参考

- [Source: automaton/src/memory/compression-engine.ts] - 现有压缩引擎骨架
- [Source: automaton/src/memory/event-stream.ts] - 事件流实现
- [Source: automaton/src/memory/knowledge-store.ts] - 知识库存储
- [Source: automaton/src/memory/context-manager.ts] - 上下文管理器
- [Source: automaton/src/inference/inference-client.ts] - 推理客户端
- [Source: automaton/src/__tests__/memory/compression-engine.test.ts] - 现有测试

### 架构文档

- [Source: docs/architecture-automaton.md#多层记忆系统] - 记忆系统架构
- [Source: docs/architecture-automaton.md#数据流] - 智能体回合执行流
- [Source: docs/project-context.md#技术栈与版本] - 技术栈要求
- [Source: docs/project-context.md#语言特定规则] - ESM 导入规则

### Epic 设计

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1a] - 记忆系统深度优化
- [Source: _bmad-output/planning-artifacts/epics.md#1a.1] - 记忆压缩引擎实现需求

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

_CompressionEngine 执行流程:_
1. `evaluate()` - 基于利用率生成压缩计划
2. `execute()` - 顺序执行各阶段压缩动作
3. `logCompressionMetrics()` - 记录压缩指标
4. `logCompressionError()` - 记录压缩错误

_错误处理:_
- Stage 3 失败时触发 Stage 4 检查点作为后备
- 所有阶段的错误都会记录到事件流
- 关键操作使用事务保证原子性

### Completion Notes List

**✅ 已确认（开发时可直接使用）:**
- 核心引擎架构已定义
- 5个压缩阶段阈值已配置
- 与现有系统集成点已明确
- 类型定义和接口已完成
- 关键常量已定义
- 工具函数已实现并测试
- `evaluate()` 方法接收外部 `ContextUtilization` 参数
- 大部分私有方法已完整实现

**⚠️ 需要完善（开发时重点实现）:**
- `logCompressionMetrics()` - 补充完整实现（现有代码已标记但需完善）
- `logCompressionError()` - 补充完整实现（现有代码已标记但需完善）
- 其余私有方法已完整实现，无需修改

**🔍 需要验证（开发后检查）:**
- 与 ContextManager.getUtilization() 集成正确
  - 正确用法: `await engine.evaluate(contextManager.getUtilization())`
- EventStream API 调用返回值符合预期
- 数据库事务边界（可选，当前未使用事务）
- 测试覆盖率达标 (语句≥80%, 分支≥70%)
- 性能基准达标 (Stage 3 < 500ms, Stage 4 < 300ms)
- 错误处理和后备策略工作正常

**📌 开发提示:**
- 优先检查 `logCompressionMetrics()` 和 `logCompressionError()` 实现
- 不要重新实现已存在的工具函数（详见"已存在的工具函数"章节）
- `evaluate()` 不直接调用 `contextManager.getUtilization()`，而是接收参数
- 使用提供的调试日志点进行性能分析
- 当前实现未使用数据库事务，生产环境建议添加

### File List

**主要实现文件:**
- `automaton/src/memory/compression-engine.ts` (已存在，需要完善)

**测试文件:**
- `automaton/src/__tests__/memory/compression-engine.test.ts` (已存在，需要扩展)

**相关依赖文件:**
- `automaton/src/memory/event-stream.ts`
- `automaton/src/memory/knowledge-store.ts`
- `automaton/src/memory/context-manager.ts`
- `automaton/src/inference/inference-client.ts`


