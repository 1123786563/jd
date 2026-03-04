# Conway Automaton - 架构指南

**所属部分：** automaton
**类型：** 后端 Web 应用程序 (AI 智能体运行时)
**上次更新：** 2026-03-03

---

## 概述

**Conway Automaton** 是一个主权、自复制的 AI 智能体运行时，具有 Web3 集成和自主运行能力。它实现了复杂的多层记忆架构、基于策略的安全控制，并通过集成 Conway API 具备财务感知能力。

---

## 架构模式

**ReAct 循环架构** - 思考 (Think) → 行动 (Act) → 观察 (Observe) → 持久化 (Persist)

核心架构遵循 ReAct (推理 + 行动) 模式，智能体在此模式下持续进行：

1. **思考 (Think)** - 分析上下文并决定下一步行动
2. **行动 (Act)** - 执行工具或生成响应
3. **观察 (Observe)** - 捕获执行结果和环境变化
4. **持久化 (Persist)** - 将状态和习得的内容存储到记忆中

---

## 高级架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Conway Automaton Runtime                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Agent Loop (Core)                      │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  ReAct Cycle: Think → Act → Observe → Persist      │  │   │
│  │  │  - Policy Enforcement (Safety)                     │  │   │
│  │  │  - Injection Defense                               │  │   │
│  │  │  - Budget Tracking                                 │  │   │
│  │  └───────────────┬────────────────────────────────────┘  │   │
│  └──────────────────┼────────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────▼────────────────────────────────────────┐   │
│  │                 Context Manager                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Working Memory (Active Context)                     │  │   │
│  │  ├──────────────────────────────────────────────────────┤  │   │
│  │  │  Episodic Memory (Event History)                     │  │   │
│  │  ├──────────────────────────────────────────────────────┤  │   │
│  │  │  Semantic Memory (Knowledge Base)                    │  │   │
│  │  ├──────────────────────────────────────────────────────┤  │   │
│  │  │  Procedural Memory (Skills)                          │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └──────────────────┬────────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────▼────────────────────────────────────────┐   │
│  │                 Tool Manager                                │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Built-in Tools                                      │  │   │
│  │  │  ├─ Self-Modification (Code Generation)             │  │   │
│  │  │  ├─ Conway API (Billing/Credits)                    │  │   │
│  │  │  ├─ Identity (Wallet/Provision)                     │  │   │
│  │  │  ├─ Memory Management                               │  │   │
│  │  │  └─ System Operations                               │  │   │
│  │  ├──────────────────────────────────────────────────────┤  │   │
│  │  │  Installed Skills (Dynamic)                         │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └──────────────────┬────────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────▼────────────────────────────────────────┐   │
│  │                 Inference Layer                             │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  Model Registry (Multi-Provider)                     │  │   │
│  │  │  ├─ OpenAI (Claude, GPT)                            │  │   │
│  │  │  ├─ Ollama (Local Models)                           │  │   │
│  │  │  └─ Other Providers                                  │  │   │
│  │  ├──────────────────────────────────────────────────────┤  │   │
│  │  │  Budget Tracker (Credit Management)                 │  │   │
│  │  │  ├─ Conway Credits                                  │  │   │
│  │  │  ├─ Spend Tracking                                  │  │   │
│  │  │  └─ Rate Limiting                                   │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └──────────────────┬────────────────────────────────────────┘   │
│                     │                                             │
│  ┌──────────────────▼────────────────────────────────────────┐   │
│  │              Persistence Layer                              │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │  SQLite Database (better-sqlite3)                    │  │   │
│  │  │  ├─ Agent State & Turns                             │  │   │
│  │  │  ├─ Memory Blocks                                   │  │   │
│  │  │  ├─ Wake Events (Scheduling)                       │  │   │
│  │  │  ├─ Inbox Messages                                  │  │   │
│  │  │  └─ Audit Logs (Self-Modification)                 │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              External Integrations                         │   │
│  │  ├─ Conway API (Billing, Credits, Top-up)                │   │
│  │  ├─ Ethereum Blockchain (Wallet, Transactions)           │   │
│  │  ├─ Git (Code Versioning & Self-Mod)                     │   │
│  │  └─ Social Platforms (Future)                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

### 1. 智能体循环 (Agent Loop - `src/agent/loop.ts`)

**用途：** Automaton 的核心意识——即 ReAct 执行循环。

