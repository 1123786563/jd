---
stepsCompleted: ["validate-prerequisites", "extract-requirements", "design-epics", "review-and-refine"]
inputDocuments:
  - "docs/project-overview.md"
  - "docs/project-context.md"
  - "docs/architecture-automaton.md"
  - "docs/architecture-tinyclaw.md"
  - "docs/development-guide-automaton.md"
  - "docs/development-guide-tinyclaw.md"
  - "docs/project-structure.md"
  - "docs/integration-architecture.md"
  - "docs/upwork_autopilot_architecture.md"
  - "docs/upwork_autopilot_detailed_design.md"

---

# JD - Epic 重构计划

**状态：** ✅ 已补充详细设计
**生成日期：** 2026-03-04
**重构原因：** 根据实际项目进度调整优先级，反映已完成工作
**最新更新：** 2026-03-04 - 补充双框架深度解析、核心业务流程、人工介入点、数据库设计

---

## 📊 重构概览

| 类别 | 说明 |
|------|---------|
| **已实现功能** | 飞书集成、国产大模型支持、多渠道客户端 |
| **核心差异** | Automaton (主权智能体) vs TinyClaw (多团队助手) |
| **重构策略** | 从"功能建设"转向"系统完善+集成" |
| **当前状态** | TinyClaw 基础功能完善，Automaton 核心能力已具备 |

---

## 🎯 重构后的 Epic 结构

### **Phase 1: Conway Automaton 核心完善** (优先级：⭐⭐⭐⭐⭐)

**目标：** 巩固自主智能体运行时的核心能力，完善多层记忆和自修改系统

**涵盖功能：**
- ✅ 已完成：基础运行时、多层记忆、Web3集成、Conway计费
- 🔨 待完善：记忆压缩、上下文聚合、团队协作

**重构后的 Epic (3个)：**

#### Epic 1a: 记忆系统深度优化
- **1a.1:** 记忆压缩引擎实现
- **1a.2:** 上下文聚合器优化 (多源集成)
- **1a.3:** 语义检索优化 (向量搜索)
- **1a.4:** 记忆持久化备份方案
- **1a.5:** 长期记忆归档策略

#### Epic 1a+: Automaton 底层机制完善
- **1a+.1:** 守护进程与心跳系统 (heartbeat/daemon.ts) - 基于 ReAct 模式的生命周期管理 (waking/running/sleeping/critical/dead)
- **1a+.2:** 编排引擎与任务图 (orchestration/orchestrator.ts, task-graph.ts) - 七步状态机 (classifying/planning/executing/replanning)，支持动态子代理生成
- **1a+.3:** 经济决策与风控引擎 (SpendTracker, PolicyEngine) - Token 成本追踪，自动闪兑 (USDC to Credits)，预算熔断
- **1a+.4:** Web4 链上交互能力 (conway/client.ts) - ERC-8004 Agent Registry 链上注册，genesisPromptHash 固化
- **1a+.5:** 核心架构可视化 (Mermaid 架构图) - 状态机、编排引擎、经济大脑、Web4 身份完整展示

#### Epic 1b: 自修改能力增强
- **1b.1:** 安全代码生成框架完善
- **1b.2:** 代码审查工作流优化
- **1b.3:** Git集成与PR自动化
- **1b.4:** 技能市场原型 (可安装技能包)
- **1b.5:** 审计日志可视化

#### Epic 1c: 智能体编排与团队
- **1c.1:** 多智能体注册表
- **1c.2:** 智能体间通信协议
- **1c.3:** 团队协作框架 (与TinyClaw对齐)
- **1c.4:** 负载均衡与故障转移
- **1c.5:** 智能体生命周期管理
- **1c.6:** 异常回流与自愈机制 - 四大回流类型 (COMPILATION_ERROR/LOGIC_ERROR/REQUIREMENT_MISMATCH/ARCHITECTURE_FLAW)
- **1c.7:** 会话状态机实现 - Conversation State Machine (discovered/negotiating/signed/developing/testing/deployed)
- **1c.8:** 任务节点状态机实现 - TaskNode State Machine (blocked/pending/running/completed/failed/abandoned)
- **1c.9:** 状态转换验证与异常处理 - updateTaskStatus() 原子操作与依赖解锁

---

### **Phase 2: TinyClaw 功能增强** (优先级：⭐⭐⭐⭐)

**目标：** 基于已完成的多渠道基础，增强管理界面和高级功能

**涵盖功能：**
- ✅ 已完成：Discord/Telegram/WhatsApp/飞书客户端、队列处理器、基础API
- 🔨 待完善：Web界面、监控、插件系统

**重构后的 Epic (3个)：**

