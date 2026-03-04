# Story 3b.1: Automaton 作为 TinyClaw 专用智能体

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TinyClaw 开发者**,
I want **将 Conway Automaton 作为一个专用智能体注册到 TinyClaw 系统中**,
so that **TinyClaw 的其他智能体可以通过 @mention 机制调用 Automaton 的强大能力 (自修改、多层记忆、链上交互)**.

## Acceptance Criteria

1. **AC1: Automaton 客户端集成**
   - [ ] 在 TinyClaw 中创建 `automaton-client` 模块
   - [ ] 实现 HTTP/HTTPS API 调用封装
   - [ ] 支持同步和异步两种调用模式
   - [ ] 包含完整的错误处理和重试机制

2. **AC2: 智能体注册与配置**
   - [ ] 创建 `@automaton` 专用智能体配置
   - [ ] 集成到 TinyClaw 的 agent 系统
   - [ ] 支持环境变量配置 Automaton API 地址
   - [ ] 实现健康检查机制

3. **AC3: 消息路由集成**
   - [ ] 扩展 `parseAgentRouting` 函数支持 `@automaton` 标签
   - [ ] 消息格式正确转换和传递
   - [ ] 支持上下文传递和隔离
   - [ ] 实现超时和取消机制

4. **AC4: 功能测试**
   - [ ] 编写单元测试覆盖主要功能
   - [ ] 编写集成测试验证端到端流程
   - [ ] 手动测试通过 Discord/Telegram 渠道
   - [ ] 性能测试确保响应时间符合预期

5. **AC5: 文档和示例**
   - [ ] 更新 README.md 说明使用方法
   - [ ] 提供代码示例和最佳实践
   - [ ] 记录 API 参数和返回值
   - [ ] 包含故障排查指南

## Tasks / Subtasks

### Task 1: 设计和规划 (AC: #1, #2)
- [ ] 阅读相关文档 (`docs/integration-architecture.md`, `docs/upwork_autopilot_detailed_design.md`)
- [ ] 设计 `automaton-client` API 接口
- [ ] 确定消息格式和协议
- [ ] 设计错误处理策略
- [ ] 创建技术设计文档 (可选)

### Task 2: Automaton Client 实现 (AC: #1)
- [ ] 创建 `tinyclaw/src/lib/automaton-client/` 目录
- [ ] 实现基础 HTTP 客户端 (`client.ts`)
- [ ] 实现消息发送接口 (`sendMessage.ts`)
- [ ] 实现状态查询接口 (`getStatus.ts`)
- [ ] 实现工具调用接口 (`invokeTool.ts`)
- [ ] 添加重试和超时逻辑
- [ ] 添加完整的类型定义
- [ ] 编写单元测试

### Task 3: 智能体集成 (AC: #2)
- [ ] 创建 `tinyclaw/agents/automaton.json` 配置文件
- [ ] 实现 Automaton Agent 主文件 (`tinyclaw/src/lib/automaton-agent/index.ts`)
- [ ] 集成到 TinyClaw agent 系统 (`tinyclaw/src/lib/agent.ts`)
- [ ] 添加环境变量支持 (`.env.example` 更新)
- [ ] 实现健康检查端点
- [ ] 编写集成测试

### Task 4: 路由扩展 (AC: #3)
- [ ] 修改 `tinyclaw/src/lib/routing.ts` 的 `parseAgentRouting` 函数
- [ ] 添加 `@automaton` 特殊处理逻辑
- [ ] 实现消息格式转换
- [ ] 实现上下文传递机制
- [ ] 添加超时和取消支持
- [ ] 编写路由测试

### Task 5: 错误处理和日志 (AC: #1, #3)
- [ ] 实现统一的错误类型定义
- [ ] 添加详细的日志记录
- [ ] 实现错误重试策略
- [ ] 添加监控指标 (可选)
- [ ] 编写错误处理测试

### Task 6: 测试和验证 (AC: #4)
- [ ] 编写单元测试 (`tinyclaw/src/lib/automaton-client/__tests__`)
- [ ] 编写集成测试 (`tinyclaw/src/__tests__/integration/automaton.spec.ts`)
- [ ] 手动测试通过 Discord 渠道
- [ ] 验证所有 AC 完成
- [ ] 性能基准测试

### Task 7: 文档编写 (AC: #5)
- [ ] 更新 `tinyclaw/README.md`
- [ ] 创建 `tinyclaw/docs/automaton-integration.md`
- [ ] 添加代码示例
- [ ] 更新 API 文档
- [ ] 创建故障排查指南

## Dev Notes

### Architecture Patterns and Constraints

#### 1. 双框架深度解析 (基于 upwork_autopilot_detailed_design.md)

