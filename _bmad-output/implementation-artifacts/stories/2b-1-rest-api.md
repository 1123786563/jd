# Story 2b.1: REST API完整化

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **前端开发者和系统管理员**，
I want **完整的、统一的 REST API 接口**，
so that **TinyOffice 前端可以高效管理 TinyClaw 系统的所有功能，并支持外部集成**。

## Acceptance Criteria

### 核心API端点完整化

1. **智能体管理 API** (Agents)
   - [ ] `GET /api/agents` - 列出所有智能体
   - [ ] `GET /api/agents/:id` - 获取单个智能体详情
   - [ ] `POST /api/agents` - 创建新智能体
   - [ ] `PUT /api/agents/:id` - 更新智能体配置
   - [ ] `DELETE /api/agents/:id` - 删除智能体
   - [ ] 支持分页和过滤参数

2. **团队管理 API** (Teams)
   - [ ] `GET /api/teams` - 列出所有团队
   - [ ] `GET /api/teams/:id` - 获取单个团队详情
   - [ ] `POST /api/teams` - 创建新团队
   - [ ] `PUT /api/teams/:id` - 更新团队配置
   - [ ] `DELETE /api/teams/:id` - 删除团队
   - [ ] 支持按成员或状态过滤

3. **消息管理 API** (Messages)
   - [ ] `GET /api/messages` - 查询消息历史
   - [ ] `POST /api/messages` - 向智能体/团队发送消息
   - [ ] `GET /api/messages/:id` - 获取单条消息详情
   - [ ] `DELETE /api/messages/:id` - 删除消息
   - [ ] 支持按时间范围、渠道、智能体过滤
   - [ ] 支持消息分页

4. **任务追踪 API** (Tasks)
   - [ ] `GET /api/tasks` - 列出所有任务
   - [ ] `GET /api/tasks/:id` - 获取单个任务详情
   - [ ] `POST /api/tasks` - 创建新任务
   - [ ] `PUT /api/tasks/:id` - 更新任务状态
   - [ ] `DELETE /api/tasks/:id` - 删除任务
   - [ ] 支持按状态、分配对象过滤

5. **队列状态 API** (Queue)
   - [ ] `GET /api/queue/status` - 获取队列状态统计
   - [ ] `GET /api/queue/messages` - 获取队列中的消息列表
   - [ ] `POST /api/queue/pause` - 暂停队列处理
   - [ ] `POST /api/queue/resume` - 恢复队列处理
   - [ ] `POST /api/queue/clear` - 清空队列

6. **日志查询 API** (Logs)
   - [ ] `GET /api/logs` - 查询系统日志
   - [ ] `GET /api/logs/:id` - 获取单条日志详情
   - [ ] 支持按级别、时间范围、智能体过滤
   - [ ] 支持日志分页和搜索

7. **配置管理 API** (Settings)
   - [ ] `GET /api/settings` - 获取当前配置
   - [ ] `PUT /api/settings` - 更新配置
   - [ ] `GET /api/settings/channels` - 获取渠道配置
   - [ ] `PUT /api/settings/channels/:id` - 更新特定渠道配置
   - [ ] `GET /api/settings/providers` - 获取 LLM 供应商配置
   - [ ] `PUT /api/settings/providers/:id` - 更新供应商配置

8. **会话管理 API** (Chats)
   - [ ] `GET /api/chats/:agentId` - 获取智能体会话历史
   - [ ] `DELETE /api/chats/:agentId` - 清除会话历史
   - [ ] `GET /api/chats/team/:teamId` - 获取团队会话历史
   - [ ] `DELETE /api/chats/team/:teamId` - 清除团队会话历史
   - [ ] 支持按时间范围查询

9. **系统监控 API** (System)
   - [ ] `GET /api/system/health` - 系统健康检查
   - [ ] `GET /api/system/stats` - 系统统计信息
   - [ ] `GET /api/system/metrics` - 性能指标
   - [ ] `GET /api/system/version` - 系统版本信息

### API设计规范

1. **RESTful 标准**
   - 使用标准 HTTP 方法 (GET/POST/PUT/DELETE)
   - 使用标准状态码 (200, 201, 400, 404, 500)
   - URL 使用复数名词，符合 REST 约定

