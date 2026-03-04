# Story 4b.7: 人工介入点设计与实现 - 四大 HITL 节点完整实现

Status: ready-for-dev

## Story

作为系统管理员，我想要实现四大人工介入点(Human-in-the-Loop)节点，以便在高风险操作前获取人工审批，从而防止自动化系统出现不可挽回的错误。

## Acceptance Criteria

1. **节点1: 签约大额抽账拦截**
   - [ ] 当合同金额超过预设阈值（默认 $5000）时触发
   - [ ] 冻结订单状态为 `pending_approval`
   - [ ] 发送紧急通知到 Telegram，包含项目详情和风险提示
   - [ ] 阻塞等待人工响应（超时 60 分钟）
   - [ ] 审批界面包含批准/拒绝/修改预算选项
   - [ ] 记录审批历史到 `human_approvals` 表

2. **节点2: 架构图纸开工审批**
   - [ ] ArchitectAgent 完成 DAG 生成后触发
   - [ ] 通过内部 QA Dry-Run 验证后触发
   - [ ] 发送审批请求包含：节点数量、预估成本、技术栈、DAG 可视化图
   - [ ] 阻塞等待人工响应（超时 30 分钟）
   - [ ] 拒绝时记录原因到 `dag_reviews` 表并返回重新生成
   - [ ] 批准时继续下发 DevAgent 执行

3. **节点3: 全局算力死锁熔断**
   - [ ] Token 消耗达到警戒线（90%）时触发警告
   - [ ] Token 消耗达到临界线（95%）时触发熔断
   - [ ] 停止所有 Agent 处理（`queueProcessor.pauseAll()`）
   - [ ] 记录审计日志（`CIRCUIT_BREAKER_TRIGGERED`）
   - [ ] 发送紧急告警到 Telegram（包含使用率、当前消耗）
   - [ ] 抛出 `CircuitBreakerError` 阻止进一步操作

4. **节点4: 交付前最终代码审计**
   - [ ] 所有 TaskNode 状态为 `completed` 时触发
   - [ ] 单元测试和集成测试全部通过时触发
   - [ ] 发送审计材料包含：代码审查、测试结果、安全扫描、性能指标、文档检查
   - [ ] 审计清单必须全部勾选通过
   - [ ] 人工批准后才能打包发布
   - [ ] 记录审计结果到 `human_approvals` 表

5. **人工审批基础设施**
   - [ ] 实现 `HumanSupervisor` 类，包含 `notify()`, `requestApproval()`, `waitForResponse()`, `sendEmergencyAlert()` 方法
   - [ ] 集成 Telegram/Discord 通知渠道
   - [ ] 实现审批响应队列和超时机制
   - [ ] 创建 `human_approvals` 数据库表（包含所有字段：conversation_id, project_id, action_type, request_payload, status, approved_by, approved_at, response_time_seconds, rejection_reason）
   - [ ] 实现审批历史查询和统计功能
   - [ ] 支持批量审批和紧急干预

## Tasks / Subtasks

### Task 1: 数据库和基础设施准备 (AC: 5)
- [ ] Task 1.1: 创建 `human_approvals` 数据库迁移脚本
  - [ ] 实现完整的表结构（10 个字段 + 索引）
  - [ ] 添加 action_type 枚举值常量定义
  - [ ] 编写数据库操作封装类（HumanApprovalRepository）
- [ ] Task 1.2: 实现审批历史查询和统计
  - [ ] 实现按项目、日期、状态查询
  - [ ] 实现审批响应时间统计
  - [ ] 实现拒绝率和通过率统计

### Task 2: HumanSupervisor 核心类实现 (AC: 1, 2, 3, 4)
- [ ] Task 2.1: 实现基础通知和审批请求方法
  - [ ] 实现 `notify()` 方法（支持不同渠道：telegram/discord）
  - [ ] 实现 `requestApproval()` 方法（返回 approval_id）
  - [ ] 实现 `waitForResponse()` 方法（阻塞等待，支持超时）
  - [ ] 实现 `sendEmergencyAlert()` 方法（紧急告警）
- [ ] Task 2.2: 实现审批响应处理机制
  - [ ] 实现响应队列（Map<approval_id, Promise>）
  - [ ] 实现超时自动拒绝逻辑
  - [ ] 实现人工响应解析（Telegram webhook 回调）
  - [ ] 实现审批状态更新（pending/approved/rejected）

