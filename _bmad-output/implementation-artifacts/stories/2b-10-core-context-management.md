# Story 2b.10: 核心上下文管理 - ConversationContext 基础功能

Status: ready-for-dev

<!-- Note: 这是上下文共享机制的核心基础，实现上下文的加载、存储和查询 -->

## Story

As a **多智能体协作系统**,
I want **提供完整的上下文加载、存储和查询能力**,
so that **每个Agent能够独立管理和访问自己的会话上下文，为跨Agent共享打下基础**.

## Acceptance Criteria

### AC 1: ConversationContext类核心实现
- [ ] 实现 `ConversationContext` 类，包含 `conversationId`、`messageHistory`、`workspaceArtifacts` 私有属性
- [ ] 构造函数接收 `conversationId` 参数并初始化实例
- [ ] 提供 `loadContext(): Promise<AgentContext>` 方法，返回完整的上下文对象
- [ ] 返回的 `AgentContext` 包含：conversationId, history, artifacts, currentState

### AC 2: 消息历史加载功能
- [ ] 实现 `loadMessages(): Promise<Message[]>` 从数据库加载指定 `conversationId` 的所有消息
- [ ] 按时间戳升序排序消息历史
- [ ] 包含完整元数据：messageId, sender, receiver, content, timestamp, type, status
- [ ] 支持状态过滤（默认加载所有，可选只加载completed）

### AC 3: 工作产物加载功能
- [ ] 实现 `loadArtifacts(): Promise<Artifact[]>` 从Agent工作目录加载相关文件
- [ ] 支持加载类型：代码(.ts/.js/.py)、文档(.md/.txt)、测试(.test.ts)、日志(.log)
- [ ] 自动识别并分类产物文件（按扩展名、修改时间、文件大小）
- [ ] 大文件处理：文件大小 > 100KB 时只加载元数据和摘要

### AC 4: 状态获取功能
- [ ] 实现 `getCurrentState(): Promise<ConversationState>` 返回会话当前状态
- [ ] 状态枚举：discovered | negotiating | signed | developing | testing | deployed | cancelled | failed | terminated
- [ ] 提供状态转换历史数组（最近10条）
- [ ] 返回会话元数据：projectId, createdAt, updatedAt, lastActivityAt

### AC 5: Agent工作目录管理
- [ ] 实现 `getAgentWorkspace(agentId: string): string` 获取Agent专属工作目录路径
- [ ] 自动创建目录结构：`tinyclaw/workspace/agents/${agentId}/context/`
- [ ] 目录权限设置：755（目录），644（文件）
- [ ] 支持配置文件覆盖默认路径（从 `config/agent-config.ts` 读取）

### AC 6: 上下文持久化与恢复
- [ ] 实现 `saveContext(context: AgentContext): Promise<void>` 将上下文序列化为JSON保存
- [ ] 文件命名：`${workspace}/context/${conversationId}.json`
- [ ] 实现版本控制：每次保存创建备份（保留最近3个版本）
- [ ] 实现灾难恢复：从备份文件恢复上下文
- [ ] 所有文件操作使用 `fs-extra` 异步API

### AC 7: 错误处理与验证
- [ ] 自定义错误类型：`ContextNotFoundError`、`ContextLoadError`、`PermissionDeniedError`
- [ ] 输入验证：conversationId 必须为非空字符串
- [ ] 路径安全检查：防止路径遍历攻击
- [ ] 完整的错误日志记录（使用 Winston logger）

### AC 8: 性能与并发
- [ ] 上下文加载时间 < 500ms（100条消息以内）
- [ ] 支持并发加载（使用 Map 缓存已加载的上下文）
- [ ] 内存优化：大文件内容延迟加载（按需读取）
- [ ] 实现LRU缓存（最大100个上下文实例）

### AC 9: 日志与监控
- [ ] 记录关键操作：上下文加载、保存、删除
- [ ] 日志级别：info（正常）、warn（警告）、error（失败）
- [ ] 记录性能指标：加载时间、文件大小、消息数量
- [ ] 实现基础监控接口：getStats() - 返回缓存命中率、平均加载时间等

### AC 10: 测试覆盖
- [ ] 单元测试：覆盖所有公共方法（覆盖率 ≥ 90%）
- [ ] 集成测试：测试数据库查询、文件系统操作
- [ ] 边界测试：空上下文、超大上下文（1000+消息）、损坏数据
- [ ] 性能测试：并发加载10个上下文

## Tasks / Subtasks

- [ ] **Task 1: 核心架构设计与接口定义** (AC: 1, 7)
  - [ ] 定义 `ConversationContext` 类接口
  - [ ] 设计数据模型：`AgentContext`、`Message`、`Artifact`、`ConversationState`
  - [ ] 定义自定义错误类型
  - [ ] 编写技术设计文档

- [ ] **Task 2: 数据库查询层实现** (AC: 2)
  - [ ] 在 `lib/db.ts` 添加查询辅助方法
  - [ ] 实现 `getMessagesByConversation(conversationId: string)`
  - [ ] 实现消息排序和过滤逻辑
  - [ ] 编写单元测试

- [ ] **Task 3: 工作目录管理工具** (AC: 5)
  - [ ] 创建 `lib/workspace.ts`
  - [ ] 实现 `getAgentWorkspace()` 方法
  - [ ] 实现目录创建和权限设置
  - [ ] 集成配置文件支持

- [ ] **Task 4: ConversationContext 核心实现** (AC: 1, 3, 4)
  - [ ] 创建 `lib/conversation.ts`
  - [ ] 实现构造函数和私有属性
  - [ ] 实现 `loadMessages()`、`loadArtifacts()`、`getCurrentState()` 方法
  - [ ] 编写单元测试

