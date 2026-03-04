# TinyClaw - 架构指南

**所属部分：** tinyclaw
**类型：** 全栈 Web 应用程序 (多渠道助手)
**上次更新：** 2026-03-03

---

## 概述

**TinyClaw** 是一个多团队、多渠道 24/7 AI 助手平台，支持 Discord, Telegram, WhatsApp 和飞书 (Feishu/Lark)。它配备了一个基于 Next.js 的控制面板 (TinyOffice)，用于团队编排、智能体管理和实时监控。

系统通过基于队列的消息处理、持久化会话状态和统一的多平台消息推送，实现了基于团队的多智能体协作。

---

## 架构模式

**基于队列的多智能体架构** 配合团队编排

核心架构遵循消息队列模式，其中：

1. **渠道 (Channels)** 接收来自不同平台的消息。
2. **队列处理器 (Queue Processor)** 路由并管理消息流。
3. **智能体 (Agents)** 独立处理消息流并保持持久化状态。
4. **团队 (Teams)** 协调多个智能体完成复杂任务。
5. **API 服务器** 为前端控制提供 REST/SSE 接口。
6. **TinyOffice** 提供基于 Web 的管理和监控功能。

---

## 高级架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TinyClaw Platform                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    TinyOffice (Frontend)                       │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  Next.js 16 + React 19 + Tailwind CSS 4 + Radix UI      │  │  │
│  │  ├─────────────────────────────────────────────────────────┤  │  │
│  │  │  Pages: Agents, Teams, Tasks, Chat, Console, Logs       │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│  └─────────────────────┼──────────────────────────────────────────┘  │
│                        │ (HTTP/WebSocket)                             │
│  ┌─────────────────────▼──────────────────────────────────────────┐  │
│  │                  Hono API Server                                │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  REST API Endpoints:                                     │  │  │
│  │  │  ├─ /api/agents          - Agent CRUD & status          │  │  │
│  │  │  ├─ /api/teams           - Team CRUD & orchestration    │  │  │
│  │  │  ├─ /api/messages        - Message history              │  │  │
│  │  │  ├─ /api/tasks           - Task tracking                │  │  │
│  │  │  ├─ /api/logs            - Activity logs                │  │  │
│  │  │  ├─ /api/settings        - Configuration                │  │  │
│  │  │  ├─ /api/queue/status    - Queue status                 │  │  │
│  │  │  └─ /api/events/stream   - SSE event stream             │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│  └─────────────────────┼──────────────────────────────────────────┘  │
│                        │                                              │
│  ┌─────────────────────▼──────────────────────────────────────────┐  │
│  │               Queue Processor (Core Engine)                     │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Message Queue Management:                               │  │  │
│  │  │  ├─ Claim & Process Messages                             │  │  │
│  │  │  ├─ Route to Agents (@agent_id or default)              │  │  │
│  │  │  ├─ Handle Team Conversations (mentions)                │  │  │
│  │  │  ├─ Conversation Isolation (per-agent directories)      │  │  │
│  │  │  └─ Internal Message Passing (team coordination)        │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│                       │                                             │
│  ┌────────────────────▼─────────────────────────────────────────┐  │
│  │              Multi-Channel Gateway                           │  │  │
│  │  ┌──────────────┬──────────────┬──────────────┬────────────┐  │  │
│  │  │  Discord.js  │  Telegram    │  WhatsApp    │  Feishu    │  │  │
│  │  │              │  Bot API     │  Web.js      │  SDK       │  │  │
│  │  └──────┬───────┴──────┬───────┴──────┬───────┴──────┬─────┘  │  │
│           │               │               │               │        │
│  ┌────────▼────────────────────────────────────────────────┘       │
│  │                     Agent System                                 │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Agent Manager:                                          │  │  │
│  │  │  ├─ Load & Configure Agents (providers, models, prompts)│  │  │
│  │  │  ├─ Invoke LLM (via invokeAgent)                        │  │  │
│  │  │  ├─ Manage Conversation State                           │  │  │
│  │  │  └─ Handle Long Responses & File Attachments            │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│                       │                                             │
│  ┌────────────────────▼─────────────────────────────────────────┐  │
│  │              Team Orchestration                              │  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Team Manager:                                           │  │  │
│  │  │  ├─ Parse @teammate Mentions                           │  │  │
│  │  │  ├─ Create Internal Messages for Teammates             │  │  │
│  │  │  ├─ Track Pending Teammates                            │  │  │
│  │  │  ├─ Complete Conversations (all mentions resolved)     │  │  │
│  │  │  └─ Leader Agent Coordination                          │  │  │
│  │  └──────────────────┬──────────────────────────────────────┘  │  │
│                       │                                             │
│  ┌────────────────────▼─────────────────────────────────────────┐  │
│  │              Persistence Layer                               │  │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  SQLite Database (better-sqlite3)                        │  │  │
│  │  │  ├─ Queue Messages (pending, processing, completed)     │  │  │
│  │  │  ├─ Agent State & Configuration                         │  │  │
│  │  │  ├─ Team Definitions (agents, leader, rules)           │  │  │
│  │  │  ├─ Conversation History                                │  │  │
│  │  │  ├─ Tasks & Logs                                        │  │  │
│  │  │  └─ Settings (workspace, providers, defaults)          │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              External Integrations                            │  │  │
│  │  ├─ Discord API                                              │  │  │
│  │  ├─ Telegram Bot API                                         │  │  │
│  │  ├─ WhatsApp Web                                             │  │  │
│  │  ├─ Feishu (Lark) API                                        │  │  │
│  │  ├─ LLM Providers (Claude, OpenAI, etc.)                     │  │  │
│  │  └─ File System (workspace, chats, files)                    │  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

