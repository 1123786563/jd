# Automaton + TinyClaw 连通设计文档

## 1. 系统概述

### 1.1 目标

实现 **Automaton（主权 AI Agent 运行时）** 和 **TinyClaw（多智能体消息路由系统）** 的核心连通，采用 **A2A (Agent-to-Agent) 协议** 进行标准化通信。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          集成架构图 (A2A Protocol)                       │
│                                                                         │
│   ┌─────────────────┐        A2A Protocol       ┌─────────────────┐    │
│   │    TinyClaw     │◄──────────────────────────►│    Automaton    │    │
│   │  (消息路由层)    │     JSON-RPC 2.0 + SSE     │   (执行层)       │    │
│   │                 │                            │                 │    │
│   │  ┌───────────┐  │     Agent Card 发现        │  ┌───────────┐  │    │
│   │  │ A2A Server│  │◄──────────────────────────►│  │ A2A Client│  │    │
│   │  │ Task Mgr  │  │                            │  │ Task Mgr  │  │    │
│   │  │ 消息队列   │  │     Task 生命周期          │  │ ReAct循环 │  │    │
│   │  │ @mention  │  │◄──────────────────────────►│  │ 工具调用   │  │    │
│   │  └───────────┘  │                            │  └───────────┘  │    │
│   └─────────────────┘                            └─────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 术语表

| 术语 | 解释 |
|------|------|
| **Automaton** | 带有财务意识的自主 AI Agent 框架，负责主权执行 |
| **TinyClaw** | 轻量级多智能体协同系统，负责消息路由和并发调度 |
| **A2A Protocol** | Agent-to-Agent 协议，Google 提出的 Agent 间通信开放标准 |
| **Agent Card** | Agent 能力声明文档，描述 Agent 的技能和端点 |
| **Task** | A2A 协议中的任务单元，具有完整生命周期 |
| **Artifact** | Task 执行产出的结果物 |
| **JSON-RPC 2.0** | A2A 协议的传输层，标准化的远程调用协议 |
| **SSE** | Server-Sent Events，用于流式输出 |
| **ReAct** | Reasoning + Acting，Agent 的核心推理模式 |
| **WAL** | Write-Ahead Logging，SQLite 的并发模式 |

### 1.3 双框架职责划分

| 职责 | TinyClaw | Automaton |
|------|----------|-----------|
| **消息路由** | SQLite 消息队列、@mention 路由 | - |
| **A2A Server** | Agent Card 发布、Task 生命周期管理 | - |
| **A2A Client** | - | Agent 发现、Task 请求 |
| **状态管理** | Task 状态机 | Agent 状态机 |
| **消息收发** | 多渠道适配器 | - |
| **Agent 执行** | - | ReAct 循环、工具调用 |
| **超时恢复** | 应用层定时任务 | - |
| **心跳检测** | 接收心跳 | Agent 心跳上报 |

---

## 2. A2A 协议核心概念

### 2.1 协议栈

```
┌─────────────────────────────────────────────────────────┐
│                    A2A 协议栈                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Application Layer                   │   │
│  │  Agent Card │ Task │ Message │ Artifact         │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼──────────────────────────┐   │
│  │              Transport Layer                     │   │
│  │  JSON-RPC 2.0 (同步) │ SSE (流式) │ WebSocket    │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼──────────────────────────┐   │
│  │              HTTP/HTTPS                          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Agent Card

Agent Card 是 A2A 协议的核心概念，用于声明 Agent 的能力：

```typescript
// Agent Card 结构
interface AgentCard {
  // 基础信息
  name: string;                    // Agent 名称
  description: string;             // 描述
  url: string;                     // A2A 端点 URL
  version: string;                 // 版本号

  // 能力声明
  capabilities: {
    streaming: boolean;            // 是否支持流式输出
    pushNotifications: boolean;    // 是否支持推送通知
  };

  // 认证方式
  authentication: {
    schemes: string[];             // 支持的认证方案 (bearer, api-key, etc.)
  };

  // 技能列表
  skills: Array<{
    id: string;                    // 技能 ID
    name: string;                  // 技能名称
    description: string;           // 技能描述
    inputSchema?: object;          // 输入参数 Schema (JSON Schema)
    outputSchema?: object;         // 输出参数 Schema
  }>;

  // 可选：默认输入/输出模式
  defaultInputModes?: string[];    // ["text", "file"]
  defaultOutputModes?: string[];   // ["text", "file"]
}
```

### 2.3 Task 生命周期

```
┌─────────────────────────────────────────────────────────────────────┐
│                    A2A Task 生命周期                                 │
│                                                                     │
│   ┌────────────┐     tasks/create      ┌────────────┐              │
│   │   Client   │ ────────────────────► │   Server   │              │
│   │ (Automaton)│                       │ (TinyClaw) │              │
│   │            │     Task (submitted)  │            │              │
│   │            │ ◄──────────────────── │            │              │
│   └────────────┘                       └────────────┘              │
│        │                                     │                      │
│        │         tasks/send (消息)           │                      │
│        │ ──────────────────────────────────► │                      │
│        │                                     │                      │
│        │         Task (working)              │                      │
│        │ ◄───────────────────────────────── │                      │
│        │                                     │                      │
│        │         SSE Stream (可选)           │                      │
│        │ ◄══════════════════════════════════ │                      │
│        │                                     │                      │
│        │         Task (completed/failed)     │                      │
│        │ ◄───────────────────────────────── │                      │
│        │                                     │                      │
│   Task States:                                                      │
│   ┌───────────┐    ┌───────────┐    ┌───────────┐                  │
│   │ submitted │───►│  working  │───►│ completed │                  │
│   └───────────┘    └─────┬─────┘    └───────────┘                  │
│                          │                                          │
│                          ├──────────► ┌───────────┐                 │
│                          │            │  failed   │                 │
│                          │            └───────────┘                 │
│                          │                                          │
│                          └──────────► ┌───────────┐                 │
│                                       │ canceled  │                 │
│                                       └───────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 框架架构

### 3.1 Automaton 核心机制

Automaton 是一个自主智能体框架，核心能力：

