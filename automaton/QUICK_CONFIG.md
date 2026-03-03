# Automaton 配置速查表

快速查找如何配置和使用中文大模型。

## 一、快速配置（3步走）

### 步骤 1: 设置 API Key

```bash
# 智普 AI
export ZHIPU_API_KEY="your-key"

# 通义千问
export QWEN_API_KEY="your-key"

# Kimi
export KIMI_API_KEY="your-key"
```

### 步骤 2: 选择模型

```bash
cd automaton
node dist/index.js --pick-model
```

### 步骤 3: 运行

```bash
node dist/index.js --run
```

## 二、模型速查

| 模型 | 类型 | 上下文 | 输入成本 | 输出成本 | 适用场景 |
|-----|------|--------|---------|---------|---------|
| **智普系列** |
| glm-4-plus | 高性能 | 128K | ¥10/M | ¥40/M | 复杂推理、代码生成 |
| glm-4 | 平衡型 | 128K | ¥5/M | ¥20/M | 常规任务 |
| glm-4-air | 经济型 | 128K | ¥1/M | ¥4/M | 日常对话 |
| glm-4-flash | 超经济 | 128K | ¥0.1/M | ¥0.4/M | 测试、预算紧张 |
| **Qwen 系列** |
| qwen-max | 高性能 | 32K | ¥10/M | ¥40/M | 最大能力需求 |
| qwen-plus | 平衡型 | 131K | ¥5/M | ¥20/M | 常规任务 |
| qwen-turbo | 经济型 | 32K | ¥1/M | ¥4/M | 快速回复 |
| qwen-vl-plus | 视觉型 | 32K | ¥10/M | ¥40/M | 图像理解 |
| **Kimi 系列** |
| moonshot-v1-128k | 大上下文 | 128K | ¥6/M | ¥24/M | 长文档处理 |
| moonshot-v1-32k | 中等 | 32K | ¥3/M | ¥12/M | 常规任务 |
| moonshot-v1-8k | 经济型 | 8K | ¥1/M | ¥4/M | 简单回复 |

## 三、配置文件模板

### 模板 1: 开发测试配置

```json
{
  "inferenceModel": "glm-4-flash",
  "modelStrategy": {
    "inferenceModel": "glm-4-flash",
    "lowComputeModel": "glm-4-flash",
    "criticalModel": "glm-4-flash",
    "hourlyBudgetCents": 1000,
    "enableModelFallback": true
  }
}
```

**特点**: 成本最低，适合快速测试

### 模板 2: 生产环境配置

```json
{
  "inferenceModel": "glm-4-plus",
  "modelStrategy": {
    "inferenceModel": "glm-4-plus",
    "lowComputeModel": "glm-4",
    "criticalModel": "glm-4-air",
    "enableModelFallback": true,
    "perCallCeilingCents": 5000
  }
}
```

**特点**: 性能最优，有降级保障

### 模板 3: 长文档处理配置

```json
{
  "inferenceModel": "moonshot-v1-128k",
  "modelStrategy": {
    "inferenceModel": "moonshot-v1-128k",
    "lowComputeModel": "moonshot-v1-32k",
    "criticalModel": "moonshot-v1-8k",
    "enableModelFallback": true
  }
}
```

**特点**: 超大上下文，适合文档分析

## 四、环境变量速查

```bash
# 所有可用的环境变量
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-..."
export ZHIPU_API_KEY="..."
export QWEN_API_KEY="sk-..."
export KIMI_API_KEY="sk-..."
export OLLAMA_BASE_URL="http://localhost:11434/v1"
export INFERENCE_MODEL="glm-4-plus"
```

## 五、命令速查

```bash
# 交互式选择模型
node dist/index.js --pick-model

# 运行 automaton
node dist/index.js --run

# 启动向导
node dist/index.js --setup

# 查看状态
node packages/cli/dist/index.js status

# 查看日志
node packages/cli/dist/index.js logs --tail 50

# 资金充值
node packages/cli/dist/index.js fund 5.00
```

## 六、场景推荐

### 场景 1: 代码生成和调试

**推荐模型**: `glm-4-plus` 或 `qwen-max`

**原因**: 强大的代码理解和生成能力

**配置**:
```json
{
  "inferenceModel": "glm-4-plus",
  "maxTokensPerTurn": 8192
}
```

### 场景 2: 中文对话和客服

**推荐模型**: `glm-4` 或 `qwen-plus`

**原因**: 中文优化，成本适中

**配置**:
```json
{
  "inferenceModel": "glm-4",
  "maxTokensPerTurn": 4096
}
```

### 场景 3: 长文档分析

**推荐模型**: `moonshot-v1-128k`

**原因**: 128K 超大上下文窗口

**配置**:
```json
{
  "inferenceModel": "moonshot-v1-128k",
  "maxTokensPerTurn": 16384
}
```

### 场景 4: 预算有限的项目

**推荐模型**: `glm-4-flash`

**原因**: 成本最低，约 1/10 的价格

**配置**:
```json
{
  "inferenceModel": "glm-4-flash",
  "maxTokensPerTurn": 2048,
  "hourlyBudgetCents": 500
}
```

## 七、故障排查速查

### 问题 1: 模型无法调用

**检查**:
```bash
# 1. 检查环境变量
echo $ZHIPU_API_KEY

# 2. 检查可用模型
node dist/index.js --pick-model

# 3. 查看日志
tail -f ~/.automaton/logs/automaton.log
```

### 问题 2: 成本过高

**解决方案**:
```json
{
  "modelStrategy": {
    "inferenceModel": "glm-4-flash",
    "hourlyBudgetCents": 1000,
    "perCallCeilingCents": 100
  }
}
```

### 问题 3: 切换模型

**方法 1**: 重新运行选择器
```bash
node dist/index.js --pick-model
```

**方法 2**: 修改配置文件
```bash
nano ~/.automaton/automaton.json
# 修改 "inferenceModel"
# 重启 automaton
```

## 八、常用配置组合

### 组合 1: 最佳性能
```bash
export ZHIPU_API_KEY="..."
export INFERENCE_MODEL="glm-4-plus"
```

### 组合 2: 最佳成本
```bash
export ZHIPU_API_KEY="..."
export INFERENCE_MODEL="glm-4-flash"
```

### 组合 3: 平衡性能和成本
```bash
export ZHIPU_API_KEY="..."
export INFERENCE_MODEL="glm-4"
```

## 九、监控和日志

### 查看模型使用情况

```bash
# 查看状态
node packages/cli/dist/index.js status

# 查看最近 100 行日志
node packages/cli/dist/index.js logs --tail 100

# 实时监控
tail -f ~/.automaton/logs/automaton.log | grep -E "(inference|model|cost)"
```

### 成本估算

| 模型 | 1000 tokens 成本 | 10000 tokens (10K) | 100000 tokens (100K) |
|-----|-----------------|-------------------|---------------------|
| glm-4-plus | ¥0.50 | ¥5.00 | ¥50.00 |
| glm-4 | ¥0.25 | ¥2.50 | ¥25.00 |
| glm-4-flash | ¥0.025 | ¥0.25 | ¥2.50 |
| qwen-turbo | ¥0.05 | ¥0.50 | ¥5.00 |

## 十、下一步

- 📖 详细配置: [CONFIG_GUIDE.md](CONFIG_GUIDE.md)
- 📝 示例文件: [examples/](examples/)
- 🔍 模型详情: [README.md - Supported Models](README.md#supported-models)
- 🏗️ 架构说明: [ARCHITECTURE.md](ARCHITECTURE.md)
