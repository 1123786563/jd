# Story 1c.9: 状态转换验证与异常处理 - updateTaskStatus() 原子操作与依赖解锁

**状态:** ready-for-dev

---

## 📋 故事概述

**用户角色:** Automaton 系统开发者
**用户目标:** 我想要实现任务状态转换的验证机制和异常处理逻辑，确保 `updateTaskStatus()` 函数的原子操作正确性，并完善依赖解锁机制
**业务价值:** 防止状态转换错误、避免竞态条件、确保任务依赖关系正确处理，提升系统稳定性和数据一致性

---

## 🎯 接受标准 (Acceptance Criteria)

### AC1: 状态转换验证
- [ ] 实现 `validateStatusTransition()` 函数，检查从当前状态到目标状态的合法性
- [ ] 根据状态机规则禁止非法转换（如从 `completed` 到 `pending`）
- [ ] 对非法状态转换抛出明确的 `InvalidStateTransitionError`
- [ ] 记录所有状态转换到事件流（`event_stream` 表）用于审计

### AC2: updateTaskStatus() 原子操作增强
- [ ] 确保 `updateTaskStatus()` 所有数据库操作在单个事务中完成
- [ ] 添加时间戳验证，防止并发更新覆盖
- [ ] 实现乐观锁机制，检测并拒绝过时的更新请求
- [ ] 所有状态变更操作必须通过 `withTransaction()` 包装

### AC3: 依赖解锁机制优化
- [ ] 增强 `unblockReadyBlockedTasks()` SQL 查询，添加索引优化
- [ ] 实现依赖满足检查的缓存机制，减少重复查询
- [ ] 添加依赖循环检测，防止死锁
- [ ] 对复杂依赖图进行性能优化（超过100个任务时仍保持快速响应）

### AC4: 异常处理与恢复
- [ ] 实现事务失败后的自动重试机制（最多3次，指数退避）
- [ ] 添加死锁检测和自动恢复
- [ ] 对数据库约束违反提供友好的错误信息
- [ ] 实现状态转换回滚机制，确保数据一致性

### AC5: 监控与日志
- [ ] 记录所有状态转换事件到 `event_stream` 表
- [ ] 添加性能监控，追踪 `updateTaskStatus()` 调用延迟
- [ ] 实现慢查询告警（超过100ms的查询记录到日志）
- [ ] 添加关键指标收集（状态转换频率、失败率、依赖解锁耗时）

### AC6: 测试覆盖
- [ ] 单元测试覆盖所有合法和非法状态转换
- [ ] 集成测试验证事务的原子性（事务回滚场景）
- [ ] 并发测试验证乐观锁和死锁处理
- [ ] 性能测试验证依赖解锁机制在大数据量下的表现

---

## 📝 任务分解

### Task 1: 状态机验证机制 (AC1)
- [ ] Subtask 1.1: 定义状态转换规则表（允许的转换矩阵）
- [ ] Subtask 1.2: 实现 `validateStatusTransition(current, target)` 函数
- [ ] Subtask 1.3: 创建 `InvalidStateTransitionError` 自定义异常类
- [ ] Subtask 1.4: 集成事件流记录（`recordStateTransition` 函数）

### Task 2: 原子操作增强 (AC2)
- [ ] Subtask 2.1: 审查 `updateTaskStatus()` 所有调用点，确保事务包装
- [ ] Subtask 2.2: 实现乐观锁机制（`version` 字段 + 条件更新）
- [ ] Subtask 2.3: 添加时间戳验证和并发检测
- [ ] Subtask 2.4: 实现事务上下文管理器

### Task 3: 依赖解锁优化 (AC3)
- [ ] Subtask 3.1: 分析现有 `unblockReadyBlockedTasks()` SQL 性能瓶颈
- [ ] Subtask 3.2: 添加 `task_graph` 表索引优化（`status`, `dependencies`）
- [ ] Subtask 3.3: 实现依赖满足缓存（LRU Cache）
- [ ] Subtask 3.4: 添加依赖循环检测算法

