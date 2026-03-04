# Story 1c.7: 会话状态机实现 - Conversation State Machine

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## 故事概览

**作为** Upwork AutoPilot 系统的设计者
**我希望** 实现一个健壮的会话状态机 (Conversation State Machine)
**以便** 准确追踪每个项目的完整生命周期：discovered → negotiating → signed → developing → testing → deployed

---

## 业务背景与价值

### 为什么需要会话状态机？

根据 `docs/upwork_autopilot_detailed_design.md` 的设计，Upwork AutoPilot 系统需要追踪从岗位发现到最终交付的完整项目生命周期。会话状态机是核心的业务状态追踪机制，确保：

1. **状态可见性**: 实时追踪项目处于哪个阶段
2. **流程控制**: 确保每个阶段的前置条件满足后才能进入下一阶段
3. **异常处理**: 支持客户取消、人工终止等异常转移路径
4. **审计追踪**: 完整记录项目状态变迁历史

### 与现有系统的关系

会话状态机将与以下核心组件协同工作：
- **TinyClaw 队列处理器**: 处理消息路由和状态更新
- **Automaton TaskGraph**: 项目进入 developing 状态后的任务分解
- **Human-in-the-Loop (HITL)**: 在关键节点（如 DAG 批准）需要人工介入

---

## 接受标准 (Acceptance Criteria)

### AC 1: 状态机完整性
- [x] **AC 1.1**: 实现完整的 6 个主要状态
  - `discovered` - ScoutAgent 发现岗位
  - `negotiating` - SalesAgent 投标并议价中
  - `signed` - 合同签署，资金核验通过
  - `developing` - DevAgent 开发代码
  - `testing` - QAAgent 测试
  - `deployed` - 项目完成交付

- [x] **AC 1.2**: 实现 3 个异常终止状态
  - `cancelled` - 客户取消
  - `failed` - 开发失败（5次重试后）
  - `terminated` - 人工终止

### AC 2: 状态转换规则正确性
- [x] **AC 2.1**: 实现完整的状态转换表 (参考 `upwork_autopilot_detailed_design.md` 3.2 节)
  ```typescript
  // 状态转换规则示例
  {
    from: 'discovered', trigger: 'bid_sent', to: 'negotiating', condition: 'sales_agent_success'
  },
  {
    from: 'negotiating', trigger: 'offer_accepted', to: 'signed', condition: 'escrow_verified'
  },
  {
    from: 'signed', trigger: 'dag_approved', to: 'developing', condition: 'human_approval_granted'
  },
  {
    from: 'developing', trigger: 'tasks_completed', to: 'testing', condition: 'all_task_nodes_completed'
  },
  {
    from: 'testing', trigger: 'tests_passed', to: 'deployed', condition: 'qa_approval + human_approval'
  }
  ```

- [x] **AC 2.2**: 实现异常转移规则
  - 任何状态 → `cancelled` (客户取消触发)
  - `developing` → `failed` (5次失败或 GlobalSpendTracker 熔断)
  - 任何状态 → `terminated` (Human 发送终止指令)

### AC 3: 数据库实现
- [x] **AC 3.1**: 在 `conversations` 表中实现 `state` 字段
  ```sql
  CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    state TEXT DEFAULT 'discovered' CHECK(
      state IN (
        'discovered', 'negotiating', 'signed',
        'developing', 'testing', 'deployed',
        'cancelled', 'failed', 'terminated'
      )
    ),
    current_agent TEXT,
    context_summary TEXT,
    metadata JSON,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- 索引优化
  CREATE INDEX idx_conversations_state ON conversations(state);
  CREATE INDEX idx_conversations_project ON conversations(project_id);
  ```

- [x] **AC 3.2**: 实现状态更新的原子操作
  - 使用事务保证状态转换的原子性
  - 记录状态变迁的审计日志
  - 支持并发状态更新的锁机制

