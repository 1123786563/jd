# Story 2a.1: Agent管理页面完善 (CRUD + 状态监控)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **TinyClaw administrator**,
I want **a comprehensive agent management interface with CRUD operations and real-time status monitoring**,
so that **I can efficiently manage AI agents, monitor their health, and quickly identify issues**.

## Acceptance Criteria

1. ✅ **Agent列表展示** - Display all configured agents in a responsive grid with essential information
   - Agent avatar/icon (first 2 letters of name)
   - Agent ID and display name
   - Provider and model badges
   - Working directory
   - System prompt snippet
   - Prompt file path (if configured)

2. ✅ **Create Agent** - Add new agent with form validation
   - Agent ID (required, lowercase, no spaces, immutable after creation)
   - Display name (required)
   - Provider selection (required): anthropic, openai, opencode, zhipu, kimi, qwen, etc.
   - Model (required, context-sensitive placeholder based on provider)
   - Working directory (optional, defaults to workspace path)
   - System prompt (optional, textarea)
   - Prompt file path (optional)
   - Auto-provision workspace on creation (.claude/, AGENTS.md, skills, etc.)

3. ✅ **Edit Agent** - Modify existing agent configuration
   - All fields editable except Agent ID (immutable)
   - Form pre-populated with current values
   - Cancel button to discard changes
   - Validation on save (name, provider, model required)

4. ✅ **Delete Agent** - Remove agent with confirmation
   - Confirmation dialog before deletion
   - Visual delete button with trash icon
   - Show "Are you sure?" confirmation with "Delete" and "No" options
   - Delete from settings and update UI

5. ✅ **Real-time Status Monitoring** - Display agent health and activity
   - Status indicator: Active (🟢), Idle (🟡), Error (🔴), Unknown (⚪)
   - Last activity timestamp (timeAgo format)
   - Current workload: messages processing, queue position
   - Heartbeat status (if configured)
   - Error count (if applicable)

6. ✅ **Agent Statistics Dashboard** - Show aggregate metrics
   - Total agents count
   - Active vs idle agents
   - Messages processed (lifetime)
   - Average response time
   - Error rate percentage

7. ✅ **Search and Filter** - Find agents quickly
   - Search by Agent ID or name
   - Filter by provider
   - Filter by status (active/idle/error)
   - Sort by name, last activity, or status

8. ✅ **Bulk Actions** - Manage multiple agents efficiently
   - Select multiple agents
   - Bulk delete (with confirmation)
   - Bulk status update (if applicable)

## Tasks / Subtasks

- [ ] **Task 1: Backend API Enhancement** (AC: 1,2,3,4)
  - [ ] Subtask 1.1: Add agent status endpoint `/api/agents/:id/status`
  - [ ] Subtask 1.2: Add agent statistics endpoint `/api/agents/stats`
  - [ ] Subtask 1.3: Add heartbeat tracking to agent_state table
  - [ ] Subtask 1.4: Update provisionAgentWorkspace to track provisioning status
  - [ ] Subtask 1.5: Add agent activity logging and metrics collection

- [ ] **Task 2: Frontend Agent Status Display** (AC: 5)
  - [ ] Subtask 2.1: Add status indicator component (Active/Idle/Error/Unknown)
  - [ ] Subtask 2.2: Add last activity timestamp display
  - [ ] Subtask 2.3: Add workload indicator (messages in queue)
  - [ ] Subtask 2.4: Add heartbeat status badge
  - [ ] Subtask 2.5: Add error count display

- [ ] **Task 3: Agent Statistics Dashboard** (AC: 6)
  - [ ] Subtask 3.1: Create statistics card components
  - [ ] Subtask 3.2: Implement total agents count
  - [ ] Subtask 3.3: Implement active/idle status breakdown
  - [ ] Subtask 3.4: Add messages processed counter
  - [ ] Subtask 3.5: Add average response time metric
  - [ ] Subtask 3.6: Add error rate percentage

- [ ] **Task 4: Search and Filter UI** (AC: 7)
  - [ ] Subtask 4.1: Add search input with debounced filtering
  - [ ] Subtask 4.2: Add provider filter dropdown
  - [ ] Subtask 4.3: Add status filter dropdown
  - [ ] Subtask 4.4: Add sorting controls (name, activity, status)
  - [ ] Subtask 4.5: Update agent grid to respect filters and sorting

