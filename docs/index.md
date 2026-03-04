# JD 文档索引

**类型：** 包含 2 个部分的 Monorepo
**主要语言：** TypeScript
**架构：** 多智能体自主系统
**上次更新：** 2026-03-03

---

## 项目概览

**JD** 是一个多项目 monorepo，包含两个复杂的自主 AI 智能体系统。本套文档为 AI 辅助开发以及对这两个项目的深入理解提供了全面的上下文。

本存储库包含：

1. **Conway Automaton** - 具有 Web3 和自我修改能力的主权 AI 智能体运行时
2. **TinyClaw** - 具有 Web 控制面板的多团队、多渠道 24/7 AI 助手平台

这两个项目都实现了先进的智能体架构，具有持久化记忆、自主决策和多渠道通信功能。

---

## 项目结构

本项目由 **2** 个部分组成：

### Conway Automaton (automaton)

- **类型：** 后端 Web 应用程序 (AI 智能体运行时)
- **位置：** `automaton/`
- **技术栈：** TypeScript, Express, OpenAI, viem (Ethereum), better-sqlite3, pnpm
- **入口点：** `src/index.ts`
- **用途：** 具有 Web3 集成、Conway API 计费和自我修改能力的主权 AI 智能体运行时

### TinyClaw (tinyclaw)

- **类型：** 全栈 Web 应用程序 (多渠道助手)
- **位置：** `tinyclaw/`
- **技术栈：** TypeScript, Hono (后端), Next.js 16 + React 19 (前端), Tailwind CSS 4, Radix UI
- **入口点：** `src/index.ts` (后端), `tinyoffice/app/page.tsx` (前端)
- **用途：** 集成 Discord, Telegram, WhatsApp 和飞书的多团队个人助手

---

## 跨部分集成

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

## 快速参考

### Conway Automaton 快速参考

- **技术栈：** TypeScript, Express, OpenAI, viem, better-sqlite3
- **入口点：** `src/index.ts`
- **模式：** 具有多层记忆的自主智能体运行时
- **数据库：** SQLite (better-sqlite3)
- **部署：** Node.js 服务器

### TinyClaw 快速参考

- **技术栈：** TypeScript, Hono, Discord.js, Telegram API, WhatsApp, Next.js 16, React 19
- **入口点：** 后端: `src/index.ts`, 前端: `tinyoffice/app/page.tsx`
- **模式：** 具有团队编排功能的多渠道消息平台
- **数据库：** SQLite (better-sqlite3)
- **部署：** Node.js 后端 + Next.js 前端

---

## 生成的文档

### 核心文档

- [项目概览](./project-overview.md) - 执行摘要和高层架构
- [源码树分析](./source-tree-analysis.md) - 带注释的目录结构

### 各部分特定文档

#### Conway Automaton (automaton)

- [架构指南](./architecture-automaton.md) - Conway Automaton 的技术架构
- [组件清单](./component-inventory-automaton.md) - 组件目录
- [开发指南](./development-guide-automaton.md) - 环境搭建和开发工作流

#### TinyClaw (tinyclaw)

- [架构指南](./architecture-tinyclaw.md) - TinyClaw 的技术架构
- [组件清单](./component-inventory-tinyclaw.md) - 组件目录
- [开发指南](./development-guide-tinyclaw.md) - 环境搭建和开发工作流

### 集成文档

- [集成架构](./integration-architecture.md) - 各部分如何通信
- [项目组成单元元数据](./project-parts.json) - 机器可读的项目结构

---

## 现有文档

### Conway Automaton

- [automaton/AGENTS.md](../automaton/AGENTS.md) - 智能体配置和系统概览
- [automaton/CLAUDE.md](../automaton/CLAUDE.md) - Automaton 项目准则
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) - 架构文档

### TinyClaw

- [tinyclaw/ARCHITECTURE.md](../tinyclaw/ARCHITECTURE.md) - 架构文档
- [tinyclaw/DOCUMENTATION.md](../tinyclaw/DOCUMENTATION.md) - 项目文档
- [tinyclaw/CONFIG_GUIDE.md](../tinyclaw/CONFIG_GUIDE.md) - 配置指南
- [tinyclaw/constitution.md](../tinyclaw/constitution.md) - 智能体宪法
- [tinyclaw/CLAUDE.md](../tinyclaw/CLAUDE.md) - TinyClaw 项目准则

### 项目级文档

- [CLAUDE.md](../CLAUDE.md) - JD 项目通用准则
- [docs/](../docs/) - 设计文档和 PRD

---

## 环境搭建

### 先决条件

- **Node.js** >= 20.0.0
- **pnpm** (用于 automaton)
- **npm** (用于 tinyclaw 和 tinyoffice)

### Conway Automaton 设置

**安装与运行：**

```bash
cd automaton
pnpm install
pnpm build
pnpm dev
```

**关键命令：**

- `pnpm dev` - 带热重载的开发模式
- `pnpm build` - 编译 TypeScript
- `pnpm test` - 运行测试套件
- `pnpm test:coverage` - 运行并生成覆盖率报告

### TinyClaw 设置

**后端：**

```bash
cd tinyclaw
npm install
npm run build
npm run discord      # 或 telegram, whatsapp, feishu
```

**前端 (TinyOffice):**

```bash
cd tinyclaw/tinyoffice
npm install
npm run dev          # 启动于 http://localhost:3000
```

**关键命令：**

- `npm run build` - 编译后端
- `npm run discord` - 启动 Discord 客户端
- `npm run telegram` - 启动 Telegram 客户端
- `npm run whatsapp` - 启动 WhatsApp 客户端
- `npm run feishu` - 启动飞书客户端
- `npm run dev` (在 tinyoffice 目录中) - 启动前端开发服务器

---

## 针对 AI 辅助开发

这套文档专门为使 AI 智能体能够理解并扩展此代码库而生成。

### 在规划新功能时

**仅 UI 相关功能：**
→ 参考：`architecture-tinyclaw.md`, `component-inventory-tinyclaw.md`

**API/后端功能：**
→ 参考：`architecture-automaton.md`, `architecture-tinyclaw.md`

**全栈功能：**
→ 参考：所有架构文档 + `integration-architecture.md`

**智能体系统增强：**
→ 参考：`architecture-automaton.md` (记忆系统、策略规则、自我修改)
→ 参考：`architecture-tinyclaw.md` (团队编排、渠道、状态)

**多渠道功能：**
→ 参考：`architecture-tinyclaw.md`, `component-inventory-tinyclaw.md`

---

## 文档状态

✅ **已完成：**

- [x] 项目概览 (Project Overview)
- [x] 源码树分析 (Source Tree Analysis)
- [x] 架构指南 (Architecture - automaton)
- [x] 架构指南 (Architecture - tinyclaw)
- [x] 组件清单 (Component Inventory - automaton)
- [x] 组件清单 (Component Inventory - tinyclaw)
- [x] 开发指南 (Development Guide - automaton)
- [x] 开发指南 (Development Guide - tinyclaw)
- [x] 集成架构 (Integration Architecture)
- [x] 主索引 (Master Index - 本文件)

**扫描级别：** 详尽
**工作流模式：** initial_scan
**上次更新：** 2026-03-03
**生成的总文件数：** 10
**记录的总行数：** 5000+

---

_本索引由 BMAD `document-project` 工作流生成_
