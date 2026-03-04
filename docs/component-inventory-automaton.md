# Conway Automaton - 组件清单

**所属部分：** automaton
**上次更新：** 2026-03-03

---

## 概述

本文档记录了 Conway Automaton 中的所有主要组件，包括它们的用途、位置、依赖关系和关键接口。

---

## 核心运行时组件

### 1. 智能体循环 (Agent Loop)

**文件：** `src/agent/loop.ts`
**用途：** 核心 ReAct 执行循环 —— 智能体的意识中枢
**关键函数：**

- `runAgentLoop(options)` - 主执行函数
- 管理基于轮次的会话流
- 实施策略规则和预算限制
**依赖关系：** context.ts, tools.ts, policy-engine.ts, injection-defense.ts
**接口：** AgentLoopOptions, AgentState, AgentTurn

### 2. 上下文管理器 (Context Manager)

**文件：** `src/memory/context-manager.ts`
**用途：** 聚合并管理来自所有记忆层级的上下文
**关键函数：**

- `buildContextMessages()` - 为 LLM 构建消息数组
- `trimContext()` - 将上下文裁剪至 Token 限制内
- Token 计数与预算管理
**依赖关系：** working.ts, episodic.ts, semantic.ts, procedural.ts
**接口：** ContextManager, TokenCounter

### 3. 策略引擎 (Policy Engine)

**文件：** `src/agent/policy-engine.ts`
**用途：** 运行时安全规则强制执行
**关键函数：**

- `validate(state)` - 运行所有策略规则
- `registerRule(rule)` - 添加自定义规则
- `removeRule(name)` - 移除规则
**依赖关系：** policy-rules/validation.ts, rate-limits.ts, path-protection.ts
**接口：** PolicyEngine, PolicyRule

---

## 记忆系统组件

### 4. 工作记忆 (Working Memory)

**文件：** `src/memory/working.ts`
**用途：** 当前会话轮次的活跃上下文
**关键函数：**

- 存储最近的消息和活跃目标
- 会话作用域 (轮次结束后清除)
- 快速内存访问
**依赖关系：** 无
**接口：** WorkingMemory

### 5. 情节记忆 (Episodic Memory)

**文件：** `src/memory/episodic.ts`
**用途：** 持久化的事件历史和会话记录
**关键函数：**

- `storeEvent(event)` - 将事件保存到数据库
- `retrieveEvents(query)` - 按时间/类型查询事件
- `getConversationHistory()` - 获取完整的会话历史
**依赖关系：** database.ts
**接口：** EpisodicMemory, MemoryEvent

### 6. 语义记忆 (Semantic Memory)

**文件：** `src/memory/semantic.ts`
**用途：** 具有向量相似度搜索功能的知识库
**关键函数：**

- `storeKnowledge(knowledge)` - 添加带有嵌入 (embeddings) 的知识
- `searchKnowledge(query)` - 语义相似度搜索
- `updateKnowledge(id, data)` - 更新现有知识
**依赖关系：** knowledge-store.ts, embeddings (通过 inference)
**接口：** SemanticMemory, KnowledgeBlock

### 7. 程序记忆 (Procedural Memory)

**文件：** `src/memory/procedural.ts`
**用途：** 技能、工具和操作类知识
**关键函数：**

- `registerSkill(skill)` - 添加新技能
- `getSkill(name)` - 按名称检索技能
- `listSkills()` - 获取所有可用技能
**依赖关系：** tools.ts
**接口：** ProceduralMemory, Skill

### 8. 知识存储 (Knowledge Store)

**文件：** `src/memory/knowledge-store.ts`
**用途：** 语义知识的统一存储
**关键函数：**

- 使用 SQLite 进行持久化存储
- 嵌入 (Embedding) 缓存
- 去重与合并
**依赖关系：** database.ts, inference.ts (用于 embeddings)
**接口：** KnowledgeStore

### 9. 记忆检索器 (Memory Retriever)

**文件：** `src/memory/retrieval.ts`
**用途：** 智能记忆检索策略
**关键函数：**

- `retrieveRelevant(context)` - 获取相关记忆
- `hybridSearch(query)` - 结合关键词 + 语义搜索
- 相关性评分与排序
**依赖关系：** semantic.ts, episodic.ts
**接口：** MemoryRetriever

