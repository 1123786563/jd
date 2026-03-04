# Story 1c.2: 智能体间通信协议

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 多智能体系统的架构师,
I want 实现统一的智能体间通信协议，
so that Automaton 和 TinyClaw 的智能体可以无缝协作。

## Acceptance Criteria

1. [AC1] 定义统一的消息格式和语义，支持智能体间异步通信
2. [AC2] 实现基于 SQLite WAL 的持久化消息总线，确保消息可靠传递
3. [AC3] 支持多种消息模式：点对点、发布-订阅、团队广播、请求-响应
4. [AC4] 实现消息序列化/反序列化，支持类型安全和版本控制
5. [AC5] 提供智能体身份认证和授权机制，防止未授权访问
6. [AC6] 实现消息优先级和超时处理机制
7. [AC7] 提供消息追踪和调试日志功能
8. [AC8] 确保向后兼容，不影响现有的 TinyClaw @mention 机制
9. [AC9] 编写完整的单元测试和集成测试，覆盖所有消息模式
10. [AC10] 更新文档，提供使用示例和最佳实践
11. [AC11] **新增**：实现完整的监控指标和可观测性系统
12. [AC12] **新增**：实现批量写入优化，提升吞吐量
13. [AC13] **新增**：实现消息压缩机制，减少存储和传输开销
14. [AC14] **新增**：实现延迟消息和定时消息功能

## Tasks / Subtasks

### 任务 1: 设计消息格式和语义 (AC: 1, 4)
- [ ] 定义核心消息接口和类型
  - [ ] Message interface: id, sender, receiver, timestamp, payload
  - [ ] MessageType 枚举：text, json, binary, stream
  - [ ] MessageStatus 枚举：pending, processing, delivered, failed
- [ ] 设计序列化格式（JSON + 元数据）
  - [ ] 消息头（Header）包含版本号和消息类型
  - [ ] 有效载荷（Payload）支持嵌套结构
  - [ ] 支持消息压缩和加密选项
- [ ] 定义错误处理和重试策略
  - [ ] ErrorCode 枚举
  - [ ] RetryConfig 配置
  - [ ] 指数退避重试算法

### 任务 2: 实现持久化消息总线 (AC: 2, 7, 11, 12)
- [ ] **阶段 1: 基础实现**
  - [ ] 创建消息总线数据库表结构
    - [ ] messages 表（主消息队列）
    - [ ] message_delivery_status 表（投递状态追踪）
    - [ ] message_topics 表（主题订阅）
    - [ ] dead_letter_queue 表（死信队列）
  - [ ] 实现消息总线核心功能
    - [ ] sendMessage(message) - 发送消息到总线
    - [ ] receiveMessage() - 从总线接收消息
    - [ ] acknowledgeMessage(messageId) - 确认消息已处理
    - [ ] nackMessage(messageId) - 拒绝消息（失败处理）

- [ ] **阶段 2: 并发和事务控制**
  - [ ] 实现 WAL 模式的 SQLite 配置
    - [ ] 启用 WAL 模式确保并发安全
    - [ ] 配置检查点和清理策略
    - [ ] 设置合理的超时和同步级别
  - [ ] 实现乐观锁机制避免竞态条件
    - [ ] `claimNextMessage()` 使用 UPDATE + WHERE 验证
    - [ ] 处理消息认领失败的情况
  - [ ] 实现事务包装器
    - [ ] 自动回滚失败的事务
    - [ ] 支持嵌套事务

- [ ] **阶段 3: 性能优化**
  - [ ] 实现批量写入优化（MessageBatcher）
    - [ ] 积累 100 条消息后批量提交
    - [ ] 100ms 超时自动提交
    - [ ] 支持手动触发刷新
  - [ ] 实现消息追踪功能
    - [ ] 消息生命周期日志
    - [ ] 性能监控指标收集
    - [ ] 错误追踪和诊断
  - [ ] 实现监控系统
    - [ ] 收集关键指标（吞吐量、延迟、队列长度等）
    - [ ] 提供 `/metrics` 端点供 Prometheus 采集
    - [ ] 配置告警规则

### 任务 3: 实现多种消息模式 (AC: 3, 14)
- [ ] **点对点（Point-to-Point）模式**
  - [ ] DirectMessageSender - 直接发送到指定智能体
  - [ ] DirectMessageReceiver - 从队列消费消息
  - [ ] 支持消息确认机制
  - [ ] 实现超时和重试

- [ ] **发布-订阅（Pub/Sub）模式**
  - [ ] TopicPublisher - 发布消息到主题
  - [ ] TopicSubscriber - 订阅主题并接收消息
  - [ ] 实现主题通配符匹配
  - [ ] 支持消息过滤

- [ ] **团队广播（Team Broadcast）模式**
  - [ ] TeamBroadcaster - 向团队所有成员广播
  - [ ] TeamMemberFilter - 过滤团队成员
  - [ ] 支持异步/同步广播
  - [ ] 实现团队上下文追踪

- [ ] **请求-响应（Request-Response）模式**
  - [ ] RequestSender - 发送请求并等待响应
  - [ ] ResponseHandler - 处理响应或超时
  - [ ] 实现相关性 ID（correlationId）匹配
  - [ ] 支持超时取消

- [ ] **延迟消息功能**
  - [ ] 实现 `delayed_until` 字段
  - [ ] 延迟消息调度器
  - [ ] 支持定时发送（Cron 风格）

### 任务 4: 实现安全机制 (AC: 5)
- [ ] 智能体身份认证
  - [ ] AgentIdentity 接口和实现
  - [ ] 基于令牌的身份验证
  - [ ] 支持证书和密钥对
  - [ ] 令牌过期和刷新机制

- [ ] 消息授权和权限控制
  - [ ] AuthorizationPolicy 配置
  - [ ] 基于角色的访问控制（RBAC）
  - [ ] 消息级别的权限检查
  - [ ] 操作审计日志

