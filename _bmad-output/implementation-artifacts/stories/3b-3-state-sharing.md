# Story 3b.3: 状态共享机制

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a TinyClaw 开发者和 Conway Automaton 集成工程师,
I want 实现状态共享机制，在 TinyClaw 和 Automaton 之间传递会话上下文和任务状态,
so that 两个框架能够协同工作，实现混合架构模式下的无缝状态传递。

## Acceptance Criteria

### AC1: 会话上下文共享
- [ ] 实现 ConversationContext 数据结构，包含消息历史、当前状态和元数据
- [ ] 提供 `loadContext()` 方法从数据库加载会话上下文
- [ ] 提供 `shareWithAgent(agentId: string)` 方法将上下文传递给指定 Agent
- [ ] 支持跨框架上下文序列化和反序列化
- [ ] 确保上下文数据的完整性和一致性

### AC2: 任务状态同步
- [ ] 实现 TaskNode 状态在 TinyClaw 和 Automaton 之间的双向同步
- [ ] 支持 Automaton 的七步状态机 (classifying/planning/executing/replanning)
- [ ] 支持 TinyClaw 的会话状态 (discovered/negotiating/signed/developing/testing/deployed)
- [ ] 确保状态转换的原子性和一致性
- [ ] 提供状态变更事件通知机制

### AC3: 共享数据库设计
- [ ] 扩展现有数据库表结构以支持跨框架状态
- [ ] 在 `conversations` 表中添加 `framework` 字段标识来源框架
- [ ] 在 `task_graph` 表中添加 `orchestrator_type` 字段区分编排器
- [ ] 在 `projects` 表中添加 `automaton_agent_id` 和 `genesis_prompt_hash` 用于 Web4 集成
- [ ] 保持数据迁移向后兼容性

### AC4: API 桥接层
- [ ] 实现状态同步中间件，处理框架间的状态转换
- [ ] 提供状态事件订阅/发布机制
- [ ] 实现冲突检测和解决策略
- [ ] 支持状态快照和回滚功能
- [ ] 提供状态同步审计日志

### AC5: 集成测试覆盖
- [ ] 编写端到端集成测试验证状态共享机制
- [ ] 测试会话上下文在不同框架间的传递
- [ ] 验证任务状态同步的正确性
- [ ] 测试并发状态更新的处理
- [ ] 验证状态持久化的可靠性

## Tasks / Subtasks

### Task 1: 数据模型设计 (AC: 1, 3)
- [ ] Subtask 1.1: 设计 ConversationContext 数据结构
- [ ] Subtask 1.2: 设计跨框架状态同步协议
- [ ] Subtask 1.3: 定义数据库表扩展方案
- [ ] Subtask 1.4: 创建 TypeScript 类型定义

### Task 2: 数据库迁移 (AC: 3)
- [ ] Subtask 2.1: 扩展 conversations 表结构
- [ ] Subtask 2.2: 扩展 task_graph 表结构
- [ ] Subtask 2.3: 扩展 projects 表结构
- [ ] Subtask 2.4: 编写数据库迁移脚本
- [ ] Subtask 2.5: 验证迁移脚本的向后兼容性

### Task 3: 会话上下文管理 (AC: 1)
- [ ] Subtask 3.1: 实现 ConversationContext 类
- [ ] Subtask 3.2: 实现 loadContext() 方法
- [ ] Subtask 3.3: 实现 shareWithAgent() 方法
- [ ] Subtask 3.4: 实现上下文序列化/反序列化
- [ ] Subtask 3.5: 添加上下文验证逻辑

### Task 4: 任务状态同步 (AC: 2)
- [ ] Subtask 4.1: 实现 Automaton 状态映射器
- [ ] Subtask 4.2: 实现 TinyClaw 状态映射器
- [ ] Subtask 4.3: 实现双向状态同步机制
- [ ] Subtask 4.4: 添加状态转换验证
- [ ] Subtask 4.5: 实现状态变更事件系统