### 1. 队列处理器 (Queue Processor - `src/queue-processor.ts`)

**用途：** 路由并编排所有消息流的中心消息处理引擎。

**关键职责：**

- 从数据库队列中提取消息。
- 路由到相应的智能体 (通过 `@agent_id` 前缀或默认设置)。
- 处理带有队友提及 (`[@teammate: message]`) 的团队会话。
- 管理会话状态和隔离。
- 处理用于团队协调的内部消息。
- 追踪待响应队友并完成会话。
- 使用相应的上下文和设置调用智能体。

**核心功能：**

- **消息队列：** 后端由 SQLite 支持的持久化队列，具有状态 (等待 (pending), 处理中 (processing), 已完成 (completed))。
- **智能体路由：** 基于消息前缀或渠道配置的智能路由。
- **团队协助：** 解析提及并为队友创建内部消息。
- **会话隔离：** 为每个智能体分配独立的工作目录以存放会话状态。
- **内部消息处理：** 智能体可通过队列系统相互发送消息。
- **停滞消息恢复：** 自动恢复卡在处理中的消息。

**入口点：** 主可执行程序 (`node dist/queue-processor.js`)

**相关文件：**

- `src/lib/db.ts` - 队列数据库操作
- `src/lib/routing.ts` - 智能体和团队路由逻辑
- `src/lib/conversation.ts` - 会话状态管理
- `src/lib/invoke.ts` - 智能体调用和 LLM 调用
- `src/lib/response.ts` - 响应处理和文件收集

---

### 2. API 服务器 (API Server - `src/server/index.ts`)

**用途：** 面向前端 (TinyOffice) 和外部集成的 REST + SSE API。

**关键职责：**

- 为所有 CRUD 操作提供 HTTP 终端点。
- 通过服务器发送事件 (SSE) 流式传输实时事件。
- 允许前端控制智能体、团队和设置。
- 暴露队列状态和系统健康状况。
- 处理 CORS 和身份验证。

**API 终端点：**

#### 智能体 (Agents - `src/server/routes/agents.ts`)

- `GET /api/agents` - 列出所有智能体
- `GET /api/agents/:id` - 获取智能体详情
- `POST /api/agents` - 创建智能体
- `PUT /api/agents/:id` - 更新智能体
- `DELETE /api/agents/:id` - 删除智能体

#### 团队 (Teams - `src/server/routes/teams.ts`)

- `GET /api/teams` - 列出所有团队
- `GET /api/teams/:id` - 获取团队详情
- `POST /api/teams` - 创建团队
- `PUT /api/teams/:id` - 更新团队
- `DELETE /api/teams/:id` - 删除团队

#### 消息 (Messages - `src/server/routes/messages.ts`)

- `GET /api/messages` - 消息历史
- `POST /api/messages` - 向智能体/团队发送消息

#### 队列 (Queue - `src/server/routes/queue.ts`)

- `GET /api/queue/status` - 队列统计 (等待、处理中、已完成)

#### 任务 (Tasks - `src/server/routes/tasks.ts`)

- `GET /api/tasks` - 列出任务
- `POST /api/tasks` - 创建任务
- 任务状态和进度追踪

#### 日志 (Logs - `src/server/routes/logs.ts`)

