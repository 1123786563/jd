# 🎯 Story 2b.8: 消息队列灾难恢复机制 - recoverStaleMessages() 从 SQLite 恢复处理中消息

Status: ready-for-dev

## 📖 Story

**As a** TinyClaw 系统管理员和开发者
**I want** 实现一个健壮的消息队列灾难恢复机制 `recoverStaleMessages()`
**so that** 当系统崩溃、进程意外终止或网络中断时，所有处于 `processing` 状态的消息能够自动恢复并重新处理，确保消息处理的可靠性和系统的容错性。

---

## 🎯 Acceptance Criteria

### 核心功能要求

1. **[AC1]** 实现 `recoverStaleMessages()` 函数，能够扫描并识别所有处于 `processing` 状态的陈旧消息
   - 识别标准：消息状态为 `processing` 且最后更新时间超过配置的超时阈值（默认 300 秒）
   - 返回陈旧消息的列表，包含消息详情和陈旧时间

2. **[AC2]** 实现自动恢复机制：将陈旧消息的状态重置为 `pending`，使其能够被队列处理器重新认领
   - 执行 `UPDATE queue_messages SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id IN (...)` 操作
   - 确保恢复操作在事务中执行，保持原子性

3. **[AC3]** 实现灾难恢复守护进程，在系统启动时自动执行恢复逻辑
   - 在 `queue-processor.ts` 启动时调用 `recoverStaleMessages()`（可配置开关）
   - 支持手动触发恢复（通过 CLI 命令或 API 端点）

4. **[AC4]** 实现详细的恢复日志记录和审计追踪
   - 记录每次恢复操作：消息数量、消息详情、恢复时间
   - 发出事件到 SSE 流，供前端实时监控
   - 记录到审计日志表（如果存在），包含操作人、操作时间、受影响的消息

### 可靠性和数据一致性要求

5. **[AC5]** 确保恢复操作不会导致消息丢失或重复处理
   - 在恢复前验证消息的完整性和有效性
   - 确保同一消息不会被多次恢复
   - 保持消息的顺序性和一致性

6. **[AC6]** 支持批量恢复操作，提高恢复效率
   - 一次性恢复所有陈旧消息，而非逐个处理
   - 使用 SQLite 批量更新语句，减少数据库操作次数
   - 支持恢复数量限制（可配置），避免一次性恢复过多消息导致系统过载

### 错误处理和监控要求

7. **[AC7]** 实现完善的错误处理和重试机制
   - 如果恢复操作失败（如数据库锁定、网络中断），记录错误并尝试重试
   - 支持配置重试次数和重试间隔
   - 在多次重试失败后，将消息标记为 `failed` 并记录详细错误信息

8. **[AC8]** 提供恢复操作的监控和统计信息
   - 通过 API 端点暴露恢复统计：`GET /api/queue/recovery/stats`
   - 统计信息包括：总恢复次数、最近恢复时间、恢复的消息数量、失败的消息数量
   - 前端界面展示恢复历史记录和状态

### 配置和可维护性要求

9. **[AC9]** 支持灵活的恢复策略配置
   - 可配置恢复超时阈值（stale_threshold_seconds）
   - 可配置是否在启动时自动执行恢复（auto_recover_on_startup）
   - 可配置手动恢复的最大消息数量（max_messages_per_recovery）
   - 可配置重试次数和重试间隔

10. **[AC10]** 提供恢复操作的测试覆盖
    - 单元测试：测试 `recoverStaleMessages()` 函数的逻辑
    - 集成测试：测试恢复操作对队列状态的影响
    - 端到端测试：测试整个恢复流程，包括日志记录和事件发出

---

## 📋 Tasks / Subtasks

### Phase 1: 数据库层实现

- [ ] **Task 1: recoverStaleMessages() 核心函数实现** (AC: 1, 2)
  - [ ] Subtask 1.1: 在 `src/lib/db.ts` 中添加 `recoverStaleMessages()` 函数定义
  - [ ] Subtask 1.2: 实现陈旧消息识别逻辑（基于状态和更新时间）
  - [ ] Subtask 1.3: 实现消息状态重置为 `pending` 的 SQL 操作
  - [ ] Subtask 1.4: 添加详细的日志记录和错误处理
  - [ ] Subtask 1.5: 编写单元测试，验证函数逻辑正确性

### Phase 2: 队列处理器集成

- [ ] **Task 2: 灾难恢复守护进程集成** (AC: 3)
  - [ ] Subtask 2.1: 在 `src/queue-processor.ts` 启动流程中添加恢复逻辑
  - [ ] Subtask 2.2: 添加启动参数 `--auto-recover` 和环境变量 `TINYCLAW_AUTO_RECOVER`
  - [ ] Subtask 2.3: 实现恢复失败的重试逻辑
  - [ ] Subtask 2.4: 测试启动时自动恢复功能