### Task 5: API 桥接层 (AC: 4)
- [ ] Subtask 5.1: 实现状态同步中间件
- [ ] Subtask 5.2: 实现事件订阅/发布系统
- [ ] Subtask 5.3: 实现冲突检测和解决策略
- [ ] Subtask 5.4: 实现状态快照功能
- [ ] Subtask 5.5: 添加审计日志记录

### Task 6: 测试和文档 (AC: 5)
- [ ] Subtask 6.1: 编写单元测试
- [ ] Subtask 6.2: 编写集成测试
- [ ] Subtask 6.3: 编写 API 文档
- [ ] Subtask 6.4: 更新集成架构文档
- [ ] Subtask 6.5: 创建使用示例

## Dev Notes

### Epic 3b 上下文

**Epic 3b: 混合架构实施**
- 目标：实现 Conway Automaton 与 TinyClaw 的深度集成，发挥各自优势
- 背景：TinyClaw 专注于多渠道消息路由和前端控制，Automaton 专注于复杂任务推理和自修改能力
- 业务价值：构建统一的自主智能体平台，提供最佳的用户体验和系统性能

### 架构背景

根据 `docs/integration-architecture.md`，混合架构包含以下集成场景：

**场景 1：将 Automaton 作为 TinyClaw 智能体**
```
用户 → TinyClaw 渠道 → 队列 → @automaton-agent
                                    ↓
                            Conway Automaton API
                                    ↓
                            TinyClaw 响应队列
                                    ↓
                                    用户
```

**场景 4：混合架构 (Hybrid Architecture)**
```
渠道 (Discord/Telegram) → TinyClaw
                                   ↓
                          简单查询 → TinyClaw 智能体
                                   ↓
                       复杂任务 → Conway Automaton
                                   ↓
                                  响应
```

### 核心业务流程

基于 `docs/upwork_autopilot_detailed_design.md` 的业务流程：

**流程 1: 岗位发现 → 投标 → 谈判**
1. UpworkRSS → RateLimiter → ScoutAgent 过滤
2. QueueProcessor 事务锁定 → SalesAgent 生成 Cover Letter
3. ScrubbingHook 去除 AI 指纹 → UpworkAPI 发送
4. UpworkPlatform 回复 → QueueProcessor 入队
5. SalesAgent 议价 → PolicyEngine 审核 → 发送报价
6. **状态：会话状态更新为 `negotiating`**

**流程 2: 资金核验 → 合同签署 → 架构设计**
1. SalesAgent → AccountantAgent (@mention 核验资金)
2. AccountantAgent → EscrowService (查询托管金额)
3. AccountantAgent 检查余额 → 不足时触发充值
4. AccountantAgent → ArchitectAgent (@mention 项目已签约)
5. ArchitectAgent 生成 DAG → QAReviewer Dry-Run 审查
6. QAReviewer → human_approvals → Human Supervisor Telegram 审批
7. **状态：会话状态更新为 `signed`，任务图创建**

### 状态机映射

**Automaton 七步状态机：**
- `classifying` - 分类任务
- `planning` - 规划执行
- `executing` - 执行任务
- `replanning` - 重新规划
- `monitoring` - 监控进度
- `validating` - 验证结果
- `completing` - 完成任务

**TinyClaw 会话状态：**
- `discovered` - 已发现岗位
- `negotiating` - 谈判中
- `signed` - 合同已签署
- `developing` - 开发中
- `testing` - 测试中
- `deployed` - 已部署

**TaskNode 状态：**
- `blocked` - 阻塞
- `pending` - 待处理
- `running` - 运行中
- `completed` - 已完成
- `failed` - 失败
- `abandoned` - 已放弃

### 数据库架构

**核心表结构扩展：**

1. **conversations 表**
```sql
ALTER TABLE conversations ADD COLUMN framework TEXT DEFAULT 'tinyclaw';
-- framework: 'tinyclaw' | 'automaton'
ALTER TABLE conversations ADD COLUMN state_data JSON;
-- 存储框架特定的状态数据
```

