# JD - 集成架构

**代码仓库：** jd (monorepo)
**上次更新：** 2026-03-03

---

## 概述

本文档描述了 JD monorepo 的集成架构，包括 Conway Automaton 与 TinyClaw 之间的关系、它们的共享模式以及潜在的集成点。

---

## Monorepo 结构

```text
jd/
├── automaton/              # 第一部分：Conway Automaton
│   ├── src/                # AI 智能体运行时
│   ├── packages/cli/       # CLI 界面
│   └── ...
│
├── tinyclaw/               # 第二部分：TinyClaw
│   ├── src/                # 后端 (智能体、渠道、队列)
│   ├── tinyoffice/         # 前端 (Next.js)
│   └── ...
│
├── docs/                 # 设计文档与 PRD
├── docs/                   # 自动生成的文档
└── CLAUDE.md              # 项目指南
```

---

## 各部分的独立性

**Conway Automaton** 和 **TinyClaw** 在**架构上是独立的**：

- ✅ 可以分别开发
- ✅ 可以独立部署
- ✅ 运行期间互无依赖
- ✅ 拥有独立的数据库和状态
- ✅ 拥有独立的配置文件
- ✅ 拥有独立的 package.json 和依赖项

**共同特征：**

- 均使用 TypeScript
- 均使用 better-sqlite3 进行持久化
- 均实现了自主 AI 智能体系统
- 均使用 LLM 供应商 (Claude, OpenAI)
- 均遵循以智能体为中心的架构
- 拥有相似的目录结构

---

## 概念性集成点

虽然没有直接集成，但两个项目在概念上保持一致：

### 1. 智能体模式 (Agent Patterns)

两者实现了类似的智能体概念：

| 概念 | Automaton | TinyClaw |
|---------|-----------|----------|
| **智能体定义** | 数据库中的智能体配置 | JSON 中的智能体配置 |
| **系统提示词** | 每个智能体均可自定义 | 每个智能体均可自定义 |
| **对话状态** | SQLite 情节记忆 | SQLite 会话表 |
| **LLM 集成** | 多供应商推理接口 | 多供应商推理接口 |
| **工具/技能系统** | 通过自修改动态生成工具 | 配置文件中的静态工具 |

### 2. 记忆模式 (Memory Patterns)

两者都使用持久化记忆：

| 模式 | Automaton | TinyClaw |
|---------|-----------|----------|
| **存储方式** | SQLite (better-sqlite3) | SQLite (better-sqlite3) |
| **对话历史** | 情节记忆 (Episodic memory) | 会话表 (Conversation table) |
| **工作目录** | 每个智能体的工作区 | 每个智能体的 working_dir |
| **状态隔离** | 记忆分层 | 会话隔离 |

### 3. 多智能体协作

两者都支持多智能体系统：

| 功能 | Automaton | TinyClaw |
|---------|-----------|----------|
| **团队概念** | 已规划 (orchestration) | 已实现 (teams) |
| **智能体通信** | 消息系统 | 团队提及 (Mentions) |
| **编排方式** | 编排器 (Orchestrator) | 团队负责人模式 |
| **状态共享** | 共享记忆 | 内部消息 |

### 4. 安全与策略

两者均强制执行安全措施：

| 安全功能 | Automaton | TinyClaw |
|---------------|-----------|----------|
| **输入验证** | 策略引擎 | 插件钩子 (Hooks) |
| **速率限制** | 策略规则 | 队列限制 |
| **预算追踪** | Conway 额度 | 供应商额度限制 |
| **审计日志** | 自修改审计 | 活动日志 |

---

## 潜在集成场景 (Potential Integration Scenarios)

### 场景 1：将 Automaton 作为 TinyClaw 智能体

**概念：** 将 Conway Automaton 作为 TinyClaw 内部的一个专业智能体使用。

**集成点：**

1. **消息路由：** 将特定消息路由到 Automaton
2. **API 桥接：** TinyClaw 调用 Automaton API
3. **状态共享：** 共享会话上下文
4. **能力杠杆：** 为 TinyClaw 智能体利用 Automaton 的自修改能力

**架构图：**

```text
用户 → TinyClaw 渠道 → 队列 → @automaton-agent
                                         ↓
                                 Conway Automaton API
                                         ↓
                                 TinyClaw 响应队列
                                         ↓
                                 用户
```

**优势：**

- 利用 Automaton 先进的记忆系统
- 使用自修改实现智能体进化
- 应用策略引擎确保安全
- 共享 Conway 计费集成

### 场景 2：将 TinyClaw 作为 Automaton 界面

**概念：** 将 TinyClaw 渠道作为 Automaton 的输入/输出。

**集成点：**

1. **渠道集成：** Automaton 通过 TinyClaw 渠道接收消息
2. **响应路由：** Automaton 响应通过 TinyClaw 发送
3. **团队编排：** TinyClaw 团队协调 Automaton 实例
4. **前端控制：** TinyOffice 管理 Automaton

**架构图：**