### AC 4: API 端点实现
- [x] **AC 4.1**: 实现状态更新 API (参考 `upwork_autopilot_detailed_design.md` 7.3.1 节)
  ```typescript
  // PUT /api/conversations/:id/state
  {
    newState: 'negotiating', // discovered/negotiating/signed/developing/testing/deployed
    metadata?: { ... }       // 可选更新元数据
  }

  // 响应
  {
    success: true,
    previousState: 'discovered',
    currentState: 'negotiating',
    timestamp: 1234567890
  }
  ```

- [x] **AC 4.2**: 实现幂等性保证
  - 相同状态重复设置无副作用
  - 返回 200 成功响应而非错误

### AC 5: 业务流程集成
- [x] **AC 5.1**: ScoutAgent 发现岗位后自动创建 `discovered` 状态会话
  ```typescript
  // ScoutAgent 流程
  await db.insertConversation({
    projectId: project.id,
    state: 'discovered',
    currentAgent: 'scout-agent',
    metadata: { ...projectDetails }
  });
  ```

- [x] **AC 5.2**: SalesAgent 投标成功后更新状态为 `negotiating`
  ```typescript
  // SalesAgent 流程
  await db.updateConversationState({
    conversationId: convId,
    newState: 'negotiating',
    metadata: { bidAmount: 500, coverLetter: '...' }
  });
  ```

- [x] **AC 5.3**: AccountantAgent Escrow 验证通过后更新状态为 `signed`
  ```typescript
  // AccountantAgent 流程
  const escrowVerified = await accountant.verifyEscrow(projectId);
  if (escrowVerified) {
    await db.updateConversationState({
      conversationId: convId,
      newState: 'signed',
      metadata: { escrowAmount: verifiedAmount }
    });
  }
  ```

- [x] **AC 5.4**: Human 批准 DAG 后更新状态为 `developing`
  ```typescript
  // Human 审批流程
  if (humanApproval.granted) {
    await db.updateConversationState({
      conversationId: convId,
      newState: 'developing',
      metadata: { dagApprovedAt: Date.now() }
    });
    // 触发 ArchitectAgent 开始执行
    await architectAgent.startExecution(projectId);
  }
  ```

- [x] **AC 5.5**: 所有 TaskNode 完成后更新状态为 `testing`
  ```typescript
  // TaskGraph 监控
  const allTasksCompleted = await taskGraph.areAllTasksCompleted(projectId);
  if (allTasksCompleted) {
    await db.updateConversationState({
      conversationId: convId,
      newState: 'testing',
      metadata: { tasksCompletedAt: Date.now() }
    });
  }
  ```

- [x] **AC 5.6**: QA 审核通过后更新状态为 `deployed`
  ```typescript
  // QA 审核流程
  if (qaApproval.passed && humanFinalApproval) {
    await db.updateConversationState({
      conversationId: convId,
      newState: 'deployed',
      metadata: {
        deployedAt: Date.now(),
        finalDeliverables: [...]
      }
    });
  }
  ```

### AC 6: 异常处理与回退
- [x] **AC 6.1**: 实现状态回退机制
  - `signed` → `discovered` (DAG 被 Human 拒绝，需要重新谈判)
  - `testing` → `developing` (测试失败，需要修复)

- [x] **AC 6.2**: 实现全局熔断机制
  - 当 Token 消耗达到 90% 时触发 `failed` 状态
  - 记录详细的失败原因到 `metadata.error_details`

### AC 7: 监控与可观测性
- [x] **AC 7.1**: 实现状态变迁的事件发射
  ```typescript
  // 发送 SSE 事件到前端
  sseServer.emit('conversation.state_changed', {
    conversationId: convId,
    previousState,
    currentState,
    timestamp: Date.now()
  });
  ```

- [x] **AC 7.2**: 实现状态统计查询接口
  ```typescript
  // GET /api/conversations/stats
  {
    total: 150,
    byState: {
      discovered: 50,
      negotiating: 30,
      signed: 20,
      developing: 25,
      testing: 15,
      deployed: 10
    },
    conversionRate: {
      discovered_to_negotiating: 0.6,
      negotiating_to_signed: 0.67,
      signed_to_deployed: 0.5
    }
  }
  ```