2. **task_graph 表**
```sql
ALTER TABLE task_graph ADD COLUMN orchestrator_type TEXT DEFAULT 'tinyclaw';
-- orchestrator_type: 'tinyclaw' | 'automaton'
ALTER TABLE task_graph ADD COLUMN automaton_agent_id TEXT;
-- Automaton Agent 的唯一标识
```

3. **projects 表**
```sql
ALTER TABLE projects ADD COLUMN automaton_agent_id TEXT;
ALTER TABLE projects ADD COLUMN genesis_prompt_hash TEXT;
-- Web4 集成字段
ALTER TABLE projects ADD COLUMN framework_mapping JSON;
-- 框架间状态映射配置
```

### 技术实现细节

**会话上下文数据结构：**
```typescript
interface ConversationContext {
  conversationId: string;
  framework: 'tinyclaw' | 'automaton';
  messages: Array<{
    id: string;
    timestamp: Date;
    content: string;
    sender: string;
    frameworkMetadata?: Record<string, any>;
  }>;
  currentState: {
    state: string; // TinyClaw 或 Automaton 状态
    subState?: string; // 子状态（如 Automaton 的七步状态机）
    transitionHistory: Array<{
      from: string;
      to: string;
      timestamp: Date;
      reason?: string;
    }>;
  };
  metadata: {
    project?: string;
    taskGraph?: string;
    automatonAgentId?: string;
    lastSyncedAt?: Date;
  };
}
```

**状态同步中间件：**
```typescript
class StateSyncMiddleware {
  // 映射 Automaton 状态到 TinyClaw 状态
  private automatonToTinyClaw(state: string): string {
    const mapping = {
      'classifying': 'developing',
      'planning': 'developing',
      'executing': 'developing',
      'replanning': 'developing',
      'monitoring': 'testing',
      'validating': 'testing',
      'completing': 'deployed'
    };
    return mapping[state] || 'developing';
  }

  // 映射 TinyClaw 状态到 Automaton 状态
  private tinyClawToAutomaton(state: string): string {
    const mapping = {
      'discovered': 'classifying',
      'negotiating': 'planning',
      'signed': 'planning',
      'developing': 'executing',
      'testing': 'monitoring',
      'deployed': 'completing'
    };
    return mapping[state] || 'executing';
  }
}
```

### 技术约束和要求

#### 数据库约束
- 使用 SQLite WAL 模式 + `BEGIN IMMEDIATE` 确保并发安全
- 所有状态更新必须在事务中执行
- 使用预处理语句防止 SQL 注入

#### 性能约束
- 状态同步操作响应时间 < 100ms
- 支持并发状态更新（通过锁机制）
- 状态快照大小限制在 10MB 以内

#### 安全约束
- 所有状态变更必须记录审计日志
- 防止跨框架的状态注入攻击
- 验证框架标识符的合法性

### 测试策略

**单元测试覆盖：**
- ConversationContext 类的所有方法
- 状态映射函数
- 数据库迁移脚本
- 序列化/反序列化逻辑

**集成测试覆盖：**
- 跨框架会话上下文传递
- 任务状态双向同步
- 并发状态更新处理
- 状态快照和恢复

**端到端测试：**
- 完整业务流程测试（从 `discovered` 到 `deployed`）
- 错误恢复场景测试
- 网络中断恢复测试

### 项目结构注意事项

**文件位置：**
```
jd/
├── tinyclaw/
│   └── src/
│       ├── lib/
│       │   ├── context/
│       │   │   ├── conversation-context.ts    # 会话上下文管理
│       │   │   └── state-sync.ts              # 状态同步逻辑
│       │   ├── db/
│       │   │   └── migrations/
│       │   │       └── 20260304-state-sharing.ts  # 数据库迁移
│       │   └── integration/
│       │       ├── automaton-bridge.ts        # Automaton 桥接层
│       │       └── state-middleware.ts        # 状态中间件
│       ├── types/
│       │   └── integration.ts                 # 集成相关类型
│       └── __tests__/
│           ├── integration/
│           │   └── state-sharing.test.ts      # 集成测试
│           └── context/
│               └── conversation-context.test.ts
└── docs/
    └── integration-state-sharing.md           # 状态共享文档
```

