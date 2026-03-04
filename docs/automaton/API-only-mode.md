# Automaton API-only 模式

## 概述

API-only 模式允许 Automaton 在没有钱包和 USDC 的情况下运行，完全依赖外部模型服务的 API key。这种模式适合：

- 快速测试和开发
- 没有加密货币的钱包设置
- 使用免费或已付费的外部模型服务

## 运行模式

Automaton 支持三种运行模式：

| 模式 | 说明 | 使用场景 |
|------|------|----------|
| `wallet_only` | 默认模式，使用钱包和 USDC 进行支付 | 生产环境，去中心化部署 |
| `api_only` | 仅使用外部 API key，跳过钱包检查 | 开发测试，快速启动 |
| `hybrid` | 混合模式，优先 API，失败时回退到钱包 | 高可用性生产环境 |

## 配置方法

### 方法1: 环境变量（推荐）

```bash
# 设置运行模式为 API-only
export AUTOMATON_RUN_MODE=api_only

# 可选：设置外部 API 每日预算限制（单位：分）
export AUTOMATON_EXTERNAL_API_BUDGET_DAILY=5000  # $50/天

# 可选：设置外部 API 每小时预算限制
export AUTOMATON_EXTERNAL_API_BUDGET_HOURLY=1000  # $10/小时

# 启动 automaton
cd automaton
pnpm run dev
```

### 方法2: 配置文件

编辑 `~/.automaton/automaton.json`:

```json
{
  "name": "My Automaton",
  "genesisPrompt": "...",
  "runModeConfig": {
    "mode": "api_only",
    "externalApiBudgetDailyCents": 5000,
    "externalApiBudgetHourlyCents": 1000
  },
  "modelStrategy": {
    "inferenceModel": "gpt-5.2",
    "hourlyBudgetCents": 0,  // 0 = 无限制
    "sessionBudgetCents": 0   // 0 = 无限制
  }
}
```

### 方法3: 代码配置

在创建配置时指定：

```typescript
import { createConfig } from "./config.js";
import { DEFAULT_RUN_MODE_CONFIG } from "./types.js";

const config = createConfig({
  name: "My Automaton",
  genesisPrompt: "...",
  // ... 其他参数
  runModeConfig: {
    ...DEFAULT_RUN_MODE_CONFIG,
    mode: "api_only",
    externalApiBudgetDailyCents: 5000,
  },
});
```

## API Key 配置

### OpenAI API

```bash
export OPENAI_API_KEY=sk-...
```

或在配置文件中：

```json
{
  "openaiApiKey": "sk-..."
}
```

### Anthropic API

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

或在配置文件中：

```json
{
  "anthropicApiKey": "sk-ant-..."
}
```

### Conway API

Conway API key 是必需的，因为它用于沙盒管理和某些工具调用：

```bash
export CONWAY_API_KEY=ck-...
```

或在配置文件中：

```json
{
  "conwayApiKey": "ck-..."
}
```

### Ollama (本地模型)

```bash
export OLLAMA_BASE_URL=http://localhost:11434
```

或在配置文件中：

```json
{
  "ollamaBaseUrl": "http://localhost:11434"
}
```

## 预算管理

即使在 API-only 模式下，你仍然可以设置预算限制：

### 每日预算

```typescript
{
  "runModeConfig": {
    "mode": "api_only",
    "externalApiBudgetDailyCents": 5000  // $50/天
  },
  "modelStrategy": {
    "maxInferenceDailyCents": 5000      // 推理每日预算 $50
  }
}
```

### 每小时预算

```typescript
{
  "runModeConfig": {
    "mode": "api_only",
    "externalApiBudgetHourlyCents": 1000  // $10/小时
  },
  "modelStrategy": {
    "hourlyBudgetCents": 1000            // 推理每小时预算 $10
  }
}
```

### 单次调用上限

```typescript
{
  "modelStrategy": {
    "perCallCeilingCents": 100  // 单次推理调用最高 $1
  }
}
```