- `GET /api/logs` - 系统活动日志
- 过滤和分页

#### 设置 (Settings - `src/server/routes/settings.ts`)

- `GET /api/settings` - 获取配置
- `PUT /api/settings` - 更新配置

#### 会话 (Chats - `src/server/routes/chats.ts`)

- `GET /api/chats/:agentId` - 智能体的会话历史
- `DELETE /api/chats/:agentId` - 清除会话

#### SSE 事件 (SSE Events - `src/server/sse.ts`)

- `GET /api/events/stream` - 实时事件流
- 事件：`message_received` (消息已接收), `agent_routed` (智能体已路由), `task_updated` (任务已更新) 等。

**相关文件：**

- `src/server/sse.ts` - SSE 客户端管理
- `src/server/routes/` 下的所有路由文件

---

### 3. 多渠道网关 (Multi-Channel Gateway - `src/channels/`)

**用途：** 连接并管理多个消息平台。

#### Discord 客户端 (`src/channels/discord-client.ts`)

- Discord.js 集成。
- 消息的接收与发送。
- 用户和频道管理。
- 文件附件支持。

#### Telegram 客户端 (`src/channels/telegram-client.ts`)

- Node Telegram Bot API 集成。
- 消息处理 (文本、文件、命令)。
- 会话 ID 管理。
- 机器人命令支持。

#### WhatsApp 客户端 (`src/channels/whatsapp-client.ts`)

- WhatsApp Web.js 集成。
- QR 码身份验证。
- 消息处理。
- 群聊支持。

#### 飞书客户端 (`src/channels/feishu-client.ts`)

- 飞书 (Lark) SDK 集成。
- 企业级消息推送。
- 机器人身份验证。
- 富文本消息支持。

**核心功能：**

- 所有渠道采用统一的消息格式。
- 接收消息后自动存入队列。
- 错误处理和重试逻辑。
- 平台特定功能 (表情回复、附件等)。

**执行方式：** 每个渠道作为独立进程运行：

- `npm run discord`
- `npm run telegram`
- `npm run whatsapp`
- `npm run feishu`

---

### 4. 智能体系统 (Agent System - `src/lib/agent.ts`, `src/lib/invoke.ts`)

**用途：** AI 智能体执行和 LLM 集成。

**核心组件：**

#### 智能体配置 (`src/lib/config.ts`)

- **供应商 (Provider)：** Claude, OpenAI 或其他 LLM 供应商。
- **模型 (Model)：** 特定模型 (如 claude-3-opus, gpt-4)。
- **系统提示词：** 针对智能体行为的自定义指令。
- **工作目录：** 隔离的会话状态。
- **工具/技能：** 可用的能力。

#### 智能体调用 (`src/lib/invoke.ts`)

- 加载智能体配置和上下文。
- 构建会话历史。
- 调用 LLM 供应商 API。
- 处理流式响应。
- 解析并执行工具调用。
- 保存会话状态。

#### 响应处理 (`src/lib/response.ts`)

- 处理长响应 (分块)。
- 处理文件附件。
- 格式化输出渠道。
- 收集生成的文件。

**功能：**

- 多供应商支持 (Claude, OpenAI 等)。
- 会话历史持久化。
- 系统提示词自定义。
- 文件附件处理。
- 流式响应支持。

---

### 5. 团队编排 (Team Orchestration - `src/lib/routing.ts`, `src/lib/conversation.ts`)

**用途：** 协调多个智能体协作。

**核心概念：**

#### 团队结构

```typescript
{
  teamId: "team-1",
  name: "Support Team",
  leader_agent: "agent-support-lead",
  agents: ["agent-support-lead", "agent-technical", "agent-billing"],
  description: "Customer support team"
}
```

#### 团队会话

1. **初始消息：** 用户发送 `[@team-support: 如何重置密码？]`
2. **路由：** 消息路由至团队负责人 (leader_agent)。
3. **提及解析：** 负责人提及队友：`[@agent-technical: 你能帮忙说明重置密码的步骤吗？]`
4. **内部消息：** 系统为技术智能体 (technical agent) 创建内部消息。
5. **响应：** 技术智能体回复负责人。
6. **协作：** 负责人聚合回复并答复用户。
7. **完成：** 当所有提及的操作均已解决时，会话完成。

**关键函数：**

