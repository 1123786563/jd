# Story 1a.3: 工作记忆 (Working Memory) 实现

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

作为 Conway Automaton 开发团队，
我想要实现工作记忆 (Working Memory) 组件，
以便智能体能够在当前会话中维护活动上下文。

## Acceptance Criteria

1. ✅ **工作记忆核心实现**
   - [ ] 实现 `WorkingMemory` 类，用于存储当前会话的活动上下文
   - [ ] 支持存储最近的消息、当前目标和活动工具
   - [ ] 实现会话作用域管理（回合间清除机制）
   - [ ] 提供高效的读写接口

2. ✅ **上下文数据结构**
   - [ ] 定义 `WorkingMemoryContext` 接口，包含消息历史、目标状态、工具调用记录
   - [ ] 实现消息历史的有序存储（按时间戳排序）
   - [ ] 实现目标状态的追踪和更新
   - [ ] 实现活动工具列表的管理

3. ✅ **记忆生命周期管理**
   - [ ] 实现会话级别的记忆清除机制
   - [ ] 支持回合间的记忆保留和清除策略
   - [ ] 实现超时自动清除功能
   - [ ] 提供手动清除接口

4. ✅ **与 Agent Loop 集成**
   - [ ] 在 ReAct 循环的 `think()` 阶段加载工作记忆
   - [ ] 在 `observe()` 阶段更新工作记忆
   - [ ] 在 `persist()` 阶段决定是否保留工作记忆
   - [ ] 实现与情节记忆的协同（哪些内容需要持久化）

5. ✅ **性能优化**
   - [ ] 实现 Token 计数和上下文窗口管理
   - [ ] 实现上下文修减策略（超出窗口时移除旧消息）
   - [ ] 实现优先级排序（重要消息优先保留）
   - [ ] 支持批量操作减少性能开销

6. ✅ **错误处理与边界情况**
   - [ ] 处理记忆溢出情况（超出最大限制）
   - [ ] 处理并发访问的同步问题
   - [ ] 实现错误恢复机制
   - [ ] 记录详细的日志信息

7. ✅ **测试覆盖**
   - [ ] 编写单元测试覆盖所有核心功能
   - [ ] 编写集成测试验证与 Agent Loop 的交互
   - [ ] 编写边界情况测试（溢出、并发等）
   - [ ] 达到测试覆盖率要求（语句60%，分支50%）

## Tasks / Subtasks

### 核心模块实现

- [ ] **Task 1**: 工作记忆数据结构定义 (AC: 1, 2)
  - [ ] 创建 `src/memory/types.ts` 定义核心类型
  - [ ] 定义 `WorkingMemoryContext` 接口
  - [ ] 定义 `MessageEntry`, `GoalState`, `ToolCallRecord` 等子类型
  - [ ] 定义配置接口 `WorkingMemoryConfig`

- [ ] **Task 2**: 工作记忆核心类实现 (AC: 1, 3)
  - [ ] 创建 `src/memory/working.ts` 文件
  - [ ] 实现 `WorkingMemory` 类基础结构
  - [ ] 实现消息历史存储和检索
  - [ ] 实现目标状态管理
  - [ ] 实现工具调用记录管理
  - [ ] 实现会话作用域管理

- [ ] **Task 3**: 生命周期管理 (AC: 3, 5)
  - [ ] 实现回合间清除机制
  - [ ] 实现超时自动清除
  - [ ] 实现手动清除接口
  - [ ] 实现上下文修减策略
  - [ ] 实现 Token 计数功能

- [ ] **Task 4**: Agent Loop 集成 (AC: 4)
  - [ ] 在 `agent/loop.ts` 中集成工作记忆
  - [ ] 实现 `think()` 阶段的记忆加载
  - [ ] 实现 `observe()` 阶段的记忆更新
  - [ ] 实现 `persist()` 阶段的记忆决策
  - [ ] 实现与情节记忆的协同

### 工具和辅助功能

- [ ] **Task 5**: 工具函数实现 (AC: 5, 6)
  - [ ] 实现上下文优先级排序
  - [ ] 实现消息历史截断
  - [ ] 实现 Token 计数工具
  - [ ] 实现错误处理包装器

- [ ] **Task 6**: 导出和模块化 (AC: 1, 2)
  - [ ] 创建 `src/memory/index.ts` 导出所有模块
  - [ ] 确保模块化和可测试性
  - [ ] 添加类型导出

### 测试与验证

