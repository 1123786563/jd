# Story 1a.2: 智能体循环基础 - ReAct 模式实现

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

作为 Conway Automaton 开发团队，
我想要实现智能体的核心 ReAct 循环模式，
以便智能体能够自主推理和行动。

## Acceptance Criteria

1. ✅ **ReAct 循环核心实现**
   - [ ] 实现 `think()` 方法：基于工作记忆和环境状态生成推理
   - [ ] 实现 `act()` 方法：根据推理结果选择和执行工具
   - [ ] 实现 `observe()` 方法：捕获工具执行结果并更新状态
   - [ ] 实现 `persist()` 方法：将观察结果存储到记忆系统

2. ✅ **状态机管理**
   - [ ] 定义 `AgentState` 枚举：`waking`, `running`, `sleeping`, `critical`, `dead`
   - [ ] 实现状态转换逻辑，包括验证和日志记录
   - [ ] 实现状态转换的原子性更新

3. ✅ **循环控制机制**
   - [ ] 实现最大工具调用限制 (`MAX_TOOL_CALLS_PER_TURN = 10`)
   - [ ] 实现连续错误熔断机制 (`MAX_CONSECUTIVE_ERRORS = 5`)
   - [ ] 实现循环检测机制 (`MAX_REPETITIVE_TURNS = 3`)
   - [ ] 实现死循环防护（基于Token消耗和时间）

4. ✅ **记忆集成**
   - [ ] 集成工作记忆（Working Memory）用于当前上下文
   - [ ] 集成情节记忆（Episodic Memory）用于存储行动历史
   - [ ] 集成语义记忆（Semantic Memory）用于知识检索
   - [ ] 实现记忆压缩和上下文窗口管理

5. ✅ **策略引擎集成**
   - [ ] 在每次工具调用前调用策略引擎验证
   - [ ] 实现工具调用成本追踪
   - [ ] 实现预算熔断和信用检查

6. ✅ **错误处理与恢复**
   - [ ] 实现工具执行错误的捕获和记录
   - [ ] 实现状态回滚机制（关键错误时）
   - [ ] 实现自动恢复策略（临时错误重试）

7. ✅ **日志与可观测性**
   - [ ] 实现结构化日志记录（使用 `StructuredLogger`）
   - [ ] 记录每个循环迭代的详细信息
   - [ ] 实现性能指标收集（Token消耗、执行时间）

8. ✅ **测试覆盖**
   - [ ] 编写单元测试覆盖所有状态转换
   - [ ] 编写集成测试验证完整 ReAct 循环
   - [ ] 编写错误处理测试覆盖所有异常情况
   - [ ] 达到测试覆盖率要求（语句60%，分支50%）

## Tasks / Subtasks

### 核心模块实现

- [ ] **Task 1**: ReAct 循环核心类实现 (AC: 1, 4)
  - [ ] 创建 `agent/loop.ts` 文件
  - [ ] 定义 `AgentLoop` 类结构
  - [ ] 实现 `think()` 方法 - 生成推理逻辑
  - [ ] 实现 `act()` 方法 - 工具选择和执行
  - [ ] 实现 `observe()` 方法 - 结果捕获
  - [ ] 实现 `persist()` 方法 - 记忆存储

- [ ] **Task 2**: 状态机实现 (AC: 2, 3)
  - [ ] 定义 `types.ts` 中的 `AgentState` 枚举
  - [ ] 实现状态转换验证逻辑
  - [ ] 实现状态转换日志记录
  - [ ] 实现循环控制机制（工具调用限制、错误熔断）

- [ ] **Task 3**: 记忆系统集成 (AC: 4)
  - [ ] 集成工作记忆组件
  - [ ] 集成情节记忆组件
  - [ ] 集成语义记忆组件
  - [ ] 实现上下文压缩策略

- [ ] **Task 4**: 策略引擎集成 (AC: 5)
  - [ ] 实现策略验证钩子
  - [ ] 实现成本追踪机制
  - [ ] 实现预算检查和熔断

- [ ] **Task 5**: 错误处理与恢复 (AC: 6)
  - [ ] 实现错误捕获和分类
  - [ ] 实现状态回滚机制
  - [ ] 实现自动恢复策略

- [ ] **Task 6**: 可观测性实现 (AC: 7)
  - [ ] 集成 `StructuredLogger`
  - [ ] 实现循环迭代日志
  - [ ] 实现性能指标收集

### 测试与验证

- [ ] **Task 7**: 单元测试 (AC: 8)
  - [ ] 为 `AgentLoop` 类编写测试
  - [ ] 为状态转换编写测试
  - [ ] 为工具调用编写测试
  - [ ] 为错误处理编写测试

- [ ] **Task 8**: 集成测试 (AC: 8)
  - [ ] 编写完整 ReAct 循环测试
  - [ ] 编写记忆系统集成测试
  - [ ] 编写策略引擎集成测试

