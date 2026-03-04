# 故事 1.c.1: 多智能体注册表

**状态:** ready-for-dev

**Epic 编号:** 1c
**故事编号:** 1
**故事标识符:** 1c-1-agent-registry

**创建日期:** 2026-03-04
**最后更新:** 2026-03-04

---

## 故事概述

作为系统架构师，我想要实现一个多智能体注册表，以便统一管理跨 Conway Automaton 和 TinyClaw 的智能体配置和能力，支持智能体的发现、注册和跨项目复用，从而建立一个共享的智能体生态系统。

---

## 用户故事 (User Story)

**As a** 系统架构师和开发者
**I want** 实现一个多智能体注册表系统
**so that** 我可以统一管理跨 Conway Automaton 和 TinyClaw 的智能体，实现智能体配置的共享、发现和跨项目复用

---

## 验收标准 (Acceptance Criteria)

### AC-1: 注册表核心功能

- [ ] 实现 `AgentRegistry` 类，支持智能体的注册、注销和查询
- [ ] 支持智能体元数据存储（ID、名称、描述、能力标签、所属项目）
- [ ] 支持智能体按标签/能力分类和检索
- [ ] 支持智能体版本管理（基础版、高级版等）

### AC-2: 智能体配置标准化

- [ ] 定义统一的智能体配置接口 `AgentConfig`，兼容 Automaton 和 TinyClaw
- [ ] 支持智能体配置的 JSON Schema 验证
- [ ] 支持智能体配置的序列化和反序列化
- [ ] 支持智能体配置的默认值和覆盖机制

### AC-3: 跨项目集成

- [ ] 实现 Automaton 与注册表的集成适配器
- [ ] 实现 TinyClaw 与注册表的集成适配器
- [ ] 支持智能体在两个项目之间的配置同步
- [ ] 支持共享工具库的注册和发现

### AC-4: 持久化存储

- [ ] 使用 SQLite 数据库存储注册表数据
- [ ] 实现 `agents` 表存储智能体元数据
- [ ] 实现 `agent_configs` 表存储智能体配置
- [ ] 实现 `agent_tags` 表存储智能体标签
- [ ] 实现 `agent_versions` 表存储智能体版本历史

### AC-5: 查询和发现

- [ ] 实现按 ID 精确查询
- [ ] 实现按标签/能力模糊查询
- [ ] 实现按项目分类查询
- [ ] 实现按状态（活跃/停用）查询
- [ ] 实现智能体列表分页查询

### AC-6: 安全性

- [ ] 实现智能体注册的权限验证
- [ ] 实现配置修改的审计日志
- [ ] 支持敏感配置的加密存储
- [ ] 遵循项目现有的安全规则（注入防御、策略引擎）

### AC-7: 测试覆盖

- [ ] 实现 100% 的单元测试覆盖率
- [ ] 包含数据库操作的集成测试
- [ ] 包含跨项目适配器的集成测试
- [ ] 包含边界条件和错误处理测试

---

## 任务分解 (Tasks / Subtasks)

### 任务 1: 注册表核心架构 (AC: 1)

- [ ] 1.1 定义 `AgentRegistry` 类接口和方法签名
- [ ] 1.2 实现内存中的智能体注册和查询逻辑
- [ ] 1.3 实现智能体元数据的验证和标准化
- [ ] 1.4 实现智能体标签管理系统
- [ ] 1.5 编写单元测试验证核心功能

### 任务 2: 数据持久化层 (AC: 4)

- [ ] 2.1 设计 `agents`、`agent_configs`、`agent_tags`、`agent_versions` 数据库表结构
- [ ] 2.2 实现数据库迁移脚本 (migration)
- [ ] 2.3 实现数据库访问层 (DAO/Repository)
- [ ] 2.4 实现事务管理确保数据一致性
- [ ] 2.5 编写数据库操作的单元测试和集成测试

### 任务 3: 配置标准化 (AC: 2)

- [ ] 3.1 定义统一的 `AgentConfig` TypeScript 接口
- [ ] 3.2 实现 JSON Schema 验证器
- [ ] 3.3 实现配置序列化/反序列化工具
- [ ] 3.4 实现配置默认值和覆盖逻辑
- [ ] 3.5 编写配置验证的测试用例

### 任务 4: Automaton 适配器 (AC: 3)

- [ ] 4.1 实现 `AutomatonAdapter` 类
- [ ] 4.2 实现 Automaton 智能体到注册表的映射逻辑
- [ ] 4.3 实现从注册表加载智能体配置到 Automaton
- [ ] 4.4 实现 Automaton 智能体状态同步到注册表
- [ ] 4.5 编写 Automaton 适配器的单元测试

### 任务 5: TinyClaw 适配器 (AC: 3)

