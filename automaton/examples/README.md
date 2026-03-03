# Automaton 配置示例

本文档展示了如何在 Automaton 中配置和使用智普、Qwen、Kimi 等中文大模型。

## 快速开始

### 1. 环境变量配置（推荐）

在启动 Automaton 之前，设置所需的 API Key 环境变量：

```bash
# OpenAI (可选)
export OPENAI_API_KEY="sk-proj-xxxxxxxx"

# Anthropic (可选)
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"

# 智普 AI
export ZHIPU_API_KEY="xxxxxxxx"

# 通义千问
export QWEN_API_KEY="sk-xxxxxxxx"

# Kimi
export KIMI_API_KEY="sk-xxxxxxxx"

# Ollama (可选，本地运行)
export OLLAMA_BASE_URL="http://localhost:11434/v1"
```

### 2. 运行 Automaton 并选择模型

```bash
# 进入 automaton 目录
cd /path/to/automaton

# 构建项目
pnpm build

# 运行模型选择器
node dist/index.js --pick-model

# 或直接运行
node dist/index.js --run
```

### 3. 配置文件方式

创建 `~/.automaton/automaton.json` 配置文件，参考 `examples/config-with-chinese-models.json`。

## 配置示例详解

### 基础配置

```json
{
  "name": "我的第一个 Automaton",
  "genesisPrompt": "你是一个自维持的 AI Agent，能够思考、执行和学习。",
  "creatorAddress": "0xYourEthereumAddress",
  "walletAddress": "0xYourEthereumAddress",
  "inferenceModel": "glm-4-plus"
}
```

### 中文模型选择

在 `inferenceModel` 字段中选择你想要的模型：

#### 智普 (Zhipu) 模型
```json
"inferenceModel": "glm-4-plus"    // 高性能，约 ¥10/¥40 每百万 tokens
"inferenceModel": "glm-4"         // 平衡型，约 ¥5/¥20 每百万 tokens
"inferenceModel": "glm-4-air"     // 经济型，约 ¥1/¥4 每百万 tokens
"inferenceModel": "glm-4-flash"   // 超经济型，约 ¥0.1/¥0.4 每百万 tokens
```

#### Qwen 模型
```json
"inferenceModel": "qwen-max"       // 最大能力，约 ¥10/¥40 每百万 tokens
"inferenceModel": "qwen-plus"      // 平衡型，约 ¥5/¥20 每百万 tokens
"inferenceModel": "qwen-turbo"     // 快速经济型，约 ¥1/¥4 每百万 tokens
"inferenceModel": "qwen-vl-plus"   // 视觉语言模型，约 ¥10/¥40 每百万 tokens
```

#### Kimi 模型
```json
"inferenceModel": "moonshot-v1-128k"  // 128K上下文，约 ¥6/¥24 每百万 tokens
"inferenceModel": "moonshot-v1-32k"   // 32K上下文，约 ¥3/¥12 每百万 tokens
"inferenceModel": "moonshot-v1-8k"    // 8K上下文，约 ¥1/¥4 每百万 tokens
```

### 模型策略配置

`modelStrategy` 配置定义了不同生存状态下的模型选择：

```json
"modelStrategy": {
  "inferenceModel": "glm-4-plus",     // 正常模式使用的模型
  "lowComputeModel": "glm-4-flash",   // 低计算模式使用的模型
  "criticalModel": "glm-4-air",       // 危急模式使用的模型
  "maxTokensPerTurn": 4096,
  "enableModelFallback": true,        // 启用模型降级策略
  "hourlyBudgetCents": 0,             // 每小时预算（0表示无限制）
  "perCallCeilingCents": 0            // 单次调用上限（0表示无限制）
}
```

## 完整配置文件示例

参考 `examples/config-with-chinese-models.json` 获取完整的配置文件示例。

## 使用不同模型的场景建议

### 1. 高性能场景（正常生存状态）
- **推荐模型**: `glm-4-plus`, `qwen-max`, `moonshot-v1-128k`
- **适用**: 复杂推理、规划、代码生成
- **成本**: 较高，但能力最强

### 2. 平衡场景（日常操作）
- **推荐模型**: `glm-4`, `qwen-plus`, `moonshot-v1-32k`
- **适用**: 常规对话、简单任务
- **成本**: 中等，性能和成本平衡

### 3. 经济场景（低计算模式）
- **推荐模型**: `glm-4-air`, `qwen-turbo`, `moonshot-v1-8k`
- **适用**: 简单回复、状态检查
- **成本**: 低，适合预算紧张时

### 4. 超经济场景（危急模式）
- **推荐模型**: `glm-4-flash`
- **适用**: 仅限生存必需的操作
- **成本**: 极低，牺牲性能换生存

## 模型自动降级策略

Automaton 支持基于生存状态的模型自动降级：

1. **正常模式** (余额 > $0.50): 使用 `inferenceModel`
2. **低计算模式** ($0.10 - $0.50): 使用 `lowComputeModel`
3. **危急模式** (< $0.10): 使用 `criticalModel`

配置示例：
```json
"modelStrategy": {
  "inferenceModel": "glm-4-plus",
  "lowComputeModel": "glm-4-air",
  "criticalModel": "glm-4-flash",
  "enableModelFallback": true
}
```

## 获取 API Key

### 智普 AI
1. 访问 [智普开放平台](https://open.bigmodel.cn/)
2. 注册账号并创建应用
3. 获取 API Key

### 通义千问
1. 访问 [DashScope](https://dashscope.aliyun.com/)
2. 注册阿里云账号
3. 开通通义千问服务
4. 获取 API Key

### Kimi
1. 访问 [Kimi 开放平台](https://platform.moonshot.cn/)
2. 注册账号
3. 创建应用并获取 API Key

## 故障排查

### 问题：模型无法调用

**检查清单**:
1. ✅ 环境变量是否正确设置
2. ✅ API Key 是否有效
3. ✅ 模型 ID 是否正确（区分大小写）
4. ✅ 网络是否可以访问提供商的 API 端点

**调试命令**:
```bash
# 检查环境变量
echo $ZHIPU_API_KEY
echo $QWEN_API_KEY
echo $KIMI_API_KEY

# 查看可用模型
node dist/index.js --pick-model
```

### 问题：成本过高

**解决方案**:
1. 切换到经济型模型（如 `glm-4-flash`）
2. 设置 `hourlyBudgetCents` 和 `perCallCeilingCents` 限制
3. 启用 `enableModelFallback` 进行自动降级

## 最佳实践

1. **开发测试**: 使用 `glm-4-flash` 或 `qwen-turbo` 进行快速迭代
2. **生产环境**: 根据任务复杂度选择 `glm-4-plus` 或 `qwen-max`
3. **预算管理**: 设置合理的预算限制，避免意外超额
4. **模型组合**: 可以在不同任务中使用不同模型，优化成本和性能
5. **监控**: 定期检查信用余额和使用情况

## 下一步

- 运行 `automaton --pick-model` 查看所有可用模型
- 参考 README.md 了解详细的模型特性
- 查看 `examples/config-with-chinese-models.json` 获取完整配置