- [ ] **Task 9**: 文档与示例
  - [ ] 编写 API 文档注释
  - [ ] 创建使用示例
  - [ ] 更新架构文档引用

## Dev Notes

### 架构模式与约束

#### ReAct 模式实现

基于 Conway Automaton 架构，ReAct 循环应实现以下模式：

```
┌─────────────────┐
│   Waking State  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│         ReAct Loop              │
│  ┌───────────────────────────┐  │
│  │   think()                 │  │  ← 生成推理 (基于记忆 + 环境)
│  │   - 分析当前状态           │  │
│  │   - 生成行动计划           │  │
│  └───────┬───────────────────┘  │
│          │                       │
│  ┌───────▼───────────────────┐  │
│  │   act()                   │  │  ← 执行工具 (策略验证 + 成本追踪)
│  │   - 选择工具               │  │
│  │   - 策略验证               │  │
│  │   - 执行工具               │  │
│  └───────┬───────────────────┘  │
│          │                       │
│  ┌───────▼───────────────────┐  │
│  │   observe()               │  │  ← 捕获结果 (成功/失败/错误)
│  │   - 捕获输出               │  │
│  │   - 记录日志               │  │
│  └───────┬───────────────────┘  │
│          │                       │
│  ┌───────▼───────────────────┐  │
│  │   persist()               │  │  ← 存储到记忆 (情节 + 语义)
│  │   - 情节记忆               │  │
│  │   - 语义记忆               │  │
│  │   - 工作记忆更新           │  │
│  └───────┬───────────────────┘  │
└──────────┼──────────────────────┘
           │
           ▼
    ┌──────────────┐
    │  Check State │
    └──────┬───────┘
           │
           ├──[继续]──→ ReAct Loop (继续迭代)
           ├──[完成]──→ Sleeping State
           ├──[错误]──→ Critical State (如果超过阈值)
           └──[熔断]──→ Sleeping State (强制休眠)

```

#### 状态转换规则

```typescript
// 有效的状态转换
const VALID_TRANSITIONS: Record<AgentState, AgentState[]> = {
  waking: ['running'],
  running: ['sleeping', 'critical', 'running'],
  sleeping: ['waking'],
  critical: ['sleeping', 'dead'],
  dead: []
};

// 状态定义
export enum AgentState {
  WAKING = 'waking',      // 启动中
  RUNNING = 'running',    // 运行中
  SLEEPING = 'sleeping',  // 休眠中
  CRITICAL = 'critical',  // 临界状态（需人工介入）
  DEAD = 'dead'          // 终止状态
}
```

### 文件结构要求

#### 项目结构

```
automaton/
├── src/
│   ├── agent/
│   │   ├── loop.ts              # 核心 ReAct 循环实现
│   │   ├── index.ts             # Agent 模块导出
│   │   └── types.ts             # Agent 相关类型定义
│   ├── memory/                  # 记忆系统（已在 Story 1a.1 创建）
│   ├── policy/                  # 策略引擎（将在 Story 1a.8 实现）
│   ├── types.ts                 # 全局类型定义
│   └── index.ts                 # 主入口
├── src/__tests__/
│   ├── agent/
│   │   ├── loop.test.ts         # AgentLoop 单元测试
│   │   └── integration.test.ts  # ReAct 循环集成测试
│   └── setup.ts                 # 测试环境设置
```

### 技术实现要点

#### 1. 模块系统 (ESM/NodeNext)

```typescript
// ✅ 正确 - 在 Automaton 中使用 .js 扩展名
import { MemoryManager } from '../memory/manager.js';
import { PolicyEngine } from '../policy/engine.js';
import { StructuredLogger } from '../logging/logger.js';

// ❌ 错误 - 会导致运行时错误
import { MemoryManager } from '../memory/manager'; // 缺少 .js
```

#### 2. 异步处理模式

```typescript
export class AgentLoop {
  private state: AgentState = AgentState.WAKING;

  async run(): Promise<void> {
    try {
      while (this.shouldContinue()) {
        await this.think();
        await this.act();
        await this.observe();
        await this.persist();

        // 检查循环控制
        if (this.shouldSleep()) {
          await this.transitionTo(AgentState.SLEEPING);
          break;
        }
      }
    } catch (error) {
      this.logger.error('Agent loop error', { error, context: this.state });
      await this.handleCriticalError(error);
    }
  }

  private async think(): Promise<Thought> {
    // 生成推理逻辑
  }

  private async act(thought: Thought): Promise<ActionResult> {
    // 执行工具调用
  }

  private async observe(result: ActionResult): Promise<void> {
    // 捕获结果
  }

  private async persist(): Promise<void> {
    // 存储到记忆
  }
}
```

#### 3. 记忆集成

