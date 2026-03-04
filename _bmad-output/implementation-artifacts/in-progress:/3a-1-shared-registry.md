# Story 3a.1: 共享智能体注册表

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a JD platform开发者,
I want 实现一个共享的智能体注册表系统，统一管理Automaton和TinyClaw的智能体信息,
so that 两个子项目能够无缝协作，实现智能体发现、信息同步和跨项目调用.

## Epic Context

**Epic 3a: 智能体生态系统统一**

**目标：** 统一Automaton和TinyClaw的智能体生态系统，实现共享技能库、配置同步和跨项目协作。

**关键成果：**
- 共享的智能体注册表（本Story）
- 统一工具/技能库（@jd/core）
- 智能体配置同步机制
- 跨项目技能市场
- 通用LLM供应商抽象

**业务价值：**
- 代码复用：避免两个项目重复实现相同功能
- 一致性：统一的智能体管理和发现机制
- 可扩展性：为未来多项目协作奠定基础
- 开发效率：减少重复工作，提升开发速度

## Acceptance Criteria

### AC 1: 共享注册表接口定义

**Given** 开发者需要在两个项目间共享智能体信息
**When** 定义共享的注册表接口
**Then**
- [ ] 创建 `@jd/registry` 包，包含智能体注册表的核心接口
- [ ] 定义 `AgentInfo` 接口，包含：
  - `agentId: string` - 全局唯一标识符（格式：`project:agent-type:id`）
  - `name: string` - 智能体名称
  - `description: string` - 智能体描述
  - `project: 'automaton' | 'tinyclaw'` - 所属项目
  - `type: string` - 智能体类型（如：`sales`, `dev`, `qa`, `architect`）
  - `capabilities: string[]` - 能力列表
  - `llmProviders: string[]` - 支持的LLM提供商
  - `endpoint: string` - API端点（如果可远程调用）
  - `status: 'active' | 'inactive' | 'maintenance'` - 状态
  - `version: string` - 版本号
  - `createdAt: string` - 创建时间
  - `updatedAt: string` - 更新时间
- [ ] 定义 `AgentRegistry` 接口，包含方法：
  - `register(agent: AgentInfo): Promise<void>`
  - `unregister(agentId: string): Promise<void>`
  - `getAgent(agentId: string): Promise<AgentInfo | null>`
  - `listAgents(options?: { project?: string, type?: string, status?: string }): Promise<AgentInfo[]>`
  - `updateAgent(agentId: string, updates: Partial<AgentInfo>): Promise<void>`
  - `searchAgents(keyword: string): Promise<AgentInfo[]>`

### AC 2: Automaton注册表适配

**Given** Automaton已有基于ERC-8004的链上注册表
**When** 将其适配到共享注册表接口
**Then**
- [ ] 创建 `automaton/src/registry/shared-adapter.ts`
- [ ] 实现 `AgentRegistry` 接口，适配现有的 `erc8004.ts` 和 `discovery.ts`
- [ ] 将链上注册的智能体信息映射到 `AgentInfo` 格式
- [ ] 支持将Automaton智能体信息同步到共享注册表
- [ ] 在 `automaton/src/index.ts` 中导出共享适配器
- [ ] 添加配置选项控制是否启用共享注册表同步

### AC 3: TinyClaw注册表实现

**Given** TinyClaw目前使用SQLite存储智能体配置
**When** 实现基于共享接口的注册表
**Then**
- [ ] 创建 `tinyclaw/src/lib/registry/` 目录
- [ ] 实现 `AgentRegistry` 接口，基于SQLite存储
- [ ] 创建数据库表 `shared_agents`，包含 `AgentInfo` 所有字段
- [ ] 支持从现有 `agent_configs` 表迁移数据
- [ ] 实现智能体注册、查询、更新、删除功能
- [ ] 添加索引优化：`project`, `type`, `status`, `agentId`
- [ ] 在 `tinyclaw/src/lib/index.ts` 中导出注册表实例

### AC 4: 跨项目发现机制