**Automaton 核心架构 (主权 AI Agent 运行时)**:
- **守护进程 (heartbeat/daemon.ts)**: 维持心跳，抛出唤醒事件，基于 ReAct 模式管理状态机 (waking → running → sleeping → critical → dead)
- **编排引擎 (orchestration/orchestrator.ts)**: 维护七步状态机 (classifying/planning/executing/replanning)，通过 `planGoal` 自动分解大目标为 TaskNode 子任务树
- **经济决策 (SpendTracker)**: 追踪所有工具调用成本，资金不足时自动将 USDC 闪兑为 Credits
- **Web4 链上交互 (conway/client.ts)**: 将代理钱包地址及 `genesisPromptHash` 固化至 ERC-8004 Registry

**TinyClaw 核心架构 (多智能体协同系统)**:
- **事务强一致性消息队列 (lib/db.ts)**: SQLite WAL 模式 + `BEGIN IMMEDIATE` 独占事务锁定
- **并行协程锁链 (queue-processor.ts)**: 维护 `Map<string, Promise<void>>`，同一 Agent 消息绝对串行
- **@mention 路由 (lib/routing.ts)**: 通过正则提取 `[@teammate: message]` 标签实现 Agent 互相呼叫
- **插件钩子 (runIncomingHooks/runOutgoingHooks)**: 消息推给大模型前后的数据清洗拦截器

**双脑控制模式**:
- **前台 (TinyClaw)**: 消息路由、会话状态管理、速率限制、Scrubbing Hook
- **后台 (Automaton)**: Task Graph、全局预算、Policy Engine、Sandbox Manager、EVM Wallet

#### 2. 集成场景 (基于 integration-architecture.md 第 108-140 行)

**场景 1：将 Automaton 作为 TinyClaw 智能体**:
```text
用户 → TinyClaw 渠道 → 队列 → @automaton-agent
                                        ↓
                                Conway Automaton API
                                        ↓
                                TinyClaw 响应队列
                                        ↓
                                       用户
```

**优势**:
- 利用 Automaton 先进的记忆系统
- 使用自修改实现智能体进化
- 应用策略引擎确保安全
- 共享 Conway 计费集成

#### 3. 消息路由机制 (基于 tinyclaw/src/lib/routing.ts)

现有路由逻辑支持：
- `@agent_id` - 路由到指定智能体
- `@team_id` - 路由到团队负责人
- `@agent_name` (case-insensitive) - 按名称匹配
- `@team_name` (case-insensitive) - 按团队名称匹配

需要扩展支持：
- `@automaton` - 特殊智能体，调用外部 API

#### 4. 技术约束

**编程语言**: TypeScript (ESM for Automaton, CommonJS for TinyClaw)
**HTTP 客户端**: 使用原生 `fetch` API 或 `axios`
**错误处理**: 使用自定义 Error 类
**日志系统**: 使用现有的 `tinyclaw/src/lib/logging.ts`
**配置管理**: 通过环境变量和 JSON 配置文件

### Source Tree Components to Touch

#### 新增文件/目录
```
tinyclaw/
├── src/
│   ├── lib/
│   │   ├── automaton-client/          # 新目录 - Automaton 客户端
│   │   │   ├── index.ts              # 导出模块
│   │   │   ├── client.ts             # HTTP 客户端实现
│   │   │   ├── types.ts              # TypeScript 类型定义
│   │   │   ├── errors.ts             # 自定义错误类
│   │   │   └── __tests__/            # 单元测试
│   │   │       └── client.test.ts
│   │   │
│   │   ├── automaton-agent/           # 新目录 - Automaton Agent 实现
│   │   │   ├── index.ts              # Agent 主文件
│   │   │   ├── config.ts             # Agent 配置
│   │   │   └── __tests__/            # Agent 测试
│   │   │       └── agent.test.ts
│   │   │
│   │   └── state-sync.ts             # (可选) 状态同步工具
│   │
│   └── __tests__/
│       └── integration/
│           └── automaton.spec.ts     # 集成测试
│
├── agents/
│   └── automaton.json                # Automaton Agent 配置
│
├── docs/
│   └── automaton-integration.md      # 集成文档
│
└── .env.example                      # 环境变量模板 (更新)
```

#### 修改现有文件
```
tinyclaw/
├── src/
│   ├── lib/
│   │   ├── routing.ts                # 扩展 parseAgentRouting
│   │   ├── agent.ts                  # 集成 Automaton Agent
│   │   └── config.ts                 # 添加 Automaton 配置支持
│   │
│   └── queue-processor.ts            # 可能需要调整错误处理
│
├── package.json                      # 添加依赖 (如有)
└── README.md                         # 更新文档
```

