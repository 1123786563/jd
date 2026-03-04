# Story 1c.6: 异常回流与自愈机制

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **智能体系统开发者**,
I want **实现异常回流与自愈机制，支持四大错误类型（COMPILATION_ERROR / LOGIC_ERROR / REQUIREMENT_MISMATCH / ARCHITECTURE_FLAW）**,
so that **智能体在遇到错误时能够自动检测、分类、回流到适当阶段并触发自愈流程，确保系统稳定性和可靠性**.

---

## 🎯 业务目标与价值

### 核心价值
- **系统稳定性**：自动检测并恢复智能体错误状态，避免永久性故障
- **容错能力**：支持四大错误类型识别和分类处理
- **自愈机制**：无需人工干预即可恢复常见错误
- **可观测性**：完整记录错误回流路径和处理结果

### 商业价值
- 减少系统宕机时间 90%+
- 降低人工运维成本
- 提升智能体系统的鲁棒性
- 为生产环境提供企业级可靠性保障

---

## 📋 验收标准

### 功能性要求

1. **[AC-1]** 错误检测与分类系统
   - ✅ 能够检测并识别四大错误类型：COMPILATION_ERROR / LOGIC_ERROR / REQUIREMENT_MISMATCH / ARCHITECTURE_FLAW
   - ✅ 错误分类准确率 ≥ 95%
   - ✅ 支持错误模式匹配和规则引擎
   - ✅ **安全：严格验证错误文件路径，防止路径遍历攻击**

2. **[AC-2]** COMPILATION_ERROR 回流处理
   - ✅ 检测到编译错误时，自动回流到代码生成阶段
   - ✅ 触发代码修复和重新编译流程
   - ✅ 记录编译错误详细信息（文件、行号、错误描述）
   - ✅ **安全：错误文件路径限制在工作目录内，防止越权访问**

3. **[AC-3]** LOGIC_ERROR 回流处理
   - ✅ 检测到逻辑错误时，回流到推理/决策阶段
   - ✅ 重新分析上下文并生成新的推理路径
   - ✅ 支持逻辑错误的自动诊断和修复建议

4. **[AC-4]** REQUIREMENT_MISMATCH 回流处理
   - ✅ 检测到需求不匹配时，回流到需求分析/规划阶段
   - ✅ 重新解析用户意图和需求
   - ✅ 更新任务规划并调整执行策略

5. **[AC-5]** ARCHITECTURE_FLAW 回流处理
   - ✅ 检测到架构缺陷时，回流到架构设计/编排阶段
   - ✅ 重新评估系统架构和组件依赖
   - ✅ 触发架构修复和组件重建流程

6. **[AC-6]** 自愈机制实现
   - ✅ 支持错误自动修复（无需人工干预）
   - ✅ 修复失败时自动升级到更高层次（如人工介入）
   - ✅ 修复成功后自动恢复执行流程
   - ✅ **安全：添加全局错误计数器，防止熔断器绕过攻击**
   - ✅ **循环依赖防护：最大回流深度限制为 3 层**
   - ✅ **回滚机制：回流失败后保证状态一致性，提供事务性回滚**

7. **[AC-7]** 回流路径追踪
   - ✅ 完整记录每次错误回流的路径（从哪里来、到哪里去）
   - ✅ 记录回流原因、处理结果、耗时
   - ✅ 支持可视化回流路径图

8. **[AC-8]** 错误恢复限流与熔断
   - ✅ 同一错误连续失败 3 次后触发熔断机制
   - ✅ 自动暂停相关智能体处理，避免雪崩效应
   - ✅ 熔断后需要人工介入或超时自动恢复

### 非功能性要求

9. **[AC-9]** 性能要求
   - ✅ 错误检测延迟 ≤ 100ms
   - ✅ 回流处理延迟 ≤ 500ms
   - ✅ 自愈流程完成时间 ≤ 5秒（简单错误）

10. **[AC-10]** 可观测性
    - ✅ 完整的错误审计日志（包含错误类型、回流路径、处理结果）
    - ✅ 支持实时监控错误回流状态
    - ✅ 提供错误统计和趋势分析

11. **[AC-11]** 安全性
    - ✅ 错误信息不泄露敏感数据（脱敏处理）
    - ✅ 回流机制具备权限验证
    - ✅ 防止恶意触发回流攻击（速率限制）
    - ✅ **防止路径遍历攻击：严格验证文件路径**
    - ✅ **防止熔断器绕过：全局错误计数器+类型聚合**
    - ✅ **防止日志注入：错误消息转义和长度限制**
    - ✅ **审计追踪：所有回流操作必须记录审计日志**

12. **[AC-12]** 兼容性
    - ✅ 与现有 Conway Automaton 架构完全兼容
    - ✅ 与 TinyClaw 智能体系统无缝集成
    - ✅ 支持多智能体协同场景下的错误处理

---

## 🛠️ 任务分解

### 任务 1: 错误检测与分类系统 (AC: 1)
- [ ] 1.1 设计错误类型枚举和数据结构
  - 定义 ErrorType 枚举（COMPILATION_ERROR / LOGIC_ERROR / REQUIREMENT_MISMATCH / ARCHITECTURE_FLAW）
  - 设计 ErrorDetails 接口（包含错误类型、消息、堆栈、上下文）
  - 实现错误分类规则引擎