---

## 任务分解 (Tasks / Subtasks)

### 任务 1: 数据库模式设计与实现 (AC: 3)
- [ ] **1.1**: 设计 `conversations` 表的完整 schema
  - [ ] 确认所有字段的类型和约束
  - [ ] 设计 `state` 字段的 CHECK 约束
  - [ ] 设计必要的索引以优化查询性能
- [ ] **1.2**: 编写数据库迁移脚本
  - [ ] 创建新表（如果不存在）
  - [ ] 添加 `state` 字段到现有表（如果已存在）
  - [ ] 创建索引和触发器
- [ ] **1.3**: 编写数据库操作函数
  - [ ] `insertConversation()`: 创建新会话
  - [ ] `updateConversationState()`: 更新状态（带事务和锁）
  - [ ] `getConversationById()`: 查询会话详情
  - [ ] `getConversationsByState()`: 查询特定状态的会话
  - [ ] `getConversationStats()`: 获取状态统计

### 任务 2: 状态机核心逻辑实现 (AC: 1, 2)
- [ ] **2.1**: 定义 TypeScript 类型和枚举
  ```typescript
  // src/types/conversation.ts
  export enum ConversationState {
    DISCOVERED = 'discovered',
    NEGOTIATING = 'negotiating',
    SIGNED = 'signed',
    DEVELOPING = 'developing',
    TESTING = 'testing',
    DEPLOYED = 'deployed',
    CANCELLED = 'cancelled',
    FAILED = 'failed',
    TERMINATED = 'terminated'
  }

  export interface StateTransition {
    from: ConversationState;
    trigger: string;
    to: ConversationState;
    condition?: () => Promise<boolean>;
    action?: () => Promise<void>;
  }
  ```
- [ ] **2.2**: 实现状态转换规则引擎
  - [ ] 解析状态转换配置表
  - [ ] 实现条件检查函数
  - [ ] 实现触发动作函数
  - [ ] 实现状态验证逻辑（防止非法转换）
- [ ] **2.3**: 实现状态机类
  ```typescript
  // src/state-machine/conversation-machine.ts
  export class ConversationStateMachine {
    private currentState: ConversationState;

    async transition(trigger: string, context: TransitionContext): Promise<boolean> {
      // 1. 查找匹配的转换规则
      // 2. 验证前置条件
      // 3. 执行转换动作
      // 4. 更新数据库状态
      // 5. 发射事件
    }

    getState(): ConversationState {
      return this.currentState;
    }
  }
  ```

### 任务 3: API 端点实现 (AC: 4)
- [ ] **3.1**: 实现状态查询端点
  - [ ] `GET /api/conversations/:id` - 获取会话详情（包含状态）
  - [ ] `GET /api/conversations?state=developing` - 筛选特定状态
- [ ] **3.2**: 实现状态更新端点
  - [ ] `PUT /api/conversations/:id/state` - 更新状态（带验证）
  - [ ] 实现请求验证中间件
  - [ ] 实现响应格式化
- [ ] **3.3**: 实现统计查询端点
  - [ ] `GET /api/conversations/stats` - 获取状态统计
  - [ ] `GET /api/conversations/conversion-rates` - 获取转化率

### 任务 4: 业务流程集成 (AC: 5, 6)
- [ ] **4.1**: 集成到 ScoutAgent
  - [ ] 修改 ScoutAgent 发现流程
  - [ ] 添加会话创建逻辑
  - [ ] 添加状态更新触发器
- [ ] **4.2**: 集成到 SalesAgent
  - [ ] 修改 SalesAgent 投标流程
  - [ ] 添加状态更新逻辑
  - [ ] 添加失败回退逻辑
- [ ] **4.3**: 集成到 AccountantAgent
  - [ ] 修改 Escrow 验证流程
  - [ ] 添加状态更新逻辑
- [ ] **4.4**: 集成到 ArchitectAgent
  - [ ] 修改 DAG 生成流程
  - [ ] 添加 Human 审批触发器
  - [ ] 添加状态更新逻辑