### 10. 记忆摄取流水线 (Memory Ingestion Pipeline)

**文件：** `src/memory/ingestion.ts`
**用途：** 处理并存储新知识
**关键函数：**

- `ingest(text)` - 处理并存储知识
- `extractEntities(text)` - 提取命名实体
- `chunkAndEmbed(text)` - 文本分块并生成嵌入
**依赖关系：** knowledge-store.ts, inference.ts
**接口：** MemoryIngestionPipeline

### 11. 压缩引擎 (Compression Engine)

**文件：** `src/memory/compression-engine.ts`
**用途：** 压缩长会话和记忆
**关键函数：**

- `summarizeConversation()` - 总结长对话
- `compressMemory()` - 对旧记忆进行有损压缩
- 保留策略 (Retention policies)
**依赖关系：** inference.ts (用于总结)
**接口：** CompressionEngine

### 12. 事件流 (Event Stream)

**文件：** `src/memory/event-stream.ts`
**用途：** 基于事件的记忆更新
**关键函数：**

- `onEvent(event)` - 处理记忆事件
- `subscribe(listener)` - 订阅事件
- 事件批处理与防抖
**依赖关系：** 无
**接口：** EventStream

---

## 身份与 Web3 组件

### 13. 钱包管理器 (Wallet Manager)

**文件：** `src/identity/wallet.ts`
**用途：** 以太坊钱包的生成与管理
**关键函数：**

- `getWallet()` - 获取或创建钱包
- `getAutomatonDir()` - 获取配置目录路径
- `signMessage(message)` - 使用钱包签名消息
**依赖关系：** viem, siwe
**接口：** AutomatonIdentity

### 14. 供给管理器 (Provision Manager)

**文件：** `src/identity/provision.ts`
**用途：** 通过 SIWE 进行 Conway API 密钥供给 (provisioning)
**关键函数：**

- `provision()` - 通过 SIWE 获取 API 密钥
- `loadApiKeyFromConfig()` - 加载现有密钥
- 区块链身份验证
**依赖关系：** wallet.ts, conway/client.ts
**接口：** 无

---

## Conway API 组件

### 15. Conway 客户端 (Conway Client)

**文件：** `src/conway/client.ts`
**用途：** Conway API HTTP 客户端
**关键函数：**

- `request(endpoint, data)` - 发起经过认证的请求
- 请求签名与重试
- 错误处理
**依赖关系：** fetch (或 axios)
**接口：** ConwayClient

### 16. 额度管理器 (Credits Manager)

**文件：** `src/conway/credits.ts`
**用途：** 额度余额追踪
**关键函数：**

- `getCreditBalance()` - 获取当前余额
- `getSurvivalTier()` - 确定生存层级
- 预算计算
**依赖关系：** client.ts
**接口：** 无

### 17. X402 支付处理器 (X402 Payment Handler)

**文件：** `src/conway/x402.ts`
**用途：** USDC 余额与支付处理
**关键函数：**

- `getUsdcBalance()` - 获取 USDC 余额
- `processInvoice(invoice)` - 处理支付发票
- 支付协议处理
**依赖关系：** client.ts, viem (用于区块链)
**接口：** 无

### 18. 推理客户端 (Inference Client)

**文件：** `src/conway/inference.ts`
**用途：** 推理 API 集成
**关键函数：**

- `createInferenceClient()` - 创建客户端实例
- `inference(model, messages)` - 调用 LLM
- 成本追踪
**依赖关系：** client.ts, openai SDK
**接口：** InferenceClient

### 19. 充值管理器 (Top-up Manager)

**文件：** `src/conway/topup.ts`
**用途：** 自动化额度充值
**关键函数：**

- `bootstrapTopup()` - 初始化充值
- `monitorBalance()` - 监控并自动充值
- 支付处理
**依赖关系：** credits.ts, x402.ts
**接口：** 无

---

## 自修改组件 (Self-Modification Components)

### 20. 代码生成器 (Code Generator)

**文件：** `src/self-mod/code.ts`
**用途：** 安全的代码生成与修改
**关键函数：**

