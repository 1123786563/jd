# Story 2b.4: 速率限制和安全加固 (Token Bucket + Jitter 防封号)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a TinyClaw 系统管理员,
I want 实现基于 Token Bucket 算法的速率限制系统并集成 Jitter 随机延时机制,
so that 能够有效防止 API 调用超限导致的账号封禁，同时模拟人类行为特征避免被平台检测为机器人。

## Acceptance Criteria

1. **Token Bucket 限流器实现**
   - [ ] 实现 `TokenBucketRateLimiter` 核心类，支持容量设置、补充速率、Token 消费检查
   - [ ] 支持自定义容量 (如 15 次/天) 和补充速率 (如 1 次/小时)
   - [ ] 实现 `consume()` 方法，原子性消费 Token 并返回成功/失败
   - [ ] 实现 `getRemaining()` 方法，返回剩余可用次数
   - [ ] 实现自动补货机制 (`refill()`)，基于时间间隔计算补充量
   - [ ] 集成到 TinyClaw 队列处理器，每次 API 调用前检查限流

2. **Jitter 随机延时引擎**
   - [ ] 实现 `jitterDelay()` 方法，支持三种操作类型：
     - `api_call`: 1-5 秒延迟
     - `message_reply`: 30 秒 - 5 分钟延迟
     - `proposal_submit`: 1-7 分钟延迟
   - [ ] 延迟时间在指定范围内随机生成，模拟人类行为
   - [ ] 集成到消息回复流程，在发送响应前注入随机延迟
   - [ ] 集成到 API 调用流程，在调用外部服务前注入随机延迟

3. **安全加固措施**
   - [ ] 实现输入验证拦截器 (类似 `runIncomingHooks`)，防止恶意输入
   - [ ] 实现输出洗稿引擎 (类似 `ScrubbingHook`)，去除 AI 指纹词
   - [ ] 添加提示词注入防护，使用正则过滤敏感模式
   - [ ] 集成日志记录，所有限流事件和延迟操作需记录审计日志

4. **集成与测试**
   - [ ] 与现有队列处理器 (`queue-processor.ts`) 集成
   - [ ] 与渠道客户端 (Discord/Telegram/WhatsApp/飞书) 集成
   - [ ] 编写单元测试，覆盖限流器逻辑、Jitter 延迟、边界条件
   - [ ] 编写集成测试，验证限流器在实际消息流中的效果
   - [ ] 性能测试，确保限流器不会成为系统瓶颈

5. **监控与告警**
   - [ ] 实现限流状态查询 API 端点 (`GET /api/rate-limit/status`)
   - [ ] 实现告警机制，当剩余次数低于阈值 (如 20%) 时发出警告
   - [ ] 集成到 SSE 事件流，实时推送限流状态变化
   - [ ] 在 TinyOffice 前端仪表盘显示限流器状态

## Tasks / Subtasks

### Task 1: Token Bucket 限流器核心实现 (AC: 1)
- [ ] Subtask 1.1: 创建 `src/lib/rate-limiter.ts` 文件
- [ ] Subtask 1.2: 实现 `TokenBucketRateLimiter` 类 (容量、补充速率、Token 消费)
- [ ] Subtask 1.3: 实现 `refill()` 自动补货逻辑
- [ ] Subtask 1.4: 实现 `consume()` 原子消费方法
- [ ] Subtask 1.5: 实现 `getRemaining()` 查询方法
- [ ] Subtask 1.6: 编写单元测试 (vitest)

### Task 2: Jitter 随机延时引擎实现 (AC: 2)
- [ ] Subtask 2.1: 在 `src/lib/rate-limiter.ts` 中添加 `jitterDelay()` 方法
- [ ] Subtask 2.2: 实现三种延迟范围配置
- [ ] Subtask 2.3: 实现随机延迟生成逻辑
- [ ] Subtask 2.4: 添加延迟执行辅助函数 `sleep()`
- [ ] Subtask 2.5: 编写单元测试 (延迟范围验证、随机性验证)

### Task 3: 安全加固模块实现 (AC: 3)
- [ ] Subtask 3.1: 创建 `src/lib/security/input-validator.ts`
- [ ] Subtask 3.2: 实现输入验证拦截器，过滤恶意模式
- [ ] Subtask 3.3: 创建 `src/lib/security/scrubbing-hook.ts`
- [ ] Subtask 3.4: 实现输出洗稿引擎，去除 AI 指纹词
- [ ] Subtask 3.5: 实现随机拼写错误注入机制 (1% 概率)
- [ ] Subtask 3.6: 实现人类化语气添加功能
- [ ] Subtask 3.7: 编写安全模块单元测试

### Task 4: 与队列处理器集成 (AC: 4, 5)
- [ ] Subtask 4.1: 在 `src/queue-processor.ts` 中集成限流器
- [ ] Subtask 4.2: 在消息处理流程中添加限流检查
- [ ] Subtask 4.3: 在消息回复流程中添加 Jitter 延迟
- [ ] Subtask 4.4: 在 API 调用流程中添加 Jitter 延迟
- [ ] Subtask 4.5: 集成安全拦截器到消息路由流程

