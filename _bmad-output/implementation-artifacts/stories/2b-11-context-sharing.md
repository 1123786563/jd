# Story 2b.11: 跨Agent上下文共享 - @mention路由集成

Status: backlog

<!-- Note: 依赖2b.10核心上下文管理实现，专注于跨Agent上下文共享和@mention集成 -->

## Story

As a **多智能体协作系统**,
I want **实现上下文在不同Agent之间的高效共享和传递**,
so that **当一个Agent @mention 另一个Agent时，目标Agent能立即获得完整的上下文信息，实现真正的协同工作**.

## Acceptance Criteria

### AC 1: 上下文共享核心功能
- [ ] 实现 `shareWithAgent(targetAgentId: string): Promise<void>` 方法
- [ ] 验证目标Agent是否存在（查询 `agent_configs` 表）
- [ ] 将当前上下文序列化为JSON写入目标Agent工作目录
- [ ] 文件位置：`${targetWorkspace}/shared/${conversationId}-${sourceAgentId}.json`
- [ ] 共享操作记录到 `context_shares` 表

### AC 2: 批量上下文共享
- [ ] 实现 `shareWithAgents(agentIds: string[]): Promise<void[]>` 支持批量共享
- [ ] 并行执行多个共享操作（使用 Promise.all）
- [ ] 处理部分失败场景（记录失败的Agent，不影响其他操作）
- [ ] 返回共享结果数组（成功/失败 + 错误信息）

### AC 3: @mention路由深度集成
- [ ] 修改 `lib/routing.ts` 的 `routeMentions()` 函数
- [ ] 当检测到 `[@agent: message]` 标签时，自动调用 `shareWithAgent()`
- [ ] 共享完成后调用 `incrementPending(conversationId, targetAgentId)`
- [ ] 支持嵌套@mention（Agent A @ B, B @ C），上下文链式传递

### AC 4: 上下文摘要生成（RAG支持）
- [ ] 实现 `generateSummary(options?: SummaryOptions): Promise<string>` 方法
- [ ] 使用本地规则生成摘要（不依赖外部LLM）
- [ ] 摘要内容：会话目标、当前进度、待解决问题、关键决策点
- [ ] 支持三种长度：short（100字）、medium（300字）、long（500字）
- [ ] 缓存摘要结果（键：`${conversationId}-${length}`）

### AC 5: 共享上下文接收与加载
- [ ] 实现 `loadSharedContext(conversationId: string, fromAgentId: string): Promise<AgentContext>`
- [ ] 从 `${workspace}/shared/` 目录加载共享上下文
- [ ] 验证文件完整性和签名（可选）
- [ ] 记录上下文读取操作到日志

### AC 6: 访问控制与权限
- [ ] 实现 `canAccessContext(agentId: string, conversationId: string): Promise<boolean>`
- [ ] 权限规则：Agent只能访问自己是参与者或被@mention的上下文
- [ ] 实现基于角色的访问控制（RBAC）
- [ ] 权限检查失败时抛出 `PermissionDeniedError`

### AC 7: 敏感信息过滤
- [ ] 实现 `sanitizeContext(context: AgentContext): AgentContext` 敏感信息过滤
- [ ] 过滤规则：私钥、密码、API Token、钱包地址
- [ ] 使用正则表达式匹配敏感模式
- [ ] 过滤后的字段替换为 `[REDACTED]`
- [ ] 记录敏感信息发现到审计日志

### AC 8: 上下文版本与审计
- [ ] 在 `context_shares` 表中记录共享版本号
- [ ] 每次共享生成唯一 shareId（UUID）
- [ ] 记录完整审计信息：时间、源Agent、目标Agent、上下文哈希
- [ ] 提供审计查询接口：`getShareHistory(conversationId)`

### AC 9: 性能与并发优化
- [ ] 上下文共享时间 < 100ms（不包括LLM摘要）
- [ ] 支持并发共享（最多10个并行操作）
- [ ] 使用Redis作为可选缓存层（减少文件I/O）
- [ ] 实现共享操作的流控（防止突发流量）

### AC 10: 错误处理与恢复
- [ ] 自定义错误：`AgentNotFoundError`、`ShareFailedError`、`AccessDeniedError`
- [ ] 实现重试机制（最多3次，指数退避）
- [ ] 共享失败时发送告警到管理渠道
- [ ] 实现死信队列（多次失败的共享操作记录）

### AC 11: 监控与告警
- [ ] 记录共享指标：成功率、延迟、失败原因分布
- [ ] 实现监控接口：`getShareStats()` - 返回共享次数、成功率、平均延迟
- [ ] 异常告警：共享失败率 > 5% 时发送告警
- [ ] 实现健康检查：`checkShareHealth()` - 验证共享系统状态

