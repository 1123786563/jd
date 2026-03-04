# JD 项目上下文

---
created: 2026-03-03
last_updated: 2026-03-04
sections_completed:

- technology-stack
- language-rules
- framework-rules
- testing-rules
- code-quality-rules
- workflow-rules
- critical-rules
- llm-providers
- channel-integrations
status: complete

---

## 技术栈与版本

### Automaton (主权 AI 智能体运行时)

| 技术 | 版本 | 用途 |
|------------|---------|---------|
| TypeScript | 5.9.3 | 主要语言 |
| Node.js | >= 20.0.0 | 运行时 |
| 模块系统 | ESM (NodeNext) | 模块解析 |
| pnpm | 10.28.1 | 包管理器 |
| Express | 5.2.1 | HTTP 服务器 |
| OpenAI SDK | 6.24.0 | LLM 集成 |
| viem | 2.44.2 | 以太坊客户端 |
| better-sqlite3 | 11.0.0 | 数据库 |
| Vitest | 2.0.0 | 测试 |

### TinyClaw (多团队助手)

| 技术 | 版本 | 用途 |
|------------|---------|---------|
| TypeScript | 5.9.3 | 主要语言 |
| 模块系统 | CommonJS | 模块解析 |
| npm | - | 包管理器 |
| Hono | 4.12.1 | HTTP 框架 |
| Discord.js | 14.16.0 | Discord 集成 |
| Telegram Bot API | 0.67.0 | Telegram 集成 |
| WhatsApp Web.js | 1.34.6 | WhatsApp 集成 |
| 飞书 API | - | 飞书集成 |

### TinyOffice (前端)

| 技术 | 版本 | 用途 |
|------------|---------|---------|
| Next.js | 16.1.6 | React 框架 |
| React | 19.2.3 | UI 库 |
| Tailwind CSS | 4 | 样式 |
| Radix UI | 1.4.3 | 组件原型 |

### 关键版本约束

- 所有项目均要求 Node.js 20+
- 所有项目均启用 TypeScript 严格模式
- 不同的模块系统：Automaton 使用 ESM，TinyClaw 使用 CommonJS

## 语言特定规则

### TypeScript 配置

- 所有项目均启用 **strict: true**
- **declaration: true** - 生成 .d.ts 文件
- **declarationMap: true** - 启用跳转到定义
- **sourceMap: true** - 启用调试

### 导入/导出模式 (关键)

**Automaton (ESM/NodeNext):**

```typescript
// 导入时必须使用 .js 扩展名（即使是 .ts 文件）
import { foo } from "./bar.js";  // 正确
import { foo } from "./bar";      // 错误 - 运行时会失败
```

**TinyClaw (CommonJS):**

```typescript
// 导入时不带扩展名
import { foo } from "./bar";      // 正确
```

### 错误处理

- 所有异步操作均使用 try/catch 包装
- 使用 StructuredLogger 进行带上下文的错误日志记录
- 数据库错误记录时包含查询上下文

### Async/Await 约定

- 优先使用 async/await 而非 Promise 链
- 所有智能体循环函数均为异步
- 心跳任务使用带租约管理的异步执行

## 框架特定规则

### Express (Automaton)

- 路由使用异步处理器定义
- 错误中间件捕获异步错误
- 所有响应均使用 JSON 格式

### Hono (TinyClaw)

- 轻量级 HTTP 框架
- 路由：`app.get('/path', handler)`
- 通过 `c` 参数传递上下文

### 飞书客户端集成 (TinyClaw)

- 支持飞书消息接收、发送、用户配对
- Webhook 签名验证（可选）
- 访问令牌自动刷新（5分钟缓冲）
- 支持私聊和群聊场景
- `/agent`、`/team`、`/reset` 命令支持

### Next.js (TinyOffice)

- App Router (Next.js 16)
- 默认使用服务端组件
- 客户端组件标注 `'use client'`

### React 19 模式

- 使用 Hooks 进行状态管理
- 使用 `useFormStatus`, `useFormState` 处理表单
- 使用 Radix UI 原型保证无障碍性

### 智能体架构 (Automaton)