- [ ] **Task 7**: 单元测试 (AC: 7)
  - [ ] 为 `WorkingMemory` 类编写测试
  - [ ] 为数据结构编写测试
  - [ ] 为生命周期管理编写测试
  - [ ] 为工具函数编写测试

- [ ] **Task 8**: 集成测试 (AC: 7)
  - [ ] 编写与 Agent Loop 的集成测试
  - [ ] 编写上下文管理的集成测试
  - [ ] 编写性能测试（大量消息处理）

- [ ] **Task 9**: 文档与示例 (AC: 1, 7)
  - [ ] 编写 API 文档注释
  - [ ] 创建使用示例
  - [ ] 更新架构文档引用

## Dev Notes

### 架构模式与约束

#### 工作记忆设计

工作记忆是五层记忆系统的第一层，负责存储当前会话的活动上下文。它具有以下特性：

**生命周期特点**：
- **作用域**：会话级别（单个对话回合）
- **持久性**：临时（回合间可清除）
- **访问频率**：高（每回合多次读写）
- **数据量**：较小（限于上下文窗口）

**数据结构**：
```
WorkingMemoryContext {
  sessionId: string          // 会话唯一标识
  messageHistory: Message[]  // 有序消息历史
  currentGoals: GoalState[]  // 当前目标状态
  activeTools: ToolInfo[]    // 活动工具列表
  tokenCount: number         // 当前 Token 总数
  createdAt: number          // 创建时间戳
  lastAccessed: number       // 最后访问时间
}
```

#### 与 Agent Loop 的集成

工作记忆在 ReAct 循环中的使用流程：

```
ReAct Loop 迭代:
┌─────────────────────────────────────┐
│  1. think()                         │
│     ├─> loadWorkingMemory()         │  ← 加载当前工作记忆
│     ├─> buildContextMessages()      │
│     └─> generateReasoning()         │
├─────────────────────────────────────┤
│  2. act()                           │
│     ├─> executeTools()              │
│     └─> captureResults()            │
├─────────────────────────────────────┤
│  3. observe()                       │
│     ├─> updateWorkingMemory()       │  ← 更新工作记忆
│     ├─> recordToolCalls()           │
│     └─> updateGoalState()           │
├─────────────────────────────────────┤
│  4. persist()                       │
│     ├─> decidePersistence()         │  ← 决定是否持久化
│     ├─> saveToEpisodicMemory()      │  ← 部分内容存入情节记忆
│     └─> clearOrRetain()             │  ← 清除或保留工作记忆
└─────────────────────────────────────┘
```

### 文件结构要求

#### 项目结构

```
automaton/
├── src/
│   ├── memory/
│   │   ├── working.ts              # 工作记忆核心实现
│   │   ├── types.ts                # 记忆相关类型定义
│   │   ├── index.ts                # 记忆模块导出
│   │   └── constants.ts            # 记忆常量配置
│   ├── agent/
│   │   └── loop.ts                 # Agent Loop (需修改以集成工作记忆)
│   ├── types.ts                    # 全局类型定义
│   └── index.ts                    # 主入口
├── src/__tests__/
│   ├── memory/
│   │   ├── working.test.ts         # 工作记忆单元测试
│   │   └── integration.test.ts     # 记忆系统集成测试
│   └── setup.ts                    # 测试环境设置
└── src/__tests__/mocks/
    └── memory.ts                   # 记忆系统 Mocks
```

### 技术实现要点

#### 1. 模块系统 (ESM/NodeNext)

```typescript
// ✅ 正确 - 在 Automaton 中使用 .js 扩展名
import { MessageEntry, GoalState } from './types.js';
import { AgentContext } from '../agent/types.js';
import { StructuredLogger } from '../logging/logger.js';

// ❌ 错误 - 会导致运行时错误
import { MessageEntry } from './types'; // 缺少 .js
```

#### 2. 工作记忆核心实现