**Given** 两个项目需要发现对方的智能体
**When** 实现跨项目智能体发现
**Then**
- [ ] 创建共享的发现服务 `@jd/registry/discovery`
- [ ] 实现HTTP API用于跨项目查询：
  - `GET /api/agents` - 列出所有智能体
  - `GET /api/agents/:id` - 获取单个智能体详情
  - `GET /api/agents/search?q=keyword` - 搜索智能体
- [ ] Automaton添加HTTP服务器暴露注册表（可选，通过配置开关）
- [ ] TinyClaw添加HTTP客户端调用Automaton注册表
- [ ] 实现缓存机制，减少跨项目查询频率
- [ ] 添加健康检查端点 `GET /api/health`

### AC 5: 配置同步机制

**Given** 需要在两个项目间保持智能体配置一致性
**When** 实现配置同步
**Then**
- [ ] 创建同步服务 `@jd/registry/sync`
- [ ] 实现定时同步任务（默认30秒间隔，可配置）
- [ ] 支持增量同步（基于 `updatedAt` 时间戳）
- [ ] 实现冲突解决策略（最新更新优先）
- [ ] 添加同步日志记录
- [ ] 支持手动触发同步

### AC 6: 测试覆盖

**Given** 需要确保注册表功能正确
**When** 编写单元测试和集成测试
**Then**
- [ ] Automaton适配器单元测试（覆盖率≥80%）
- [ ] TinyClaw注册表单元测试（覆盖率≥80%）
- [ ] 跨项目发现集成测试
- [ ] 配置同步集成测试
- [ ] 边界条件测试（并发注册、冲突处理）
- [ ] 性能测试（1000+智能体查询）

### AC 7: 文档

**Given** 开发者需要了解如何使用共享注册表
**When** 编写完整文档
**Then**
- [ ] 创建 `docs/shared-registry/README.md`
- [ ] 包含架构设计图（Mermaid格式）
- [ ] 接口使用示例
- [ ] 配置说明
- [ ] 故障排查指南
- [ ] 更新 `docs/architecture-automaton.md` 和 `docs/architecture-tinyclaw.md`

## Tasks / Subtasks

### Task 1: 设计和接口定义 (AC: 1)
- [ ] 创建 `@jd/registry` 包结构
- [ ] 定义 TypeScript 接口
- [ ] 设计数据库表结构
- [ ] 创建架构设计图

### Task 2: Automaton 适配器实现 (AC: 2)
- [ ] 创建 `shared-adapter.ts`
- [ ] 实现注册表接口
- [ ] 添加配置选项
- [ ] 更新导出

### Task 3: TinyClaw 注册表实现 (AC: 3)
- [ ] 创建注册表服务
- [ ] 实现数据库操作
- [ ] 数据迁移逻辑
- [ ] 索引优化

### Task 4: 跨项目发现 (AC: 4)
- [ ] 创建发现服务
- [ ] 实现HTTP API
- [ ] 添加缓存机制
- [ ] 健康检查

### Task 5: 配置同步 (AC: 5)
- [ ] 创建同步服务
- [ ] 实现定时任务
- [ ] 冲突解决
- [ ] 日志记录

### Task 6: 测试 (AC: 6)
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试

### Task 7: 文档 (AC: 7)
- [ ] 架构文档
- [ ] 使用指南
- [ ] 配置说明

## Dev Notes

### 现有代码分析

#### Automaton 现有注册表 (`automaton/src/registry/`)
- **`erc8004.ts`**: 链上注册（ERC-8004 NFT），包含注册、更新、查询功能
  - 关键方法：`registerAgent()`, `updateAgentURI()`, `queryAgent()`
  - 数据结构：`RegistryEntry` (agentId, agentURI, chain, contractAddress, txHash)
- **`discovery.ts`**: 智能体发现，从链上查询并获取agent card
  - 关键方法：`discoverAgents()`, `fetchAgentCard()`, `searchAgents()`
  - 数据结构：`DiscoveredAgent` (agentId, owner, agentURI, name, description)
