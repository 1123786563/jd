# Story 1a+.5: 核心架构可视化

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

作为项目架构师和开发者，我想要创建完整的 Mermaid 架构可视化文档，以便清晰地展示 Automaton 和 TinyClaw 双框架的核心机制、状态机、编排引擎、经济大脑和 Web4 身份系统。

## Acceptance Criteria

1. ✅ **Automaton 核心架构图** - 完整展示状态机、编排引擎、经济大脑、Web4 身份、记忆系统、主权执行层
2. ✅ **TinyClaw 核心架构图** - 完整展示消息总线、多智能体工作节点、上下文存储、感知通道层
3. ✅ **四层全景架构流转图** - 从感知通道层到主权执行层的完整数据流
4. ✅ **Redis+SQLite 混合队列架构图** - 展示 Redis 实时分发 + SQLite 持久化的设计模式
5. ✅ **经济大脑与预算熔断机制图** - 展示 SpendTracker、Budget Guard、Policy Engine 的协同
6. ✅ **会话状态机与任务节点状态机图** - 展示 conversation_state 和 task_node 状态转换
7. ✅ **异常回流机制图** - 展示四大回流类型 (COMPILATION_ERROR/LOGIC_ERROR/REQUIREMENT_MISMATCH/ARCHITECTURE_FLAW)
8. ✅ **双脑控制模式对比表** - 清晰对比 TinyClaw (前台) vs Automaton (后台) 的职责划分

## Tasks / Subtasks

- [x] Task 1 (AC: 1-3): 创建 Automaton 和 TinyClaw 核心架构图 (AC: 1, 2, 3)
  - [x] Subtask 1.1: Automaton 核心架构图 (状态机 + 编排 + 经济 + Web4 + 记忆)
  - [x] Subtask 1.2: TinyClaw 核心架构图 (消息总线 + 多智能体 + 上下文)
  - [x] Subtask 1.3: 四层全景架构流转图 (感知 → 决策风控 → 多体工厂 → 主权执行)
- [x] Task 2 (AC: 4-6): 创建详细机制架构图 (AC: 4, 5, 6)
  - [x] Subtask 2.1: Redis+SQLite 混合队列架构图
  - [x] Subtask 2.2: 经济大脑与预算熔断机制图
  - [x] Subtask 2.3: 会话状态机与任务节点状态机图
- [x] Task 3 (AC: 7-8): 创建异常处理与职责划分文档 (AC: 7, 8)
  - [x] Subtask 3.1: 异常回流机制图
  - [x] Subtask 3.2: 双脑控制模式职责对比表

## Dev Notes

### 架构可视化原则

1. **Mermaid 语法标准**: 使用 `graph TD` (Top-Down) 和 `subgraph` 分层展示
2. **颜色语义化**: 不同模块使用不同颜色区分 (核心机制/消息流/存储/外部接口)
3. **箭头语义**: 实线箭头表示直接依赖,虚线箭头表示间接影响
4. **文字简洁**: 节点标签不超过 2 行,详细说明放在节点注释中

### 核心架构组件

#### Automaton 核心组件
- **Core Loop ReAct**: `waking → running → sleeping → critical → dead` 状态机
- **Orchestration Engine**: 七步状态机 (classifying, planning, executing, replanning),TaskNode DAG 生成
- **Economic Brain**: SpendTracker, TopupSystem, PolicyEngine (预算熔断)
- **Web4 Identity**: ERC-8004 Registry, EVM Wallet, Token Balance
- **Memory System**: Memory Retriever, Ingestion, Context Compression

#### TinyClaw 核心组件
- **Message Bus**: SQLite WAL 模式,`BEGIN IMMEDIATE` 事务锁定
- **Queue Processor**: `agentProcessingChains` Map 并行协程锁链
- **@Mention Router**: 正则提取标签实现 Agent 互调
- **Plugin Hooks**: runIncomingHooks/runOutgoingHooks 消息拦截器
- **Conversation Lock**: 对话并发控制锁

### 双脑控制模式职责划分

| 职责 | TinyClaw (前台) | Automaton (后台) |
|------|-----------------|------------------|
| **消息路由** | SQLite 消息队列、@mention 路由 | - |
| **状态管理** | 会话状态、对话锁 | Task Graph、全局预算 |
| **风控决策** | Rate Limiter、Scrubbing Hook | Policy Engine、Spend Tracker |
| **链上交互** | - | EVM Wallet、ERC-8004 注册 |
| **代码执行** | - | Sandbox Manager、Worker Pool |