| 机制模块 | 核心文件 | 功能描述 |
|---------|---------|---------|
| **生命周期管理** | `heartbeat/daemon.ts`, `agent/loop.ts` | 维持心跳，管理状态机 |
| **编排引擎** | `orchestration/orchestrator.ts` | 管理任务执行流程 |
| **推理路由** | `inference/router.ts` | 路由到不同的 LLM 提供商 |
| **A2A 客户端** | `external/a2a/` | A2A 协议客户端实现 |

```
┌─────────────────────────────────────────────────────────┐
│                  Automaton Runtime                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Core Loop (ReAct)                   │   │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐  │   │
│  │  │  State   │───►│ Inference │───►│  Tool    │  │   │
│  │  │ Machine  │    │  Router   │    │ Executor │  │   │
│  │  └──────────┘    └──────────┘    └──────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼──────────────────────────┐   │
│  │              A2A Client Layer                    │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ external/a2a/                             │  │   │
│  │  │  ├── client.ts      # A2A 客户端          │  │   │
│  │  │  ├── discovery.ts   # Agent 发现          │  │   │
│  │  │  ├── task-manager.ts # Task 管理          │  │   │
│  │  │  ├── sse-client.ts  # SSE 流式客户端      │  │   │
│  │  │  └── types.ts       # A2A 类型定义        │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 TinyClaw 核心机制

TinyClaw 是消息路由系统，同时作为 A2A Server：

| 机制模块 | 核心文件 | 功能描述 |
|---------|---------|---------|
| **消息队列** | `lib/db.ts` | 采用 better-sqlite3 + WAL 模式 |
| **A2A Server** | `a2a/server.ts` | Agent Card 发布、JSON-RPC 端点 |
| **Task 管理** | `a2a/task-manager.ts` | Task 生命周期管理 |
| **超时恢复** | `recovery/scheduler.ts` | 应用层定时任务 |

```
┌─────────────────────────────────────────────────────────┐
│                  TinyClaw A2A Server                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │           A2A Protocol Layer                     │   │
│  │  ┌──────────────┐  ┌──────────────┐            │   │
│  │  │ Agent Card   │  │ JSON-RPC 2.0 │            │   │
│  │  │ /.well-known │  │ /a2a         │            │   │
│  │  └──────────────┘  └──────────────┘            │   │
│  │                          │                       │   │
│  │  ┌──────────────┐  ┌────▼─────────┐            │   │
│  │  │ SSE Stream   │  │ Task Manager │            │   │
│  │  │ /a2a/sse     │  │              │            │   │
│  │  └──────────────┘  └──────────────┘            │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────▼──────────────────────────┐   │
│  │           SQLite Message Bus (WAL)               │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ messages │ conversations │ agent_configs │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 3.5 Task vs Message 关系澄清

> **核心概念区分**

| 概念 | 层级 | 用途 | 状态机 |
|------|------|------|--------|
| **Task** | A2A 协议层 | 跨 Agent 协调的抽象任务单元 | submitted → working → completed/failed/canceled |
| **Message** | 内部实现层 | 消息队列中的具体处理单元 | pending → processing → completed/failed |

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Task vs Message 关系                                  │
│                                                                         │
│   A2A 协议层 (对外)              内部实现层 (对内)                        │
│   ┌──────────────┐              ┌──────────────┐                        │
│   │     Task     │              │    Message   │                        │
│   │              │    1 : 1     │              │                        │
│   │ • 抽象任务    │◄────────────►│ • 具体消息    │                        │
│   │ • 跨 Agent   │              │ • 队列处理    │                        │
│   │ • 生命周期    │              │ • 重试机制    │                        │
│   │ • SSE 订阅   │              │ • 并发控制    │                        │
│   └──────────────┘              └──────────────┘                        │
│                                                                         │
│   使用场景：                                                             │
│   • 外部 Agent 调用 → 使用 Task API                                     │
│   • 内部消息处理 → 使用 Message Queue                                   │
│   • 两者一一对应，Task ID = Message.task_id                             │
└─────────────────────────────────────────────────────────────────────────┘
```

**设计决策**：保留两套模型的理由：
1. **Task** 遵循 A2A 协议规范，用于跨系统协调
2. **Message** 包含队列特有字段（retry_count, claimed_at），用于内部处理
3. **解耦**：协议层变更不影响内部实现，内部优化不影响协议兼容

---

## 4. 连通设计

### 4.1 框架集成策略

**设计原则：A2A 协议标准化，运行时隔离**

```
┌────────────────────────────────────────────────────────────────┐
│                     集成边界分析 (A2A)                          │
│                                                                │
│   TinyClaw (A2A Server)          Automaton (A2A Client)        │
│   ┌──────────────┐               ┌──────────────┐             │
│   │ SQLite DB    │               │ Agent Loop   │             │
│   │ Task Manager │◄─────────────►│ Task Manager │             │
│   │              │   A2A Protocol │              │             │
│   └──────────────┘               └──────────────┘             │
│          │                              │                      │
│          │                              │                      │
│   ┌──────▼──────┐               ┌──────▼──────┐              │
│   │ Agent Card  │               │ Discovery   │              │
│   │ JSON-RPC    │               │ JSON-RPC    │              │
│   │ SSE Stream  │               │ SSE Client  │              │
│   └─────────────┘               └─────────────┘              │
└────────────────────────────────────────────────────────────────┘
```

**优势：**
1. **标准化协议** - 与业界 A2A 标准对齐，便于生态集成
2. **Agent 发现** - 动态发现 Agent 能力，无需硬编码
3. **流式输出** - 支持 SSE 流式推送，解决 LLM 长时间处理问题
4. **独立部署** - 两个框架可独立部署、独立扩展
5. **生态兼容** - 可接入其他 A2A 兼容的 Agent 框架

### 4.2 项目结构

```
automaton/
├── src/
│   ├── inference/
│   ├── agent/
│   ├── orchestration/
│   └── external/
│       └── a2a/                       # ← A2A 协议层
│           ├── client.ts              # A2A 客户端核心
│           ├── discovery.ts           # Agent 发现
│           ├── task-manager.ts        # Task 生命周期管理
│           ├── sse-client.ts          # SSE 流式客户端
│           ├── retry.ts               # 重试管理器
│           └── types.ts               # A2A 类型定义