- [ ] **Task 5: Bulk Actions UI** (AC: 8)
  - [ ] Subtask 5.1: Add checkbox selection to agent cards
  - [ ] Subtask 5.2: Add bulk delete button (enabled when selected)
  - [ ] Subtask 5.3: Add bulk delete confirmation dialog
  - [ ] Subtask 5.4: Implement selection state management

- [ ] **Task 6: Integration and Testing**
  - [ ] Subtask 6.1: Test agent creation with workspace provisioning
  - [ ] Subtask 6.2: Test agent editing and validation
  - [ ] Subtask 6.3: Test agent deletion with confirmation
  - [ ] Subtask 6.4: Test status monitoring updates
  - [ ] Subtask 6.5: Test search and filter functionality
  - [ ] Subtask 6.6: Test bulk actions

## Dev Notes

### Backend Architecture (tinyclaw/src/server/routes/agents.ts)

**现有代码结构：**
```typescript
// 当前实现：CRUD 基础功能
- GET /api/agents - 列出所有agents
- PUT /api/agents/:id - 创建/更新agent (包含workspace provisioning)
- DELETE /api/agents/:id - 删除agent

// 需要新增：
- GET /api/agents/:id/status - 返回agent实时状态
- GET /api/agents/stats - 返回统计数据
- POST /api/agents/:id/heartbeat - 接收心跳
- GET /api/agents/stats/provider - 按provider统计
```

**数据库表结构：**
根据 `tinyclaw/src/lib/db.ts` 和 `architecture-tinyclaw.md`:

**新增表 1: agent_heartbeat**
```sql
CREATE TABLE IF NOT EXISTS agent_heartbeat (
  agent_id TEXT PRIMARY KEY,
  last_heartbeat INTEGER NOT NULL,  -- Unix timestamp
  status TEXT DEFAULT 'unknown',    -- active, idle, error, unknown
  error_count INTEGER DEFAULT 0,
  messages_processed INTEGER DEFAULT 0,
  response_time_total INTEGER DEFAULT 0,  -- 累计响应时间（毫秒）
  response_time_count INTEGER DEFAULT 0,  -- 响应次数
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_agent_heartbeat_status ON agent_heartbeat(status);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeat_last_heartbeat ON agent_heartbeat(last_heartbeat);
```

**新增表 2: agent_activity_log (用于历史统计和错误追踪)**
```sql
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,  -- message_processed, error, heartbeat, status_change
  timestamp INTEGER NOT NULL,
  metadata JSON,                -- 错误详情、响应时间等
  FOREIGN KEY (agent_id) REFERENCES agent_heartbeat(agent_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_log_agent_timestamp
  ON agent_activity_log(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON agent_activity_log(activity_type);
```

**修改表: queue_messages (添加索引优化查询)**
```sql
-- 为agent workload查询添加索引
CREATE INDEX IF NOT EXISTS idx_queue_messages_agent_status
  ON messages(agent, status);
```

**数据来源说明：**
- **工作负载 (messages_processing):** 查询 `messages` 表 `WHERE agent=? AND status='processing'`
- **消息处理统计 (messages_processed):** 从 `agent_heartbeat.messages_processed` 累计
- **平均响应时间:** `agent_heartbeat.response_time_total / response_time_count`
- **错误统计:** 从 `agent_heartbeat.error_count` 和 `agent_activity_log` (activity_type='error')

**API端点签名：**