**关键职责：**

- 执行持续的 ReAct 循环 (思考 → 行动 → 观察 → 持久化)
- 管理会话回合和状态分配
- 执行策略规则和安全检查
- 追踪推理预算和信用额度
- 处理工具执行及其结果
- 管理错误恢复和重试逻辑

**核心功能：**

- **策略执行 (Policy Enforcement)：** 运行时验证和速率限制
- **注入防御 (Injection Defense)：** 对输入进行消毒，防止提示词注入攻击
- **预算管理 (Budget Management)：** 追踪 Conway 信用额度和支出
- **错误处理：** 最大连续错误数 (5) 和重复回合限制 (3)
- **工具执行：** 每回合支持多达 10 次工具调用

**入口点：** `runAgentLoop(options)` 函数

**相关文件：**

- `src/agent/context.ts` - 上下文构建和消息管理
- `src/agent/system-prompt.ts` - 系统提示词构建
- `src/agent/tools.ts` - 工具注册和执行
- `src/agent/injection-defense.ts` - 安全消毒
- `src/agent/policy-engine.ts` - 策略规则执行

---

### 2. 多层记忆系统 (`src/memory/`)

**用途：** 面向不同类型信息的分层记忆架构。

#### 工作记忆 (Working Memory - `src/memory/working.ts`)

- **用途：** 当前会话/回合的活动上下文
- **生命周期：** 会话作用域，回合间清除
- **内容：** 最近的消息、当前目标、活动工具

#### 情节记忆 (Episodic Memory - `src/memory/episodic.ts`)

- **用途：** 事件历史和会话转录
- **生命周期：** 持久化 (存储于 SQLite)
- **内容：** 完整的会话历史、智能体回合、事件
- **检索：** 基于时间、基于事件

#### 语义记忆 (Semantic Memory - `src/memory/semantic.ts`)

- **用途：** 知识库和习得的信息
- **生命周期：** 持久化 (存储于 SQLite)
- **内容：** 事实、概念、关系、领域知识
- **检索：** 向量相似度搜索、关键字匹配

#### 程序记忆 (Procedural Memory - `src/memory/procedural.ts`)

- **用途：** 技能、工具和操作知识 (How-to)
- **生命周期：** 持久化 (存储于 SQLite)
- **内容：** 工具定义、技能实现、工作流
- **检索：** 基于名称、基于能力

#### 知识存储 (Knowledge Store - `src/memory/knowledge-store.ts`)

- **用途：** 语义知识的统一接口
- **功能：** 摄取管道、检索优化、去重

#### 上下文管理器 (Context Manager - `src/memory/context-manager.ts`)

- **用途：** 聚合和管理来自所有记忆层的上下文
- **功能：** Token 计数、上下文修减、优先级排序

#### 压缩引擎 (Compression Engine - `src/memory/compression-engine.ts`)

- **用途：** 压缩长会话和记忆
- **功能：** 摘要提取、有损压缩、保留策略

**相关文件：**

- `src/memory/retrieval.ts` - 记忆检索策略
- `src/memory/ingestion.ts` - 知识摄取管道
- `src/memory/event-stream.ts` - 基于事件的记忆更新
- `src/memory/agent-context-aggregator.ts` - 上下文聚合
- `src/memory/budget.ts` - 记忆预算管理

---

### 3. 身份与 Web3 集成 (`src/identity/`)

**用途：** 钱包管理、区块链身份和认证。

#### 钱包 (Wallet - `src/identity/wallet.ts`)

- **功能：**
  - 以太坊钱包生成和管理
  - SIWE (Sign-In with Ethereum) 身份验证
  - 账户配置和恢复
  - 配置目录管理

#### 配置 (Provision - `src/identity/provision.ts`)

- **功能：**
  - 通过 SIWE 配置 Conway API 密钥
  - 区块链身份验证
  - 从配置中加载 API 密钥

**集成：** 使用 viem 库进行以太坊交互。

---

### 4. Conway API 集成 (`src/conway/`)

**用途：** 计费、信用额度和财务操作。

#### 客户端 (Client - `src/conway/client.ts`)

- Conway API HTTP 客户端
- 请求签名和认证
- 错误处理和重试

#### 信用额度 (Credits - `src/conway/credits.ts`)

- 信用余额追踪
- 生存等级确定
- 预算计算