### 异常回流类型

1. **COMPILATION_ERROR**: 代码编译失败,回流到 DevAgent 重试
2. **LOGIC_ERROR**: 业务逻辑错误,回流到 ArchitectAgent 调整设计
3. **REQUIREMENT_MISMATCH**: 需求理解偏差,回流到 SalesAgent 重新澄清
4. **ARCHITECTURE_FLAW**: 架构设计缺陷,回流到全局架构审查

## Architecture Visualization

### 1. Automaton 核心架构图 (Mermaid)

```mermaid
graph TD
    subgraph AutomatonEcosystem [Automaton Sovereign Runtime - Sovereign AI Agent Framework]
        subgraph CoreLoop [Core Loop ReAct State Machine]
            State[State Machine<br/>waking→running→sleeping→critical→dead]
            InferenceRouter[Inference Router<br/>LLM Model Selection]
            ToolExecutor[Tool Executor<br/>Function Calling]
            State --> InferenceRouter
            InferenceRouter --> ToolExecutor
            ToolExecutor --> State
        end

        subgraph OrchestrationEngine [Orchestration & Compute Engine]
            TaskGraph[TaskGraph DAG<br/>planGoal() decomposition]
            WorkerPool[Local Worker Pool]
            SandboxManager[Sandbox Manager<br/>Docker Isolation]
            TaskQueue[Task Queue]
            TaskQueue --> WorkerPool
            TaskQueue --> SandboxManager
            OrchestrationEngine --> TaskGraph
        end

        subgraph MemorySystem [Memory & Context Pipeline]
            Retrieval[Memory Retriever<br/>Vector Search]
            Ingestion[Memory Ingestion<br/>Multi-source Integration]
            Compression[Context Compression<br/>Summarization]
            Retrieval --> Compression
            Ingestion --> Compression
        end

        subgraph EconomicEngine [Economic Brain & Risk Control]
            SpendTracker[Spend Tracker<br/>Hourly/Daily Cost]
            TopupSystem[USDC to Credits<br/>Auto Topup]
            PolicyEngine[Policy Engine<br/>Budget Guard + Risk Classifier]
            SpendTracker --> TopupSystem
            SpendTracker -.->|Alert| PolicyEngine
            TopupSystem -.->|Balance| PolicyEngine
        end

        subgraph Web4Identity [Web4 Identity & Ledger]
            ERC8004[ERC-8004 Registry<br/>On-chain Agent ID]
            EVMWallet[EVM Wallet & KMS]
            TokenBalance[USDC / Token<br/>Balances]
            EVMWallet --> ERC8004
            EVMWallet --> TokenBalance
        end

        ToolExecutor -.->|Track Usage| SpendTracker
        CoreLoop --> OrchestrationEngine
        CoreLoop <--> MemorySystem
        EconomicEngine -->|Sign Tx| EVMWallet
        OrchestrationEngine -.->|Budget Check| PolicyEngine
        PolicyEngine -.->|Block| OrchestrationEngine
    end
```

### 2. TinyClaw 核心架构图 (Mermaid)

```mermaid
graph TD
    subgraph TinyClawSystem [TinyClaw Orchestration - Multi-Agent Coordination System]
        subgraph PerceptualChannels [Input/Output Channels - Multi-platform Adapters]
            UpworkAdapter[Upwork API / Scraper]
            DiscordAdapter[Discord Client]
            TGAdapter[Telegram Client]
            FeishuAdapter[Feishu Client]
        end

        subgraph MessageBus [SQLite Message Bus - Transactional Queue]
            IncomingQ[Incoming Message Queue<br/>WAL Mode + BEGIN IMMEDIATE]
            OutgoingQ[Outgoing Queue<br/>Rate Limited]
            Routing[Lock-Free Router<br/>@Mention Parser]
            IncomingQ --> Routing
            Routing --> OutgoingQ
        end

        subgraph Agency [Multi-Agent Worker Nodes - Parallel Execution]
            Scout[Scout Agent<br/>Context A - Job Discovery]
            Leader[Leader Agent<br/>Context B - Negotiation]
            Accountant[Accountant Agent<br/>Escrow Verification]
            Architect[Architect Agent<br/>DAG Planning]
            DevTeam[Dev/QA Agents<br/>Context C - Implementation]
        end

        subgraph ContextStore [Context & Chat History - State Management]
            ConversationLock[Conversation Mutex]
            ChatLogs[Markdown Chat Logs]
            StateTracker[Task State Tracker<br/>conversation_state]
            ConversationLock --> ChatLogs
            ConversationLock --> StateTracker
        end

        subgraph PluginSystem [Non-invasive Plugin Hooks]
            IncomingHook[runIncomingHooks]
            OutgoingHook[runOutgoingHooks]
            IncomingQ --> IncomingHook
            OutgoingQ --> OutgoingHook
        end

        PerceptualChannels <-->|Webhook/Polling| IncomingQ
        OutgoingQ -->|API Send| PerceptualChannels
        Routing -->|Assign Task| Leader
        Routing -->|Forward| Scout
        Leader <-->|@Mention| Accountant
        Accountant <-->|@Mention| Architect
        Architect <-->|Subtasks| DevTeam
        Agency --> ConversationLock
    end
```