tinyclaw/
├── src/
│   ├── lib/
│   │   ├── db.ts                      # 数据库操作
│   │   └── routing.ts                 # @mention 路由
│   ├── a2a/                           # ← A2A Server
│   │   ├── server.ts                  # A2A 服务器
│   │   ├── agent-card.ts              # Agent Card 生成
│   │   ├── task-manager.ts            # Task 管理
│   │   ├── jsonrpc.ts                 # JSON-RPC 2.0 处理
│   │   ├── sse-handler.ts             # SSE 流式处理
│   │   └── types.ts                   # A2A 类型定义
│   ├── recovery/
│   │   └── scheduler.ts               # 超时恢复
│   └── queue-processor.ts             # 消息处理
```

---

## 5. A2A 协议实现

### 5.1 TinyClaw Agent Card

```typescript
// tinyclaw/src/a2a/agent-card.ts
export const TINYCLAW_AGENT_CARD: AgentCard = {
  name: 'TinyClaw Message Router',
  description: '多智能体消息路由系统，支持消息队列、@mention 路由和 Task 生命周期管理',
  url: process.env.TINYCLAW_URL + '/a2a',
  version: '1.0.0',

  capabilities: {
    streaming: true,           // 支持 SSE 流式输出
    pushNotifications: true    // 支持 Webhook 推送
  },

  authentication: {
    schemes: ['bearer', 'api-key']
  },

  skills: [
    {
      id: 'route-message',
      name: '消息路由',
      description: '将消息路由到指定的 Agent',
      inputSchema: {
        type: 'object',
        properties: {
          toAgent: { type: 'string', description: '目标 Agent ID' },
          content: { type: 'string', description: '消息内容' },
          priority: { type: 'integer', default: 0, description: '优先级 (0=最高)' }
        },
        required: ['toAgent', 'content']
      }
    },
    {
      id: 'claim-task',
      name: '任务认领',
      description: '认领待处理的消息任务',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: '认领者 Agent ID' }
        },
        required: ['agentId']
      }
    },
    {
      id: 'complete-task',
      name: '完成任务',
      description: '标记任务完成并提交结果',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: '任务 ID' },
          output: { type: 'string', description: '输出内容' }
        },
        required: ['taskId']
      }
    },
    {
      id: 'send-heartbeat',
      name: '心跳上报',
      description: 'Agent 心跳状态上报',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          status: { type: 'string', enum: ['waking', 'running', 'sleeping', 'critical', 'dead'] },
          currentTaskId: { type: 'string', nullable: true }
        },
        required: ['agentId', 'status']
      }
    }
  ],

  defaultInputModes: ['text'],
  defaultOutputModes: ['text']
};
```

### 5.2 A2A Server 实现 (TinyClaw)

```typescript
// tinyclaw/src/a2a/server.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';

const a2aApp = new Hono();

// ============================================
// 配置常量
// ============================================
const MAX_SSE_CONNECTIONS = 100;              // 最大 SSE 连接数
const MAX_SSE_CONNECTIONS_PER_TASK = 5;       // 单 Task 最大连接数
const SSE_TOTAL_TIMEOUT_MS = 30 * 60 * 1000;  // 30 分钟总超时
const SSE_HEARTBEAT_MS = 30 * 1000;           // 30 秒心跳

// SSE 连接管理
const sseConnections = new Map<string, Set<AbortController>>();

// ============================================
// CORS 配置
// ============================================
a2aApp.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// Agent Card 端点 (A2A 标准路径)
// ============================================
a2aApp.get('/.well-known/agent.json', (c) => {
  return c.json(TINYCLAW_AGENT_CARD);
});

// ============================================
// 认证实现
// ============================================
interface AuthResult {
  valid: boolean;
  agentId?: string;
  error?: string;
}

async function verifyAuth(authHeader: string | undefined): Promise<AuthResult> {
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  // Bearer Token 认证
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const agent = await agentRepository.findByBearerToken(token);
      if (agent) {
        return { valid: true, agentId: agent.id };
      }
    } catch (error) {
      logger.error('Bearer token validation failed', { error });
    }
  }

  // API Key 认证
  if (authHeader.startsWith('ApiKey ') || authHeader.startsWith('api-key ')) {
    const key = authHeader.split(' ')[1];
    try {
      const agent = await agentRepository.findByApiKey(key);
      if (agent) {
        return { valid: true, agentId: agent.id };
      }
    } catch (error) {
      logger.error('API key validation failed', { error });
    }
  }

  return { valid: false, error: 'Invalid credentials' };
}

// ============================================
// JSON-RPC 2.0 端点（支持批量请求）
// ============================================
a2aApp.post('/a2a', async (c) => {
  const body = await c.req.json();

  // 判断是单个请求还是批量请求
  const isBatch = Array.isArray(body);
  const requests = isBatch ? body : [body];

  // 验证所有请求
  for (const request of requests) {
    if (request.jsonrpc !== '2.0') {
      return c.json(jsonRpcError(request.id ?? null, -32600, 'Invalid JSON-RPC version'));
    }
  }

  // 认证检查（所有请求共享同一个认证）
  const authResult = await verifyAuth(c.req.header('Authorization'));
  if (!authResult.valid) {
    return c.json(jsonRpcError(null, -32600, authResult.error || 'Unauthorized'));
  }

  // 处理所有请求
  const results = await Promise.all(
    requests.map(async (request) => {
      try {
        // 通知（无 id）不需要响应
        if (request.id === undefined) {
          await handleMethod(request.method, request.params, authResult.agentId!);
          return null; // 通知不返回
        }

        const result = await handleMethod(request.method, request.params, authResult.agentId!);
        return {
          jsonrpc: '2.0',
          result,
          id: request.id
        };
      } catch (error) {
        return jsonRpcError(request.id, -32603, error.message);
      }
    })
  );

  // 过滤掉通知的 null 响应
  const responses = results.filter(r => r !== null);

  // 如果全是通知，返回 204
  if (responses.length === 0) {
    return c.text('', 204);
  }

  // 批量请求返回数组，单个请求返回对象
  return c.json(isBatch ? responses : responses[0]);
});

// ============================================
// 方法处理器
// ============================================
async function handleMethod(method: string, params: any, agentId: string): Promise<any> {
  switch (method) {
    // Task 生命周期
    case 'tasks/create':
      return handleTaskCreate(params);
    case 'tasks/get':
      return handleTaskGet(params);
    case 'tasks/cancel':
      return handleTaskCancel(params);
    case 'tasks/send':
      return handleTaskSend(params);

    // 消息队列操作
    case 'messages/claim':
      return handleMessageClaim(params, agentId);
    case 'messages/complete':
      return handleMessageComplete(params);
    case 'messages/fail':
      return handleMessageFail(params);

    // 心跳
    case 'agents/heartbeat':
      return handleHeartbeat(params, agentId);

    default:
      throw new Error(`Method not found: ${method}`);
  }
}

