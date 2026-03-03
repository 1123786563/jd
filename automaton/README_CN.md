# Automaton - 中文大模型配置说明

Automaton 现已支持智普、通义千问、Kimi 等中文大模型！

## 快速开始（3步完成）

### 1. 设置 API Key

```bash
# 智普 AI
export ZHIPU_API_KEY="你的智普API密钥"

# 通义千问
export QWEN_API_KEY="你的通义千问API密钥"

# Kimi
export KIMI_API_KEY="你的Kimi API密钥"
```

### 2. 选择模型

```bash
cd automaton
node dist/index.js --pick-model
```

### 3. 运行 Automaton

```bash
node dist/index.js --run
```

## 支持的中文大模型

### 智普 AI (Zhipu)

- **glm-4-plus**: 高性能模型 (¥10/¥40 每百万 tokens)
- **glm-4**: 平衡型模型 (¥5/¥20 每百万 tokens)
- **glm-4-air**: 经济型模型 (¥1/¥4 每百万 tokens)
- **glm-4-flash**: 超经济型模型 (¥0.1/¥0.4 每百万 tokens)

### 通义千问 (Qwen)

- **qwen-max**: 最大能力模型 (¥10/¥40 每百万 tokens)
- **qwen-plus**: 平衡型模型 (¥5/¥20 每百万 tokens)
- **qwen-turbo**: 快速经济型模型 (¥1/¥4 每百万 tokens)
- **qwen-vl-plus**: 视觉语言模型 (¥10/¥40 每百万 tokens)

### Kimi (月之暗面)

- **moonshot-v1-128k**: 128K上下文模型 (¥6/¥24 每百万 tokens)
- **moonshot-v1-32k**: 32K上下文模型 (¥3/¥12 每百万 tokens)
- **moonshot-v1-8k**: 8K上下文模型 (¥1/¥4 每百万 tokens)

## 配置示例

### 简单配置（开发测试）

```json
{
  "inferenceModel": "glm-4-flash",
  "maxTokensPerTurn": 2048,
  "modelStrategy": {
    "inferenceModel": "glm-4-flash",
    "lowComputeModel": "glm-4-flash",
    "criticalModel": "glm-4-flash",
    "enableModelFallback": true
  }
}
```

### 生产配置（高性能）

```json
{
  "inferenceModel": "glm-4-plus",
  "maxTokensPerTurn": 8192,
  "modelStrategy": {
    "inferenceModel": "glm-4-plus",
    "lowComputeModel": "glm-4",
    "criticalModel": "glm-4-air",
    "enableModelFallback": true
  }
}
```

## 使用场景推荐

| 场景 | 推荐模型 | 说明 |
|-----|---------|------|
| 代码生成 | glm-4-plus / qwen-max | 强大的代码理解和生成能力 |
| 中文对话 | glm-4 / qwen-plus | 中文优化，成本适中 |
| 长文档处理 | moonshot-v1-128k | 128K超大上下文 |
| 预算紧张 | glm-4-flash | 成本最低，性价比高 |

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
2. 注册账号并创建应用
3. 获取 API Key

## 更多资源

- 📋 [配置速查表](QUICK_CONFIG.md) - 快速查找配置方法
- 📖 [配置指南](CONFIG_GUIDE.md) - 详细的配置说明
- 💡 [示例配置](examples/) - 完整的配置示例
- 📚 [英文文档](README.md) - 完整的英文文档

## 常见问题

### Q: 如何切换模型？

```bash
# 方法 1: 重新选择
node dist/index.js --pick-model

# 方法 2: 修改配置文件
nano ~/.automaton/automaton.json
# 修改 "inferenceModel" 后重启
```

### Q: 如何降低成本？

1. 选择经济型模型 (glm-4-flash, qwen-turbo)
2. 设置预算限制
3. 启用自动降级策略

### Q: 多个 API Key 如何使用？

配置文件中可以同时设置多个 API Key，系统会根据模型自动选择：

```json
{
  "zhipuApiKey": "智普Key",
  "qwenApiKey": "通义千问Key",
  "kimiApiKey": "Kimi Key"
}
```

## 技术支持

如有问题，请：
1. 查看 [故障排查](QUICK_CONFIG.md#七故障排查速查)
2. 检查日志: `tail -f ~/.automaton/logs/automaton.log`
3. 运行状态检查: `node packages/cli/dist/index.js status`
