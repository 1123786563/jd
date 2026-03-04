# TinyClaw - 组件清单

**所属部分：** tinyclaw
**上次更新：** 2026-03-03

---

## 概述

本文档记录了 TinyClaw 中的所有主要组件，包括渠道客户端、API 路由、智能体系统、团队编排以及数据库模式。

---

## 渠道客户端组件 (Channel Client Components)

### 1. Discord 客户端

**文件：** `src/channels/discord-client.ts`
**用途：** Discord 机器人集成
**关键函数：**

- 消息的接收与发送
- 用户和频道管理
- 文件附件支持
- 富媒体嵌入 (Rich embed) 格式化
**依赖关系：** discord.js
**执行方式：** `npm run discord`

### 2. Telegram 客户端

**文件：** `src/channels/telegram-client.ts`
**用途：** Telegram 机器人集成
**关键函数：**

- 消息处理 (文本、文件、命令)
- 会话 ID 管理
- 机器人命令支持 (/start, /help)
- 照片/文档发送
**依赖关系：** node-telegram-bot-api
**执行方式：** `npm run telegram`

### 3. WhatsApp 客户端

**文件：** `src/channels/whatsapp-client.ts`
**用途：** WhatsApp Web 集成
**关键函数：**

- QR 码身份验证
- 消息处理
- 群聊支持
- 媒体文件处理
**依赖关系：** whatsapp-web.js
**执行方式：** `npm run whatsapp`

### 4. 飞书客户端

**文件：** `src/channels/feishu-client.ts`
**用途：** 飞书 (Lark) 企业级消息推送
**关键函数：**

- 企业机器人身份验证
- 富媒体消息卡片
- 文件和图像支持
- 群聊管理
**依赖关系：** 飞书 SDK
**执行方式：** `npm run feishu`

---

## 核心引擎组件 (Core Engine Components)

### 5. 队列处理器 (Queue Processor)

**文件：** `src/queue-processor.ts`
**用途：** 中心消息处理引擎
**关键函数：**

- 从数据库队列提取消息
- 路由到智能体 (通过 `@agent_id` 或默认)
- 处理带有提及的团队会话
- 管理会话隔离
- 追踪待响应队友
- 完成会话
**依赖关系：** db.ts, routing.ts, conversation.ts, invoke.ts
**执行方式：** `npm run queue`

### 6. API 服务器

**文件：** `src/server/index.ts`
**用途：** 面向前端的 REST + SSE API
**关键函数：**

- 提供 HTTP 终端点
- 通过 SSE 流式传输事件
- 处理 CORS
- 错误处理与日志记录
**依赖关系：** hono, 所有路由文件
**端口：** 3777 (通过 TINYCLAW_API_PORT 配置)
**路由：**
- `/api/agents` - 智能体 CRUD
- `/api/teams` - 团队 CRUD
- `/api/messages` - 消息历史
- `/api/tasks` - 任务追踪
- `/api/logs` - 活动日志
- `/api/settings` - 全局配置
- `/api/queue/status` - 队列统计
- `/api/events/stream` - SSE 事件流

---

## API 路由组件

### 7. 智能体路由 (Agents Routes)

**文件：** `src/server/routes/agents.ts`
**终端点：**

- `GET /api/agents` - 列出所有智能体
- `GET /api/agents/:id` - 获取智能体详情
- `POST /api/agents` - 创建智能体
- `PUT /api/agents/:id` - 更新智能体
- `DELETE /api/agents/:id` - 删除智能体

### 8. 团队路由 (Teams Routes)

**文件：** `src/server/routes/teams.ts`
**终端点：**

- `GET /api/teams` - 列出所有团队
- `GET /api/teams/:id` - 获取团队详情
- `POST /api/teams` - 创建团队
- `PUT /api/teams/:id` - 更新团队
- `DELETE /api/teams/:id` - 删除团队

### 9. 消息路由 (Messages Routes)

**文件：** `src/server/routes/messages.ts`
**终端点：**

