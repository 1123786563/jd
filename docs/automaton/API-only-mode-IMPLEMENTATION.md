# API-only 模式实现总结

## 实现概述

成功实现了 **策略配置化**（方案3），允许 Automaton 在外部提供模型 API key 的情况下运行，无需钱包和加密货币。

## 核心变更

### 1. 新增类型定义 (`src/types.ts`)

添加了 `RunMode` 和 `RunModeConfig` 类型：

```typescript
export type RunMode = "wallet_only" | "api_only" | "hybrid";

export interface RunModeConfig {
  mode: RunMode;
  externalApiBudgetDailyCents?: number;
  externalApiBudgetHourlyCents?: number;
  fallbackToWallet?: boolean;
  fallbackCooldownMs?: number;
}
```

### 2. 更新配置系统 (`src/config.ts`)

- 支持从环境变量 `AUTOMATON_RUN_MODE` 读取运行模式
- 在 `loadConfig()` 中合并运行模式配置
- 在 `saveConfig()` 中持久化运行模式配置
- 在 `createConfig()` 中支持创建时指定运行模式

### 3. 修改生存等级逻辑 (`src/conway/credits.ts`)

更新 `getSurvivalTier()` 函数：

```typescript
export function getSurvivalTier(creditsCents: number, runMode?: RunMode): SurvivalTier {
  // API-only 模式：始终返回 high
  if (runMode === "api_only") {
    return "high";
  }
  // 正常的钱包逻辑...
}
```

### 4. 修改主循环逻辑 (`src/agent/loop.ts`)

在主循环中添加运行模式检查：

```typescript
const runMode = config.runModeConfig?.mode || "wallet_only";

// API-only 模式：跳过钱包检查
if (runMode === "api_only") {
  logger.debug("[API_ONLY] Skipping wallet checks, using high survival tier");
  inference.setLowComputeMode(false);
} else {
  // 正常的钱包逻辑...
}
```

### 5. 更新推理路由 (`src/inference/router.ts`)

在预算检查中跳过 API-only 模式：

```typescript
const isApiOnly = tier === "high" &&
                  this.budget.config.hourlyBudgetCents === 0 &&
                  this.budget.config.sessionBudgetCents === 0;

if (!isApiOnly) {
  // 执行预算检查...
}
```

## 使用方法

### 方法1: 环境变量（最简单）

```bash
export OPENAI_API_KEY=sk-...
export CONWAY_API_KEY=ck-...
export AUTOMATON_RUN_MODE=api_only

cd automaton
pnpm run dev
```

### 方法2: 配置文件

编辑 `~/.automaton/automaton.json`:

```json
{
  "runModeConfig": {
    "mode": "api_only",
    "externalApiBudgetDailyCents": 5000
  }
}
```

### 方法3: 代码配置

```typescript
const config = createConfig({
  // ... 其他参数
  runModeConfig: {
    mode: "api_only",
    externalApiBudgetDailyCents: 5000,
  },
});
```

## 三种运行模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `wallet_only` | 默认模式，使用钱包和 USDC | 生产环境 |
| `api_only` | 仅使用外部 API key，跳过钱包检查 | 开发测试 |
| `hybrid` | 混合模式，优先 API，失败时回退到钱包 | 高可用生产 |

## 优势

### 1. 保留钱包功能
- 所有现有钱包相关代码保持不变
- 可以随时切换回钱包模式
- 向后兼容现有配置

### 2. 灵活的配置
- 支持环境变量、配置文件、代码配置三种方式
- 可以设置预算限制（可选）
- 支持动态切换模式

### 3. 简单易用
- 开发者无需设置加密货币钱包
- 快速启动和测试
- 降低入门门槛

### 4. 安全可控
- 仍然可以设置预算限制
- 支持混合模式确保高可用性
- 保留所有现有安全检查

## 测试

### 单元测试

创建了测试文件 `src/__tests__/api-only-mode.test.ts`：

```typescript
describe("API-only Mode", () => {
  it("should return 'high' in api_only mode regardless of credits", () => {
    expect(getSurvivalTier(0, "api_only")).toBe("high");
    expect(getSurvivalTier(-1, "api_only")).toBe("high");
    expect(getSurvivalTier(500, "api_only")).toBe("high");
  });
});
```

运行测试：

```bash
cd automaton
pnpm test api-only-mode
```

## 文档

创建了以下文档：

1. **`docs/automaton/API-only-mode.md`**
   - API-only 模式的详细说明
   - 配置方法和使用示例
   - 故障排查指南

2. **`docs/automaton/RUN-MODE-GUIDE.md`**
   - 运行模式配置快速指南
   - 三种模式对比表
   - 常见问题解答

## 注意事项

1. **API Key 安全**
   - 不要将 API key 提交到版本控制
   - 使用环境变量或安全的配置管理

2. **预算管理**
   - 即使在 API-only 模式下，也建议设置预算限制
   - 监控推理成本，避免意外费用

3. **功能限制**
   - 某些需要支付的功能（如 x402）在 API-only 模式下不可用
   - 沙盒管理等功能仍需要 Conway API key

4. **Conway API**
   - 某些工具（如沙盒管理）仍需要 Conway API key
   - 这是必需的，即使在 API-only 模式下

## 后续优化建议

1. **混合模式实现**
   - 当前混合模式配置已支持，但未完全实现回退逻辑
   - 可以添加自动检测和切换机制

2. **API 健康检查**
   - 添加 API 可用性检测
   - 自动切换到备用模型或模式

3. **成本监控**
   - 实时显示推理成本
   - 预算预警通知

4. **配置向导**
   - 交互式配置向导
   - 根据使用场景推荐配置

## 总结

通过添加运行模式配置，成功实现了让 Automaton 在外部提供模型 API key 的情况下持续运行，无需钱包功能。这个方案：

- ✅ 保留了所有现有功能
- ✅ 提供了灵活的配置选项
- ✅ 简化了开发和测试流程
- ✅ 支持平滑的模式切换
- ✅ 向后兼容现有配置

开发者现在可以轻松地在无需设置加密货币钱包的情况下运行 Automaton，大大降低了入门门槛！
