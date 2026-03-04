# Story 3b.2: API桥接层 (消息路由)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

作为开发团队，
我想要实现 Automaton 与 TinyClaw 之间的 API 桥接层，支持双向消息路由，
以便两个框架可以深度集成，发挥各自优势（Automaton 的主权执行能力 + TinyClaw 的多渠道消息分发能力），
从而构建一个完整的混合架构系统，支持多渠道消息接收、智能路由到 Automaton Agent、以及响应返回。

## 验收标准

### AC1: API桥接层基础架构
**给定** Automaton 和 TinyClaw 是两个独立运行的框架
**当** 开发者启动集成桥接层
**那么** 必须提供清晰的双向通信机制
**并且** 支持独立部署或容器化部署
**并且** 必须使用环境变量配置连接信息
**并且** 必须提供健康检查端点

**技术要求：**
- 使用 TypeScript 5.9.3 编写
- 支持 Node.js 20+ 运行时
- 独立的桥接层进程，不耦合到任一框架的核心代码

### AC2: TinyClaw → Automaton 消息路由
**给定** TinyClaw 接收到用户消息
**当** 消息需要复杂的自主执行能力（通过路由规则或 @mention 识别）
**那么** 桥接层必须将消息转发到 Automaton API
**并且** 保留完整的上下文信息（conversationId, userId, message content）
**并且** 处理超时和重试机制
**并且** 记录所有桥接操作的日志

**技术要求：**
- 实现路由规则引擎（支持基于内容、Agent ID、会话状态的路由）
- 支持 @mention 路由（如 [@automaton-agent: 请处理这个任务]）
- 完整的错误处理和重试策略（指数退避，最大3次重试）
- 使用 StructuredLogger 记录所有路由操作

### AC3: Automaton → TinyClaw 响应路由
**给定** Automaton 完成任务处理
**当** 需要将响应返回给用户
**那么** 桥接层必须将响应转发到 TinyClaw
**并且** 自动识别目标渠道（Discord/Telegram/WhatsApp/飞书）
**并且** 保留原始会话上下文
**并且** 处理响应格式转换（Automaton 格式 → TinyClaw 格式）

**技术要求：**
- 实现响应转换器（将 Automaton 的内部响应格式转换为 TinyClaw 消息格式）
- 支持多种响应类型（文本、代码块、文件、错误消息）
- 会话上下文共享机制（通过 conversationId 关联）

### AC4: 状态共享与上下文传递
**给定** 消息在两个框架之间流转
**当** 需要保持会话状态一致性
**那么** 桥接层必须维护跨框架的会话映射表
**并且** 支持上下文持久化（SQLite 数据库）
**并且** 处理会话超时和清理

**技术要求：**
- 创建桥接层专用数据库表（bridge_sessions, bridge_messages）
- 实现会话映射（tinyclaw_conversation_id → automaton_conversation_id）
- 定期清理过期会话（定时任务，保留最近7天的会话）

### AC5: 配置管理
**给定** 桥接层需要与两个框架集成
**当** 配置连接参数
**那么** 必须使用 .env 文件配置
**并且** 必须提供配置验证
**并且** 支持热重载配置（无需重启）

**环境变量配置：**
```env
# TinyClaw API 配置
TINYCLAW_API_URL=http://localhost:3777
TINYCLAW_API_TOKEN=your-token

# Automaton API 配置
AUTOMATON_API_URL=http://localhost:3001
AUTOMATON_API_KEY=your-key

# 路由规则配置
BRIDGE_ROUTING_MODE=hybrid  # auto, manual, hybrid
BRIDGE_DEFAULT_AGENT=automaton-agent
BRIDGE_TIMEOUT=30000  # 30秒
BRIDGE_MAX_RETRIES=3

# 数据库配置
BRIDGE_DB_PATH=./data/bridge.db
```

### AC6: 监控与可观测性
**给定** 桥接层运行中
**当** 需要监控系统健康状态
**那么** 必须提供健康检查端点
**并且** 必须记录详细的性能指标
**并且** 必须支持日志聚合

**技术要求：**
- 实现 `/health` 端点（检查与两个框架的连接状态）
- 记录关键指标：消息吞吐量、平均延迟、错误率
- 使用统一的日志格式（与两个框架一致）

### AC7: 错误处理与容错
**给定** 桥接层运行中
**当** 遇到网络错误或服务不可用
**那么** 必须优雅降级
**并且** 必须记录详细的错误信息
**并且** 必须支持消息重试队列