- [ ] 5.1 实现 `TinyClawAdapter` 类
- [ ] 5.2 实现 TinyClaw 智能体到注册表的映射逻辑
- [ ] 5.3 实现从注册表加载智能体配置到 TinyClaw
- [ ] 5.4 实现 TinyClaw 智能体状态同步到注册表
- [ ] 5.5 编写 TinyClaw 适配器的单元测试

### 任务 6: 查询和发现功能 (AC: 5)

- [ ] 6.1 实现按标签/能力的智能查询
- [ ] 6.2 实现智能体列表的分页和排序
- [ ] 6.3 实现智能体搜索（支持关键词匹配）
- [ ] 6.4 实现智能体相似度匹配（基于标签）
- [ ] 6.5 编写查询功能的测试用例

### 任务 7: 安全性和审计 (AC: 6)

- [ ] 7.1 实现智能体注册的权限控制
- [ ] 7.2 实现配置修改的审计日志系统
- [ ] 7.3 实现敏感字段的加密/解密
- [ ] 7.4 集成现有的注入防御系统
- [ ] 7.5 编写安全性的测试用例

### 任务 8: 完整性测试 (AC: 7)

- [ ] 8.1 编写端到端的集成测试
- [ ] 8.2 验证跨项目智能体共享场景
- [ ] 8.3 验证边界条件和错误处理
- [ ] 8.4 验证性能（查询响应时间、并发注册等）
- [ ] 8.5 生成测试覆盖率报告

---

## 技术要求 (Technical Requirements)

### 1. 技术栈

- **语言**: TypeScript 5.9.3
- **运行时**: Node.js >= 20.0.0
- **数据库**: better-sqlite3 11.0.0
- **测试框架**: Vitest 2.0.0
- **包管理器**:
  - Automaton 部分使用 pnpm
  - TinyClaw 部分使用 npm

### 2. 模块系统

- **Automaton 部分**: ESM (NodeNext) - 导入需带 `.js` 扩展名
- **TinyClaw 部分**: CommonJS - 导入不带扩展名

### 3. 代码组织

```
jd/
├── automaton/
│   └── src/
│       └── registry/               # Automaton 注册表相关
│           ├── index.ts            # 公共导出
│           ├── types.ts            # TypeScript 接口定义
│           ├── agent-registry.ts   # 核心注册表实现
│           ├── adapter.ts          # Automaton 适配器
│           └── __tests__/          # 测试
│
├── tinyclaw/
│   └── src/
│       └── registry/               # TinyClaw 注册表相关
│           ├── index.ts
│           ├── agent-registry.ts
│           ├── adapter.ts          # TinyClaw 适配器
│           └── __tests__/
│
└── shared/                         # 共享代码
    └── registry/                   # 共享的注册表核心逻辑
        ├── types.ts                # 共享的类型定义
        ├── schema/                 # JSON Schema
        │   └── agent-config.json
        └── utils/                  # 工具函数
            ├── validation.ts       # 配置验证
            ├── serialization.ts    # 序列化工具
            └── encryption.ts       # 加密工具
```

### 4. 关键接口定义

```typescript
// AgentConfig - 统一的智能体配置接口
interface AgentConfig {
  id: string;
  name: string;
  description: string;
  provider: string;           // "claude" | "openai" | "zhipu" | "qwen" | "kimi"
  model: string;              // 模型名称
  system_prompt: string;
  capabilities: string[];     // 能力标签
  tags: string[];             // 自定义标签
  working_dir?: string;       // 工作目录
  tools?: ToolConfig[];       // 工具配置
  constraints?: Constraints;  // 约束条件
  metadata?: {
    project: 'automaton' | 'tinyclaw';
    version: string;
    created_at: string;
    updated_at: string;
  };
}

// AgentRegistry - 核心注册表接口
interface AgentRegistry {
  register(agentId: string, config: AgentConfig): Promise<void>;
  unregister(agentId: string): Promise<void>;
  get(agentId: string): Promise<AgentConfig | null>;
  query(options: QueryOptions): Promise<AgentConfig[]>;
  list(options: ListOptions): Promise<{ agents: AgentConfig[], total: number }>;
  update(agentId: string, config: Partial<AgentConfig>): Promise<void>;
  exists(agentId: string): Promise<boolean>;
}

// QueryOptions - 查询选项
interface QueryOptions {
  tags?: string[];
  capabilities?: string[];
  project?: 'automaton' | 'tinyclaw';
  status?: 'active' | 'inactive';
  keyword?: string;
}
```

### 5. 数据库表结构