- `GET /api/messages` - 消息历史
- `POST /api/messages` - 向智能体/团队发送消息

### 10. 队列路由 (Queue Routes)

**文件：** `src/server/routes/queue.ts`
**终端点：**

- `GET /api/queue/status` - 队列统计
  - pending_count (等待处理数)
  - processing_count (处理中数)
  - completed_count (已完成数)
  - failed_count (失败数)

### 11. 任务路由 (Tasks Routes)

**文件：** `src/server/routes/tasks.ts`
**终端点：**

- `GET /api/tasks` - 列出任务
- `POST /api/tasks` - 创建任务
- 任务状态追踪

### 12. 日志路由 (Logs Routes)

**文件：** `src/server/routes/logs.ts`
**终端点：**

- `GET /api/logs` - 系统日志
- 过滤与分页

### 13. 设置路由 (Settings Routes)

**文件：** `src/server/routes/settings.ts`
**终端点：**

- `GET /api/settings` - 获取配置
- `PUT /api/settings` - 更新配置

### 14. 会话路由 (Chats Routes)

**文件：** `src/server/routes/chats.ts`
**终端点：**

- `GET /api/chats/:agentId` - 会话历史
- `DELETE /api/chats/:agentId` - 清除会话

### 15. SSE 管理器

**文件：** `src/server/sse.ts`
**用途：** 服务器发送事件 (SSE) 客户端管理
**关键函数：**

- `addSSEClient(client)` - 添加 SSE 客户端
- `removeSSEClient(client)` - 移除 SSE 客户端
- `broadcastEvent(event)` - 向所有客户端广播
**事件：**
- `message_received` - 从渠道收到消息
- `agent_routed` - 消息已路由至智能体
- `task_updated` - 任务状态已变更
- `agent_responded` - 智能体已生成响应
- `conversation_completed` - 团队会话已结束

---

## 智能体系统组件 (Agent System Components)

### 16. 智能体管理器 (Agent Manager)

**文件：** `src/lib/agent.ts`
**用途：** 智能体配置与生命周期
**关键函数：**

- 从文件加载智能体配置
- 验证智能体配置
- 按 ID 获取智能体
- 列出所有智能体

### 17. 智能体调用器 (Agent Invoker)

**文件：** `src/lib/invoke.ts`
**用途：** 调用 LLM 并处理响应
**关键函数：**

- `invokeAgent(agent, message, context)` - 调用 LLM
- 构建会话历史
- 处理流式响应
- 解析并执行工具调用
- 保存会话状态
**依赖关系：** config.ts, conversation.ts

### 18. 响应处理器 (Response Handler)

**文件：** `src/lib/response.ts`
**用途：** 处理智能体响应和文件附件
**关键函数：**

- `handleLongResponse(response)` - 将长响应分块
- `collectFiles(response)` - 处理文件附件
- 格式化针对渠道的输出
**依赖关系：** 无

---

## 团队编排组件 (Team Orchestration Components)

### 19. 路由解析器 (Routing Parser)

**文件：** `src/lib/routing.ts`
**用途：** 解析智能体和团队路由
**关键函数：**

- `parseAgentRouting(message, agents, teams)` - 解析 `@agent` 或 `@team`
- `findTeamForAgent(agentId, teams)` - 为智能体查找团队
- `extractTeammateMentions(message)` - 提取 `[@teammate: ...]`
**返回值：** { agentId, message, isTeam }

### 20. 会话管理器 (Conversation Manager)

**文件：** `src/lib/conversation.ts`
**用途：** 管理会话状态与隔离
**关键函数：**

- `withConversationLock(id, fn)` - 锁定会话内容
- `enqueueInternalMessage()` - 创建内部消息
- `completeConversation()` - 标记会话完成
- `incrementPending()` - 追踪待处理队友数
- `decrementPending()` - 递减待处理数
**状态：** 带有团队上下文的 conversations Map

---

## 持久化组件 (Persistence Components)

### 21. 数据库管理器 (Database Manager)

**文件：** `src/lib/db.ts`
**用途：** SQLite 数据库操作
**关键函数：**