#### X402 (`src/conway/x402.ts`)

- USDC 余额检查
- 支付协议处理
- 发票处理

#### 推理 (Inference - `src/conway/inference.ts`)

- 推理 API 客户端
- 模型选择和路由
- 成本追踪

#### 充值 (Top-up - `src/conway/topup.ts`)

- 自动信用充值
- 支付处理
- 余额监控

---

### 5. 自我修改系统 (`src/self-mod/`)

**用途：** 安全的代码生成和自主更新。

#### 代码 (Code - `src/self-mod/code.ts`)

- 代码生成和修改
- 语法验证
- 安全检查

#### 工具管理器 (Tools Manager - `src/self-mod/tools-manager.ts`)

- 动态工具注册
- 工具生命周期管理
- 能力发现

#### 上游 (Upstream - `src/self-mod/upstream.ts`)

- 集成 Git 进行代码版本控制
- 创建 Pull Request
- 代码审查工作流

#### 审计日志 (Audit Log - `src/self-mod/audit-log.ts`)

- 记录所有代码变更
- 回滚能力
- 变更追踪

**安全功能：**

- 所有变更都需要策略审批
- 记录所有修改的审计追踪
- 回滚机制
- 语法和类型验证

---

### 6. 策略引擎 (`src/agent/policy-engine.ts`)

**用途：** 运行时安全规则和执行。

**默认规则：**

- `validation.ts` - 输入/输出验证
- `rate-limits.ts` - API 速率限制
- `path-protection.ts` - 文件系统访问控制

**功能：**

- 动态规则加载
- 规则链式组合
- 违规记录和处理

---

### 7. 推理层 (`src/inference/`)

**用途：** 多供应商 LLM 集成和路由。

#### 模型注册表 (Model Registry - `src/inference/registry.ts`)

- 模型供应商注册
- 模型能力元数据
- 供应商选择逻辑

#### 预算追踪器 (Budget Tracker - `src/inference/budget.ts`)

- 每个供应商的信用追踪
- 支出限制和警报
- 成本优化

#### 推理路由器 (Inference Router - `src/inference/router.ts`)

- 智能模型选择
- 备选方案 (Fallback) 策略
- 负载均衡

#### 供应商注册表 (Provider Registry - `src/inference/provider-registry.ts`)

- 多供应商配置
- 供应商健康监控
- 自动故障转移

---

### 8. 状态与持久化 (`src/state/`)

**用途：** 所有持久化数据的 SQLite 数据库层。

#### 数据库 (Database - `src/state/database.ts`)

- **表格：**
  - `agent_state` - 当前智能体状态和配置
  - `agent_turns` - 会话历史和回合
  - `memory_blocks` - 记忆存储 (情节、语义、程序)
  - `wake_events` - 计划事件和触发器
  - `inbox_messages` - 待处理消息和通知
  - `audit_log` - 自我修改审计追踪
  - `spend_tracker` - 财务交易历史

**功能：**

- 符合 ACID 的事务
- 迁移支持
- 模式 (Schema) 版本控制
- 备份和恢复

---

### 9. 设置与配置 (`src/setup/`)

**用途：** 交互式设置向导和配置管理。

#### 向导 (Wizard - `src/setup/wizard.ts`)

- 首次运行时的交互式设置
- 模型选择
- 金库配置
- 供应商设置

#### 配置 (Configure - `src/setup/configure.ts`)

- 配置编辑 UI
- 供应商管理
- 模型切换
- 金库策略更新

#### 环境 (Environment - `src/setup/environment.ts`)

- 环境变量加载
- 配置文件解析
- 默认值设置

#### 模型选择器 (Model Picker - `src/setup/model-picker.ts`)

- 交互式模型选择
- 供应商对比
- 成本估算

---

### 10. CLI 包 (`packages/cli/`)

**用途：** 用于管理 Automaton 的命令行界面。

**命令：**

- `status` - 显示当前 Automaton 状态
- `logs` - 查看智能体日志和活动
- `send` - 向智能体发送消息
- `fund` - 为 Automaton 金库注资

**功能：**

- 彩色输出 (chalk)
- 交互式提示
- 进度指示器 (ora)

---

## 数据流

### 智能体回合执行流