- [ ] 消息加密（可选）
  - [ ] 端到端加密支持
  - [ ] 传输加密
  - [ ] 密钥管理
  - [ ] 加密性能测试

### 任务 5: 实现优先级和超时处理 (AC: 6, 13)
- [ ] 消息优先级队列
  - [ ] PriorityLevel 枚举（0-10，10 最高）
  - [ ] 优先级调度算法
  - [ ] 优先级队列实现
  - [ ] 优先级饿死防护（优先级反转）

- [ ] 消息超时机制
  - [ ] TimeoutConfig 配置
  - [ ] 超时检测和处理
  - [ ] 死信队列（DLQ）
  - [ ] 超时消息自动清理

- [ ] 消息压缩
  - [ ] 实现消息压缩/解压缩工具类
  - [ ] 大于 1KB 的消息自动压缩
  - [ ] 支持 gzip 压缩算法
  - [ ] 压缩率和性能测试

- [ ] 流量控制和速率限制
  - [ ] RateLimiter 实现
  - [ ] 队列容量管理
  - [ ] 背压处理
  - [ ] 动态限流策略

### 任务 6: 测试和文档 (AC: 9, 10)
- [ ] **单元测试**
  - [ ] 消息序列化/反序列化测试（包含版本控制）
  - [ ] 消息总线核心功能测试（带事务控制）
  - [ ] 各种消息模式测试
  - [ ] 安全机制测试
  - [ ] 优先级队列测试
  - [ ] 超时和重试机制测试
  - [ ] 死信队列处理测试
  - [ ] 并发安全测试（模拟竞态条件）
  - [ ] 消息压缩/解压缩测试
  - [ ] 批量写入优化测试

- [ ] **集成测试**
  - [ ] 多智能体点对点通信测试
  - [ ] 主题订阅和发布测试
  - [ ] 团队广播测试
  - [ ] 请求-响应模式测试
  - [ ] 高并发场景测试（50-100 智能体）
  - [ ] 故障恢复测试（重启后消息不丢失）
  - [ ] 性能基准测试（吞吐量、延迟）
  - [ ] 死信队列手动恢复流程测试
  - [ ] 压力测试（持续 24 小时）

- [ ] **文档编写**
  - [ ] API 文档（TypeDoc 自动生成）
  - [ ] 使用示例（Markdown 格式）
  - [ ] 最佳实践指南
  - [ ] 架构设计文档
  - [ ] 故障排查手册
  - [ ] 性能调优指南

### 任务 2: 实现持久化消息总线 (AC: 2, 7)
- [ ] 创建消息总线数据库表结构
  - [ ] messages 表（主消息队列）
  - [ ] message_delivery_status 表（投递状态追踪）
  - [ ] message_topics 表（主题订阅）
- [ ] 实现消息总线核心功能
  - [ ] sendMessage(message) - 发送消息到总线
  - [ ] receiveMessage() - 从总线接收消息
  - [ ] acknowledgeMessage(messageId) - 确认消息已处理
  - [ ] nackMessage(messageId) - 拒绝消息（失败处理）
- [ ] 实现 WAL 模式的 SQLite 配置
  - [ ] 启用 WAL 模式确保并发安全
  - [ ] 配置检查点和清理策略
- [ ] 实现消息追踪功能
  - [ ] 消息生命周期日志
  - [ ] 性能监控指标
  - [ ] 错误追踪和诊断

### 任务 3: 实现多种消息模式 (AC: 3)
- [ ] 点对点（Point-to-Point）模式
  - [ ] DirectMessageSender - 直接发送到指定智能体
  - [ ] DirectMessageReceiver - 从队列消费消息
  - [ ] 支持消息确认机制
- [ ] 发布-订阅（Pub/Sub）模式
  - [ ] TopicPublisher - 发布消息到主题
  - [ ] TopicSubscriber - 订阅主题并接收消息
  - [ ] 实现主题通配符匹配
- [ ] 团队广播（Team Broadcast）模式
  - [ ] TeamBroadcaster - 向团队所有成员广播
  - [ ] TeamMemberFilter - 过滤团队成员
  - [ ] 支持异步/同步广播
- [ ] 请求-响应（Request-Response）模式
  - [ ] RequestSender - 发送请求并等待响应
  - [ ] ResponseHandler - 处理响应或超时
  - [ ] 实现相关性 ID（correlationId）匹配
- [ ] 向后兼容 @mention 机制
  - [ ] 将现有 @mention 路由转换为消息总线调用
  - [ ] 保留原有 API 接口
  - [ ] 迁移路径和兼容层

### 任务 4: 实现安全机制 (AC: 5)
- [ ] 智能体身份认证
  - [ ] AgentIdentity 接口和实现
  - [ ] 基于令牌的身份验证
  - [ ] 支持证书和密钥对
- [ ] 消息授权和权限控制
  - [ ] AuthorizationPolicy 配置
  - [ ] 基于角色的访问控制（RBAC）
  - [ ] 消息级别的权限检查
- [ ] 消息加密（可选）
  - [ ] 端到端加密支持
  - [ ] 传输加密
  - [ ] 密钥管理

### 任务 5: 实现优先级和超时处理 (AC: 6)
- [ ] 消息优先级队列
  - [ ] PriorityLevel 枚举（high, normal, low）
  - [ ] 优先级调度算法
  - [ ] 优先级队列实现
- [ ] 消息超时机制
  - [ ] TimeoutConfig 配置
  - [ ] 超时检测和处理
  - [ ] 死信队列（DLQ）
- [ ] 流量控制和速率限制
  - [ ] RateLimiter 实现
  - [ ] 队列容量管理
  - [ ] 背压处理

### 任务 6: 测试和文档 (AC: 9, 10)
- [ ] 单元测试
  - [ ] 消息格式测试
  - [ ] 消息总线核心功能测试
  - [ ] 各种消息模式测试
  - [ ] 安全机制测试
  - [ ] 优先级和超时测试