```typescript
// GET /api/agents/:id/status
// 响应:
interface AgentStatus {
  agent_id: string;
  status: "active" | "idle" | "error" | "unknown";
  last_heartbeat: number;  // Unix timestamp
  last_activity: number;   // Unix timestamp
  messages_processing: number;  // 当前正在处理的消息数
  messages_processed_total: number;  // 总处理消息数
  error_count: number;
  average_response_time_ms: number;  // 平均响应时间（毫秒）
  uptime_seconds: number;  // 持续运行时间
  last_error?: string;     // 最近的错误信息（如果有）
}

// GET /api/agents/stats
// 响应:
interface AgentsStats {
  total_agents: number;
  active_agents: number;
  idle_agents: number;
  error_agents: number;
  unknown_agents: number;
  messages_processed_total: number;
  average_response_time_ms: number;
  error_rate_percentage: number;  // (error_count / messages_processed_total) * 100
  by_provider: Record<string, {
    count: number;
    active: number;
    messages_processed: number;
    average_response_time: number;
  }>;
}

// POST /api/agents/:id/heartbeat
// 请求:
interface HeartbeatRequest {
  status: "active" | "idle" | "error";
  error_message?: string;  // 仅当status='error'时
  response_time_ms?: number;  // 本次响应时间
}
// 响应: { ok: boolean }

// GET /api/agents/stats/provider
// 响应: Record<string, AgentsStats>  // 按provider分组的统计
```

**Agent更新心跳的时机：**
1. 队列处理器认领消息时 (claimNextMessage)
2. 消息处理完成时 (completeMessage)
3. 消息处理失败时 (failMessage)
4. 定时心跳 (每30秒，通过守护进程)

### Frontend Architecture (tinyclaw/tinyoffice/src/app/agents/page.tsx)

**当前实现：**
- ✅ Agent卡片网格布局
- ✅ 创建/编辑表单（包含provider和model选择）
- ✅ 删除功能（带确认）
- ✅ 表单验证（ID、name、provider、model 必填）
- ✅ Provider特定的model占位符
- ✅ Workspace自动配置

**需要新增：**
- 状态指示器组件
- 统计信息面板
- 搜索和过滤功能
- 批量操作支持
- 实时状态更新（通过SSE或轮询）

**页面布局设计：**

```
┌─────────────────────────────────────────────────────────────┐
│  Agents Management                                          │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [SearchFilterBar]                                     │ │
│  │ ┌──────┬─────────────┬──────────┬──────────────────┐ │ │
│  │ │🔍    │ Provider:   │ Status:  │ Sort: ▼         │ │ │
│  │ │input │ [All ▼]     │ [All ▼]  │ [Name ▼]        │ │ │
│  │ └──────┴─────────────┴──────────┴──────────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  [StatsDashboard]                                           │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────────┐   │
│  │  Total  │ Active  │  Idle   │ Errors  │ Avg Response│   │
│  │   15    │    8    │    5    │    2    │   1.2s      │   │
│  └─────────┴─────────┴─────────┴─────────┴─────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  [Agent Grid]                                               │
│  ┌──────────┬──────────┬──────────┬──────────┐             │
│  │ ☑ Agent1 │ ☑ Agent2 │ ☑ Agent3 │ ☑ Agent4 │             │
│  │  🟢 John │  🔴 Coder│  🟡 Supp │  ⚪ Admin │             │
│  │ Anthropic│ OpenAI   │ Zhipu    │ Kimi     │             │
│  │  opus    │ gpt-5.3  │ glm-4    │ moonshot │             │
│  │ 2m ago   │ Error!   │ 5h ago   │ -        │             │
│  │ [Edit]   │ [Edit]   │ [Edit]   │ [Edit]   │             │
│  │ [Delete] │ [Delete] │ [Delete] │ [Delete] │             │
│  └──────────┴──────────┴──────────┴──────────┘             │
│  [Bulk Actions Bar]                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 2 agents selected  [Delete Selected]  [Cancel]      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**组件层级结构：**

```typescript
AgentsPage
├── SearchFilterBar
│   ├── SearchInput (带防抖)
│   ├── ProviderFilter (下拉选择)
│   ├── StatusFilter (下拉选择: All/Active/Idle/Error)
│   └── SortControls (下拉选择: Name/Last Activity/Status)
│
├── StatsDashboard
│   ├── StatCard (x5)
│   │   ├── Total Agents
│   │   ├── Active Agents
│   │   ├── Idle Agents
│   │   ├── Error Agents
│   │   └── Average Response Time
│   └── ProviderBreakdown (可选)
│
├── AgentGrid
│   ├── AgentCard (重复)
│   │   ├── Checkbox (批量选择)
│   │   ├── StatusIndicator (🟢🟡🔴⚪)
│   │   ├── AgentAvatar (首字母)
│   │   ├── AgentName & ID
│   │   ├── ProviderBadge + ModelBadge
│   │   ├── LastActivity (timeAgo)
│   │   ├── ErrorMessage (如果有错误)
│   │   ├── EditButton
│   │   └── DeleteButton (带确认)
│   └── EmptyState (无agent时显示)
│
└── BulkActionsBar (仅当选中时显示)
    ├── SelectedCount
    ├── DeleteSelectedButton
    └── CancelSelectionButton