```typescript
// working.ts
export interface WorkingMemoryConfig {
  maxTokenCount: number;        // 最大 Token 数
  maxMessageHistory: number;    // 最大消息历史数
  autoClearInterval: number;    // 自动清除间隔(毫秒)
  retainAcrossTurns: boolean;   // 是否跨回合保留
}

export class WorkingMemory {
  private context: WorkingMemoryContext;
  private config: WorkingMemoryConfig;
  private logger: StructuredLogger;

  constructor(
    sessionId: string,
    config: WorkingMemoryConfig = DEFAULT_CONFIG
  ) {
    this.context = {
      sessionId,
      messageHistory: [],
      currentGoals: [],
      activeTools: [],
      tokenCount: 0,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    };
    this.config = config;
    this.logger = new StructuredLogger('memory:working');
  }

  // 消息管理
  addMessage(message: MessageEntry): void {
    this.context.messageHistory.push(message);
    this.context.tokenCount += message.tokenCount;
    this.context.lastAccessed = Date.now();

    // 自动修减
    this.trimContextIfNecessary();
  }

  getRecentMessages(limit: number = 10): MessageEntry[] {
    return this.context.messageHistory.slice(-limit);
  }

  // 目标管理
  setCurrentGoals(goals: GoalState[]): void {
    this.context.currentGoals = goals;
    this.context.lastAccessed = Date.now();
  }

  // 工具管理
  recordToolCall(tool: ToolInfo): void {
    this.context.activeTools.push(tool);
    this.context.lastAccessed = Date.now();
  }

  // 生命周期管理
  clear(): void {
    this.context.messageHistory = [];
    this.context.currentGoals = [];
    this.context.activeTools = [];
    this.context.tokenCount = 0;
    this.logger.info('Working memory cleared', { sessionId: this.context.sessionId });
  }

  shouldPersist(): boolean {
    // 根据策略决定是否持久化到情节记忆
    return this.context.messageHistory.length > 0;
  }

  private trimContextIfNecessary(): void {
    // Token 超限修减
    while (this.context.tokenCount > this.config.maxTokenCount) {
      const removed = this.context.messageHistory.shift();
      if (removed) {
        this.context.tokenCount -= removed.tokenCount;
      }
    }

    // 消息数量超限修减
    while (this.context.messageHistory.length > this.config.maxMessageHistory) {
      this.context.messageHistory.shift();
    }
  }
}
```

#### 3. 与 Agent Loop 集成

```typescript
// agent/loop.ts (需修改的部分)
import { WorkingMemory } from '../memory/working.js';
import { MemoryManager } from '../memory/manager.js';

export class AgentLoop {
  private workingMemory: WorkingMemory;
  private memoryManager: MemoryManager;

  async think(): Promise<Thought> {
    // 1. 加载工作记忆
    const workingContext = this.workingMemory.getContext();

    // 2. 检索其他记忆层
    const episodicContext = await this.memoryManager.getEpisodicMemory(this.agentId);
    const semanticContext = await this.memoryManager.getSemanticMemory(query);

    // 3. 构建完整上下文
    const fullContext = {
      working: workingContext,
      episodic: episodicContext,
      semantic: semanticContext
    };

    // 4. 生成推理
    return await this.generateReasoning(fullContext);
  }

  async observe(result: ActionResult): Promise<void> {
    // 1. 更新工作记忆
    this.workingMemory.addMessage({
      role: 'assistant',
      content: result.output,
      timestamp: Date.now(),
      tokenCount: result.tokenCount
    });

    // 2. 记录工具调用
    if (result.toolCalls) {
      for (const toolCall of result.toolCalls) {
        this.workingMemory.recordToolCall(toolCall);
      }
    }
  }

  async persist(): Promise<void> {
    // 1. 决定是否持久化
    if (this.workingMemory.shouldPersist()) {
      // 2. 保存到情节记忆
      await this.memoryManager.saveEpisodicMemory({
        agentId: this.agentId,
        context: this.workingMemory.getContext(),
        timestamp: Date.now()
      });
    }

    // 3. 清除工作记忆（如果是单回合模式）
    if (!this.config.retainWorkingMemoryAcrossTurns) {
      this.workingMemory.clear();
    }
  }
}
```

#### 4. Token 计数与上下文管理

```typescript
// tools.ts
export function countTokens(text: string): number {
  // 使用 tiktoken 或简单估算
  return Math.ceil(text.length / 4); // 简单估算：每4字符约1 token
}

export function trimContextToMaxTokens(
  messages: MessageEntry[],
  maxTokens: number
): MessageEntry[] {
  let totalTokens = 0;
  const trimmed: MessageEntry[] = [];

  // 从最新消息开始保留
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (totalTokens + message.tokenCount > maxTokens) {
      break;
    }
    trimmed.unshift(message);
    totalTokens += message.tokenCount;
  }

  return trimmed;
}
```

### 测试标准

#### 单元测试要点