- `parseAgentRouting()` - 解析 `@agent` 或 `@team` 前缀。
- `findTeamForAgent()` - 为智能体查找团队上下文。
- `extractTeammateMentions()` - 提取 `[@teammate: ...]` 形式的提及。
- `enqueueInternalMessage()` - 为队友创建内部消息。
- `completeConversation()` - 将会话标记为完成。

**状态管理：**

- **待处理队友 (Pending Teammates)：** 追踪哪些队友尚未回复。
- **会话锁 (Conversation Locks)：** 防止竞态条件。
- **团队上下文：** 在消息间保留团队上下文。

---

### 6. 持久层 (Persistence Layer - `src/lib/db.ts`)

**用途：** 用于存储所有持久化数据的 SQLite 数据库。

**数据库模式 (Schema)：**

#### 队列消息表 (Queue Messages Table)

```sql
CREATE TABLE queue_messages (
  id INTEGER PRIMARY KEY,
  channel TEXT NOT NULL,           -- discord, telegram, whatsapp, feishu
  sender TEXT NOT NULL,            -- 用户标识符
  sender_id TEXT,                  -- 平台特定的用户 ID
  message TEXT NOT NULL,           -- 消息内容
  message_id TEXT UNIQUE,          -- 平台消息 ID
  agent TEXT,                      -- 目标智能体 ID (如果预先路由)
  conversation_id TEXT,            -- 会话分组
  from_agent TEXT,                 -- 内部：发送方智能体
  status TEXT DEFAULT 'pending',   -- pending, processing, completed, failed
  files TEXT,                      -- 文件路径的 JSON 数组
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

#### 智能体状态表 (Agent State Table)

```sql
CREATE TABLE agent_state (
  agent_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  system_prompt TEXT,
  working_dir TEXT,
  config JSON,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### 团队定义表 (Team Definitions Table)

```sql
CREATE TABLE teams (
  team_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader_agent TEXT NOT NULL,
  agents JSON NOT NULL,      -- 智能体 ID 的 JSON 数组
  description TEXT,
  config JSON,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### 任务表 (Tasks Table)

```sql
CREATE TABLE tasks (
  task_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',  -- pending, in_progress, completed
  assigned_to TEXT,               -- 智能体或团队 ID
  due_date INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### 日志表 (Logs Table)

```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL,       -- INFO, WARN, ERROR
  message TEXT NOT NULL,
  context JSON,              -- 附加上下文
  created_at INTEGER DEFAULT (unixepoch())
);
```

**关键函数：**

- `initQueueDb()` - 初始化数据库和表。
- `claimNextMessage()` - 获取下一条等待处理的消息 (带有锁定机制)。
- `completeMessage()` - 将消息标记为已完成。
- `failMessage()` - 将消息标记为失败 (支持重试)。
- `enqueueResponse()` - 将响应加入队列以发送回渠道。
- `getPendingAgents()` - 获取包含等待处理消息的智能体。
- `recoverStaleMessages()` - 恢复卡在处理状态的消息。
- `pruneAckedResponses()` - 清理旧的响应。
- `pruneCompletedMessages()` - 归档已完成的消息。

**功能：**

- 符合 ACID 原则的事务。
- 并发处理时的行级锁定。
- 旧资料的自动清理。
- 队列恢复和重试逻辑。

---

### 7. 配置系统 (Configuration System - `src/lib/config.ts`)

**用途：** 管理智能体、团队、设置和工作区配置。

**配置文件：**

#### 设置 (`tinyclaw.settings.json`)

```json
{
  "workspace": {
    "path": "~/tinyclaw-workspace"
  },
  "llm": {
    "default_provider": "claude",
    "default_model": "claude-3-opus"
  },
  "channels": {
    "discord": { "enabled": true, "token": "..." },
    "telegram": { "enabled": true, "token": "..." },
    "whatsapp": { "enabled": true },
    "feishu": { "enabled": false }
  }
}
```

#### 智能体 (`tinyclaw.agents.json`)

```json
{
  "default": {
    "name": "General Assistant",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are a helpful assistant...",
    "working_dir": "agents/default"
  },
  "agent-technical": {
    "name": "Technical Support",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are a technical support expert...",
    "working_dir": "agents/technical"
  }
}
```

#### 团队 (`tinyclaw.teams.json`)

```json
{
  "team-support": {
    "name": "Support Team",
    "leader_agent": "agent-support-lead",
    "agents": ["agent-support-lead", "agent-technical", "agent-billing"],
    "description": "Customer support team"
  }
}
```

**关键函数：**

- `getSettings()` - 从文件加载设置。
- `getAgents(settings)` - 加载并合并智能体配置。
- `getTeams(settings)` - 加载团队定义。
- `saveSettings(settings)` - 持久化设置。
- `saveAgents(agents)` - 持久化智能体配置。
- `saveTeams(teams)` - 持久化团队定义。

**核心功能：**

- 热重载 (每次发送消息时重新加载配置)。
- 默认智能体备选方案 (Fallback)。
- 工作区目录管理。
- 配置验证。

---

### 8. 日志与事件 (`src/lib/logging.ts`)

**用途：** 全系统的日志记录和事件发出。

**日志级别：**

- `INFO` - 正常运行。
- `WARN` - 警告和可恢复的错误。
- `ERROR` - 关键错误。

**事件类型：**

- `message_received` - 从渠道收到消息。
- `agent_routed` - 消息已路由至智能体。
- `task_updated` - 任务状态已变更。
- `agent_responded` - 智能体已生成响应。
- `conversation_completed` - 团队会话已结束。

**核心功能：**

- 基于文件的日志记录 (`logs/tinyclaw.log`)。
- 带颜色的控制台输出。
- 向前端推送 SSE 事件流。
- 结构化日志格式 (JSON)。

---

### 9. 插件系统 (`src/lib/plugins.ts`)

**用途：** 用于自定义行为的可扩展钩子 (hook) 系统。

**钩子类型：**

#### 入站钩子 (Incoming Hooks)

- `onMessageReceived(message)` - 在智能体处理前执行。
- `onAgentRouted(message, agent)` - 在路由后执行。
- 修改或拒绝消息。

#### 出站钩子 (Outgoing Hooks)

- `onAgentResponse(response)` - 在发送响应前执行。
- `onResponseSent(response)` - 在发送响应后执行。
- 修改或记录响应。

**插件加载：**

- 从 `plugins/` 目录加载插件。
- 自动发现并注册。
- 具有优先级的钩子链。

---

### 10. TinyOffice 前端 (`tinyclaw/tinyoffice/`)

**用途：** 用于管理和监控的 Next.js Web 控制面板。

**技术栈：**

- **框架：** Next.js 16 (App Router)
- **UI 库：** React 19
- **样式：** Tailwind CSS 4
- **组件库：** Radix UI
- **状态管理：** React hooks + API 轮询

**页面：**

#### 仪表盘 (`app/page.tsx`)

- 系统概览。
- 队列状态。
- 活动中的智能体。
- 最近活动。

#### 智能体管理 (`app/agents/page.tsx`)

- 智能体列表和详情。
- 创建/编辑/删除智能体。
- 智能体状态和统计。
- 会话历史。

#### 团队管理 (`app/teams/page.tsx`)

- 团队列表和详情。
- 创建/编辑/删除团队。
- 团队成员管理。
- 团队会话历史。

#### 任务追踪 (`app/tasks/page.tsx`)

- 任务列表和追踪。
- 创建/分配任务。
- 任务状态和进度。
- 截止日期管理。

#### 聊天界面 (`app/chat/agent/[id]/page.tsx`, `app/chat/team/[id]/page.tsx`)

- 实时聊天接口。
- 会话历史。
- 向智能体/团队发送消息。
- 文件附件支持。

#### 控制台 (`app/console/page.tsx`)

- 系统控制台。
- 日志查看器。
- 命令执行。
- 调试工具。

#### 日志页面 (`app/logs/page.tsx`)

- 活动日志查看器。
- 按级别、智能体、日期进行过滤。
- 搜索与导出。

#### 设置页面 (`app/settings/page.tsx`)

- 配置编辑器。
- 供应商设置。
- 渠道配置。
- 工作区设置。

**API 集成：**

- 调用后端的 REST API。
- 通过 SSE 事件流实现实时更新。
- 通过 SSE 获得类似 WebSocket 的体验。

---

## 数据流

### 消息处理流

```
1. 渠道接收消息
   ├─ Discord: discord-client.ts 接收消息
   ├─ Telegram: telegram-client.ts 接收消息
   ├─ WhatsApp: whatsapp-client.ts 接收消息
   └─ 飞书: feishu-client.ts 接收消息

2. 加入数据库队列
   └─ INSERT INTO queue_messages (channel, sender, message, status='pending')

3. 队列处理器认领消息
   └─ claimNextMessage() 带有行锁定

4. 解析路由
   ├─ 检查 @agent_id 前缀
   ├─ 检查 @team_name 前缀
   └─ 默认为 'default' (默认智能体)

5. 加载智能体配置
   ├─ getAgents() - 加载智能体配置
   ├─ getAgentContext() - 加载会话历史
   └─ 构建系统提示词和消息数组

6. 调用智能体 (LLM 调用)
   ├─ invokeAgent() - 调用 LLM 供应商
   ├─ 处理流式响应
   └─ 解析工具调用 (如果有)

7. 处理响应
   ├─ handleLongResponse() - 将长响应分块
   ├─ collectFiles() - 处理文件附件
   └─ 格式化为对应渠道格式

8. 检查团队提及
   ├─ extractTeammateMentions() - 解析 [@teammate: ...]
   ├─ 针对每个提及：
   │   └─ enqueueInternalMessage() - 创建内部消息
   └─ 追踪待处理队友

9. 向渠道发送响应
   ├─ enqueueResponse() - 在数据库中将响应排队
   └─ 渠道客户端发送响应

10. 完成消息处理
    ├─ completeMessage() - 将消息标记为已完成
    ├─ 更新会话状态
    └─ 发出事件 (向前端发送 SSE)

11. 团队协作 (如果适用)
    ├─ 等待所有内部消息完成
    ├─ 追踪待处理队友 (decrementPending())
    └─ 当全部完成时执行 completeConversation()
```

---

## 关键设计模式

### 1. 基于队列的处理

通过 SQLite 实现持久化消息队列，以保证可靠性和恢复能力。

### 2. 多智能体隔离

每个智能体拥有独立的工作目录和会话状态。

### 3. 通过提及进行团队编排

利用自然语言提及 (`[@teammate: ...]`) 驱动团队协作。

### 4. 统一渠道抽象

所有渠道归一化为通用的消息格式。

### 5. 支持热重载的配置

配置文件在每次收到消息时重新加载，支持动态更新。

### 6. 事件驱动的前端

通过 SSE 流实现 UI 的实时更新。

### 7. 插件/钩子系统

通过入站/出站钩子提供可扩展性。

---

## 外部依赖

| 依赖 | 用途 | 是否关键？ |
|------------|---------|-----------|
| hono | API 服务器 Web 框架 | ✅ 是 |
| better-sqlite3 | 嵌入式数据库 | ✅ 是 |
| discord.js | Discord 集成 | ✅ 是 |
| node-telegram-bot-api | Telegram 集成 | ✅ 是 |
| whatsapp-web.js | WhatsApp 集成 | ✅ 是 |
| dotenv | 环境变量管理 | ✅ 是 |
| ink | CLI 渲染器 (可视化工具) | ⚠️ 可选 |
| react | 前端 UI 库 | ✅ 是 |
| next | 前端框架 | ✅ 是 |

---

## 安全考虑

1. **渠道认证：** 每个渠道拥有独立的认证令牌。
2. **智能体隔离：** 智能体无法访问彼此的状态。
3. **输入验证：** 消息的消毒处理和验证。
4. **速率限制：** 针对每个渠道和智能体的速率限制。
5. **审计日志：** 记录所有消息和操作。
6. **配置安全：** 敏感数据存放在环境变量中。

---

## 测试策略

**测试文件：** 分布在 `src/` 和 `tinyclaw/tinyoffice/` 目录中。

**覆盖率：** 核心逻辑包含单元测试，渠道包含集成测试。

---

## 开发工作流

### 后端

```bash
cd tinyclaw
npm install          # 安装依赖
npm run build        # 编译 TypeScript
npm run discord      # 启动 Discord 客户端
npm run telegram     # 启动 Telegram 客户端
npm run whatsapp     # 启动 WhatsApp 客户端
npm run feishu       # 启动飞书客户端
npm run queue        # 启动队列处理器
```

### 前端 (TinyOffice)

```bash
cd tinyclaw/tinyoffice
npm install
npm run dev          # 开发服务器 (http://localhost:3000)
npm run build        # 生产构建
npm run start        # 生产启动
```

### 全栈运行

```bash
# 终端 1: 队列处理器
cd tinyclaw && npm run queue

# 终端 2: API 服务器 (由队列处理器自动启动)

# 终端 3: Discord 客户端
cd tinyclaw && npm run discord

# 终端 4: Telegram 客户端
cd tinyclaw && npm run telegram

# 终端 5: 前端
cd tinyclaw/tinyoffice && npm run dev
```

---

1. **Agent Marketplace:** Share and discover agents

---

_This architecture document was generated by the BMAD `document-project` workflow_