```sql
-- agents 表：智能体元数据
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project TEXT NOT NULL CHECK(project IN ('automaton', 'tinyclaw')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- agent_configs 表：智能体配置（JSON）
CREATE TABLE agent_configs (
  agent_id TEXT PRIMARY KEY,
  config JSON NOT NULL,
  version TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- agent_tags 表：智能体标签
CREATE TABLE agent_tags (
  agent_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY(agent_id, tag),
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- agent_versions 表：版本历史
CREATE TABLE agent_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  config JSON NOT NULL,
  version TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- 索引优化查询性能
CREATE INDEX idx_agents_project ON agents(project);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agent_tags_tag ON agent_tags(tag);
CREATE INDEX idx_agent_versions_agent ON agent_versions(agent_id);
```

---

## 架构合规性 (Architecture Compliance)

### 1. 遵循现有架构原则

- ✅ **以智能体为中心**: 注册表作为智能体管理的核心枢纽
- ✅ **持久化存储**: 使用 SQLite 保持与现有项目一致
- ✅ **TypeScript 严格模式**: 启用 `strict: true` 和类型安全
- ✅ **模块化设计**: 低耦合、高内聚的模块划分
- ✅ **错误处理**: 所有异步操作使用 try/catch 包装

### 2. 安全要求

- ✅ **输入验证**: 所有外部输入通过 JSON Schema 验证
- ✅ **注入防御**: 集成现有注入防御系统
- ✅ **审计日志**: 所有配置修改记录审计日志
- ✅ **敏感数据**: 加密存储敏感配置字段
- ✅ **权限控制**: 注册和修改操作需要权限验证

### 3. 性能要求

- ✅ **查询优化**: 使用数据库索引优化查询性能
- ✅ **缓存策略**: 支持智能体配置的内存缓存
- ✅ **分页查询**: 大数据集支持分页避免内存溢出
- ✅ **连接池**: 数据库连接池管理

### 4. 可测试性

- ✅ **单元测试**: 所有核心功能 100% 覆盖
- ✅ **集成测试**: 跨模块、跨项目集成测试
- ✅ **Mock 支持**: 使用内存 SQLite 进行数据库测试
- ✅ **测试工具**: 使用现有的 `src/__tests__/mocks.ts`

---

## 文件结构要求 (File Structure Requirements)

### 新增文件列表

```
automaton/src/registry/
├── index.ts                          # 公共导出
├── types.ts                          # TypeScript 接口
├── agent-registry.ts                 # 核心注册表
├── adapter.ts                        # Automaton 适配器
├── database.ts                       # 数据库访问层
└── __tests__/
    ├── agent-registry.test.ts        # 核心测试
    ├── adapter.test.ts               # 适配器测试
    └── database.test.ts              # 数据库测试

tinyclaw/src/registry/
├── index.ts
├── types.ts                          # TinyClaw 特定类型
├── agent-registry.ts
├── adapter.ts                        # TinyClaw 适配器
├── database.ts
└── __tests__/
    ├── agent-registry.test.ts
    ├── adapter.test.ts
    └── database.test.ts

shared/registry/
├── types.ts                          # 共享类型定义
├── schema/
│   └── agent-config.json            # JSON Schema
├── utils/
│   ├── validation.ts                # 验证工具
│   ├── serialization.ts             # 序列化工具
│   ├── encryption.ts                # 加密工具
│   └── __tests__/
│       ├── validation.test.ts
│       ├── serialization.test.ts
│       └── encryption.test.ts
└── migrations/
    └── 001-create-agent-registry.sql # 数据库迁移脚本
```

### 修改文件列表

```
automaton/src/
├── index.ts                          # 添加注册表导出
└── cli/commands/
    └── registry.ts                   # CLI 注册表命令（可选）

tinyclaw/src/
├── index.ts                          # 添加注册表导出
└── cli/commands/
    └── registry.ts                   # CLI 注册表命令（可选）

docs/
└── architecture-agent-registry.md    # 新增注册表架构文档
```

---

## 测试要求 (Testing Requirements)

### 单元测试覆盖

- ✅ `AgentRegistry.register()` - 智能体注册
- ✅ `AgentRegistry.unregister()` - 智能体注销
- ✅ `AgentRegistry.get()` - 智能体查询
- ✅ `AgentRegistry.query()` - 智能体查询（带过滤）
- ✅ `AgentRegistry.update()` - 智能体更新
- ✅ `AgentRegistry.exists()` - 智能体存在性检查
- ✅ 配置验证器 (validation)
- ✅ 序列化/反序列化工具
- ✅ 加密/解密工具

### 集成测试场景

- ✅ 智能体从 Automaton 注册到注册表
- ✅ 智能体从 TinyClaw 注册到注册表
- ✅ 跨项目智能体配置同步
- ✅ 智能体标签查询和过滤
- ✅ 智能体版本历史记录
- ✅ 数据库事务回滚测试
- ✅ 并发注册场景测试

### 性能测试