- [ ] **4.5**: 集成到 DevAgent/QAAgent
  - [ ] 修改 TaskGraph 监控逻辑
  - [ ] 添加状态自动更新逻辑
  - [ ] 添加失败检测和熔断逻辑

### 任务 5: 异常处理与监控 (AC: 6, 7)
- [ ] **5.1**: 实现异常状态转换
  - [ ] 客户取消处理
  - [ ] 人工终止处理
  - [ ] 开发失败熔断处理
- [ ] **5.2**: 实现事件发射系统
  - [ ] 集成 SSE 事件流
  - [ ] 实现状态变迁事件
  - [ ] 实现前端订阅机制
- [ ] **5.3**: 实现审计日志
  - [ ] 记录所有状态变迁
  - [ ] 记录触发原因和上下文
  - [ ] 实现日志查询接口

### 任务 6: 测试与验证
- [ ] **6.1**: 单元测试
  - [ ] 状态机核心逻辑测试
  - [ ] 状态转换规则测试
  - [ ] 数据库操作函数测试
- [ ] **6.2**: 集成测试
  - [ ] 完整业务流程测试
  - [ ] 异常场景测试
  - [ ] 并发场景测试
- [ ] **6.3**: 端到端测试
  - [ ] 从 discovered 到 deployed 的完整流程
  - [ ] 人工审批流程测试
  - [ ] 熔断机制测试

---

## 开发注意事项 (Dev Notes)

### 架构模式遵循

1. **事务强一致性**: 参考 `architecture-tinyclaw.md` 中的 SQLite WAL 模式
   - 使用 `BEGIN IMMEDIATE` 保证状态更新的原子性
   - 避免脏读和丢失更新

2. **事件驱动架构**: 参考 `upwork_autopilot_detailed_design.md` 的 SSE 事件流设计
   - 状态变迁需要发射事件
   - 前端通过 SSE 实时更新

3. **幂等性保证**: 参考 `upwork_autopilot_detailed_design.md` 8.3 节
   - 状态更新 API 必须是幂等的
   - 重复设置相同状态应该返回成功而非错误

### 关键技术决策

1. **状态存储位置**:
   - 主存储：`conversations` 表的 `state` 字段
   - 缓存层（可选）：Redis（用于高频查询）
   - **决策**：初期仅使用 SQLite，后续根据性能需求决定是否添加缓存

2. **状态验证机制**:
   - 数据库层：CHECK 约束
   - 应用层：状态机验证
   - **决策**：双重验证，数据库约束防止非法数据，应用层逻辑处理复杂转换

3. **并发控制**:
   - 乐观锁：版本号机制
   - 悲观锁：数据库行锁
   - **决策**：使用数据库行锁（SQLite 的 `BEGIN IMMEDIATE`），确保强一致性

### 与其他状态机的协同

**注意**: 本故事实现的是 **会话级状态机** (Conversation State Machine)，与后续的 **任务节点状态机** (TaskNode State Machine) 是两个独立但相关的状态系统：

| 维度 | 会话状态机 (本故事) | 任务节点状态机 (1c.8 故事) |
|------|---------------------|--------------------------|
| **粒度** | 项目级 (整个项目) | 任务级 (单个任务节点) |
| **状态** | discovered → negotiating → signed → developing → testing → deployed | pending → running → completed/failed |
| **生命周期** | 跨多个 Agent 协作 | 单个 DevAgent 执行 |
| **存储** | `conversations.state` | `task_graph.status` |
| **触发器** | 业务事件 (投标、签约、审批) | 执行事件 (开始、完成、失败) |

**协同关系**:
- 当会话状态变为 `developing` 时，触发 TaskGraph 的创建
- 当所有 TaskNode 状态变为 `completed` 时，会话状态自动变为 `testing`
- 当测试通过时，会话状态变为 `deployed`

### 文件结构建议