- [ ] 1.2 实现错误检测器（ErrorDetector）
  - 分析错误消息模式（正则表达式匹配）
  - 基于堆栈追踪识别错误类型
  - 实现错误置信度评分机制
- [ ] 1.3 集成到智能体循环
  - 在 Agent Loop 中添加错误检测中间件
  - 拦截异常并触发分类流程
  - 记录错误检测结果到审计日志

### 任务 2: COMPILATION_ERROR 回流实现 (AC: 2)
- [ ] 2.1 编译错误检测模块
  - 识别 TypeScript/JavaScript 编译错误
  - 提取错误文件路径、行号、列号
  - 分析错误类型（语法错误、类型错误、导入错误等）
- [ ] 2.2 编译回流处理器
  - 实现 CompilationErrorReflowHandler
  - 回流到代码生成阶段（invokeAgent 重新生成代码）
  - 应用修复策略（语法修正、类型补全、依赖导入）
- [ ] 2.3 自动修复与重试
  - 生成修复后的代码
  - 重新编译验证
  - 修复成功后继续执行流程
- [ ] 2.4 测试编译错误场景
  - 模拟语法错误
  - 模拟类型不匹配
  - 验证回流和修复流程

### 任务 3: LOGIC_ERROR 回流实现 (AC: 3)
- [ ] 3.1 逻辑错误检测模块
  - 识别运行时逻辑异常（空指针、边界条件、状态不一致）
  - 检测无限循环或死锁迹象
  - 分析决策逻辑错误（条件判断错误、循环逻辑错误）
- [ ] 3.2 逻辑回流处理器
  - 实现 LogicErrorReflowHandler
  - 回流到推理/决策阶段（重新调用 LLM）
  - 提供错误上下文和修复提示
- [ ] 3.3 上下文重建
  - 保留当前会话状态
  - 重新构建推理上下文
  - 避免重复错误路径
- [ ] 3.4 测试逻辑错误场景
  - 模拟空指针异常
  - 模拟边界条件错误
  - 验证推理重建流程

### 任务 4: REQUIREMENT_MISMATCH 回流实现 (AC: 4)
- [ ] 4.1 需求不匹配检测模块
  - 识别用户意图与实际执行的偏差
  - 检测任务目标未达成的情况
  - 分析需求冲突或模糊不清
- [ ] 4.2 需求回流处理器
  - 实现 RequirementMismatchReflowHandler
  - 回流到需求分析/规划阶段（重新调用 planGoal）
  - 重新解析用户输入和需求
- [ ] 4.3 任务规划更新
  - 生成新的任务规划
  - 调整执行策略
  - 验证新规划的可行性
- [ ] 4.4 测试需求不匹配场景
  - 模拟模糊需求
  - 模拟冲突需求
  - 验证重新规划流程

### 任务 5: ARCHITECTURE_FLAW 回流实现 (AC: 5)
- [ ] 5.1 架构缺陷检测模块
  - 识别组件依赖循环或缺失
  - 检测性能瓶颈或资源泄漏
  - 分析架构设计不合理（职责不清、耦合过紧）
- [ ] 5.2 架构回流处理器
  - 实现 ArchitectureFlawReflowHandler
  - 回流到架构设计/编排阶段（重新调用 orchestrator）
  - 重新评估系统架构和组件布局
- [ ] 5.3 架构修复与重建
  - 生成架构优化建议
  - 触发组件重建或重构
  - 验证架构修复效果
- [ ] 5.4 测试架构缺陷场景
  - 模拟依赖循环
  - 模拟性能瓶颈
  - 验证架构重建流程

### 任务 6: 自愈机制核心实现 (AC: 6)
- [ ] 6.1 自愈引擎设计
  - 实现 SelfHealingEngine 核心类
  - 定义自愈策略接口（ISelfHealingStrategy）
  - 实现策略注册和选择机制
- [ ] 6.2 错误修复流程
  - 设计修复流程状态机（detected → classified → handled → recovered/failure）
  - 实现修复尝试计数器（最多 3 次）
  - **🔴 新增：实现最大回流深度限制（最多 3 层，防止循环依赖）**
  - **🔴 新增：实现回流路径去重机制，避免无限循环**
  - 失败后自动升级处理（人工介入或熔断）
- [ ] 6.3 恢复验证机制
  - 验证修复后的系统状态
  - 确认错误是否真正解决
  - 记录修复结果和效果
- [ ] 6.4 回滚机制实现（新增）
  - **🔴 新增：事务性回滚设计，保证状态一致性**
  - **🔴 新增：回滚检查点（checkpoint）管理**
  - **🔴 新增：失败回滚到安全状态**
- [ ] 6.5 测试自愈流程
  - 模拟各种错误修复场景
  - 验证升级处理逻辑
  - 性能压力测试

### 任务 7: 回流路径追踪系统 (AC: 7)
- [ ] 7.1 回流追踪器实现
  - 实现 ReflowTracker 核心类
  - 设计追踪数据结构（路径节点、时间戳、状态）
  - 记录完整的回流路径（from → to → reason → result）
- [ ] 7.2 审计日志集成
  - 集成到现有审计日志系统（src/self-mod/audit-log.ts）
  - 记录回流事件和处理结果
  - 支持日志查询和分析
- [ ] 7.3 可视化支持
  - 生成回流路径的 Mermaid 图
  - 提供追踪数据的 JSON 格式
  - 支持实时追踪查询接口