## 工作原理

### 1. 生存等级

在 API-only 模式下，`getSurvivalTier()` 始终返回 `"high"`，跳过所有钱包和余额检查：

```typescript
export function getSurvivalTier(creditsCents: number, runMode?: RunMode): SurvivalTier {
  // API-only 模式：始终返回高生存等级
  if (runMode === "api_only") {
    return "high";
  }

  // 正常的钱包模式逻辑...
}
```

### 2. 财务检查

主循环会跳过钱包相关的财务检查：

```typescript
if (runMode === "api_only") {
  // API-only 模式：跳过钱包检查
  logger.debug("[API_ONLY] Skipping wallet checks, using high survival tier");
  inference.setLowComputeMode(false);
} else {
  // 正常的钱包模式逻辑...
}
```

### 3. 预算检查

推理路由器会检测 API-only 模式，跳过预算检查（除非设置了预算限制）：

```typescript
const isApiOnly = tier === "high" &&
                  this.budget.config.hourlyBudgetCents === 0 &&
                  this.budget.config.sessionBudgetCents === 0;

if (!isApiOnly) {
  // 执行预算检查...
}
```

## 使用示例

### 快速启动（无钱包）

```bash
# 1. 导出 API key
export OPENAI_API_KEY=sk-your-key
export CONWAY_API_KEY=ck-your-key
export AUTOMATON_RUN_MODE=api_only

# 2. 运行 automaton
cd automaton
pnpm run dev
```

### 设置每日预算

```bash
# 1. 导出配置
export AUTOMATON_RUN_MODE=api_only
export OPENAI_API_KEY=sk-your-key

# 2. 编辑配置文件 ~/.automaton/automaton.json
{
  "runModeConfig": {
    "mode": "api_only",
    "externalApiBudgetDailyCents": 1000  // $10/天
  },
  "modelStrategy": {
    "hourlyBudgetCents": 0,    // 无小时限制
    "sessionBudgetCents": 0    // 无会话限制
  }
}

# 3. 启动
pnpm run dev
```

### 混合模式（API + 钱包回退）

```json
{
  "runModeConfig": {
    "mode": "hybrid",
    "fallbackToWallet": true,
    "fallbackCooldownMs": 60000
  }
}
```

## 注意事项

1. **API Key 安全**: 不要将 API key 提交到版本控制系统
2. **预算监控**: 即使在 API-only 模式下，也建议设置预算限制
3. **模型可用性**: 确保配置的模型在你的 API key 下可用
4. **Conway API**: 某些工具（如沙盒管理）仍需要 Conway API key
5. **功能限制**: 某些需要支付的功能（如 x402）在 API-only 模式下不可用

## 故障排查

### 问题1: 模型调用失败

检查：
- API key 是否正确配置
- 模型是否在你的订阅中可用
- 是否有网络连接

### 问题2: 仍然检查钱包

确保：
- 环境变量 `AUTOMATON_RUN_MODE=api_only` 已设置
- 配置文件中的 `runModeConfig.mode` 为 `"api_only"`
- 重新启动 automaton 以应用配置更改

### 问题3: 预算限制过严

调整：
```json
{
  "modelStrategy": {
    "hourlyBudgetCents": 0,    // 设为 0 禁用限制
    "sessionBudgetCents": 0,   // 设为 0 禁用限制
    "perCallCeilingCents": 0   // 设为 0 禁用限制
  }
}
```

## 最佳实践

1. **开发环境**: 使用 `api_only` 模式快速迭代
2. **生产环境**: 使用 `hybrid` 模式确保高可用性
3. **预算设置**: 始终设置合理的预算限制
4. **监控**: 定期检查推理成本和使用情况
5. **API 密钥轮换**: 定期更新和轮换 API key

## 相关文档

- [配置指南](./configuration.md)
- [预算管理](./budget-management.md)
- [运行模式对比](./run-modes-comparison.md)