### Phase 3: API 和监控

- [ ] **Task 3: API 端点和监控** (AC: 8)
  - [ ] Subtask 3.1: 在 `src/server/routes/queue.ts` 中添加手动恢复端点 `POST /api/queue/recover`
  - [ ] Subtask 3.2: 添加恢复统计端点 `GET /api/queue/recovery/stats`
  - [ ] Subtask 3.3: 实现事件发出逻辑（SSE），通知前端恢复状态
  - [ ] Subtask 3.4: 测试 API 端点的功能和性能

### Phase 4: 配置和文档

- [ ] **Task 4: 配置系统和文档** (AC: 9)
  - [ ] Subtask 4.1: 在 `tinyclaw.settings.json` 中添加恢复配置项
  - [ ] Subtask 4.2: 更新 `src/lib/config.ts` 支持恢复配置
  - [ ] Subtask 4.3: 编写详细的使用文档和配置说明
  - [ ] Subtask 4.4: 添加示例配置和最佳实践指南

### Phase 5: 测试和验证

- [ ] **Task 5: 完整测试覆盖** (AC: 10)
  - [ ] Subtask 5.1: 编写单元测试覆盖所有代码路径
  - [ ] Subtask 5.2: 编写集成测试验证恢复操作的正确性
  - [ ] Subtask 5.3: 编写端到端测试模拟灾难场景
  - [ ] Subtask 5.4: 运行所有测试，确保测试通过

---

## 🛠️ Dev Notes

### 相关架构模式

- **事务强一致性消息队列**：基于 SQLite WAL 模式 + `BEGIN IMMEDIATE` 独占事务锁定
- **灾难恢复模式**：通过状态检测和自动恢复保证系统容错性
- **事件驱动架构**：通过 SSE 流实时通知前端恢复状态

### 关键技术实现

#### 1. recoverStaleMessages() 函数实现

```typescript
/**
 * 扫描并恢复所有处于 processing 状态的陈旧消息
 * @param staleThresholdSeconds - 陈旧消息阈值（秒），默认 300 秒
 * @returns 恢复的消息数量
 */
export async function recoverStaleMessages(
  staleThresholdSeconds: number = 300
): Promise<{ recovered: number; failed: number; messages: MessageData[] }> {
  const db = getQueueDb();

  try {
    // 1. 开启事务
    await db.exec('BEGIN IMMEDIATE');

    // 2. 查询所有陈旧消息
    const cutoffTime = Date.now() / 1000 - staleThresholdSeconds;
    const staleMessages = db.prepare(`
      SELECT id, channel, sender, message, status, updated_at
      FROM queue_messages
      WHERE status = 'processing'
        AND updated_at < ?
    `).all(cutoffTime);

    if (staleMessages.length === 0) {
      await db.exec('COMMIT');
      return { recovered: 0, failed: 0, messages: [] };
    }

    log.info(`Found ${staleMessages.length} stale messages to recover`);

    // 3. 批量更新消息状态为 pending
    const messageIds = staleMessages.map(m => m.id);
    const updateStmt = db.prepare(`
      UPDATE queue_messages
      SET status = 'pending', updated_at = unixepoch()
      WHERE id IN (${messageIds.map(() => '?').join(',')})
    `);

    updateStmt.run(...messageIds);

    // 4. 记录审计日志
    const event = {
      type: 'RECOVERY',
      timestamp: Date.now(),
      recovered_count: staleMessages.length,
      message_ids: messageIds,
    };

    emitEvent('recovery_performed', event);

    await db.exec('COMMIT');

    return {
      recovered: staleMessages.length,
      failed: 0,
      messages: staleMessages.map(m => ({
        id: m.id,
        channel: m.channel,
        sender: m.sender,
        message: m.message,
        status: 'pending',
      })),
    };

  } catch (error) {
    await db.exec('ROLLBACK');
    log.error('Failed to recover stale messages:', error);
    throw error;
  }
}
```

#### 2. 灾难恢复守护进程集成

在 `src/queue-processor.ts` 中：

```typescript
async function main() {
  // 1. 初始化数据库
  initQueueDb();

  // 2. 执行灾难恢复（如果配置启用）
  const settings = getSettings();
  if (settings.queue?.auto_recover_on_startup !== false) {
    const recoveryResult = await recoverStaleMessages(
      settings.queue?.stale_threshold_seconds || 300
    );

    if (recoveryResult.recovered > 0) {
      log.info(`Recovered ${recoveryResult.recovered} stale messages`);
    }
  }

  // 3. 启动队列处理器
  startQueueProcessor();
}
```

#### 3. API 端点实现

在 `src/server/routes/queue.ts` 中：

