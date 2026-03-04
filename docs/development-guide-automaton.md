# Conway Automaton - 开发指南

**所属部分：** automaton
**上次更新：** 2026-03-03

---

## 前置条件

- **Node.js** >= 20.0.0
- **pnpm** 包管理器
- **Git** 版本控制工具
- **Conway API Key** (可选，用于计费/额度)
- **Ethereum 钱包** (可选，用于 Web3 功能)

---

## 快速入门

### 1. 克隆并安装

```bash
cd automaton
pnpm install
```

### 2. 首次运行 (设置向导)

```bash
pnpm dev
```

首次运行将触发交互式设置向导，该向导将：

- 配置 LLM 供应商 (Claude, OpenAI 等)
- 设置金库 (Treasury) 和预算策略
- 选择默认推理模型
- 配置 Conway API 集成 (可选)
- 设置以太坊钱包 (可选)

### 3. 手动设置 (替代方案)

```bash
automaton --setup          # 重新运行设置向导
automaton --configure      # 编辑配置
automaton --pick-model     # 选择推理模型
automaton --provision      # 供给 Conway API 密钥
```

---

## 项目结构

```
automaton/
├── src/                    # 主源代码
│   ├── agent/              # 核心智能体循环与策略引擎
│   │   ├── loop.ts         # ReAct 执行循环
│   │   ├── context.ts      # 上下文构建
│   │   ├── tools.ts        # 工具注册与执行
│   │   ├── system-prompt.ts # 系统提示词构建
│   │   ├── injection-defense.ts # 安全过滤
│   │   ├── policy-engine.ts # 策略执行
│   │   └── policy-rules/   # 策略规则实现
│   ├── memory/             # 多层记忆系统
│   │   ├── working.ts      # 工作记忆 (活跃上下文)
│   │   ├── episodic.ts     # 情节记忆 (事件历史)
│   │   ├── semantic.ts     # 语义记忆 (知识库)
│   │   ├── procedural.ts   # 程序记忆 (技能库)
│   │   ├── knowledge-store.ts # 知识存储
│   │   ├── context-manager.ts # 上下文聚合
│   │   ├── compression-engine.ts # 记忆压缩
│   │   ├── retrieval.ts    # 记忆检索
│   │   └── ingestion.ts    # 知识摄取
│   ├── conway/             # Conway API 集成
│   │   ├── client.ts       # HTTP 客户端
│   │   ├── credits.ts      # 额度追踪
│   │   ├── x402.ts         # USDC 余额
│   │   ├── inference.ts    # 推理 API
│   │   └── topup.ts        # 自动充值
│   ├── identity/           # Web3 身份
│   │   ├── wallet.ts       # 以太坊钱包
│   │   └── provision.ts    # API 密钥供给
│   ├── self-mod/           # 自修改功能
│   │   ├── code.ts         # 代码生成
│   │   ├── tools-manager.ts # 工具生命周期管理
│   │   ├── upstream.ts     # Git 集成
│   │   └── audit-log.ts    # 变更审计
│   ├── inference/          # 多供应商推理
│   │   ├── registry.ts     # 模型注册表
│   │   ├── budget.ts       # 预算追踪
│   │   ├── router.ts       # 推理路由
│   │   └── provider-registry.ts # 供应商管理
│   ├── state/              # 持久化层
│   │   └── database.ts     # SQLite 数据库
│   ├── setup/              # 配置向导
│   │   ├── wizard.ts       # 交互式设置
│   │   ├── configure.ts    # 配置编辑
│   │   ├── model-picker.ts # 模型选择
│   │   └── environment.ts  # 环境加载
│   ├── heartbeat/          # 调度系统
│   │   ├── daemon.ts       # 心跳守护进程
│   │   └── config.ts       # 唤醒事件配置
│   ├── skills/             # 已安装技能
│   │   └── loader.ts       # 技能加载
│   ├── social/             # 社交平台集成
│   │   └── client.ts       # 社交客户端
│   ├── orchestration/      # 多智能体编排
│   │   ├── orchestrator.ts # 智能体编排
│   │   ├── plan-mode.ts    # 计划模式控制器
│   │   ├── attention.ts    # 注意力机制
│   │   ├── messaging.ts    # 智能体间消息传递
│   │   ├── local-worker.ts # 本地工作线程池
│   │   └── simple-tracker.ts # 简单智能体追踪
│   ├── observability/      # 可观测性与监控
│   │   └── logger.ts       # 结构化日志记录
│   ├── git/                # Git 集成
│   │   └── state-versioning.ts # 状态版本控制
│   └── index.ts            # 主入口文件
├── packages/cli/           # CLI 软件包
│   └── src/
│       ├── commands/       # CLI 命令
│       │   ├── status.ts   # status 命令
│       │   ├── logs.ts     # logs 命令
│       │   ├── send.ts     # send 消息命令
│       │   └── fund.ts     # fund 金库命令
│       └── index.ts        # CLI 入口
├── tests/                  # 测试套件
├── dist/                   # 编译输出
├── config/                 # 配置文件
├── .automaton/             # 运行时数据 (钱包、状态、日志)
├── package.json            # 依赖与脚本
└── tsconfig.json           # TypeScript 配置
```