2. **请求/响应格式**
   - [ ] 所有请求/响应使用 JSON 格式
   - [ ] Content-Type: application/json
   - [ ] 支持统一的错误响应格式
   - [ ] 支持分页响应格式
   - [ ] 支持批量操作

3. **认证与授权**
   - [ ] 实现 API Token 认证机制
   - [ ] 支持 API Key 生成和管理
   - [ ] 前端集成时使用基于 Token 的认证
   - [ ] 外部集成支持 Bearer Token

4. **速率限制**
   - [ ] 实现请求速率限制
   - [ ] 响应头包含速率限制信息
   - [ ] 遵循 Token Bucket 算法
   - [ ] 支持按用户/端点差异化限流

5. **错误处理**
   - [ ] 统一的错误响应格式
   - [ ] 详细的错误信息和错误码
   - [ ] 有意义的错误消息用于前端显示
   - [ ] 支持错误日志记录

6. **分页与过滤**
   - [ ] 标准分页参数: `page`, `pageSize`
   - [ ] 支持过滤参数: `?filter[key]=value`
   - [ ] 支持排序参数: `?sort=field&order=asc/desc`
   - [ ] 响应包含分页元信息

7. **API 文档**
   - [ ] 使用 OpenAPI/Swagger 生成 API 文档
   - [ ] API 文档可访问路径: `/api/docs`
   - [ ] 包含所有端点的详细说明
   - [ ] 包含请求示例和响应示例

### 数据库操作完整性

1. **智能体数据操作**
   - [ ] 支持智能体配置的完整 CRUD
   - [ ] 智能体工作目录自动创建和管理
   - [ ] 支持智能体状态追踪

2. **团队数据操作**
   - [ ] 支持团队配置的完整 CRUD
   - [ ] 支持团队成员管理
   - [ ] 支持团队负责人变更

3. **消息队列操作**
   - [ ] 支持消息的完整生命周期管理
   - [ ] 支持消息状态变更 (pending/processing/completed/failed)
   - [ ] 支持消息批量操作

4. **任务数据操作**
   - [ ] 支持任务的完整生命周期管理
   - [ ] 支持任务状态追踪
   - [ ] 支持任务分配和重新分配

### 前端集成支持

1. **TinyOffice 前端**
   - [ ] 所有前端页面的 API 调用完整实现
   - [ ] 支持实时数据更新 (通过 SSE)
   - [ ] 支持文件上传和下载
   - [ ] 支持 WebSocket 替代方案 (SSE)

2. **API 客户端生成**
   - [ ] 生成 TypeScript API 客户端
   - [ ] 支持前端导入和使用
   - [ ] 包含类型定义

## Tasks / Subtasks

### Phase 1: API 路由基础架构 (预计: 1-2 天)

- [ ] **Task 1.1:** 统一 API 路由组织 (AC: 1, 2)
  - [ ] 创建统一的 API 路由注册机制
  - [ ] 实现 API 路由自动加载
  - [ ] 统一错误处理中间件
  - [ ] 统一日志记录中间件

- [ ] **Task 1.2:** 认证与授权系统 (AC: 3)
  - [ ] 实现 API Token 生成和验证
  - [ ] 创建认证中间件
  - [ ] 实现 API Key 管理端点
  - [ ] 集成 Token 验证到所有路由

- [ ] **Task 1.3:** 速率限制系统 (AC: 4)
  - [ ] 实现 Token Bucket 速率限制器
  - [ ] 创建速率限制中间件
  - [ ] 配置速率限制规则
  - [ ] 实现速率限制响应头

### Phase 2: 智能体与团队 API (预计: 2-3 天)

- [ ] **Task 2.1:** 智能体管理 API (AC: 1)
  - [ ] 实现 `GET /api/agents` 端点
  - [ ] 实现 `GET /api/agents/:id` 端点
  - [ ] 实现 `POST /api/agents` 端点
  - [ ] 实现 `PUT /api/agents/:id` 端点
  - [ ] 实现 `DELETE /api/agents/:id` 端点
  - [ ] 添加分页和过滤支持
  - [ ] 集成智能体工作目录管理

- [ ] **Task 2.2:** 团队管理 API (AC: 2)
  - [ ] 实现 `GET /api/teams` 端点
  - [ ] 实现 `GET /api/teams/:id` 端点
  - [ ] 实现 `POST /api/teams` 端点
  - [ ] 实现 `PUT /api/teams/:id` 端点
  - [ ] 实现 `DELETE /api/teams/:id` 端点
  - [ ] 添加团队成员管理功能
  - [ ] 集成团队配置验证