**命名规范：**
- 所有文件使用 kebab-case
- 类使用 PascalCase
- 函数使用 camelCase
- 常量使用 SCREAMING_SNAKE
- 接口和类型使用 PascalCase（不带 I 前缀）

### 与现有系统的兼容性

**TinyClaw 现有功能：**
- ✅ 消息队列处理器（需添加状态同步回调）
- ✅ 团队管理和 Agent 路由（需添加框架标识）
- ✅ 会话状态管理（需扩展状态机）
- ✅ 数据库表结构（需添加新字段）

**Automaton 现有功能：**
- ✅ ReAct 循环（需添加状态同步钩子）
- ✅ 编排引擎（需添加 TinyClaw 集成点）
- ✅ 策略引擎（无需修改）
- ✅ 记忆系统（需添加跨框架上下文支持）

### 部署考虑

**数据库迁移：**
```bash
# 运行迁移脚本
cd tinyclaw
npm run db:migrate 20260304-state-sharing
```

**向后兼容性：**
- 新字段都有默认值
- 旧代码不受影响
- 支持增量部署

**监控指标：**
- 状态同步成功率
- 状态同步延迟
- 并发冲突次数
- 状态快照大小

### 参考资料

- [Source: docs/integration-architecture.md#潜在集成场景] - 混合架构设计
- [Source: docs/integration-architecture.md#共享基础设施模式] - 数据库和配置共享
- [Source: docs/upwork_autopilot_detailed_design.md#核心业务流程时序图] - 业务流程定义
- [Source: docs/upwork_autopilot_detailed_design.md#数据库表设计] - 数据库设计
- [Source: docs/project-context.md#数据库规则] - 数据库约束和最佳实践
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3b] - Epic 详细需求

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (with BMAD create-story workflow)

### Debug Log References

- Workflow execution: create-story workflow
- Input files: docs/integration-architecture.md, docs/project-context.md, docs/upwork_autopilot_detailed_design.md
- Configuration: _bmad/bmm/config.yaml

### Completion Notes List

1. ✅ 完成用户故事和验收标准定义
2. ✅ 完成任务分解和子任务规划
3. ✅ 完成技术架构分析和设计
4. ✅ 完成数据库表结构扩展设计
5. ✅ 完成状态机映射设计
6. ✅ 完成数据模型定义
7. ✅ 完成测试策略规划
8. ✅ 完成项目结构规划
9. ✅ 完成技术约束和要求定义
10. ✅ 添加完整的参考资料

### File List

- **新创建：**
  - `tinyclaw/src/lib/context/conversation-context.ts`
  - `tinyclaw/src/lib/context/state-sync.ts`
  - `tinyclaw/src/lib/db/migrations/20260304-state-sharing.ts`
  - `tinyclaw/src/lib/integration/automaton-bridge.ts`
  - `tinyclaw/src/lib/integration/state-middleware.ts`
  - `tinyclaw/src/types/integration.ts`
  - `tinyclaw/src/__tests__/integration/state-sharing.test.ts`
  - `tinyclaw/src/__tests__/context/conversation-context.test.ts`
  - `docs/integration-state-sharing.md`

- **修改：**
  - `tinyclaw/src/lib/db.ts` (数据库迁移注册)
  - `tinyclaw/src/lib/queue-processor.ts` (添加状态同步回调)
  - `tinyclaw/src/lib/routing.ts` (添加框架标识支持)

**状态：** ready-for-dev - 完整的故事上下文已创建，开发者现在拥有实现所需的所有信息！

---

**故事完成时间：** 2026-03-04
**状态：** ready-for-dev
**下一步：** 运行 `dev-story` 工作流进行实现