---

## 开发流程

### 构建

```bash
pnpm build                 # 将 TypeScript 编译到 dist/
pnpm build:watch           # 开发模式下的监听构建
```

### 运行

```bash
pnpm dev                   # 开发运行模式 (监听 + 运行)
node dist/index.js         # 运行编译后的版本
```

### CLI 命令

```bash
automaton --version        # 显示版本
automaton --help           # 显示帮助
automaton --status         # 显示智能体状态
automaton --setup          # 运行设置向导
automaton --configure      # 编辑配置
automaton --pick-model     # 选择推理模型
automaton --provision      # 供给 Conway API 密钥
automaton --init           # 初始化钱包与配置
```

---

## 配置说明

### 配置文件

- `~/.automaton/config.json` - 主配置文件
- `~/.automaton/wallet.json` - 以太坊钱包文件
- `~/.automaton/state.db` - SQLite 数据库文件
- `~/.automaton/logs/` - 日志目录

### 环境变量

```bash
CONWAY_API_URL=https://api.conway.tech      # Conway API 地址
CONWAY_API_KEY=sk-...                       # Conway API 密钥
OLLAMA_BASE_URL=http://localhost:11434      # Ollama 基础地址
AUTOMATON_LOG_LEVEL=info                    # 日志级别 (debug, info, warn, error)
```

### 配置示例

```json
{
  "model": {
    "provider": "claude",
    "name": "claude-3-opus",
    "temperature": 0.7,
    "max_tokens": 4096
  },
  "treasury": {
    "credit_limit": 1000,
    "spend_limit_per_turn": 100,
    "auto_topup": false
  },
  "providers": {
    "claude": {
      "api_key": "sk-...",
      "base_url": "https://api.anthropic.com"
    },
    "openai": {
      "api_key": "sk-...",
      "base_url": "https://api.openai.com"
    }
  },
  "policies": {
    "enable_injection_defense": true,
    "enable_policy_engine": true,
    "max_tool_calls_per_turn": 10,
    "max_consecutive_errors": 5
  }
}
```

---

## 测试

### 运行测试

```bash
pnpm test                  # 运行所有测试
pnpm test:coverage         # 运行并生成覆盖率报告
pnpm test:security         # 侧重安全性的测试
pnpm test:financial        # 财务/金库相关测试
pnpm test:ci               # CI 优化测试
```

### 测试结构

```
tests/
├── agent/
│   ├── loop.test.ts       # 智能体循环测试
│   ├── policy.test.ts     # 策略引擎测试
│   └── tools.test.ts      # 工具执行测试
├── memory/
│   ├── working.test.ts    # 工作记忆测试
│   ├── episodic.test.ts   # 情节记忆测试
│   └── semantic.test.ts   # 语义记忆测试
├── conway/
│   ├── credits.test.ts    # 额度追踪测试
│   └── inference.test.ts  # 推理 API 测试
├── self-mod/
│   └── code.test.ts       # 代码生成测试
└── integration/
    └── e2e.test.ts        # 端到端集成测试
```

---

## 添加新功能

### 1. 添加新工具 (Tool)

工具用于扩展智能体的能力。在 `src/agent/tools/` 中创建：

```typescript
// src/agent/tools/my-tool.ts
import type { AutomatonTool, ToolContext } from "../types.js";

export const myTool: AutomatonTool = {
  name: "my_tool",
  description: "执行某些有用的操作",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "输入参数" }
    },
    required: ["input"]
  },
  async execute(context: ToolContext, args: { input: string }): Promise<string> {
    // 工具具体实现逻辑
    return `结果: ${args.input}`;
  }
};
```

在 `src/agent/tools.ts` 中注册：

```typescript
export function createBuiltinTools(sandboxId: string) {
  return {
    // ... 现有工具
    my_tool: myTool,
  };
}
```

### 2. 添加策略规则 (Policy Rule)

策略规则用于确保安全性。在 `src/agent/policy-rules/` 中创建：

```typescript
// src/agent/policy-rules/my-rule.ts
import type { PolicyRule, AgentState } from "../../types.js";

export const myRule: PolicyRule = {
  name: "my_rule",
  description: "验证某些内容",
  validate(state: AgentState): { allowed: boolean; reason?: string } {
    // 验证逻辑
    if (/* 某些条件 */) {
      return { allowed: false, reason: "不允许操作" };
    }
    return { allowed: true };
  }
};
```

在 `src/agent/policy-rules/index.ts` 中注册：

```typescript
export function createDefaultRules(): PolicyRule[] {
  return [
    // ... 现有规则
    myRule,
  ];
}
```

### 3. 添加记忆层 (Memory Layer)

在 `src/memory/` 中创建新的记忆类型：