### Task 4: 异常处理增强 (AC4)
- [ ] Subtask 4.1: 实现事务重试装饰器（指数退避策略）
- [ ] Subtask 4.2: 添加死锁检测和自动恢复逻辑
- [ ] Subtask 4.3: 创建详细的错误码和错误信息映射
- [ ] Subtask 4.4: 实现状态回滚机制

### Task 5: 监控与可观测性 (AC5)
- [ ] Subtask 5.1: 扩展 `event_stream` 表 schema（添加事件类型字段）
- [ ] Subtask 5.2: 实现性能监控装饰器（记录执行时间）
- [ ] Subtask 5.3: 配置慢查询日志（阈值100ms）
- [ ] Subtask 5.4: 添加 Prometheus 指标收集

### Task 6: 测试实现 (AC6)
- [ ] Subtask 6.1: 编写单元测试（状态验证逻辑）
- [ ] Subtask 6.2: 编写事务原子性测试
- [ ] Subtask 6.3: 编写并发测试（多线程/进程）
- [ ] Subtask 6.4: 编写性能测试（大规模任务图）

---

## 🔧 开发笔记

### 技术架构要求

#### 1. 状态机规则定义

**允许的状态转换矩阵：**

| 当前状态 → 目标状态 | pending | assigned | running | completed | failed | blocked | cancelled |
|---------------------|---------|----------|---------|-----------|--------|---------|-----------|
| **pending** | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| **assigned** | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| **running** | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| **completed** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **failed** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **blocked** | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| **cancelled** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**关键规则：**
- 只能向前转换（pending → assigned → running → terminal）
- `blocked` 状态只能转为 `pending` 或 `failed`
- 终端状态（completed/failed/cancelled）不可再转换

#### 2. 技术栈与依赖

**核心依赖：**
- `better-sqlite3` - 数据库操作（事务支持）
- `ulid` - 唯一标识生成
- TypeScript 5.3+ - 类型安全

**架构模式：**
- 状态模式（State Pattern）- 管理状态转换规则
- 装饰器模式（Decorator Pattern）- 添加重试、监控等横切关注点
- 乐观锁（Optimistic Locking）- 并发控制

#### 3. 数据库表结构

**task_graph 表增强：**

```sql
ALTER TABLE task_graph ADD COLUMN version INTEGER DEFAULT 0;
ALTER TABLE task_graph ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_task_graph_status ON task_graph(status);
CREATE INDEX IF NOT EXISTS idx_task_graph_goal_status
  ON task_graph(goal_id, status);
CREATE INDEX IF NOT EXISTS idx_task_graph_assigned_status
  ON task_graph(assigned_to, status) WHERE assigned_to IS NOT NULL;
```

**event_stream 表扩展：**

```sql
ALTER TABLE event_stream ADD COLUMN event_type TEXT CHECK(
  event_type IN (
    'state_transition', 'task_unblocked', 'transaction_retry',
    'deadlock_detected', 'constraint_violation'
  )
);

ALTER TABLE event_stream ADD COLUMN metadata TEXT; -- JSON 存储额外信息
```

#### 4. 关键文件路径

**源码文件：**
- `/automaton/src/state/database.ts` - 数据库操作核心
- `/automaton/src/orchestration/task-graph.ts` - 任务图编排逻辑
- `/automaton/src/state/schema.ts` - 数据库 schema 定义
- `/automaton/src/types.ts` - TypeScript 类型定义

**测试文件：**
- `/automaton/src/__tests__/database-transactions.test.ts` - 事务测试
- `/automaton/src/__tests__/task-graph.test.ts` - 任务图测试
- `/automaton/src/__tests__/status-transitions.test.ts` (新增) - 状态转换测试