### Task 3: 节点1实现 - 签约大额抽账拦截 (AC: 1)
- [ ] Task 3.1: 实现大额金额检测逻辑
  - [ ] 读取配置文件中的阈值（默认 $5000）
  - [ ] 监听 AccountantAgent 的合同签署事件
  - [ ] 检查合同金额是否超过阈值
- [ ] Task 3.2: 实现审批流程
  - [ ] 冻结订单状态（UPDATE projects SET status='pending_approval'）
  - [ ] 构建审批消息（包含项目详情、风险提示）
  - [ ] 发送 Telegram 审批请求
  - [ ] 阻塞等待响应（60 分钟超时）
  - [ ] 执行 KMS 签名（批准时）
  - [ ] 继续业务流程（批准时）

### Task 4: 节点2实现 - 架构图纸开工审批 (AC: 2)
- [ ] Task 4.1: 实现 DAG 审批触发
  - [ ] 监听 ArchitectAgent 的 DAG 生成完成事件
  - [ ] 等待 QA Dry-Run 验证通过
- [ ] Task 4.2: 实现审批请求构建
  - [ ] 生成 DAG 可视化图（使用 Mermaid 或 Graphviz）
  - [ ] 计算预估成本（Token 消耗 + 时间预估）
  - [ ] 收集技术栈选型信息
  - [ ] 构建审批 payload
- [ ] Task 4.3: 实现审批流程和拒绝处理
  - [ ] 发送 Telegram 审批请求
  - [ ] 阻塞等待响应（30 分钟超时）
  - [ ] 批准时下发 DevAgent
  - [ ] 拒绝时记录 `dag_reviews` 表
  - [ ] 返回 ArchitectAgent 重新生成

### Task 5: 节点3实现 - 全局算力死锁熔断 (AC: 3)
- [ ] Task 5.1: 实现 GlobalSpendTracker 增强
  - [ ] 添加 WARNING_THRESHOLD (0.9) 和 CRITICAL_THRESHOLD (0.95)
  - [ ] 实现 `interceptLLMUsage()` 方法
  - [ ] 实现 `sendBudgetWarning()` 方法
  - [ ] 实现 `triggerCircuitBreaker()` 方法
- [ ] Task 5.2: 实现熔断流程
  - [ ] 调用 `queueProcessor.pauseAll()` 停止所有处理
  - [ ] 记录审计日志（CIRCUIT_BREAKER_TRIGGERED）
  - [ ] 发送紧急告警到 Telegram
  - [ ] 抛出 `CircuitBreakerError`

### Task 6: 节点4实现 - 交付前最终代码审计 (AC: 4)
- [ ] Task 6.1: 实现审计触发条件检查
  - [ ] 检查所有 TaskNode 状态是否为 `completed`
  - [ ] 检查测试结果是否全部通过
  - [ ] 检查是否准备打包发布
- [ ] Task 6.2: 实现审计材料收集
  - [ ] 实现 `generateCodeReview()` 方法
  - [ ] 实现 `getTestResults()` 方法
  - [ ] 实现 `runSecurityScan()` 方法
  - [ ] 实现 `getPerformanceMetrics()` 方法
  - [ ] 实现 `checkDocumentation()` 方法
- [ ] Task 6.3: 实现审计审批流程
  - [ ] 构建审计材料 payload
  - [ ] 发送 Telegram 审批请求
  - [ ] 阻塞等待人工响应
  - [ ] 全部通过后允许打包发布

### Task 7: Telegram/Discord 集成 (AC: 5)
- [ ] Task 7.1: 实现 Telegram 审批机器人
  - [ ] 创建审批消息模板（Markdown 格式）
  - [ ] 实现按钮回调处理（批准/拒绝/修改）
  - [ ] 实现审批响应解析
  - [ ] 实现审批状态更新
- [ ] Task 7.2: 实现 Discord 审批集成（可选）
  - [ ] 创建 Discord 审批消息
  - [ ] 实现响应解析
  - [ ] 实现状态更新

### Task 8: 测试和验证
- [ ] Task 8.1: 单元测试
  - [ ] 测试 `HumanSupervisor` 核心方法
  - [ ] 测试审批超时机制
  - [ ] 测试响应解析
- [ ] Task 8.2: 集成测试
  - [ ] 测试节点1大额审批流程
  - [ ] 测试节点2 DAG 审批流程
  - [ ] 测试节点3熔断流程
  - [ ] 测试节点4审计流程