```typescript
// src/memory/my-memory.ts
import type { MemoryBlock } from "../types.js";

export class MyMemory {
  async store(key: string, value: any): Promise<void> {
    // 存储逻辑
  }

  async retrieve(key: string): Promise<any> {
    // 检索逻辑
  }

  async search(query: string): Promise<MemoryBlock[]> {
    // 搜索逻辑
  }
}
```

在 `src/memory/memory.ts` 中集成：

```typescript
export class MemoryManager {
  private myMemory: MyMemory;

  constructor() {
    this.myMemory = new MyMemory();
  }

  // 在上下文构建、检索等流程中使用
}
```

---

## 调试

### 日志级别

```bash
AUTOMATON_LOG_LEVEL=debug    # 详细调试日志
AUTOMATON_LOG_LEVEL=info     # 正常运行 (默认)
AUTOMATON_LOG_LEVEL=warn     # 仅限警告
AUTOMATON_LOG_LEVEL=error    # 仅限错误
```

### 调试智能体循环

向 `src/agent/loop.ts` 添加日志：

```typescript
logger.debug("上下文:", context);
logger.debug("响应:", response);
logger.debug("工具调用:", toolCalls);
```

### 检查数据库

```bash
sqlite3 ~/.automaton/state.db
.tables                        # 列出表
SELECT * FROM agent_state;     # 查看智能体状态
SELECT * FROM agent_turns;     # 查看对话历史
SELECT * FROM memory_blocks;   # 查看记忆块
```

---

## 常用任务

### 重置智能体状态

```bash
rm -rf ~/.automaton/state.db
rm -rf ~/.automaton/logs/*
automaton --init
```

### 更改推理模型

```bash
automaton --pick-model
# 或者手动编辑 ~/.automaton/config.json
```

### 为金库注资

```bash
automaton fund --amount 1000   # 添加 1000 额度
# 或者使用 CLI：
cd packages/cli
pnpm fund --amount 1000
```

### 查看日志

```bash
tail -f ~/.automaton/logs/automaton.log
# 或者使用 CLI：
cd packages/cli
pnpm logs
```

### 向智能体发送消息

```bash
cd packages/cli
pnpm send "你好，最近怎么样？"
```

---

## 架构模式

### ReAct 循环

核心模式是 **ReAct (Reasoning + Acting，推理 + 行动)**：

1. **思考 (Think)** - 分析上下文，决定下一步行动
2. **行动 (Act)** - 执行工具或生成响应
3. **观察 (Observe)** - 捕获结果
4. **持久化 (Persist)** - 存储到记忆中

### 多层记忆

具有不同生命周期的四个记忆层级：

- **工作记忆 (Working)** - 活跃上下文 (会话作用域)
- **情节记忆 (Episodic)** - 事件历史 (持久化)
- **语义记忆 (Semantic)** - 知识库 (持久化)
- **程序记忆 (Procedural)** - 技能与工具 (持久化)

### 策略驱动的安全

所有操作都必须通过策略引擎：

- 输入验证
- 速率限制
- 路径保护
- 预算强制执行
- 注入防御 (Injection defense)

---

## 最佳实践

1. **类型安全：** 严格使用 TypeScript，杜绝 `any`
2. **错误处理：** 始终捕获并记录错误
3. **测试：** 为所有新功能编写测试
4. **文档：** 为所有公开 API 编写文档
5. **安全性：** 处理所有输入，验证所有输出
6. **性能：** 优化前先进行性能分析
7. **代码风格：** 遵循现有的模式和约定

---

## 故障排除

### 智能体未启动

```bash
# 检查日志
tail -f ~/.automaton/logs/automaton.log

# 检查配置
cat ~/.automaton/config.json

# 重置并重新初始化
rm -rf ~/.automaton/*
automaton --init
```

### 额度不足

```bash
# 检查余额
automaton --status

# 添加额度
automaton fund --amount 1000

# 或者在 config.json 中配置自动充值
```

### 工具不起作用

1. 检查工具是否已在 `src/agent/tools.ts` 中注册
2. 检查工具参数是否符合 Schema (架构)
3. 检查工具执行逻辑是否包含适当的错误处理
4. 检查日志中是否存在特定工具的错误

### 记忆问题

1. 检查 SQLite 数据库是否损坏
2. 检查 `~/.automaton/` 目录的磁盘空间
3. 检查配置中的记忆预算限制
4. 检查记忆压缩设置

---

## 贡献代码

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 修改代码并添加测试
4. 运行测试 (`pnpm test`)
5. 提交更改 (`git commit -m 'Add amazing feature'`)
6. 推送到分支 (`git push origin feature/amazing-feature`)
7. 开启拉取请求 (Pull Request)

---

## 相关资源

- [架构文档 (中文)](./architecture-automaton.md)
- [源码树分析 (中文)](./source-tree-analysis.md)
- [项目概览 (中文)](./project-overview.md)
- [automaton/AGENTS.md](../automaton/AGENTS.md) - 智能体配置
- [automaton/CLAUDE.md](../automaton/CLAUDE.md) - 项目指南

---

_本开发指南由 BMAD `document-project` 工作流生成_
