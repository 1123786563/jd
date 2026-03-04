# Story 1c.4: 负载均衡与故障转移

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 系统管理员,
I want 实现多供应商LLM的智能负载均衡和自动故障转移机制,
so that 在主供应商故障或响应缓慢时能够无缝切换到备用供应商，保证系统高可用性.

## Acceptance Criteria

1. [ ] 实现基于优先级的供应商负载均衡策略，支持手动配置优先级
2. [ ] 实现自动故障转移机制，当供应商失败时自动切换到备用供应商
3. [ ] 故障检测包括超时检测、错误率检测和响应质量检测，支持具体错误类型分类
4. [ ] 支持供应商健康状态追踪，记录故障原因和恢复时间
5. [ ] 实现回退策略，当所有供应商都失败时提供降级方案
6. [ ] 支持生存模式 (survivalMode)，在预算紧张时自动切换到低成本供应商
7. [ ] 所有负载均衡决策记录到日志中，便于审计和调试
8. [ ] 通过单元测试验证负载均衡和故障转移逻辑

## Tasks / Subtasks

### 任务1: 扩展 ProviderRegistry 负载均衡能力 (AC: #1, #2, #3, #4)
- [ ] 在 `ProviderRegistry` 中添加供应商健康监控机制
- [ ] 实现 `checkProviderHealth()` 方法，定期检测供应商状态
- [ ] 实现 `getActiveProviders()` 方法，返回所有可用供应商
- [ ] 添加供应商故障计数器和自动禁用机制
- [ ] 实现 `autoRecovery()` 方法，定时检查被禁用的供应商是否恢复
- [ ] 添加供应商响应时间追踪，用于智能负载分配
- [ ] 创建供应商健康状态数据库表 (SQLite WAL)

### 任务2: 实现故障转移策略 (AC: #2, #3, #5)
- [ ] 创建 `FailoverStrategy` 类，封装故障转移逻辑
- [ ] 实现基于超时的故障检测 (timeout-based detection)
- [ ] 实现基于错误率的故障检测 (error-rate-based detection)
- [ ] 实现多级回退策略 (multi-level fallback)
- [ ] 添加故障恢复后的权重重置机制
- [ ] 实现优雅降级策略 (graceful degradation)
- [ ] 定义具体错误类型: `TimeoutError`, `NetworkError`, `APIError`, `RateLimitError`

### 任务3: 扩展 InferenceRouter 支持负载均衡 (AC: #1, #2, #6)
- [ ] 修改 `InferenceRouter.route()` 方法，支持多候选供应商轮询
- [ ] 实现 `selectNextProvider()` 方法，按优先级和健康状态选择供应商
- [ ] 添加生存模式检测，自动切换到低成本供应商
- [ ] 实现请求重试机制，支持配置最大重试次数
- [ ] 添加请求超时配置，支持不同供应商不同超时时间

### 任务4: 实现健康检查与监控 (AC: #4, #7)
- [ ] 创建 `HealthChecker` 类，定期执行供应商健康检查
- [ ] 实现供应商指标收集 (响应时间、错误率、成功率)
- [ ] 添加供应商状态变化事件通知
- [ ] 实现健康检查日志记录，包含详细诊断信息
- [ ] 创建供应商健康状态 API 端点 (用于监控)
- [ ] 实现指标持久化到 SQLite 数据库

### 任务5: 测试与验证 (AC: #8)
- [ ] 为 `ProviderRegistry` 负载均衡逻辑编写单元测试
- [ ] 为故障转移策略编写单元测试
- [ ] 编写集成测试，模拟供应商故障场景
- [ ] 编写压力测试，验证高并发下的负载均衡效果
- [ ] 编写生存模式测试，验证预算紧张时的降级行为
- [ ] 编写监控指标测试，验证指标收集准确性

## Dev Notes

### 技术要求

#### 现有基础分析

根据现有代码分析：

