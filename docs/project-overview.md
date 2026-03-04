# JD - 项目概览

**日期：** 2026-03-03
**类型：** Monorepo (多部分 Web 项目)
**架构：** 多智能体自主系统

---

## 执行摘要

**JD** 是一个多项目 monorepo，包含两个复杂的自主 AI 智能体系统：

1. **Conway Automaton** - 一个主权、自复制的 AI 智能体运行时，具有 Web3 集成、多层记忆系统和基于策略的安全控制。专为自主运行而设计，具备财务能力和代码自我修改能力。

2. **TinyClaw** - 一个多团队、多渠道的 24/7 AI 助手平台，支持 Discord、Telegram、WhatsApp 和飞书 (Lark)。包含一个 Next.js 控制面板 (TinyOffice)，用于团队编排和智能体管理。

这两个项目都实现了先进的 AI 智能体架构，具有持久化记忆、自主决策和多渠道通信能力。

---

## 项目分类

- **存储库类型：** Monorepo
- **项目类型：** Web (后端 + 前端)
- **主要语言：** TypeScript
- **架构模式：** 多智能体系统，受微服务启发

---

## 多部分结构

本项目由 **2** 个不同的部分组成：

### Conway Automaton

- **类型：** 后端 Web 应用程序 (AI 智能体运行时)
- **位置：** `automaton/`
- **用途：** 主权 AI 智能体运行时，具有 Web3 集成、Conway API 计费和自我修改能力
- **技术栈：** TypeScript, Express, OpenAI, viem (Ethereum), better-sqlite3, pnpm

### TinyClaw

- **类型：** 全栈 Web 应用程序 (多渠道助手)
- **位置：** `tinyclaw/`
- **用途：** 多团队个人助手，集成 Discord, Telegram, WhatsApp 和飞书
- **技术栈：** TypeScript, Hono (后端), Next.js 16 + React 19 (前端), Tailwind CSS 4, Radix UI

---

## 各部分如何集成

虽然 **Automaton** 和 **TinyClaw** 在架构上是独立的，可以分别运行，但它们共享共同的设计理念：

1. **以智能体为中心的架构：** 两者都实现了自主 AI 智能体系统
2. **持久化记忆：** 两者都使用 better-sqlite3 进行状态持久化
3. **TypeScript 生态系统：** 一致的语言和工具链
4. **LLM 集成：** 两者都利用大语言模型提供智能能力

**集成点：**

- 对智能体模式和最佳实践的共同理解
- 通用的基础设施模式 (SQLite, TypeScript, npm/pnpm)
- 自主系统设计上的概念一致性
- 跨项目智能体协作的潜力 (未来)

---

## 技术栈摘要

### Conway Automaton 技术栈

| 类别 | 技术 | 用途 |
|----------|------------|---------|
| 语言 | TypeScript | 类型安全开发 |
| 框架 | Express.js | Web 服务器和 API |
| 数据库 | better-sqlite3 | 嵌入式持久化存储 |
| AI/ML | OpenAI API | 语言模型推理 |
| Web3 | viem, SIWE | 以太坊钱包和认证 |
| 构建 | tsc, pnpm | 编译和依赖管理 |
| 测试 | vitest | 单元和集成测试 |
| 安全 | 注入防御, 策略规则 | 运行时安全 |

### TinyClaw 后端技术栈

| 类别 | 技术 | 用途 |
|----------|------------|---------|
| 语言 | TypeScript | 类型安全开发 |
| 框架 | Hono | 轻量级 Web 框架 |
| 数据库 | better-sqlite3 | 智能体状态持久化 |
| 渠道 | Discord.js, Telegram Bot API, WhatsApp Web.js, Feishu SDK | 多平台消息推送 |
| 构建 | tsc, npm | 编译和依赖管理 |

### TinyOffice 前端技术栈

| 类别 | 技术 | 用途 |
|----------|------------|---------|
| 框架 | Next.js 16 | React SSR 框架 |
| UI 库 | React 19 | 组件库 |
| 样式 | Tailwind CSS 4 | 原子化 CSS |
| 组件 | Radix UI | 无障碍 UI 原型 |
| 路由 | Next.js App Router | 基于文件的路由 |

---

## 核心功能

### Automaton 功能

