# 故事 1c.3: 团队协作框架 (与TinyClaw对齐)

状态: ready-for-dev

<!-- 注意: 验证是可选的。在 dev-story 之前运行 validate-create-story 进行质量检查。 -->

## 故事

作为 Automaton 开发者，
我想要实现一个与 TinyClaw 对齐的团队协作框架，
以便多个智能体能够协同工作完成复杂任务。

## 验收标准

1. **多智能体注册表功能**
   - 能够注册、发现和管理多个智能体实例
   - 支持智能体元数据存储（能力、角色、状态）
   - 提供智能体健康检查和状态监控

2. **智能体间通信协议**
   - 实现基于消息传递的通信机制
   - 支持同步和异步消息模式
   - 与 TinyClaw 的 `[@teammate: message]` 语法对齐
   - 支持消息路由和过滤

3. **团队编排与协作**
   - 支持团队定义和成员管理
   - 实现团队会话状态管理
   - 提供任务分配和进度追踪
   - 支持领导智能体协调机制

4. **与 TinyClaw 集成**
   - 复用 TinyClaw 的团队编排逻辑（`src/lib/routing.ts`）
   - 保持与 TinyClaw 相同的消息格式和路由规则
   - 支持从 TinyClaw 接收和发送团队消息

5. **错误处理和恢复**
   - 实现智能体失败检测和恢复机制
   - 提供团队会话超时和重试逻辑
   - 记录详细的协作审计日志

## 任务 / 子任务

- [ ] 任务 1: 设计多智能体注册表架构 (AC: 1)
  - [ ] 子任务 1.1: 定义智能体元数据模式
  - [ ] 子任务 1.2: 实现注册表 CRUD 操作
  - [ ] 子任务 1.3: 添加健康检查端点

- [ ] 任务 2: 实现智能体通信协议 (AC: 2)
  - [ ] 子任务 2.1: 设计消息格式和路由逻辑
  - [ ] 子任务 2.2: 实现消息队列和分发机制
  - [ ] 子任务 2.3: 添加消息过滤和优先级

- [ ] 任务 3: 团队编排引擎 (AC: 3)
  - [ ] 子任务 3.1: 实现团队定义和成员管理
  - [ ] 子任务 3.2: 添加会话状态追踪
  - [ ] 子任务 3.3: 实现领导智能体选举

- [ ] 任务 4: TinyClaw 集成 (AC: 4)
  - [ ] 子任务 4.1: 分析 TinyClaw 团队架构
  - [ ] 子任务 4.2: 实现消息格式转换
  - [ ] 子任务 4.3: 添加双向通信桥接

- [ ] 任务 5: 错误处理和监控 (AC: 5)
  - [ ] 子任务 5.1: 实现失败检测机制
  - [ ] 子任务 5.2: 添加会话超时和重试
  - [ ] 子任务 5.3: 实现审计日志记录

## 开发者备注

### 架构模式对齐

根据 `docs/epics.md` 中的描述，此故事需要实现与 TinyClaw 对齐的团队协作框架：

**TinyClaw 团队编排核心机制**（参考 `docs/architecture-tinyclaw.md`）:
- **队列处理器**: 消息路由和管理
- **团队管理器**: 解析 `[@teammate: message]` 形式的提及
- **会话隔离**: 每个智能体独立的工作目录
- **内部消息传递**: 智能体可通过队列系统相互发送消息

**Automaton 团队协作目标**:
- 复用 TinyClaw 的团队编排逻辑
- 保持相同的提及语法和路由规则
- 支持多智能体协同完成复杂任务

### 技术要求

#### 1. 多智能体注册表

参考 TinyClaw 的团队定义表结构（`docs/architecture-tinyclaw.md`）:

```typescript
interface AgentRegistry {
  agentId: string;              // 智能体唯一标识
  name: string;                 // 智能体名称
  role: string;                 // 角色 (leader/support/technical)
  capabilities: string[];       // 能力列表
  provider: string;             // LLM 供应商
  model: string;                // 使用的模型
  systemPrompt: string;         // 系统提示词
  workingDir: string;           // 工作目录
  status: 'active' | 'inactive' | 'error';  // 状态
  lastHeartbeat: number;        // 最后心跳时间
  metadata: Record<string, any>; // 额外元数据
}
```

数据库表设计（SQLite）:

```sql
CREATE TABLE agent_registry (
  agent_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  capabilities JSON NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  system_prompt TEXT,
  working_dir TEXT,
  status TEXT DEFAULT 'active',
  last_heartbeat INTEGER,
  metadata JSON,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

#### 2. 通信协议对齐

**与 TinyClaw 的 `[@teammate: message]` 语法对齐**:

```typescript
// 解析提及的正则表达式
const TEAMMATE_MENTION_REGEX = /\[@([^\]]+): ([^\]]+)\]/g;

