# Story 1c.8: 任务节点状态机实现 - TaskNode State Machine

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 系统架构师,
I want 实现任务节点完整的状态机转换逻辑和依赖解锁机制,
so that 任务图能够在复杂的工作流中正确执行，避免死锁和状态错误。

## Acceptance Criteria

### AC 1.1: 状态机类型定义
**Given** Automaton 项目中已有 TaskGraph 模块
**When** 定义 TaskNode 的六种状态
**Then** 应该包含以下状态: `blocked`, `pending`, `running`, `completed`, `failed`, `abandoned`
**And** 需要与现有代码中的 `TaskStatus` 类型保持兼容性

### AC 1.2: 状态转换验证
**Given** 任务节点当前处于某个状态
**When** 尝试转换到新状态
**Then** 系统应该验证转换是否合法
**And** 非法转换应该抛出明确的错误信息

**有效的状态转换规则:**
- `blocked` → `pending` (前置依赖全部完成)
- `pending` → `running` (被分配给 Agent 开始执行)
- `running` → `completed` (执行成功)
- `running` → `failed` (执行失败)
- `failed` → `running` (重试执行)
- `failed` → `abandoned` (人工放弃或达到最大重试次数)
- `completed` → 无 (终止状态)
- `abandoned` → 无 (终止状态)

### AC 1.3: 任务状态更新函数
**Given** 任务节点的 ID 和新状态
**When** 调用 `updateTaskStatus()` 函数
**Then** 应该执行以下操作:
1. 验证状态转换是否合法
2. 执行原子性更新操作
3. 根据状态设置正确的时间戳:
   - `running`: 设置 `started_at`
   - `completed`: 设置 `completed_at`
4. 记录错误详情和产出物 (如果提供)

### AC 1.4: 依赖解锁机制
**Given** 任务节点状态变更为 `completed`
**When** 系统检测到有下游依赖
**Then** 应该自动解锁所有阻塞的下游任务
**And** 下游任务如果所有依赖都满足，应该从 `blocked` 状态转换为 `pending`

### AC 1.5: 依赖验证
**Given** 任务节点有 `dependencies` 字段
**When** 检查任务的前置条件
**Then** 应该遍历所有依赖节点
**And** 只有当所有依赖任务状态都为 `completed` 时，当前任务才能从 `blocked` 解锁

### AC 1.6: 错误处理
**Given** 系统尝试执行非法状态转换
**When** 发现转换不符合状态机规则
**Then** 应该抛出 `Error` 并包含清晰的错误消息
**And** 错误消息应该包含当前状态和目标状态的详细信息

### AC 1.7: 终止状态保护
**Given** 任务节点处于 `completed` 或 `abandoned` 状态
**When** 尝试修改这些任务的状态
**Then** 系统应该拒绝操作
**And** 返回明确的错误说明任务已终止

## Tasks / Subtasks

### Task 1: 类型定义和接口设计 (AC: 1.1, 1.6)
- [ ] 确认 `TaskStatus` 类型的六种状态定义
- [ ] 确保与现有代码兼容 (现有包含 `cancelled`, 需要添加 `abandoned`)
- [ ] 设计 `updateTaskStatus` 函数的参数接口

### Task 2: 状态转换验证逻辑 (AC: 1.2, 1.6, 1.7)
- [ ] 实现状态转换规则映射表 (`validTransitions`)
- [ ] 编写状态转换验证函数
- [ ] 添加非法转换的错误处理
- [ ] 添加终止状态的保护逻辑

### Task 3: 原子状态更新实现 (AC: 1.3)
- [ ] 实现 `updateTaskStatus` 主函数
- [ ] 添加数据库事务保证
- [ ] 实现时间戳自动设置逻辑
- [ ] 实现错误详情和产出物的存储

### Task 4: 依赖解锁机制 (AC: 1.4, 1.5)
- [ ] 实现 `areDependenciesSatisfied` 函数
- [ ] 实现 `unblockReadyBlockedTasks` 函数
- [ ] 确保解锁逻辑在事务中执行
- [ ] 添加依赖验证的单元测试