#### 队列操作 (Queue Operations)

- `initQueueDb()` - 初始化数据库和表
- `claimNextMessage()` - 获取下一条待处理消息 (带有锁定机制)
- `completeMessage(id)` - 将消息标记为已完成
- `failMessage(id, error)` - 将消息标记为失败
- `enqueueResponse(response)` - 将待发送响应加入队列
- `recoverStaleMessages()` - 恢复卡住的消息

#### 查询操作 (Query Operations)

- `getPendingAgents()` - 获取包含等待处理消息的智能体
- `pruneAckedResponses()` - 清理已确认的响应
- `pruneCompletedMessages()` - 归档已完成的消息

**数据表：**

- `queue_messages` - 带有状态的消息队列
- `agent_state` - 智能体配置与状态
- `teams` - 团队定义
- `tasks` - 任务追踪
- `logs` - 活动日志

**事件：**

- `queueEvents.on('messageClaimed')` - 消息已被认领
- `queueEvents.on('messageCompleted')` - 消息已完成

---

## 配置组件 (Configuration Components)

### 22. 配置加载器 (Config Loader)

**文件：** `src/lib/config.ts`
**用途：** 加载与管理配置
**关键函数：**

- `getSettings()` - 从文件加载设置
- `getAgents(settings)` - 加载并合并智能体配置
- `getTeams(settings)` - 加载团队定义
- `saveSettings(settings)` - 持久化设置
- `saveAgents(agents)` - 持久化智能体配置
- `saveTeams(teams)` - 持久化团队定义

**配置文件：**

- `tinyclaw.settings.json` - 主设置文件
- `tinyclaw.agents.json` - 智能体配置文件
- `tinyclaw.teams.json` - 团队定义文件

**核心功能：**

- 热重载 (针对每条消息重新加载配置)
- 默认智能体备选方案 (Fallback)
- 工作区目录管理

---

## 日志组件 (Logging Components)

### 23. 日志记录器 (Logger)

**文件：** `src/lib/logging.ts`
**用途：** 全系统的日志记录与事件发出
**关键函数：**

- `log(level, message)` - 记录消息
- `emitEvent(event, data)` - 发出事件 (SSE)
**日志级别：**
- `INFO` - 正常运行
- `WARN` - 警告
- `ERROR` - 错误

**日志文件：** `logs/tinyclaw.log`

---

## 插件系统组件 (Plugin System Components)

### 24. 插件加载器 (Plugin Loader)

**文件：** `src/lib/plugins.ts`
**用途：** 可扩展的钩子系统 (Hook system)
**关键函数：**

- `loadPlugins()` - 从目录加载插件
- `runIncomingHooks(message)` - 运行入站钩子
- `runOutgoingHooks(response)` - 运行出站钩子

**钩子类型：**

#### 入站钩子 (Incoming Hooks)

- `onMessageReceived(message)` - 在智能体处理前执行
- 可以修改或拒绝消息

#### 出站钩子 (Outgoing Hooks)

- `onAgentResponse(response)` - 在发送响应前执行
- 可以修改或记录响应

**插件接口：**

```typescript
{
  name: string;
  onMessageReceived?: (msg) => Promise<MessageData | null>;
  onAgentResponse?: (res) => Promise<ResponseData>;
}
```

---

## 类型定义 (Type Definitions)

### 25. 类型系统

**文件：** `src/lib/types.ts`
**用途：** TypeScript 类型定义

**关键类型：**

#### MessageData

```typescript
{
  channel: string;        // discord, telegram, whatsapp, feishu
  sender: string;         // 用户标识符
  senderId?: string;      // 平台特定的用户 ID
  message: string;        // 消息内容
  timestamp: number;      // Unix 时间戳
  messageId: string;      // 平台消息 ID
  agent?: string;         // 目标智能体 ID
  files?: string[];       // 文件路径
  conversationId?: string; // 会话分组
  fromAgent?: string;     // 内部：发送方智能体
}
```

#### Conversation

