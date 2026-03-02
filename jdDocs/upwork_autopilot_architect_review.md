# UpworkAutoPilot 详细设计文档 - Architect 评审报告

## 评审概览

**评审日期**: 2026-03-02
**评审角色**: Architect (系统架构师)
**评审目标**: 评估架构合理性、技术选型、组件职责、可扩展性

---

## 总体评价

**评分**: 8.5/10

设计文档非常详尽，涵盖了从架构到实现的各个层面，达到了"初级工程师可直接编码"的标准。架构分层清晰，技术选型合理，安全设计周全。

---

## 优点

### 1. 架构分层合理 ✅

**四层架构** (感知→决策→多体→执行) 符合关注点分离原则：
- **感知通道层**: 职责单一，专注于输入输出
- **决策风控层**: 集中管控，避免分散决策
- **多体工厂层**: 并发调度核心，职责明确
- **主权执行层**: 隔离执行，安全可控

**建议**: 当前架构为单体应用，但已预留微服务拆分路径 (见 5.2 扩展性设计)。建议在 Phase 2 就开始考虑模块化，为未来拆分做准备。

### 2. 技术栈选型恰当 ✅

- **SQLite WAL**: 适合当前规模，简单可靠
- **Docker 沙盒**: 安全隔离的正确选择
- **双 LLM 策略** (Claude + GPT): 合理利用各自优势

**潜在问题**:
- SQLite 在高并发 (100+ Agent) 时可能成为瓶颈
- 单机 Docker 执行器可能无法支撑多项目并行

**建议**:
- 在 Phase 2 引入读写分离策略
- 考虑使用 Kubernetes 或 Serverless 托管沙盒执行器

### 3. 安全设计全面 ✅

- 提示词注入防护
- 沙盒逃逸防护
- 私钥安全管理
- API 限流防封号

**建议**: 增加以下安全措施：
1. **网络层**: 所有外部 API 调用使用代理池轮换
2. **数据层**: 敏感数据 (如 API Key) 使用环境变量 + 加密存储
3. **审计层**: 所有关键操作记录不可篡改的审计日志

### 4. 状态机设计清晰 ✅

Conversation 和 TaskNode 的状态机定义完整，转换规则明确。

**建议**: 增加状态转换的**时序约束**，例如：
- `negotiating` 状态超过 7 天自动转为 `expired`
- `developing` 状态超过 30 天触发人工审查

---

## 改进建议

### 1. 数据库设计优化 ⚠️

#### 问题 1.1: 缺少索引优化
当前设计的索引可能无法支撑复杂查询。

**建议添加的索引**:
```sql
-- 组合索引优化常见查询
CREATE INDEX idx_messages_routing ON messages(to_agent, status, created_at);
CREATE INDEX idx_task_graph_dependencies ON task_graph(project_id, status, json_array_length(dependencies));

-- 覆盖索引减少回表
CREATE INDEX idx_projects_status_budget ON projects(status, budget) INCLUDE (title, client_id);
```

#### 问题 1.2: 缺少软删除机制
当前设计中，失败的任务直接标记为 `failed`，但无法区分"暂时失败"和"永久失败"。

**建议**: 增加 `retry_count` 和 `max_retries` 字段:
```sql
ALTER TABLE task_graph ADD COLUMN retry_count INTEGER DEFAULT 0;
ALTER TABLE task_graph ADD COLUMN max_retries INTEGER DEFAULT 5;
```

#### 问题 1.3: 缺少归档策略
长期运行后，`messages` 表会变得非常大。

**建议**: 增加归档表和自动归档机制:
```sql
-- 归档表结构 (与 messages 相同)
CREATE TABLE messages_archive (...);

-- 定时任务: 将 30 天前的已完成消息归档
DELETE FROM messages WHERE status IN ('completed', 'failed')
AND created_at < DATE('now', '-30 days');
```

### 2. API 设计补充 ⚠️

#### 问题 2.1: 缺少分页和过滤
当前 API 没有考虑大数据量场景。

**建议**: 为列表接口添加分页和过滤:
```typescript
// GET /api/projects?status=completed&page=1&pageSize=20&sortBy=created_at&order=desc
{
  projects: [...],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 150,
    totalPages: 8
  }
}
```

