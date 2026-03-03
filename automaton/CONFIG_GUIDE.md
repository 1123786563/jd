# Automaton 中文大模型配置指南

## 一、环境变量配置（最简单的方式）

### 1. 设置 API Key

在运行 Automaton 之前，在终端中设置环境变量：

```bash
# 智普 AI
export ZHIPU_API_KEY="your-zhipu-api-key"

# 通义千问
export QWEN_API_KEY="your-qwen-api-key"

# Kimi
export KIMI_API_KEY="your-kimi-api-key"

# OpenAI (可选)
export OPENAI_API_KEY="your-openai-api-key"

# Anthropic (可选)
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

### 2. 运行并选择模型

```bash
# 进入 automaton 目录
cd automaton

# 构建项目
pnpm build

# 交互式选择模型
node dist/index.js --pick-model

# 或直接运行
node dist/index.js --run
```

## 二、配置文件方式（更灵活）

### 1. 创建配置文件目录

```bash
mkdir -p ~/.automaton
```

### 2. 创建 automaton.json 配置文件

```bash
nano ~/.automaton/automaton.json
```

### 3. 配置文件模板（基于智普模型）

```json
{
  "name": "我的中文 Automaton",
  "genesisPrompt": "你是一个自维持的 AI Agent，能够思考、执行和学习。你的目标是生存并为人类创造价值。",
  "creatorAddress": "0xYourEthereumAddress",
  "walletAddress": "0xYourEthereumAddress",
  "conwayApiKey": "con_sk_your_conway_key",
  "zhipuApiKey": "your-zhipu-api-key",
  "inferenceModel": "glm-4-plus",
  "maxTokensPerTurn": 4096,
  "heartbeatConfigPath": "~/.automaton/heartbeat.yml",
  "dbPath": "~/.automaton/state.db",
  "logLevel": "info",
  "version": "0.2.1",
  "skillsDir": "~/.automaton/skills",
  "maxChildren": 3,
  "modelStrategy": {
    "inferenceModel": "glm-4-plus",
    "lowComputeModel": "glm-4-flash",
    "criticalModel": "glm-4-air",
    "maxTokensPerTurn": 4096,
    "enableModelFallback": true
  }
}
```

## 三、不同场景的配置示例

### 场景 1: 开发测试（经济型）

**使用模型**: `glm-4-flash` 或 `qwen-turbo`

**配置文件**:
```json
{
  "inferenceModel": "glm-4-flash",
  "maxTokensPerTurn": 2048,
  "modelStrategy": {
    "inferenceModel": "glm-4-flash",
    "lowComputeModel": "glm-4-flash",
    "criticalModel": "glm-4-flash",
    "maxTokensPerTurn": 2048,
    "enableModelFallback": true,
    "hourlyBudgetCents": 1000
  }
}
```

**优点**:
- 成本极低 (约 ¥0.1/¥0.4 每百万 tokens)
- 适合快速迭代测试
- 预算限制防止超额

### 场景 2: 生产环境（高性能）

**使用模型**: `glm-4-plus` 或 `qwen-max`

**配置文件**:
```json
{
  "inferenceModel": "glm-4-plus",
  "maxTokensPerTurn": 8192,
  "modelStrategy": {
    "inferenceModel": "glm-4-plus",
    "lowComputeModel": "glm-4",
    "criticalModel": "glm-4-air",
    "maxTokensPerTurn": 8192,
    "enableModelFallback": true,
    "perCallCeilingCents": 5000
  }
}
```

**优点**:
- 最强推理能力
- 大上下文窗口 (128K)
- 支持工具调用和视觉理解
- 自动降级策略保障运行

### 场景 3: 长文档处理（大上下文）

**使用模型**: `moonshot-v1-128k`

**配置文件**:
```json
{
  "inferenceModel": "moonshot-v1-128k",
  "maxTokensPerTurn": 16384,
  "modelStrategy": {
    "inferenceModel": "moonshot-v1-128k",
    "lowComputeModel": "moonshot-v1-32k",
    "criticalModel": "moonshot-v1-8k",
    "maxTokensPerTurn": 16384,
    "enableModelFallback": true
  }
}
```

**优点**:
- 128K 超大上下文
- 适合处理长文档、代码库
- 自动降级到 32K/8K 保证运行

## 四、模型策略详解

### 1. modelStrategy 配置项说明

```json
"modelStrategy": {
  "inferenceModel": "glm-4-plus",     // 正常模式模型
  "lowComputeModel": "glm-4-flash",   // 低计算模式模型
  "criticalModel": "glm-4-air",       // 危急模式模型
  "maxTokensPerTurn": 4096,           // 单次调用最大 tokens
  "hourlyBudgetCents": 0,             // 每小时预算（0=无限制）
  "sessionBudgetCents": 0,            // 会话总预算（0=无限制）
  "perCallCeilingCents": 0,           // 单次调用上限（0=无限制）
  "enableModelFallback": true,        // 启用模型降级
  "anthropicApiVersion": "2023-06-01"
}
```

### 2. 自动降级策略

| 生存状态 | 余额范围 | 使用的模型 | 行为 |
|---------|---------|-----------|------|
| **正常** | > $0.50 | `inferenceModel` | 完整功能，使用高性能模型 |
| **低计算** | $0.10 - $0.50 | `lowComputeModel` | 降级到经济模型，减少消耗 |
| **危急** | < $0.10 | `criticalModel` | 最小化消耗，仅维持生存 |

### 3. 预算控制

```json
"modelStrategy": {
  "hourlyBudgetCents": 5000,      // 每小时最多消耗 5000 cents ($50)
  "perCallCeilingCents": 1000,    // 单次调用不超过 1000 cents ($10)
  "enableModelFallback": true
}
```

## 五、多模型配置示例

### 混合使用不同提供商

```json
{
  "name": "多模型 Automaton",
  "zhipuApiKey": "your-zhipu-key",
  "qwenApiKey": "your-qwen-key",
  "kimiApiKey": "your-kimi-key",
  "openaiApiKey": "your-openai-key",
  "modelStrategy": {
    "inferenceModel": "glm-4-plus",       // 主模型：智普
    "lowComputeModel": "qwen-turbo",      // 降级：Qwen
    "criticalModel": "moonshot-v1-8k",    // 危急：Kimi
    "enableModelFallback": true
  }
}
```

**优势**:
- 灵活选择不同提供商的优势模型
- 分散风险，避免单一提供商故障
- 优化成本和性能

## 六、获取 API Key 的步骤

### 1. 智普 AI (Zhipu)

1. 访问 [智普开放平台](https://open.bigmodel.cn/)
2. 注册账号并登录
3. 进入「API Key」页面
4. 点击「创建 API Key」
5. 复制生成的 Key 并设置到环境变量

### 2. 通义千问 (Qwen)

1. 访问 [DashScope](https://dashscope.aliyun.com/)
2. 使用阿里云账号登录
3. 开通「通义千问」服务
4. 进入「API Key 管理」
5. 创建新的 API Key
6. 复制 Key 并设置环境变量

### 3. Kimi

1. 访问 [Kimi 开放平台](https://platform.moonshot.cn/)
2. 注册账号
3. 创建应用
4. 在应用详情中获取 API Key
5. 设置环境变量

## 七、验证配置

### 1. 检查环境变量

```bash
# 查看是否设置了必要的环境变量
echo $ZHIPU_API_KEY
echo $QWEN_API_KEY
echo $KIMI_API_KEY
```

### 2. 查看可用模型

```bash
# 运行模型选择器
node dist/index.js --pick-model

