# Story 4b.8: HITL 审批工作流 - Telegram/Discord 管理界面集成

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **系统管理员/机主 (System Owner)**,
I want **通过 Telegram 和 Discord 收到人工审批通知，并能在消息中直接进行审批操作**,
so that **我可以在移动端快速审批高风险操作，确保系统安全，同时不影响系统的24/7自动化运行**.

## Acceptance Criteria

1. **审批通知推送**
   - 给定系统触发高危操作（大额合同、DAG审批、预算超限、交付审核等）
   - 当 HumanSupervisor 生成审批请求时
   - 那么系统必须通过 Telegram Bot 和/或 Discord Webhook 向管理员发送格式化通知
   - 并且通知必须包含所有关键信息（项目ID、金额、风险等级、操作类型等）
   - 并且通知必须包含可点击的审批按钮（批准/拒绝/修改）

2. **交互式审批界面**
   - 给定管理员收到审批通知
   - 当点击消息中的按钮时
   - 那么系统必须立即处理审批响应
   - 并且更新 `human_approvals` 表的状态
   - 并且向相关 Agent 发送审批完成事件

3. **多渠道支持**
   - 给定系统配置了多个通知渠道（Telegram、Discord）
   - 当发送审批通知时
   - 那么系统必须支持同时向多个渠道推送
   - 并且在任一渠道完成审批后，其他渠道的通知应自动失效或更新状态

4. **审批超时处理**
   - 给定审批请求已发送
   - 当超过预设超时时间（默认30-60分钟）未收到响应
   - 那么系统必须自动拒绝该审批
   - 并且记录超时原因到审计日志
   - 并且触发相应的回滚或通知流程

5. **审批历史与审计**
   - 给定任何审批操作已完成
   - 当查询审批记录时
   - 那么系统必须提供完整的审批历史（审批人、时间、响应时长、决策原因等）
   - 并且支持按项目、时间、操作类型等维度筛选

## Tasks / Subtasks

### Task 1: 审批通知消息生成 (AC: 1)

- [ ] Subtask 1.1: 设计统一的消息模板接口
  - 定义 `ApprovalNotificationPayload` 类型
  - 支持不同审批类型（DAG_REVIEW, KMS_SIGNATURE, BUDGET_OVERRIDE, FINAL_PR_AUDIT）
  - 支持国际化（可选）

- [ ] Subtask 1.2: 实现 Telegram 格式化消息生成
  - 创建 `TelegramNotifier` 类
  - 实现 `formatApprovalMessage()` 方法
  - 支持内联键盘按钮（Inline Keyboard）
  - 支持 Markdown/HTML 格式

- [ ] Subtask 1.3: 实现 Discord 格式化消息生成
  - 创建 `DiscordNotifier` 类
  - 实现 Embed 消息格式化
  - 支持 Action Rows 和 Buttons
  - 支持 Webhook URL 配置

- [ ] Subtask 1.4: 实现通知发送逻辑
  - 实现 `notify()` 方法
  - 处理多个渠道的并行发送
  - 添加发送失败重试机制

### Task 2: 交互式审批处理 (AC: 2)

- [ ] Subtask 2.1: 实现 Telegram 回调处理器
  - 创建 `TelegramApprovalHandler` 类
  - 实现 `handleCallbackQuery()` 方法
  - 验证回调签名和数据完整性
  - 更新审批状态到数据库

- [ ] Subtask 2.2: 实现 Discord 交互处理器
  - 创建 `DiscordApprovalHandler` 类
  - 实现 Interaction 处理
  - 验证 Webhook 签名
  - 更新审批状态到数据库

- [ ] Subtask 2.3: 实现审批状态管理
  - 创建 `ApprovalStateManager` 类
  - 实现 `approve()`, `reject()`, `modify()` 方法
  - 处理并发审批（防重复提交）
  - 触发 `APPROVAL_GRANTED` 或 `APPROVAL_REJECTED` 事件

- [ ] Subtask 2.4: 实现审批超时监控
  - 创建定时任务检查超时审批
  - 实现 `checkTimeouts()` 方法
  - 自动拒绝超时审批并记录原因

### Task 3: 多渠道集成 (AC: 3)