**新增文件：**
- `/automaton/src/orchestration/state-validator.ts` - 状态验证器
- `/automaton/src/state/optimistic-lock.ts` - 乐观锁实现
- `/automaton/src/utils/retry-decorator.ts` - 重试装饰器
- `/automaton/src/monitoring/state-metrics.ts` - 监控指标

---

## 📖 技术规范细节

### 状态验证器实现

```typescript
// /automaton/src/orchestration/state-validator.ts

export type TaskStatus =
  | "pending" | "assigned" | "running"
  | "completed" | "failed" | "blocked" | "cancelled";

export class StateTransitionError extends Error {
  constructor(
    public current: TaskStatus,
    public target: TaskStatus,
    public taskId: string
  ) {
    super(`Invalid state transition: ${current} → ${target} for task ${taskId}`);
    this.name = "StateTransitionError";
  }
}

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["assigned", "running", "cancelled"],
  assigned: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  blocked: ["pending", "failed", "cancelled"],
  cancelled: [],
};

export function validateStatusTransition(
  current: TaskStatus,
  target: TaskStatus,
  taskId: string
): void {
  if (!ALLOWED_TRANSITIONS[current].includes(target)) {
    throw new StateTransitionError(current, target, taskId);
  }
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return ["completed", "failed", "cancelled"].includes(status);
}
```

### 乐观锁增强的 updateTaskStatus

```typescript
// /automaton/src/state/database.ts (扩展)

export interface TaskGraphRowWithVersion extends TaskGraphRow {
  version: number;
  updatedAt: string;
}

export function updateTaskStatusWithLock(
  db: DatabaseType,
  id: string,
  status: TaskGraphStatus,
  expectedVersion: number
): boolean {
  const now = new Date().toISOString();

  return withTransaction(db, () => {
    // 验证当前版本
    const current = db.prepare(
      "SELECT version FROM task_graph WHERE id = ?"
    ).get(id) as { version: number } | undefined;

    if (!current || current.version !== expectedVersion) {
      return false; // 版本冲突，更新失败
    }

    // 执行状态更新 + 版本递增
    let result;
    if (status === "running") {
      result = db.prepare(
        `UPDATE task_graph
         SET status = ?, started_at = COALESCE(started_at, ?),
             version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`
      ).run(status, now, now, id, expectedVersion);
    } else if (status === "completed" || status === "failed" || status === "cancelled") {
      result = db.prepare(
        `UPDATE task_graph
         SET status = ?, completed_at = ?,
             version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`
      ).run(status, now, now, id, expectedVersion);
    } else {
      result = db.prepare(
        `UPDATE task_graph
         SET status = ?, version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`
      ).run(status, now, id, expectedVersion);
    }

    return result.changes > 0;
  });
}
```

### 依赖解锁优化

```typescript
// /automaton/src/orchestration/task-graph.ts (优化)

// 添加缓存机制
const dependencyCache = new Map<string, boolean>();

export function unblockReadyBlockedTasks(db: Database): void {
  // 使用索引优化的查询
  db.prepare(`
    UPDATE task_graph
    SET status = 'pending',
        updated_at = CURRENT_TIMESTAMP,
        version = version + 1
    WHERE status = 'blocked'
      AND NOT EXISTS (
        SELECT 1
        FROM json_each(COALESCE(NULLIF(task_graph.dependencies, ''), '[]')) dep
        LEFT JOIN task_graph d ON d.id = dep.value
        WHERE d.status IS NULL OR d.status != 'completed'
      )
  `).run();

  // 清除缓存
  dependencyCache.clear();
}
```

### 重试装饰器实现