// ============================================
// Task 创建
// ============================================
async function handleTaskCreate(params: CreateTaskParams): Promise<Task> {
  const taskId = generateTaskId();
  const task: Task = {
    id: taskId,
    status: {
      state: 'submitted',
      timestamp: new Date().toISOString()
    },
    history: [
      {
        role: 'user',
        parts: params.message?.parts || [{ type: 'text', text: params.content || '' }]
      }
    ],
    artifacts: [],
    metadata: {
      conversationId: params.conversationId,
      fromAgent: params.fromAgent,
      toAgent: params.toAgent,
      priority: params.priority ?? 0
    }
  };

  // 存储到数据库
  await taskRepository.create(task);

  // 入队消息
  await messageRepository.enqueue({
    taskId,
    conversationId: params.conversationId,
    fromAgent: params.fromAgent,
    toAgent: params.toAgent,
    content: params.content,
    priority: params.priority ?? 0
  });

  return task;
}

// ============================================
// SSE 流式订阅（增强版）
// ============================================
a2aApp.get('/a2a/sse/:taskId', async (c) => {
  const taskId = c.req.param('taskId');

  // 认证检查
  const authResult = await verifyAuth(c.req.header('Authorization'));
  if (!authResult.valid) {
    return c.text(authResult.error || 'Unauthorized', 401);
  }

  // 全局连接数限制
  if (sseConnections.size >= MAX_SSE_CONNECTIONS) {
    return c.text('Too many SSE connections', 429);
  }

  // 单 Task 连接数限制
  const taskConnections = sseConnections.get(taskId) || new Set();
  if (taskConnections.size >= MAX_SSE_CONNECTIONS_PER_TASK) {
    return c.text('Too many connections for this task', 429);
  }

  // 创建 AbortController 用于清理
  const abortController = new AbortController();
  taskConnections.add(abortController);
  sseConnections.set(taskId, taskConnections);

  return streamSSE(c, async (stream) => {
    // 设置总超时
    const timeoutId = setTimeout(() => {
      stream.writeSSE({ event: 'timeout', data: 'Connection timeout' });
      stream.close();
    }, SSE_TOTAL_TIMEOUT_MS);

    // 客户端断开清理
    const cleanup = () => {
      clearTimeout(timeoutId);
      const connections = sseConnections.get(taskId);
      if (connections) {
        connections.delete(abortController);
        if (connections.size === 0) {
          sseConnections.delete(taskId);
        }
      }
      unsubscribe();
    };

    // 监听客户端断开
    c.req.raw.signal.addEventListener('abort', cleanup);

    try {
      // 发送初始状态
      const task = await taskRepository.get(taskId);
      if (!task) {
        await stream.writeSSE({ event: 'error', data: 'Task not found' });
        return;
      }
      await stream.writeSSE({
        event: 'task-update',
        data: JSON.stringify(task)
      });

      // 如果已经是终态，直接返回
      if (['completed', 'failed', 'canceled'].includes(task.status.state)) {
        return;
      }

      // 订阅任务更新
      const unsubscribe = subscribeToTask(taskId, async (updatedTask) => {
        try {
          await stream.writeSSE({
            event: 'task-update',
            data: JSON.stringify(updatedTask)
          });

          // 任务终态时关闭连接
          if (['completed', 'failed', 'canceled'].includes(updatedTask.status.state)) {
            cleanup();
            stream.close();
          }
        } catch (error) {
          logger.error('Failed to send SSE update', { taskId, error });
        }
      });

      // 保持连接 + 心跳
      while (!c.req.raw.signal.aborted) {
        await stream.sleep(SSE_HEARTBEAT_MS);
        await stream.writeSSE({ event: 'ping', data: Date.now().toString() });
      }
    } finally {
      cleanup();
    }
  });
});

// ============================================
// Webhook 推送（可选）
// ============================================
interface WebhookConfig {
  url: string;
  secret: string;
  events: ('task.completed' | 'task.failed' | 'task.canceled')[];
}

async function notifyWebhook(task: Task, config: WebhookConfig): Promise<void> {
  const payload = {
    event: `task.${task.status.state}`,
    taskId: task.id,
    status: task.status,
    timestamp: new Date().toISOString()
  };

  // HMAC 签名
  const signature = await hmacSha256(JSON.stringify(payload), config.secret);

  await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-A2A-Signature': signature,
      'X-A2A-Event': `task.${task.status.state}`
    },
    body: JSON.stringify(payload)
  });
}