```
ReAct Loop: Think -> Act -> Observe -> Persist
- 10 个类别中的 57 个工具
- 策略引擎验证每一次工具调用
- 5 层记忆系统
- 用于后台任务的心跳守护进程
```

### 大语言模型提供商集成 (Automaton)

**支持的模型提供商：**
- OpenAI (gpt-4.1, gpt-4.1-mini, gpt-4.1-nano)
- Groq (llama-3.3-70b, llama-3.1-8b)
- Together AI (Llama-3.3-70B, Llama-3.1-8B)
- Local (Ollama/vLLM)
- **智普 (Zhipu)** - glm-4-plus, glm-4, glm-4-air, glm-4-flash
- **通义千问 (Qwen)** - qwen-max, qwen-plus, qwen-turbo, qwen-vl-plus
- **Kimi (月之暗面)** - moonshot-v1-128k, moonshot-v1-32k, moonshot-v1-8k

**模型层级：**
- `reasoning` - 推理模型（优先处理复杂任务）
- `fast` - 快速模型（平衡速度和质量）
- `cheap` - 低成本模型（优先节省预算）

**配置优先级：**
```typescript
const DEFAULT_TIER_DEFAULTS = {
  reasoning: { preferredProvider: "openai", fallbackOrder: ["groq", "together"] },
  fast: { preferredProvider: "groq", fallbackOrder: ["openai", "together", "local"] },
  cheap: { preferredProvider: "groq", fallbackOrder: ["together", "local", "openai"] },
};
```

### 多渠道消息推送 (TinyClaw)

- Discord, Telegram, WhatsApp, 飞书客户端
- 共享的消息队列处理器
- 基于团队的智能体路由
- `/agent` - 显示可用智能体列表
- `/team` - 显示可用团队列表
- `/reset @agent_id` - 重置指定智能体上下文

## 测试规则

### 测试组织

- 测试位于 `src/__tests__/` 目录
- 测试文件命名为 `*.test.ts`
- 集成测试位于 `src/__tests__/integration/`

### Vitest 配置

```typescript
testTimeout: 30_000      // 30 秒
teardownTimeout: 5_000   // 5 秒
include: ["src/__tests__/**/*.test.ts"]
```

### 覆盖率阈值

| 指标 | 阈值 |
|--------|-----------|
| 语句 (Statements) | 60% |
| 分支 (Branches) | 50% |
| 函数 (Functions) | 55% |
| 行 (Lines) | 60% |

### 测试模式

- 单元测试：单个函数/模块
- 集成测试：多模块交互
- Mocks：`src/__tests__/mocks.ts`
- 使用内存 SQLite 进行数据库测试

### 测试结构

```typescript
describe('ModuleName', () => {
  describe('functionName', () => {
    it('should do something', async () => {
      // Arrange, Act, Assert
    });
  });
});
```

### 关键测试规则

- 测试异步代码时，所有测试必须是异步的
- `beforeEach` 用于设置，`afterEach` 用于清理
- 使用内存 SQLite，而非文件形式

## 代码质量与风格规则

### 文件命名

| 类型 | 模式 | 示例 |
|------|---------|---------|
| 源文件 | kebab-case | `agent-loop.ts` |
| 测试文件 | `*.test.ts` | `loop.test.ts` |
| 目录 | 小写 | `src/memory/` |
| React 组件 | PascalCase | `Button.tsx` |

### 命名规范

| 类型 | 规范 | 示例 |
|------|------------|---------|
| 类 | PascalCase | `AgentLoop` |
| 函数 | camelCase | `runAgentLoop` |
| 常量 | SCREAMING_SNAKE | `MAX_TOOL_CALLS` |
| 接口 | PascalCase (不带 I 前缀) | `AgentConfig` |
| 类型 | PascalCase | `AgentState` |

### 代码组织方位

```
src/
  module-name/           # 功能目录
    index.ts            # 公共导出
    types.ts            # 类型定义
    main-logic.ts       # 实现
```

### 日志标准

- 使用 `StructuredLogger` 并带上模块命名空间
- 日志级别：`debug`, `info`, `warn`, `error`, `fatal`
- 始终包含上下文对象

## 开发工作流规则

### 分支命名