- [ ] 7.4 测试追踪功能
  - 验证路径记录完整性
  - 验证日志记录准确性
  - 压力测试追踪性能

### 任务 8: 限流与熔断机制 (AC: 8)
- [ ] 8.1 熔断器实现
  - 实现 CircuitBreaker 核心类
  - 设计熔断状态机（closed → open → half-open）
  - 配置熔断阈值（连续失败 3 次）
  - **🔴 新增：全局错误计数器，防止攻击者通过不同类型错误绕过熔断**
  - **🔴 新增：错误类型聚合统计，识别攻击模式**
- [ ] 8.2 限流策略
  - 实现令牌桶或漏桶算法
  - 限制错误处理速率（避免资源耗尽）
  - 支持动态调整限流参数
- [ ] 8.3 熔断恢复机制
  - 超时自动恢复（5分钟）
  - 人工手动恢复接口
  - 半开状态试探性恢复
- [ ] 8.4 安全防护实现（新增）
  - **🔴 新增：路径遍历防护（验证文件路径在工作目录内）**
  - **🔴 新增：日志注入防护（错误消息转义和长度限制）**
  - **🔴 新增：敏感信息自动脱敏（API密钥、密码等）**
- [ ] 8.5 测试熔断功能
  - 模拟连续错误触发熔断
  - **🟡 新增：模拟熔断器绕过攻击，验证防护效果**
  - 验证恢复流程
  - 性能影响测试

### 任务 9: 性能优化与可观测性 (AC: 9, 10)
- [ ] 9.1 性能优化
  - 优化错误检测算法（减少正则匹配开销）
  - 缓存错误分类结果（避免重复分析）
  - 异步处理错误日志（避免阻塞主流程）
- [ ] 9.2 监控指标
  - 实现错误统计指标（错误率、回流率、修复成功率）
  - **🟡 新增：回流成功率监控仪表盘**
  - **🟡 新增：各类错误分布统计**
  - **🟡 新增：熔断器状态实时查询接口**
  - 集成 Prometheus 指标暴露
  - 提供实时监控仪表盘
- [ ] 9.3 告警系统
  - 配置错误告警规则（错误率阈值）
  - 集成 Telegram/邮件告警通知
  - 支持告警抑制和降噪
- [ ] 9.4 配置化实现（新增）
  - **🟡 新增：提取硬编码阈值到配置文件（maxAttempts、timeout、confidence）**
  - **🟡 新增：支持运行时动态调整配置**
  - **🟡 新增：配置热重载机制**

### 任务 10: 安全性与兼容性 (AC: 11, 12)
- [ ] 10.1 安全加固
  - 敏感信息脱敏（错误消息过滤）
  - 回流操作权限验证
  - 防止回流滥用攻击（速率限制）
- [ ] 10.2 兼容性测试
  - 验证与 Automaton 核心的兼容性
  - 验证与 TinyClaw 的集成
  - 多智能体场景测试
- [ ] 10.3 向后兼容
  - 确保不影响现有功能
  - 提供渐进式升级路径
  - 保留旧版错误处理接口（如有）

### 任务 11: 测试与文档
- [ ] 11.1 单元测试
  - 覆盖所有错误检测逻辑
  - 覆盖所有回流处理流程
  - 覆盖自愈机制核心功能
- [ ] 11.2 集成测试
  - 端到端错误回流测试
  - 多智能体协作测试
  - 压力和并发测试
- [ ] 11.3 文档编写
  - 编写 API 文档
  - 编写使用指南
  - 编写故障排查手册

---

## 📚 技术要求与架构合规

### 🏗️ 核心架构模式

#### 1. 错误检测与分类系统

**模式：策略模式 + 规则引擎**

**安全增强实现：**
```typescript
// 安全的错误检测器
class SecureErrorDetector implements IErrorDetector {
  private patterns: Map<RegExp, { type: ErrorType; confidence: number }>;
  private readonly MAX_ERROR_LENGTH = 10000; // 防止日志注入
  private readonly WORKSPACE_PATH: string; // 工作目录路径

  detect(error: Error | string): ErrorDetails | null {
    // 1. 长度限制
    let errorMessage = typeof error === 'string' ? error : error.message;
    if (errorMessage.length > this.MAX_ERROR_LENGTH) {
      errorMessage = errorMessage.substring(0, this.MAX_ERROR_LENGTH) + '...';
    }

    // 2. HTML转义，防止日志注入
    errorMessage = this.escapeHtml(errorMessage);

    // 3. 验证文件路径（防止路径遍历）
    if (error instanceof Error && error.stack) {
      const safeStack = this.sanitizeFilePaths(error.stack);
      return { message: errorMessage, stack: safeStack, /* ... */ };
    }

    // 模式匹配 + 置信度评分
    // ...
  }

  private sanitizeFilePaths(stack: string): string {
    return stack.replace(/at\s+(\S+):(\d+):(\d+)/g, (match, filePath) => {
      // 验证文件路径是否在工作目录内
      const absolutePath = path.resolve(filePath);
      if (!absolutePath.startsWith(this.WORKSPACE_PATH)) {
        return match.replace(filePath, '[INVALID_PATH]');
      }
      return match;
    });
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
```

**实现位置：** `src/error-reflow/detector.ts`

#### 2. 回流处理器架构

**模式：责任链模式 + 状态机**