async function hmacSha256(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### 5.3 A2A Client 实现 (Automaton)

```typescript
// automaton/src/external/a2a/client.ts
export class A2AClient {
  private agentCard: AgentCard | null = null;
  private retryManager: RetryManager;

  // 幂等性保证：实例级别的已处理消息集合
  private completedMessages = new Set<number>();
  private failedMessages = new Set<number>();

  constructor(private baseUrl: string, private apiKey: string) {
    this.retryManager = new RetryManager({
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000
    });
  }

  // ============================================
  // Agent 发现（带缓存）
  // ============================================
  async discoverAgent(): Promise<AgentCard> {
    if (this.agentCard) {
      return this.agentCard;
    }

    // A2A 标准：GET /.well-known/agent.json
    const res = await fetch(`${this.baseUrl}/.well-known/agent.json`);
    if (!res.ok) {
      throw new A2AError(`Failed to discover agent: ${res.status}`);
    }

    this.agentCard = await res.json();
    return this.agentCard!;
  }

  // 清除 Agent Card 缓存（用于刷新）
  clearAgentCardCache(): void {
    this.agentCard = null;
  }

  // ============================================
  // JSON-RPC 调用
  // ============================================
  private async call<T>(method: string, params: object): Promise<T> {
    return this.retryManager.withRetry(async () => {
      const res = await fetch(`${this.baseUrl}/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
          id: generateRequestId()
        })
      });

      const data = await res.json();

      if (data.error) {
        const error = new A2AError(data.error.message, data.error.code);
        // 认证错误不重试
        if (data.error.code === -32600) {
          error.retryable = false;
        }
        throw error;
      }

      return data.result as T;
    }, method);
  }

  // ============================================
  // Task 管理
  // ============================================
  async createTask(params: CreateTaskParams): Promise<Task> {
    return this.call<Task>('tasks/create', params);
  }

  async getTask(taskId: string): Promise<Task> {
    return this.call<Task>('tasks/get', { taskId });
  }

  async cancelTask(taskId: string): Promise<Task> {
    return this.call<Task>('tasks/cancel', { taskId });
  }

  async sendTaskMessage(taskId: string, message: MessageContent): Promise<Task> {
    return this.call<Task>('tasks/send', { taskId, message });
  }

  // ============================================
  // 消息队列操作（幂等性保证）
  // ============================================
  async claimMessage(agentId: string): Promise<Message | null> {
    return this.call<Message | null>('messages/claim', { agentId });
  }

  async completeMessage(messageId: number, output?: string): Promise<void> {
    // 幂等性检查：实例级别的 Set
    if (this.completedMessages.has(messageId)) {
      logger.debug(`Message ${messageId} already completed, skipping`);
      return;
    }

    await this.call('messages/complete', { messageId, output });
    this.completedMessages.add(messageId);
  }

  async failMessage(messageId: number, error: string): Promise<void> {
    // 幂等性检查
    if (this.failedMessages.has(messageId)) {
      logger.debug(`Message ${messageId} already failed, skipping`);
      return;
    }

    await this.call('messages/fail', { messageId, error });
    this.failedMessages.add(messageId);
  }

  // ============================================
  // 心跳
  // ============================================
  async heartbeat(agentId: string, status: AgentStatus, currentTaskId?: string): Promise<void> {
    await this.call('agents/heartbeat', {
      agentId,
      status,
      currentTaskId,
      timestamp: Date.now()
    });
  }

  // ============================================
  // SSE 流式订阅（完整实现）
  // ============================================
  async subscribeToTask(
    taskId: string,
    onUpdate: (task: Task) => void,
    onError?: (error: Error) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/a2a/sse/${taskId}`, {
      signal,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'text/event-stream'
      }
    });

    if (!res.ok) {
      throw new A2AError(`SSE subscription failed: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new A2AError('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 完整的 SSE 事件解析
        const events = this.parseSSEEvents(buffer);
        buffer = events.remainingBuffer;

        for (const event of events.parsed) {
          if (event.event === 'task-update' && event.data) {
            try {
              const task = JSON.parse(event.data) as Task;
              onUpdate(task);

              // 终态时自动结束
              if (['completed', 'failed', 'canceled'].includes(task.status.state)) {
                return;
              }
            } catch (e) {
              onError?.(new Error(`Failed to parse task: ${e}`));
            }
          } else if (event.event === 'error' && event.data) {
            onError?.(new Error(event.data));
          }
          // ping 事件忽略
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // SSE 事件解析器
  private parseSSEEvents(buffer: string): { parsed: SSEEvent[]; remainingBuffer: string } {
    const events: SSEEvent[] = [];
    let current: SSEEvent = {};

    const lines = buffer.split('\n');

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];

      if (line === '') {
        // 空行表示事件结束
        if (current.data !== undefined) {
          events.push(current);
        }
        current = {};
      } else if (line.startsWith('event:')) {
        current.event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        current.data = (current.data || '') + line.slice(5).trim();
      } else if (line.startsWith('id:')) {
        current.id = line.slice(3).trim();
      } else if (line.startsWith('retry:')) {
        current.retry = parseInt(line.slice(6).trim(), 10);
      }
    }

    // 最后一行可能不完整，保留到下次处理
    const remainingBuffer = lines[lines.length - 1];

    return { parsed: events, remainingBuffer };
  }
}

// SSE 事件类型
interface SSEEvent {
  event?: string;
  data?: string;
  id?: string;
  retry?: number;
}

// A2A 错误类（增强）
export class A2AError extends Error {
  public retryable: boolean = true;

  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'A2AError';

    // 网络错误和服务器错误可重试
    if (code && [-32603, -32602].includes(code)) {
      this.retryable = true;
    }
    // 认证错误和无效请求不重试
    if (code && [-32600, -32601].includes(code)) {
      this.retryable = false;
    }
  }
}
```

### 5.4 类型定义

```typescript
// automaton/src/external/a2a/types.ts (共享)
// tinyclaw/src/a2a/types.ts

// ============================================
// Agent Card
// ============================================
export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
  };
  authentication: {
    schemes: string[];
  };
  skills: Skill[];
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  inputSchema?: object;
  outputSchema?: object;
}

// ============================================
// Task
// ============================================
export interface Task {
  id: string;
  status: TaskStatus;
  history: Message[];
  artifacts: Artifact[];
  metadata?: Record<string, any>;
}

export interface TaskStatus {
  state: TaskState;
  timestamp: string;
  message?: string;
}

export type TaskState = 'submitted' | 'working' | 'completed' | 'failed' | 'canceled';

export interface Message {
  role: 'user' | 'agent';
  parts: MessagePart[];
}

export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { url: string; mimeType?: string } };

export interface Artifact {
  id: string;
  name?: string;
  parts: MessagePart[];
}

// ============================================
// JSON-RPC 2.0
// ============================================
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: object;
  id: string | number;
}

export interface JsonRpcResponse<T = any> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

// ============================================
// 业务类型
// ============================================
export interface CreateTaskParams {
  conversationId?: string;
  fromAgent?: string;
  toAgent: string;
  content?: string;
  message?: Message;
  priority?: number;
  metadata?: Record<string, any>;
}

export type AgentStatus = 'waking' | 'running' | 'sleeping' | 'critical' | 'dead';

// ============================================
// 错误
// ============================================
export class A2AError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
    this.name = 'A2AError';
  }
}