- [ ] Subtask 3.1: 创建渠道抽象层
  - 定义 `NotificationChannel` 接口
  - 实现 `send()`, `handleResponse()` 方法
  - 支持动态启用/禁用渠道

- [ ] Subtask 3.2: 实现渠道协调器
  - 创建 `NotificationCoordinator` 类
  - 管理多个渠道的状态同步
  - 确保一个审批只被处理一次
  - 在其他渠道标记已处理状态

### Task 4: 审计与日志 (AC: 5)

- [ ] Subtask 4.1: 增强审批记录表
  - 添加 `response_time_seconds` 字段
  - 添加 `channel_used` 字段（记录使用哪个渠道）
  - 添加 `device_info` 字段（可选）

- [ ] Subtask 4.2: 实现审批历史查询API
  - 创建 `ApprovalHistoryService` 类
  - 实现 `getApprovalHistory()` 方法
  - 支持分页和过滤
  - 支持导出为 CSV/JSON

- [ ] Subtask 4.3: 添加审计日志集成
  - 与现有审计日志系统集成
  - 记录所有审批操作
  - 支持安全审计追溯

## Dev Notes

### 相关架构模式和约束

**1. Human-in-the-Loop (HITL) 架构模式**
- 系统设计了四个关键的人工介入点（见 `upwork_autopilot_detailed_design.md` 第 3.3 节）：
  - **节点1**: 签约大额抽账拦截 (Accountant → Human)
  - **节点2**: 架构图纸开工审批 (Architect → Human)
  - **节点3**: 全局算力死锁熔断 (Global Tracker → Human)
  - **节点4**: 交付前最终代码审计 (QA → Human)