```typescript
// 回流处理器接口
interface IReflowHandler {
  canHandle(error: ErrorDetails): boolean;
  handle(error: ErrorDetails, context: ReflowContext): Promise<ReflowResult>;
  getPriority(): number; // 处理器优先级
}

// 回流上下文
interface ReflowContext {
  error: ErrorDetails;
  currentState: AgentState;
  previousState?: AgentState;
  attemptCount: number;
  maxAttempts: number;
  logger: Logger;
}

// 回流结果
interface ReflowResult {
  success: boolean;
  newState?: AgentState;
  recoveryAction?: string;
  nextStep?: string;
  requiresHumanIntervention?: boolean;
}

// 抽象回流处理器
abstract class BaseReflowHandler implements IReflowHandler {
  abstract canHandle(error: ErrorDetails): boolean;
  abstract handle(error: ErrorDetails, context: ReflowContext): Promise<ReflowResult>;

  // 通用错误处理逻辑
  protected async attemptRecovery(
    context: ReflowContext,
    recoveryFn: () => Promise<boolean>
  ): Promise<ReflowResult> {
    if (context.attemptCount >= context.maxAttempts) {
      return { success: false, requiresHumanIntervention: true };
    }
    const success = await recoveryFn();
    return { success, attemptCount: context.attemptCount + 1 };
  }
}
```

**实现位置：** `src/error-reflow/handlers/`

#### 3. 自愈引擎核心

**模式：状态机 + 策略模式 + 循环依赖防护**

```typescript
// 🔴 新增：回流深度限制
interface ReflowContext {
  error: ErrorDetails;
  currentState: AgentState;
  previousState?: AgentState;
  attemptCount: number;
  maxAttempts: number;
  logger: Logger;
  // 🔴 新增：回流深度追踪
  reflowDepth: number;
  maxReflowDepth: number; // 默认 3
  // 🔴 新增：回流路径去重
  visitedPaths: Set<string>;
}

// 🔴 新增：全局错误计数器（防止熔断器绕过）
class GlobalErrorCounter {
  private counters: Map<string, { count: number; lastReset: number }>;
  private readonly WINDOW_SIZE_MS = 60000; // 1分钟窗口
  private readonly MAX_GLOBAL_ERRORS = 100; // 全局限制

  recordError(agentId: string, errorType: ErrorType): boolean {
    const key = `${agentId}:${errorType}`;
    const now = Date.now();

    // 清理过期计数
    for (const [k, v] of this.counters.entries()) {
      if (now - v.lastReset > this.WINDOW_SIZE_MS) {
        this.counters.delete(k);
      }
    }

    const counter = this.counters.get(key) || { count: 0, lastReset: now };
    counter.count++;

    // 全局限制
    if (counter.count > this.MAX_GLOBAL_ERRORS) {
      return false; // 触发全局熔断
    }

    this.counters.set(key, counter);
    return true;
  }
}

// 🔴 增强：自愈引擎
class SelfHealingEngine {
  private state: HealingState = HealingState.DETECTED;
  private handlers: IReflowHandler[];
  private circuitBreaker: CircuitBreaker;
  private readonly MAX_REFLOW_DEPTH = 3; // 循环依赖防护
  private globalCounter: GlobalErrorCounter; // 全局错误计数

  async heal(error: Error, context: AgentContext): Promise<boolean> {
    // 🔴 新增：全局错误检查
    if (!this.globalCounter.recordError(context.agentId, error.type)) {
      this.logger.warn('Global error limit exceeded, triggering circuit breaker');
      await this.triggerHumanIntervention(errorDetails);
      return false;
    }

    // 1. 检测错误
    const errorDetails = this.detector.detect(error);
    if (!errorDetails) {
      this.logger.error('Failed to detect error type', { error });
      return false; // 🔴 改进：记录日志
    }

    // 🔴 新增：回流深度检查
    if (context.reflowDepth >= this.MAX_REFLOW_DEPTH) {
      this.logger.error('Max reflow depth exceeded', { depth: context.reflowDepth });
      await this.triggerHumanIntervention(errorDetails);
      return false;
    }

    // 2. 熔断检查
    if (this.circuitBreaker.isOpen()) {
      await this.triggerHumanIntervention(errorDetails);
      return false;
    }

    // 3. 选择处理器
    const handler = this.selectHandler(errorDetails);
    if (!handler) {
      await this.triggerHumanIntervention(errorDetails);
      return false;
    }

    // 4. 执行回流处理（带回滚机制）
    const reflowContext: ReflowContext = {
      error: errorDetails,
      currentState: context.state,
      attemptCount: 0,
      maxAttempts: 3,
      logger: context.logger,
      reflowDepth: context.reflowDepth + 1,
      maxReflowDepth: this.MAX_REFLOW_DEPTH,
      visitedPaths: context.visitedPaths || new Set()
    };

    // 🔴 新增：回流路径去重
    const pathKey = `${errorDetails.type}:${handler.constructor.name}`;
    if (reflowContext.visitedPaths.has(pathKey)) {
      this.logger.warn('Circular reflow detected', { path: pathKey });
      await this.triggerHumanIntervention(errorDetails);
      return false;
    }
    reflowContext.visitedPaths.add(pathKey);

    try {
      // 🔴 新增：创建检查点（支持回滚）
      const checkpoint = this.createCheckpoint(context);

      const result = await handler.handle(errorDetails, reflowContext);

      // 5. 更新状态
      if (result.success) {
        this.state = HealingState.SUCCESS;
        this.cleanupCheckpoint(checkpoint); // 清理检查点
        return true;
      } else {
        // 🔴 新增：回滚到检查点
        await this.rollbackToCheckpoint(checkpoint);
        this.circuitBreaker.recordFailure();
        this.state = HealingState.FAILED;
        return false;
      }
    } catch (err) {
      // 🔴 新增：异常时回滚
      await this.rollbackToCheckpoint(checkpoint);
      throw err;
    }
  }

  // 🔴 新增：检查点管理
  private createCheckpoint(context: AgentContext): string {
    const checkpointId = ulid();
    // 保存当前状态快照
    this.checkpoints.set(checkpointId, {
      state: cloneDeep(context.state),
      timestamp: Date.now()
    });
    return checkpointId;
  }

  private async rollbackToCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (checkpoint) {
      // 恢复状态
      await this.restoreState(checkpoint.state);
      this.checkpoints.delete(checkpointId);
    }
  }
}
```