### Task 5: API 服务器集成 (AC: 5)
- [ ] Subtask 5.1: 创建 `src/server/routes/rate-limit.ts` 路由文件
- [ ] Subtask 5.2: 实现 `GET /api/rate-limit/status` 端点
- [ ] Subtask 5.3: 实现限流告警推送到 SSE 事件流
- [ ] Subtask 5.4: 更新 TinyOffice 前端仪表盘组件

### Task 6: 测试与验证 (AC: 4)
- [ ] Subtask 6.1: 编写集成测试 (模拟消息流测试限流效果)
- [ ] Subtask 6.2: 编写性能测试 (验证限流器对吞吐量的影响)
- [ ] Subtask 6.3: 手动测试端到端流程 (发送测试消息验证延迟)
- [ ] Subtask 6.4: 压力测试 (高并发场景下限流器稳定性)

## Dev Notes

### 关键技术要求

#### 1. Token Bucket 算法
- **容量**: 默认 15 次/天 (对应 Upwork 投标配额)
- **补充速率**: 1 次/小时 (每小时补充 1 个 Token)
- **实现细节**:
  - 使用 `Date.now()` 追踪上次补货时间
  - 计算经过的小时数: `(now - lastRefill) / (1000 * 60 * 60)`
  - 根据补充速率计算新 Token 数: `elapsedHours * refillRate`
  - 确保总容量不超过上限: `Math.min(capacity, tokens + newTokens)`

#### 2. Jitter 延迟机制
- **API 调用**: 1-5 秒随机延迟
- **消息回复**: 30 秒 - 5 分钟随机延迟
- **投标提交**: 1-7 分钟随机延迟
- **实现**: `Math.random() * (max - min) + min`

#### 3. 安全拦截器
- **输入验证**: 类似 `runIncomingHooks`，在消息处理前执行
- **输出洗稿**: 类似 `runOutgoingHooks`，在响应发送前执行
- **AI 指纹移除**: 使用正则表达式替换常见模式 (如 "Sure, I can", "As an AI")
- **随机拼写错误**: 约 1% 概率注入拼写错误 (如 "the" -> "teh")

### 架构约束

#### 1. 与现有系统集成
- **队列处理器**: 在 `claimNextMessage()` 后添加限流检查
- **消息回复**: 在 `enqueueResponse()` 前添加 Jitter 延迟
- **API 调用**: 在调用外部服务前添加 Jitter 延迟
- **钩子系统**: 利用现有的 `runIncomingHooks` / `runOutgoingHooks` 机制

#### 2. 数据持久化
- **限流状态**: 存储到内存 (无需持久化，重启后重置)
- **审计日志**: 记录到 SQLite `logs` 表
- **告警阈值**: 配置文件中定义 (如 20% 剩余触发告警)

#### 3. 性能要求
- **限流器延迟**: < 1ms (不能成为性能瓶颈)
- **并发支持**: 支持多队列处理器实例 (需考虑分布式锁)
- **内存占用**: < 1MB (轻量级实现)

### 项目结构约束

- **限流器类**: `tinyclaw/src/lib/rate-limiter.ts`
- **安全模块**:
  - `tinyclaw/src/lib/security/input-validator.ts`
  - `tinyclaw/src/lib/security/scrubbing-hook.ts`
- **API 路由**: `tinyclaw/src/server/routes/rate-limit.ts`
- **测试文件**:
  - `tinyclaw/src/lib/__tests__/rate-limiter.test.ts`
  - `tinyclaw/src/lib/__tests__/security.test.ts`

### 测试标准

1. **单元测试覆盖率**: > 90%
2. **集成测试**: 覆盖主要使用场景
3. **边界条件测试**: 容量为 0、补充速率为 0 等
4. **并发测试**: 多线程同时调用 `consume()`

### 安全注意事项

1. **防止绕过**: 限流检查必须在所有外部调用前执行
2. **日志记录**: 所有限流事件需记录审计日志
3. **输入消毒**: 所有外部输入必须经过验证拦截器
4. **错误处理**: 限流失败应抛出明确错误并友好提示

### 参考实现

参考 `upwork_autopilot_detailed_design.md` 中的示例代码：
- Token Bucket 实现: 第 2294-2346 行
- Jitter 引擎: 第 2148-2163 行
- 洗稿引擎: 第 2165-2230 行

## Dev Agent Record

### Agent Model Used

qwen3-max-2026-01-23 (Claude Opus 4.6)

### Debug Log References

### Completion Notes List

### File List

- `tinyclaw/src/lib/rate-limiter.ts` - Token Bucket 限流器核心
- `tinyclaw/src/lib/security/input-validator.ts` - 输入验证拦截器
- `tinyclaw/src/lib/security/scrubbing-hook.ts` - 输出洗稿引擎
- `tinyclaw/src/server/routes/rate-limit.ts` - 限流状态 API 路由
- `tinyclaw/src/__tests__/rate-limiter.test.ts` - 限流器单元测试
- `tinyclaw/src/__tests__/security.test.ts` - 安全模块单元测试