- [ ] Task 8.3: 端到端测试
  - [ ] 模拟完整审批流程
  - [ ] 测试超时自动拒绝
  - [ ] 测试紧急干预

## Dev Notes

### 架构模式和约束

**核心技术栈：**
- TypeScript 5.0+ (项目统一使用)
- SQLite (WAL 模式，用于 `human_approvals` 表)
- Telegram Bot API (主要通知渠道)
- Discord.js (可选通知渠道)
- Node.js 20.0.0+ (项目统一版本)
- express (审批回调 webhook)
- node-cron (可选，用于超时检查)

**设计模式：**
- **观察者模式**：监听 Agent 事件触发审批
- **策略模式**：支持不同审批策略（紧急/普通）
- **命令模式**：审批请求和响应封装
- **责任链模式**：多级审批流程（可扩展）

**关键约束：**
1. **阻塞等待**：关键审批必须阻塞业务流程
2. **超时机制**：所有审批必须有超时限制
3. **审计追踪**：所有审批操作必须记录日志
4. **幂等性**：审批响应处理必须幂等
5. **线程安全**：审批队列必须线程安全

### 源代码树组件影响

**需要创建的新文件：**
```
tinyclaw/src/
├── supervisors/
│   ├── human-supervisor.ts          # HumanSupervisor 核心类
│   ├── approval-queue.ts            # 审批队列管理
│   └── emergency-alert.ts           # 紧急告警系统
├── services/
│   ├── approval-service.ts          # 审批服务封装
│   └── audit-service.ts             # 审计服务
├── integrations/
│   ├── telegram/
│   │   └── approval-bot.ts          # Telegram 审批机器人
│   └── discord/
│       └── approval-integration.ts  # Discord 审批集成（可选）
└── types/
    └── approval.ts                  # 审批类型定义

tinyclaw/lib/
├── db/
│   └── migrations/
│       └── 007_human_approvals.sql  # human_approvals 表迁移
└── repositories/
    └── human-approval-repository.ts # 数据库操作封装

automaton/src/
├── supervisors/
│   └── global-spend-tracker.ts      # 增强的 GlobalSpendTracker
└── types/
    └── approval-types.ts            # 跨项目审批类型共享
```

**需要修改的现有文件：**
```
tinyclaw/src/
├── agents/
│   ├── accountant-agent.ts          # 添加大额检测
│   └── architect-agent.ts           # 添加 DAG 审批触发
├── processors/
│   └── queue-processor.ts           # 添加 pauseAll() 方法
└── lib/
    └── db.ts                        # 添加 human_approvals 表

automaton/src/
└── orchestration/
    └── orchestrator.ts              # 添加审计触发
```

### 测试标准

**单元测试要求：**
- 所有核心类必须有单元测试
- 覆盖率 >= 85%
- 测试审批超时机制
- 测试响应解析逻辑

**集成测试要求：**
- 测试完整审批流程
- 测试数据库操作
- 测试 Telegram/Discord 集成
- 测试错误处理和回滚

**端到端测试要求：**
- 模拟人工审批场景
- 测试超时自动拒绝
- 测试紧急干预
- 验证审计日志完整性

### Project Structure Notes

**文件组织一致性：**
- 所有 supervisors 放在 `tinyclaw/src/supervisors/`
- 所有 services 放在 `tinyclaw/src/services/`
- 数据库迁移脚本统一在 `tinyclaw/lib/db/migrations/`
- 类型定义统一在 `tinyclaw/src/types/` 或对应模块的 types 目录

**命名规范：**
- 类名：PascalCase (HumanSupervisor)
- 文件名：kebab-case (human-supervisor.ts)
- 方法名：camelCase (requestApproval)
- 常量：UPPER_SNAKE_CASE (WARNING_THRESHOLD)

**模块边界：**
- `tinyclaw` 负责审批基础设施和通知
- `automaton` 负责触发审批（通过事件）
- 数据库操作统一在 `lib/repositories/`
- 通知集成统一在 `integrations/`

### References