**实现位置：** `src/error-reflow/engine.ts`

**🔴 重要安全特性：**
1. **循环依赖防护**：最大回流深度限制为 3 层
2. **回流路径去重**：检测并阻止循环回流
3. **全局错误计数**：防止熔断器绕过攻击
4. **事务性回滚**：检查点机制保证状态一致性

#### 4. 回流追踪系统

**模式：观察者模式 + 链式记录**

```typescript
// 回流路径节点
interface ReflowNode {
  id: string;
  type: 'from' | 'to' | 'handler' | 'result';
  value: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// 回流追踪器
class ReflowTracker {
  private paths: Map<string, ReflowNode[]> = new Map();
  private currentPathId: string = '';

  start(errorId: string): void {
    this.currentPathId = errorId;
    this.paths.set(errorId, []);
  }

  record(node: ReflowNode): void {
    const path = this.paths.get(this.currentPathId);
    if (path) path.push(node);
  }

  complete(): ReflowPath {
    const path = this.paths.get(this.currentPathId) || [];
    return {
      id: this.currentPathId,
      nodes: path,
      duration: path[path.length - 1].timestamp - path[0].timestamp,
      success: path.some(n => n.type === 'result' && n.value === 'success')
    };
  }

  // 生成 Mermaid 图
  toMermaid(): string {
    const path = this.paths.get(this.currentPathId) || [];
    return `graph LR\n${path.map((node, i) => {
      const next = path[i + 1];
      return next ? `  ${node.value} --> ${next.value}` : '';
    }).filter(Boolean).join('\n')}`;
  }
}

interface ReflowPath {
  id: string;
  nodes: ReflowNode[];
  duration: number;
  success: boolean;
}
```

**实现位置：** `src/error-reflow/tracker.ts`

---

## 🔧 技术栈与依赖

### 核心依赖

| 依赖 | 版本 | 用途 | 必需性 |
|------|------|------|--------|
| TypeScript | 5.x | 主要开发语言 | ✅ 必需 |
| Node.js | ≥20.0.0 | 运行时 | ✅ 必需 |
| better-sqlite3 | ^9.0.0 | 审计日志存储 | ✅ 必需 |
| ulid | ^2.3.0 | 唯一错误标识符 | ✅ 必需 |
| winston | ^3.11.0 | 日志记录 | ✅ 必需 |
| prom-client | ^15.0.0 | Prometheus 指标 | ✅ 必需（安全监控必需） |
| lodash.clonedeep | ^4.5.0 | 深拷贝（检查点快照） | ✅ 必需 |

### 开发依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| vitest | ^1.0.0 | 单元测试 |
| @types/node | ^20.0.0 | TypeScript 类型定义 |
| eslint | ^8.50.0 | 代码质量检查 |
| ts-node | ^10.9.0 | TypeScript 运行时（测试） |

### 兼容性要求

- ✅ 与 Automaton 现有架构完全兼容
- ✅ 与 TinyClaw 智能体系统无缝集成
- ✅ 支持多智能体协同场景
- ✅ 支持 Conway API 集成

---

## 📁 文件结构与位置

### Conway Automaton (automaton/)