```typescript
describe('WorkingMemory', () => {
  describe('message management', () => {
    it('should add messages to history', () => {
      const memory = new WorkingMemory('test-session');
      memory.addMessage({
        role: 'user',
        content: 'Hello',
        timestamp: Date.now(),
        tokenCount: 10
      });

      expect(memory.getContext().messageHistory.length).toBe(1);
      expect(memory.getContext().tokenCount).toBe(10);
    });

    it('should trim context when exceeding max tokens', () => {
      const memory = new WorkingMemory('test-session', {
        maxTokenCount: 100,
        maxMessageHistory: 10,
        autoClearInterval: 0,
        retainAcrossTurns: false
      });

      // 添加超过限制的消息
      for (let i = 0; i < 20; i++) {
        memory.addMessage({
          role: 'user',
          content: 'test',
          timestamp: Date.now(),
          tokenCount: 10
        });
      }

      expect(memory.getContext().tokenCount).toBeLessThanOrEqual(100);
    });
  });

  describe('lifecycle management', () => {
    it('should clear memory when clear() is called', () => {
      const memory = new WorkingMemory('test-session');
      memory.addMessage({ role: 'user', content: 'test', timestamp: Date.now(), tokenCount: 5 });
      memory.clear();

      expect(memory.getContext().messageHistory.length).toBe(0);
      expect(memory.getContext().tokenCount).toBe(0);
    });
  });
});
```

#### 集成测试要点

```typescript
describe('WorkingMemory Integration', () => {
  it('should integrate with AgentLoop properly', async () => {
    const mockMemory = new WorkingMemory('test-session');
    const loop = new AgentLoop({
      workingMemory: mockMemory,
      // ... 其他配置
    });

    // 模拟一个完整的 ReAct 循环
    await loop.think();
    await loop.act(thought);
    await loop.observe(result);
    await loop.persist();

    // 验证工作记忆被正确使用
    expect(mockMemory.getContext().messageHistory.length).toBeGreaterThan(0);
  });

  it('should persist to episodic memory when appropriate', async () => {
    const memoryManager = createMockMemoryManager();
    const workingMemory = new WorkingMemory('test-session');

    // 添加一些消息
    workingMemory.addMessage({ /* ... */ });

    // 验证应该持久化
    expect(workingMemory.shouldPersist()).toBe(true);

    // 手动持久化
    if (workingMemory.shouldPersist()) {
      await memoryManager.saveEpisodicMemory({
        agentId: 'test-agent',
        context: workingMemory.getContext(),
        timestamp: Date.now()
      });
    }

    expect(memoryManager.saveEpisodicMemory).toHaveBeenCalled();
  });
});
```

### 性能优化

1. **Token 计数缓存**：缓存消息的 Token 计数，避免重复计算
2. **批量操作**：支持批量添加/删除消息，减少数组操作次数
3. **延迟清除**：使用定时器实现延迟清除，避免频繁操作
4. **内存池**：对频繁创建/销毁的对象使用对象池模式

### 安全考虑

1. **输入验证**：验证所有输入数据的合法性
2. **边界检查**：防止数组越界和空指针异常
3. **错误隔离**：确保单个消息的错误不会影响整个记忆系统
4. **日志审计**：记录所有重要的记忆操作用于审计

### 参考文档

- [Architecture: Multi-layer Memory System](./architecture-automaton.md#多层记忆系统) - 五层记忆系统架构
- [Architecture: Agent Loop](./architecture-automaton.md#智能体循环) - Agent Loop 核心循环
- [Development Guide: Memory Implementation](./development-guide-automaton.md#记忆系统实现) - 记忆系统实现指南
- [Project Context: TypeScript Rules](./project-context.md#typescript-配置) - TypeScript 配置规则
- [Project Context: Module System](./project-context.md#导入导出模式-关键) - ESM/NodeNext 模块系统

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

1. **依赖关系**：此 Story 依赖于 Story 1a.2（Agent Loop ReAct 模式实现），需要确保 Agent Loop 已就绪
2. **测试环境**：使用内存数据库进行测试，避免文件系统依赖
3. **配置参数**：所有配置参数（maxTokenCount 等）应在配置中可调
4. **未来扩展**：工作记忆可能需要支持更多的数据类型（如图像、文件引用等）

### File List

- `automaton/src/memory/working.ts` - WorkingMemory 核心实现
- `automaton/src/memory/types.ts` - 记忆相关类型定义
- `automaton/src/memory/constants.ts` - 记忆常量配置
- `automaton/src/memory/index.ts` - 记忆模块导出
- `automaton/src/agent/loop.ts` - Agent Loop (需要集成工作记忆)
- `automaton/src/__tests__/memory/working.test.ts` - 单元测试
- `automaton/src/__tests__/memory/integration.test.ts` - 集成测试
- `automaton/src/__tests__/mocks/memory.ts` - 记忆系统 Mocks