interface TeamMessage {
  fromAgent: string;           // 发送方智能体ID
  toAgent: string;             // 接收方智能体ID
  message: string;             // 消息内容
  conversationId: string;      // 会话ID
  timestamp: number;           // 时间戳
  priority: 'high' | 'normal' | 'low';  // 优先级
}
```

**消息路由逻辑**（复用 TinyClaw 的 `parseAgentRouting`）:

```typescript
// src/agent/team/routing.ts
export function parseAgentRouting(message: string): {
  targetAgent?: string;
  teamName?: string;
  isTeamMessage: boolean;
} {
  // 检查 @agent_id 前缀
  // 检查 @team_name 前缀
  // 检查 [@teammate: ...] 形式的提及
}
```

#### 3. 团队会话管理

参考 TinyClaw 的团队会话流程（`docs/architecture-tinyclaw.md`）:

```
1. 初始消息: 用户发送 "[@team-support: How to reset password?]"
2. 路由: 消息路由到团队领导 (leader_agent)
3. 提及解析: 领导提及队友 "[@agent-technical: Can you explain steps?]"
4. 内部消息: 系统为技术智能体创建内部消息
5. 响应: 技术智能体回复领导
6. 协作: 领导聚合回复并答复用户
7. 完成: 所有提及相关操作解决后，会话完成
```

**会话状态机**:

```typescript
type ConversationState =
  | 'discovered'      // 初始状态
  | 'negotiating'     // 协商中
  | 'signed'          // 已签约
  | 'developing'      // 开发中
  | 'testing'         // 测试中
  | 'deployed';       // 已部署

interface Conversation {
  conversationId: string;
  teamId: string;
  leaderAgent: string;
  pendingTeammates: Set<string>;  // 待响应队友
  state: ConversationState;
  messages: TeamMessage[];
  createdAt: number;
  updatedAt: number;
}
```

#### 4. 与 TinyClaw 集成点

**复用的 TinyClaw 组件**:

1. **路由逻辑**: `tinyclaw/src/lib/routing.ts`
   - `parseAgentRouting()`
   - `findTeamForAgent()`
   - `extractTeammateMentions()`

2. **会话管理**: `tinyclaw/src/lib/conversation.ts`
   - 会话状态追踪
   - 待处理队友管理

3. **消息队列**: `tinyclaw/src/lib/db.ts`
   - `claimNextMessage()`
   - `completeMessage()`
   - `enqueueInternalMessage()`

**集成桥接层**:

```typescript
// automaton/src/agent/team/tinyclaw-bridge.ts
export class TinyClawBridge {
  // 将 TinyClaw 消息格式转换为 Automaton 格式
  convertMessage(tinyclawMessage: any): TeamMessage { ... }

  // 将 Automaton 响应发送回 TinyClaw
  sendResponse(response: any, target: string): Promise<void> { ... }

  // 同步团队定义
  syncTeams(): Promise<void> { ... }
}
```

### 文件结构要求

按照现有项目结构组织代码：

```
automaton/src/agent/team/
├── index.ts                    # 公共导出
├── types.ts                    # 团队协作类型定义
├── registry.ts                 # 智能体注册表
├── routing.ts                  # 消息路由（对齐 TinyClaw）
├── conversation.ts             # 会话管理
├── orchestrator.ts             # 编排引擎
├── tinyclaw-bridge.ts          # TinyClaw 集成桥接
└── __tests__/
    ├── registry.test.ts
    ├── routing.test.ts
    ├── conversation.test.ts
    └── orchestrator.test.ts
```

### 依赖关系

#### 外部依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| better-sqlite3 | 11.0.0 | 智能体注册表数据库 |

#### 内部依赖

- `src/agent/loop.ts` - 智能体循环
- `src/memory/working.ts` - 工作记忆
- `src/state/database.ts` - 数据库层

#### 复用 TinyClaw 代码

需要从 `tinyclaw/src/lib/` 复用以下逻辑：
- `routing.ts` - 路由解析
- `conversation.ts` - 会话管理
- `db.ts` - 消息队列操作

### 测试要求

#### 单元测试覆盖

- `registry.test.ts`: 智能体注册、查询、更新、删除
- `routing.test.ts`: 消息解析、路由决策
- `conversation.test.ts`: 会话生命周期管理
- `orchestrator.test.ts`: 团队编排逻辑

#### 集成测试

- 多智能体协作场景
- 消息路由和分发
- 团队会话完整流程
- TinyClaw 集成测试

#### 测试数据

```typescript
// src/agent/team/__tests__/mocks.ts
export const mockAgents = [
  {
    agentId: 'agent-leader',
    name: 'Team Leader',
    role: 'leader',
    capabilities: ['orchestration', 'coordination'],
    provider: 'claude',
    model: 'claude-3-opus',
    status: 'active'
  },
  {
    agentId: 'agent-technical',
    name: 'Technical Expert',
    role: 'support',
    capabilities: ['coding', 'debugging'],
    provider: 'claude',
    model: 'claude-3-opus',
    status: 'active'
  }
];