```typescript
// /automaton/src/utils/retry-decorator.ts

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOn?: (error: unknown) => boolean;
}

export function withRetry<T>(
  fn: () => T,
  options: RetryOptions = {}
): T {
  const {
    maxRetries = 3,
    baseDelayMs = 100,
    maxDelayMs = 5000,
    retryOn = (err) => err instanceof Error &&
      (err.message.includes("SQLITE_BUSY") ||
       err.message.includes("deadlock"))
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return fn();
    } catch (error) {
      lastError = error;

      if (!retryOn(error)) {
        throw error;
      }

      if (attempt === maxRetries - 1) {
        break; // 最后一次尝试，不再重试
      }

      // 指数退避 + 随机抖动
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 100,
        maxDelayMs
      );

      // 记录重试日志
      console.warn(
        `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${error}`
      );

      // 同步睡眠（better-sqlite3 是同步的）
      const start = Date.now();
      while (Date.now() - start < delay) {
        // 忙等待
      }
    }
  }

  throw lastError;
}
```

---

## 🧪 测试策略

### 单元测试清单

```typescript
// /automaton/src/__tests__/status-transitions.test.ts

describe("State Transition Validation", () => {
  it("allows valid transitions (pending → assigned)", () => {
    expect(() => validateStatusTransition("pending", "assigned", "task-1")).not.toThrow();
  });

  it("rejects invalid transitions (completed → pending)", () => {
    expect(() => validateStatusTransition("completed", "pending", "task-1"))
      .toThrow(StateTransitionError);
  });

  it("blocks transitions from terminal states", () => {
    ["completed", "failed", "cancelled"].forEach(terminal => {
      expect(() => validateStatusTransition(terminal, "pending", "task-1"))
        .toThrow(StateTransitionError);
    });
  });
});

describe("Optimistic Lock", () => {
  it("succeeds when version matches", () => {
    const success = updateTaskStatusWithLock(db, "task-1", "running", 0);
    expect(success).toBe(true);
  });

  it("fails when version mismatched", () => {
    // 第一次更新成功
    updateTaskStatusWithLock(db, "task-1", "running", 0);
    // 第二次使用旧版本号应该失败
    const success = updateTaskStatusWithLock(db, "task-1", "completed", 0);
    expect(success).toBe(false);
  });
});

describe("Dependency Unlock", () => {
  it("unblocks task when all dependencies completed", () => {
    // 设置依赖任务
    insertTask(db, { id: "dep-1", status: "completed", ... });
    insertTask(db, { id: "dep-2", status: "completed", ... });
    // 创建被阻塞的任务
    insertTask(db, {
      id: "blocked-task",
      status: "blocked",
      dependencies: ["dep-1", "dep-2"],
      ...
    });

    unblockReadyBlockedTasks(db);

    const task = getTaskById(db, "blocked-task");
    expect(task.status).toBe("pending");
  });

  it("keeps task blocked if any dependency incomplete", () => {
    insertTask(db, { id: "dep-1", status: "completed", ... });
    insertTask(db, { id: "dep-2", status: "pending", ... });
    insertTask(db, {
      id: "blocked-task",
      status: "blocked",
      dependencies: ["dep-1", "dep-2"],
      ...
    });

    unblockReadyBlockedTasks(db);

    const task = getTaskById(db, "blocked-task");
    expect(task.status).toBe("blocked");
  });
});
```

### 并发测试

```typescript
describe("Concurrency Safety", () => {
  it("handles concurrent updates with optimistic lock", async () => {
    // 模拟两个并发更新
    const [result1, result2] = await Promise.all([
      withTransaction(db, () => updateTaskStatusWithLock(db, "task-1", "running", 0)),
      withTransaction(db, () => updateTaskStatusWithLock(db, "task-1", "assigned", 0))
    ]);

    // 只有一个应该成功
    expect(result1 !== result2).toBe(true);
  });

  it("detects and recovers from deadlocks", () => {
    // 创建循环依赖
    insertTask(db, { id: "task-a", dependencies: ["task-b"], ... });
    insertTask(db, { id: "task-b", dependencies: ["task-a"], ... });

    expect(() => detectCycles([
      { id: "task-a", dependencies: ["task-b"] },
      { id: "task-b", dependencies: ["task-a"] }
    ])).toBe(true);
  });
});
```