**2. 审批数据模型**
```sql
CREATE TABLE human_approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL,
    project_id TEXT,
    action_type TEXT NOT NULL,  -- DAG_REVIEW/KMS_SIGNATURE/BUDGET_OVERRIDE/FINAL_AUDIT
    request_payload JSON,
    status TEXT DEFAULT 'pending',  -- pending/approved/rejected/expired
    approved_by TEXT,
    approved_at TIMESTAMP,
    response_time_seconds INTEGER,
    channel_used TEXT,  -- telegram/discord/both
    rejection_reason TEXT,
    timeout_seconds INTEGER DEFAULT 1800,  -- 30分钟默认超时
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**3. 事件驱动架构**
- 审批完成时触发事件：`APPROVAL_GRANTED` 或 `APPROVAL_REJECTED`
- 相关 Agent 监听事件并恢复执行

### 源码树组件

**需要修改的现有组件：**

1. **HumanSupervisor 类** (核心审批管理)
   - 位置：待确定（可能在 automaton/src/agents/ 或 tinyclaw/src/）
   - 新增方法：
     - `notify(channel, payload)` - 发送审批通知
     - `waitForResponse(approvalId, options)` - 阻塞等待响应
     - `requestApproval(options)` - 创建审批请求并发送通知

2. **数据库层**
   - 位置：`automaton/src/db/` 或 `tinyclaw/src/database/`
   - 修改：`human_approvals` 表（添加新字段）
   - 新增：审批历史查询服务

**需要创建的新组件：**

1. **通知层 (Notification Layer)**
   ```
   src/
     notifications/
       index.ts                    # 主入口
       types.ts                    # TypeScript 类型定义
       channel.ts                  # Channel 接口和抽象类

       telegram/
         notifier.ts               # Telegram 消息发送
         handler.ts                # Telegram 回调处理
         types.ts                  # Telegram 专用类型

       discord/
         notifier.ts               # Discord 消息发送
         handler.ts                # Discord 交互处理
         types.ts                  # Discord 专用类型

       coordinator/
         index.ts                  # 渠道协调器
         state-manager.ts          # 状态管理
   ```

2. **审批管理服务 (Approval Management Service)**
   ```
   src/
     approvals/
       index.ts                    # 主服务入口
       manager.ts                  # 审批状态管理
       timeout-monitor.ts          # 超时监控
       history-service.ts          # 历史查询服务
   ```

3. **HTTP 路由层 (如果需要 Web API)**
   ```
   src/
     routes/
       approvals/
         index.ts                  # 审批相关路由
         get-history.ts            # 查询历史
         get-pending.ts            # 查询待审批
   ```

### 测试标准

**1. 单元测试**
- 测试消息格式化（Telegram/Discord）
- 测试审批状态转换逻辑
- 测试超时处理机制
- 测试并发审批防护

**2. 集成测试**
- 测试完整的审批流程（创建 → 通知 → 响应 → 完成）
- 测试多渠道同步
- 测试事件触发和监听
- 测试数据库事务完整性

**3. 端到端测试**
- 模拟真实审批场景
- 测试消息发送和接收
- 测试审批按钮点击
- 测试审批后 Agent 恢复执行

**测试覆盖率目标：**
- 语句覆盖率：≥ 80%
- 分支覆盖率：≥ 70%
- 关键路径覆盖率：100%

### 技术栈与依赖

**Telegram 集成：**
- 使用现有的 Telegram Bot API (版本 0.67.0)
- 利用 `tinyclaw` 项目中已有的 Telegram 客户端代码
- 参考：`tinyclaw/src/clients/telegram/`

**Discord 集成：**
- 使用现有的 Discord.js (版本 14.16.0)
- 利用 `tinyclaw` 项目中已有的 Discord 客户端代码
- 参考：`tinyclaw/src/clients/discord/`

**数据库：**
- SQLite (better-sqlite3)
- 使用预处理语句防止 SQL 注入
- 使用事务保证数据一致性

### 安全考虑

1. **回调签名验证**
   - Telegram: 验证 `callback_query` 的数据签名
   - Discord: 验证 Interactions 的 Webhook 签名
   - 防止伪造审批响应

2. **审批权限控制**
   - 只有授权的管理员可以审批
   - 验证审批人的身份
   - 记录审批人信息到审计日志

3. **敏感信息保护**
   - 审批通知中的敏感数据需要脱敏
   - 避免在日志中暴露审批内容
   - 使用环境变量存储 Bot Token

### 性能考虑

1. **消息发送性能**
   - 并行发送到多个渠道
   - 添加超时控制（默认 5 秒）
   - 失败重试策略（最多 3 次）

2. **数据库查询优化**
   - 为 `human_approvals` 表添加索引
   - 定期清理过期的审批记录
   - 使用连接池管理数据库连接

3. **事件处理优化**
   - 使用发布/订阅模式
   - 避免阻塞主线程
   - 使用异步处理

### 项目结构说明

**对齐统一项目结构：**

1. **automaton 项目**
   - 如果审批系统属于核心智能体运行时，代码应放在 `automaton/src/`
   - 遵循 ESM 模块系统（导入时使用 `.js` 扩展名）
   - 使用 pnpm 作为包管理器

2. **tinyclaw 项目**
   - 如果审批系统属于消息推送层，代码应放在 `tinyclaw/src/`
   - 遵循 CommonJS 模块系统（导入时不带扩展名）
   - 使用 npm 作为包管理器

**推荐方案：**
- 审批核心逻辑放在 `automaton/src/approvals/` (核心业务逻辑)
- 通知发送逻辑放在 `tinyclaw/src/notifications/` (渠道集成层)
- 通过事件或 API 进行通信

### 已知问题和风险

1. **多渠道重复审批**
   - 风险：用户在 Telegram 和 Discord 上都点击了按钮
   - 缓解：实现分布式锁或状态检查，确保只处理第一次响应

2. **消息丢失**
   - 风险：Telegram/Discord API 临时不可用导致消息未送达
   - 缓解：添加消息队列和重试机制，添加备用通知渠道（如邮件）

3. **审批超时**
   - 风险：管理员长时间未响应导致项目阻塞
   - 缓解：实现合理的超时策略，默认 30-60 分钟，可配置

### 实施建议

1. **第一阶段（MVP）**
   - 实现 Telegram 单渠道审批
   - 支持基本的批准/拒绝操作
   - 实现审批超时处理

2. **第二阶段（增强）**
   - 添加 Discord 渠道支持
   - 实现多渠道同步
   - 添加审批历史查询

3. **第三阶段（优化）**
   - 添加 Web 管理界面（可选）
   - 实现审批统计和报表
   - 集成更多通知渠道（邮件、短信等）

### 参考资料

- [Source: docs/upwork_autopilot_detailed_design.md#3.3] - 人工介入点详细设计 (HITL)
- [Source: docs/upwork_autopilot_detailed_design.md#4.1] - 流程 4: 人工审批 (HITL) 时序图
- [Source: docs/upwork_autopilot_detailed_design.md#3.2.8] - HumanSupervisor 组件说明
- [Source: docs/architecture-tinyclaw.md] - TinyClaw 消息推送架构
- [Source: docs/project-context.md] - 项目技术栈和规则
- [Source: docs/component-inventory-tinyclaw.md] - 现有渠道客户端组件

### 关键决策点

1. **审批数据存储位置**
   - 选项 A：存储在 automaton 数据库（与项目数据一起）
   - 选项 B：存储在 tinyclaw 数据库（与消息数据一起）
   - 选项 C：独立的审批数据库
   - **推荐：选项 A**，审批是核心业务逻辑的一部分

2. **审批状态同步机制**
   - 选项 A：通过数据库轮询
   - 选项 B：通过事件总线（Redis Pub/Sub）
   - 选项 C：通过 HTTP Webhook
   - **推荐：选项 B**，实时性好，解耦程度高

3. **审批按钮实现方式**
   - Telegram：使用 Inline Keyboard Buttons
   - Discord：使用 Action Rows 和 Buttons
   - 两者都支持回调数据，可以携带审批 ID 和操作类型

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- 会话开始时间：2026-03-04
- 文档分析：upwork_autopilot_detailed_design.md, upwork_autopilot_architecture.md, project-context.md
- 关键概念提取：HITL, HumanSupervisor, Approval Workflow, Telegram/Discord Integration

### Completion Notes List

- ✅ 用户需求分析完成
- ✅ 相关文档阅读完成（upwork_autopilot_detailed_design.md 第 3.3 节）
- ✅ 审批流程理解完成（四个关键节点）
- ✅ 技术栈确认（Telegram Bot API 0.67.0, Discord.js 14.16.0）
- ✅ 数据库模型设计完成
- ✅ 组件结构规划完成
- ✅ 测试策略制定完成

### File List

**待创建文件：**

1. **核心审批逻辑** (automaton/src/)
   - `automaton/src/approvals/index.ts`
   - `automaton/src/approvals/manager.ts`
   - `automaton/src/approvals/timeout-monitor.ts`
   - `automaton/src/approvals/history-service.ts`
   - `automaton/src/approvals/types.ts`

2. **通知层** (tinyclaw/src/)
   - `tinyclaw/src/notifications/index.ts`
   - `tinyclaw/src/notifications/channel.ts`
   - `tinyclaw/src/notifications/coordinator/index.ts`
   - `tinyclaw/src/notifications/coordinator/state-manager.ts`

3. **Telegram 集成** (tinyclaw/src/)
   - `tinyclaw/src/notifications/telegram/notifier.ts`
   - `tinyclaw/src/notifications/telegram/handler.ts`
   - `tinyclaw/src/notifications/telegram/types.ts`

4. **Discord 集成** (tinyclaw/src/)
   - `tinyclaw/src/notifications/discord/notifier.ts`
   - `tinyclaw/src/notifications/discord/handler.ts`
   - `tinyclaw/src/notifications/discord/types.ts`

5. **数据库迁移**
   - `automaton/migrations/20260304_add_approval_fields.sql`
   - 或使用 TypeScript 迁移脚本

6. **测试文件**
   - `automaton/src/approvals/__tests__/manager.test.ts`
   - `automaton/src/approvals/__tests__/timeout-monitor.test.ts`
   - `tinyclaw/src/notifications/__tests__/telegram/notifier.test.ts`
   - `tinyclaw/src/notifications/__tests__/discord/notifier.test.ts`

7. **配置文件**
   - `automaton/src/config/approval.ts` - 审批配置
   - `tinyclaw/src/config/notifications.ts` - 通知配置

8. **文档**
   - `docs/implementation/4b-8-approval-workflow.md` - 实施文档
   - `docs/api/approval-api.md` - API 文档（可选）

---

**Story 创建完成时间：** 2026-03-04
**状态：** ready-for-dev
**下一步：** 运行 `dev-story` 开始实施