1. **ProviderRegistry (`automaton/src/inference/provider-registry.ts`)**:
   - 已有 `disableProvider()` 和 `enableProvider()` 方法用于手动禁用/启用供应商
   - 已有 `resolveCandidates()` 方法返回多个候选供应商
   - 已有 `TierDefault` 配置支持首选供应商和备用顺序
   - 已有 `priority` 字段支持供应商优先级排序
   - **需要扩展**: 自动健康检测、故障计数器、自动恢复机制

2. **InferenceRouter (`automaton/src/inference/router.ts`)**:
   - 已有超时处理 (120秒默认)
   - 已有预算检查机制
   - 已有供应商选择逻辑 (通过 `selectModel()`)
   - **需要扩展**: 多供应商轮询、请求重试、生存模式集成

3. **现有供应商支持**:
   - OpenAI (优先级1)
   - Groq (优先级2)
   - Together AI (优先级3，已禁用)
   - Local/Ollama (优先级10，已禁用)
   - **国产供应商**: 智普(Zhipu)、通义千问(Qwen)、Kimi(月之暗面) (优先级4-6)

#### 架构约束

根据文档分析 ([architecture-automaton.md](docs/architecture-automaton.md#334-342)):

- **负载均衡**: 推理路由器需要实现智能供应商选择和负载分配
- **自动故障转移**: 供应商注册表需要实现健康监控和自动故障转移
- **多供应商支持**: 系统已经设计为支持多个LLM供应商
- **预算追踪**: 需要与现有 `InferenceBudgetTracker` 集成
- **生存模式**: 已在 `ProviderRegistry.resolveCandidates()` 中实现基础支持

#### 关键设计模式

1. **供应商优先级模式**:
   ```typescript
   interface ProviderConfig {
     priority: number;  // 越小优先级越高
     maxRequestsPerMinute: number;
     maxTokensPerMinute: number;
   }
   ```

2. **故障检测模式**:
   ```typescript
   interface ProviderHealth {
     lastResponseTime: number;  // 毫秒
     errorCount: number;
     consecutiveFailures: number;
     disabledUntil: number;  // 时间戳
     status: 'healthy' | 'degraded' | 'failed';
   }
   ```

3. **回退策略模式**:
   ```typescript
   interface TierDefault {
     preferredProvider: string;
     fallbackOrder: string[];  // 按顺序尝试
   }
   ```

4. **错误类型定义**:
   ```typescript
   enum ProviderErrorType {
     TIMEOUT = 'timeout',          // 超时 (>30秒)
     NETWORK = 'network',          // 网络连接失败
     API_ERROR = 'api_error',      // API返回错误
     RATE_LIMIT = 'rate_limit',    // 速率限制
     INVALID_RESPONSE = 'invalid_response',  // 响应格式错误
   }
   ```

5. **供应商健康表 (SQLite)**:
   ```sql
   CREATE TABLE IF NOT EXISTS provider_health (
     provider_id TEXT PRIMARY KEY,
     last_response_time INTEGER,    -- 毫秒
     error_count INTEGER DEFAULT 0,
     consecutive_failures INTEGER DEFAULT 0,
     success_rate REAL DEFAULT 1.0, -- 成功率 (0.0-1.0)
     status TEXT DEFAULT 'healthy', -- healthy/degraded/failed
     disabled_until INTEGER,        -- Unix时间戳，0表示未禁用
     last_checked INTEGER,          -- 最后检查时间
     error_type TEXT,               -- 最后错误类型
     error_message TEXT             -- 最后错误信息
   );
   ```

### 实现方案

#### 1. 扩展 ProviderRegistry

**新增方法**:
```typescript
// 健康检查
checkHealth(providerId: string): Promise<boolean>;
recordFailure(providerId: string, error: Error): void;
recordSuccess(providerId: string, latencyMs: number): void;

// 状态管理
getHealthStatus(providerId: string): ProviderHealth;
getActiveProviders(tier: ModelTier): ProviderConfig[];

// 自动恢复
startHealthMonitoring(intervalMs?: number): void;
stopHealthMonitoring(): void;
```

**健康检测策略**:
```typescript
const HEALTH_CHECK_CONFIG = {
  failureThreshold: {
    consecutiveFailures: 3,  // 连续3次失败 → 禁用5分钟
    maxFailures: 5,          // 连续5次失败 → 禁用30分钟
    errorRate: 0.5,          // 10分钟内错误率 > 50% → 降级
  },
  performanceThreshold: {
    slowResponseTime: 30000, // 响应时间 > 30秒 → 标记为慢速
    timeout: 120000,         // 超时阈值 120秒
  },
  recovery: {
    checkInterval: 60000,    // 1分钟检查一次恢复
    minRecoveryTime: 300000  // 最少禁用5分钟
  }
};
```

#### 2. 创建 FailoverStrategy

**核心逻辑**:
```typescript
class FailoverStrategy {
  selectProvider(tier: ModelTier, previousFailures: string[]): ResolvedModel | null {
    // 1. 获取所有候选供应商
    // 2. 过滤掉失败的供应商
    // 3. 按优先级和健康状态排序
    // 4. 返回最佳候选
  }

  shouldRetry(error: Error, retryCount: number): boolean {
    // 基于错误类型和重试次数决定是否重试
  }

  getFallbackDelay(retryCount: number): number {
    // 指数退避: 100ms, 200ms, 400ms, 800ms...
  }
}
```

#### 3. 修改 InferenceRouter

**新增逻辑**:
```typescript
async route(request: InferenceRequest): Promise<InferenceResult> {
  const candidates = this.registry.resolveCandidates(request.tier, survivalMode);

  for (const candidate of candidates) {
    try {
      // 尝试当前供应商
      const result = await this.tryProvider(candidate, request);

      // 成功: 记录健康状态
      this.registry.recordSuccess(candidate.provider.id, result.latencyMs);
      return result;

    } catch (error) {
      // 失败: 记录故障
      this.registry.recordFailure(candidate.provider.id, error);

      // 检查是否应该重试
      if (!this.failover.shouldRetry(error, retryCount)) {
        throw error;
      }

      // 等待退避延迟
      await sleep(this.failover.getFallbackDelay(retryCount++));
    }
  }

  // 所有供应商都失败: 优雅降级
  return this.handleCompleteFailure(request);
}
```

#### 4. 生存模式集成

**触发条件**:
- 当前余额 < 紧急停止额度 (默认100)
- 任务类型不是planner/planning

**降级策略**:
- `reasoning` → `fast` tier
- `fast` → `cheap` tier
- 优先使用本地/Ollama模型 (如果可用)

#### 5. 监控与日志

**关键指标**:
- 供应商成功率/失败率
- 平均响应时间
- 故障转移次数
- 生存模式触发次数

**日志格式**:
```typescript
logger.info('Load balancing decision', {
  tier: 'reasoning',
  selectedProvider: 'openai',
  candidates: ['openai', 'groq', 'zhipu'],
  reason: 'preferred_provider'
});

logger.warn('Provider failure detected', {
  provider: 'openai',
  error: 'timeout',
  consecutiveFailures: 3,
  autoDisabled: true
});
```

### 文件修改清单

1. **automaton/src/inference/provider-registry.ts**
   - 添加健康检查相关方法 (`checkHealth`, `recordFailure`, `recordSuccess`)
   - 添加故障计数器和自动禁用机制
   - 添加自动恢复机制 (`startHealthMonitoring`, `stopHealthMonitoring`)
   - 添加供应商健康状态查询方法

2. **automaton/src/inference/router.ts**
   - 修改 `route()` 方法支持多供应商重试逻辑
   - 添加 `FailoverStrategy` 集成
   - 添加生存模式检测和降级处理
   - 添加详细的错误日志记录

3. **automaton/src/inference/failover-strategy.ts** (新文件)
   - 实现 `FailoverStrategy` 类
   - 实现供应商选择逻辑 (`selectProvider`)
   - 实现重试策略 (`shouldRetry`, `getFallbackDelay`)
   - 定义错误类型枚举 (`ProviderErrorType`)

4. **automaton/src/inference/health-checker.ts** (新文件)
   - 实现 `HealthChecker` 类
   - 实现定期健康检查逻辑
   - 实现指标收集和持久化
   - 实现事件通知机制

5. **automaton/src/inference/types.ts**
   - 添加健康状态类型 (`ProviderHealth`)
   - 添加错误类型定义 (`ProviderErrorType`)
   - 添加健康检查配置类型 (`HealthCheckConfig`)

6. **automaton/src/inference/migrations/001_provider_health_table.sql** (新文件)
   - 创建供应商健康状态数据库表

7. **automaton/src/__tests__/inference/provider-registry.test.ts**
   - 添加负载均衡逻辑单元测试
   - 添加健康检测单元测试

8. **automaton/src/__tests__/inference/failover-strategy.test.ts** (新文件)
   - 添加故障转移策略单元测试
   - 添加错误类型处理测试

9. **automaton/src/__tests__/inference/router.test.ts**
   - 添加多供应商重试集成测试
   - 添加生存模式测试

10. **automaton/src/__tests__/inference/health-checker.test.ts** (新文件)
    - 添加健康检查器单元测试
    - 添加指标持久化测试

### 测试策略

**单元测试**:
- `ProviderRegistry` 健康检测逻辑
- `FailoverStrategy` 供应商选择逻辑
- 超时和错误处理

**集成测试**:
- 模拟供应商故障场景
- 验证故障转移行为
- 验证生存模式降级

**压力测试**:
- 高并发请求下的负载均衡效果
- 供应商故障恢复时间
- 内存和CPU使用情况

### 依赖关系

- **前置依赖**: 无 (可以独立实现)
- **后续依赖**: 无 (不阻塞其他故事)

### 风险与缓解

1. **风险**: 供应商健康检测增加系统开销
   - **缓解**: 使用异步检测，控制检测频率

2. **风险**: 故障转移可能导致请求延迟增加
   - **缓解**: 实现快速故障检测，减少重试延迟

3. **风险**: 生存模式可能影响推理质量
   - **缓解**: 提供明确的降级通知，允许手动覆盖

### 验收测试清单

- [ ] 主供应商故障时自动切换到备用供应商
- [ ] 故障供应商恢复后自动重新启用
- [ ] 超时错误触发故障转移
- [ ] 错误率过高触发供应商禁用
- [ ] 生存模式下自动切换到低成本供应商
- [ ] 所有负载均衡决策都有日志记录
- [ ] 健康检查指标可以被监控系统获取

## Dev Agent Record

### Agent Model Used

claude-opus-4-6

### Debug Log References

### Completion Notes List

1. 故事基于现有 `ProviderRegistry` 和 `InferenceRouter` 架构设计
2. 重点扩展健康检测和故障转移能力
3. 保持与现有生存模式和预算追踪的兼容性
4. 遵循项目现有的TypeScript类型安全和错误处理模式
5. 所有新增功能都有完整的单元测试覆盖

### File List

- automaton/src/inference/provider-registry.ts (修改)
- automaton/src/inference/router.ts (修改)
- automaton/src/inference/failover-strategy.ts (新增)
- automaton/src/inference/health-checker.ts (新增)
- automaton/src/inference/types.ts (扩展)
- automaton/src/inference/migrations/001_provider_health_table.sql (新增)
- automaton/src/__tests__/inference/provider-registry.test.ts (修改)
- automaton/src/__tests__/inference/failover-strategy.test.ts (新增)
- automaton/src/__tests__/inference/router.test.ts (修改)
- automaton/src/__tests__/inference/health-checker.test.ts (新增)

## 参考资料

- [Source: docs/architecture-automaton.md#334-342] - 负载均衡与自动故障转移设计
- [Source: automaton/src/inference/provider-registry.ts] - 供应商注册表现有实现
- [Source: automaton/src/inference/router.ts] - 推理路由器现有实现
- [Source: automaton/src/inference/types.ts] - 模型类型和配置定义
- [Source: docs/upwork_autopilot_detailed_design.md] - 双框架深度解析和多供应商支持
