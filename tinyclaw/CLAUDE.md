# TinyClaw - Multi-team Personal Assistant

多团队、多渠道 24/7 AI 助手系统，支持 Telegram、WhatsApp、Discord 等平台。

## 项目结构

```
tinyclaw/
├── src/
│   ├── channels/          # 消息渠道
│   │   ├── whatsapp-client.ts
│   │   ├── discord-client.ts
│   │   ├── telegram-client.ts
│   │   └── feishu-client.ts
│   ├── queue-processor.ts # 消息队列处理
│   └── ...
├── tinyoffice/            # Next.js 前端控制面板
│   ├── src/
│   │   ├── app/           # Next.js App Router 页面
│   │   └── components/    # React 组件
│   └── ...
├── lib/                   # 共享库
├── .tinyclaw/             # TinyClaw 配置
│   └── SOUL.md            # Agent 个性定义
├── AGENTS.md              # Agent 团队配置
└── tinyclaw.sh            # 启动脚本
```

## 技术栈

### 后端
- **运行时**: Node.js
- **语言**: TypeScript
- **Web 框架**: Hono
- **数据库**: better-sqlite3
- **消息平台**: Discord.js, node-telegram-bot-api, whatsapp-web.js

### 前端 (TinyOffice)
- **框架**: Next.js 16 (App Router)
- **UI**: React 19, Radix UI
- **样式**: Tailwind CSS 4
- **拖拽**: dnd-kit

## 常用命令

### 后端

```bash
npm install           # 安装依赖
npm run build         # 编译
npm run whatsapp      # 启动 WhatsApp 客户端
npm run discord       # 启动 Discord 客户端
npm run telegram      # 启动 Telegram 客户端
npm run feishu        # 启动飞书客户端
npm run queue         # 启动队列处理器
npm run visualize     # 启动团队可视化
```

### 前端 (TinyOffice)

```bash
cd tinyoffice
npm install           # 安装依赖
npm run dev           # 开发模式
npm run build         # 构建
npm run start         # 生产模式
npm run lint          # ESLint 检查
```

## Agent 团队通信

TinyClaw 支持多 Agent 协作，使用标签格式进行团队通信：

```text
[@agent_id: message]           # 发送给单个 Agent
[@agent1,agent2: message]      # 发送给多个 Agent
```

详细配置见 [AGENTS.md](./AGENTS.md)

## 文件交换

- **接收文件**: 用户发送的文件自动保存到 `.tinyclaw/files/`
- **发送文件**: 使用 `[send_file: /absolute/path/to/file]` 标签

## 开发规范

1. 保持消息处理逻辑简洁
2. 新增渠道需实现统一接口
3. 使用 TypeScript 类型安全
4. 更新 SOUL.md 定义 Agent 个性

## 相关文档

- [AGENTS.md](./AGENTS.md) - Agent 团队配置
- [SOUL.md](./SOUL.md) - Agent 个性定义
- [tinyoffice/README.md](./tinyoffice/README.md) - 前端文档
