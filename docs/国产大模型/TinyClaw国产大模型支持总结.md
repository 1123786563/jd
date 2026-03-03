# TinyClaw 国产大模型支持总结

## 概述

本次更新为 TinyClaw 项目添加了对三个国产大模型的完整支持：

1. **智普（Zhipu / GLM）** - 智谱 AI 推出的大语言模型系列
2. **Kimi（Moonshot）** - 月之暗面推出的多模态大模型
3. **Qwen（通义千问）** - 阿里巴巴推出的通义千问大模型系列

## 实现范围

### 后端支持（已完成）

✅ **模型解析函数**

- `resolveZhipuModel()` - 智普模型解析
- `resolveKimiModel()` - Kimi 模型解析
- `resolveQwenModel()` - Qwen 模型解析

✅ **Invoke 逻辑**

- 通过 OpenCode CLI 调用智普、Kimi、Qwen 模型
- 支持会话续接（`-c` 参数）
- 支持自定义模型选择

✅ **Provider 支持**

- `zhipu` 或 `glm` → 智普
- `kimi` 或 `moonshot` → Kimi
- `qwen`、`tongyi` 或 `alibaba` → Qwen

✅ **类型定义**

- `AgentConfig` 接口支持所有 provider
- 模型映射表（`ZHIPU_MODEL_IDS`、`KIMI_MODEL_IDS`、`QWEN_MODEL_IDS`）

### 前端支持（已完成）

✅ **TinyOffice 代理管理界面**

- 添加了新 provider 选项到下拉菜单
- 添加了对应的颜色样式：
  - 智普：紫色系
  - Kimi：粉色系
  - Qwen：黄色系
- 动态模型提示词（根据选择的 provider 显示相应的模型示例）

✅ **构建验证**

- TypeScript 编译通过
- Next.js 构建成功
- 所有测试通过

### 文档支持（已完成）

✅ **中文使用指南** (`使用国产大模型指南.md`)

- 详细的安装和配置步骤
- 三个模型的完整列表
- 性能对比和使用建议
- 故障排查指南
- 最佳实践示例

✅ **配置示例** (`国产大模型配置示例.md`)

- 单个代理配置示例
- 多个代理混合使用示例
- 团队协作配置示例
- 完整的 settings.json 配置

✅ **README 更新**

- 更新了"Multiple AI providers"描述
- 添加了 OpenCode CLI 到前提条件

### 测试验证（已完成）

✅ **模型解析测试** (`test-model-parsing.ts`)

- 智普模型：7/7 通过
- Kimi 模型：6/6 通过
- Qwen 模型：8/8 通过
- 总体：21/21 通过 (100%)

✅ **前端构建测试**

- Next.js 构建成功
- 无 TypeScript 错误

## 技术实现细节

### 后端实现

**文件**: `tinyclaw/src/lib/invoke.ts`

```typescript
// 智普支持
} else if (provider === 'zhipu' || provider === 'glm') {
    const modelId = resolveZhipuModel(agent.model);
    const opencodeArgs = ['run', '--format', 'json'];
    opencodeArgs.push('--model', `zhipu/${modelId}`);
    // ...
}

// Kimi 支持
} else if (provider === 'kimi' || provider === 'moonshot') {
    const modelId = resolveKimiModel(agent.model);
    const opencodeArgs = ['run', '--format', 'json'];
    opencodeArgs.push('--model', `kimi/${modelId}`);
    // ...
}

// Qwen 支持
} else if (provider === 'qwen' || provider === 'tongyi' || provider === 'alibaba') {
    const modelId = resolveQwenModel(agent.model);
    const opencodeArgs = ['run', '--format', 'json'];
    opencodeArgs.push('--model', `qwen/${modelId}`);
    // ...
}
```

**文件**: `tinyclaw/src/lib/types.ts`

```typescript
// 智普模型列表
export const ZHIPU_MODEL_IDS: Record<string, string> = {
    'glm-4': 'glm-4',
    'glm-4-plus': 'glm-4-plus',
    'glm-4-air': 'glm-4-air',
    // ... 更多模型
    'glm': 'glm-4',           // 别名
    'chatglm': 'glm-4',       // 别名
};

// Kimi 模型列表
export const KIMI_MODEL_IDS: Record<string, string> = {
    'kimi-k2.5': 'kimi-k2.5',
    'kimi-k2.5-free': 'kimi-k2.5-free',
    'moonshot-v1-128k': 'moonshot-v1-128k',
    'kimi': 'kimi-k2.5',      // 别名
    'moonshot': 'moonshot-v1-8k', // 别名
};

// Qwen 模型列表
export const QWEN_MODEL_IDS: Record<string, string> = {
    'qwen-max': 'qwen-max',
    'qwen-plus': 'qwen-plus',
    'qwen-turbo': 'qwen-turbo',
    // ... 更多模型
    'qwen': 'qwen-max',       // 别名
    'tongyi': 'qwen-max',     // 别名
    'alibaba': 'qwen-max',    // 别名
};
```