```
automaton/
├── src/
│   ├── error-reflow/                    # 【新建】异常回流核心模块
│   │   ├── index.ts                     # 模块导出
│   │   ├── detector.ts                  # 错误检测与分类
│   │   ├── engine.ts                    # 自愈引擎核心
│   │   ├── tracker.ts                   # 回流路径追踪
│   │   ├── types.ts                     # TypeScript 类型定义
│   │   ├── utils.ts                     # 工具函数
│   │   ├── handlers/                    # 【新建】回流处理器
│   │   │   ├── index.ts
│   │   │   ├── base-handler.ts          # 抽象基类
│   │   │   ├── compilation-handler.ts   # COMPILATION_ERROR 处理
│   │   │   ├── logic-handler.ts         # LOGIC_ERROR 处理
│   │   │   ├── requirement-handler.ts   # REQUIREMENT_MISMATCH 处理
│   │   │   ├── architecture-handler.ts  # ARCHITECTURE_FLAW 处理
│   │   │   └── human-intervention-handler.ts  # 人工介入处理
│   │   ├── strategies/                  # 【新建】自愈策略
│   │   │   ├── index.ts
│   │   │   ├── code-fix-strategy.ts     # 代码修复策略
│   │   │   ├── reasoning-strategy.ts    # 推理重建策略
│   │   │   ├── replanning-strategy.ts   # 重新规划策略
│   │   │   └── architecture-fix-strategy.ts  # 架构修复策略
│   │   └── circuit-breaker.ts           # 熔断器实现
│   ├── agent/                           # 【修改】集成到智能体循环
│   │   ├── loop.ts                      # 添加错误处理中间件
│   │   ├── error-middleware.ts          # 【新建】错误处理中间件
│   │   └── types.ts                     # 【修改】添加错误类型
│   ├── self-mod/                        # 【修改】审计日志集成
│   │   ├── audit-log.ts                 # 【修改】记录回流事件
│   │   └── types.ts                     # 【修改】添加回流类型
│   ├── memory/                          # 【修改】记忆系统
│   │   └── error-memory.ts              # 【新建】错误记忆（用于学习）
│   └── monitoring/                      # 【新建】监控与指标
│       ├── metrics.ts                   # Prometheus 指标
│       └── dashboard.ts                 # 监控仪表盘
├── test/
│   └── error-reflow/                    # 【新建】测试套件
│       ├── detector.test.ts
│       ├── engine.test.ts
│       ├── handlers/
│       │   ├── compilation-handler.test.ts
│       │   ├── logic-handler.test.ts
│       │   ├── requirement-handler.test.ts
│       │   └── architecture-handler.test.ts
│       ├── tracker.test.ts
│       └── circuit-breaker.test.ts
└── docs/
    └── error-reflow-guide.md            # 【新建】使用指南
```

### TinyClaw 集成 (tinyclaw/)

```
tinyclaw/
├── src/
│   ├── lib/
│   │   ├── error-reflow-integration.ts  # 【新建】与 TinyClaw 集成
│   │   └── agent.ts                     # 【修改】支持错误回流
│   └── queue-processor.ts               # 【修改】队列错误处理
└── test/
    └── error-reflow-integration.test.ts
```

---

## 🧪 测试策略

### 单元测试

**覆盖率目标：** ≥ 95% （提高标准）

```typescript
// 🔴 新增：安全测试
describe('Security Tests', () => {
  it('should prevent path traversal attack', () => {
    const maliciousError = new Error('Error in ../../etc/passwd:1:1');
    const result = detector.detect(maliciousError);
    expect(result?.message).toContain('[INVALID_PATH]');
  });

  it('should escape HTML in error messages', () => {
    const xssError = '<script>alert("xss")</script>';
    const result = detector.detect(xssError);
    expect(result?.message).not.toContain('<script>');
    expect(result?.message).toContain('&lt;script&gt;');
  });

  it('should limit error message length', () => {
    const longError = 'a'.repeat(20000);
    const result = detector.detect(longError);
    expect(result?.message.length).toBeLessThanOrEqual(10000);
  });
});

// 🔴 新增：循环依赖测试
describe('Circular Dependency Tests', () => {
  it('should prevent infinite reflow loop', async () => {
    const engine = new SelfHealingEngine();
    const context: AgentContext = {
      agentId: 'test-agent',
      state: {},
      reflowDepth: 5 // 超过最大深度
    };
    const result = await engine.heal(mockError, context);
    expect(result).toBe(false); // 应该失败并触发人工介入
  });

  it('should detect circular reflow path', async () => {
    const engine = new SelfHealingEngine();
    const context: AgentContext = {
      agentId: 'test-agent',
      state: {},
      visitedPaths: new Set(['COMPILATION_ERROR:CompilationHandler'])
    };
    // 同一个处理器再次被调用
    const result = await engine.heal(mockError, context);
    expect(result).toBe(false);
  });
});

// 🔴 新增：熔断器绕过测试
describe('Circuit Breaker Bypass Prevention', () => {
  it('should aggregate errors across types', () => {
    const counter = new GlobalErrorCounter();
    // 在1分钟内发送101个不同类型错误
    for (let i = 0; i < 101; i++) {
      const result = counter.recordError('test-agent', ErrorType.COMPILATION_ERROR);
      if (i === 100) {
        expect(result).toBe(false); // 第101个应该被拒绝
      }
    }
  });
});

// 🔴 新增：回滚测试
describe('Rollback Tests', () => {
  it('should rollback state on failure', async () => {
    const engine = new SelfHealingEngine();
    const context = { state: { data: 'original' } };

    // 模拟回流失败
    await expect(engine.heal(failingError, context)).rejects.toThrow();

    // 验证状态已回滚
    expect(context.state.data).toBe('original');
  });
});
```

### 集成测试

**测试场景：**

1. **端到端错误回流测试**
   - 模拟智能体执行过程中抛出各种错误
   - 验证自动检测、分类、回流、修复流程
   - 验证状态恢复和继续执行

2. **多智能体协作测试**
   - 模拟多个智能体协同工作时的错误处理
   - 验证错误不会影响其他智能体
   - 验证团队级别的错误恢复

3. **压力和并发测试**
   - 模拟高并发错误场景
   - 验证熔断器和限流机制
   - 性能指标监控

4. **🔴 安全渗透测试（新增）**
   - **路径遍历攻击测试**：尝试访问工作目录外的文件
   - **日志注入攻击测试**：注入恶意HTML/JavaScript代码
   - **熔断器绕过测试**：快速发送不同类型的错误
   - **拒绝服务测试**：超大错误消息、高频错误触发