#### Epic 2a: TinyOffice 前端完善
- **2a.1:** Agent管理页面完善 (CRUD + 状态监控)
- **2a.2:** Team管理页面 (团队配置、成员管理)
- **2a.3:** 实时聊天界面优化
- **2a.4:** 任务追踪系统
- **2a.5:** 日志查看器和搜索
- **2a.6:** 配置编辑器 (可视化)
- **2a.7:** 性能监控仪表盘
- **2a.8:** 响应式移动端适配

#### Epic 2b: 后端API与插件系统
- **2b.1:** REST API完整化
- **2b.2:** WebSocket实时事件流
- **2b.3:** 插件/钩子系统实现 (runIncomingHooks/runOutgoingHooks) - 消息预处理/后处理拦截器
- **2b.4:** 速率限制和安全加固 (Token Bucket + Jitter 防封号)
- **2b.5:** 备份与恢复功能
- **2b.6:** 多租户支持原型
- **2b.7:** Redis+SQLite 混合消息队列 - Redis 实时分发 + SQLite 持久化 (HybridQueueManager)
- **2b.8:** 消息队列灾难恢复机制 - recoverStaleMessages() 从 SQLite 恢复处理中消息
- **2b.9:** Agent 深度通信协议 - @mention 路由机制 (parseMentions(), routeMentions())
- **2b.10:** 上下文共享与传递机制 - ConversationContext (loadContext(), shareWithAgent())
- **2b.11:** 数据库表设计与迁移 - 9 个核心表 (messages, conversations, task_graph, projects, token_audit_log 等)
- **2b.12:** 索引优化与查询性能 - SQLite WAL 模式 + 原子事务 (BEGIN IMMEDIATE)

#### Epic 2c: 国产大模型深度集成
- **2c.1:** 智普(Zhipu)模型集成完善
- **2c.2:** 通义千问(Qwen)视觉模型支持
- **2c.3:** Kimi(Moonshot)长文本优化
- **2c.4:** 模型路由策略优化
- **2c.5:** 国产模型性能监控
- **2c.6:** 本地模型(Ollama/vLLM)集成

---

### **Phase 3: 集成与协同** (优先级：⭐⭐⭐)

**目标：** 实现 Automaton 与 TinyClaw 的深度集成，发挥各自优势

**重构后的 Epic (2个)：**

#### Epic 3a: 智能体生态系统统一
- **3a.1:** 共享智能体注册表
- **3a.2:** 统一工具/技能库 (@jd/core)
- **3a.3:** 智能体配置同步
- **3a.4:** 跨项目技能市场
- **3a.5:** 通用LLM供应商抽象

#### Epic 3b: 混合架构实施
- **3b.1:** Automaton作为TinyClaw专用智能体
- **3b.2:** API桥接层 (消息路由)
- **3b.3:** 状态共享机制
- **3b.4:** 统一日志和监控
- **3b.5:** 部署协调工具 (Docker Compose)

---

### **Phase 4: 高级功能** (优先级：⭐⭐)

**目标：** 提升系统可观测性、安全性和扩展性

**重构后的 Epic (2个)：**

#### Epic 4a: 监控与可观测性
- **4a.1:** 性能指标收集
- **4a.2:** 健康检查端点完善
- **4a.3:** 告警系统 (余额、错误率)
- **4a.4:** 分布式追踪原型
- **4a.5:** 可视化仪表盘 (Grafana集成)

#### Epic 4b: 安全与合规
- **4b.1:** 策略引擎增强 (PolicyEngine) - Escrow Check、Budget Guard、Risk Classifier
- **4b.2:** 注入防御完善 (Llama-Guard 集成) - 提示词注入防护、内容安全过滤
- **4b.3:** 审计日志归档 - 不可篡改日志记录
- **4b.4:** RBAC权限系统
- **4b.5:** 数据加密与隐私保护
- **4b.6:** GDPR/合规性检查
- **4b.7:** 人工介入点设计与实现 - 四大 HITL 节点完整实现
- **4b.8:** HITL 审批工作流 - Telegram/Discord 管理界面集成
- **4b.9:** 审批记录与审计 (human_approvals 表)
- **4b.10:** 沙箱逃逸防护 - Docker 断网模式、资源限制 (0.5 CPU, 512MB RAM)、只读根文件系统
- **4b.11:** 私钥安全管理 - KMS/Vault 集成、硬件钱包签名授权
- **4b.12:** Upwork ToS 合规检查 - 自动化投标合规性验证

---

## 📈 重构亮点

### 1. **更清晰的阶段划分**
- Phase 1: Automaton 核心 (自主智能体)
- Phase 2: TinyClaw 增强 (多团队助手)
- Phase 3: 集成协同 (发挥各自优势)
- Phase 4: 高级功能 (企业级能力)