- `generateCode(prompt)` - 根据提示词生成代码
- `modifyFile(path, changes)` - 安全地修改文件
- 语法验证
**依赖关系：** inference.ts, audit-log.ts
**接口：** 无

### 21. 工具管理器 (Tools Manager)

**文件：** `src/self-mod/tools-manager.ts`
**用途：** 动态工具注册与生命周期管理
**关键函数：**

- `registerTool(tool)` - 注册新工具
- `unregisterTool(name)` - 移除工具
- `listTools()` - 获取所有工具
**依赖关系：** tools.ts
**接口：** ToolsManager

### 22. 上游管理器 (Upstream Manager)

**文件：** `src/self-mod/upstream.ts`
**用途：** 用于代码版本控制的 Git 集成
**关键函数：**

- `commitChanges(message)` - 提交更改
- `createPR(branch, title)` - 创建拉取请求 (PR)
- `pushToRemote()` - 推送到远程仓库
**依赖关系：** simple-git
**接口：** 无

### 23. 审计记录器 (Audit Logger)

**文件：** `src/self-mod/audit-log.ts`
**用途：** 记录所有代码更改以便回滚
**关键函数：**

- `logChange(change)` - 记录更改
- `getChangeHistory()` - 获取历史记录
- `rollbackTo(version)` - 回滚到特定版本
**依赖关系：** database.ts
**接口：** AuditLog

---

## 推理组件 (Inference Components)

### 24. 模型注册表 (Model Registry)

**文件：** `src/inference/registry.ts`
**用途：** 多供应商模型注册
**关键函数：**

- `registerProvider(provider)` - 添加供应商
- `getModel(modelName)` - 获取模型配置
- `listModels()` - 列出所有模型
**依赖关系：** provider-registry.ts
**接口：** ModelRegistry

### 25. 预算追踪器 (Budget Tracker)

**文件：** `src/inference/budget.ts`
**用途：** 额度追踪与支出限制
**关键函数：**

- `trackSpend(amount)` - 追踪支出
- `checkBudget()` - 检查是否在预算范围内
- `setLimit(limit)` - 设置支出上限
**依赖关系：** conway/credits.ts
**接口：** InferenceBudgetTracker

### 26. 推理路由 (Inference Router)

**文件：** `src/inference/router.ts`
**用途：** 智能模型选择与路由
**关键函数：**

- `route(model, messages)` - 路由到最佳供应商
- 备选策略 (Fallback strategies)
- 负载均衡
**依赖关系：** registry.ts, budget.ts
**接口：** InferenceRouter

### 27. 供应商注册表 (Provider Registry)

**文件：** `src/inference/provider-registry.ts`
**用途：** 供应商配置与健康监测
**关键函数：**

- `addProvider(config)` - 添加供应商
- `checkHealth(provider)` - 健康检查
- 自动故障转移 (Failover)
**依赖关系：** 无
**接口：** ProviderRegistry

---

## 持久化组件 (Persistence Components)

### 28. 数据库管理器 (Database Manager)

**文件：** `src/state/database.ts`
**用途：** SQLite 数据库层
**关键函数：**

- `createDatabase()` - 初始化数据库
- `query(sql, params)` - 执行查询
- 数据库架构迁移 (Schema migrations)
**依赖关系：** better-sqlite3
**接口：** AutomatonDatabase

**数据表：**

- `agent_state` - 当前智能体状态
- `agent_turns` - 对话轮次历史
- `memory_blocks` - 记忆存储
- `wake_events` - 计划事件
- `inbox_messages` - 待处理消息
- `audit_log` - 自修改审计追踪
- `spend_tracker` - 财务交易记录

---

## 设置与配置组件

### 29. 设置向导 (Setup Wizard)

**文件：** `src/setup/wizard.ts`
**用途：** 交互式初次运行设置
**关键函数：**

- 交互式 CLI 提示
- 供应商配置
- 模型选择
- 金库 (Treasury) 设置
**依赖关系：** prompts.ts, configure.ts, model-picker.ts
**接口：** 无

### 30. 配置管理器 (Configuration Manager)

**文件：** `src/setup/configure.ts`
**用途：** 配置编辑 UI
**关键函数：**