- [ ] 集成测试
  - [ ] 多智能体协作测试
  - [ ] 高并发场景测试
  - [ ] 故障恢复测试
  - [ ] 性能基准测试
- [ ] 文档编写
  - [ ] API 文档
  - [ ] 使用示例
  - [ ] 最佳实践指南
  - [ ] 架构设计文档

## Dev Notes

### 架构设计原则

#### 1. 统一的消息总线模式
- 使用 SQLite WAL 模式作为持久化消息总线
- 所有智能体通过总线进行异步通信
- 支持多种消息传递模式
- 确保消息可靠性和一致性
- **关键**: 使用乐观锁避免竞态条件

#### 2. 向后兼容性
- 保留现有的 TinyClaw `@mention` 机制
- 新的通信协议构建在现有基础上
- 提供平滑的迁移路径
- 避免破坏现有功能
- **实现**: `mention-bridge.ts` 兼容层

#### 3. 性能和可扩展性
- 使用 WAL 模式支持高并发读写
- 实现优先级队列优化性能
- 支持水平扩展（未来可迁移到分布式消息队列）
- **关键**: 批量写入 + 消息压缩 + 定期归档

#### 4. 安全性
- 智能体身份认证和授权
- 消息级别权限控制
- 支持可选的加密机制
- 审计日志和追踪
- **关键**: 令牌过期 + 操作审计

#### 5. 可观测性（新增）
- 完整的监控指标体系
- 结构化日志追踪
- 链路追踪（traceId）
- 告警和自动恢复
- **实现**: Prometheus 集成 + 结构化日志

### 技术栈要求

#### 核心依赖
- **better-sqlite3**: 持久化存储，必须启用 WAL 模式
- **TypeScript**: 类型安全和接口定义
- **vite/vitest**: 单元测试和集成测试
- **zlib** (Node.js): 消息压缩
- **uuid**: 生成唯一消息 ID

#### 推荐的设计模式
- **发布-订阅模式**: 主题订阅和事件驱动
- **命令模式**: 消息封装和处理
- **工厂模式**: 消息创建器
- **策略模式**: 消息路由策略
- **观察者模式**: 状态监控和通知
- **装饰器模式**: 监控指标收集
- **模板方法模式**: 消息处理流程

### 关键文件结构

```
tinyclaw/src/lib/
├── messaging/                    # 消息通信模块
│   ├── message-types.ts         # 消息类型定义
│   ├── message-bus.ts           # 消息总线核心实现
│   ├── message-queue.ts         # 优先级队列实现
│   ├── message-serializer.ts    # 序列化/反序列化 + 压缩
│   ├── message-validator.ts     # 消息验证
│   ├── message-batcher.ts       # 批量写入优化器（新增）
│   ├── message-scheduler.ts     # 延迟消息调度器（新增）
│   ├── monitoring/
│   │   ├── metrics.ts           # 监控指标收集器
│   │   ├── logger.ts            # 结构化日志
│   │   └── tracer.ts            # 链路追踪（新增）
│   ├── security/
│   │   ├── identity.ts          # 身份认证
│   │   ├── authorization.ts     # 授权检查
│   │   ├── encryption.ts        # 消息加密
│   │   └── audit.ts             # 审计日志（新增）
│   └── patterns/
│       ├── direct.ts            # 点对点模式
│       ├── pubsub.ts            # 发布订阅模式
│       ├── broadcast.ts         # 广播模式
│       ├── request-response.ts  # 请求响应模式
│       ├── delayed.ts           # 延迟消息模式（新增）
│       └── mention-bridge.ts    # @mention 桥接层
│
└── routing.ts                   # 路由逻辑（扩展）
```

### 核心实现优先级（新增）

#### 第 1 周：基础架构
1. ✅ 数据库表结构创建
2. ✅ 消息总线基础实现（send/receive）
3. ✅ WAL 模式配置
4. ✅ 消息序列化/反序列化

#### 第 2 周：并发控制
1. ✅ `claimNextMessage()` 乐观锁实现
2. ✅ 事务包装器
3. ✅ 消息确认机制（ack/nack）
4. ✅ 单元测试覆盖

#### 第 3 周：核心功能
1. ✅ 死信队列实现
2. ✅ 重试机制（指数退避）
3. ✅ 优先级队列
4. ✅ 超时处理

#### 第 4 周：消息模式
1. ✅ 点对点模式
2. ✅ 发布订阅模式
3. ✅ 团队广播模式
4. ✅ 请求响应模式

#### 第 5 周：性能优化
1. ✅ 批量写入优化（MessageBatcher）
2. ✅ 消息压缩实现
3. ✅ 监控指标收集
4. ✅ 性能基准测试

#### 第 6 周：增强功能
1. ✅ 延迟消息调度器
2. ✅ 安全机制完善
3. ✅ 审计日志
4. ✅ 集成测试

#### 第 7 周：文档和测试
1. ✅ 完整文档编写
2. ✅ 集成测试补充
3. ✅ 压力测试
4. ✅ 性能调优

#### 第 8 周：稳定性和部署
1. ✅ 24 小时压力测试
2. ✅ 故障恢复测试
3. ✅ 监控告警配置
4. ✅ 生产部署准备

### 数据库模式设计