```typescript
{
  id: string;             // 会话 ID
  messages: Message[];    // 消息历史记录
  agentId: string;        // 当前智能体
  teamContext?: {         // 团队上下文 (如果适用)
    teamId: string;
    team: TeamConfig;
  };
  pendingTeammates: number; // 待响应队友数
  createdAt: number;
  updatedAt: number;
}
```

#### TeamConfig

```typescript
{
  name: string;           // 团队名称
  leader_agent: string;   // 负责人智能体 ID
  agents: string[];       // 智能体 ID 数组
  description?: string;   // 团队描述
  config?: any;           // 附加配置
}
```

---

## TinyOffice 前端组件 (TinyOffice Frontend Components)

### 26. Next.js App 页面

**位置：** `tinyclaw/tinyoffice/app/`

#### 仪表盘 (`page.tsx`)

- 系统概览
- 队列状态图表
- 活跃智能体列表
- 最近活动摘要

#### 智能体页面 (`agents/page.tsx`)

- 智能体列表项
- 创建/编辑/删除表单
- 智能体状态指示器
- 会话历史查看器

#### 团队页面 (`teams/page.tsx`)

- 团队列表表格
- 团队成员管理
- 创建/编辑/删除表单
- 团队会话历史

#### 任务页面 (`tasks/page.tsx`)

- 带有过滤功能的任务列表
- 创建/分配任务
- 状态追踪 (等待、处理中、已完成)
- 截止日期管理

#### 聊天页面

- `chat/agent/[id]/page.tsx` - 智能体对话界面
- `chat/team/[id]/page.tsx` - 团队对话界面
- 实时消息显示
- 消息发送表单
- 文件附件支持

#### 控制台页面 (`console/page.tsx`)

- 系统控制台
- 带有过滤功能的日志查看器
- 命令执行
- 调试工具

#### 日志页面 (`logs/page.tsx`)

- 活动日志查看器
- 按级别、智能体、日期范围过滤
- 搜索功能
- 导出为 CSV/JSON

#### 设置页面 (`settings/page.tsx`)

- 配置文件编辑器
- 供应商设置表单
- 渠道配置
- 工作区设置

### 27. 前端库 (Frontend Libraries)

**位置：** `tinyclaw/tinyoffice/src/lib/`

前端与后端共享的代码：

- API 客户端实用工具
- 类型定义
- 辅助函数
- 验证算法

---

## 可视化组件 (Visualizer Components)

### 28. 团队可视化工具 (Team Visualizer)

**位置：** `src/visualizer/`
**用途：** 团队会话的可视化展现
**功能：**

- 团队交互的图谱 (Graph) 可视化
- 会话流向图
- 智能体提及追踪
- 实时更新

**执行方式：** `npm run visualize`

---

## 关键模式 (Key Patterns)

### 基于队列的处理模式

渠道 (Channel) → 队列 (等待处理) → 处理器 → 智能体 → 响应 → 渠道

### 通过提及进行团队编排模式

自然语言提及 (`[@teammate: ...]`) 驱动协作过程

### 支持热重载的配置模式

每次消息处理时重新加载配置，实现动态更新

### 统一渠道抽象模式

所有渠道消息均归一化为通用格式

### 事件驱动的前端模式

通过 SSE 流实现 UI 的实时更新

---

## 外部集成 (External Integrations)

| 集成项 | 软件包 (Package) | 用途 |
|------------|---------|---------|
| Discord | discord.js | Discord 机器人 API |
| Telegram | node-telegram-bot-api | Telegram 机器人 API |
| WhatsApp | whatsapp-web.js | WhatsApp Web API |
| 飞书 (Feishu) | 飞书 SDK | 飞书企业 API |
| LLM 供应商 | openai, anthropic | 语言模型 API |
| 数据库 | better-sqlite3 | 嵌入式数据库 |
| Web 框架 | hono | API 服务器框架 |
| 前端 | next, react | Web UI 框架 |

---

_本组件清单由 BMAD `document-project` 工作流生成_