#### 问题 2.2: 缺少 WebSocket 实时通知
人工审批需要轮询，体验不佳。

**建议**: 增加 WebSocket 端点:
```typescript
// 建立连接
const ws = new WebSocket('wss://api.example.com/ws?token=xxx');

// 接收实时事件
ws.onmessage = (event) => {
  const { type, payload } = JSON.parse(event.data);
  if (type === 'APPROVAL_REQUESTED') {
    showNotification(payload);
  }
};
```

### 3. 错误处理补充 ⚠️

#### 问题 3.1: 缺少降级策略
当 LLM 服务不可用时，系统会完全瘫痪。

**建议**: 实现降级策略:
```typescript
async function callLLMWithFallback(prompt: string): Promise<string> {
  try {
    // 优先使用 Claude 3.7
    return await claudeClient.complete(prompt);
  } catch (error) {
    logger.warn('Claude failed, falling back to GPT-4o', error);

    try {
      // 降级到 GPT-4o
      return await openaiClient.complete(prompt);
    } catch (fallbackError) {
      // 最后降级到缓存或默认响应
      logger.error('All LLM providers failed', fallbackError);
      return getCachedResponse(prompt) || getDefaultResponse();
    }
  }
}
```

#### 问题 3.2: 缺少重试幂等性
当前重试机制可能重复执行非幂等操作。

**建议**: 为每个操作生成唯一请求 ID:
```typescript
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function submitProposalWithIdempotency(jobId: string) {
  const requestId = generateRequestId();

  // 在请求中包含 idempotency_key
  await upworkAPI.submitProposal(jobId, {
    idempotencyKey: requestId
  });

  // 记录已处理的请求 ID，防止重复
  await db.run(
    'INSERT OR IGNORE INTO processed_requests (request_id, job_id) VALUES (?, ?)',
    [requestId, jobId]
  );
}
```

### 4. 性能优化补充 ⚠️

#### 问题 4.1: 缺少缓存策略
频繁查询相同数据会增加数据库压力。

**建议**: 实现多级缓存:
```typescript
// L1: 内存缓存 (LRU)
const conversationCache = new LRUCache({ max: 1000, ttl: 300000 });

// L2: Redis 缓存 (可选，未来扩展)
const redisCache = new Redis();

async function getConversationWithCache(id: string) {
  // L1: 内存
  const cached = conversationCache.get(id);
  if (cached) return cached;

  // L2: Redis
  const redisData = await redisCache.get(`conversation:${id}`);
  if (redisData) {
    const parsed = JSON.parse(redisData);
    conversationCache.set(id, parsed);
    return parsed;
  }

  // L3: 数据库
  const dbData = await db.get('SELECT * FROM conversations WHERE id = ?', [id]);
  if (dbData) {
    const conversation = parseConversation(dbData);
    conversationCache.set(id, conversation);
    await redisCache.setex(`conversation:${id}`, 300, JSON.stringify(conversation));
    return conversation;
  }

  throw new Error('Not found');
}
```

#### 问题 4.2: 缺少批量处理
单条插入消息效率低下。

**建议**: 实现批量插入和批量更新:
```typescript
// 批量插入
async function batchInsertMessages(messages: MessageData[]) {
  const stmt = db.prepare(`
    INSERT INTO messages (conversation_id, from_agent, to_agent, content, status)
    VALUES (?, ?, ?, ?, ?)
  `);

  await db.run('BEGIN IMMEDIATE');
  try {
    for (const msg of messages) {
      stmt.run(msg.conversationId, msg.fromAgent, msg.toAgent, msg.content, 'pending');
    }
    stmt.finalize();
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}

// 批量更新状态
async function batchUpdateTaskStatus(taskIds: string[], newStatus: string) {
  const placeholders = taskIds.map(() => '?').join(',');
  await db.run(
    `UPDATE task_graph SET status = ? WHERE id IN (${placeholders})`,
    [newStatus, ...taskIds]
  );
}
```

### 5. 监控补充 ⚠️

#### 问题 5.1: 缺少业务指标
当前监控主要关注技术指标，缺少业务层面的监控。

