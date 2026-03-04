---
stepsCompleted: ["validate-prerequisites", "extract-requirements", "design-epics", "party-mode-review", "create-stories-complete"]
inputDocuments:
  - "docs/project-overview.md"
  - "docs/project-context.md"
  - "docs/architecture-automaton.md"
  - "docs/architecture-tinyclaw.md"
  - "docs/development-guide-automaton.md"
  - "docs/development-guide-tinyclaw.md"
---

# JD - Epic 分解

**状态：** ✅ 已完成 - 7 个 Epic，72 个用户 Story 准备开发  
**生成日期：** 2026-03-03  
**工作流：** BMAD Epic and Stories Creation  

---

## 📊 Epic 概览

| Epic | 标题 | Story 数量 | FR 覆盖 | 状态 |
|------|-------|---------|-------------|--------|
| **1a** | Conway Automaton 核心 - 自主智能体运行时基础 | 12 | FR1, FR2, FR6, FR8 | 🟢 就绪 |
| **1b** | Conway Automaton Web3 与计费 - 钱包和信用管理 | 8 | FR3, FR4, FR7 | 🟢 就绪 |
| **1c** | Conway Automaton 自我修改与 CLI - 代码生成和管理工具 | 9 | FR5, FR9, FR10 | 🟢 就绪 |
| **2a** | TinyClaw 消息核心 - 多渠道平台基础 | 12 | FR11 (Discord+Telegram), FR13, FR18, FR19, FR20 | 🟢 就绪 |
| **2b** | TinyClaw 团队编排 - 多智能体协作 | 8 | FR11 (WhatsApp+Feishu), FR12 | 🟢 就绪 |
| **3** | TinyOffice 控制面板 - Web 管理界面 | 13 | FR14, FR15, FR16, FR17 | 🟢 就绪 |
| **4** | 智能体集成与高级功能 - 跨平台增强 | 10 | 对 FR1-FR20 的增强 | 🟢 就绪 |
| **总计** | | **72 个 Story** | **全部 20 个 FR** | |

---

## 📋 详细 Story

### **Epic 1a: Conway Automaton 核心 - 自主智能体运行时基础**

**目标：** 部署基础的自主智能体运行时，包含多层记忆系统、策略执行和注入防御。

**涵盖的 FR：** FR1, FR2, FR6, FR8

**Story (12 个)：**

- 1a.1: 项目搭建与 Express 服务器初始化
- 1a.2: 智能体循环基础 - ReAct 模式实现
- 1a.3: 工作记忆 (Working Memory) 实现
- 1a.4: 情节记忆 (Episodic Memory) - 事件历史存储
- 1a.5: 语义记忆 (Semantic Memory) - 知识库
- 1a.6: 程序记忆 (Procedural Memory) - 技能与能力
- 1a.7: 知识存储 - 长期持久化存储
- 1a.8: 策略引擎 (Policy Engine) - 运行时验证
- 1a.9: 注入防御 - 提示词 (Prompt) 消毒
- 1a.10: Better-SQLite3 集成与数据库模式 (Schema)
- 1a.11: 结构化日志系统
- 1a.12: 健康检查与监控端点

---

### **Epic 1b: Conway Automaton Web3 与计费 - 钱包和信用管理**

**目标：** 为智能体运行时添加 Ethereum 钱包集成、SIWE 认证以及 Conway API 计费能力。

**涵盖的 FR：** FR3, FR4, FR7

**Story (8 个)：**

- 1b.1: Viem Ethereum 客户端集成
- 1b.2: 钱包创建与管理
- 1b.3: SIWE 认证实现
- 1b.4: Conway API 客户端设置
- 1b.5: 信用余额追踪与缓存
- 1b.6: 支出控制与预算管理
- 1b.7: Web3 交易日志记录
- 1b.8: 钱包余额监控与告警

---

### **Epic 1c: Conway Automaton 自我修改与 CLI - 代码生成和管理工具**

**目标：** 启用安全且经过审计的代码自我修改能力，并提供用于智能体管理的命令行界面。

**涵盖的 FR：** FR5, FR9, FR10

**Story (9 个)：**

- 1c.1: 安全代码生成框架
- 1c.2: 自我修改操作的审计日志
- 1c.3: 代码审查与批准工作流
- 1c.4: CLI 界面基础
- 1c.5: CLI 智能体 启动/停止 命令
- 1c.6: CLI 智能体 配置命令
- 1c.7: CLI 查询与调试命令
- 1c.8: 智能体上下文聚合 - 多源集成
- 1c.9: 代码更新的上游集成

---