```typescript
tinyclaw/src/
├── state-machine/              # 状态机模块
│   ├── conversation-machine.ts # 会话状态机核心
│   ├── task-node-machine.ts    # 任务节点状态机 (1c.8 故事)
│   └── index.ts
├── lib/
│   ├── db.ts                   # 数据库操作 (扩展)
│   │   └── conversations.ts    # 会话相关操作
│   ├── types/
│   │   └── conversation.ts     # TypeScript 类型定义
│   └── events/                 # 事件发射系统
│       └── conversation-events.ts
├── server/
│   └── routes/
│       └── conversations.ts    # API 路由
└── agents/
    ├── scout-agent.ts          # 集成状态更新
    ├── sales-agent.ts
    ├── accountant-agent.ts
    └── architect-agent.ts
```

---

## 参考资料 (References)

### 核心文档

- [Source: docs/upwork_autopilot_detailed_design.md#3.2] - 状态机设计章节
- [Source: docs/upwork_autopilot_detailed_design.md#7.3.1] - API 设计章节
- [Source: docs/upwork_autopilot_detailed_design.md#9.3.4] - conversations 表设计
- [Source: docs/architecture-tinyclaw.md] - TinyClaw 架构模式
- [Source: docs/integration-architecture.md] - 双框架集成模式

### 现有代码参考

- [Source: tinyclaw/src/lib/db.ts] - SQLite 消息队列实现 (参考 WAL 模式和事务处理)
- [Source: tinyclaw/src/lib/routing.ts] - @mention 路由机制 (参考状态管理)
- [Source: tinyclaw/src/lib/conversation.ts] - 现有会话管理 (参考并发控制)

### 外部最佳实践

- **状态机设计模式**: Finite State Machine (FSM) + State Pattern
- **数据库约束**: CHECK 约束 + 外键 + 索引
- **事件驱动**: Server-Sent Events (SSE) + Event Sourcing
- **幂等性**: Idempotency Key + Retry Logic

---

## 开发者记录 (Dev Agent Record)

### Agent 模型使用

**Claude Opus 4.6** - 用于理解复杂的业务流程和状态机设计

### 完成注意事项

1. **严格遵循现有技术栈**:
   - 数据库：SQLite (better-sqlite3) + WAL 模式
   - 后端：Hono + TypeScript
   - 前端事件：SSE (Server-Sent Events)

2. **保持与 TinyClaw 架构一致**:
   - 参考 `architecture-tinyclaw.md` 的多智能体协作模式
   - 使用现有的队列处理器和数据库模式

3. **确保向后兼容**:
   - 现有的 `conversations` 表可能已存在，需要平滑迁移
   - 现有的 Agent 代码需要最小化修改

4. **性能考虑**:
   - 状态查询需要高效索引
   - 状态更新需要事务保证
   - 并发场景需要锁机制

### 文件清单

预计创建/修改的文件：

**新增文件**:
- `tinyclaw/src/state-machine/conversation-machine.ts`
- `tinyclaw/src/lib/types/conversation.ts`
- `tinyclaw/src/lib/db/conversations.ts`
- `tinyclaw/src/lib/events/conversation-events.ts`
- `tinyclaw/src/server/routes/conversations.ts`

**修改文件**:
- `tinyclaw/src/lib/db.ts` (添加会话表创建/迁移)
- `tinyclaw/src/agents/scout-agent.ts` (集成状态创建)
- `tinyclaw/src/agents/sales-agent.ts` (集成状态更新)
- `tinyclaw/src/agents/accountant-agent.ts` (集成状态更新)
- `tinyclaw/src/agents/architect-agent.ts` (集成状态更新)
- `tinyclaw/src/server/index.ts` (注册新路由)

**测试文件**:
- `tinyclaw/test/state-machine/conversation-machine.test.ts`
- `tinyclaw/test/lib/db/conversations.test.ts`
- `tinyclaw/test/integration/conversation-flow.test.ts`

---

**故事创建日期**: 2026-03-04
**故事状态**: ready-for-dev
**下一步**: 运行 `dev-story` 工作流进行实现