```
feature/description    # 新功能
fix/description        # Bug 修复
refactor/description   # 代码重构
docs/description       # 文档更新
```

### 提交信息格式

```
type: 简短描述

# 类型: feat, fix, refactor, docs, test, chore
# 示例:
feat: 添加记忆压缩引擎
fix: 处理 http 客户端超时
```

### 包管理器命令

**Automaton:**

```bash
pnpm install          # 安装依赖
pnpm build            # 编译 TypeScript
pnpm test             # 运行 Vitest 测试
pnpm typecheck        # 仅执行类型检查
```

**TinyClaw:**

```bash
npm install           # 安装依赖
npm run build         # 编译 TypeScript
npm run whatsapp      # 启动 WhatsApp 客户端
npm run discord       # 启动 Discord 客户端
npm run feishu        # 启动飞书客户端
```

**TinyOffice:**

```bash
npm run dev           # 开发服务器
npm run build         # 生产构建
```

## 关键必读规则

### 模块系统错误 (关键)

```typescript
// 错误 - 在 ESM 中运行时会失败
import { foo } from "./bar";

// 在 Automaton (ESM) 中正确
import { foo } from "./bar.js";

// 在 TinyClaw (CommonJS) 中正确
import { foo } from "./bar";
```

### 数据库规则

- 测试中绝不使用基于文件的 SQLite
- 对用户输入始终使用预处理语句 (Prepared Statements)
- 对多步操作使用事务边界

### 安全规则

- 所有外部输入均通过 `injection-defense.ts` 进行消毒
- 策略引擎验证每一次工具调用
- 受保护文件：constitution, wallet, DB, config
- 绝不在日志中暴露私钥

### 智能体循环限制

| 常量 | 值 | 用途 |
|----------|-------|---------|
| `MAX_TOOL_CALLS_PER_TURN` | 10 | 截断执行 |
| `MAX_CONSECUTIVE_ERRORS` | 5 | 强制强制休眠阈值 |
| `MAX_REPETITIVE_TURNS` | 3 | 循环检测 |

### 性能规则

- 缓存积分/USDC 余额 (避免错误的死态检测)
- 将工具结果截断至 `MAX_TOOL_RESULT_SIZE`
- 对数据库操作使用连接池

### 大语言模型配置

**模型层级与用途：**
- `reasoning` - 推理模型，处理复杂任务、代码生成、规划
- `fast` - 快速模型，平衡速度和质量的通用任务
- `cheap` - 低成本模型，简单对话、信息检索

**国产大模型支持：**
- 智普 (Zhipu): glm-4-plus, glm-4, glm-4-air, glm-4-flash
- 通义千问 (Qwen): qwen-max, qwen-plus, qwen-turbo, qwen-vl-plus (支持视觉)
- Kimi (月之暗面): moonshot-v1-128k, moonshot-v1-32k, moonshot-v1-8k

**紧急停止策略：**
- 当信用余额低于阈值时触发
- 仅允许规划器调用，阻止其他推理请求
- 通过 `AUTOMATON_CREDITS_BALANCE` 和 `AUTOMATON_INFERENCE_TASK_TYPE` 环境变量配置

### 飞书客户端规则

- Webhook 签名验证通过 `FEISHU_ENCRYPT_KEY` 配置（可选）
- 访问令牌自动刷新（5分钟缓冲）
- 仅支持私聊消息 (chat_type: 'p2p')
- 支持文本消息类型
- 用户配对机制：首次对话需通过配对码授权
- 命令支持：`/agent`、`/team`、`/reset @agent_id`

---

## 使用指南

**对于 AI 智能体：**

- 在实现任何代码前阅读此文件
- 严格遵守记录的所有规则
- 如有疑虑，优先选择更严格的选项
- 如果出现新模式，请更新此文件

**对于人类：**

- 保持此文件简洁，专注于智能体需求
- 当技术栈变更时予以更新
- 每季度检查是否有过时规则
- 移除已变得显而易见的规则

**更新历史：**
- 2026-03-03 - 初始版本
- 2026-03-04 - 添加飞书集成和国产大模型支持（智普、通义千问、Kimi）

**上次更新：** 2026-03-03