```

**状态管理方案：**

```typescript
interface AgentsPageState {
  // 数据状态
  agents: Record<string, AgentConfig> | null;
  loading: boolean;
  error: string | null;

  // 过滤和排序状态
  searchTerm: string;
  providerFilter: string | null;  // null = All
  statusFilter: AgentStatus | null;  // null = All
  sortBy: 'name' | 'activity' | 'status';
  sortDirection: 'asc' | 'desc';

  // 编辑状态
  editing: FormData | null;
  isNew: boolean;

  // 选择状态（批量操作）
  selectedAgentIds: Set<string>;

  // UI状态
  showBulkActions: boolean;
  deletingId: string | null;
}
```

### 关键技术栈

**后端：**
- Hono (v4.12.1) - API服务器框架
- TypeScript (v5.9.3)
- 模块系统: CommonJS
- better-sqlite3 (v12.6.2) - 数据库
- fs (Node.js) - 文件系统操作

**前端：**
- Next.js 16 (App Router) - React框架
- React 19.2.3 - UI库
- Tailwind CSS 4 - 样式
- Radix UI 1.4.3 - 组件库
- lucide-react - 图标库

### 状态监控实现方案

**方案1: 基于心跳文件**
- 每个agent的working directory包含 `heartbeat.md`
- 定期更新文件内容和时间戳
- API读取文件时间戳判断活跃状态
- 优点：简单，无需额外数据库
- 缺点：文件I/O开销

**方案2: 基于数据库**
- 添加 `heartbeat` 表：`agent_id`, `last_heartbeat`, `status`
- Agent定期发送POST到 `/api/agents/:id/heartbeat`
- API查询最新心跳判断状态
- 优点：可扩展，支持历史记录
- 缺点：需要数据库迁移

**推荐方案：方案2**（与项目架构一致）

### 统计数据收集

**需要追踪的指标：**
1. **消息处理统计**
   - `messages_processed` - 总处理消息数
   - `response_time_avg` - 平均响应时间（毫秒）
   - `error_count` - 错误次数
   - `last_activity` - 最后活动时间戳

2. **存储位置**
   - 内存缓存（短期统计）
   - SQLite表（长期统计）
   - 定期刷新到持久化存储

### 文件结构要求

**新增文件位置：**
```
tinyclaw/src/server/routes/
├── agents.ts (修改 - 添加新endpoint)
├── heartbeat.ts (新增 - 心跳接收)
└── agent-stats.ts (新增 - 统计数据)

tinyclaw/src/lib/
└── agent-monitoring.ts (新增 - Agent监控和统计逻辑)

tinyclaw/tinyoffice/src/app/agents/
├── page.tsx (修改 - 添加状态监控、统计、搜索过滤)
└── components/
    ├── StatusIndicator.tsx (新增 - 状态指示器组件)
    ├── StatsDashboard.tsx (新增 - 统计面板组件)
    ├── SearchFilterBar.tsx (新增 - 搜索过滤栏)
    ├── AgentCard.tsx (修改 - 添加状态指示器和复选框)
    ├── BulkActionsBar.tsx (新增 - 批量操作栏)
    └── StatCard.tsx (新增 - 统计卡片组件)

tinyclaw/tinyoffice/src/lib/
├── api.ts (修改 - 添加新API调用)
└── time-ago.ts (新增或修改 - 时间格式化工具)
```

### 错误处理和降级方案

**1. API调用失败处理**

```typescript
// 前端错误处理策略
- 状态监控API失败: 显示 "Unknown" 状态(⚪) + 提示 "Status unavailable"
- 统计API失败: 显示 "N/A" 或 "Loading..." + 不阻塞Agent列表
- 搜索过滤失败: 显示原始列表 + 提示 "Filtering temporarily unavailable"
- Agent列表加载失败: 显示错误横幅 + 重试按钮