- `editConfig()` - 交互式配置编辑器
- `saveConfig(config)` - 保存配置
- `loadConfig()` - 加载配置
**依赖关系：** environment.ts
**接口：** 无

### 31. 模型选择器 (Model Picker)

**文件：** `src/setup/model-picker.ts`
**用途：** 交互式模型选择
**关键函数：**

- 显示可用模型
- 成本估算
- 供应商对比
**依赖关系：** registry.ts
**接口：** 无

### 32. 环境加载器 (Environment Loader)

**文件：** `src/setup/environment.ts`
**用途：** 环境变量与配置加载
**关键函数：**

- `loadEnvironment()` - 加载环境变量
- `parseConfigFile()` - 解析配置文件
- 默认值解析
**依赖关系：** 无
**接口：** 无

---

## 编排组件 (Orchestration Components)

### 33. 编排器 (Orchestrator)

**文件：** `src/orchestration/orchestrator.ts`
**用途：** 多智能体编排
**关键函数：**

- 协调多个智能体
- 资源分配
- 负载均衡
**依赖关系：** 无
**接口：** Orchestrator

### 34. 计划模式控制器 (Plan Mode Controller)

**文件：** `src/orchestration/plan-mode.ts`
**用途：** 计划与执行模式
**关键函数：**

- 创建执行计划
- 分步执行
- 计划验证
**依赖关系：** 无
**接口：** PlanModeController

### 35. 注意力管理器 (Attention Manager)

**文件：** `src/orchestration/attention.ts`
**用途：** 注意力与 TODO 管理
**关键函数：**

- `generateTodoMd()` - 生成 TODO 列表
- `injectTodoContext()` - 将 TODO 注入到上下文中
- 优先级管理
**依赖关系：** 无
**接口：** 无

### 36. 消息系统 (Messaging System)

**文件：** `src/orchestration/messaging.ts`
**用途：** 智能体间消息传递
**关键函数：**

- `sendMessage(to, from, message)` - 发送消息
- 消息队列与路由
- 本地传输实现
**依赖关系：** 无
**接口：** ColonyMessaging, LocalDBTransport

### 37. 工作线程池 (Worker Pool)

**文件：** `src/orchestration/local-worker.ts`
**用途：** 本地工作线程池
**关键函数：**

- `executeTask(task)` - 在工作线程中执行
- 工作线程生命周期管理
- 任务排队
**依赖关系：** 无
**接口：** LocalWorkerPool

### 38. 智能体追踪器 (Agent Tracker)

**文件：** `src/orchestration/simple-tracker.ts`
**用途：** 简单的智能体追踪与资金支持
**关键函数：**

- 追踪智能体状态
- 管理资金拨付
- 简单的协议实现
**依赖关系：** 无
**接口：** SimpleAgentTracker, SimpleFundingProtocol

---

## 可观测性组件 (Observability Components)

### 39. 日志记录器 (Logger)

**文件：** `src/observability/logger.ts`
**用途：** 结构化日志记录
**关键函数：**

- `createLogger(name)` - 创建命名日志记录器
- `setGlobalLogLevel(level)` - 设置全局日志级别
- 记录到文件和控制台
**依赖关系：** fs, path
**接口：** Logger

---

## CLI 组件

### 40. CLI 软件包

**位置：** `packages/cli/src/`
**用途：** 命令行界面
**命令：**

- `status.ts` - 显示智能体状态
- `logs.ts` - 查看日志
- `send.ts` - 向智能体发送消息
- `fund.ts` - 为金库注资

---

## 关键模式

### ReAct 循环模式

思考 (Think) → 行动 (Act) → 观察 (Observe) → 持久化 (Persist)

### 多层记忆模式

工作记忆 (Working) + 情节记忆 (Episodic) + 语义记忆 (Semantic) + 程序记忆 (Procedural)

### 策略驱动的安全模式

验证 (Validation) → 速率限制 (Rate Limit) → 路径保护 (Path Protection) → 预算检查 (Budget Check)

### 带审计的自修改模式

生成 (Generate) → 验证 (Validate) → 记录 (Log) → 提交 (Commit)

---

_本组件清单由 BMAD `document-project` 工作流生成_