### AC 12: 完整测试覆盖
- [ ] 单元测试：覆盖所有共享方法（覆盖率 ≥ 90%）
- [ ] 集成测试：测试@mention路由与共享集成
- [ ] 场景测试：模拟多Agent协作场景（A @ B @ C）
- [ ] 压力测试：并发100个共享操作
- [ ] 安全测试：测试权限绕过、路径遍历等漏洞

## Tasks / Subtasks

- [ ] **Task 1: 上下文共享核心实现** (AC: 1, 2)
  - [ ] 实现 `shareWithAgent()` 方法
  - [ ] 实现 `shareWithAgents()` 批量共享
  - [ ] 实现Agent存在性验证
  - [ ] 实现共享结果记录

- [ ] **Task 2: 数据库表设计** (AC: 8)
  - [ ] 创建 `context_shares` 表
  - [ ] 创建必要索引
  - [ ] 实现审计查询方法
  - [ ] 编写迁移脚本

- [ ] **Task 3: @mention路由集成** (AC: 3)
  - [ ] 修改 `lib/routing.ts`
  - [ ] 实现自动上下文共享
  - [ ] 实现嵌套@mention支持
  - [ ] 测试路由集成

- [ ] **Task 4: 上下文摘要生成器** (AC: 4)
  - [ ] 实现本地摘要生成算法
  - [ ] 实现摘要缓存
  - [ ] 支持多长度选项
  - [ ] 编写单元测试

- [ ] **Task 5: 共享上下文接收器** (AC: 5)
  - [ ] 实现 `loadSharedContext()` 方法
  - [ ] 实现文件验证
  - [ ] 实现读取日志记录
  - [ ] 编写集成测试

- [ ] **Task 6: 访问控制实现** (AC: 6)
  - [ ] 实现权限检查函数
  - [ ] 实现RBAC逻辑
  - [ ] 集成到共享流程
  - [ ] 编写安全测试

- [ ] **Task 7: 敏感信息过滤器** (AC: 7)
  - [ ] 定义敏感信息正则模式
  - [ ] 实现 `sanitizeContext()` 函数
  - [ ] 实现审计日志记录
  - [ ] 编写测试用例

- [ ] **Task 8: 性能优化** (AC: 9)
  - [ ] 性能基准测试
  - [ ] 实现Redis缓存支持（可选）
  - [ ] 实现流控机制
  - [ ] 优化并发处理

- [ ] **Task 9: 错误处理与恢复** (AC: 10)
  - [ ] 实现所有自定义错误
  - [ ] 实现重试机制
  - [ ] 实现死信队列
  - [ ] 实现告警通知

- [ ] **Task 10: 监控与日志** (AC: 11)
  - [ ] 实现监控指标收集
  - [ ] 实现监控接口
  - [ ] 实现健康检查
  - [ ] 配置告警规则

- [ ] **Task 11: 完整测试套件** (AC: 12)
  - [ ] 编写所有单元测试
  - [ ] 编写集成测试
  - [ ] 编写场景测试
  - [ ] 编写压力测试
  - [ ] 编写安全测试
  - [ ] 运行完整测试套件

## Dev Notes

### 架构模式与约束

**设计模式：**
- **观察者模式**：上下文共享时通知订阅者
- **策略模式**：支持多种摘要生成策略（本地/LLM）
- **装饰器模式**：敏感信息过滤作为装饰器
- **责任链模式**：权限检查链式执行

**核心约束：**
- 依赖2b.10的核心上下文管理
- 所有共享操作必须记录审计日志
- 敏感信息必须过滤后才能共享
- 并发操作必须有流控保护

### 项目结构与文件位置

**新增文件：**
```
tinyclaw/src/lib/context-sharer.ts        # 上下文共享核心实现
tinyclaw/src/lib/context-summary.ts       # 本地摘要生成器
tinyclaw/src/lib/access-control.ts        # 访问控制实现
tinyclaw/src/lib/sanitizer.ts             # 敏感信息过滤器
tinyclaw/src/services/share-service.ts    # 共享服务层
tinyclaw/src/monitoring/share-metrics.ts  # 共享监控指标
```

**修改文件：**
```
tinyclaw/src/lib/routing.ts               # 集成 shareWithAgent()
tinyclaw/src/lib/conversation.ts          # 添加 shareWithAgent() 方法
tinyclaw/src/lib/db.ts                    # 添加共享记录方法
tinyclaw/src/config/agent-config.ts       # 添加共享配置
tinyclaw/src/utils/logger.ts              # 共享日志增强
```