**建议增加的业务指标**:
```typescript
// 投标转化率
const conversionRate = (accepted / submitted) * 100;

// 平均项目收入
const avgRevenue = totalRevenue / completedProjects;

// 客户满意度 (通过 Upwork 评价)
const avgRating = totalRating / reviewsCount;

// Token ROI (投入产出比)
const tokenROI = revenue / tokenCost;
```

#### 问题 5.2: 缺少链路追踪
多 Agent 协作时，难以追踪完整的执行路径。

**建议**: 实现分布式追踪:
```typescript
// 为每个会话生成唯一 traceId
const traceId = uuidv4();

// 每个操作记录 span
logger.info('Processing message', {
  traceId,
  spanId: uuidv4(),
  parentId: currentSpanId,
  agent: 'scout-agent',
  action: 'filter_job'
});

// 在 Agent 间传递 traceId
await sendMessage({
  conversationId,
  content,
  metadata: { traceId, parentSpanId }
});
```

### 6. 配置管理补充 ⚠️

#### 问题 6.1: 硬编码参数过多
当前设计中，很多参数 (如 Token 限制、重试次数) 是硬编码的。

**建议**: 使用配置文件 + 环境变量:
```typescript
// config/default.ts
export const defaultConfig = {
  limits: {
    maxTokensPerProject: 1000000,
    maxDailyProposals: 15,
    maxTaskRetries: 5
  },
  timeouts: {
    sandboxExecution: 60000,
    llmResponse: 30000,
    humanApproval: 3600000
  },
  thresholds: {
    minBudget: 500,
    approvalBudget: 2000
  }
};

// config/production.ts
export const productionConfig = {
  ...defaultConfig,
  limits: {
    ...defaultConfig.limits,
    maxTokensPerProject: 2000000 // 生产环境更高
  }
};

// 使用
const config = getConfig(); // 根据 NODE_ENV 选择配置
const maxTokens = config.limits.maxTokensPerProject;
```

---

## 架构原则评估

### 原则 1: 单一职责 ✅
每个组件职责清晰，符合 SRP。

### 原则 2: 开闭原则 ⚠️
扩展性设计部分提到了未来微服务拆分，但当前代码可能需要重构才能支持。

**建议**: 使用依赖注入和接口抽象，降低耦合:
```typescript
// 定义接口
interface IMessageQueue {
  enqueue(message: MessageData): Promise<void>;
  claim(agentId: string): Promise<MessageData | null>;
  complete(messageId: number): Promise<void>;
}

// 实现
class SQLiteMessageQueue implements IMessageQueue { ... }
class RedisMessageQueue implements IMessageQueue { ... }

// 使用依赖注入
class QueueProcessor {
  constructor(private queue: IMessageQueue) {}

  async process() {
    const message = await this.queue.claim(this.agentId);
    // ...
  }
}
```

### 原则 3: 里氏替换 ⚠️
Agent 继承体系未明确说明。

**建议**: 明确定义 Agent 基类和接口:
```typescript
abstract class BaseAgent {
  abstract process(message: MessageData): Promise<void>;
  abstract getRole(): string;
  abstract getMaxDailyInvocations(): number;
}

class ScoutAgent extends BaseAgent {
  async process(message: MessageData) { ... }
  getRole() { return 'scout'; }
  getMaxDailyInvocations() { return 100; }
}
```

### 原则 4: 接口隔离 ✅
API 设计合理，接口职责单一。

### 原则 5: 依赖倒置 ✅
通过依赖注入可以实现，但需要补充代码示例。

---

## 关键决策点

### 决策 1: SQLite vs PostgreSQL
**当前选择**: SQLite
**评估**: 对于 MVP 阶段合理，但如果预期并发量 > 100，建议提前规划迁移到 PostgreSQL。

**建议**:
- Phase 1-2: 使用 SQLite
- Phase 3: 评估性能，如有需要开始迁移
- Phase 4: 完成迁移，支持水平扩展

### 决策 2: 单体 vs 微服务
**当前选择**: 单体架构 (预留拆分路径)
**评估**: 正确选择。过早拆分会增加复杂度。