```typescript
// 工作记忆 - 当前上下文
const workingMemory = await memoryManager.getWorkingMemory(agentId);

// 情节记忆 - 行动历史
await memoryManager.storeEpisode({
  agentId,
  action: 'tool_call',
  tool: 'readFile',
  timestamp: Date.now(),
  result: 'success'
});

// 语义记忆 - 知识库
const knowledge = await memoryManager.retrieveSemanticKnowledge(query);
```

#### 4. 策略验证

```typescript
const action = await this.generateAction(thought);

// 策略验证
const validation = await policyEngine.validate({
  agentId: this.id,
  tool: action.tool,
  parameters: action.parameters,
  estimatedCost: this.estimateCost(action)
});

if (!validation.allowed) {
  this.logger.warn('Action blocked by policy', { action, reason: validation.reason });
  throw new PolicyViolationError(validation.reason);
}
```

#### 5. 错误处理

```typescript
try {
  const result = await tool.execute(parameters);
  this.consecutiveErrors = 0;
} catch (error) {
  this.consecutiveErrors++;

  if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
    await this.transitionTo(AgentState.CRITICAL);
    throw new CriticalError('Too many consecutive errors');
  }

  // 临时错误 - 等待后重试
  if (isTemporaryError(error)) {
    await this.sleep(RETRY_DELAY);
  }
}
```

### 测试标准

#### 单元测试要点

```typescript
describe('AgentLoop', () => {
  describe('state transitions', () => {
    it('should transition from waking to running', async () => {
      const loop = new AgentLoop(config);
      await loop.start();

      expect(loop.getState()).toBe(AgentState.RUNNING);
    });

    it('should transition to critical on max errors', async () => {
      // 模拟连续错误
      for (let i = 0; i < MAX_CONSECUTIVE_ERRORS; i++) {
        await loop.handleToolError(new Error('Test error'));
      }

      expect(loop.getState()).toBe(AgentState.CRITICAL);
    });
  });

  describe('ReAct loop', () => {
    it('should complete full think-act-observe-persist cycle', async () => {
      const result = await loop.executeCycle();

      expect(result.success).toBe(true);
      expect(memoryManager.storeEpisode).toHaveBeenCalled();
    });
  });
});
```

#### 集成测试要点

```typescript
describe('AgentLoop Integration', () => {
  it('should execute complete ReAct loop with memory persistence', async () => {
    const mockMemory = createMockMemoryManager();
    const mockPolicy = createMockPolicyEngine();

    const loop = new AgentLoop({
      memoryManager: mockMemory,
      policyEngine: mockPolicy
    });

    await loop.start();
    await loop.runForIterations(3); // 运行 3 个迭代

    // 验证记忆存储
    expect(mockMemory.storeEpisode).toHaveBeenCalledTimes(3);

    // 验证状态
    expect(loop.getState()).toBe(AgentState.RUNNING);
  });
});
```

### 性能优化

1. **记忆压缩**：实施上下文窗口管理，避免记忆溢出
2. **批量操作**：对记忆存储使用批量写入减少 I/O
3. **缓存策略**：缓存频繁访问的策略检查结果
4. **异步日志**：使用异步日志记录避免阻塞主循环

### 安全考虑

1. **策略验证**：所有工具调用前必须通过策略引擎
2. **输入消毒**：使用 `injection-defense.ts` 消毒所有外部输入
3. **错误隔离**：确保工具错误不会导致整个 Agent 崩溃
4. **状态保护**：关键状态转换需原子性更新

### 参考文档

- [Architecture: Conway Automaton Core Loop](./architecture-automaton.md#agent-core-loop) - Agent 核心循环设计
- [Development Guide: Agent Implementation](./development-guide-automaton.md#agent-loop-pattern) - Agent 实现指南
- [Project Context: TypeScript Rules](./project-context.md#typescript-configuration) - TypeScript 配置规则
- [Project Context: Module System](./project-context.md#导入导出模式-关键) - ESM/NodeNext 模块系统
- [UpworkAutoPilot Design: Agent State Machine](./upwork_autopilot_detailed_design.md#状态机设计) - 详细的状态机设计

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

1. **记忆系统依赖**：此 Story 依赖于 Story 1a.1（工作记忆、情节记忆、语义记忆的基础实现），需要确保这些组件已就绪
2. **策略引擎延迟**：完整的策略引擎将在 Story 1a.8 实现，当前可使用简单的模拟验证
3. **测试环境**：使用内存 SQLite 进行测试，避免文件系统依赖
4. **循环控制参数**：所有控制参数（MAX_TOOL_CALLS_PER_TURN 等）应在配置中可调

### File List

- `automaton/src/agent/loop.ts` - AgentLoop 核心实现
- `automaton/src/agent/types.ts` - AgentState 枚举和相关类型
- `automaton/src/agent/index.ts` - Agent 模块导出
- `automaton/src/__tests__/agent/loop.test.ts` - 单元测试
- `automaton/src/__tests__/agent/integration.test.ts` - 集成测试