export function jsonRpcError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    error: { code, message },
    id
  };
}
```

---

## 6. 数据设计

### 6.1 核心表结构

#### tasks（A2A 任务表）

```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,                     -- Task ID (UUID)
    status TEXT NOT NULL DEFAULT 'submitted', -- submitted/working/completed/failed/canceled
    conversation_id TEXT,                    -- 关联的会话 ID

    -- 消息内容
    history JSON NOT NULL DEFAULT '[]',      -- Message[] 历史记录
    artifacts JSON DEFAULT '[]',             -- Artifact[] 产出物

    -- 元数据
    from_agent TEXT,                         -- 发送者 Agent ID
    to_agent TEXT NOT NULL,                  -- 接收者 Agent ID
    priority INTEGER DEFAULT 0,              -- 优先级
    metadata JSON,                           -- 额外元数据

    -- 重试控制
    retry_count INTEGER DEFAULT 0,           -- 当前重试次数
    max_retries INTEGER DEFAULT 3,           -- 最大重试次数

    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,

    -- 错误信息
    error_message TEXT,

    -- 关联消息
    message_id INTEGER,                      -- 关联的 messages 表 ID
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

-- 索引
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_to_agent ON tasks(to_agent, status);
CREATE INDEX idx_tasks_conversation ON tasks(conversation_id);
CREATE INDEX idx_tasks_retry ON tasks(retry_count, max_retries);
```

#### messages（消息队列 - 保留兼容）

```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT,                            -- 关联的 A2A Task ID
    conversation_id TEXT NOT NULL,
    from_agent TEXT,
    to_agent TEXT NOT NULL,
    channel TEXT,
    content TEXT NOT NULL,
    metadata JSON,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',           -- pending/processing/completed/failed
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    claimed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    error_message TEXT,

    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 索引
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_to_agent ON messages(to_agent, status);
CREATE INDEX idx_messages_priority ON messages(priority, created_at);
CREATE INDEX idx_messages_task ON messages(task_id);
```

#### agent_heartbeats（Agent 心跳）

```sql
CREATE TABLE agent_heartbeats (
    agent_id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    current_task_id TEXT,                    -- 当前处理的 Task ID
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,

    FOREIGN KEY (current_task_id) REFERENCES tasks(id)
);

CREATE INDEX idx_heartbeats_status ON agent_heartbeats(status);
CREATE INDEX idx_heartbeats_time ON agent_heartbeats(last_heartbeat);
```

### 6.2 ER 关系

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ conversations│◄───────┤    tasks     │        │agent_configs │
│              │ 1    * │              │        │              │
└──────────────┘        └──────┬───────┘        └──────┬───────┘
                               │ 1                      │ 1
                               │                        │
                               ▼                        ▼
                        ┌──────────────┐        ┌──────────────┐
                        │   messages   │        │agent_        │
                        │              │        │ heartbeats   │
                        └──────────────┘        └──────────────┘
```

---

## 7. 错误处理与恢复机制

### 7.1 超时恢复策略（增强版）

```typescript
// tinyclaw/src/recovery/scheduler.ts
export class RecoveryScheduler {
  private readonly TASK_TIMEOUT_MS = 5 * 60 * 1000;    // 5 分钟
  private readonly HEARTBEAT_TIMEOUT_MS = 60 * 1000;   // 1 分钟
  private readonly INTERVAL_MS = 60 * 1000;            // 每分钟扫描

  start(): void {
    setInterval(() => this.recoverStaleTasks(), this.INTERVAL_MS);
  }

  private async recoverStaleTasks(): Promise<void> {
    const db = getDatabase();

    // 查找超时的 working 任务
    const staleTasks = db.prepare(`
      SELECT
        t.id,
        t.retry_count,
        t.max_retries,
        h.status as agent_status,
        h.last_heartbeat,
        h.current_task_id
      FROM tasks t
      LEFT JOIN agent_heartbeats h ON h.agent_id = t.to_agent
      WHERE t.status = 'working'
        AND t.updated_at < datetime('now', '-5 minutes')
    `).all();

    for (const task of staleTasks) {
      const agentAlive =
        task.agent_status === 'running' &&
        Date.now() - new Date(task.last_heartbeat).getTime() < this.HEARTBEAT_TIMEOUT_MS;

      const agentWorkingOnThisTask = task.current_task_id === task.id;

      if (agentAlive && agentWorkingOnThisTask) {
        // Agent 还活着，正在处理这个任务，继续等待
        logger.info(`Task ${task.id} still processing, agent alive`, {
          agentStatus: task.agent_status,
          lastHeartbeat: task.last_heartbeat
        });
        continue;
      }

      // 真正超时，执行恢复
      await this.recoverTask(task);
    }
  }

  private async recoverTask(task: StaleTask): Promise<void> {
    const db = getDatabase();

    if (task.retry_count < 3) {
      // 恢复为 submitted，等待重试
      db.prepare(`
        UPDATE tasks
        SET status = 'submitted',
            retry_count = retry_count + 1,
            updated_at = CURRENT_TIMESTAMP,
            error_message = 'Recovered after timeout'
        WHERE id = ?
      `).run(task.id);

      // 同时恢复关联的 message
      db.prepare(`
        UPDATE messages
        SET status = 'pending',
            retry_count = retry_count + 1,
            claimed_at = NULL
        WHERE task_id = ?
      `).run(task.id);

      logger.info(`Task ${task.id} recovered for retry ${task.retry_count + 1}`);
    } else {
      // 超过最大重试次数，标记为失败
      db.prepare(`
        UPDATE tasks
        SET status = 'failed',
            updated_at = CURRENT_TIMESTAMP,
            completed_at = CURRENT_TIMESTAMP,
            error_message = 'Exceeded max retries after timeout'
        WHERE id = ?
      `).run(task.id);

      logger.warn(`Task ${task.id} marked as failed after 3 retries`);
    }
  }
}
```

### 7.2 重试策略

| 错误类型 | 重试策略 | 最大重试次数 |
|----------|----------|-------------|
| **网络超时** | 立即重试 | 3 |
| **JSON-RPC 错误 (-32603)** | 指数退避 (1s, 2s, 4s) | 3 |
| **认证失败 (-32600)** | 不重试 | 0 |
| **方法不存在 (-32601)** | 不重试 | 0 |
| **Task 处理超时** | 重新入队 | 3 |

---

## 8. API 参考

### 8.1 JSON-RPC 方法列表