# 输出应该包含：
#   glm-4-plus (Zhipu)
#   glm-4 (Zhipu)
#   glm-4-air (Zhipu)
#   glm-4-flash (Zhipu)
#   qwen-max (Qwen)
#   qwen-plus (Qwen)
#   qwen-turbo (Qwen)
#   qwen-vl-plus (Qwen)
#   moonshot-v1-128k (Kimi)
#   moonshot-v1-32k (Kimi)
#   moonshot-v1-8k (Kimi)
```

### 3. 测试运行

```bash
# 运行 automaton
node dist/index.js --run

# 查看日志确认使用的模型
tail -f ~/.automaton/logs/automaton.log
```

## 八、常见问题

### Q1: 如何切换到不同的模型？

**方法 1**: 重新运行模型选择器
```bash
node dist/index.js --pick-model
```

**方法 2**: 修改配置文件
```bash
nano ~/.automaton/automaton.json
# 修改 "inferenceModel" 字段
# 保存并重启 automaton
```

**方法 3**: 设置环境变量（临时）
```bash
export INFERENCE_MODEL="glm-4-flash"
node dist/index.js --run
```

### Q2: 如何降低成本？

1. **选择经济型模型**: `glm-4-flash`, `qwen-turbo`, `moonshot-v1-8k`
2. **设置预算限制**:
   ```json
   {
     "hourlyBudgetCents": 1000,
     "perCallCeilingCents": 100
   }
   ```
3. **启用自动降级**:
   ```json
   {
     "enableModelFallback": true,
     "lowComputeModel": "glm-4-flash"
   }
   ```

### Q3: 多个 API Key 如何同时使用？

配置文件中可以同时设置多个 API Key：

```json
{
  "zhipuApiKey": "key1",
  "qwenApiKey": "key2",
  "kimiApiKey": "key3",
  "openaiApiKey": "key4"
}
```

系统会根据 `inferenceModel` 的值自动选择对应的 API Key。

### Q4: 如何查看当前使用的模型和成本？

```bash
# 查看 automaton 状态
node packages/cli/dist/index.js status

# 查看最近日志（包含模型使用信息）
node packages/cli/dist/index.js logs --tail 50
```

## 九、最佳实践建议

1. **开发阶段**: 使用 `glm-4-flash` 或 `qwen-turbo` 进行快速测试
2. **生产部署**: 根据需求选择 `glm-4-plus` 或 `qwen-max`
3. **预算管理**: 设置合理的预算限制
4. **模型降级**: 启用自动降级策略，保证生存
5. **日志监控**: 定期检查日志，监控模型使用和成本
6. **备份配置**: 保存不同场景的配置文件，方便切换

## 十、下一步

- 运行 `automaton --pick-model` 探索所有可用模型
- 参考 `examples/config-with-chinese-models.json` 获取完整配置
- 查看 [README.md](../README.md) 了解更多模型详情
- 阅读 [ARCHITECTURE.md](../ARCHITECTURE.md) 了解系统架构