- [ ] **Task 5: 上下文持久化实现** (AC: 6)
  - [ ] 实现 `saveContext()` 方法
  - [ ] 实现版本控制逻辑
  - [ ] 实现灾难恢复机制
  - [ ] 编写集成测试

- [ ] **Task 6: 缓存与性能优化** (AC: 8)
  - [ ] 实现LRU缓存管理器
  - [ ] 实现并发控制（使用WeakMap）
  - [ ] 性能基准测试
  - [ ] 优化大文件处理

- [ ] **Task 7: 错误处理增强** (AC: 7)
  - [ ] 实现所有自定义错误类型
  - [ ] 添加输入验证逻辑
  - [ ] 添加路径安全检查
  - [ ] 完善错误日志

- [ ] **Task 8: 监控与日志** (AC: 9)
  - [ ] 实现操作日志记录
  - [ ] 实现性能指标收集
  - [ ] 实现 `getStats()` 监控接口
  - [ ] 配置Winston日志级别

- [ ] **Task 9: 测试套件** (AC: 10)
  - [ ] 编写所有单元测试（vitest）
  - [ ] 编写集成测试
  - [ ] 编写边界测试
  - [ ] 运行完整测试套件

## Dev Notes

### 架构模式与约束

**设计模式：**
- **单例模式（伪）**：每个 `conversationId` 在缓存中只保留一个实例（WeakMap实现）
- **工厂模式**：`getAgentWorkspace()` 作为工作目录工厂
- **模板方法模式**：`loadContext()` 定义加载流程框架

**核心约束：**
- TypeScript strict 模式（strict: true）
- 所有异步操作使用 async/await
- 文件路径使用 `path.join()` 构建，禁止字符串拼接
- 必须进行输入验证和错误处理

### 项目结构与文件位置

**新增文件：**
```
tinyclaw/src/lib/conversation.ts          # ConversationContext 核心实现
tinyclaw/src/types/context.ts             # 类型定义：AgentContext, Message, Artifact, ConversationState
tinyclaw/src/lib/workspace.ts             # 工作目录管理工具
tinyclaw/src/errors/context-errors.ts     # 自定义错误类型
tinyclaw/src/lib/context-cache.ts         # LRU缓存管理器
tinyclaw/src/services/context-service.ts  # （可选）上下文服务层
```

**修改文件：**
```
tinyclaw/src/lib/db.ts                    # 添加消息查询辅助方法
tinyclaw/src/utils/logger.ts              # 配置上下文相关日志
tinyclaw/src/config/agent-config.ts       # 添加工作目录配置项
```

**数据库变更：**
```sql
-- 不需要新增表，使用现有表
-- 需要确保 conversations 表有完整字段
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'discovered';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP;
```

### 技术栈要求

**核心依赖：**
```json
{
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "fs-extra": "^11.2.0",
    "mkdirp": "^3.0.1",
    "lru-cache": "^10.2.0"  // LRU缓存
  },
  "devDependencies": {
    "@types/node": "^20.11.19",
    "typescript": "^5.3.3",
    "vitest": "^1.3.0"
  }
}
```

**架构决策：**
1. **数据库操作**：使用 `lib/db.ts` 的 `getDatabase()`，使用 prepared statements 防止SQL注入
2. **文件系统**：使用 `fs-extra` 的 Promise API，所有路径操作使用 `path` 模块
3. **日志记录**：使用 Winston，日志文件：`logs/context.log`
4. **错误处理**：所有错误继承自 `ContextError` 基类
5. **配置管理**：默认值硬编码，配置文件可覆盖

### 性能与可扩展性

**性能目标：**
- 上下文加载延迟：95% < 500ms（100条消息）
- 并发支持：至少50个并发上下文操作
- 内存占用：每个上下文实例 < 20MB
- 缓存命中率：目标 ≥ 80%

**扩展性设计：**
- 缓存大小可配置
- 支持自定义加载策略（全量/增量）
- 预留接口支持分布式缓存（未来）

### 安全与合规

**安全要求：**
1. **路径安全**：使用 `path.resolve()` 验证，防止 `../` 攻击
2. **输入验证**：conversationId 必须匹配正则 `/^[a-zA-Z0-9_-]+$/`
3. **权限控制**：工作目录权限 755，文件权限 644
4. **审计日志**：记录所有上下文操作（保留30天）

### 测试标准

**单元测试：**
- 覆盖率：行 ≥ 90%，分支 ≥ 85%
- 测试边界：空conversationId、不存在的conversation、超大文件
- Mock数据库和文件系统

**集成测试：**
- 测试数据库查询
- 测试文件读写
- 测试缓存机制
- 测试错误处理

**性能测试：**
- 并发加载测试（10个上下文）
- 大数据量测试（1000条消息）
- 内存泄漏测试（循环加载100次）

### 相关Epic上下文

**Epic 2b: 后端API与插件系统**
- 这是Epic 2b的第10个故事，专注于上下文管理基础功能
- 前置依赖：2b.7（混合队列）、2b.11（数据库设计）
- 后续故事：2b.11（跨Agent上下文共享）
- 为后续的上下文共享机制打下坚实基础

**与Automaton集成点：**
- 当前阶段不涉及Automaton集成
- 未来可通过API访问上下文

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

### File List

- tinyclaw/src/lib/conversation.ts
- tinyclaw/src/types/context.ts
- tinyclaw/src/lib/workspace.ts
- tinyclaw/src/errors/context-errors.ts
- tinyclaw/src/lib/context-cache.ts
- tinyclaw/src/services/context-service.ts (可选)
- tinyclaw/src/lib/db.ts (修改)
- tinyclaw/src/config/agent-config.ts (修改)