**技术要求：**
- 实现 Circuit Breaker 模式（连续失败5次后暂停路由1分钟）
- 实现死信队列（Dead Letter Queue）存储无法路由的消息
- 提供错误恢复机制（手动重试或自动恢复）

## 任务 / 子任务

- [ ] **任务 1:** 设计桥接层架构 (AC: #1)
  - [ ] 1.1 创建桥接层目录结构
  - [ ] 1.2 设计 API 接口定义
  - [ ] 1.3 设计数据库模式
  - [ ] 1.4 编写技术设计文档

- [ ] **任务 2:** 实现基础框架 (AC: #1, #5, #6)
  - [ ] 2.1 创建项目骨架和 package.json
  - [ ] 2.2 实现配置加载和验证
  - [ ] 2.3 实现 HTTP 服务器和健康检查端点
  - [ ] 2.4 集成 StructuredLogger

- [ ] **任务 3:** 实现消息路由引擎 (AC: #2, #3, #7)
  - [ ] 3.1 实现路由规则解析器
  - [ ] 3.2 实现 TinyClaw → Automaton 转发器
  - [ ] 3.3 实现 Automaton → TinyClaw 响应处理器
  - [ ] 3.4 实现错误处理和重试机制
  - [ ] 3.5 实现 Circuit Breaker

- [ ] **任务 4:** 实现状态管理 (AC: #4)
  - [ ] 4.1 创建数据库模式和迁移脚本
  - [ ] 4.2 实现会话映射管理器
  - [ ] 4.3 实现上下文持久化
  - [ ] 4.4 实现定时清理任务

- [ ] **任务 5:** 集成测试 (AC: #1, #2, #3, #4, #5, #6, #7)
  - [ ] 5.1 编写单元测试（路由规则、转换器、状态管理）
  - [ ] 5.2 编写集成测试（端到端消息流转）
  - [ ] 5.3 运行性能测试（高并发场景）
  - [ ] 5.4 验证错误恢复场景

- [ ] **任务 6:** 文档与部署 (AC: #1, #5, #6)
  - [ ] 6.1 编写用户文档（配置、部署、故障排除）
  - [ ] 6.2 创建 Dockerfile 和 docker-compose.yml
  - [ ] 6.3 更新项目文档索引
  - [ ] 6.4 准备演示脚本

## 开发注意事项

### 技术栈与约束

**编程语言与运行时：**
- TypeScript 5.9.3（严格模式开启）
- Node.js >= 20.0.0
- 模块系统：ESM（与 Automaton 保持一致）

**关键依赖：**
- Express 5.2.1（HTTP 服务器）
- Axios（HTTP 客户端，支持超时和重试）
- Better-sqlite3 11.0.0（状态持久化）
- Winston（结构化日志，与项目统一）

**必须遵守的项目规则：**

1. **模块系统规则（关键）：**
   ```typescript
   // 在 ESM 中必须使用 .js 扩展名
   import { foo } from "./bar.js";  // 正确
   import { foo } from "./bar";      // 错误 - 运行时会失败
   ```

2. **数据库规则：**
   - 使用 WAL 模式启用高并发
   - 所有写操作使用事务（BEGIN IMMEDIATE）
   - 使用预处理语句防止 SQL 注入

3. **安全规则：**
   - 所有外部输入必须验证和消毒
   - 不在日志中暴露 API 密钥
   - 使用环境变量存储敏感信息

4. **日志标准：**
   - 使用 StructuredLogger 带上下文
   - 日志级别：debug, info, warn, error
   - 始终包含关键上下文（conversationId, messageId）

5. **错误处理：**
   - 所有异步操作必须使用 try/catch
   - 实现详细的错误日志（包含堆栈跟踪）
   - 区分业务错误和系统错误

### 文件结构要求

桥接层应位于独立目录：
```
jd/
└── bridge/                           # API桥接层
    ├── src/                          # 源代码
    │   ├── index.ts                  # 入口文件
    │   ├── config/                   # 配置管理
    │   │   ├── index.ts
    │   │   └── types.ts
    │   ├── routing/                  # 路由引擎
    │   │   ├── router.ts             # 核心路由逻辑
    │   │   ├── rules.ts              # 路由规则解析器
    │   │   └── types.ts
    │   ├── forwarder/                # 消息转发器
    │   │   ├── tinyclaw-to-automaton.ts
    │   │   ├── automaton-to-tinyclaw.ts
    │   │   └── types.ts
    │   ├── state/                    # 状态管理
    │   │   ├── session-manager.ts    # 会话映射管理
    │   │   ├── db.ts                 # SQLite 封装
    │   │   └── migrations/           # 数据库迁移
    │   ├── monitor/                  # 监控与可观测性
    │   │   ├── health-check.ts
    │   │   ├── metrics.ts
    │   │   └── types.ts
    │   ├── error/                    # 错误处理
    │   │   ├── circuit-breaker.ts
    │   │   ├── retry-strategy.ts
    │   │   └── types.ts
    │   └── types.ts                  # 共享类型定义
    ├── data/                         # 数据文件
    │   └── bridge.db                 # SQLite 数据库
    ├── tests/                        # 测试
    │   ├── unit/
    │   └── integration/
    ├── package.json                  # 依赖管理
    ├── tsconfig.json                 # TypeScript 配置
    ├── .env.example                  # 环境变量示例
    ├── Dockerfile                    # 容器化部署
    └── README.md                     # 用户文档
```

### 与其他组件的集成

**与 Automaton 的集成：**
- 调用 Automaton 的 REST API（端点：http://localhost:3001/api/v1）
- 使用 Automaton 的 API 密钥进行认证
- 参考 Automaton 的 API 文档（automaton/src/server/）

**与 TinyClaw 的集成：**
- 调用 TinyClaw 的 REST API（端点：http://localhost:3777/api）
- 使用 TinyClaw 的 API Token 进行认证
- 参考 TinyClaw 的 API 文档（tinyclaw/src/server/）

**消息格式映射：**
```typescript
// TinyClaw 消息格式
interface TinyClawMessage {
  messageId: string;
  conversationId: string;
  fromUserId: string;
  toAgentId: string;
  content: string;
  channel: 'discord' | 'telegram' | 'whatsapp' | 'feishu';
  timestamp: number;
}

// Automaton 消息格式
interface AutomatonMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    userId?: string;
    channelId?: string;
    originalMessageId?: string;
  };
  timestamp: number;
}
```

### 性能与扩展性考虑

1. **并发处理：**
   - 桥接层必须支持高并发消息处理
   - 使用连接池管理数据库连接
   - 实现消息批处理机制（批量提交到数据库）

2. **容错与恢复：**
   - 实现消息队列（内存队列 + 持久化备份）
   - 支持优雅关闭（处理完所有待处理消息）
   - 实现定期状态检查和自动恢复

3. **可扩展性：**
   - 支持水平扩展（多个桥接层实例）
   - 使用 Redis 实现分布式锁（如果需要）
   - 支持动态路由规则加载

### 测试要求

**单元测试：**
- 路由规则解析（100% 分支覆盖率）
- 消息格式转换（100% 分支覆盖率）
- 状态管理逻辑（90% 分支覆盖率）
- 错误处理逻辑（90% 分支覆盖率）

**集成测试：**
- 端到端消息流转测试
- 高并发场景测试（至少 1000 并发消息）
- 故障恢复测试（模拟服务不可用）
- 性能测试（平均延迟 < 100ms）

**测试覆盖率阈值：**
- 语句覆盖率：85%
- 分支覆盖率：80%
- 函数覆盖率：85%
- 行覆盖率：85%

### 监控指标

必须记录以下关键指标：

1. **吞吐量：**
   - 每秒处理消息数（TPS）
   - 每分钟处理消息数

2. **延迟：**
   - 平均消息路由延迟
   - 95% 分位延迟
   - 最大延迟

3. **错误率：**
   - 路由失败率
   - API 调用失败率
   - 数据库操作失败率

4. **系统资源：**
   - CPU 使用率
   - 内存使用量
   - 数据库连接数

### 已完成相关工作参考

**最近的提交（2026-03-04）：**
- 9d4c6f5 - 删除过时的实现文档和故事文件
- 0be55c7 - 添加多个实现工件文件
- ee7fe81 - 新增飞书对接功能并重构文档结构
- a3569da - 更新项目文档并补充安全验证与人工介入设计
- c9a703d - 添加国产大模型支持并优化飞书客户端集成

**已完成的功能：**
- TinyClaw 多渠道客户端（Discord/Telegram/WhatsApp/飞书）
- Automaton 主权 AI Agent 运行时
- 数据库持久化（better-sqlite3）
- 消息队列处理（queue-processor.ts）
- @mention 路由机制（routing.ts）

**相关文档：**
- [integration-architecture.md](/Users/yongjunwu/trea/jd/docs/integration-architecture.md) - 集成架构文档（第116行提到消息路由作为集成点）
- [upwork_autopilot_detailed_design.md](/Users/yongjunwu/trea/jd/docs/upwork_autopilot_detailed_design.md) - 详细设计文档（第450-477行描述 @mention 路由机制）
- [architecture-tinyclaw.md](/Users/yongjunwu/trea/jd/docs/architecture-tinyclaw.md) - TinyClaw 架构文档（第69行描述团队会话和提及路由）

### 风险与缓解措施

**风险 1:** 两个框架的 API 变更导致桥接层失效
**缓解:** 实现版本检测和兼容性检查，定期更新桥接层代码

**风险 2:** 网络延迟导致消息路由超时
**缓解:** 实现异步消息队列和批量处理机制，优化超时配置

**风险 3:** 数据库锁竞争导致性能下降
**缓解:** 使用 WAL 模式，优化索引，实现连接池

**风险 4:** 会话状态不一致导致消息丢失
**缓解:** 实现幂等性检查，定期同步会话状态

## 参考资料

### 技术文档引用

- [TinyClaw 消息路由机制](/Users/yongjunwu/trea/jd/docs/upwork_autopilot_detailed_design.md#L450-L477) - @mention 路由实现
- [TinyClaw 团队会话机制](/Users/yongjunwu/trea/jd/docs/architecture-tinyclaw.md#L69-L98) - 团队消息路由
- [集成架构概览](/Users/yongjunwu/trea/jd/docs/integration-architecture.md#L116-L122) - API 桥接作为集成点
- [双框架职责划分](/Users/yongjunwu/trea/jd/docs/upwork_autopilot_detailed_design.md#L154-L157) - 前台通讯 + 后台主权

### 代码参考

- TinyClaw 路由实现：`tinyclaw/src/lib/routing.ts`（parseMentions, routeMentions）
- TinyClaw 队列处理器：`tinyclaw/src/queue-processor.ts`
- Automaton 编排引擎：`automaton/src/orchestration/orchestrator.ts`

### 相关 Epic

- Epic 3b: 混合架构实施（优先级：⭐⭐⭐）
  - 3b.1: Automaton作为TinyClaw专用智能体
  - **3b.2: API桥接层 (消息路由)** ← 当前故事
  - 3b.3: 状态共享机制
  - 3b.4: 统一日志和监控
  - 3b.5: 部署协调工具 (Docker Compose)

## 开发代理记录

### 代理模型使用

Claude Opus 4.6 (claude-opus-4-6)

### 调试日志参考

### 完成备注列表

- [ ] 验证路由规则引擎支持多种匹配模式（Agent ID、关键词、会话状态）
- [ ] 验证 @mention 路由与 TinyClaw 现有机制兼容
- [ ] 验证桥接层可以在两个框架独立重启时保持状态一致性
- [ ] 验证错误处理机制可以捕获并记录所有异常场景

### 文件列表

创建/修改的文件列表（开发完成后填写）：

```
bridge/
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── index.ts
│   │   └── types.ts
│   ├── routing/
│   │   ├── router.ts
│   │   ├── rules.ts
│   │   └── types.ts
│   ├── forwarder/
│   │   ├── tinyclaw-to-automaton.ts
│   │   ├── automaton-to-tinyclaw.ts
│   │   └── types.ts
│   ├── state/
│   │   ├── session-manager.ts
│   │   ├── db.ts
│   │   └── migrations/
│   │       └── 001-initial-schema.sql
│   ├── monitor/
│   │   ├── health-check.ts
│   │   ├── metrics.ts
│   │   └── types.ts
│   ├── error/
│   │   ├── circuit-breaker.ts
│   │   ├── retry-strategy.ts
│   │   └── types.ts
│   └── types.ts
├── tests/
│   ├── unit/
│   │   ├── routing.test.ts
│   │   ├── forwarder.test.ts
│   │   └── state.test.ts
│   └── integration/
│       └── end-to-end.test.ts
├── data/
│   └── bridge.db (运行时创建)
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── README.md
```

### 下一步行动

1. **架构设计确认** - 与团队评审桥接层架构设计
2. **接口定义确认** - 与 Automaton 和 TinyClaw 团队确认 API 接口规范
3. **开发实现** - 按照任务列表开始编码
4. **集成测试** - 部署测试环境进行端到端验证
5. **文档完善** - 编写详细的用户文档和开发者指南
6. **代码审查** - 邀请团队成员进行代码审查

---

**故事创建日期：** 2026-03-04
**基于文档：**
- integration-architecture.md (API桥接作为集成点)
- upwork_autopilot_detailed_design.md (@mention 路由机制)
- architecture-tinyclaw.md (团队会话和路由)
- project-context.md (技术栈和约束)
- epics.md (Epic 3b: 混合架构实施)

**状态：** ready-for-dev
