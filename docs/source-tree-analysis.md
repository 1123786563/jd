# 源码树分析

**生成日期：** 2026-03-03
**扫描级别：** 详尽
**项目类型：** Monorepo (多部分)

---

## 存储库结构

```
jd/
├── automaton/               # 第 1 部分: Conway Automaton - AI 智能体运行时
│   ├── src/                 # TypeScript 源码
│   │   ├── agent/           # 核心智能体逻辑和策略执行
│   │   ├── conway/          # Conway API 集成和计费
│   │   ├── identity/        # 钱包和身份管理
│   │   ├── memory/          # 记忆系统 (情节、语义、工作记忆)
│   │   ├── self-mod/        # 自我修改和代码生成
│   │   ├── setup/           # 配置向导和默认值
│   │   └── state/           # 数据库和持久层
│   ├── packages/            # Monorepo 包
│   │   └── cli/             # CLI 包
│   ├── dist/                # 编译输出
│   ├── tests/               # 测试文件
│   ├── bin/                 # 可执行脚本
│   └── AGENTS.md            # 智能体配置
│
├── tinyclaw/                # 第 2 部分: TinyClaw - 多团队个人助手
│   ├── src/                 # TypeScript 后端源码
│   │   ├── agents/          # 智能体实现
│   │   ├── channels/        # Discord, Telegram, WhatsApp 客户端
│   │   ├── state/           # 智能体状态管理
│   │   └── team/            # 团队编排
│   ├── tinyoffice/          # Next.js 前端控制面板
│   │   ├── app/             # Next.js App Router
│   │   │   ├── agents/      # 智能体管理 UI
│   │   │   ├── teams/       # 团队管理 UI
│   │   │   ├── tasks/       # 任务追踪 UI
│   │   │   ├── office/      # 控制面板仪表盘
│   │   │   └── console/     # 系统控制台
│   │   ├── src/             # 前端源码
│   │   │   └── lib/         # 前端/后端共享代码
│   │   └── .next/           # Next.js 构建输出
│   ├── dist/                # 后端编译输出
│   ├── examples/            # 使用示例
│   └── lib/                 # 共享库
│
├── docs/                  # 项目文档 (设计, PRD 等)
└── docs/                    # 自动生成的项目文档 (当前目录)
```

---

## 第 1 部分：Conway Automaton

### 关键目录

| 目录 | 用途 | 关键文件 |
|-----------|---------|-----------|
| `src/agent/` | 核心自主智能体运行时 | `loop.ts`, `context.ts`, `injection-defense.ts`, `policy-rules/` |
| `src/memory/` | 多层记忆系统 | `episodic.ts`, `semantic.ts`, `working.ts`, `knowledge-store.ts` |
| `src/conway/` | Conway API 客户端和计费 | `client.ts`, `credits.ts`, `x402.ts`, `topup.ts` |
| `src/identity/` | Web3 钱包和身份 | `wallet.ts`, `provision.ts` |
| `src/self-mod/` | 代码自我修改 | `code.ts`, `tools-manager.ts`, `upstream.ts` |
| `src/state/` | SQLite 数据库层 | `database.ts`, `schema.ts` |
| `packages/cli/` | 命令行界面 | `src/commands/*.ts` |
| `tests/` | 单元和集成测试 | 各模块对应的测试文件 |

### 入口点

- **主运行时：** `src/index.ts` (编译为 `dist/index.js`)
- **CLI 工具：** `packages/cli/src/index.ts`
- **Express 服务器：** `src/server.ts` (从 package.json 导出项推断)

### 技术栈

- **语言：** TypeScript
- **运行时：** Node.js (Express 框架)
- **数据库：** better-sqlite3 (嵌入式 SQLite)
- **AI：** OpenAI API 集成
- **Web3：** viem (Ethereum), SIWE (Sign-In with Ethereum)
- **包管理器：** pnpm
- **构建工具：** TypeScript 编译器 (tsc)
- **测试：** vitest

---

## 第 2 部分：TinyClaw

### 关键目录

| 目录 | 用途 | 关键文件 |
|-----------|---------|-----------|
| `src/agents/` | AI 智能体实现 | 各类智能体文件 |
| `src/channels/` | 多平台消息推送 | `discord-client.ts`, `telegram-client.ts`, `whatsapp-client.ts`, `feishu-client.ts` |
| `src/state/` | 智能体会话状态 | 状态管理文件 |
| `src/team/` | 多智能体团队编排 | 团队协助逻辑 |
| `tinyoffice/app/` | Next.js 前端页面 | React 组件和页面 |
| `tinyoffice/src/lib/` | 共享实用工具 | 通用代码 |
| `examples/` | 使用示例 | 演示文件 |

### 入口点

- **后端主程序：** `src/index.ts` (编译为 `dist/index.js`)
- **前端：** `tinyoffice/app/page.tsx` (Next.js 应用入口)
- **渠道客户端：** `dist/channels/` 下的各渠道入口点

### 技术栈

- **后端语言：** TypeScript
- **后端框架：** Hono (Web 框架)
- **前端框架：** Next.js 16 + React 19
- **样式：** Tailwind CSS 4, Radix UI
- **渠道：** Discord.js, Telegram Bot API, WhatsApp Web.js, 飞书 SDK
- **数据库：** better-sqlite3
- **包管理器：** npm
- **构建工具：** TypeScript 编译器 (tsc)