- **`agent-card.ts`**: 生成和托管agent card（JSON描述文档）
  - 关键方法：`generateAgentCard()`, `hostAgentCard()`
  - 数据结构：`AgentCard` (type, name, description, services, x402Support, active)

#### TinyClaw 现有智能体配置 (`tinyclaw/src/lib/`)
- **`agent-configs.ts`**: 智能体配置管理（基于SQLite）
  - 存储在 `agent_configs` 表
  - 字段：id, name, role, model, systemPrompt, temperature
- **`agents.ts`**: 智能体实例管理
  - 基于配置创建LLM实例
  - 支持多模型提供商（OpenAI, Groq, Together, 智普, 通义, Kimi）

### 技术架构决策

#### 1. 共享包结构 (`@jd/registry`)
```
@jd/registry/
├── package.json
├── tsconfig.json
├── src/
│   ├── types.ts          # AgentInfo, AgentRegistry 接口
│   ├── index.ts          # 主导出
│   ├── discovery/        # 跨项目发现
│   │   ├── service.ts
│   │   ├── api.ts
│   │   └── cache.ts
│   └── sync/            # 配置同步
│       ├── service.ts
│       └── strategy.ts
└── README.md
```

#### 2. 数据库表设计

**Automaton 链上数据映射：**
- `agentId` = ERC-8004 NFT tokenId
- `name` = AgentCard.name
- `description` = AgentCard.description
- `project` = 'automaton'
- `endpoint` = AgentCard.services[0].endpoint
- `status` = AgentCard.active ? 'active' : 'inactive'

**TinyClaw 数据库表 (`shared_agents`):**
```sql
CREATE TABLE shared_agents (
  agent_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project TEXT NOT NULL CHECK(project IN ('automaton', 'tinyclaw')),
  type TEXT NOT NULL,
  capabilities TEXT, -- JSON array
  llm_providers TEXT, -- JSON array
  endpoint TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'maintenance')),
  version TEXT DEFAULT '1.0.0',
  metadata TEXT, -- JSON object for extensibility
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shared_agents_project ON shared_agents(project);
CREATE INDEX idx_shared_agents_type ON shared_agents(type);
CREATE INDEX idx_shared_agents_status ON shared_agents(status);
CREATE INDEX idx_shared_agents_updated_at ON shared_agents(updated_at);
```

#### 3. 跨项目通信模式

**方案选择：HTTP REST API**
- 理由：简单、通用、易于调试
- Automaton作为可选服务（配置开关控制）
- TinyClaw主动拉取 + 增量同步

**备选方案：WebSocket / gRPC**
- 考虑未来如果需要实时推送，可升级到WebSocket
- gRPC性能更好但复杂度高，当前不需要

#### 4. 缓存策略

**两级缓存：**
1. **内存缓存（LRU）**: 最近查询的智能体信息，TTL 5分钟
2. **本地数据库**: 完整的智能体列表，定期同步

**缓存失效：**
- 基于 `updatedAt` 时间戳
- 手动触发强制刷新
- 配置变更时自动清除

### 项目结构对齐

#### Automaton 更新路径
```
automaton/
├── src/
│   ├── registry/
│   │   ├── shared-adapter.ts    # NEW: 共享注册表适配器
│   │   ├── ecr8004.ts            # 现有
│   │   ├── discovery.ts          # 现有
│   │   └── agent-card.ts         # 现有
│   └── index.ts                  # 添加共享适配器导出
└── package.json                  # 添加 @jd/registry 依赖
```

#### TinyClaw 更新路径
```
tinyclaw/
├── src/
│   ├── lib/
│   │   ├── registry/             # NEW: 注册表实现
│   │   │   ├── service.ts
│   │   │   ├── database.ts
│   │   │   └── sync.ts
│   │   ├── agent-configs.ts      # 现有（保持兼容）
│   │   └── index.ts              # 添加注册表导出
│   └── server/
│       └── api.ts                # 添加注册表API路由
└── package.json                  # 添加 @jd/registry 依赖
```