### 2. **反映真实进度**
- 移除了已实现的功能 (飞书、国产大模型基础支持)
- 聚焦于系统性完善而非从零建设
- 更符合 monorepo 的协作开发模式

### 3. **更好的依赖关系**
- Automaton 和 TinyClaw 可以并行开发
- 集成工作放在双方都有一定成熟度后
- 高级功能建立在稳定核心之上

### 4. **实际价值导向**
- 记忆压缩 → 减少存储成本
- 插件系统 → 扩展灵活性
- 统一技能库 → 代码复用
- 混合架构 → 最佳实践组合

---

## 🗺️ 实施路线图

```
Q1 2026 (当前)          Q2 2026              Q3 2026              Q4 2026
│                       │                    │                    │
├─ 1a 记忆优化          ├─ 2a 前端完善       ├─ 3a 生态统一       ├─ 4a 监控
├─ 1b 自修改增强        ├─ 2b API/插件       ├─ 3b 混合架构       ├─ 4b 安全
└─ 1c 智能体编排        ├─ 2c 国产模型       └─                    └─

关键里程碑：
- M1 (4月底): 记忆系统优化完成，前端基础功能上线
- M2 (6月底): 插件系统和国产模型深度集成
- M3 (9月底): 混合架构原型验证
- M4 (12月底): 企业级监控和安全能力
```

---

## ✅ 与原计划的主要变更

| 原Epic | 问题 | 新方案 |
|--------|------|--------|
| 1a-1 ~ 1a-12 (分散) | 太细碎，部分已实现 | 合并为3个专注的Epic |
| 2b (WhatsApp/飞书) | 飞书已实现 | 改为前端和插件系统 |
| Epic 4 (高级功能) | 优先级过高 | 移到Phase 4，更合理 |
| 缺少集成 | 两个项目孤立 | 新增Phase 3专门处理 |

---

## 📝 后续步骤

1. **细化Story**: 为每个Epic创建详细的用户故事
2. **技术设计**: 针对关键功能(记忆压缩、插件系统)进行架构设计
3. **优先级确认**: 与团队确认实施顺序
4. **资源规划**: 评估各Epic所需工时和人力

---

## 📌 补充详细设计 (基于 upwork_autopilot_detailed_design.md)

### 1. 双框架深度解析

#### Automaton 核心架构 (主权 AI Agent 运行时)
**核心机制：**
- **守护进程 (heartbeat/daemon.ts)**: 维持心跳，抛出唤醒事件，基于 ReAct 模式管理状态机 (waking → running → sleeping → critical → dead)
- **编排引擎 (orchestration/orchestrator.ts)**: 维护七步状态机 (classifying/planning/executing/replanning)，通过 `planGoal` 自动分解大目标为 TaskNode 子任务树
- **经济决策 (SpendTracker)**: 追踪所有工具调用成本，资金不足时自动将 USDC 闪兑为 Credits
- **Web4 链上交互 (conway/client.ts)**: 将代理钱包地址及 `genesisPromptHash` 固化至 ERC-8004 Registry

#### TinyClaw 核心架构 (多智能体协同系统)
**核心机制：**
- **事务强一致性消息队列 (lib/db.ts)**: SQLite WAL 模式 + `BEGIN IMMEDIATE` 独占事务锁定，确保高并发下同一条消息绝不重复提取
- **并行协程锁链 (queue-processor.ts)**: 维护 `Map<string, Promise<void>>`，同一 Agent 消息绝对串行，不同 Agent 消息完全并行
- **@mention 路由 (lib/routing.ts)**: 通过正则提取 `[@teammate: message]` 标签实现 Agent 互相呼叫
- **插件钩子 (runIncomingHooks/runOutgoingHooks)**: 消息推给大模型前后的数据清洗拦截器

**双脑控制模式：**
- **前台 (TinyClaw)**: 消息路由、会话状态管理、速率限制、Scrubbing Hook
- **后台 (Automaton)**: Task Graph、全局预算、Policy Engine、Sandbox Manager、EVM Wallet

### 2. 核心业务流程时序图

#### 流程 1: 岗位发现 → 投标 → 谈判
1. **UpworkRSS** → **RateLimiter** (Token Bucket 检查 + Jitter 延迟 1-7 分钟)
2. **ScoutAgent** 过滤 (预算 > $500, 技术栈匹配) → **Database** (INSERT messages)
3. **QueueProcessor** 事务锁定 (BEGIN IMMEDIATE) → **SalesAgent** 分配
4. **SalesAgent** 生成 Cover Letter (LLM 调用) → **GlobalSpendTracker** 记录 Token
5. **ScrubbingHook** 去除 AI 指纹 + 注入随机拼写错误 → **UpworkAPI** 人类化文本
6. **UpworkPlatform** → **UpworkAPI** (客户回复) → **QueueProcessor** 入队
7. **SalesAgent** 议价策略调整 → **PolicyEngine** 报价审核 → 发送报价
8. 更新会话状态为 `negotiating`