**建议**:
- 保持单体，但模块化设计
- 使用清晰的包边界 (如 `src/channel/`, `src/agent/`, `src/execution/`)
- 在 Phase 3 开始考虑拆分非核心服务 (如监控、日志)

### 决策 3: Docker vs 其他沙盒
**当前选择**: Docker
**评估**: 合理选择，生态成熟，隔离性好。

**建议**:
- 确保 Docker Daemon 高可用
- 考虑备用方案 (如 Firejail) 以防 Docker 不可用
- 监控 Docker 资源使用，避免耗尽

---

## 待解决的技术问题

### 问题 1: 长程记忆实现
文档提到使用 ChromaDB，但未给出具体实现方案。

**建议实现**:
```typescript
// memory/vector-store.ts
export class VectorMemoryStore {
  private collection: Collection;

  async addMemory(conversationId: string, content: string, metadata?: any) {
    const embedding = await getEmbedding(content);
    await this.collection.add({
      ids: [uuidv4()],
      embeddings: [embedding],
      metadatas: [{ conversationId, timestamp: Date.now(), ...metadata }],
      documents: [content]
    });
  }

  async searchMemories(conversationId: string, query: string, topK = 5) {
    const queryEmbedding = await getEmbedding(query);
    const results = await this.collection.query({
      queryEmbeddings: [queryEmbedding],
      where: { conversationId },
      nResults: topK
    });

    return results.documents[0].map((doc, i) => ({
      content: doc,
      score: results.distances[0][i],
      metadata: results.metadatas[0][i]
    }));
  }
}

// 在 Agent 中使用
class DevAgent {
  async process(task: TaskNode) {
    // 检索相关记忆
    const memories = await vectorStore.searchMemories(
      task.conversationId,
      task.description,
      10
    );

    // 将记忆加入上下文
    const context = memories.map(m => m.content).join('\n---\n');
    const prompt = `Previous discussions:\n${context}\n\nCurrent task: ${task.description}`;

    return await llm.complete(prompt);
  }
}
```

### 问题 2: 多项目并发资源竞争
多个项目同时执行时，如何分配有限的 LLM 配额和计算资源?

**建议方案**:
```typescript
// resource-scheduler.ts
export class ResourceScheduler {
  private projectQueue: PriorityQueue<Project>;
  private llmRateLimiter: TokenBucketRateLimiter;

  constructor() {
    this.projectQueue = new PriorityQueue({
      comparator: (a, b) => b.priority - a.priority // 优先级排序
    });
    this.llmRateLimiter = new TokenBucketRateLimiter(1000, 100); // 1000 tokens/s
  }

  async scheduleTask(projectId: string, task: TaskNode) {
    // 1. 检查配额
    if (!(await this.llmRateLimiter.consume(task.estimatedTokens))) {
      // 配额不足，加入等待队列
      this.projectQueue.enqueue({ projectId, task, priority: task.priority });
      return;
    }

    // 2. 执行任务
    await this.executeTask(projectId, task);
  }

  private async executeTask(projectId: string, task: TaskNode) {
    // 分配资源并执行
    const agent = this.getAvailableAgent(task.type);
    await agent.process(task);
  }
}
```

---

## 结论与建议

### 总体结论
设计文档质量很高，架构合理，技术选型恰当。达到了可实施的标准。

### 关键建议 (按优先级)

1. **高优先级**:
   - 增加数据库索引优化
   - 实现软删除和归档策略
   - 添加降级策略 (LLM 备选方案)
   - 完善配置管理 (环境变量 + 配置文件)

2. **中优先级**:
   - 实现批量处理优化
   - 添加多级缓存
   - 增加业务监控指标
   - 实现链路追踪

3. **低优先级**:
   - WebSocket 实时通知
   - 微服务拆分规划
   - 多租户支持 (未来扩展)

### 是否批准?
**批准，但需要补充上述建议中的高优先级改进**。

建议在开发 Phase 1 之前，先补充以下内容:
1. 完整的数据库索引设计
2. 降级策略实现
3. 配置管理方案
4. 软删除和归档机制

---

**Architect 签名**:
**日期**: 2026-03-02