### Task 5: 测试用例编写
- [ ] 编写状态转换验证测试
- [ ] 编写依赖解锁测试
- [ ] 编写边界条件测试 (终止状态保护、循环依赖等)
- [ ] 编写集成测试验证完整工作流

## Dev Notes

### 架构模式

本故事遵循 Automaton 的**编排引擎模式**，核心文件位于 `orchestration/task-graph.ts`。状态机是任务图执行的基础，确保复杂工作流的正确性和可靠性。

### 技术栈

- **语言**: TypeScript 5.4+
- **数据库**: SQLite 3 (better-sqlite3)
- **事务模式**: WAL (Write-Ahead Logging)
- **状态管理**: 状态机模式 (State Machine)

### 实现细节

#### 1. 状态转换规则表

```typescript
const validTransitions: Record<TaskStatus, TaskStatus[]> = {
  blocked: ['pending'],
  pending: ['running'],
  running: ['completed', 'failed'],
  completed: [],
  failed: ['running', 'abandoned'],
  abandoned: []
};
```

#### 2. 状态验证流程

```typescript
// 1. 获取当前状态
const currentStatus = await db.get('SELECT status FROM task_graph WHERE id = ?', [taskId]);

// 2. 检查转换是否合法
if (!validTransitions[currentStatus.status].includes(newStatus)) {
  throw new Error(`Invalid state transition: ${currentStatus.status} -> ${newStatus}`);
}

// 3. 检查是否为终止状态
const TERMINAL_TASK_STATUSES = new Set<TaskStatus>(['completed', 'failed', 'abandoned']);
if (TERMINAL_TASK_STATUSES.has(currentStatus.status) && currentStatus.status !== newStatus) {
  throw new Error(`Cannot modify task in terminal status: ${currentStatus.status}`);
}
```

#### 3. 依赖解锁算法

```typescript
// SQL 查询所有阻塞的任务
UPDATE task_graph
SET status = 'pending'
WHERE status = 'blocked'
  AND NOT EXISTS (
    SELECT 1
    FROM json_each(COALESCE(NULLIF(task_graph.dependencies, ''), '[]')) dep
    LEFT JOIN task_graph d ON d.id = dep.value
    WHERE d.status IS NULL OR d.status != 'completed'
  )
```

#### 4. 时间戳管理

- `started_at`: 当任务进入 `running` 状态时设置
- `completed_at`: 当任务进入 `completed` 状态时设置
- `updated_at`: 每次状态更新时设置为当前时间

### 代码位置

- **主要文件**: `automaton/src/orchestration/task-graph.ts`
- **数据库操作**: `automaton/src/state/database.ts` (已存在)
- **类型定义**: `automaton/src/orchestration/task-graph.ts` (TaskStatus)

### 关键设计决策

#### 1. 为什么使用状态机模式？

- **可预测性**: 明确的状态转换规则避免状态混乱
- **可维护性**: 状态转换逻辑集中管理，易于调试
- **可靠性**: 防止非法状态转换，保证系统稳定性

#### 2. 为什么使用 SQLite WAL 模式？

- **并发性能**: 读写操作可以并发执行
- **事务安全**: `BEGIN IMMEDIATE` 保证消息不被重复处理
- **简单可靠**: 无需额外中间件，降低部署复杂度

#### 3. 为什么使用 JSON 存储依赖关系？

- **灵活性**: 动态依赖数量和结构
- **查询效率**: `json_each` 函数支持高效遍历
- **兼容性**: 与现有的任务图设计保持一致

### 潜在风险和注意事项

#### 1. 死锁风险

**问题**: 如果任务图中存在循环依赖，可能导致任务永远阻塞。

**解决方案**:
- 在 `decomposeGoal` 时调用 `detectCycles` 检测循环
- 使用拓扑排序验证 DAG 结构

#### 2. 并发竞争条件

**问题**: 多个线程同时更新任务状态可能导致数据不一致。