### Phase 3: 消息与任务 API (预计: 2-3 天)

- [ ] **Task 3.1:** 消息管理 API (AC: 3, 8)
  - [ ] 实现消息查询端点 (分页、过滤)
  - [ ] 实现消息创建端点
  - [ ] 实现消息详情端点
  - [ ] 实现消息删除端点
  - [ ] 集成消息状态管理
  - [ ] 实现消息批量操作

- [ ] **Task 3.2:** 任务追踪 API (AC: 4)
  - [ ] 实现任务列表端点
  - [ ] 实现任务详情端点
  - [ ] 实现任务创建端点
  - [ ] 实现任务更新端点
  - [ ] 实现任务删除端点
  - [ ] 集成任务状态机

- [ ] **Task 3.3:** 队列状态 API (AC: 5)
  - [ ] 实现队列状态查询端点
  - [ ] 实现队列消息列表端点
  - [ ] 实现队列控制端点 (暂停/恢复/清空)
  - [ ] 集成队列统计计算

### Phase 4: 系统管理与监控 API (预计: 1-2 天)

- [ ] **Task 4.1:** 配置管理 API (AC: 7)
  - [ ] 实现配置查询端点
  - [ ] 实现配置更新端点
  - [ ] 实现渠道配置管理
  - [ ] 实现供应商配置管理
  - [ ] 集成配置热重载

- [ ] **Task 4.2:** 日志查询 API (AC: 6)
  - [ ] 实现日志列表端点
  - [ ] 实现日志详情端点
  - [ ] 添加日志过滤功能
  - [ ] 添加日志搜索功能
  - [ ] 集成日志分页

- [ ] **Task 4.3:** 系统监控 API (AC: 9)
  - [ ] 实现健康检查端点
  - [ ] 实现系统统计端点
  - [ ] 实现性能指标端点
  - [ ] 实现版本信息端点
  - [ ] 集成监控数据收集

### Phase 5: API 文档与测试 (预计: 1-2 天)

- [ ] **Task 5.1:** API 文档生成 (AC: 7)
  - [ ] 集成 OpenAPI/Swagger
  - [ ] 为所有端点添加文档注释
  - [ ] 实现 API 文档路由 `/api/docs`
  - [ ] 生成 TypeScript API 客户端
  - [ ] 验证文档完整性

- [ ] **Task 5.2:** API 测试 (AC: 所有)
  - [ ] 编写单元测试
  - [ ] 编写集成测试
  - [ ] 测试认证和授权
  - [ ] 测试速率限制
  - [ ] 测试错误处理
  - [ ] 测试分页和过滤

### Phase 6: 前端集成与验证 (预计: 1-2 天)

- [ ] **Task 6.1:** 前端 API 客户端 (AC: 前端集成)
  - [ ] 生成前端 TypeScript API 客户端
  - [ ] 在 TinyOffice 中集成 API 客户端
  - [ ] 验证所有页面的 API 调用
  - [ ] 实现 SSE 事件监听
  - [ ] 添加 API 错误处理

- [ ] **Task 6.2:** 完整性验证 (AC: 所有)
  - [ ] 验证所有 AC 是否满足
  - [ ] 执行端到端测试
  - [ ] 性能测试和优化
  - [ ] 安全性审查
  - [ ] 文档审查和更新

## Dev Notes

### 架构背景与技术栈

**项目定位：**
- TinyClaw 是一个多团队、多渠道 24/7 AI 助手平台
- 当前已有 Discord/Telegram/WhatsApp/飞书客户端
- TinyOffice 是基于 Next.js 的前端控制面板
- 后端使用 Hono 框架提供 REST API 服务

**技术栈：**
- **后端:** TypeScript + Hono (Web Framework)
- **数据库:** SQLite (better-sqlite3)
- **前端:** Next.js 16 + React 19 + Tailwind CSS 4 + Radix UI
- **部署:** Node.js 环境 (>= 20.0.0)