```
1. 触发唤醒事件 (Wake Event)
   └─> 从数据库调用 consumeNextWakeEvent()

2. 上下文聚合
   ├─> 加载工作记忆 (当前活动上下文)
   ├─> 检索情节记忆 (会话历史)
   ├─> 查询语义记忆 (相关知识)
   ├─> 加载程序记忆 (可用工具)
   └─> 构建上下文消息

3. 推理 (Inference)
   ├─> 应用系统提示词
   ├─> 输入消毒 (注入防御)
   ├─> 检查策略规则 (验证、速率限制)
   ├─> 调用 LLM (通过推理路由器)
   └─> 解析响应 (文本或工具调用)

4. 工具执行 (如果有)
   ├─> 验证工具调用 (策略检查)
   ├─> 执行工具 (内置或已安装)
   ├─> 捕获结果
   └─> 处理错误 (重试逻辑)

5. 观察与学习
   ├─> 记录回合 (存入数据库)
   ├─> 更新工作记忆
   ├─> 存入情节记忆
   ├─> 提取知识 (语义摄取)
   └─> 更新预算 (支出追踪)

6. 持久化
   ├─> 保存智能体状态
   ├─> 记录回合详情
   ├─> 计划下一次唤醒事件
   └─> 发出状态变更事件

7. 循环继续
   ├─> 检查预算 (继续或休眠)
   ├─> 检查错误 (继续或中止)
   └─> 从步骤 2 重复
```

---

## 关键设计模式

### 1. 多层记忆模式

针对不同类型信息采用独立的记忆系统，配合专门的存储和检索策略。

### 2. 策略驱动的安全机制

通过可配置的策略规则而非硬编码检查来强制执行运行时安全。

### 3. 基于工具的可扩展性

各项能力以工具形式暴露，可动态注册和调用。

### 4. 带审计的自我修改

具备全面的审计日志记录和回滚功能的代码生成能力。

### 5. 多供应商推理

抽象的推理层，支持多个 LLM 供应商并具备智能路由功能。

### 6. 事件驱动架构

通过唤醒事件和收件箱消息驱动智能体执行，而非轮询。

### 7. 财务感知

内置信用额度追踪、支出限制以及 Conway API 集成。

---

## 外部依赖

| 依赖 | 用途 | 是否关键？ |
|------------|---------|-----------|
| better-sqlite3 | 嵌入式数据库 | ✅ 是 |
| express | Web 服务器 (未来的 API) | ⚠️ 计划中 |
| openai | LLM 推理客户端 | ✅ 是 |
| viem | 以太坊区块链交互 | ✅ 是 |
| siwe | 以太坊认证 (SIWE) | ✅ 是 |
| ulid | 唯一 ID 生成 | ✅ 是 |
| simple-git | Git 集成 | ✅ 是 |
| cron-parser | 计划事件解析 | ✅ 是 |

---

## 安全考虑

1. **注入防御：** 在调用 LLM 前对所有输入进行消毒
2. **策略执行：** 对所有操作执行运行时安全规则
3. **预算限制：** 支出追踪和信用额度限制
4. **路径保护：** 文件系统访问控制
5. **审计日志：** 记录所有自我修改行为
6. **速率限制：** API 使用频率限制

---

## 测试策略

**测试框架：** vitest

**测试套件：**

- `test:security` - 安全和注入测试
- `test:financial` - 财务/金库逻辑测试
- `test:ci` - 针对 CI/CD 优化的测试

**覆盖率：** 所有模块均包含全面的单元测试和集成测试。

---

## 开发工作流

```bash
cd automaton
pnpm install          # 安装依赖
pnpm build            # 编译 TypeScript
pnpm dev              # 开发监控模式
pnpm test             # 运行所有测试
pnpm test:coverage    # 覆盖率报告
```

---

## 部署考虑

- **运行时：** Node.js >= 20.0.0
- **数据库：** SQLite 文件 (嵌入式，不需要外部数据库)
- **存储：** 用于配置、状态和钱包的文件系统
- **网络：** Conway API, Ethereum RPC, LLM 供应商
- **监控：** 具有日志级别的内置日志记录器

---

## 未来增强

1. **多智能体支持：** 在同一进程中运行多个 Automaton
2. **社交层：** 多智能体间的通信与协作
3. **高级自我修改：** 更复杂的代码生成能力
4. **插件系统：** 第三方技能包支持
5. **Web UI：** 用于监控和控制的仪表盘

---

_本架构文档由 BMAD `document-project` 工作流生成_