```sql
-- 消息主表（优化版）
CREATE TABLE messages (
    id TEXT PRIMARY KEY,          -- 消息 ID (UUID)
    sender TEXT NOT NULL,         -- 发送方智能体 ID
    receiver TEXT,                -- 接收方智能体 ID (null 表示广播)
    topic TEXT,                   -- 主题 (Pub/Sub 模式)
    type TEXT NOT NULL,           -- 消息类型 (text/json/binary)
    payload TEXT NOT NULL,        -- 序列化后的消息内容
    priority INTEGER DEFAULT 1,   -- 优先级 (0-10)
    status TEXT DEFAULT 'pending',-- 状态 (pending, processing, delivered, failed)
    correlation_id TEXT,          -- 请求-响应关联 ID
    timeout_at INTEGER,           -- 超时时间戳

    -- 重试机制字段
    retry_count INTEGER DEFAULT 0,      -- 当前重试次数
    max_retries INTEGER DEFAULT 3,      -- 最大重试次数
    next_retry_at INTEGER,              -- 下次重试时间

    -- 消息生命周期字段
    ttl INTEGER,                        -- 生存时间(秒)，超时自动丢弃
    delayed_until INTEGER,              -- 延迟发送时间戳
    routing_key TEXT,                   -- 复杂路由场景的路由键

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (sender) REFERENCES agent_state(agent_id),
    FOREIGN KEY (receiver) REFERENCES agent_state(agent_id)
);

-- 消息投递状态表
CREATE TABLE message_delivery_status (
    message_id TEXT,
    agent_id TEXT,
    status TEXT NOT NULL,         -- delivered, acknowledged, failed
    attempt_count INTEGER DEFAULT 0,
    last_error TEXT,
    delivered_at INTEGER,
    acknowledged_at INTEGER,
    PRIMARY KEY (message_id, agent_id),
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (agent_id) REFERENCES agent_state(agent_id)
);

-- 主题订阅表
CREATE TABLE message_topics (
    topic TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    filter TEXT,                  -- 可选的过滤器
    created_at INTEGER,
    PRIMARY KEY (topic, agent_id),
    FOREIGN KEY (agent_id) REFERENCES agent_state(agent_id)
);

-- 创建索引优化查询
CREATE INDEX idx_messages_status_priority
    ON messages(status, priority DESC, created_at);
CREATE INDEX idx_messages_receiver_status
    ON messages(receiver, status);
CREATE INDEX idx_messages_topic
    ON messages(topic);
CREATE INDEX idx_messages_next_retry
    ON messages(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_delivery_status_message
    ON message_delivery_status(message_id);
CREATE INDEX idx_delivery_status_agent
    ON message_delivery_status(agent_id);

-- 死信队列表（新增）
CREATE TABLE dead_letter_queue (
    id TEXT PRIMARY KEY,              -- 死信消息 ID
    original_message_id TEXT NOT NULL,-- 原始消息 ID
    message_content TEXT NOT NULL,    -- 消息完整内容（JSON）
    failure_reason TEXT,              -- 失败原因
    error_stack TEXT,                 -- 错误堆栈
    retry_history TEXT,               -- 重试历史（JSON 数组）
    agent_id TEXT,                    -- 目标智能体
    created_at INTEGER NOT NULL,
    FOREIGN KEY (original_message_id) REFERENCES messages(id),
    FOREIGN KEY (agent_id) REFERENCES agent_state(agent_id)
);

CREATE INDEX idx_dlq_created_at ON dead_letter_queue(created_at DESC);
CREATE INDEX idx_dlq_agent ON dead_letter_queue(agent_id);
```

### 与现有代码的集成点

#### 1. TinyClaw 集成
- **`src/lib/routing.ts`**: 扩展现有的路由逻辑
  - `parseAgentRouting()` - 解析消息目标
  - `extractTeammateMentions()` - 提取团队提及
  - `enqueueInternalMessage()` - 改用消息总线发送
- **`src/queue-processor.ts`**: 消费消息总线
  - `claimNextMessage()` - 从消息总线获取消息
  - `processMessage()` - 处理消息并调用智能体
- **`src/lib/agent.ts`**: 智能体发送消息
  - `sendToAgent()` - 发送点对点消息
  - `broadcastToTeam()` - 团队广播
  - `publishToTopic()` - 发布到主题

#### 2. Automaton 集成（未来）
- **`src/orchestration/orchestrator.ts`**: 多智能体编排
  - 使用消息总线协调智能体
  - 实现任务分发和状态同步
- **`src/memory/context-manager.ts`**: 上下文共享
  - 通过消息总线共享记忆

### 关键接口定义

```typescript
// 消息接口（带版本控制）
export interface IMessage {
  version: '1.0';                    // 协议版本号
  id: string;                        // 唯一消息 ID
  sender: string;                    // 发送方智能体 ID
  receiver?: string;                 // 接收方智能体 ID
  topic?: string;                    // Pub/Sub 主题
  type: MessageType;                 // 消息类型
  payload: any;                      // 消息内容
  priority?: PriorityLevel;          // 优先级
  correlationId?: string;            // 请求-响应关联
  timeoutAt?: number;                // 超时时间戳
  ttl?: number;                      // 生存时间(秒)
  metadata?: Record<string, any>;    // 元数据

  createdAt: number;                 // 创建时间戳
  updatedAt: number;                 // 更新时间戳
}

// 消息总线接口
export interface IMessageBus {
  send(message: IMessage): Promise<void>;
  receive(agentId: string): Promise<IMessage | null>;
  acknowledge(messageId: string): Promise<void>;
  nack(messageId: string, error?: string): Promise<void>;

  publish(topic: string, message: IMessage): Promise<void>;
  subscribe(topic: string, agentId: string): Promise<void>;
  unsubscribe(topic: string, agentId: string): Promise<void>;

  request(receiver: string, message: IMessage, timeout?: number): Promise<IMessage>;
}

// 安全接口
export interface IAgentIdentity {
  agentId: string;
  token: string;
  permissions: string[];
  validUntil: number;
}

export interface IMessageSecurity {
  authenticate(agentId: string, token: string): Promise<IAgentIdentity>;
  authorize(agentId: string, action: string): Promise<boolean>;
  encrypt(payload: any): Promise<string>;
  decrypt(encrypted: string): Promise<any>;
}

#### 并发控制和事务实现示例（关键！）

```typescript
/**
 * 从消息队列认领下一条消息
 * 使用行级锁定和乐观锁避免竞态条件
 */