**解决方案**:
- 使用 `withTransaction` 包装所有状态更新操作
- 使用 `BEGIN IMMEDIATE` 独占事务锁定

#### 3. 状态转换丢失

**问题**: 如果在解锁下游任务时发生错误，可能导致部分任务卡在 `blocked` 状态。

**解决方案**:
- 将状态更新和依赖解锁放在同一个事务中
- 使用 `try-catch` 包装，失败时回滚整个事务

#### 4. 终止状态误用

**问题**: 已完成或放弃的任务被错误地重新激活。

**解决方案**:
- 添加终止状态保护检查
- 抛出明确的错误信息

### 测试策略

#### 单元测试

1. **状态转换测试**
   - 验证所有合法转换都能成功
   - 验证所有非法转换都会失败并抛出正确错误

2. **依赖验证测试**
   - 验证无依赖任务初始状态为 `pending`
   - 验证有未完成依赖的任务状态为 `blocked`
   - 验证依赖全部完成后任务自动解锁

3. **边界条件测试**
   - 终止状态的任务无法修改
   - 空依赖列表的处理
   - 循环依赖的检测

#### 集成测试

1. **完整工作流测试**
   - 创建包含多个任务的 Goal
   - 依次执行任务，验证状态转换
   - 验证依赖解锁的正确性

2. **并发测试**
   - 模拟多个 Agent 同时更新任务
   - 验证事务保护的有效性

### 性能优化

1. **批量解锁**: 使用 SQL 批量更新，避免逐个任务解锁
2. **索引优化**: 在 `status` 字段上创建索引，加速状态查询
3. **缓存策略**: 对频繁查询的依赖关系使用内存缓存

### 与其他模块的交互

#### 1. 与 QueueProcessor 的交互

- QueueProcessor 调用 `assignTask` 将任务从 `pending` 转为 `running`
- 完成后调用 `completeTask` 或 `failTask` 更新状态

#### 2. 与 Goal 管理器的交互

- 任务状态变化触发 `refreshGoalStatus` 刷新 Goal 状态
- 当所有任务完成时，Goal 状态更新为 `completed`

#### 3. 与 Memory System 的交互

- 任务执行过程中的上下文信息存储在 Memory System
- 任务结果作为长期记忆保存

### 文档参考

#### 代码参考

1. **现有实现**: `automaton/src/orchestration/task-graph.ts`
   - Line 15-22: `TaskStatus` 类型定义
   - Line 80-84: `TERMINAL_TASK_STATUSES` 定义
   - Line 547-557: `areDependenciesSatisfied` 函数
   - Line 618-629: `unblockReadyBlockedTasks` 函数
   - Line 632-658: `refreshGoalStatus` 函数

#### 设计文档参考

1. **详细设计**: `docs/upwork_autopilot_detailed_design.md`
   - Line 687-723: 任务节点状态机说明
   - Line 725-763: 状态转换实现示例
   - Line 1350-1373: task_graph 表结构

2. **架构文档**: `docs/upwork_autopilot_architecture.md`
   - 编排引擎与任务图相关章节

### 后续改进建议

1. **监控和日志**: 添加状态转换的审计日志，便于调试和追踪
2. **超时机制**: 为 `running` 状态的任务添加超时检测，防止永久阻塞
3. **优先级调度**: 支持基于优先级的任务调度策略
4. **可视化**: 提供任务图状态的可视化工具

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes

文档已根据现有 Automaton 代码和详细设计文档创建。关键发现:
1. 现有代码使用 `TaskStatus` 包含 7 种状态 (包括 `cancelled`)
2. 用户要求的状态为 6 种 (`blocked/pending/running/completed/failed/abandoned`)
3. 需要在实现时处理 `cancelled` 和 `abandoned` 的关系 (建议: `abandoned` 作为新的标准状态)

### 文件列表

- `automaton/src/orchestration/task-graph.ts` (主要实现文件)
- `automaton/src/state/database.ts` (数据库操作)
- `_bmad-output/implementation-artifacts/1c-8-task-node-state-machine.md` (本故事文档)