// 后端错误处理
- 数据库查询失败: 返回500错误 + 详细错误日志
- 心跳数据无效: 返回400错误 + 验证错误信息
- Agent不存在: 返回404错误
```

**2. 数据不可用降级**

```typescript
// 无心跳数据
status = "unknown";
lastActivity = null;
messagesProcessing = 0;

// 无统计数据
totalAgents = Object.keys(agents).length;  // 回退到配置文件计数
averageResponseTime = "N/A";
errorRate = "N/A";

// 无工作负载数据
messagesProcessing = "N/A";
```

**3. 网络离线降级**

```typescript
// 使用localStorage缓存最近的数据
- 缓存Agent列表（5分钟有效）
- 缓存统计数据（1分钟有效）
- 缓存状态数据（30秒有效）

// 离线时显示
- 显示缓存数据 + "Offline mode"
- 禁用编辑/删除操作（显示提示 "Requires internet connection"）
- 禁用搜索过滤（显示 "Offline - filtering unavailable"）
```

**4. 性能降级**

```typescript
// Agent数量 > 50
- 启用虚拟滚动 (react-virtual)
- 降低轮询频率 (从5秒到10秒)
- 禁用实时状态更新（改为手动刷新）

// 低带宽环境
- 减少批量操作大小（每次最多10个）
- 压缩API响应（启用gzip）
- 延迟加载非关键数据（统计面板延迟1秒加载）
```

**5. 用户反馈机制**

```typescript
// 错误提示样式
- 红色横幅（顶部） - 严重错误
- 黄色提示（组件内） - 警告/降级
- 灰色文字（次要信息） - 数据不可用