export async function claimNextMessage(
  db: Database,
  agentId: string,
  lockTimeout: number = 5000
): Promise<IMessage | null> {
  return db.transaction(() => {
    try {
      // 使用 SELECT 查询找到待处理消息
      // 注意：SQLite 不支持 SELECT ... FOR UPDATE，需通过 UPDATE 条件来实现
      const candidate = db.prepare(`
        SELECT * FROM messages
        WHERE status = 'pending'
          AND (receiver = ? OR receiver IS NULL)
          AND (timeout_at IS NULL OR timeout_at > ?)
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      `).get(agentId, Date.now());

      if (!candidate) {
        return null;
      }

      // 乐观锁：尝试将状态改为 processing，同时验证仍为 pending
      const result = db.prepare(`
        UPDATE messages
        SET status = 'processing',
            updated_at = ?,
            retry_count = retry_count + 1
        WHERE id = ?
          AND status = 'pending'
          AND (timeout_at IS NULL OR timeout_at > ?)
      `).run(Date.now(), candidate.id, Date.now());

      // 检查是否成功更新（避免竞态条件）
      if (result.changes === 0) {
        // 被其他进程抢走了，返回 null
        return null;
      }

      // 成功认领，返回消息
      const messageRow = db.prepare(`
        SELECT * FROM messages WHERE id = ?
      `).get(candidate.id);

      // 反序列化消息
      const message: IMessage = MessageSerializer.deserialize(messageRow.payload);
      return message;

    } catch (error) {
      // 事务会自动回滚
      throw error;
    }
  });
}

/**
 * 完成消息处理（确认）
 */
export async function acknowledgeMessage(
  db: Database,
  messageId: string
): Promise<void> {
  return db.transaction(() => {
    // 更新消息状态为 delivered
    const result = db.prepare(`
      UPDATE messages
      SET status = 'delivered',
          updated_at = ?
      WHERE id = ?
        AND status = 'processing'
    `).run(Date.now(), messageId);

    if (result.changes === 0) {
      throw new Error(`消息 ${messageId} 不在 processing 状态，无法确认`);
    }
  });
}

/**
 * 消息处理失败（拒绝）
 */