5. **🔴 循环依赖测试（新增）**
   - 模拟架构缺陷触发架构修复，修复过程中产生新缺陷
   - 验证回流深度限制生效
   - 验证回流路径去重机制

6. **🔴 回滚测试（新增）**
   - 模拟回流失败场景
   - 验证状态正确回滚到检查点
   - 验证审计日志记录完整

### 测试命令

```bash
# 运行所有错误回流相关测试
cd automaton
pnpm test error-reflow

# 运行特定测试
pnpm test error-reflow/detector
pnpm test error-reflow/engine

# 生成测试覆盖率报告
pnpm test:coverage error-reflow
```

---

## 📊 数据库模式

### 错误审计日志表

```sql
-- 错误事件记录表
CREATE TABLE IF NOT EXISTS error_events (
  id TEXT PRIMARY KEY,                    -- ULID
  error_type TEXT NOT NULL,               -- 错误类型枚举
  message TEXT NOT NULL,                  -- 错误消息
  stack_trace TEXT,                       -- 堆栈追踪
  context JSON,                           -- 错误上下文
  agent_id TEXT,                          -- 智能体ID
  session_id TEXT,                        -- 会话ID
  detected_at INTEGER DEFAULT (unixepoch()),  -- 检测时间
  handled_at INTEGER,                     -- 处理时间
  recovery_success BOOLEAN,               -- 恢复是否成功
  recovery_action TEXT,                   -- 恢复动作
  requires_human BOOLEAN DEFAULT FALSE,   -- 是否需要人工介入
  attempt_count INTEGER DEFAULT 0         -- 尝试次数
);

-- 回流路径记录表
CREATE TABLE IF NOT EXISTS reflow_paths (
  id TEXT PRIMARY KEY,                    -- ULID
  error_event_id TEXT NOT NULL,           -- 关联错误事件
  from_state TEXT NOT NULL,               -- 起始状态
  to_state TEXT NOT NULL,                 -- 目标状态
  handler_type TEXT,                      -- 处理器类型
  reason TEXT,                            -- 回流原因
  result TEXT,                            -- 处理结果
  duration_ms INTEGER,                    -- 耗时（毫秒）
  timestamp INTEGER DEFAULT (unixepoch()), -- 时间戳
  FOREIGN KEY (error_event_id) REFERENCES error_events(id)
);

-- 创建索引
CREATE INDEX idx_error_events_type ON error_events(error_type);
CREATE INDEX idx_error_events_agent ON error_events(agent_id);
CREATE INDEX idx_error_events_time ON error_events(detected_at);
CREATE INDEX idx_reflow_paths_error ON reflow_paths(error_event_id);
CREATE INDEX idx_reflow_paths_time ON reflow_paths(timestamp);
```

**实现位置：** `src/state/database.ts` (添加新表)

---

## 🔄 集成点与依赖

### 与现有模块的集成

#### 1. 智能体循环集成 (src/agent/loop.ts)

```typescript
// 在 runAgentLoop 中添加错误处理中间件
export async function runAgentLoop(options: AgentLoopOptions) {
  try {
    // ... 现有逻辑
  } catch (error) {
    // 新增：错误处理
    const errorDetails = await errorDetector.detect(error);
    if (errorDetails) {
      await selfHealingEngine.heal(errorDetails, context);
      // 继续执行或返回
    } else {
      throw error; // 无法处理的错误重新抛出
    }
  }
}
```

#### 2. 审计日志集成 (src/self-mod/audit-log.ts)

```typescript
// 记录回流事件
export class AuditLog {
  async logReflowEvent(event: ReflowEvent) {
    await this.db.run(
      `INSERT INTO audit_log (event_type, details, timestamp)
       VALUES (?, ?, ?)`,
      ['RErrorReflowEvent, JSON.stringify(event), Date.now()]
    );
  }
}
```

#### 3. 记忆系统集成 (src/memory/)

```typescript
// 错误记忆用于学习
export class ErrorMemory {
  async storeErrorPattern(pattern: ErrorPattern) {
    // 将常见错误模式存储到语义记忆
    await this.semanticMemory.ingest({
      type: 'error_pattern',
      pattern,
      solutions: pattern.solutions
    });
  }

  async getSimilarErrors(error: ErrorDetails) {
    // 从语义记忆中检索相似错误及其解决方案
    return await this.semanticMemory.query(error.message);
  }
}
```

#### 4. 监控系统集成

```typescript
// Prometheus 指标
const errorCounter = new Counter({
  name: 'agent_errors_total',
  help: 'Total number of agent errors',
  labelNames: ['error_type', 'agent_id']
});

const reflowDuration = new Histogram({
  name: 'reflow_duration_seconds',
  help: 'Duration of error reflow process',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});
```

---

## 🚨 重要实现注意事项

### 1. 🔴 安全防护（高优先级）

- **路径遍历防护**：
  - 所有文件路径必须验证是否在工作目录内
  - 使用 `path.resolve()` 验证绝对路径
  - 非法路径标记为 `[INVALID_PATH]` 并记录告警

- **日志注入防护**：
  - 错误消息长度限制为 10000 字符
  - 所有错误消息进行 HTML 转义
  - 防止 XSS 和命令注入攻击