#### 流程 2: 资金核验 → 合同签署 → 架构设计
1. **SalesAgent** → **AccountantAgent** (@mention 核验资金)
2. **AccountantAgent** → **UpworkAPI** → **EscrowService** (查询托管金额)
3. **AccountantAgent** 检查本地余额 → 不足时触发充值流程 (KMS 签名 + USDC 闪兑)
4. **AccountantAgent** → **ArchitectAgent** (@mention 项目已签约)
5. **ArchitectAgent** 调用 LLM 生成 DAG (Structured Output) → **QAReviewer** Dry-Run 审查
6. **QAReviewer** → **Database** (INSERT human_approvals) → **HumanSupervisor** Telegram 审批
7. Human 手机确认 → **ArchitectAgent** 开始执行

#### 流程 3: 代码开发 → 测试 → 交付 (待完善)
- DevAgent 执行 TaskNode → QAAgent 测试 → 人工最终审核 → 客户交付

### 3. 四大人工介入点 (HITL) 详细设计

#### 节点 1: 签约大额抽账拦截 (Accountant → Human)
**触发条件：**
- 合同金额超过预设阈值 (默认 $5000)
- 涉及敏感合约交互
- 客户风险评分异常

**介入流程：**
1. 系统冻结订单 (UPDATE projects SET status = 'pending_approval')
2. 发送紧急通知到 Telegram (包含项目详情、风险提示)
3. 阻塞等待人工响应 (timeout: 60 分钟)
4. Human 批准 → 执行 KMS 签名 → 继续流程

#### 节点 2: 架构图纸开工审批 (Architect → Human)
**触发条件：**
- ArchitectAgent 完成 DAG 生成
- 通过内部 QA Dry-Run 验证
- 准备下发 DevAgent 执行前

**审批内容：**
- 任务节点数量和复杂度
- 预估 Token 消耗和成本
- 技术栈选型确认
- 时间预估

**拒绝流程：** 记录拒绝原因到 `dag_reviews` 表，返回 ArchitectAgent 重新生成

#### 节点 3: 全局算力死锁熔断 (Global Tracker → Human)
**触发条件：**
- Dev/QA 循环失败超过 5 次
- Token 消耗达到警戒线 (90%)
- 检测到死锁或无限循环

**熔断流程：**
1. 停止所有 Agent 处理 (queueProcessor.pauseAll())
2. 记录审计日志 (CIRCUIT_BREAKER_TRIGGERED)
3. 发送紧急告警到 Telegram (使用率、当前消耗)
4. 抛出 `CircuitBreakerError`

#### 节点 4: 交付前最终代码审计 (QA → Human)
**触发条件：**
- 所有 TaskNode 状态为 completed
- 单元测试和集成测试全部通过
- 准备打包发布前

**审计清单：**
- [ ] 代码符合项目规范
- [ ] 无安全漏洞
- [ ] 性能指标达标
- [ ] 文档完整
- [ ] 测试覆盖率达标

### 4. 数据库表设计

**9 个核心表：**
1. `messages` (消息队列表) - 含 status 索引 (pending/processing/completed/failed)
2. `conversations` (会话记录表) - 含 state 索引 (discovered/negotiating/signed/developing/testing/deployed)
3. `conversation_locks` (会话并发锁) - 主键约束保证并发安全
4. `task_graph` (任务图 - DAG) - 含 dependencies JSON、status 检查约束
5. `projects` (项目主表) - 含 Web4 集成字段 (automaton_agent_id, genesis_prompt_hash)
6. `token_audit_log` (Token 审计日志) - 成本追踪与分析
7. `agent_configs` (Agent 配置表) - 角色、LLM 模型、系统提示词
8. `human_approvals` (人工审批记录) - 审批历史追踪
9. `conversation_locks` (并发锁表) - 独占事务锁定

**ER 关系：**
- 1 个项目 → * 个会话
- 1 个会话 → * 条消息
- 1 个项目 → * 个任务节点
- 1 个会话 → 1 个会话锁

---

**文档版本：** 2.1 (补充详细设计)
**更新日期：** 2026-03-04
**补充来源：** upwork_autopilot_detailed_design.md
**基于实际进度：** ✅ 飞书集成完成、✅ 国产大模型支持、✅ 多渠道基础