**数据库变更：**
```sql
-- context_shares 表：上下文共享记录
CREATE TABLE IF NOT EXISTS context_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_id TEXT UNIQUE NOT NULL,          -- UUID
    conversation_id TEXT NOT NULL,
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL,
    context_version INTEGER DEFAULT 1,
    context_hash TEXT NOT NULL,
    shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'success',          -- success | failed | retrying
    error_message TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_context_shares_conversation ON context_shares(conversation_id);
CREATE INDEX IF NOT EXISTS idx_context_shares_to_agent ON context_shares(to_agent);
CREATE INDEX IF NOT EXISTS idx_context_shares_shared_at ON context_shares(shared_at);
CREATE INDEX IF NOT EXISTS idx_context_shares_status ON context_shares(status);
```

### 技术栈要求

**核心依赖：**
```json
{
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "fs-extra": "^11.2.0",
    "ioredis": "^5.4.1",        // 可选：Redis缓存
    "uuid": "^9.0.1",           // UUID生成
    "lodash": "^4.17.21"        // 工具函数
  },
  "devDependencies": {
    "@types/node": "^20.11.19",
    "typescript": "^5.3.3",
    "vitest": "^1.3.0"
  }
}
```

**架构决策：**
1. **共享存储**：JSON文件（简单可靠），未来可支持数据库存储
2. **摘要生成**：本地规则（性能好、成本低），预留LLM集成接口
3. **缓存策略**：可选Redis（高性能场景），默认禁用
4. **权限检查**：查询 `agent_configs` 表验证Agent存在性
5. **审计日志**：所有共享操作必须记录，保留90天

### 性能与可扩展性

**性能目标：**
- 单次共享延迟：95% < 100ms
- 并发共享：支持10个并行操作
- 缓存命中率：目标 ≥ 70%（如果启用Redis）
- 内存占用：每个共享上下文 < 10MB

**扩展性设计：**
- 支持多种存储后端（文件/数据库/S3）
- 支持分布式部署（通过共享存储）
- 支持消息队列（未来异步共享）
- 支持自定义摘要生成器

### 安全与合规

**安全要求：**
1. **访问控制**：严格验证Agent身份和权限
2. **敏感信息过滤**：自动检测并脱敏
3. **审计追踪**：完整记录共享历史（保留90天）
4. **防重放攻击**：使用UUID防止重复共享
5. **文件完整性**：可选签名验证

**合规要求：**
- GDPR数据保护
- 支持数据删除请求
- 提供审计报告导出
- 敏感信息加密存储（可选）

### 测试标准

**单元测试：**
- 覆盖率：行 ≥ 90%，分支 ≥ 85%
- 测试边界：不存在的Agent、权限不足、文件损坏
- Mock所有外部依赖

**集成测试：**
- 测试@mention路由集成
- 测试嵌套共享场景
- 测试并发访问控制
- 测试错误恢复机制

**场景测试：**
```typescript
// 场景1: 简单@mention
SalesAgent @mentions ArchitectAgent
// 验证: Architect收到完整上下文

// 场景2: 嵌套@mention
SalesAgent @mentions ArchitectAgent
ArchitectAgent @mentions DevAgent
// 验证: DevAgent收到完整上下文链

// 场景3: 批量@mention
LeaderAgent @mentions [DevAgent, QAAgent]
// 验证: 两个Agent都收到上下文
```

**安全测试：**
- 测试权限绕过尝试
- 测试路径遍历攻击
- 测试敏感信息泄露
- 测试拒绝服务攻击

### 相关Epic上下文

**Epic 2b: 后端API与插件系统**
- 这是Epic 2b的第11个故事，专注于跨Agent上下文共享
- **前置依赖：2b.10（核心上下文管理）、2b.9（@mention路由）**
- 后续故事：2b.12（索引优化）
- 完成后实现完整的多Agent协作能力

**与Automaton集成点：**
- 当前阶段专注于TinyClaw内部共享
- 未来可通过API桥接实现与Automaton的上下文共享

### 实施顺序建议

1. **必须先完成**：2b.10（核心上下文管理）
2. **建议同时完成**：2b.9（@mention路由）
3. **然后实施**：2b.11（跨Agent上下文共享）
4. **最后优化**：2b.12（索引优化）

这样可以确保依赖关系清晰，开发流程顺畅。

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

### File List

- tinyclaw/src/lib/context-sharer.ts
- tinyclaw/src/lib/context-summary.ts
- tinyclaw/src/lib/access-control.ts
- tinyclaw/src/lib/sanitizer.ts
- tinyclaw/src/services/share-service.ts
- tinyclaw/src/monitoring/share-metrics.ts
- tinyclaw/src/lib/routing.ts (修改)
- tinyclaw/src/lib/conversation.ts (修改)