// 重试机制
- 自动重试（最多3次，指数退避）
- 手动重试按钮（用户触发）
- 错误详情展开（技术用户查看）
```

### 测试要求

**单元测试：**
- 后端API端点测试
- 心跳接收和状态计算逻辑
- 统计数据聚合函数

**集成测试：**
- Agent创建 + workspace provisioning
- 状态监控更新流程
- 搜索过滤功能

**E2E测试：**
- 完整的CRUD流程
- 状态指示器实时更新
- 批量操作流程

### 性能优化

1. **API响应优化**
   - 使用内存缓存最近的状态数据
   - 限制统计查询频率
   - 使用分页（如果agent数量很大）

2. **前端优化**
   - 使用 `usePolling` hooks（已存在）定期刷新
   - 虚拟滚动（如果agent数量>50）
   - 防抖搜索输入

3. **数据库优化**
   - 索引 `agent_id` 和 `last_heartbeat`
   - 定期清理旧的心跳记录
   - 使用事务批量更新

### 安全考虑

1. **API安全**
   - 所有写操作需要验证（已存在）
   - 删除操作需要二次确认（已存在）
   - 输入验证（已存在）

2. **文件系统安全**
   - workspace路径限制在配置的workspace目录内
   - 防止路径遍历攻击
   - 文件操作异常处理

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (2026-01-23)

### Completion Notes List

- 所有功能必须在现有技术栈和架构约束下实现
- 保持与现有代码风格和模式一致
- 优先使用已有的UI组件（Card, Badge, Button等）
- 使用Tailwind CSS 4的工具类进行样式
- 确保响应式设计（支持移动设备）
- 添加适当的加载状态和错误处理
- 遵循TypeScript严格模式

### File List

**后端修改：**
- `tinyclaw/src/server/routes/agents.ts`
- `tinyclaw/src/server/routes/heartbeat.ts` (新增)

**前端修改：**
- `tinyclaw/tinyoffice/src/app/agents/page.tsx`
- `tinyclaw/tinyoffice/src/app/agents/components/StatusIndicator.tsx` (新增)
- `tinyclaw/tinyoffice/src/app/agents/components/StatsDashboard.tsx` (新增)
- `tinyclaw/tinyoffice/src/app/agents/components/SearchFilterBar.tsx` (新增)
- `tinyclaw/tinyoffice/src/lib/api.ts`

**测试文件：**
- `tinyclaw/src/__tests__/integration/agents-api.test.ts` (新增)
- `tinyclaw/tinyoffice/src/__tests__/agents-page.test.tsx` (新增)

## 项目上下文参考

- **架构文档：** [docs/architecture-tinyclaw.md](../../docs/architecture-tinyclaw.md)
- **开发指南：** [docs/development-guide-tinyclaw.md](../../docs/development-guide-tinyclaw.md)
- **项目上下文：** [docs/project-context.md](../../docs/project-context.md)
- **Epic计划：** [_bmad-output/planning-artifacts/epics.md](../../_bmad-output/planning-artifacts/epics.md#epic-2a-tinyoffice-前端完善)
- **现有实现：** [tinyclaw/tinyoffice/src/app/agents/page.tsx](../tinyclaw/tinyoffice/src/app/agents/page.tsx)

## 关键设计决策

1. **状态监控方案** - 使用数据库心跳表而非文件系统（与项目架构一致）
2. **实时更新** - 使用现有的 `usePolling` hooks (5秒间隔)
3. **批量操作** - 使用复选框选择模式，保持与Tasks页面一致
4. **统计面板** - 显示在页面顶部，类似于Dashboard
5. **错误处理** - 使用统一的错误提示模式（红色文字）
6. **数据收集** - 在 `queue_processor.ts` 中自动收集响应时间，无需修改每个Agent

## 数据收集实施方案

### 1. 响应时间追踪

**实现位置：** `tinyclaw/src/lib/invoke.ts`

```typescript
export async function invokeAgent(
  agentId: string,
  messages: Message[],
  context?: InvokeContext
): Promise<string> {
  const startTime = Date.now();

  try {
    const response = await callLLM(agentId, messages, context);
    const responseTime = Date.now() - startTime;

    // 更新agent心跳数据
    updateAgentHeartbeat(agentId, {
      responseTimeMs: responseTime,
      status: 'active'
    });

    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // 记录错误
    logAgentError(agentId, error, responseTime);

    throw error;
  }
}
```

### 2. 工作负载计算

**实现位置：** `tinyclaw/src/server/routes/agents.ts`

```typescript
// GET /api/agents/:id/status
app.get('/api/agents/:id/status', (c) => {
  const agentId = c.req.param('id');

  // 查询当前正在处理的消息数
  const processingCount = db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE agent = ? AND status = 'processing'
  `).get(agentId).count;

  // 查询心跳数据
  const heartbeat = db.prepare(`
    SELECT * FROM agent_heartbeat WHERE agent_id = ?
  `).get(agentId);

  // 计算状态
  const now = Date.now();
  const lastHeartbeat = heartbeat?.last_heartbeat || 0;
  const isRecent = now - lastHeartbeat < 60000; // 1分钟内有心跳

  let status: AgentStatus = 'unknown';
  if (heartbeat) {
    if (heartbeat.status === 'error') status = 'error';
    else if (processingCount > 0) status = 'active';
    else if (isRecent) status = 'idle';
  }

  return c.json({
    agent_id: agentId,
    status,
    last_heartbeat: lastHeartbeat,
    last_activity: heartbeat?.updated_at || lastHeartbeat,
    messages_processing: processingCount,
    // ... 其他字段
  });
});
```

### 3. 心跳自动更新

**实现位置：** `tinyclaw/src/queue-processor.ts`

```typescript
// 在消息处理关键节点更新心跳
async function processMessage(message: DbMessage) {
  const agentId = message.agent || 'default';

  // 认领消息时更新状态
  updateAgentHeartbeat(agentId, { status: 'active' });

  try {
    // 处理消息...
    await invokeAgent(agentId, messages);

    // 完成时更新状态
    updateAgentHeartbeat(agentId, {
      status: 'idle',
      incrementProcessed: true
    });

    completeMessage(message.id);
  } catch (error) {
    // 错误时记录
    logAgentError(agentId, error);
    failMessage(message.id, error.message);
  }
}

// 定时心跳（每30秒）
setInterval(() => {
  const agents = getAgents(getSettings());
  for (const [agentId, _] of Object.entries(agents)) {
    // 仅更新没有活动的状态为idle
    updateAgentHeartbeat(agentId, { status: 'idle', force: true });
  }
}, 30000);
```

### 4. 错误追踪

**实现位置：** `tinyclaw/src/lib/agent-monitoring.ts`

```typescript
export function logAgentError(
  agentId: string,
  error: Error,
  responseTime?: number
) {
  const db = getDb();

  // 更新心跳表的错误计数
  db.prepare(`
    UPDATE agent_heartbeat
    SET error_count = error_count + 1,
        updated_at = ?
    WHERE agent_id = ?
  `).run(Date.now(), agentId);

  // 记录详细错误日志
  db.prepare(`
    INSERT INTO agent_activity_log
    (agent_id, activity_type, timestamp, metadata)
    VALUES (?, 'error', ?, ?)
  `).run(
    agentId,
    Date.now(),
    JSON.stringify({
      message: error.message,
      stack: error.stack,
      responseTime,
      timestamp: Date.now()
    })
  );
}
```

### 5. 统计数据聚合

**实现位置：** `tinyclaw/src/server/routes/agent-stats.ts`

```typescript
// GET /api/agents/stats
app.get('/api/agents/stats', (c) => {
  const db = getDb();

  // 总agent数量（从配置文件）
  const settings = getSettings();
  const totalAgents = Object.keys(settings.agents || {}).length;

  // 从心跳表获取状态分布
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM agent_heartbeat GROUP BY status
  `).all();

  // 计算总处理消息数
  const totalProcessed = db.prepare(`
    SELECT SUM(messages_processed) as total FROM agent_heartbeat
  `).get().total || 0;

  // 计算平均响应时间
  const avgResponse = db.prepare(`
    SELECT
      SUM(response_time_total) * 1.0 / SUM(response_time_count) as avg
    FROM agent_heartbeat
    WHERE response_time_count > 0
  `).get().avg || 0;

  // 计算错误率
  const totalErrors = db.prepare(`
    SELECT SUM(error_count) as total FROM agent_heartbeat
  `).get().total || 0;

  const errorRate = totalProcessed > 0
    ? (totalErrors / totalProcessed) * 100
    : 0;

  // 按provider统计
  const byProvider = {};
  const providerStats = db.prepare(`
    SELECT a.provider, COUNT(*) as count,
           SUM(h.messages_processed) as messages,
           SUM(h.response_time_total) * 1.0 / SUM(h.response_time_count) as avg_response
    FROM agent_heartbeat h
    JOIN (SELECT id, provider FROM json_each(?)) a ON h.agent_id = a.id
    GROUP BY a.provider
  `).all(JSON.stringify(settings.agents || {}));

  for (const row of providerStats) {
    byProvider[row.provider] = {
      count: row.count,
      active: /* 计算活跃数量 */,
      messages_processed: row.messages,
      average_response_time: row.avg_response
    };
  }

  return c.json({
    total_agents: totalAgents,
    active_agents: /* 从statusCounts计算 */,
    idle_agents: /* 从statusCounts计算 */,
    error_agents: /* 从statusCounts计算 */,
    unknown_agents: totalAgents - /* active+idle+error */,
    messages_processed_total: totalProcessed,
    average_response_time_ms: avgResponse,
    error_rate_percentage: errorRate,
    by_provider: byProvider
  });
});
```

## 完整实施步骤

### 阶段 1: 数据库迁移 (1小时)
1. 创建 `agent_heartbeat` 表
2. 创建 `agent_activity_log` 表
3. 添加索引到 `messages` 表
4. 编写迁移脚本（可选：从现有数据初始化）

### 阶段 2: 后端API开发 (2小时)
1. 实现 `/api/agents/:id/status` 端点
2. 实现 `/api/agents/stats` 端点
3. 实现 `/api/agents/:id/heartbeat` 端点
4. 实现心跳更新逻辑 (`agent-monitoring.ts`)
5. 修改 `invoke.ts` 添加响应时间追踪

### 阶段 3: 队列处理器集成 (1小时)
1. 在 `queue-processor.ts` 中集成心跳更新
2. 添加定时心跳（30秒间隔）
3. 测试消息处理流程中的心跳更新

### 阶段 4: 前端组件开发 (3小时)
1. 创建 `StatusIndicator.tsx` 组件
2. 创建 `StatsDashboard.tsx` 组件
3. 创建 `SearchFilterBar.tsx` 组件
4. 创建 `BulkActionsBar.tsx` 组件
5. 修改 `AgentCard.tsx` 添加复选框和状态指示器
6. 更新 `page.tsx` 集成所有新组件

### 阶段 5: 前端API集成 (1小时)
1. 更新 `api.ts` 添加新API调用
2. 更新 `hooks.ts` 添加状态监控轮询
3. 测试所有API端点

### 阶段 6: 错误处理和降级 (1小时)
1. 实现API错误处理
2. 实现离线模式降级
3. 添加用户反馈机制
4. 测试各种错误场景

### 阶段 7: 测试和优化 (2小时)
1. 单元测试（后端）
2. 集成测试（前后端联调）
3. E2E测试（完整流程）
4. 性能优化（虚拟滚动、防抖等）

**总估算时间：约 11 小时**

## 下一步行动

1. 审查此故事文件，确保理解所有需求
2. 运行 `/bmad-bmm-dev-story` 开始实现
3. 实现后运行代码审查
4. 测试所有功能（手动+自动化）

## ⚠️ 实施警告和注意事项

### 1. 数据库迁移风险

**⚠️ 警告：** 添加新表时需要注意：
- 确保 `initQueueDb()` 在应用启动时调用
- 新表创建语句需要添加到 `initQueueDb()` 的 `db.exec()` 中
- 测试数据库迁移脚本在不同状态下的一致性

**建议：** 在开发环境充分测试后再部署到生产环境

### 2. 性能影响

**⚠️ 潜在性能问题：**
- 每30秒的心跳更新会增加数据库写入
- 实时状态轮询（5秒间隔）会增加API负载
- 统计查询可能较慢（需要优化索引）

**缓解措施：**
- 使用内存缓存最近的统计数据（10秒过期）
- 限制统计API调用频率（最多每10秒一次）
- 使用数据库索引优化查询性能

### 3. 数据一致性

**⚠️ 一致性问题：**
- Agent配置（JSON文件）和心跳数据（数据库）可能存在不一致
- 删除Agent时需要同时清理数据库中的心跳记录

**解决方案：**
```typescript
// 删除Agent时清理心跳数据
app.delete('/api/agents/:id', (c) => {
  const agentId = c.req.param('id');

  // 删除配置
  mutateSettings(s => { delete s.agents![agentId]; });

  // 清理数据库
  db.prepare('DELETE FROM agent_heartbeat WHERE agent_id = ?').run(agentId);
  db.prepare('DELETE FROM agent_activity_log WHERE agent_id = ?').run(agentId);

  return c.json({ ok: true });
});
```

### 4. 向后兼容性

**⚠️ 需要考虑：**
- 现有Agent不会自动创建心跳记录
- 第一次访问时心跳数据为空

**处理方案：**
- 在首次访问时自动初始化心跳记录
- 显示"Unknown"状态而不是报错
- 逐步收集数据，不要求立即完整

### 5. 错误边界

**⚠️ 容错设计：**
- 心跳表不存在时不要崩溃（自动创建）
- 统计查询失败时返回默认值而不是报错
- 网络错误时显示缓存数据而不是空白页面

### 6. 测试覆盖

**⚠️ 必须测试的场景：**
1. ✅ 新Agent创建后的心跳初始化
2. ✅ Agent删除后的数据清理
3. ✅ 多个Agent并发处理消息时的心跳更新
4. ✅ 数据库连接失败时的降级处理
5. ✅ 大量Agent（50+）时的性能表现
6. ✅ 长时间运行后的数据累积（是否会溢出）

### 7. 监控和日志

**⚠️ 建议添加的日志：**
```typescript
// 心跳更新日志
log('DEBUG', `[Heartbeat] Agent ${agentId} status: ${status}`);

// 错误日志
log('ERROR', `[AgentMonitor] Failed to update heartbeat: ${error}`);

// 统计日志
log('INFO', `[Stats] Generated stats for ${totalAgents} agents`);
```

### 8. 扩展性考虑

**⚠️ 未来可能需要：**
- 分页支持（当Agent数量 > 100时）
- 实时推送（WebSocket替代轮询）
- 历史趋势图表（响应时间趋势、错误率趋势）
- 告警系统（错误率超过阈值时通知）