**当前 API 现状 (基于代码分析):**
```typescript
// 已有端点:
GET /api/agents           - 列出智能体
PUT /api/agents/:id       - 更新/创建智能体
DELETE /api/agents/:id    - 删除智能体

GET /api/teams            - 列出团队
PUT /api/teams/:id        - 更新/创建团队
DELETE /api/teams/:id     - 删除团队

POST /api/messages        - 向智能体/团队发送消息

// 缺失的端点:
GET /api/agents/:id       - 单个智能体详情 ❌
GET /api/teams/:id        - 单个团队详情 ❌
POST /api/agents          - 创建智能体 (当前仅支持 PUT) ❌
POST /api/teams           - 创建团队 (当前仅支持 PUT) ❌
GET /api/messages         - 消息历史查询 ❌
GET /api/tasks            - 任务列表 ❌
GET /api/logs             - 系统日志 ❌
GET /api/settings         - 配置管理 ❌
GET /api/queue/status     - 队列状态 ❌
GET /api/chats/:id        - 会话历史 ❌
GET /api/system/health    - 健康检查 ❌
```

### 关键设计约束

#### 1. RESTful API 设计模式

**标准实践：**
- 使用复数名词表示资源集合
- 使用嵌套路径表示资源关系
- 使用查询参数进行过滤、排序、分页
- 使用标准 HTTP 方法

**示例：**
```
# 列出资源
GET /api/agents
GET /api/teams?status=active

# 获取单个资源
GET /api/agents/agent-id-123
GET /api/teams/team-id-456

# 创建资源
POST /api/agents
POST /api/teams

# 更新资源
PUT /api/agents/agent-id-123 (完整替换)
PATCH /api/agents/agent-id-123 (部分更新)

# 删除资源
DELETE /api/agents/agent-id-123

# 子资源
GET /api/agents/agent-id-123/messages
POST /api/agents/agent-id-123/messages

# 操作
POST /api/queue/pause
POST /api/queue/resume
```

#### 2. 统一的响应格式

**成功响应：**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

**错误响应：**
```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent with ID 'xxx' not found",
    "details": { ... }
  }
}
```

**分页响应：**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### 3. 认证机制设计

**Token 认证：**
```typescript
// 请求头
Authorization: Bearer <api-token>

// API Token 生成
POST /api/auth/tokens
{
  "name": "My Application",
  "expiresIn": "30d" // 可选
}

// 响应
{
  "token": "sk_live_xxx",
  "expiresAt": "2026-04-04T00:00:00Z"
}
```

**Token 管理：**
- 存储在 SQLite 中
- 支持撤销 (revoke)
- 支持过期自动失效
- 支持权限范围 (scopes)

#### 4. 速率限制实现

**Token Bucket 算法：**
```typescript
interface RateLimitConfig {
  requestsPerMinute: number;  // 每分钟请求数
  burst: number;              // 突发请求数
}

// 示例配置
const rateLimits = {
  'default': { requestsPerMinute: 60, burst: 10 },
  'agents': { requestsPerMinute: 120, burst: 20 },
  'messages': { requestsPerMinute: 300, burst: 50 }
};
```

**响应头：**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1234567890
Retry-After: 60
```

#### 5. 错误码规范

```typescript
enum ErrorCode {
  // 通用错误
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // 智能体相关
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_ALREADY_EXISTS = 'AGENT_ALREADY_EXISTS',
  AGENT_CONFIG_INVALID = 'AGENT_CONFIG_INVALID',

  // 团队相关
  TEAM_NOT_FOUND = 'TEAM_NOT_FOUND',
  TEAM_ALREADY_EXISTS = 'TEAM_ALREADY_EXISTS',
  TEAM_MEMBER_NOT_FOUND = 'TEAM_MEMBER_NOT_FOUND',

  // 消息相关
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  QUEUE_FULL = 'QUEUE_FULL',

  // 任务相关
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_STATUS_INVALID = 'TASK_STATUS_INVALID',