### 前端实现

**文件**: `tinyclaw/tinyoffice/src/app/agents/page.tsx`

```typescript
// 添加颜色样式
const providerColors: Record<string, string> = {
  anthropic: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  openai: "bg-green-500/10 text-green-600 dark:text-green-400",
  opencode: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  zhipu: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  kimi: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  qwen: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
};

// 添加 Provider 选项
<Select value={form.provider} onChange={(e) => set("provider", e.target.value)}>
  <option value="anthropic">anthropic</option>
  <option value="openai">openai</option>
  <option value="opencode">opencode</option>
  <option value="zhipu">zhipu (智谱)</option>
  <option value="glm">glm (智谱)</option>
  <option value="kimi">kimi (月之暗面)</option>
  <option value="moonshot">moonshot (月之暗面)</option>
  <option value="qwen">qwen (通义千问)</option>
  <option value="tongyi">tongyi (通义千问)</option>
  <option value="alibaba">alibaba (通义千问)</option>
</Select>

// 动态模型提示
<Input
  placeholder={
    form.provider === 'zhipu' || form.provider === 'glm'
      ? "e.g. glm-4, glm-4-plus, glm-4-air, glm-z1-flash"
      : form.provider === 'kimi' || form.provider === 'moonshot'
      ? "e.g. kimi-k2.5, kimi-k2.5-free, moonshot-v1-8k"
      : form.provider === 'qwen' || form.provider === 'tongyi' || form.provider === 'alibaba'
      ? "e.g. qwen-max, qwen-plus, qwen-turbo, qwen2.5-72b-instruct"
      : // ... 其他 provider
  }
/>
```

## 使用方法

### 1. 安装 OpenCode CLI

```bash
npm install -g @opencode/cli
```

### 2. 配置 API 密钥

```bash
# 智普
opencode config set zhipu.api_key "your-api-key"

# Kimi
opencode config set kimi.api_key "your-api-key"

# Qwen
opencode config set qwen.api_key "your-api-key"
```

### 3. 创建代理

**方法一：使用 TinyOffice 界面**

1. 打开 `http://localhost:3000`
2. 点击 "Agents"
3. 点击 "Add Agent"
4. 选择 provider（zhipu、kimi 或 qwen）
5. 输入模型名称
6. 保存

**方法二：手动编辑配置**

编辑 `~/.tinyclaw/settings.json`:

```json
{
  "agents": {
    "my-zhipu": {
      "name": "智普助手",
      "provider": "zhipu",
      "model": "glm-4",
      "working_directory": "/path/to/workspace/my-zhipu"
    }
  }
}
```

### 4. 使用代理

在聊天中：

```
@my-zhipu 请帮我写一个 Python 脚本
```

## 支持的模型

### 智普（Zhipu）

- `glm-4` (推荐)
- `glm-4-plus`
- `glm-4-air`
- `glm-4-flash`
- `glm-z1-flash`
- 更多见文档

### Kimi（Moonshot）

- `kimi-k2.5` (推荐)
- `kimi-k2.5-free`
- `moonshot-v1-128k`
- 更多见文档

### Qwen（通义千问）

- `qwen-max` (推荐)
- `qwen-plus`
- `qwen-turbo`
- `qwen2.5-72b-instruct`
- 更多见文档

## 文件清单

### 修改的文件

- `tinyclaw/src/lib/types.ts` - 添加模型映射
- `tinyclaw/tinyoffice/src/app/agents/page.tsx` - 更新前端界面

### 新增的文件

- `tinyclaw/test-model-parsing.ts` - 测试脚本
- `docs/使用国产大模型指南.md` - 完整使用指南
- `docs/国产大模型配置示例.md` - 配置示例

### 更新的文件

- `tinyclaw/README.md` - 更新功能列表和前提条件

## 下一步

- [ ] 添加更多模型的详细文档
- [ ] 创建视频教程
- [ ] 添加性能基准测试
- [ ] 支持更多国产模型（如百川、零一万物等）

## 相关资源

- [智谱 AI 开放平台](https://open.bigmodel.cn/)
- [Moonshot AI 平台](https://platform.moonshot.cn/)
- [阿里云百炼平台](https://bailian.console.aliyun.com/)
- [OpenCode CLI 文档](https://opencode.ai/docs)