export async function nackMessage(
  db: Database,
  messageId: string,
  error?: string
): Promise<void> {
  return db.transaction(() => {
    // 查询当前消息状态
    const message = db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `).get(messageId);

    if (!message) {
      throw new Error(`消息 ${messageId} 不存在`);
    }

    const newRetryCount = message.retry_count + 1;

    if (newRetryCount >= message.max_retries) {
      // 超过最大重试次数，移入死信队列
      moveToDeadLetterQueue(db, messageId, error || 'Max retries exceeded');

      // 标记原消息为 failed
      db.prepare(`
        UPDATE messages SET status = 'failed', updated_at = ?
        WHERE id = ?
      `).run(Date.now(), messageId);
    } else {
      // 计算下次重试时间（指数退避）
      const delay = Math.min(60, Math.pow(2, newRetryCount - 1)); // 1, 2, 4, 8, 16, 32, 60...
      const nextRetryAt = Date.now() + delay * 1000;

      // 放回队列，等待下次重试
      db.prepare(`
        UPDATE messages
        SET status = 'pending',
            retry_count = ?,
            next_retry_at = ?,
            updated_at = ?
        WHERE id = ?
      `).run(newRetryCount, nextRetryAt, Date.now(), messageId);
    }
  });
}

/**
 * 移动到死信队列
 */
function moveToDeadLetterQueue(
  db: Database,
  messageId: string,
  reason: string,
  error?: string
): void {
  const message = db.prepare(`
    SELECT * FROM messages WHERE id = ?
  `).get(messageId);

  if (!message) return;

  // 获取消息的所有投递状态历史
  const deliveryHistory = db.prepare(`
    SELECT * FROM message_delivery_status
    WHERE message_id = ?
    ORDER BY delivered_at DESC
  `).all(messageId);

  db.prepare(`
    INSERT INTO dead_letter_queue (
      id, original_message_id, message_content,
      failure_reason, error_stack, retry_history,
      agent_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateUUID(),
    messageId,
    JSON.stringify(message),
    reason,
    error || null,
    JSON.stringify(deliveryHistory),
    message.receiver,
    Date.now()
  );
}

/**
 * SQLite WAL 模式配置
 */
export function configureWALMode(db: Database): void {
  // 启用 WAL 模式（支持高并发读写）
  db.exec('PRAGMA journal_mode = WAL;');

  // 设置同步级别为 NORMAL（平衡性能和安全性）
  db.exec('PRAGMA synchronous = NORMAL;');

  // 设置 WAL 自动检查点（每 1000 页触发一次）
  db.exec('PRAGMA wal_autocheckpoint = 1000;');

  // 启用外键约束
  db.exec('PRAGMA foreign_keys = ON;');

  // 设置超时时间为 5 秒
  db.exec('PRAGMA busy_timeout = 5000;');

  console.log('✅ SQLite WAL 模式已启用，支持高并发读写');
}

/**
 * 批量提交优化
 */
export class MessageBatcher {
  private queue: IMessage[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly batchSize: number = 100;
  private readonly batchInterval: number = 100; // 100ms

  constructor(
    private readonly db: Database,
    private readonly onFlush: (messages: IMessage[]) => Promise<void>
  ) {}

  async add(message: IMessage): Promise<void> {
    this.queue.push(message);

    // 如果达到批次大小，立即提交
    if (this.queue.length >= this.batchSize) {
      await this.flush();
      return;
    }

    // 启动定时器，延迟提交
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush().catch(console.error);
      }, this.batchInterval);
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const messages = [...this.queue];
    this.queue = [];

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    // 使用事务批量提交
    this.db.transaction(() => {
      messages.forEach(msg => {
        this.db.prepare(`
          INSERT INTO messages (
            id, sender, receiver, topic, type, payload,
            priority, status, correlation_id, timeout_at,
            retry_count, max_retries, next_retry_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          msg.id, msg.sender, msg.receiver, msg.topic,
          msg.type, JSON.stringify(msg),
          msg.priority, 'pending', msg.correlationId, msg.timeoutAt,
          0, 3, null,
          Date.now(), Date.now()
        );
      });
    });

    await this.onFlush(messages);
  }
}
```

### 测试策略

#### 单元测试覆盖
- ✅ 消息序列化/反序列化（包含版本控制）
- ✅ 消息总线核心操作（带事务控制）
- ✅ 各种消息模式
- ✅ 安全机制
- ✅ 优先级队列
- ✅ 超时和重试机制
- ✅ 死信队列处理
- ✅ 并发安全测试（模拟竞态条件）

#### 集成测试场景
- ✅ 多智能体点对点通信
- ✅ 主题订阅和发布
- ✅ 团队广播
- ✅ 请求-响应模式
- ✅ 高并发场景（50-100 智能体）
- ✅ 故障恢复（重启后消息不丢失）
- ✅ 性能基准（吞吐量、延迟）
- ✅ 死信队列手动恢复流程
- ✅ 消息压缩/解压缩

### 性能目标（调整后）

**现实可行的目标**:
- **吞吐量**: 200-500 消息/秒（SQLite WAL 模式）
- **延迟**: 平均延迟 < 200ms
- **可靠性**: 消息不丢失率 > 99.9%
- **并发**: 支持 50-100 智能体同时通信

**优化措施**:
1. 批量写入（事务合并，减少 I/O）
2. 消息压缩（大于 1KB 自动压缩）
3. 定期归档历史消息（减轻数据库压力）
4. 监控队列长度，超阈值触发限流
5. 使用内存缓存作为写入缓冲层（可选）

**升级路径**:
- 阶段 1: SQLite WAL (当前设计)
- 阶段 2: SQLite + Redis 缓冲层
- 阶段 3: 分布式消息队列（RabbitMQ/Kafka）

### 风险和注意事项

#### 🔴 高风险

1. **并发竞争和竞态条件**
   - **风险**: 多个智能体同时 `claimNextMessage()` 可能导致消息重复处理
   - **缓解**:
     - 使用显式事务和 `SELECT ... FOR UPDATE` 行级锁定
     - 更新时验证状态（WHERE status='pending'）
     - 实现乐观锁机制

2. **SQLite 性能瓶颈**
   - **风险**: 高并发场景下写入吞吐量受限
   - **缓解**:
     - 批量事务提交（累积 10-100 条消息再提交）
     - 消息压缩减少 I/O
     - 定期归档清理历史数据
     - 考虑引入 Redis 作为写缓冲层

3. **消息丢失风险**
   - **风险**: 进程崩溃可能导致消息丢失
   - **缓解**:
     - WAL 模式 + 同步提交（sync=FULL）
     - ACK 机制确保消息被消费
     - 死信队列记录失败消息
     - 定期检查点（checkpoint）

#### 🟡 中风险

4. **死锁风险**
   - **风险**: 事务超时或相互等待
   - **缓解**:
     - 设置合理的事务超时（5-10 秒）
     - 统一加锁顺序
     - 使用超时检测和自动回滚

5. **消息堆积**
   - **风险**: 消费速度跟不上生产速度
   - **缓解**:
     - 监控队列长度，超过阈值告警
     - 动态调整消费速率
     - 实现背压机制（backpressure）
     - 支持消息丢弃策略（优先级低的可丢弃）

6. **内存泄漏**
   - **风险**: 长时间运行后内存增长
   - **缓解**:
     - 定期清理已完成的消息
     - 限制内存队列大小
     - 实现 TTL 自动过期
     - 监控内存使用并告警

7. **版本兼容性**
   - **风险**: 协议升级导致旧版本无法解析
   - **缓解**:
     - 严格的版本控制（version='1.0'）
     - 向后兼容的序列化格式
     - 支持多版本协议共存
     - 迁移期间保留兼容层

#### 🟢 低风险

8. **向后兼容性**
   - **风险**: 破坏现有 @mention 机制
   - **缓解**:
     - `mention-bridge.ts` 提供兼容层
     - 保留原有 API 接口
     - 逐步迁移，支持混用
     - 充分测试现有功能

### 监控和可观测性（新增）

#### 关键指标

```typescript
export interface IMessageBusMetrics {
  // 吞吐量
  messagesPerSecond: number;
  bytesPerSecond: number;

  // 队列状态
  pendingCount: number;        // 等待处理的消息数
  processingCount: number;     // 处理中的消息数
  deliveredCount: number;      // 已投递的消息数
  failedCount: number;         // 失败的消息数
  dlqCount: number;            // 死信队列消息数

  // 延迟指标
  avgLatencyMs: number;        // 平均延迟
  p50LatencyMs: number;        // 50% 延迟
  p95LatencyMs: number;        // 95% 延迟
  p99LatencyMs: number;        // 99% 延迟

  // 错误率
  errorRate: number;           // 错误率 (%)
  retryRate: number;           // 重试率 (%)

  // 资源使用
  dbWriteOpsPerSec: number;    // 写入操作/秒
  dbReadOpsPerSec: number;     // 读取操作/秒
  memoryUsageMB: number;       // 内存使用 (MB)

  // 智能体状态
  activeAgents: number;        // 活跃智能体数
  messagePerAgent: Record<string, number>; // 每个智能体的消息数
}
```

#### 监控集成

1. **内部监控**: 定期输出指标日志
2. **Prometheus 集成**: 提供 `/metrics` 端点
3. **告警规则**:
   - 队列长度 > 10000 触发告警
   - 错误率 > 5% 触发告警
   - 延迟 > 1000ms 触发告警
   - 内存使用 > 80% 触发告警

4. **日志追踪**:
   - 每条消息完整的生命周期日志
   - 关联的 traceId 用于链路追踪
   - 支持结构化日志查询

### 参考文档
- [TinyClaw 架构指南](docs/architecture-tinyclaw.md) - 团队编排和路由
- [Automaton 架构指南](docs/architecture-automaton.md) - 未来多智能体支持
- [集成架构](docs/integration-architecture.md) - 跨项目协作模式

## Dev Agent Record

### Agent Model Used

qwen3-max-2026-01-23

### Debug Log References

N/A

### Completion Notes List

- 故事基于现有技术框架（SQLite WAL + @mention 机制）
- 向后兼容现有 TinyClaw 功能
- 为 Automaton 未来的多智能体支持预留扩展点
- 安全性和性能是首要考虑

### File List

- tinyclaw/src/lib/messaging/message-types.ts
- tinyclaw/src/lib/messaging/message-bus.ts
- tinyclaw/src/lib/messaging/message-queue.ts
- tinyclaw/src/lib/messaging/message-serializer.ts
- tinyclaw/src/lib/messaging/message-validator.ts
- tinyclaw/src/lib/messaging/message-batcher.ts
- tinyclaw/src/lib/messaging/message-scheduler.ts
- tinyclaw/src/lib/messaging/security/identity.ts
- tinyclaw/src/lib/messaging/security/authorization.ts
- tinyclaw/src/lib/messaging/security/encryption.ts
- tinyclaw/src/lib/messaging/security/audit.ts
- tinyclaw/src/lib/messaging/monitoring/metrics.ts
- tinyclaw/src/lib/messaging/monitoring/logger.ts
- tinyclaw/src/lib/messaging/monitoring/tracer.ts
- tinyclaw/src/lib/messaging/patterns/direct.ts
- tinyclaw/src/lib/messaging/patterns/pubsub.ts
- tinyclaw/src/lib/messaging/patterns/broadcast.ts
- tinyclaw/src/lib/messaging/patterns/request-response.ts
- tinyclaw/src/lib/messaging/patterns/delayed.ts
- tinyclaw/src/lib/messaging/patterns/mention-bridge.ts
- tinyclaw/test/messaging/message-bus.test.ts
- tinyclaw/test/messaging/patterns.test.ts
- tinyclaw/test/messaging/security.test.ts
- tinyclaw/test/messaging/batcher.test.ts
- tinyclaw/test/messaging/scheduler.test.ts
- tinyclaw/test/messaging/monitoring.test.ts
- docs/communication-protocol.md (新文档)

## 使用示例和最佳实践

### 示例 1: 点对点消息

```typescript
import { messageBus } from 'tinyclaw/src/lib/messaging/message-bus';
import { MessageType, PriorityLevel } from 'tinyclaw/src/lib/messaging/message-types';

// 发送消息到特定智能体
const message = {
  version: '1.0',
  id: generateUUID(),
  sender: 'agent-sales',
  receiver: 'agent-technical',
  type: MessageType.JSON,
  payload: {
    task: 'analyze-api',
    url: 'https://api.example.com',
    requirements: ['auth', 'rate-limit']
  },
  priority: PriorityLevel.HIGH,
  timeoutAt: Date.now() + 30000, // 30秒超时
  createdAt: Date.now(),
  updatedAt: Date.now()
};

await messageBus.send(message);

// 接收方处理
const receivedMessage = await messageBus.receive('agent-technical');
if (receivedMessage) {
  // 处理消息逻辑
  const result = await processMessage(receivedMessage.payload);

  // 确认消息已处理
  await messageBus.acknowledge(receivedMessage.id);
}
```

### 示例 2: 发布订阅模式

```typescript
// 订阅主题
await messageBus.subscribe('system-alerts', 'agent-monitoring');

// 发布消息到主题
await messageBus.publish('system-alerts', {
  version: '1.0',
  id: generateUUID(),
  sender: 'system',
  topic: 'system-alerts',
  type: MessageType.TEXT,
  payload: 'CPU usage exceeded 90%',
  priority: PriorityLevel.HIGH,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

// 多个订阅者会同时收到消息
```

### 示例 3: 请求响应模式

```typescript
// 发送请求并等待响应
const request = {
  version: '1.0',
  id: generateUUID(),
  sender: 'agent-user',
  receiver: 'agent-search',
  type: MessageType.JSON,
  payload: { query: 'best AI agents' },
  correlationId: generateUUID(), // 关联请求和响应
  timeoutAt: Date.now() + 10000, // 10秒超时
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const response = await messageBus.request('agent-search', request, 10000);

if (response) {
  console.log('Search results:', response.payload);
} else {
  console.error('Request timeout or failed');
}
```

### 示例 4: 团队广播

```typescript
import { teamBroadcaster } from 'tinyclaw/src/lib/messaging/patterns/broadcast';

// 向团队所有成员广播
await teamBroadcaster.broadcast('team-support', {
  version: '1.0',
  id: generateUUID(),
  sender: 'team-leader',
  type: MessageType.TEXT,
  payload: 'Weekly meeting at 2PM today',
  priority: PriorityLevel.NORMAL,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

// 团队所有成员都会收到此消息
```

### 示例 5: 延迟消息

```typescript
// 5 分钟后发送消息
const delayedMessage = {
  version: '1.0',
  id: generateUUID(),
  sender: 'agent-scheduler',
  receiver: 'agent-reminder',
  type: MessageType.TEXT,
  payload: 'Time to send daily report',
  delayed_until: Date.now() + 5 * 60 * 1000, // 5分钟后
  createdAt: Date.now(),
  updatedAt: Date.now()
};

await messageBus.send(delayedMessage);
// 消息调度器会自动在指定时间发送
```

### 最佳实践

#### 1. 消息大小控制
- ✅ 消息体控制在 100KB 以内
- ✅ 大文件使用文件路径引用而非直接传输
- ✅ 大于 1KB 自动启用压缩

```typescript
// 最佳实践：大文件引用
const message = {
  payload: {
    fileId: 'abc123',
    filePath: '/workspace/files/report.pdf',
    fileSize: 2048576 // 2MB
  }
};
```

#### 2. 优先级合理使用
- ✅ 紧急告警：PriorityLevel.HIGH (9-10)
- ✅ 用户请求：PriorityLevel.NORMAL (5-6)
- ✅ 后台任务：PriorityLevel.LOW (0-2)

```typescript
// 根据业务场景设置优先级
const priorities = {
  systemAlert: PriorityLevel.HIGH,    // 10
  userRequest: PriorityLevel.HIGH,    // 9
  apiCall: PriorityLevel.NORMAL,      // 6
  dataSync: PriorityLevel.LOW         // 2
};
```

#### 3. 超时设置
- ✅ 简单查询：5-10 秒
- ✅ 复杂计算：30-60 秒
- ✅ 批量处理：5-10 分钟
- ✅ 异步任务：不设置超时，使用轮询

```typescript
// 根据操作类型设置超时
const timeouts = {
  quickQuery: 10000,      // 10秒
  complexCalc: 60000,     // 60秒
  batchProcess: 600000,   // 10分钟
  asyncTask: 0           // 无超时
};
```

#### 4. 错误处理
- ✅ 始终检查消息处理结果
- ✅ 使用 nack() 报告失败
- ✅ 记录详细的错误日志
- ✅ 监控错误率和重试次数

```typescript
try {
  const result = await processMessage(message.payload);
  await messageBus.acknowledge(message.id);
} catch (error) {
  console.error(`Message ${message.id} failed:`, error);

  // 报告失败，触发重试
  await messageBus.nack(message.id, error.message);

  // 记录到审计日志
  await auditLogger.log({
    action: 'message_failed',
    messageId: message.id,
    error: error.message,
    stack: error.stack
  });
}
```

#### 5. 监控和告警
- ✅ 定期检查队列长度
- ✅ 监控错误率和延迟
- ✅ 设置合理的告警阈值
- ✅ 定期清理历史数据

```typescript
// 定期检查队列状态
setInterval(async () => {
  const stats = await messageBus.getStats();

  // 告警：队列积压
  if (stats.pendingCount > 10000) {
    await sendAlert(`Message queue backlog: ${stats.pendingCount}`);
  }

  // 告警：错误率过高
  if (stats.errorRate > 5) {
    await sendAlert(`High error rate: ${stats.errorRate}%`);
  }

  // 告警：延迟过高
  if (stats.p95LatencyMs > 1000) {
    await sendAlert(`High latency: ${stats.p95LatencyMs}ms`);
  }
}, 60000); // 每分钟检查一次
```

#### 6. 批量操作优化
- ✅ 批量发送消息使用 MessageBatcher
- ✅ 减少数据库事务次数
- ✅ 控制批量大小（建议 100-500）

```typescript
// 使用批量写入优化器
const batcher = new MessageBatcher(db, async (messages) => {
  console.log(`Flushed ${messages.length} messages in batch`);
});

// 添加消息到批次
for (let i = 0; i < 1000; i++) {
  await batcher.add({
    // ... message data
  });
}

// 手动刷新
await batcher.flush();
```

#### 7. 死信队列处理
- ✅ 定期检查死信队列
- ✅ 分析失败原因
- ✅ 手动恢复可重试的消息
- ✅ 归档永久失败的消息

```typescript
// 死信队列监控和处理
async function processDeadLetterQueue() {
  const dlqMessages = await db.prepare(`
    SELECT * FROM dead_letter_queue
    WHERE created_at > ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(Date.now() - 24 * 60 * 60 * 1000); // 最近24小时

  for (const msg of dlqMessages) {
    // 分析失败原因
    if (msg.failure_reason === 'Temporary network error') {
      // 可重试，重新加入队列
      await retryMessage(msg.original_message_id);
    } else {
      // 永久失败，归档到历史表
      await archiveFailedMessage(msg);
    }
  }
}
```

### 故障排查指南

#### 问题 1: 消息处理缓慢
**症状**: 队列积压，延迟增加
**排查步骤**:
1. 检查数据库磁盘 I/O
2. 检查索引是否有效
3. 查看是否有慢查询
4. 检查是否有未提交的事务
5. 考虑增加批量写入

#### 问题 2: 消息丢失
**症状**: 消息发送成功但未收到
**排查步骤**:
1. 检查消息状态（pending/processing/delivered）
2. 检查是否有异常进入死信队列
3. 验证 WAL 模式是否启用
4. 检查事务是否正常提交
5. 查看错误日志

#### 问题 3: 并发冲突
**症状**: 消息重复处理或认领失败
**排查步骤**:
1. 检查 `claimNextMessage()` 的乐观锁实现
2. 验证 WHERE 条件是否正确
3. 检查事务隔离级别
4. 查看是否有死锁发生
5. 考虑增加重试机制

#### 问题 4: 内存泄漏
**症状**: 内存使用持续增长
**排查步骤**:
1. 检查是否有未清理的内存队列
2. 验证定时清理任务是否正常运行
3. 检查是否有循环引用
4. 监控长时间运行的任务
5. 定期重启服务

## 性能调优建议

### 数据库优化
```sql
-- 1. 定期执行 VACUUM
VACUUM;

-- 2. 优化 WAL 检查点
PRAGMA wal_autocheckpoint = 1000;

-- 3. 定期清理历史数据
DELETE FROM messages
WHERE created_at < unixepoch('now', '-7 days')
  AND status IN ('delivered', 'failed');

-- 4. 重建索引（每月一次）
REINDEX;
```

### 应用层优化
- 使用连接池复用数据库连接
- 启用查询缓存
- 限制并发请求数
- 使用内存缓存热点数据
- 定期归档历史消息

### 监控指标阈值
- **健康**: pendingCount < 1000, errorRate < 1%
- **警告**: pendingCount > 5000, errorRate > 3%
- **危险**: pendingCount > 10000, errorRate > 5%
