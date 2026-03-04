# Automaton 运行模式配置指南

## 快速开始

### 1. API-only 模式（推荐用于开发）

```bash
# 导出 API key
export OPENAI_API_KEY=sk-your-openai-key
export CONWAY_API_KEY=ck-your-conway-key

# 设置运行模式
export AUTOMATON_RUN_MODE=api_only

# 启动 automaton
cd automaton
pnpm run dev
```

### 2. 混合模式（生产推荐）

```bash
# 使用钱包作为回退
export AUTOMATON_RUN_MODE=hybrid

# 启动
pnpm run dev
```

### 3. 钱包模式（默认）

```bash
# 不设置环境变量，使用默认模式
pnpm run dev
```

## 配置选项

### 环境变量方式

```bash
# 运行模式（必选）
export AUTOMATON_RUN_MODE=api_only

# 外部 API 预算限制（可选）
export AUTOMATON_EXTERNAL_API_BUDGET_DAILY=5000    # 每日预算 5000 分 ($50)
export AUTOMATON_EXTERNAL_API_BUDGET_HOURLY=1000   # 每小时预算 1000 分 ($10)
```

### 配置文件方式

编辑 `~/.automaton/automaton.json`:

```json
{
  "name": "My Automaton",
  "genesisPrompt": "You are a helpful AI assistant...",
  "runModeConfig": {
    "mode": "api_only",
    "externalApiBudgetDailyCents": 5000,
    "externalApiBudgetHourlyCents": 1000
  },
  "modelStrategy": {
    "inferenceModel": "gpt-5.2",
    "hourlyBudgetCents": 0,      // 0 = 无限制
    "sessionBudgetCents": 0,     // 0 = 无限制
    "perCallCeilingCents": 100   // 单次调用最高 $1
  }
}
```

## 模式对比

| 特性 | wallet_only | api_only | hybrid |
|------|-------------|----------|--------|
| 钱包检查 | ✅ | ❌ | ⚠️ (可选) |
| 自动充值 | ✅ | ❌ | ⚠️ (可选) |
| 生存等级 | 动态 | 始终 high | 动态 |
| 预算限制 | ✅ | ⚠️ (可选) | ✅ |
| 设置复杂度 | 高 | 低 | 中 |
| 使用成本 | 按需支付 | 外部 API 费用 | 混合 |
| 推荐场景 | 生产 | 开发测试 | 高可用生产 |

## API Key 配置

### OpenAI

```bash
export OPENAI_API_KEY=sk-proj-...
```

### Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### Conway

```bash
export CONWAY_API_KEY=ck-...
```

### 本地 Ollama

```bash
export OLLAMA_BASE_URL=http://localhost:11434
```

## 预算管理

### 设置每日预算

```json
{
  "runModeConfig": {
    "mode": "api_only",
    "externalApiBudgetDailyCents": 10000  // $100/天
  }
}
```

### 设置每小时预算

```json
{
  "modelStrategy": {
    "hourlyBudgetCents": 500  // $5/小时
  }
}
```

### 禁用预算限制

```json
{
  "modelStrategy": {
    "hourlyBudgetCents": 0,      // 0 = 无限制
    "sessionBudgetCents": 0,     // 0 = 无限制
    "perCallCeilingCents": 0     // 0 = 无限制
  }
}
```

## 常见问题

### Q: API-only 模式下，是否需要设置钱包？

**A**: 不需要。API-only 模式会跳过所有钱包检查。

### Q: 如何从 API-only 切换回钱包模式？

**A**: 移除环境变量或修改配置文件：

```bash
# 移除环境变量
unset AUTOMATON_RUN_MODE

# 或修改配置文件
{
  "runModeConfig": {
    "mode": "wallet_only"
  }
}
```

### Q: 混合模式如何工作？

**A**: 混合模式优先使用外部 API，当 API 失败时，会回退到钱包支付（如果有配置）。

### Q: API-only 模式下，能否使用 x402 支付？

**A**: 不能。x402 支付需要钱包和 USDC 余额。

## 进阶配置

### 自定义运行模式

```typescript
import { createConfig, DEFAULT_RUN_MODE_CONFIG } from "./config.js";

const config = createConfig({
  name: "My Custom Automaton",
  genesisPrompt: "...",
  runModeConfig: {
    ...DEFAULT_RUN_MODE_CONFIG,
    mode: "api_only",
    externalApiBudgetDailyCents: 5000,
    externalApiBudgetHourlyCents: 1000,
  },
  // ... 其他配置
});
```

### 动态切换模式

```typescript
import { saveConfig } from "./config.js";

// 获取当前配置
const config = loadConfig();

// 修改运行模式
config.runModeConfig = {
  ...config.runModeConfig,
  mode: "api_only",
};

// 保存配置
saveConfig(config);

// 重新启动 automaton 以应用更改
```

## 监控和调试

### 查看运行模式

```bash
# 查看日志中的运行模式信息
pnpm run dev 2>&1 | grep "Running in"
```

### 检查预算使用

```bash
# 查看数据库中的推理成本
sqlite3 ~/.automaton/state.db "SELECT * FROM inference_costs ORDER BY created_at DESC LIMIT 10;"
```

## 故障排查

### 问题1: 仍然检查钱包

**解决方案**:
1. 确认环境变量已设置：`echo $AUTOMATON_RUN_MODE`
2. 检查配置文件中的 `runModeConfig.mode`
3. 重新启动 automaton

### 问题2: API 调用失败

**解决方案**:
1. 检查 API key 是否正确
2. 确认网络连接
3. 查看日志中的错误信息

### 问题3: 预算限制过严

**解决方案**:
1. 增加预算限制值
2. 设置为 0 禁用限制
3. 检查是否设置了多个预算限制

## 更多信息

- [API-only 模式详细文档](./API-only-mode.md)
- [预算管理](./budget-management.md)
- [配置参考](./configuration.md)