- ✅ **自主智能体运行时：** 自我导向的 AI 智能体循环
- ✅ **多层记忆：** 情节记忆、语义记忆、工作记忆和程序记忆系统
- ✅ **Web3 集成：** 以太坊钱包支持和 SIWE 身份验证
- ✅ **Conway API：** 实时计费和信用额度管理
- ✅ **代码自我修改：** 安全、经过审计的代码生成和更新
- ✅ **策略执行：** 运行时验证、速率限制和安全规则
- ✅ **预算管理：** 信用追踪和支出控制
- ✅ **注入防御：** 针对提示词注入攻击的保护
- ✅ **CLI 界面：** 命令行管理工具
- ✅ **智能体上下文聚合：** 多源上下文管理

### TinyClaw 功能

- ✅ **多渠道支持：** Discord, Telegram, WhatsApp, 飞书 (Lark)
- ✅ **团队编排：** 多智能体团队协调
- ✅ **24/7 运行：** 持久化后台处理
- ✅ **状态持久化：** SQLite 支持的会话历史
- ✅ **Next.js 控制面板：** 基于 Web 的管理界面
- ✅ **实时更新：** 支持 WebSocket 的实时界面
- ✅ **智能体管理：** 创建、配置和监控智能体
- ✅ **任务追踪：** 监控和管理智能体任务
- ✅ **活动日志：** 全面的审计追踪
- ✅ **配置管理：** 集中式设置

---

## 架构亮点

### Automaton 架构