### Testing Standards Summary

#### 单元测试 (vitest)
- 覆盖率目标: >= 80%
- 测试文件位置: `__tests__` 目录
- 测试命名: `*.test.ts`
- Mock 外部依赖: 使用 `vi.mock()`

#### 集成测试
- 端到端流程测试
- 模拟 Automaton API 响应
- 验证消息路由正确性
- 测试错误场景

#### 手动测试
- 通过 Discord/Telegram 发送 `@automaton: test message`
- 验证响应正确返回
- 测试超时和错误场景
- 验证日志输出

### Implementation Examples

#### Automaton Client API Design
```typescript
// tinyclaw/src/lib/automaton-client/client.ts

export interface AutomatonConfig {
  baseUrl: string;           // Automaton API 地址 (e.g., "http://localhost:3001")
  apiKey?: string;           // API 密钥 (可选)
  timeout?: number;          // 超时时间 (毫秒, 默认 30000)
  maxRetries?: number;       // 最大重试次数 (默认 3)
}

export interface SendMessageRequest {
  conversationId: string;    // 会话 ID
  message: string;           // 消息内容
  context?: Record<string, any>; // 上下文数据
  timeout?: number;          // 单次请求超时
}

export interface SendMessageResponse {
  success: boolean;
  response?: string;         // Automaton 的响应
  conversationId: string;    // 会话 ID
  timestamp: number;         // 时间戳
  metadata?: Record<string, any>; // 元数据
}

export class AutomatonClient {
  private config: AutomatonConfig;

  constructor(config: AutomatonConfig) {
    this.config = config;
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    // 实现 HTTP 调用
    // 包含重试和超时逻辑
  }

  async getStatus(): Promise<{ healthy: boolean; version?: string }> {
    // 健康检查
  }

  async invokeTool(toolName: string, params: any): Promise<any> {
    // 调用 Automaton 工具
  }
}
```

#### Automaton Agent Implementation
```typescript
// tinyclaw/src/lib/automaton-agent/index.ts

import { Agent, AgentResponse } from '../types';
import { AutomatonClient } from '../automaton-client';
import { log } from '../logging';

export class AutomatonAgent implements Agent {
  private client: AutomatonClient;
  private conversationId: string;

  constructor(config: any) {
    this.client = new AutomatonClient({
      baseUrl: config.baseUrl || process.env.AUTOMATON_API_URL || 'http://localhost:3001',
      apiKey: config.apiKey || process.env.AUTOMATON_API_KEY,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
    });
    this.conversationId = `tinyclaw-${Date.now()}`;
  }

  async process(message: string, context?: any): Promise<AgentResponse> {
    try {
      log('INFO', `AutomatonAgent: Sending message to Automaton: ${message.substring(0, 50)}...`);

      const response = await this.client.sendMessage({
        conversationId: this.conversationId,
        message,
        context,
      });

      log('INFO', `AutomatonAgent: Received response (${response.response?.length || 0} chars)`);

      return {
        text: response.response || 'No response from Automaton',
        metadata: response.metadata,
      };
    } catch (error) {
      log('ERROR', `AutomatonAgent error: ${(error as Error).message}`);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const status = await this.client.getStatus();
      return status.healthy;
    } catch {
      return false;
    }
  }
}
```

#### Routing Extension
```typescript
// tinyclaw/src/lib/routing.ts (扩展)

export function parseAgentRouting(
  rawMessage: string,
  agents: Record<string, AgentConfig>,
  teams: Record<string, TeamConfig> = {}
): { agentId: string; message: string; isTeam?: boolean; isAutomaton?: boolean } {
  // 匹配 @agent_id, @team_id 或 @automaton
  const match = rawMessage.match(/^(\[[^\]]*\]:\s*)?@(\S+)\s+([\s\S]*)$/);
  if (match) {
    const prefix = match[1] || '';
    const candidateId = match[2].toLowerCase();
    const message = prefix + match[3];

    // 特殊处理 @automaton
    if (candidateId === 'automaton') {
      return { agentId: 'automaton', message, isAutomaton: true };
    }

    // 检查 agent IDs
    if (agents[candidateId]) {
      return { agentId: candidateId, message };
    }

    // 检查 team IDs
    if (teams[candidateId]) {
      return { agentId: teams[candidateId].leader_agent, message, isTeam: true };
    }

    // ... 其他匹配逻辑
  }

  return { agentId: 'default', message: rawMessage };
}
```

### Project Structure Notes

#### Alignment with Unified Project Structure

**目录结构一致性**:
- 遵循现有 `tinyclaw/src/lib/` 模块化结构
- 使用一致的命名约定 (kebab-case for directories, camelCase for files)
- 遵循 TypeScript 最佳实践