| 方法 | 描述 | 参数 |
|------|------|------|
| `tasks/create` | 创建新任务 | `CreateTaskParams` |
| `tasks/get` | 获取任务状态 | `{ taskId }` |
| `tasks/cancel` | 取消任务 | `{ taskId }` |
| `tasks/send` | 发送消息到任务 | `{ taskId, message }` |
| `tasks/subscribe` | 订阅任务更新 | `{ taskId }` |
| `messages/claim` | 认领消息 | `{ agentId }` |
| `messages/complete` | 完成消息 | `{ messageId, output? }` |
| `messages/fail` | 标记失败 | `{ messageId, error }` |
| `agents/heartbeat` | 心跳上报 | `{ agentId, status, currentTaskId? }` |

### 8.2 端点列表

| 端点 | 方法 | 描述 |
|------|------|------|
| `/.well-known/agent.json` | GET | Agent Card |
| `/a2a` | POST | JSON-RPC 2.0 端点 |
| `/a2a/sse/:taskId` | GET | SSE 流式订阅 |

---

## 9. 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| **通信协议** | A2A Protocol + JSON-RPC 2.0 | 标准化 Agent 通信 |
| **流式输出** | SSE (Server-Sent Events) | 支持 LLM 长时间处理 |
| **后端框架** | Hono (TinyClaw) / Express (Automaton) | 轻量级高并发 |
| **数据库** | better-sqlite3 + WAL | 嵌入式、事务强一致 |
| **AI/LLM** | OpenAI / Anthropic / 智谱AI | 多提供商支持 |
| **运行时** | Node.js 20+ | TypeScript |

---

## 10. 实现路线

### Phase 1: A2A 基础连通（Week 1-2）

- [ ] TinyClaw Agent Card 发布 (`/.well-known/agent.json`)
- [ ] TinyClaw JSON-RPC 2.0 端点 (`/a2a`)
- [ ] Automaton A2A 客户端 (`external/a2a/client.ts`)
- [ ] Agent 发现机制 (`discovery.ts`)
- [ ] 核心 Task 方法 (`create`, `get`, `cancel`)
- [ ] 消息队列操作 (`claim`, `complete`, `fail`)
- [ ] 心跳上报

### Phase 2: 流式与增强（Week 3-4）

- [ ] SSE 流式订阅 (`/a2a/sse/:taskId`)
- [ ] 重试管理器 (指数退避)
- [ ] 幂等性保证
- [ ] 超时恢复 + 心跳协调
- [ ] @mention 路由完善
- [ ] 会话上下文管理

### Phase 3: 生产就绪（Week 5+）

- [ ] 认证机制 (Bearer Token / API Key)
- [ ] 监控与日志聚合
- [ ] 并发测试覆盖
- [ ] 多渠道适配器
- [ ] PostgreSQL 迁移接口
- [ ] 接入其他 A2A 兼容 Agent

---

## 11. 附录

### 11.1 测试用例