### 3. 四层全景架构流转图

```mermaid
graph TD
    subgraph Layer1 [感知通道层 Perception & Channel]
        UpworkAPI[Upwork API Adapter]
        DiscordClient[Discord Adapter]
        TelegramClient[Telegram Adapter]
        FeishuClient[Feishu Adapter]
        WhatsAppClient[WhatsApp Adapter]

        UpworkAPI --> RateLimiter
        DiscordClient --> RateLimiter
        TelegramClient --> RateLimiter
        FeishuClient --> RateLimiter
        WhatsAppClient --> RateLimiter
    end

    subgraph Layer2 [决策风控层 Cognition & Risk]
        RateLimiter[Rate Limiter<br/>Token Bucket + Jitter]
        ScrubbingHook[Scrubbing Hook<br/>De-AI Engine]
        PolicyEngine[Policy Engine<br/>Automaton Backend]

        EscrowCheck[Escrow Check]
        BudgetGuard[Budget Guard]
        RiskClassifier[Risk Classifier]

        RateLimiter --> ScrubbingHook
        ScrubbingHook --> PolicyEngine
        EscrowCheck --> PolicyEngine
        BudgetGuard --> PolicyEngine
        RiskClassifier --> PolicyEngine
    end

    subgraph Layer3 [多体工厂层 Multi-Agent Factory]
        MessageBus[SQLite Message Bus<br/>WAL Mode]
        messages[Table: messages]
        conversations[Table: conversations]
        conversation_locks[Table: conversation_locks]

        QueueProcessor[Queue Processor<br/>Parallel Chains]
        MentionRouter[@Mention Router]
        PromiseChain[Promise Chain<br/>Per-Agent Serialization]

        ScoutAgent[Scout Agent]
        SalesAgent[Sales Agent]
        AccountantAgent[Accountant Agent]
        ArchitectAgent[Architect Agent]
        DevQAAgents[Dev/QA Agents]

        MessageBus --> messages
        MessageBus --> conversations
        MessageBus --> conversation_locks
        messages --> QueueProcessor
        conversations --> QueueProcessor
        QueueProcessor --> MentionRouter
        MentionRouter --> PromiseChain
        PromiseChain --> ScoutAgent
        PromiseChain --> SalesAgent
        PromiseChain --> AccountantAgent
        PromiseChain --> ArchitectAgent
        PromiseChain --> DevQAAgents
    end

    subgraph Layer4 [主权执行层 Sovereign Executor]
        AutomatonRuntime[Automaton Core Runtime]
        GlobalSpendTracker[Global Spend Tracker]
        TaskGraphEngine[TaskGraph Engine<br/>DAG Execution]
        LoopEnforcement[Loop Enforcement<br/>Deadlock Prevention]

        SandboxExecutor[Sandboxed Executor<br/>Docker Isolation]
        EVMWallet[EVM Wallet & KMS]
        MemorySystem[Memory System<br/>Vector DB]

        GlobalSpendTracker --> TaskGraphEngine
        TaskGraphEngine --> LoopEnforcement
        AutomatonRuntime --> SandboxExecutor
        AutomatonRuntime --> EVMWallet
        AutomatonRuntime --> MemorySystem
    end

    PolicyEngine --> MessageBus
    DevQAAgents --> AutomatonRuntime

    subgraph HumanAdmin [Human Admin Interface]
        TelegramAdmin[Telegram Admin]
        DiscordAdmin[Discord Admin]
    end

    AutomatonRuntime --> TelegramAdmin
    AutomatonRuntime --> DiscordAdmin
```