---

## 📊 性能要求

### 基准指标

| 场景 | 目标性能 | 测量方法 |
|------|---------|---------|
| 单次状态更新 | < 10ms | `performance.now()` |
| 依赖解锁 (100任务) | < 50ms | 批量更新耗时 |
| 并发更新 (10线程) | 无死锁 | 压力测试 |
| 乐观锁冲突检测 | < 5ms | 版本验证耗时 |

### 优化建议

1. **索引优化**: 为 `status` + `goal_id` 创建复合索引
2. **批处理**: 同一事务内的多个状态更新合并执行
3. **缓存**: 依赖满足检查结果缓存 1 秒（LRU）
4. **异步解锁**: 考虑将依赖解锁放入后台队列（未来优化）

---

## 🔗 相关文档引用

- [Automaton 架构文档](/docs/architecture-automaton.md) - 架构模式和设计原则
- [Task Graph 详细设计](/docs/upwork_autopilot_detailed_design.md) - 任务图和 DAG 实现
- [Database Transaction Tests](/automaton/src/__tests__/database-transactions.test.ts) - 事务原子性验证
- [Epic 1c](/_bmad-output/planning-artifacts/epics.md#epic-1c-智能体编排与团队) - 智能体编排与团队协作

---

## ⚠️ 潜在风险与缓解

### 风险 1: 并发性能下降
**问题**: 乐观锁和版本验证可能增加数据库负载
**缓解**: 添加查询缓存，限制重试次数，监控慢查询

### 风险 2: 死锁可能性
**问题**: 复杂依赖图可能导致死锁
**缓解**: 实现超时机制，添加死锁检测，记录详细日志便于排查

### 风险 3: 向后兼容性
**问题**: `version` 字段可能影响现有代码
**缓解**: 设置默认值 0，逐步迁移，提供兼容层

### 风险 4: 测试覆盖不足
**问题**: 并发场景难以完全测试
**缓解**: 使用压力测试工具（Artillery），增加随机性测试

---

## 📝 实施清单

- [ ] 审查现有代码，识别所有 `updateTaskStatus()` 调用点
- [ ] 设计状态转换规则表
- [ ] 实现状态验证器
- [ ] 增强乐观锁机制
- [ ] 优化依赖解锁查询
- [ ] 添加监控和日志
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 性能测试和优化
- [ ] 文档更新
- [ ] 代码审查

---

## 👥 依赖关系

### 前置任务
- ✅ **1c.8** - TaskNode 状态机实现（已完成）

### 后续任务
- **1c.10** - 任务图可视化（依赖本故事的状态转换逻辑）
- **1c.11** - 批量任务调度优化（依赖本故事的性能优化）

### 跨项目依赖
- **2b.11** - TinyClaw 数据库表设计（共享类似的事务模式）
- **2b.12** - SQLite 索引优化（可以复用优化策略）

---

## 🎯 完成标准

- ✅ 所有接受标准通过测试
- ✅ 代码审查通过（无严重问题）
- ✅ 性能指标达标
- ✅ 文档完整且准确
- ✅ 向后兼容性验证通过
- ✅ 监控指标已配置

---

**创建日期:** 2026-03-04
**创建者:** BMAD Create-Story Workflow
**版本:** 1.0
**最后更新:** 2026-03-04

---

## 💡 开发者提示

1. **优先实现状态验证器** - 这是所有其他功能的基础
2. **渐进式增强** - 先确保现有功能正常，再添加乐观锁等增强特性
3. **测试驱动** - 先写测试用例，再实现功能，确保覆盖率
4. **性能监控** - 在关键路径添加性能计时，便于后续优化
5. **日志详细** - 在调试阶段保留详细日志，便于问题排查

---

**下一步:** 运行 `dev-story 1c-9-status-transition-validation.md` 开始实施