export const mockTeam = {
  teamId: 'team-support',
  name: 'Support Team',
  leaderAgent: 'agent-leader',
  agents: ['agent-leader', 'agent-technical'],
  description: 'Customer support team'
};
```

### 性能考虑

1. **消息队列优化**
   - 使用 SQLite WAL 模式提高并发性能
   - 实现消息批处理减少数据库操作
   - 添加消息优先级队列

2. **智能体状态缓存**
   - 缓存智能体注册表数据（TTL: 5分钟）
   - 使用内存缓存减少数据库查询
   - 实现缓存失效策略

3. **会话状态管理**
   - 定期清理过期会话（24小时）
   - 实现会话状态压缩
   - 使用连接池管理数据库连接

### 安全考虑

1. **消息验证**
   - 验证所有消息的来源和目标
   - 防止消息注入攻击
   - 实现消息签名验证

2. **权限控制**
   - 智能体只能访问自己的工作目录
   - 领导智能体有额外的协调权限
   - 实现基于角色的访问控制（RBAC）

3. **审计日志**
   - 记录所有团队消息
   - 追踪智能体状态变更
   - 记录会话生命周期事件

### 与现有代码的集成

#### Agent Loop 集成

修改 `src/agent/loop.ts` 以支持团队协作：

```typescript
// src/agent/loop.ts
import { TeamOrchestrator } from './team/orchestrator.ts';

export async function runAgentLoop(options: AgentLoopOptions) {
  const orchestrator = new TeamOrchestrator();

  while (true) {
    // 检查是否有团队消息
    const teamMessage = await orchestrator.checkTeamMessages(agentId);
    if (teamMessage) {
      // 处理团队消息
      await handleTeamMessage(teamMessage);
      continue;
    }

    // 正常的 ReAct 循环
    // ...
  }
}
```

#### 工具集成

添加团队协作相关的工具：

```typescript
// src/agent/tools.ts
export const teamTools = {
  '@mention': {
    description: '提及队友并发送消息',
    parameters: {
      teammate: { type: 'string', description: '队友智能体ID' },
      message: { type: 'string', description: '消息内容' }
    },
    execute: async (params) => {
      // 创建内部消息
      await createInternalMessage(params.teammate, params.message);
    }
  },
  'getTeamStatus': {
    description: '获取团队当前状态',
    parameters: {},
    execute: async () => {
      return await getTeamStatus();
    }
  }
};
```

### 配置文件

```json
// automaton/config/team.json
{
  "enabled": true,
  "defaultTeam": "team-general",
  "messageQueue": {
    "maxSize": 1000,
    "ttl": 3600
  },
  "conversationTimeout": 3600,
  "heartbeatInterval": 300
}
```

### 参考文档

- [TinyClaw 架构指南](docs/architecture-tinyclaw.md#team-orchestration) - 团队编排实现
- [Automaton 架构指南](docs/architecture-automaton.md) - 智能体循环和记忆系统
- [Epic 1c 详细设计](docs/epics.md#epic-1c-智能体编排与团队) - 团队协作框架需求
- [项目上下文](docs/project-context.md) - 技术栈和开发规范

### 已完成相关故事

此故事依赖以下已完成的故事（如果有）：
- 1c.1: 多智能体注册表（如果已完成）
- 1c.2: 智能体间通信协议（如果已完成）

### 风险和缓解措施

| 风险 | 缓解措施 |
|------|----------|
| 与 TinyClaw 架构不兼容 | 详细分析 TinyClaw 代码，确保完全对齐 |
| 消息丢失或重复 | 实现事务性消息队列和幂等处理 |
| 智能体死锁 | 添加超时机制和死锁检测 |
| 性能瓶颈 | 实现缓存和批处理优化 |

## 开发者记录

### 使用的 Agent 模型

Claude Opus 4.6

### 调试日志引用

待添加

### 完成备注列表

待添加

### 文件列表

待添加