**模块边界**:
- `automaton-client`: 纯客户端逻辑，无业务逻辑
- `automaton-agent`: Agent 业务逻辑，依赖 client
- 保持低耦合，便于测试和维护

#### Potential Conflicts or Variances

**ESM vs CommonJS**:
- Automaton 使用 ESM (import/export)
- TinyClaw 使用 CommonJS (require/module.exports)
- **解决方案**: 客户端使用 CommonJS 语法，或使用 TypeScript 编译器处理

**TypeScript 配置**:
- 确保 `tsconfig.json` 配置兼容
- 可能需要调整 `moduleResolution` 和 `esModuleInterop`

**依赖管理**:
- 避免重复依赖
- 优先使用 TinyClaw 现有依赖

### References

**技术文档**:
- [integration-architecture.md](../../../docs/integration-architecture.md#L108-L140) - 潜在集成场景 (场景 1)
- [upwork_autopilot_detailed_design.md](../../../docs/upwork_autopilot_detailed_design.md#L24-L101) - 双框架深度解析
- [tinyclaw/src/lib/routing.ts](../src/lib/routing.ts) - 现有路由实现

**代码参考**:
- [tinyclaw/src/lib/agent.ts](../src/lib/agent.ts) - Agent 接口定义
- [tinyclaw/src/queue-processor.ts](../src/queue-processor.ts) - 队列处理逻辑
- [tinyclaw/src/lib/config.ts](../src/lib/config.ts) - 配置管理
- [automaton/src/agent/loop.ts](../../automaton/src/agent/loop.ts) - Automaton Agent 循环

**外部资源**:
- [Fetch API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) - HTTP 客户端
- [Vitest Documentation](https://vitest.dev/) - 测试框架
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/) - TypeScript 最佳实践

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (via Claude Code CLI)

### Debug Log References

- 工作流程执行日志: 查看本文件创建过程
- 代码探索日志: 参考相关文件读取记录
- 设计决策日志: 见 Dev Notes 部分

### Completion Notes List

1. **故事上下文完整性**:
   - ✓ 包含完整的双框架架构解析
   - ✓ 包含详细的集成方案设计
   - ✓ 包含具体的技术实现示例
   - ✓ 包含完整的测试策略

2. **关键依赖识别**:
   - ✓ 识别了 ESM/CommonJS 模块系统差异
   - ✓ 识别了配置管理和环境变量需求
   - ✓ 识别了错误处理和日志系统集成

3. **潜在风险提示**:
   - ⚠️ API 版本兼容性需要特别注意
   - ⚠️ 跨框架调用可能引入性能瓶颈
   - ⚠️ 需要完善的错误处理和重试机制

4. **下一步建议**:
   - 在开始编码前，先运行 Automaton 和 TinyClaw 确认 API 端点
   - 建议先实现简单的 ping/health-check 接口进行测试
   - 考虑使用 Postman 或 curl 手动测试 Automaton API

### File List

#### 需要创建的文件
1. `tinyclaw/src/lib/automaton-client/index.ts`
2. `tinyclaw/src/lib/automaton-client/client.ts`
3. `tinyclaw/src/lib/automaton-client/types.ts`
4. `tinyclaw/src/lib/automaton-client/errors.ts`
5. `tinyclaw/src/lib/automaton-client/__tests__/client.test.ts`
6. `tinyclaw/src/lib/automaton-agent/index.ts`
7. `tinyclaw/src/lib/automaton-agent/config.ts`
8. `tinyclaw/src/lib/automaton-agent/__tests__/agent.test.ts`
9. `tinyclaw/src/__tests__/integration/automaton.spec.ts`
10. `tinyclaw/agents/automaton.json`
11. `tinyclaw/docs/automaton-integration.md`

#### 需要修改的文件
1. `tinyclaw/src/lib/routing.ts` - 扩展 parseAgentRouting
2. `tinyclaw/src/lib/agent.ts` - 集成 Automaton Agent
3. `tinyclaw/src/lib/config.ts` - 添加 Automaton 配置支持
4. `tinyclaw/package.json` - 添加依赖和脚本
5. `tinyclaw/.env.example` - 添加环境变量示例
6. `tinyclaw/README.md` - 更新文档

#### 可选文件
1. `tinyclaw/src/lib/state-sync.ts` - 状态同步工具
2. `tinyclaw/src/lib/automaton-client/utils.ts` - 工具函数

---

**故事创建时间**: 2026-03-04
**创建者**: BMAD Create-Story Workflow
**基于 Epic**: Epic 3b - 混合架构实施
**状态**: ready-for-dev