- ✅ 查询响应时间 < 100ms（1000 个智能体）
- ✅ 注册操作响应时间 < 50ms
- ✅ 支持 100+ 并发查询
- ✅ 内存使用 < 50MB（1000 个智能体）

### 边界条件测试

- ✅ 重复注册同一智能体 ID
- ✅ 查询不存在的智能体
- ✅ 配置验证失败场景
- ✅ 数据库连接失败场景
- ✅ 权限不足场景

---

## 项目上下文参考 (Project Context Reference)

### 技术栈约束

- **Automaton**: ESM 模块系统，导入需带 `.js` 扩展名
- **TinyClaw**: CommonJS 模块系统，导入不带扩展名
- **TypeScript**: 严格模式 (`strict: true`)
- **Node.js**: >= 20.0.0
- **测试**: Vitest 2.0.0

### 相关文档

- [Project Context](./docs/project-context.md) - 项目上下文和技术约束
- [Integration Architecture](./docs/integration-architecture.md) - 集成架构和场景
- [Architecture Automaton](./docs/architecture-automaton.md) - Automaton 架构
- [Architecture TinyClaw](./docs/architecture-tinyclaw.md) - TinyClaw 架构

### 相关代码模块

- `automaton/src/agent/` - Automaton 智能体实现
- `tinyclaw/src/agents/` - TinyClaw 智能体实现
- `automaton/src/memory/` - Automaton 记忆系统
- `tinyclaw/src/state/` - TinyClaw 状态管理
- `automaton/src/tools/` - Automaton 工具系统

### 关键概念参考

- **智能体注册表**: 统一管理智能体配置和能力
- **适配器模式**: 实现跨项目集成
- **共享生态系统**: 支持智能体和工具复用
- **多层记忆**: 参考现有项目的记忆架构
- **策略引擎**: 参考现有的安全策略实现

---

## 实现注意事项 (Implementation Notes)

### 1. 优先级建议

1. **高优先级**: 核心注册表功能、数据库持久化、配置标准化
2. **中优先级**: Automaton/TinyClaw 适配器、查询功能
3. **低优先级**: CLI 命令、高级搜索功能

### 2. 技术难点

- **跨项目类型兼容**: 确保 Automaton 和 TinyClaw 的配置接口兼容
- **数据库迁移**: 现有项目可能需要数据迁移
- **版本冲突**: 处理智能体配置的版本冲突
- **性能优化**: 大数据集下的查询性能

### 3. 最佳实践

- ✅ 使用现有的工具和模式（参考项目中的 `memory` 和 `state` 模块）
- ✅ 遵循现有的代码风格和命名规范
- ✅ 编写清晰的文档和注释
- ✅ 使用现有的日志系统（`StructuredLogger`）
- ✅ 遵循现有的错误处理模式

### 4. 避免的陷阱

- ❌ 不要硬编码智能体配置
- ❌ 不要忽略数据库事务和错误处理
- ❌ 不要使用不安全的 JSON 反序列化
- ❌ 不要忽略类型安全和验证
- ❌ 不要忽略测试覆盖

---

## 完成标准 (Completion Criteria)

### 代码完成

- [ ] 所有新增文件已创建并实现
- [ ] 所有修改文件已更新
- [ ] 代码遵循项目代码风格和规范
- [ ] 所有 TypeScript 类型定义完整
- [ ] 所有公共 API 有清晰的文档注释

### 测试完成

- [ ] 单元测试 100% 覆盖
- [ ] 集成测试覆盖所有场景
- [ ] 边界条件和错误处理测试通过
- [ ] 性能测试满足要求
- [ ] 所有测试在 CI/CD 中通过

### 文档完成

- [ ] 代码内注释清晰完整
- [ ] 架构文档已更新
- [ ] API 文档已生成
- [ ] 使用示例已提供
- [ ] 迁移指南已编写（如有需要）

### 验收完成

- [ ] 所有验收标准 (AC-1 到 AC-7) 已满足
- [ ] 代码审查通过
- [ ] 安全审查通过
- [ ] 性能审查通过
- [ ] 用户验收测试通过

---

## 后续故事依赖 (Dependencies for Future Stories)

- **1.c.2**: 智能体市场界面（依赖本故事的注册表核心功能）
- **1.c.3**: 智能体版本控制和回滚（依赖本故事的版本管理）
- **1.c.4**: 智能体能力推荐系统（依赖本故事的标签和查询功能）
- **2.a.1**: 共享工具库（依赖本故事的注册表和适配器）

---

## 开发者记录 (Dev Agent Record)

### Agent 模型使用

待填写

### 调试日志引用

待填写

### 完成说明列表

待填写

### 文件列表

待填写

---

**故事状态:** ready-for-dev
**优先级:** 高
**估算工时:** 15 人天
**风险等级:** 中