```typescript
// 手动触发恢复
app.post('/api/queue/recover', async (c) => {
  try {
    const { stale_threshold_seconds = 300 } = await c.req.json();
    const result = await recoverStaleMessages(stale_threshold_seconds);

    return c.json({
      success: true,
      recovered: result.recovered,
      failed: result.failed,
      messages: result.messages,
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 恢复统计
app.get('/api/queue/recovery/stats', async (c) => {
  const stats = getRecoveryStats(); // 需要实现统计逻辑
  return c.json(stats);
});
```

### 数据库变更

需要在 `src/lib/db.ts` 的 `initQueueDb()` 中确保 `queue_messages` 表有正确的索引：

```sql
-- 为恢复操作优化查询性能
CREATE INDEX IF NOT EXISTS idx_queue_messages_status_updated
  ON queue_messages(status, updated_at);
```

### 文件结构

- **新增文件：**
  - `src/lib/recovery.ts` - 灾难恢复核心逻辑（可选，如果逻辑复杂）

- **修改文件：**
  - `src/lib/db.ts` - 添加 `recoverStaleMessages()` 函数
  - `src/queue-processor.ts` - 集成灾难恢复守护进程
  - `src/server/routes/queue.ts` - 添加恢复相关的 API 端点
  - `src/lib/config.ts` - 添加恢复配置支持
  - `src/lib/logging.ts` - 添加恢复相关的事件类型

### 测试策略

1. **单元测试：** `test/lib/recovery.test.ts`
   - 测试陈旧消息识别逻辑
   - 测试状态重置操作
   - 测试边界条件（无陈旧消息、所有消息都是陈旧的等）

2. **集成测试：** `test/integration/recovery.test.ts`
   - 测试恢复操作对队列状态的影响
   - 测试并发恢复场景
   - 测试事务回滚机制

3. **端到端测试：** `test/e2e/recovery.test.ts`
   - 模拟系统崩溃后重启
   - 验证消息自动恢复
   - 验证日志记录和事件发出

### 性能考虑

- **批量操作：** 使用批量 UPDATE 语句，避免逐个更新
- **索引优化：** 为 `status` 和 `updated_at` 字段添加复合索引
- **事务管理：** 使用 `BEGIN IMMEDIATE` 确保独占锁定，避免死锁
- **恢复限制：** 支持配置单次恢复的最大消息数量，防止系统过载

### 安全考虑

- **权限控制：** 手动恢复端点需要认证（如果系统有认证机制）
- **审计日志：** 记录所有恢复操作，包括操作人、操作时间、受影响的消息
- **错误处理：** 完善的错误处理机制，防止恢复操作导致数据损坏

---

## 📚 References

- **SQLite WAL 模式：** [docs/architecture-tinyclaw.md#L370-L464](/Users/yongjunwu/trea/jd/docs/architecture-tinyclaw.md#L370-L464)
- **消息队列表设计：** [docs/component-inventory-tinyclaw.md#L280-L293](/Users/yongjunwu/trea/jd/docs/component-inventory-tinyclaw.md#L280-L293)
- **事务强一致性：** [docs/upwork_autopilot_detailed_design.md](/Users/yongjunwu/trea/jd/docs/upwork_autopilot_detailed_design.md) (事务锁定机制)
- **Epic 2b 详细说明：** [_bmad-output/planning-artifacts/epics.md#L103-L116](/Users/yongjunwu/trea/jd/_bmad-output/planning-artifacts/epics.md#L103-L116)
- **数据库操作示例：** [tinyclaw/src/lib/db.ts](/Users/yongjunwu/trea/jd/tinyclaw/src/lib/db.ts) (claimNextMessage, completeMessage 等函数)

---

## 🧪 Edge Cases to Consider

1. **并发恢复：** 多个进程同时尝试恢复同一条消息
   - 解决方案：使用数据库行级锁定，确保只有一个进程能修改消息状态

2. **恢复过程中的系统崩溃：** 恢复操作执行到一半时系统崩溃
   - 解决方案：使用事务保证原子性，崩溃后事务自动回滚

3. **陈旧消息数量过多：** 一次性恢复数千条消息导致系统过载
   - 解决方案：支持配置单次恢复的最大消息数量，分批恢复

4. **消息状态不一致：** 消息状态为 `processing` 但实际已经处理完成
   - 解决方案：在恢复前检查消息的完整性和有效性，避免重复处理

5. **数据库锁定：** 恢复操作导致数据库长时间锁定
   - 解决方案：使用 `BEGIN IMMEDIATE` 独占事务，控制事务执行时间

---

## 🚀 Implementation Tips

1. **先实现核心函数：** 优先完成 `recoverStaleMessages()` 函数的实现和测试
2. **再集成到系统：** 确保核心功能稳定后再集成到队列处理器和 API
3. **最后完善监控：** 添加日志记录、事件发出和统计功能
4. **逐步测试验证：** 每完成一个模块就进行测试，确保功能正确性
5. **参考现有代码：** 参考 `claimNextMessage()` 和 `completeMessage()` 的实现方式

---

## 📝 Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