- **熔断器绕过防护**：
  - 实现全局错误计数器（1分钟窗口）
  - 聚合所有错误类型，防止分类型攻击
  - 超过全局限制（100次）触发全局熔断

- **敏感信息脱敏**：
  - 自动识别并脱敏 API 密钥、密码等
  - 使用正则表达式匹配敏感模式
  - 日志中替换为 `***` 或哈希值

### 2. 🔴 循环依赖防护（高优先级）

- **最大回流深度**：限制为 3 层，防止无限回流
- **回流路径去重**：使用 Set 记录已访问路径，检测循环
- **架构缺陷特殊处理**：
  - 架构修复过程中产生的新架构缺陷必须强制人工介入
  - 防止自修复导致更严重的问题

### 3. 🔴 回滚机制（高优先级）

- **检查点管理**：
  - 每次回流前创建状态检查点
  - 使用深拷贝保存完整状态快照
  - 成功后清理检查点，失败后回滚

- **事务性回滚**：
  - 回滚操作必须是原子性的
  - 确保系统状态一致性
  - 记录回滚操作到审计日志

### 4. 🟡 性能优化关键点

- **错误检测算法**：使用高效的正则匹配，避免过多模式扫描
- **缓存策略**：缓存错误分类结果，相同错误类型避免重复分析
- **异步处理**：错误日志记录使用异步写入，避免阻塞主流程
- **批量处理**：高并发场景下批量处理错误事件
- **配置热重载**：避免重启即可更新配置

### 5. 🟡 可观测性增强

- **详细日志**：记录每个回流步骤的详细信息
- **实时指标**：暴露关键性能指标供监控
- **可视化追踪**：生成回流路径图便于分析
- **告警机制**：异常情况及时通知运维人员
- **监控仪表盘**：回流成功率、错误分布、熔断器状态

---

## 📖 参考文档

- **[Source: docs/architecture-automaton.md#智能体循环]** - Agent Loop 核心架构
- **[Source: docs/architecture-automaton.md#自修改系统]** - 自修改和审计日志机制
- **[Source: docs/architecture-automaton.md#多层记忆系统]** - 记忆系统架构
- **[Source: _bmad-output/planning-artifacts/epics.md#Epic 1c]** - 智能体编排与团队完整需求
- **[Source: _bmad-output/planning-artifacts/epics.md#1c.6]** - 异常回流与自愈机制详细说明
- **[Source: docs/upwork_autopilot_detailed_design.md]** - Upwork 自动投标系统的错误处理设计（参考）

---

## 🎯 完成标准

### 必须完成

- ✅ 所有 12 个验收标准全部通过
- ✅ 所有核心模块实现完成（detector, engine, handlers, tracker）
- ✅ 单元测试覆盖率 ≥ 90%
- ✅ 集成测试通过
- ✅ 性能指标达标（检测延迟 ≤ 100ms，处理延迟 ≤ 500ms）
- ✅ 审计日志记录完整
- ✅ 文档编写完成

### 推荐完成

- ✅ 监控仪表盘实现
- ✅ 告警系统集成
- ✅ 性能压力测试
- ✅ 安全审计通过
- ✅ 用户使用指南

### 可选增强

- ✅ 错误模式学习与预测
- ✅ 自动化故障恢复演练
- ✅ 多语言错误消息支持
- ✅ 错误知识库构建

---

## 📝 开发者记录

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### 🔧 配置文件示例

**error-reflow.config.json**
```json
{
  "maxAttempts": 3,
  "timeoutMs": 300000,
  "confidenceThreshold": 0.9,
  "maxReflowDepth": 3,
  "maxErrorMessageLength": 10000,
  "globalErrorLimit": 100,
  "globalErrorWindowMs": 60000,
  "circuitBreaker": {
    "failureThreshold": 3,
    "resetTimeoutMs": 300000,
    "halfOpenSuccessThreshold": 2
  },
  "rateLimiting": {
    "maxRequestsPerSecond": 10,
    "burstCapacity": 20
  },
  "security": {
    "enablePathValidation": true,
    "enableHtmlEscape": true,
    "sensitivePatterns": [
      "api[_-]?key",
      "password",
      "secret",
      "token",
      "private[_-]?key"
    ]
  }
}
```

### 🔍 修复日志

**审核日期：** 2026-03-04
**审核团队：** 6位专家（PM、架构师、安全专家、质量专家、开发工程师、技术作家）

**修复的问题：**
1. ✅ **安全漏洞修复（高优先级）**
   - 路径遍历攻击防护
   - 日志注入攻击防护
   - 熔断器绕过攻击防护
   - 敏感信息自动脱敏

2. ✅ **循环依赖防护（高优先级）**
   - 最大回流深度限制（3层）
   - 回流路径去重机制
   - 架构缺陷特殊处理

3. ✅ **回滚机制（高优先级）**
   - 检查点管理
   - 事务性回滚
   - 状态一致性保证

4. ✅ **可观测性增强（中优先级）**
   - 回流成功率监控
   - 错误分布统计
   - 熔断器状态查询接口

5. ✅ **配置化（中优先级）**
   - 所有阈值提取到配置文件
   - 支持运行时动态调整
   - 配置热重载机制

**测试覆盖：**
- 安全渗透测试用例
- 循环依赖测试用例
- 回滚机制测试用例
- 单元测试覆盖率 ≥ 95%

### Completion Notes List

N/A

### File List

N/A