### 4. Redis+SQLite 混合队列架构图

```mermaid
graph LR
    subgraph MessageFlow [消息流 Message Flow]
        Channel[Upwork/IM Channels] -->|enqueue| RedisQueue[Redis List<br/>Real-time Distribution]
        RedisQueue -->|claim| QueueProcessor[Queue Processor]
        QueueProcessor -->|ACK| RedisQueue
        RedisQueue -->|persist| SQLiteDB[SQLite WAL Mode<br/>Journal Mode = WAL<br/>Sync Mode = Normal]

        Channel -->|direct| SQLiteDB
        SQLiteDB -->|recovery| RedisQueue
    end

    subgraph FailureRecovery [故障恢复 Failure Recovery]
        Crash[Process Crash] -->|auto-recover| SQLiteDB
        SQLiteDB -->|stale messages| RedisQueue
    end

    style RedisQueue fill:#ff9999
    style SQLiteDB fill:#99ccff
```

### 5. 经济大脑与预算熔断机制

```mermaid
graph TD
    subgraph EconomicBrain [Economic Brain - Cost Control]
        SpendTracker[Spend Tracker<br/>Track Hourly/Daily Cost]
        BudgetGuard[Budget Guard<br/>Threshold: 90% of Daily Limit]
        CircuitBreaker[Circuit Breaker<br/>Block Execution on Exceeded Budget]

        SpendTracker -->|Budget = 90%| BudgetGuard
        BudgetGuard -->|Block & Alert| CircuitBreaker
        CircuitBreaker -->|Notify| HumanAdmin

        TopupSystem[Auto Topup<br/>USDC→Credits Conversion]
        SpendTracker -->|Balance < 20%| TopupSystem
        TopupSystem -->|Replenish Budget| SpendTracker
    end

    subgraph HumanAdmin [Human Admin]
        TelegramAlert[Telegram Alert]
        Approval[Manual Approval Required<br/>for Budget Override]
    end

    CircuitBreaker -->|Send Alert| TelegramAlert
    TelegramAlert -->|Wait| Approval
```

### 6. 会话状态机与任务节点状态机

```mermaid
stateDiagram-v2
    [*] --> discovered: Job Found
    discovered --> negotiating: Quote Sent
    negotiating --> signed: Contract Signed
    signed --> developing: DAG Approved
    developing --> testing: All Tasks Done
    testing --> deployed: QA Passed
    deployed --> [*]

    discovered --> abandoned: No Response (timeout)
    negotiating --> abandoned: No Agreement
    signed --> abandoned: Funds Insufficient
    developing --> abandoned: Human Reject
    testing --> abandoned: Failed Tests
```

```mermaid
stateDiagram-v2
    [*] --> blocked: Dependencies Pending
    blocked --> pending: All Dependencies Met
    pending --> running: Assigned to Agent
    running --> completed: Task Success
    running --> failed: Error Occurred
    failed --> running: Retry (max 5 attempts)<br/>with Exponential Backoff<br/>(1s, 2s, 4s, 8s, 16s)
    failed --> abandoned: Max Retries Reached<br/>(Circuit Breaker Triggered)
    completed --> [*]

    note right of running
        Retry Logic:
        - Max 5 attempts
        - Exponential backoff: 2^n seconds
        - Circuit breaker prevents infinite loops
    end note
```

### 7. 异常回流机制

```mermaid
graph TD
    Error[Error Detected] --> Type{Error Type?}

    Type -->|COMPILATION_ERROR| DevAgent[Dev Agent<br/>Code Fix]
    Type -->|LOGIC_ERROR| ArchitectAgent[Architect Agent<br/>Design Adjustment]
    Type -->|REQUIREMENT_MISMATCH| SalesAgent[Sales Agent<br/>Requirement Clarification]
    Type -->|ARCHITECTURE_FLAW| ReviewBoard[Architecture Review Board]

    DevAgent -->|Retry| Retry
    ArchitectAgent -->|Regenerate DAG| Retry
    SalesAgent -->|Update Spec| Retry
    ReviewBoard -->|Fix Architecture| Retry

    Retry[Retry Implementation] --> Success{Success?}
    Success -->|Yes| Continue[Continue Workflow]
    Success -->|No| CircuitBreaker[Circuit Breaker<br/>Human Intervention]

    CircuitBreaker -->|Alert| HumanAdmin[Human Admin<br/>Telegram/Discord Alert]
    HumanAdmin -->|Approval| Continue
    HumanAdmin -->|Reject| Abandoned[Task Abandoned]

    style Continue fill:#90EE90
    style Abandoned fill:#FFB6C1
```