```
┌─────────────────────────────────────────────────┐
│           Conway Automaton Runtime              │
├─────────────────────────────────────────────────┤
│  ┌──────────────┐                               │
│  │   Agent Loop │◄───► Policy Rules (Safety)   │
│  └──────┬───────┘                               │
│         │                                        │
│  ┌──────▼────────────────────────────────────┐  │
│  │         Context Manager                    │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Working Memory (Active Context)    │  │  │
│  │  ├─────────────────────────────────────┤  │  │
│  │  │  Episodic Memory (Event History)    │  │  │
│  │  ├─────────────────────────────────────┤  │  │
│  │  │  Semantic Memory (Knowledge Base)   │  │  │
│  │  ├─────────────────────────────────────┤  │  │
│  │  │  Procedural Memory (Skills)         │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └──────────────┬────────────────────────────┘  │
│                 │                                │
│  ┌──────────────▼────────────────────────────┐  │
│  │         Tool Manager                       │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  Self-Modification (Code Gen)      │  │  │
│  │  ├─────────────────────────────────────┤  │  │
│  │  │  Conway API (Billing/Credits)      │  │  │
│  │  ├─────────────────────────────────────┤  │  │
│  │  │  Identity (Wallet/Provision)       │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └──────────────┬────────────────────────────┘  │
│                 │                                │
│  ┌──────────────▼────────────────────────────┐  │
│  │         SQLite Database                    │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**关键组件：**

- **Agent Loop (智能体循环)：** 持续的自主运行周期
- **Multi-Layer Memory (多层记忆)：** 面向不同数据类型的分层记忆架构
- **Context Manager (上下文管理器)：** 聚合和管理来自多个渠道的智能体上下文
- **Tool Manager (工具管理器)：** 编排可用功能 (自我修改、计费、身份)
- **Policy Enforcement (策略执行)：** 运行时安全规则和验证

### TinyClaw 架构

```
┌─────────────────────────────────────────────────────────────┐
│                      TinyClaw Platform                       │
190: ├─────────────────────────────────────────────────────────────┤
191: │                                                              │
192: │  ┌──────────────────────────────────────────────────────┐  │
193: │  │                TinyOffice (Frontend)                 │  │
194: │  │  ┌────────────────────────────────────────────────┐  │  │
195: │  │  │  Next.js + React 19 + Tailwind + Radix UI      │  │  │
196: │  │  ├────────────────────────────────────────────────┤  │  │
197: │  │  │  Pages: Agents, Teams, Tasks, Chat, Console    │  │  │
198: │  │  └────────────────────────────────────────────────┘  │  │
199: │  └───────────────────┬──────────────────────────────────┘  │
200: │                      │ (HTTP/WebSocket)                     │
201: │  ┌───────────────────▼──────────────────────────────────┐  │
202: │  │              Hono Backend API                        │  │
203: │  │  ┌────────────────────────────────────────────────┐  │  │
204: │  │  │  REST API + WebSocket Endpoints                │  │  │
205: │  │  └──────────────────┬─────────────────────────────┘  │  │
206: │                       │                                   │
207: │  ┌───────────────────▼──────────────────────────────────┐  │
208: │  │              Team Orchestrator                       │  │
209: │  │  ┌────────────────────────────────────────────────┐  │  │
210: │  │  │  Multi-Agent Coordination & State Management   │  │  │
211: │  │  └──────────────────┬─────────────────────────────┘  │  │
212: │                       │                                   │
213: │  ┌───────────────────▼──────────────────────────────────┐  │
214: │  │         Multi-Channel Gateway                        │  │
215: │  │  ┌──────────────┬──────────────┬──────────────┬───┐  │  │
216: │  │  │  Discord.js  │  Telegram    │  WhatsApp    │...│  │  │
217: │  │  └──────────────┴──────────────┴──────────────┴───┘  │  │
218: │  └───────────────────┬──────────────────────────────────┘  │
219: │                      │                                      │
220: │  ┌───────────────────▼──────────────────────────────────┐  │
221: │  │              SQLite Database                         │  │
222: │  │  ┌────────────────────────────────────────────────┐  │  │
223: │  │  │  Agent State, Conversations, Teams, Tasks      │  │  │
224: │  │  └────────────────────────────────────────────────┘  │  │
225: │  └──────────────────────────────────────────────────────┘  │
226: └─────────────────────────────────────────────────────────────┘
```

**关键组件：**

- **TinyOffice：** 基于 React 的 Web 控制面板，用于管理
- **Hono Backend：** REST API 和 WebSocket 服务器
- **Team Orchestrator (团队编排器)：** 协调多智能体并管理状态
- **Multi-Channel Gateway (多渠道网关)：** Discord, Telegram, WhatsApp, 飞书的统一接口
- **SQLite Database：** 所有状态的持久化存储

---

## 开发概览

### 先决条件

- **Node.js** >= 20.0.0
- **pnpm** (用于 automaton)
- **npm** (用于 tinyclaw 和 tinyoffice)

### 快速入门

#### Automaton

```bash
cd automaton
pnpm install
pnpm build
pnpm dev
```

#### TinyClaw Backend

```bash
cd tinyclaw
npm install
npm run build
npm run discord      # 或 telegram, whatsapp, feishu
```

#### TinyOffice Frontend

```bash
cd tinyclaw/tinyoffice
npm install
npm run dev          # http://localhost:3000
```

### 关键命令

#### Automaton

- **安装：** `pnpm install`
- **开发：** `pnpm dev`
- **构建：** `pnpm build`
- **测试：** `pnpm test`
- **测试覆盖率：** `pnpm test:coverage`

#### TinyClaw

- **安装：** `npm install`
- **构建：** `npm build`
- **Discord：** `npm run discord`
- **Telegram：** `npm run telegram`
- **WhatsApp：** `npm run whatsapp`
- **飞书：** `npm run feishu`

#### TinyOffice

- **安装：** `cd tinyoffice && npm install`
- **开发：** `npm run dev`
- **构建：** `npm run build`
- **启动：** `npm run start`

---

## 存储库结构

```
jd/
├── automaton/              # Conway Automaton - AI 智能体运行时
│   ├── src/                # TypeScript 源码 (agent, memory, conway, identity, self-mod)
│   ├── packages/cli/       # CLI 包
│   ├── tests/              # 测试套件
│   └── dist/               # 编译输出
│
├── tinyclaw/               # TinyClaw - 多团队助手
│   ├── src/                # 后端源码 (agents, channels, state, team)
│   ├── tinyoffice/         # Next.js 前端
│   │   ├── app/            # 页面 (agents, teams, tasks, chat, console)
│   │   └── src/lib/        # 共享代码
│   ├── examples/           # 使用示例
│   └── dist/               # 后端编译输出
│
├── docs/                 # 设计文档和 PRD
├── docs/                   # 自动生成的文档 (当前目录)
└── CLAUDE.md              # 项目指南
```

---

## 文档地图

详细信息请参阅：

- [index.md](./index.md) - 主文档索引
- [architecture-automaton.md](./architecture-automaton.md) - Conway Automaton 架构详情
- [architecture-tinyclaw.md](./architecture-tinyclaw.md) - TinyClaw 架构详情
- [source-tree-analysis.md](./source-tree-analysis.md) - 目录结构 (已完成)
- [development-guide-automaton.md](./development-guide-automaton.md) - Automaton 开发指南
- [development-guide-tinyclaw.md](./development-guide-tinyclaw.md) - TinyClaw 开发指南
- [component-inventory-automaton.md](./component-inventory-automaton.md) - Automaton 组件列表
- [component-inventory-tinyclaw.md](./component-inventory-tinyclaw.md) - TinyClaw 组件列表

---

_本项目概览由 BMAD `document-project` 工作流生成_
