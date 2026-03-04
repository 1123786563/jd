# TinyClaw - 开发指南

**所属部分：** tinyclaw
**上次更新：** 2026-03-03

---

## 前置条件

- **Node.js** >= 20.0.0
- **npm** 包管理器
- **Git** 版本控制工具
- **渠道 API 密钥 (Channel API Keys):**
  - Discord 机器人令牌 (可选)
  - Telegram 机器人令牌 (可选)
  - WhatsApp Web 凭据 (可选)
  - 飞书机器人凭据 (可选)

---

## 快速入门

### 1. 克隆并安装

```bash
cd tinyclaw
npm install
```

### 2. 配置设置

编辑 `tinyclaw.settings.json`:

```json
{
  "workspace": {
    "path": "~/tinyclaw-workspace"
  },
  "llm": {
    "default_provider": "claude",
    "default_model": "claude-3-opus",
    "providers": {
      "claude": {
        "api_key": "sk-ant-..."
      },
      "openai": {
        "api_key": "sk-..."
      }
    }
  },
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_DISCORD_BOT_TOKEN"
    },
    "telegram": {
      "enabled": true,
      "token": "YOUR_TELEGRAM_BOT_TOKEN"
    },
    "whatsapp": {
      "enabled": false
    },
    "feishu": {
      "enabled": false
    }
  }
}
```

### 3. 配置智能体 (Agents)

编辑 `tinyclaw.agents.json`:

```json
{
  "default": {
    "name": "General Assistant",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are a helpful AI assistant...",
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

### 4. 配置团队 (Teams - 可选)

编辑 `tinyclaw.teams.json`:

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

### 5. 构建与运行

```bash
npm run build              # 编译 TypeScript
npm run queue              # 启动队列处理器
npm run discord            # 启动 Discord 客户端
npm run telegram           # 启动 Telegram 客户端
npm run whatsapp           # 启动 WhatsApp 客户端
npm run feishu             # 启动 飞书客户端
```

### 6. 启动前端

```bash
cd tinyclaw/tinyoffice
npm install
npm run dev                # 访问 http://localhost:3000
```

---

## 项目结构

```text
tinyclaw/
├── src/                    # 后端源代码
│   ├── channels/           # 渠道集成
│   │   ├── discord-client.ts
│   │   ├── telegram-client.ts
│   │   ├── whatsapp-client.ts
│   │   └── feishu-client.ts
│   ├── server/             # API 服务器
│   │   ├── index.ts        # 服务器入口
│   │   ├── sse.ts          # SSE 事件流
│   │   └── routes/         # API 路由处理器
│   │       ├── agents.ts
│   │       ├── teams.ts
│   │       ├── messages.ts
│   │       ├── queue.ts
│   │       ├── tasks.ts
│   │       ├── logs.ts
│   │       ├── settings.ts
│   │       └── chats.ts
│   ├── lib/                # 共享库
│   │   ├── agent.ts        # 智能体管理
│   │   ├── config.ts       # 配置加载
│   │   ├── conversation.ts # 会话状态管理
│   │   ├── db.ts           # 数据库操作
│   │   ├── invoke.ts       # 智能体调用
│   │   ├── logging.ts      # 日志系统
│   │   ├── pairing.ts      # 智能体配对
│   │   ├── plugins.ts      # 插件系统
│   │   ├── response.ts     # 响应处理
│   │   ├── routing.ts      # 消息路由
│   │   └── types.ts        # 类型定义
│   ├── queue-processor.ts  # 队列处理器 (主程序)
│   └── visualizer/         # 可视化工具 (可选)
├── tinyoffice/             # Next.js 前端界面
│   ├── app/                # Next.js 应用页面
│   │   ├── agents/         # 智能体页面
│   │   ├── teams/          # 团队页面
│   │   ├── tasks/          # 任务页面
│   │   ├── chat/           # 对话页面
│   │   │   ├── agent/[id]/ # 智能体对话
│   │   │   └── team/[id]/  # 团队对话
│   │   ├── office/         # 仪表盘
│   │   ├── console/        # 系统控制台
│   │   ├── logs/           # 日志查看器
│   │   ├── settings/       # 设置页面
│   │   └── page.tsx        # 首页
│   ├── src/
│   │   └── lib/            # 前后端共享代码
│   ├── public/             # 静态资源
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
├── dist/                   # 后端编译产物
├── examples/               # 使用示例
├── lib/                    # 共享库
├── tinyclaw.settings.json  # 基础设置配置
├── tinyclaw.agents.json    # 智能体配置
├── tinyclaw.teams.json     # 团队配置
├── package.json
└── tsconfig.json
```

---

## 开发流程

### 后端开发

```bash
cd tinyclaw
npm install                # 安装依赖
npm run build              # 编译 TypeScript
npm run build:watch        # 监听模式编译
npm run queue              # 运行队列处理器
npm run discord            # 运行 Discord 客户端
npm run telegram           # 运行 Telegram 客户端
npm run whatsapp           # 运行 WhatsApp 客户端
npm run feishu             # 运行 飞书客户端
npm run visualize          # 运行可视化工具
```

### 前端开发

```bash
cd tinyclaw/tinyoffice
npm install                # 安装依赖
npm run dev                # 启动开发服务器
npm run build              # 生产环境构建
npm run start              # 启动生产环境服务器
npm run lint               # 代码检查
```

### 全栈开发

同时打开多个终端：

```bash
# 终端 1: 队列处理器
cd tinyclaw && npm run queue