  // 配置相关
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_UPDATE_FAILED = 'CONFIG_UPDATE_FAILED'
}
```

### 数据库模式参考

**基于现有架构文档 (architecture-tinyclaw.md)：**

#### Agent State Table
```sql
CREATE TABLE agent_state (
  agent_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  system_prompt TEXT,
  working_dir TEXT,
  config JSON,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### Teams Table
```sql
CREATE TABLE teams (
  team_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader_agent TEXT NOT NULL,
  agents JSON NOT NULL,      -- 智能体 ID 的 JSON 数组
  description TEXT,
  config JSON,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### Queue Messages Table
```sql
CREATE TABLE queue_messages (
  id INTEGER PRIMARY KEY,
  channel TEXT NOT NULL,
  sender TEXT NOT NULL,
  sender_id TEXT,
  message TEXT NOT NULL,
  message_id TEXT UNIQUE,
  agent TEXT,
  conversation_id TEXT,
  from_agent TEXT,
  status TEXT DEFAULT 'pending',
  files TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

#### Tasks Table
```sql
CREATE TABLE tasks (
  task_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  due_date INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);
```

#### Logs Table
```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSON,
  created_at INTEGER DEFAULT (unixepoch())
);
```

### 文件位置与组织

**后端代码位置：**
```
tinyclaw/src/server/
├── index.ts              # API 服务器入口
├── sse.ts                # SSE 事件流
└── routes/
    ├── agents.ts         # 智能体路由
    ├── teams.ts          # 团队路由
    ├── messages.ts       # 消息路由
    ├── tasks.ts          # 任务路由
    ├── queue.ts          # 队列路由
    ├── logs.ts           # 日志路由
    ├── settings.ts       # 配置路由
    ├── chats.ts          # 会话路由
    └── system.ts         # 系统监控路由 (新建)
```

**前端代码位置：**
```
tinyclaw/tinyoffice/
├── app/
│   ├── agents/           # 智能体管理页面
│   ├── teams/            # 团队管理页面
│   ├── tasks/            # 任务追踪页面
│   ├── chat/             # 聊天界面
│   ├── console/          # 系统控制台
│   ├── logs/             # 日志查看器
│   └── settings/         # 配置编辑器
└── lib/
    └── api/              # API 客户端
        ├── client.ts     # API 客户端基础
        ├── agents.ts     # 智能体 API
        ├── teams.ts      # 团队 API
        ├── messages.ts   # 消息 API
        └── ...
```

### 实现注意事项

#### 1. 与现有代码兼容

**现有的 routes/agents.ts：**
- 当前使用 `PUT /api/agents/:id` 同时处理创建和更新
- 需要添加 `POST /api/agents` 和 `GET /api/agents/:id`
- 保留向后兼容性

**现有的 routes/messages.ts：**
- 当前只有 `POST /api/messages` 用于发送消息
- 需要添加 `GET /api/messages` 用于查询历史
- 需要考虑消息查询的性能优化

#### 2. 数据库查询优化

**分页查询：**
```typescript
// 使用 OFFSET/LIMIT
SELECT * FROM agents
ORDER BY created_at DESC
LIMIT :pageSize OFFSET :offset;

// 更优方案：使用游标分页 (cursor-based pagination)
SELECT * FROM messages
WHERE id < :lastId
ORDER BY id DESC
LIMIT :pageSize;
```

**索引优化：**
```sql
-- 为常用查询字段添加索引
CREATE INDEX idx_messages_agent ON queue_messages(agent);
CREATE INDEX idx_messages_status ON queue_messages(status);
CREATE INDEX idx_messages_created ON queue_messages(created_at);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_logs_level ON logs(level);
```

#### 3. 事务与并发

**SQLite WAL 模式：**
- 确保 SQLite 启用 WAL 模式以支持并发读写
- 使用事务保证数据一致性
- 避免长时间持有锁

**示例：**
```typescript
// 使用事务更新消息状态
db.transaction(() => {
  db.prepare(`
    UPDATE queue_messages
    SET status = 'completed', updated_at = unixepoch()
    WHERE id = ?
  `).run(messageId);

  // 其他相关更新
});
```

#### 4. 文件上传处理

**消息中的文件附件：**
```typescript
// 支持文件上传
POST /api/messages
Content-Type: multipart/form-data

{
  "message": "See attached file",
  "agent": "agent-id",
  "files": [binary data]
}
```

**文件存储：**
- 存储在工作目录的 `uploads/` 文件夹
- 数据库中保存文件路径
- 支持文件下载端点
- 实现文件清理策略

#### 5. SSE 事件流

**现有的 SSE 实现 (src/server/sse.ts)：**
```typescript
// 客户端订阅事件
GET /api/events/stream

// 事件类型
event: message_received
data: {"messageId": "...", "agent": "..."}

event: agent_responded
data: {"agentId": "...", "response": "..."}

event: task_updated
data: {"taskId": "...", "status": "completed"}
```

**增强事件类型：**
- 添加队列事件: `queue_message_enqueued`, `queue_message_processed`
- 添加系统事件: `system_health_check`, `system_config_updated`
- 支持事件过滤: `?events=messages,tasks`

#### 6. 配置热重载

**基于现有 config.ts 的热重载：**
```typescript
// 每次请求时重新加载配置
export function getSettings() {
  // 从文件读取最新配置
  return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
}

// API 更新配置时同时写入文件
export function mutateSettings(mutator: (settings: Settings) => void) {
  const settings = getSettings();
  mutator(settings);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  return settings;
}
```

### 参考文档路径

- [architecture-tinyclaw.md](docs/architecture-tinyclaw.md) - TinyClaw 架构指南 (第 166-680 行详细描述 API 设计)
- [integration-architecture.md](docs/integration-architecture.md) - 集成架构 (第 107-222 行描述集成场景)
- [upwork_autopilot_detailed_design.md](docs/upwork_autopilot_detailed_design.md) - 详细设计 (数据库表设计部分)
- [epics.md](docs/epics.md) - Epic 2b 的背景 (第 103-116 行)

### 关键依赖与版本

**Hono 框架：**
```json
{
  "hono": "^4.x.x",       // Web 框架
  "hono/swagger-ui": "^x.x.x" // Swagger UI 集成
}
```

**数据库：**
```json
{
  "better-sqlite3": "^9.x.x"  // SQLite 数据库
}
```

**认证：**
```json
{
  "jsonwebtoken": "^9.x.x",    // JWT 生成
  "bcrypt": "^5.x.x"          // 密码哈希 (如果需要)
}
```

### 测试策略

**单元测试：**
- 测试每个 API 端点的正确性
- 测试边界条件和错误处理
- 测试数据验证逻辑

**集成测试：**
- 测试完整的 API 请求/响应流程
- 测试数据库操作的正确性
- 测试认证和授权机制
- 测试速率限制功能

**端到端测试：**
- 测试前端与后端的集成
- 测试完整的业务流程
- 测试 SSE 事件流

### 部署考虑

**环境变量：**
```bash
# API 配置
API_PORT=3777
API_HOST=0.0.0.0

# 认证配置
API_SECRET_KEY=your-secret-key
API_TOKEN_EXPIRES=30d

# 速率限制
API_RATE_LIMIT=60
API_RATE_LIMIT_BURST=10

# 数据库
DATABASE_PATH=./data/tinyclaw.db
```

**Docker 部署：**
```dockerfile
# tinyclaw/Dockerfile.api
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY dist/ ./dist/
COPY src/server/ ./src/server/
EXPOSE 3777
CMD ["node", "dist/server/index.js"]
```

### 潜在风险与缓解

1. **性能问题**
   - 风险: 大量消息查询导致数据库慢
   - 缓解: 实现分页、添加索引、使用缓存

2. **并发冲突**
   - 风险: 多个请求同时修改同一资源
   - 缓解: 使用数据库事务、实现乐观锁

3. **安全性问题**
   - 风险: 未授权访问、注入攻击
   - 缓解: 实现认证、输入验证、SQL 参数化

4. **API 兼容性**
   - 风险: 破坏现有前端集成
   - 缓解: 保留向后兼容、版本化 API

### Project Structure Notes

#### 代码组织模式

**遵循现有架构模式：**
- 使用 TypeScript 严格类型检查
- 遵循单文件单导出原则
- 使用明确的类型定义 (AgentConfig, TeamConfig 等)
- 遵循功能模块化 (routes, lib, server)

**文件命名规范：**
- 路由文件: `routes/{resource}.ts`
- 类型定义: `lib/types.ts`
- 工具函数: `lib/{utility}.ts`
- 数据库操作: `lib/db.ts`

#### 与现有代码的集成点

**修改现有文件：**
- `src/server/routes/agents.ts` - 添加缺失的端点
- `src/server/routes/teams.ts` - 添加缺失的端点
- `src/server/routes/messages.ts` - 添加查询端点
- `src/server/routes/tasks.ts` - 确保完整性
- `src/server/routes/logs.ts` - 确保完整性
- `src/server/routes/settings.ts` - 确保完整性
- `src/server/routes/chats.ts` - 确保完整性
- `src/server/routes/queue.ts` - 确保完整性

**新增文件：**
- `src/server/routes/system.ts` - 系统监控路由
- `src/server/middleware/auth.ts` - 认证中间件
- `src/server/middleware/rateLimit.ts` - 速率限制中间件
- `src/server/middleware/errorHandler.ts` - 错误处理中间件
- `src/server/utils/pagination.ts` - 分页工具
- `src/lib/api-tokens.ts` - API Token 管理

#### 前端集成

**TinyOffice 集成：**
- 确保所有前端页面 (agents, teams, tasks, chat, logs, settings) 使用新的 API
- 更新 API 客户端调用
- 集成 SSE 事件监听
- 添加 API 错误处理和用户反馈

### References

- [Architecture: docs/architecture-tinyclaw.md#API-Server](docs/architecture-tinyclaw.md) (第 166-236 行)
- [API Endpoints Spec: docs/architecture-tinyclaw.md#API-Endpoints](docs/architecture-tinyclaw.md) (第 178-230 行)
- [Integration Patterns: docs/integration-architecture.md](docs/integration-architecture.md) (第 107-222 行)
- [Database Schema: docs/architecture-tinyclaw.md#Persistence-Layer](docs/architecture-tinyclaw.md) (第 370-473 行)
- [Epic 2b Context: _bmad-output/planning-artifacts/epics.md](docs/epics.md) (第 103-116 行)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 - Full context analysis and story creation

### Debug Log References

N/A - Story creation phase

### Completion Notes List

- ✅ 故事需求已完整提取自 Epic 2b 和架构文档
- ✅ API 端点设计已覆盖所有必需功能
- ✅ 参考了现有代码结构 (agents.ts, teams.ts, messages.ts)
- ✅ 遵循了 RESTful 设计原则和现有架构模式
- ✅ 考虑了与 TinyOffice 前端的集成需求
- ✅ 包含了认证、速率限制、错误处理等关键设计
- ✅ 数据库模式参考了现有架构文档
- ✅ 任务分解为 6 个阶段，共约 8-14 天工作量

### File List

**需要修改的文件：**
- `tinyclaw/src/server/routes/agents.ts`
- `tinyclaw/src/server/routes/teams.ts`
- `tinyclaw/src/server/routes/messages.ts`
- `tinyclaw/src/server/routes/tasks.ts`
- `tinyclaw/src/server/routes/logs.ts`
- `tinyclaw/src/server/routes/settings.ts`
- `tinyclaw/src/server/routes/chats.ts`
- `tinyclaw/src/server/routes/queue.ts`
- `tinyclaw/src/server/index.ts` (注册新路由)

**需要创建的新文件：**
- `tinyclaw/src/server/routes/system.ts`
- `tinyclaw/src/server/middleware/auth.ts`
- `tinyclaw/src/server/middleware/rateLimit.ts`
- `tinyclaw/src/server/middleware/errorHandler.ts`
- `tinyclaw/src/server/middleware/pagination.ts`
- `tinyclaw/src/lib/api-tokens.ts`
- `tinyclaw/src/server/utils/pagination.ts`
- `tinyclaw/tinyoffice/lib/api/client.ts`
- `tinyclaw/tinyoffice/lib/api/agents.ts`
- `tinyclaw/tinyoffice/lib/api/teams.ts`
- `tinyclaw/tinyoffice/lib/api/messages.ts`
- `tinyclaw/tinyoffice/lib/api/tasks.ts`
- `tinyclaw/tinyoffice/lib/api/logs.ts`
- `tinyclaw/tinyoffice/lib/api/settings.ts`
- `tinyclaw/tinyoffice/lib/api/chats.ts`
- `tinyclaw/tinyoffice/lib/api/system.ts`

**测试文件：**
- `tinyclaw/src/server/routes/__tests__/agents.test.ts`
- `tinyclaw/src/server/routes/__tests__/teams.test.ts`
- `tinyclaw/src/server/routes/__tests__/messages.test.ts`
- `tinyclaw/src/server/routes/__tests__/tasks.test.ts`
- `tinyclaw/src/server/routes/__tests__/system.test.ts`
- `tinyclaw/src/server/middleware/__tests__/auth.test.ts`
- `tinyclaw/src/server/middleware/__tests__/rateLimit.test.ts`

**文档文件：**
- `tinyclaw/docs/API.md` (API 使用文档)
- `tinyclaw/openapi.yaml` (OpenAPI 规范)