### 前端页面

- `/` - 仪表盘/Office 首页
- `/agents` - 智能体管理
- `/teams` - 团队配置
- `/tasks` - 任务追踪
- `/chat/agent/[id]` - 单个智能体会话
- `/chat/team/[id]` - 团队会话界面
- `/console` - 系统控制台
- `/logs` - 活动日志
- `/settings` - 配置设置

---

## 集成点

### Automaton 与 TinyClaw 之间

虽然两者是 monorepo 中独立的项目，但它们共享概念架构：

1. **共享模式：** 两者都使用 better-sqlite3 进行持久化
2. **智能体哲学：** 两者都实现了自主智能体概念
3. **TypeScript：** 一致的语言和工具链
4. **AI 集成：** 两者都利用 LLM 能力

### 外部集成

**Automaton:**

- Conway API (计费、积分)
- OpenAI (推理)
- 以太坊区块链 (钱包、交易)
- Git (代码自我修改)

**TinyClaw:**

- Discord API
- Telegram Bot API
- WhatsApp Web
- 飞书 (Lark) API

---

## 构建与输出结构

### Automaton

```
automaton/
├── dist/                    # TypeScript 输出
│   ├── index.js             # 主运行时
│   ├── index.d.ts           # TypeScript 定义
│   ├── agent/
│   ├── memory/
│   ├── conway/
│   ├── identity/
│   ├── self-mod/
│   └── state/
└── node_modules/            # 依赖包 (扫描时排除)
```

### TinyClaw

```
tinyclaw/
├── dist/                    # 后端编译输出
│   ├── index.js
│   ├── agents/
│   ├── channels/
│   ├── state/
│   └── team/
└── tinyoffice/.next/        # Next.js 编译输出 (扫描时排除)
```

---

## 配置文件

### Automaton

- `package.json` - 依赖和脚本
- `tsconfig.json` - TypeScript 配置
- `.env.example` - 环境变量模板
- `AGENTS.md` - 智能体系统配置
- `pnpm-workspace.yaml` (推断) - Monorepo 工作区配置

### TinyClaw

- `package.json` - 依赖和脚本
- `tsconfig.json` - TypeScript 配置
- `ARCHITECTURE.md` - 架构文档
- `DOCUMENTATION.md` - 项目文档
- `CONFIG_GUIDE.md` - 配置指南
- `constitution.md` - 智能体宪法

### TinyOffice (前端)

- `package.json` - Next.js 依赖
- `next.config.js` - Next.js 配置
- `tailwind.config.js` - Tailwind CSS 配置
- `tsconfig.json` - TypeScript 配置

---

## 测试覆盖率

### Automaton

- 使用 Vitest 测试运行器
- 提供覆盖率报告
- 特定的测试套件：
  - `test:security` - 安全和注入测试
  - `test:financial` - 财务/金库逻辑测试
  - `test:ci` - CI/CD 优化测试

### TinyClaw

- 测试文件位于 `src/` 及其子目录
- 基于 TypeScript 的测试

---

## 关键模式与架构

### Automaton 模式

1. **多层记忆：** 情节记忆 + 语义记忆 + 工作记忆 + 程序记忆
2. **策略执行：** 运行时验证和速率限制
3. **自我修改：** 代码生成和审计
4. **注入防御：** 针对 LLM 交互的安全层
5. **预算管理：** 积分追踪和支出控制

### TinyClaw 模式

1. **多渠道架构：** Discord/Telegram/WhatsApp/飞书的统一接口
2. **团队编排：** 多智能体协作
3. **状态持久化：** SQLite 支持的会话状态
4. **Next.js SSR：** 前端服务器端渲染
5. **实时通信：** 使用 WebSocket/长轮询进行更新

---

## 开发工作流

### Automaton

```bash
cd automaton
pnpm install          # 安装依赖
pnpm build            # 编译 TypeScript
pnpm dev              # 开发监控模式
pnpm test             # 运行测试
pnpm test:coverage    # 覆盖率报告
```

### TinyClaw 后端

```bash
cd tinyclaw
npm install
npm run build
npm run whatsapp      # 启动 WhatsApp 客户端
npm run discord       # 启动 Discord 客户端
npm run telegram      # 启动 Telegram 客户端
npm run feishu        # 启动飞书客户端
```

### TinyOffice 前端

```bash
cd tinyclaw/tinyoffice
npm install
npm run dev           # 开发服务器
npm run build         # 生产构建
npm run start         # 生产启动
```

---

## 资产位置

### Automaton

- 无显著静态资产 (仅后端)
- 配置模板位于 `.agents/`

### TinyClaw

- 前端资产位于 `tinyoffice/public/`
- 图片、图标和静态文件
- Next.js 优化的资产管道

---

## 说明

- **详尽扫描：** 此分析涵盖了所有源码目录
- **Node Modules：** 扫描时已排除 (标准依赖文件夹)
- **构建输出：** 扫描时已排除 (编译后的文件)
- **Monorepo 结构：** 两个独立但相关的项目
- **共享哲学：** 两者都实现了自主 AI 智能体系统

---

_此源码树分析由 BMAD `document-project` 工作流生成_