# 终端 2: Discord 客户端
cd tinyclaw && npm run discord

# 终端 3: Telegram 客户端
cd tinyclaw && npm run telegram

# 终端 4: 前端界面
cd tinyclaw/tinyoffice && npm run dev
```

---

## 配置说明

### 设置文件 (`tinyclaw.settings.json`)

```json
{
  "workspace": {
    "path": "~/tinyclaw-workspace"        # 工作目录
  },
  "llm": {
    "default_provider": "claude",         # 默认 LLM 供应商
    "default_model": "claude-3-opus",     # 默认模型
    "providers": {
      "claude": {
        "api_key": "sk-ant-...",          # Claude API 密钥
        "base_url": "https://api.anthropic.com"
      },
      "openai": {
        "api_key": "sk-...",              # OpenAI API 密钥
        "base_url": "https://api.openai.com"
      }
    }
  },
  "channels": {
    "discord": {
      "enabled": true,                    # 启用 Discord
      "token": "BOT_TOKEN"                # Discord 机器人令牌
    },
    "telegram": {
      "enabled": true,                    # 启用 Telegram
      "token": "BOT_TOKEN"                # Telegram 机器人令牌
    },
    "whatsapp": {
      "enabled": false                    # 启用 WhatsApp
    },
    "feishu": {
      "enabled": false                    # 启用 飞书
    }
  },
  "queue": {
    "max_retries": 3,                     # 最大重试次数
    "retry_delay": 5000                   # 重试延迟 (毫秒)
  }
}
```

### 智能体文件 (`tinyclaw.agents.json`)

```json
{
  "default": {
    "name": "General Assistant",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are a helpful AI assistant...",
    "working_dir": "agents/default",
    "temperature": 0.7,
    "max_tokens": 4096,
    "tools": []                           # 可用工具列表
  },
  "agent-technical": {
    "name": "Technical Support",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are a technical support expert...",
    "working_dir": "agents/technical",
    "temperature": 0.3,
    "tools": ["search_docs", "run_command"]
  }
}
```

### 团队文件 (`tinyclaw.teams.json`)

```json
{
  "team-support": {
    "name": "Support Team",
    "leader_agent": "agent-support-lead",
    "agents": [
      "agent-support-lead",
      "agent-technical",
      "agent-billing"
    ],
    "description": "Customer support team",
    "rules": {
      "timeout": 300,                     # 超时时间 (秒)
      "max_mentions": 5                   # 最大队友提及数
    }
  }
}
```

---

## 添加新功能

### 1. 添加新智能体 (Agent)

编辑 `tinyclaw.agents.json`:

```json
{
  "my-agent": {
    "name": "My Custom Agent",
    "provider": "claude",
    "model": "claude-3-opus",
    "system_prompt": "You are specialized in...",
    "working_dir": "agents/my-agent",
    "temperature": 0.7
  }
}
```

发送消息测试：`@my-agent Hello!`

### 2. 添加新团队 (Team)

编辑 `tinyclaw.teams.json`:

```json
{
  "my-team": {
    "name": "My Team",
    "leader_agent": "agent-lead",
    "agents": ["agent-lead", "agent-member1", "agent-member2"],
    "description": "My custom team"
  }
}
```

发送消息测试：`@my-team Help me with...`

### 3. 添加新渠道 (Channel)

在 `src/channels/my-channel.ts` 中创建渠道客户端：

```typescript
import { MessageData } from '../lib/types';
import { log } from '../lib/logging';