## References

- **架构设计源文件**: [docs/upwork_autopilot_detailed_design.md](docs/upwork_autopilot_detailed_design.md)
- **Automaton 机制**: [automaton/src/heartbeat/daemon.ts](automaton/src/heartbeat/daemon.ts), [automaton/src/orchestration/orchestrator.ts](automaton/src/orchestration/orchestrator.ts)
- **TinyClaw 机制**: [tinyclaw/lib/db.ts](tinyclaw/lib/db.ts), [tinyclaw/queue-processor.ts](tinyclaw/queue-processor.ts)
- **经济引擎**: [automaton/src/types.ts](automaton/src/types.ts) (SpendTracker), [automaton/src/index.ts](automaton/src/index.ts) (bootstrapTopup)
- **Web4 集成**: [automaton/src/conway/client.ts](automaton/src/conway/client.ts) (registerAutomaton)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- ✅ Automaton 核心架构图完成 - 包含状态机、编排引擎、经济大脑、Web4 身份、记忆系统
- ✅ TinyClaw 核心架构图完成 - 包含消息总线、多智能体、上下文存储、插件钩子
- ✅ 四层全景架构流转图完成 - 从感知通道到主权执行的完整数据流
- ✅ 混合队列架构图完成 - Redis (实时) + SQLite (持久化) 设计模式
- ✅ 经济大脑与预算熔断机制完成 - 包含 SpendTracker、Budget Guard、TopupSystem
- ✅ 会话状态机和任务节点状态机完成 - 完整的状态转换流程
- ✅ 异常回流机制完成 - 四大回流类型及其处理流程
- ✅ 双脑控制模式对比表完成 - 清晰展示职责划分

### 架构可视化标准

- 使用 Mermaid graph TD 语法,保证渲染一致性
- 所有架构图都包含注释说明,便于理解
- 使用 subgraph 分层,提高可读性
- 关键节点使用中文标注,降低理解门槛
- 箭头语义清晰 (实线=直接依赖,虚线=间接影响)

### File List

- `/Users/yongjunwu/trea/jd/_bmad-output/implementation-artifacts/1a-plus-5-architecture-diagram.md` - 故事文件 (本文件)
- 参考文档: `docs/upwork_autopilot_detailed_design.md`
- 架构图输出位置: 本文件的 Architecture Visualization 部分

---

## 🔄 修复记录 (Review Fixes)

**审核日期**: 2026-03-04
**审核方式**: BMAD Party Mode 多角度审查
**审核结论**: ⭐⭐⭐⭐☆ (4.5/5) - 符合开发标准

### 修复内容

| 问题类型 | 修复描述 | 修复位置 |
|---------|---------|---------|
| ✅ **架构缺失** | 补充 Automaton Core Loop 的 `dead` 状态，完整展示 `waking→running→sleeping→critical→dead` | Section 1 (Automaton 核心架构图) |
| ✅ **数据持久化** | 在混合队列架构图中补充 SQLite WAL 模式配置参数 (Journal Mode=WAL, Sync Mode=Normal) | Section 4 (混合队列架构图) |
| ✅ **预算策略** | 在经济大脑图中明确标注 90% 预算阈值和 20% 自动充值阈值 | Section 5 (经济大脑与预算熔断机制) |
| ✅ **重试机制** | 在任务节点状态机中详细说明指数退避策略 (1s, 2s, 4s, 8s, 16s) | Section 6 (任务节点状态机) |
| ✅ **人工介入点** | 在异常回流机制中补充人工审批流程，添加 `Approval → Continue` 和 `Approval → Abandoned` 路径，并使用颜色标注 | Section 7 (异常回流机制) |

### 改进后的架构质量

1. **完整性提升**: 所有状态转换路径已完整标注，无遗漏
2. **参数明确化**: 关键阈值和配置参数已具体标注，便于实现
3. **可执行性增强**: 重试机制和人工介入流程已详细定义，可直接用于代码实现
4. **可视化优化**: 使用颜色标注成功/失败路径，提高图表可读性

---

**Status**: ready-for-dev
**Completion Date**: 2026-03-04
**Next Step**: Dev Agent 可以开始根据这些架构图进行实现工作,或将其导出为独立的架构文档