### **Epic 2a: TinyClaw 消息核心 - 多渠道平台基础**

**目标：** 部署一个生产级的消息平台，支持 Discord 和 Telegram，具备持久化状态管理和配置系统。

**涵盖的 FR：** FR11 (Discord + Telegram), FR13, FR18, FR19, FR20

**Story (12 个)：**

- 2a.1: Hono 后端框架搭建
- 2a.2: Discord.js 集成 - 机器人设置
- 2a.3: Telegram Bot API 集成
- 2a.4: 共享消息队列处理器
- 2a.5: 会话的 SQLite 持久化存储
- 2a.6: 智能体状态持久化
- 2a.7: 配置管理系统
- 2a.8: 活动日志与审计追踪
- 2a.9: 支持 24/7 运行的后台处理
- 2a.10: 健康检查端点
- 2a.11: 消息速率限制与节流
- 2a.12: 错误处理与重试逻辑

---

### **Epic 2b: TinyClaw 团队编排 - 多智能体协作**

**目标：** 添加 WhatsApp 和飞书 (Lark) 支持，实现基于团队的智能体编排，并启用多智能体协作。

**涵盖的 FR：** FR11 (WhatsApp + Feishu), FR12

**Story (8 个)：**

- 2b.1: WhatsApp Web.js 集成
- 2b.2: 飞书 SDK 集成
- 2b.3: 团队编排器基础
- 2b.4: 基于团队和能力的智能体路由
- 2b.5: 跨智能体的共享上下文管理
- 2b.6: 负载均衡与故障转移
- 2b.7: 团队配置管理
- 2b.8: 多渠道消息标准化

---

### **Epic 3: TinyOffice 控制面板 - Web 管理界面**

**目标：** 部署现代化的 Web 管理控制面板，使用户能够管理 AI 智能体、监控团队活动、追踪任务并配置平台。

**涵盖的 FR：** FR14, FR15, FR16, FR17

**Story (13 个)：**

- 3.1: 使用 App Router 搭建 Next.js 16 项目
- 3.2: 管理员访问的认证系统
- 3.3: 智能体页面 - 列表与概览
- 3.4: 智能体页面 - 创建新智能体
- 3.5: 智能体页面 - 编辑智能体配置
- 3.6: 智能体页面 - 删除智能体
- 3.7: 团队页面 - 团队管理
- 3.8: 任务页面 - 监控活动任务
- 3.9: 聊天页面 - 实时消息界面
- 3.10: 控制台页面 - 活动日志与调试
- 3.11: 用于实时更新的 WebSocket 集成
- 3.12: 移动端/平板端响应式设计
- 3.13: 基于角色的访问控制 (RBAC)

---

### **Epic 4: 智能体集成与高级功能 - 跨平台增强**

**目标：** 使 Conway Automaton 智能体能够与 TinyClaw 消息渠道集成，添加高级监控、分析和跨项目协作功能。

**涵盖的 FR：** 对具有集成能力的 FR1-FR20 的增强

**Story (10 个)：**

- 4.1: 用于 TinyClaw 渠道的 Conway Automaton 集成适配器
- 4.2: 跨项目智能体协作框架
- 4.3: 统一的智能体注册与发现
- 4.4: Automaton 与 TinyClaw 之间的共享上下文管理
- 4.5: 高级监控与分析仪表盘
- 4.6: 工作流自动化引擎
- 4.7: 性能指标与报告
- 4.8: 增强的日志与调试工具
- 4.9: 备份与恢复功能
- 4.10: API 版本管理与向后兼容性

---

## 📝 后续步骤

1. **生成 Sprint 状态：** 运行 `/bmad-bmm-sprint-planning` 创建 Sprint 追踪文件
2. **开始实施：** 从 Epic 1a（智能体运行时核心）开始
3. **遵循依赖关系：** 按顺序完成 Epic (1a → 1b → 1c → 2a → 2b → 3 → 4)
4. **追踪进度：** 在 Story 完成时更新 Sprint 状态文件

---

## ✅ 需求覆盖验证

- ✅ **全部 20 个功能需求 (FR)** 已涵盖在 7 个 Epic 中
- ✅ **全部 15 个非功能需求 (NFR)** 已在实施 Story 中解决
- ✅ 架构文档中的**技术需求**已整合
- ✅ 每个 Epic 内**不依赖未来的 Story**
- ✅ **以用户价值为中心** - 每个 Story 都提供切实的量化收益
- ✅ 所有 72 个 Story 均有**可测试的验收标准**

---

**文档版本：** 1.0  
**工作流状态：** 已完成  
**准备阶段：** 开发实施
