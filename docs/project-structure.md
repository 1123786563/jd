# JD - 项目结构分析

**日期：** 2026-03-04
**扫描级别：** 完全扫描
**模式：** 完全重新扫描

---

## 项目结构概览

**JD** 是一个包含两个主要子项目的 Monorepo，每个子项目都是一个独立的自主 AI Agent 系统：

1. **Conway Automaton** - Sovereign AI Agent 运行时
2. **TinyClaw** - 多团队、多渠道个人助手平台

---

## 存储库类型

- **类型：** Monorepo（多项目单一仓库）
- **部分数量：** 2 个独立部分
- **语言：** TypeScript（主语言）
- **架构：** 多智能体自主系统

---

## Conway Automaton (automaton/)

### 项目分类

- **项目类型：** Web 后端应用（AI Agent 运行时）
- **位置：** `automaton/`
- **入口点：** `src/index.ts`
- **目的：** 具有 Web3 集成、Conway API 计费和自我修改能力的主权 AI Agent 运行时
- **技术栈：** TypeScript, Express, OpenAI, viem (Ethereum), better-sqlite3, pnpm

### 关键依赖

- **运行时：** Express 5.2.1
- **AI/LLM：** OpenAI 6.24.0, siwe 2.3.0
- **区块链：** viem 2.44.2 (Ethereum)
- **数据库：** better-sqlite3 11.0.0
- **开发工具：** Vitest, TypeScript, tsx

### package.json 概要

```json
{
  "name": "@conway/automaton",
  "version": "0.2.1",
  "type": "module",
  "scripts": {
    "build": "tsc && pnpm -r build",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "packageManager": "pnpm@10.28.1"
}
```

---

## TinyClaw (tinyclaw/)

### 项目分类

- **项目类型：** 全栈 Web 应用（多渠道助手）
- **位置：** `tinyclaw/`
- **入口点：** 后端: `src/queue-processor.ts`, 前端: `tinyoffice/app/page.tsx`
- **目的：** 集成 Discord, Telegram, WhatsApp 和飞书的多团队个人助手
- **技术栈：** TypeScript, Hono (后端), Discord.js, Telegram API, WhatsApp, 飞书

### 关键依赖

- **Web 框架：** Hono 4.12.1, @hono/node-server 1.19.9
- **消息平台：** discord.js 14.16.0, node-telegram-bot-api 0.67.0, whatsapp-web.js 1.34.6
- **数据库：** better-sqlite3 12.6.2
- **UI (tinyoffice)：** React 19.2.4, Next.js 16, Tailwind CSS 4, Radix UI

### package.json 概要

```json
{
  "name": "tinyclaw",
  "version": "0.0.7",
  "scripts": {
    "build": "tsc && tsc -p tsconfig.visualizer.json",
    "whatsapp": "node dist/channels/whatsapp-client.js",
    "discord": "node dist/channels/discord-client.js",
    "telegram": "node dist/channels/telegram-client.js",
    "feishu": "node dist/channels/feishu-client.js",
    "queue": "node dist/queue-processor.js",
    "visualize": "node dist/visualizer/team-visualizer.js"
  }
}
```

---

## 整体架构模式

### Conway Automaton 架构

- **模式：** 具有多层记忆的自主智能体运行时
- **特点：**
  - 自我复制能力
  - Web3 集成（Ethereum/SIWE）
  - Conway API 计费系统
  - 持久化记忆存储
  - Agent 注册表

### TinyClaw 架构

- **模式：** 具有团队编排功能的多渠道消息平台
- **特点：**
  - 多渠道客户端（Discord, Telegram, WhatsApp, 飞书）
  - 消息队列处理器
  - 团队协调引擎
  - Web 可视化控制面板
  - 持久化记忆存储

---

## 共享特征

尽管 **Automaton** 和 **TinyClaw** 在架构上是独立的，但它们共享共同的设计理念：

1. **以智能体为中心的架构：** 两者都实现了自主 AI 智能体系统
2. **持久化记忆：** 两者都使用 better-sqlite3 进行状态持久化
3. **TypeScript 生态系统：** 一致的语言和工具链
4. **LLM 集成：** 两者都利用大语言模型提供智能能力
5. **自主决策：** 两者都具有自我驱动的决策循环

---

## 集成点

- **智能体模式和最佳实践** 的共同理解
- **通用基础设施模式** (SQLite, TypeScript, npm/pnpm)
- **自主系统设计** 上的概念一致性
- **跨项目智能体协作** 的潜力（未来扩展）

---

## 文件组织

### Conway Automaton 文件结构

```
automaton/
├── src/
│   ├── agent/          # Agent 核心逻辑
│   ├── api/            # API 路由
│   ├── config/         # 配置管理
│   ├── conway/         # Conway API 集成
│   ├── git/            # Git 操作
│   ├── heartbeat/      # 心跳机制
│   ├── identity/       # 身份管理
│   ├── inference/      # 推理引擎
│   ├── memory/         # 记忆系统（多层）
│   ├── observability/  # 可观测性
│   ├── ollama/         # Ollama LLM 集成
│   ├── orchestration/  # 编排引擎
│   ├── registry/       # Agent 注册表
│   ├── replication/    # 自我复制
│   ├── self-mod/       # 自我修改
│   ├── state/          # 状态管理
│   └── index.ts        # 入口点
├── tests/              # 测试
└── package.json
```

### TinyClaw 文件结构

```
tinyclaw/
├── src/
│   ├── channels/           # 多渠道客户端（Discord, Telegram, WhatsApp, 飞书）
│   ├── lib/                # 共享库
│   ├── server/             # HTTP 服务器
│   ├── queue-processor.ts  # 队列处理器（入口点）
│   └── visualizer/         # 团队可视化
├── tinyoffice/             # Next.js 前端控制面板
└── package.json
```

---

## 下一步

完成项目结构分析后，工作流将继续：

- **Step 2：** 发现现有文档并收集用户上下文
- **Step 3：** 分析每个部分的技术栈
- **Step 4：** 基于项目类型要求进行条件分析
- ... 依此类推，直到完成完整的文档生成

---

_生成使用 BMAD 方法 `document-project` 工作流_