export class MyChannelClient {
  async start(): Promise<void> {
    // 连接到渠道
    log('INFO', 'MyChannel connected');

    // 监听消息
    this.onMessage((message: MessageData) => {
      // 处理消息
      log('INFO', `Received: ${message.message}`);
    });
  }

  async sendMessage(recipient: string, message: string): Promise<void> {
    // 向渠道发送消息
  }

  private onMessage(callback: (msg: MessageData) => void): void {
    // 消息处理器
  }
}
```

在 `package.json` 中添加启动脚本：

```json
{
  "scripts": {
    "my-channel": "node dist/channels/my-channel.js"
  }
}
```

### 4. 添加插件/钩子 (Plugin/Hook)

在 `plugins/my-plugin.ts` 中创建插件：

```typescript
import { Plugin } from '../lib/plugins';

export const myPlugin: Plugin = {
  name: 'my-plugin',
  onMessageReceived: async (message) => {
    // 修改或拒绝消息
    if (message.message.includes('badword')) {
      return null; // 拒绝消息
    }
    return message; // 接受消息
  },
  onAgentResponse: async (response) => {
    // 发送前修改响应
    response.message += '\n\n— My Plugin';
    return response;
  }
};
```

在 `src/lib/plugins.ts` 中注册：

```typescript
export function loadPlugins() {
  return [
    // ... 现有插件
    myPlugin,
  ];
}
```

---

## 调试

### 日志级别

日志记录在 `logs/tinyclaw.log`：

```bash
tail -f logs/tinyclaw.log              # 实时查看日志
grep "ERROR" logs/tinyclaw.log         # 查看错误日志
grep "agent-technical" logs/tinyclaw.log # 按智能体过滤日志
```

### 调试队列

```bash
sqlite3 tinyclaw.db
.tables                                # 列出表
SELECT * FROM queue_messages WHERE status='pending';  # 查询待处理消息
SELECT * FROM queue_messages WHERE status='failed';   # 查询失败消息
SELECT COUNT(*) FROM queue_messages;   # 查询消息总数
```

### 调试 API

```bash
# 获取队列状态
curl http://localhost:3777/api/queue/status

# 列出智能体
curl http://localhost:3777/api/agents

# 列出团队
curl http://localhost:3777/api/teams

# 发送测试消息
curl -X POST http://localhost:3777/api/messages \
  -H "Content-Type: application/json" \
  -d '{"agent": "default", "message": "Hello"}'
```

---

## 常用任务

### 重置所有数据

```bash
rm -rf tinyclaw.db
rm -rf tinyclaw-workspace/
rm -rf logs/
npm run queue  # 重新创建数据库
```

### 添加渠道机器人 (Bot)

**Discord:**

1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)
2. 创建新应用 (Application)
3. 添加 Bot 并复制 Token
4. 将 Token 更新到 `tinyclaw.settings.json`

**Telegram:**

1. 在 Telegram 上联系 @BotFather
2. 使用 `/newbot` 创建新机器人
3. 复制 Token
4. 将 Token 更新到 `tinyclaw.settings.json`

### 测试团队会话

向团队发送消息：

```text
@team-support I need help with my account
```

负责人智能体 (Leader agent) 接收消息并可以提及队友：

```text
[@agent-technical: Can you check the account status?]
[@agent-billing: Can you verify the payment?]
```

### 监控队列

通过 API：

```bash
curl http://localhost:3777/api/queue/status | jq
```

通过前端界面：

1. 访问 `http://localhost:3000`
2. 进入仪表盘 (Dashboard)
3. 查看队列统计信息