```text
Discord/Telegram/WhatsApp → TinyClaw 渠道
                                    ↓
                            TinyClaw 队列
                                    ↓
                         Conway Automaton 循环
                                    ↓
                            Automaton 响应
                                    ↓
                         TinyClaw 响应队列
                                    ↓
                           TinyClaw 渠道
                                    ↓
                                  用户
```

**优势：**

- 为 Automaton 提供多渠道输入
- 使用 Web UI (TinyOffice) 控制 Automaton
- 针对多个 Automaton 进行团队协作
- 统一日志记录与监控

### 场景 3：共享智能体生态系统

**概念：** 使用通用的工具和技能创建共享智能体生态。

**集成点：**

1. **共享工具库：** 通用的工具实现
2. **智能体注册表：** 中心智能体目录
3. **技能市场：** 项目间共享技能
4. **配置同步：** 同步智能体配置

**优势：**

- 复用智能体实现
- 分享最佳实践
- 通用工具库
- 统一智能体管理

### 场景 4：混合架构 (Hybrid Architecture)

**概念：** 结合两种架构以适应不同用例。

**用例：**

- **Automaton:** 支持 Web3 的长期主权智能体
- **TinyClaw:** 多渠道客服与团队协作
- **Hybrid:** Automaton 处理复杂推理，TinyClaw 处理通信

**架构图：**

```text
渠道 (Discord/Telegram) → TinyClaw
                                       ↓
                              简单查询 → TinyClaw 智能体
                                       ↓
                           复杂任务 → Conway Automaton
                                       ↓
                                  响应
```

**优势：**

- 用最合适的工具解决最合适的问题
- 可扩展的架构
- 专业化的能力
- 灵活的部署方式

---

## 共享基础设施模式

### 1. SQLite 持久化

两者均使用 SQLite 并采用类似的模式：

```sql
-- 通用模式
CREATE TABLE IF NOT EXISTS agent_state (...);
CREATE TABLE IF NOT EXISTS conversations (...);
CREATE TABLE IF NOT EXISTS logs (...);
```

### 2. 配置管理

两者均使用 JSON 配置：

```json
{
  "agents": {
    "agent-id": {
      "provider": "claude",
      "model": "claude-3-opus",
      "system_prompt": "...",
      "working_dir": "..."
    }
  }
}
```

### 3. LLM 供应商集成

两者均支持多个供应商：

```typescript
// 通用接口
interface LLMProvider {
  name: string;
  apiKey: string;
  baseUrl?: string;
  models: string[];
}
```

### 4. 日志记录与可观测性

两者均使用结构化日志：

```typescript
// 通用模式
logger.info("消息", { context });
logger.warn("警告", { context });
logger.error("错误", { context, error });
```

---

## 跨项目协作 (Cross-Project Collaboration)

### 知识共享

- **文档：** 两者均在 `docs/` 中记录
- **设计模式：** 共享架构模式
- **最佳实践：** 通用开发实践
- **TypeScript 标准：** 一致的类型使用

### 开发流程

- **Git：** 共享代码库，独立分支
- **测试：** 类似的测试框架 (vitest/jest)
- **构建：** TypeScript 编译流程
- **部署：** 独立但协调

### 未来集成可能性

1. **共享库：** 创建带有通用工具的 `@jd/core` 包
2. **统一 CLI：** 为两个项目提供单一 CLI 工具
3. **通用前端：** 共享 Web UI 组件
4. **集成测试：** 跨项目集成测试
5. **统一文档：** 单一文档站点

---

## 部署建议

### 独立部署

```bash
# 部署 Automaton
cd automaton
pnpm install
pnpm build
# 作为服务运行

# 部署 TinyClaw
cd tinyclaw
npm install
npm run build
npm run queue &
npm run discord &
npm run telegram &
# 独立运行 TinyOffice
cd tinyoffice
npm install
npm run build
npm run start
```

### 协调部署

```bash
# 同时部署两者
./deploy.sh automaton tinyclaw
# 共享基础设施 (数据库、日志、监控等)
```

### 容器化 (Containerization)

```dockerfile
# 针对两者的 Docker Compose
version: '3.8'
services:
  automaton:
    build: ./automaton
    ports:
      - "3001:3001"

  tinyclaw-queue:
    build: ./tinyclaw
    command: npm run queue

  tinyclaw-discord:
    build: ./tinyclaw
    command: npm run discord

  tinyclaw-telegram:
    build: ./tinyclaw
    command: npm run telegram

  tinyclaw-api:
    build: ./tinyclaw
    ports:
      - "3777:3777"

  tinyclaw-frontend:
    build: ./tinyclaw/tinyoffice
    ports:
      - "3000:3000"
```

---

## 结论

虽然 **Conway Automaton** 和 **TinyClaw** 目前是独立的项目，但它们共享深层的架构 DNA，并能从未来的深度集成中受益。当前的独立状态允许：

- ✅ 专注于发挥各自项目的优势
- ✅ 独立的扩展与部署
- ✅ 针对不同的用例和受众
- ✅ 各自独立演进的灵活性

潜在的集成场景为将它们的优势结合成一个统一的自主智能体平台提供了激动人心的可能性。

---

_本集成架构文档由 BMAD `document-project` 工作流生成_