**核心文档：**
- [Source: docs/upwork_autopilot_detailed_design.md#Section 3.3] 四大人工介入节点详细设计
- [Source: docs/upwork_autopilot_detailed_design.md#Section 4.1] 核心业务流程时序图（流程2、流程4）
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 4b] 安全与合规 Epic 定义

**关键实现细节：**
- [Source: docs/upwork_autopilot_detailed_design.md#Line 771-830] 节点1大额抽账代码示例
- [Source: docs/upwork_autopilot_detailed_design.md#Line 832-883] 节点2 DAG 审批代码示例
- [Source: docs/upwork_autopilot_detailed_design.md#Line 885-942] 节点3熔断代码示例
- [Source: docs/upwork_autopilot_detailed_design.md#Line 944-983] 节点4代码审计代码示例
- [Source: docs/upwork_autopilot_detailed_design.md#Line 989-1003] human_approvals 表结构

**架构约束：**
- [Source: docs/architecture-tinyclaw.md] TinyClaw 架构设计
- [Source: docs/architecture-automaton.md] Automaton 架构设计
- [Source: docs/development-guide-tinyclaw.md] TinyClaw 开发规范
- [Source: docs/development-guide-automaton.md] Automaton 开发规范

### 技术实现要点

**1. HumanSupervisor 核心类设计：**
```typescript
class HumanSupervisor {
  private approvalQueue: Map<string, ApprovalRequest>;
  private responsePromises: Map<string, {
    resolve: (response: ApprovalResponse) => void;
    reject: (error: Error) => void;
  }>;

  async requestApproval(type: ApprovalType, payload: any): Promise<string> {
    // 生成唯一审批ID
    // 保存到数据库
    // 发送通知
    // 返回审批ID
  }

  async waitForResponse(approvalId: string, timeout?: number): Promise<ApprovalResponse> {
    // 创建Promise并保存到队列
    // 设置超时定时器
    // 等待人工响应
  }

  // Telegram webhook 回调处理
  async handleTelegramResponse(update: TelegramUpdate): Promise<void> {
    // 解析审批ID和操作
    // 查找对应的Promise
    // resolve/reject Promise
    // 更新数据库状态
  }
}
```

**2. 审批队列管理：**
- 使用 Map 存储审批请求和响应Promise
- 每个审批请求有唯一ID（UUID）
- 响应Promise支持超时自动reject
- 线程安全：使用 async/await 保证顺序

**3. 数据库表设计要点：**
- `action_type` 枚举：DAG_REVIEW | KMS_SIGNATURE | BUDGET_OVERRIDE | FINAL_AUDIT
- `status` 枚举：pending | approved | rejected
- `request_payload` 使用 JSON 存储
- 添加索引：conversation_id, project_id, status, created_at

**4. Telegram 审批界面设计：**
- 使用 Markdown 格式化消息
- 使用 inline_keyboard 实现按钮（批准/拒绝/修改）
- 消息包含完整审批信息
- 响应包含审批时间戳

**5. 审计日志记录：**
- 所有审批操作记录到数据库
- 记录审批响应时间
- 记录拒绝原因（如果拒绝）
- 支持后续审计和统计分析

## Dev Agent Record

### Agent Model Used

Claude 4.6 Opus (qwen3-max-2026-01-23)

### Debug Log References

N/A

### Completion Notes List

1. **关键依赖**：需要先确保 Telegram Bot 配置正确
2. **数据库迁移**：需要运行迁移脚本创建 human_approvals 表
3. **测试重点**：超时机制和并发审批处理
4. **扩展性**：设计支持未来添加更多审批节点
5. **安全考虑**：审批权限需要严格控制，防止滥用

### File List

**新创建文件：**
- tinyclaw/src/supervisors/human-supervisor.ts
- tinyclaw/src/supervisors/approval-queue.ts
- tinyclaw/src/supervisors/emergency-alert.ts
- tinyclaw/src/services/approval-service.ts
- tinyclaw/src/services/audit-service.ts
- tinyclaw/src/integrations/telegram/approval-bot.ts
- tinyclaw/src/integrations/discord/approval-integration.ts
- tinyclaw/src/types/approval.ts
- tinyclaw/lib/db/migrations/007_human_approvals.sql
- tinyclaw/lib/repositories/human-approval-repository.ts
- automaton/src/supervisors/global-spend-tracker.ts (增强)
- automaton/src/types/approval-types.ts

**修改文件：**
- tinyclaw/src/agents/accountant-agent.ts
- tinyclaw/src/agents/architect-agent.ts
- tinyclaw/src/processors/queue-processor.ts
- tinyclaw/src/lib/db.ts
- automaton/src/orchestration/orchestrator.ts

**测试文件：**
- tinyclaw/tests/unit/supervisors/human-supervisor.test.ts
- tinyclaw/tests/unit/services/approval-service.test.ts
- tinyclaw/tests/integration/approval-flow.test.ts
- tinyclaw/tests/e2e/human-intervention.test.ts