### 导出数据

```bash
sqlite3 tinyclaw.db .dump > backup.sql           # 导出数据库
cp -r tinyclaw-workspace/ backup-workspace/      # 导出工作区
cp logs/tinyclaw.log backup-log.txt              # 导出日志
```

---

## 测试

### 手动测试

1. 启动队列处理器：`npm run queue`
2. 启动渠道客户端：`npm run discord`
3. 从 Discord/Telegram 发送消息
4. 观察日志：`tail -f logs/tinyclaw.log`
5. 检查数据库：`sqlite3 tinyclaw.db`

### 前端测试

1. 启动前端：`cd tinyoffice && npm run dev`
2. 访问 `http://localhost:3000`
3. 测试所有页面和功能
4. 检查浏览器控制台是否有错误

### API 测试

```bash
# 测试智能体接口
curl http://localhost:3777/api/agents

# 测试团队接口
curl http://localhost:3777/api/teams

# 测试消息发送接口
curl -X POST http://localhost:3777/api/messages \
  -H "Content-Type: application/json" \
  -d '{"agent": "default", "message": "test"}'

# 测试 SSE 事件流
curl http://localhost:3777/api/events/stream
```

---

## 架构模式

### 基于队列的处理模式

所有消息都经过 SQLite 队列：

```text
渠道 (Channel) → 队列 (等待处理) → 处理器 (Processor) → 智能体 (Agent) → 响应 → 渠道
```

优势：

- 可靠性 (持久化队列)
- 重试逻辑 (针对失败消息)
- 负载均衡 (支持多个处理器)
- 恢复能力 (过时消息检测)

### 通过提示进行团队编排模式

通过自然语言提及实现团队协作：

```text
用户: @team-support Help me
负责人 (Leader): [@agent-technical: Check this]
技术支持 (Technical): [@agent-billing: Verify payment]
账单支持 (Billing): Payment confirmed
负责人 (Leader): 用户，一切正常！
```

优势：

- 自然语言交互界面
- 灵活的团队结构
- 异步协作
- 完整的会话追踪

### 支持热重载的配置模式

针对每条消息重新加载配置：

```typescript
// 在每条消息处理时
const settings = getSettings();  // 从文件实时获取
const agents = getAgents(settings);  // 从文件实时获取
```

优势：

- 配置修改无需重启
- 动态的智能体/团队更新
- 极佳的运行时灵活性

---

## 最佳实践

1. **类型安全：** 严格使用 TypeScript
2. **错误处理：** 捕获并记录所有错误
3. **幂等性：** 队列消息应保持幂等性
4. **测试：** 分别测试每个渠道
5. **监控：** 密切关注队列和日志
6. **安全性：** 将 API 密钥保留在环境变量中
7. **文档：** 记录自定义智能体和团队的逻辑

---

## 相关资源

- [架构文档 (中文)](./architecture-tinyclaw.md)
- [源码树分析 (中文)](./source-tree-analysis.md)
- [项目概览 (中文)](./project-overview.md)
- [tinyclaw/ARCHITECTURE.md](../tinyclaw/ARCHITECTURE.md) - 详细架构设计
- [tinyclaw/DOCUMENTATION.md](../tinyclaw/DOCUMENTATION.md) - 项目文档
- [tinyclaw/CONFIG_GUIDE.md](../tinyclaw/CONFIG_GUIDE.md) - 配置指南
- [tinyclaw/CLAUDE.md](../tinyclaw/CLAUDE.md) - 项目指南

---

_本开发指南由 BMAD `document-project` 工作流生成_