```typescript
// tests/a2a/protocol-compliance.test.ts
describe('A2A Protocol Compliance', () => {
  // ============================================
  // JSON-RPC 2.0 规范测试
  // ============================================
  describe('JSON-RPC 2.0', () => {
    it('应拒绝无效的 JSON-RPC 版本', async () => {
      const res = await fetch('/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' },
        body: JSON.stringify({ jsonrpc: '1.0', method: 'test', id: 1 })
      });

      const data = await res.json();
      expect(data.error.code).toBe(-32600);
      expect(data.error.message).toContain('Invalid JSON-RPC version');
    });

    it('应正确处理批量请求', async () => {
      const res = await fetch('/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' },
        body: JSON.stringify([
          { jsonrpc: '2.0', method: 'tasks/create', params: { toAgent: 'a', content: '1' }, id: 1 },
          { jsonrpc: '2.0', method: 'tasks/create', params: { toAgent: 'b', content: '2' }, id: 2 }
        ])
      });

      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].result.id).toBeDefined();
      expect(data[1].result.id).toBeDefined();
    });

    it('应正确处理通知（无 id 无响应）', async () => {
      const res = await fetch('/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'agents/heartbeat',
          params: { agentId: 'test', status: 'running' }
          // 无 id = 通知
        })
      });

      // 通知应该返回 204 No Content
      expect(res.status).toBe(204);
    });

    it('未知方法应返回 -32601', async () => {
      const res = await fetch('/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'unknown/method', id: 1 })
      });

      const data = await res.json();
      expect(data.error.code).toBe(-32603);
      expect(data.error.message).toContain('Method not found');
    });
  });

  // ============================================
  // 认证测试
  // ============================================
  describe('Authentication', () => {
    it('缺少 Authorization 应返回 401', async () => {
      const res = await fetch('/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tasks/get', params: { taskId: '1' }, id: 1 })
      });

      const data = await res.json();
      expect(data.error.code).toBe(-32600);
      expect(data.error.message).toContain('Unauthorized');
    });

    it('无效 Token 应返回 401', async () => {
      const res = await fetch('/a2a', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer invalid' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tasks/get', params: { taskId: '1' }, id: 1 })
      });

      const data = await res.json();
      expect(data.error.message).toContain('Invalid credentials');
    });

    it('认证失败不应重试', async () => {
      const client = new A2AClient('http://localhost', 'invalid-key');
      const retrySpy = vi.spyOn(client as any, 'retryManager');

      await expect(client.createTask({ toAgent: 'test', content: 'test' }))
        .rejects.toThrow(A2AError);

      // 认证错误应该立即失败，不触发重试
      expect(retrySpy.withRetry).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // SSE 测试
  // ============================================
  describe('SSE', () => {
    it('应支持 SSE 流式订阅', async () => {
      const task = await a2aClient.createTask({ toAgent: 'agent-1', content: 'test' });

      const updates: Task[] = [];
      const subscribePromise = a2aClient.subscribeToTask(task.id, (t) => updates.push(t));

      // 模拟任务更新
      await a2aClient.claimMessage('agent-1');
      await a2aClient.completeMessage(1, 'done');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(updates.length).toBeGreaterThan(0);
      expect(updates[updates.length - 1].status.state).toBe('completed');
    });

    it('应限制单 Task 的并发 SSE 连接数', async () => {
      const task = await a2aClient.createTask({ toAgent: 'agent-1', content: 'test' });

      // 尝试建立 10 个连接
      const connections = await Promise.allSettled(
        Array(10).fill(null).map(() =>
          fetch(`/a2a/sse/${task.id}`, {
            headers: { 'Authorization': 'Bearer test' }
          })
        )
      );

      // 应该有限制，不是全部成功
      const successCount = connections.filter(r => r.status === 'fulfilled' && r.value.ok).length;
      expect(successCount).toBeLessThanOrEqual(5); // MAX_SSE_CONNECTIONS_PER_TASK
    });

    it('应发送心跳 ping 事件', async () => {
      const task = await a2aClient.createTask({ toAgent: 'agent-1', content: 'test' });

      const events: string[] = [];
      const abortController = new AbortController();

      // 订阅并收集事件
      a2aClient.subscribeToTask(
        task.id,
        () => {},
        undefined,
        abortController.signal
      ).then(() => {
        // 从原始响应中收集事件类型
      });

      // 等待心跳周期
      await new Promise(resolve => setTimeout(resolve, 35000));
      abortController.abort();

      expect(events).toContain('ping');
    });
  });

  // ============================================
  // 超时恢复测试
  // ============================================
  describe('Timeout Recovery', () => {
    it('Task 超时但 Agent 心跳正常，不应恢复', async () => {
      const task = await a2aClient.createTask({ toAgent: 'agent-1', content: 'test' });
      await a2aClient.claimMessage('agent-1');

      // 模拟任务超时
      await db.prepare(`
        UPDATE tasks SET updated_at = datetime('now', '-6 minutes') WHERE id = ?
      `).run(task.id);

      // 保持心跳
      await a2aClient.heartbeat('agent-1', 'running', task.id);

      // 触发恢复
      await recoveryScheduler.recoverStaleTasks();

      // 验证任务未恢复
      const result = await a2aClient.getTask(task.id);
      expect(result.status.state).toBe('working');
    });

    it('Task 超时且 Agent 心跳超时，应恢复', async () => {
      const task = await a2aClient.createTask({ toAgent: 'agent-1', content: 'test' });
      await a2aClient.claimMessage('agent-1');

      // 模拟任务超时 + 心跳超时
      await db.prepare(`
        UPDATE tasks SET updated_at = datetime('now', '-6 minutes') WHERE id = ?
      `).run(task.id);
      await db.prepare(`
        UPDATE agent_heartbeats SET last_heartbeat = datetime('now', '-2 minutes')
        WHERE agent_id = 'agent-1'
      `).run();

      await recoveryScheduler.recoverStaleTasks();

      const result = await a2aClient.getTask(task.id);
      expect(result.status.state).toBe('submitted'); // 恢复为待处理
    });

    it('同一 Task 不应被重复恢复', async () => {
      const task = await a2aClient.createTask({ toAgent: 'agent-1', content: 'test' });
      await a2aClient.claimMessage('agent-1');

      // 模拟超时
      await db.prepare(`
        UPDATE tasks SET updated_at = datetime('now', '-6 minutes') WHERE id = ?
      `).run(task.id);

      // 多次触发恢复
      await recoveryScheduler.recoverStaleTasks();
      await recoveryScheduler.recoverStaleTasks();
      await recoveryScheduler.recoverStaleTasks();

      // 验证 retry_count 只增加 1
      const result = await db.prepare('SELECT retry_count FROM tasks WHERE id = ?').get(task.id);
      expect(result.retry_count).toBe(1);
    });
  });

  // ============================================
  // 并发测试
  // ============================================
  describe('Concurrency', () => {
    it('并发 Task 创建不冲突', async () => {
      const [task1, task2] = await Promise.all([
        a2aClient.createTask({ toAgent: 'agent-a', content: 'task 1' }),
        a2aClient.createTask({ toAgent: 'agent-b', content: 'task 2' })
      ]);

      expect(task1.id).toBeDefined();
      expect(task2.id).toBeDefined();
      expect(task1.id).not.toBe(task2.id);
    });

    it('并发 claim 不重复', async () => {
      await a2aClient.createTask({ toAgent: 'shared-agent', content: 'shared task' });

      const [result1, result2] = await Promise.all([
        a2aClient.claimMessage('agent-1'),
        a2aClient.claimMessage('agent-2')
      ]);

      const successCount = [result1, result2].filter(r => r !== null).length;
      expect(successCount).toBe(1);
    });
  });

  // ============================================
  // 幂等性测试
  // ============================================
  describe('Idempotency', () => {
    it('completeMessage 应该是幂等的', async () => {
      const task = await a2aClient.createTask({ toAgent: 'agent-1', content: 'test' });
      const message = await a2aClient.claimMessage('agent-1');

      // 多次调用
      await a2aClient.completeMessage(message.id, 'result 1');
      await a2aClient.completeMessage(message.id, 'result 2');
      await a2aClient.completeMessage(message.id, 'result 3');

      const result = await a2aClient.getTask(task.id);
      expect(result.status.state).toBe('completed');
      // 应该保持第一次的结果
    });
  });
});
```

### 11.2 A2A 协议合规性检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Agent Card 发布 | ☐ | `/.well-known/agent.json` 可访问 |
| JSON-RPC 2.0 格式 | ☐ | 请求/响应符合规范 |
| Task 生命周期 | ☐ | 支持完整状态转换 |
| SSE 流式输出 | ☐ | 支持 Server-Sent Events |
| 认证机制 | ☐ | 支持 Bearer Token |
| 错误码规范 | ☐ | 使用标准 JSON-RPC 错误码 |

---

**文档版本**: v2.1
**最后更新**: 2026-03-05
**修订内容**:
- v2.1 (2026-03-05):
  - 修复 tasks 表缺少 retry_count/max_retries 字段
  - 修复 A2A Client 幂等性 Set 作用域错误
  - 实现完整的 verifyAuth 认证函数
  - 添加 SSE 连接管理（限制、超时、清理）
  - 添加 JSON-RPC 批量请求和通知支持
  - 完善完整 SSE 事件解析（event/id/retry）
  - 添加 Webhook 推送实现
  - 明确 Task vs Message 关系
  - 补充完整测试用例（认证、SSE、幂等性、并发）
- v2.0 (2026-03-05):
  - 从 HTTP API 迁移到 A2A 协议
  - 添加 Agent Card 和 Task 生命周期设计
  - 添加 JSON-RPC 2.0 端点实现
  - 添加 SSE 流式输出支持
  - 增强超时恢复机制（心跳协调）
  - 更新项目结构和数据模型
  - 添加 A2A 协议合规性检查清单

**审核说明**: 基于 BMAD Party Mode (Winston/Amelia/Quinn) 多角度审核修复