### 测试策略

#### 单元测试
- **Automaton适配器**: 测试链上数据到AgentInfo的映射
- **TinyClaw注册表**: 测试CRUD操作和查询过滤
- **发现服务**: 测试搜索和过滤逻辑
- **同步服务**: 测试冲突解决和增量同步

#### 集成测试
- **跨项目查询**: Automaton → TinyClaw, TinyClaw → Automaton
- **配置同步**: 修改一个项目，验证另一个项目同步
- **并发场景**: 多个智能体同时注册/更新

#### 性能测试
- 1000个智能体的查询响应时间 < 100ms
- 100个并发查询的吞吐量
- 内存使用监控

### 安全考虑

1. **SSRF防护**: 跨项目HTTP调用需验证URL，防止内部网络访问
   - 参考 `automaton/src/registry/discovery.ts` 中的 `isAllowedUri()`

2. **数据验证**: 所有注册的智能体信息需严格验证
   - 参考 `discovery.ts` 中的 `validateAgentCard()`
   - 限制字段长度、类型、格式

3. **权限控制**:
   - 只读访问：公开查询
   - 写入访问：需要认证（未来扩展）

4. **注入防护**:
   - SQL查询使用预处理语句
   - JSON序列化防止原型污染

### 性能优化

1. **批量操作**: 支持批量注册、批量查询
2. **分页查询**: 列表查询支持分页（limit/offset）
3. **索引优化**: 关键字段建立索引
4. **缓存命中**: 优先从缓存读取
5. **异步同步**: 配置同步在后台异步执行

### 部署考虑

1. **向后兼容**: 保持现有Automaton链上注册功能
2. **渐进式迁移**: 可选择性启用共享注册表
3. **配置开关**: 通过环境变量控制功能开关
4. **健康检查**: 提供端点检查服务状态

### 可能的陷阱

1. **数据一致性**: 两个项目的智能体信息可能不一致
   - 解决方案：实现强一致性同步机制，冲突时人工介入

2. **网络分区**: 跨项目API调用失败
   - 解决方案：重试机制 + 本地缓存降级

3. **性能瓶颈**: 大量智能体查询
   - 解决方案：分页 + 缓存 + 索引

4. **版本兼容**: 两个项目版本不一致
   - 解决方案：API版本控制，向后兼容

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (qwen3-max-2026-01-23)

### Debug Log References

### Completion Notes List

### File List

**新增文件:**
- `@jd/registry/package.json`
- `@jd/registry/tsconfig.json`
- `@jd/registry/src/types.ts`
- `@jd/registry/src/index.ts`
- `@jd/registry/src/discovery/service.ts`
- `@jd/registry/src/discovery/api.ts`
- `@jd/registry/src/discovery/cache.ts`
- `@jd/registry/src/sync/service.ts`
- `@jd/registry/src/sync/strategy.ts`
- `@jd/registry/README.md`
- `automaton/src/registry/shared-adapter.ts`
- `tinyclaw/src/lib/registry/service.ts`
- `tinyclaw/src/lib/registry/database.ts`
- `tinyclaw/src/lib/registry/sync.ts`
- `docs/shared-registry/README.md`
- `docs/shared-registry/architecture.md`

**修改文件:**
- `automaton/src/index.ts` - 导出共享适配器
- `automaton/package.json` - 添加 @jd/registry 依赖
- `tinyclaw/src/lib/index.ts` - 导出注册表
- `tinyclaw/src/server/api.ts` - 添加注册表API路由
- `tinyclaw/package.json` - 添加 @jd/registry 依赖
- `docs/architecture-automaton.md` - 更新架构文档
- `docs/architecture-tinyclaw.md` - 更新架构文档

---

**Story Status Update:**
- **Previous Status:** backlog
- **Current Status:** ready-for-dev
- **Updated At:** 2026-03-04
- **Updated By:** BMAD create-story workflow
- **Note:** Comprehensive context analysis completed. Developer has all required information for flawless implementation.
