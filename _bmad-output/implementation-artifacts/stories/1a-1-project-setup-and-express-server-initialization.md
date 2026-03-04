# Story 1a.1: 项目搭建与 Express 服务器初始化

**状态：** ready-for-dev (准备开发)
**Epic：** Epic 1a - Conway Automaton 核心
**创建日期：** 2026-03-03
**优先级：** P0 (基础)

---

## 🎯 Story 目标

为 Conway Automaton 搭建基础的 TypeScript ESM 项目结构，包含 Express.js 服务器，为后续所有开发工作建立基础架构。

---

## 📋 用户 Story

**作为一名开发人员，**
**我想要初始化一个带有 Express.js 服务器的 TypeScript ESM 项目，**
**以便我能为自主智能体运行时打下坚实的基础。**

---

## ✅ 验收标准

**给定** 一个干净的项目目录
**当** 我运行 `pnpm install` 和 `pnpm dev` 时
**那么** Express 服务器在 3000 端口启动
**并且** 对 GET / 请求回应 "Conway Automaton Running"
**并且** 所有 TypeScript 严格模式规则均已启用
**并且** .gitignore 排除了 node_modules, dist, .env

---

## 🏗️ 技术要求

### **技术栈 (参考 project-context.md)**

| 组件 | 版本 | 说明 |
|-----------|---------|-------|
| **Node.js** | >= 20.0.0 | 必需的运行时 |
| **TypeScript** | 5.9.3 | 开启严格模式 |
| **模块系统** | ESM (NodeNext) | ⚠️ 关键：导入时必须使用 `.js` 扩展名 |
| **包管理器** | pnpm 10.28.1 | 使用 pnpm，而非 npm/yarn |
| **Express** | 5.2.1 | HTTP 服务器 |
| **测试** | Vitest 2.0.0 | 测试框架 |

### **ESM 模块系统规则** ⚠️ **关键说明**

```typescript
// ✅ 正确 - 导入时必须使用 .js 扩展名
import { foo } from "./bar.js";
import { baz } from "./module/index.js";

// ❌ 错误 - 在 ESM 中运行时会失败
import { foo } from "./bar";
import { baz } from "./module";
```

**原因：** Node.js ESM 要求所有导入都必须显式指定文件扩展名，即使在开发过程中导入 `.ts` 文件也是如此。

---

## 📁 项目结构

```
automaton/
├── src/
│   ├── index.ts                    # 服务器入口点
│   ├── types.ts                    # 全局类型定义
│   └── __tests__/
│       └── index.test.ts           # 服务器测试
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
└── .env.example
```

---

## 🔧 实施细节

### **1. Package.json 配置**

```json
{
  "name": "conway-automaton",
  "version": "1.0.0",
  "description": "Sovereign AI Agent Runtime",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "5.2.1",
    "typescript": "5.9.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.24",
    "tsx": "^4.7.0",
    "vitest": "2.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### **2. TypeScript 配置 (tsconfig.json)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**关键设置：**

- `"module": "NodeNext"` + `"moduleResolution": "NodeNext"` → 启用 ESM 模式
- `"strict": true` → 启用所有严格检查
- 导入路径中需要使用 `.js` 扩展名

### **3. Express 服务器 (src/index.ts)**

```typescript
import express, { Express, Request, Response } from 'express.js';

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint (健康检查端点)
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Conway Automaton Running',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Error handler middleware (错误处理中间件)
app.use((err: Error, req: Request, res: Response, next: Function) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message
  });
});

app.listen(port, () => {
  console.log(`Conway Automaton listening on port ${port}`);
});
```

### **4. .gitignore**

```
# Dependencies (依赖)
node_modules/
dist/

# Environment (环境)
.env
.env.local

# Logs (日志)
*.log
npm-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
```

### **5. .env.example**

```
# Server Configuration (服务器配置)
PORT=3000

# Conway API (将在 Epic 1b 中使用)
CONWAY_API_KEY=your_api_key_here
CONWAY_BASE_URL=https://api.conway.ai

# Database (将在 Epic 1a.10 中使用)
DATABASE_PATH=./data/automaton.db

# Logging (日志)
LOG_LEVEL=info
```

---

## 🧪 测试要求

### **测试文件：src/**tests**/index.test.ts**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Server', () => {
  describe('GET /', () => {
    it('should return health check response', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        message: 'Conway Automaton Running',
        status: 'healthy'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
```

### **Vitest 配置**

- 测试超时：30 秒
- 测试中使用内存数据库 (内存 SQLite)，而非基于文件的数据库
- 覆盖率阈值：语句 60%，分支 50%

---

## 🔐 安全考虑

- `.env` 文件需从 git 中排除
- 敏感配置使用环境变量
- Express 错误中间件捕获异步错误
- 仅使用 JSON 响应 (防止 HTML 注入)

---

## 📝 文档要求

创建包含以下内容的 `README.md`：

```markdown
# Conway Automaton

Sovereign AI Agent Runtime (主权 AI 智能体运行时)

## Quick Start (快速入门)

```bash
pnpm install
pnpm dev
```

服务器运行在 <http://localhost:3000>

## Scripts (脚本)

- `pnpm dev` - 带热重载的开发模式
- `pnpm build` - 编译 TypeScript
- `pnpm start` - 运行生产构建
- `pnpm test` - 运行测试
- `pnpm typecheck` - 仅执行类型检查

```

---

## 📌 关键实施说明

1. **ESM 导入扩展名** - 所有导入必须使用 `.js` 扩展名
2. **Package.json `"type": "module"`** - ESM 必需
3. **仅使用 pnpm** - 使用 pnpm，不要使用 npm 或 yarn
4. **严格 TypeScript** - 禁止使用 `any`，所有类型必须显式定义
5. **环境变量** - 使用 `.env` 进行配置
6. **错误中间件** - 始终包含异步错误处理程序
7. **健康端点** - GET / 必须返回服务器状态

---

## 🔗 依赖与参考

### **UpworkAutoPilot 设计整合**

参考自 `upwork_autopilot_detailed_design.md`：

- **后端框架：** 选择 Express 是因为其 "成熟稳定，丰富的生态，适合复杂业务逻辑"
- **智能体运行时基础：** 此设置建立了第 1.3 节中描述的 "Conway Automaton 主权运行时" 的基础
- **未来集成：** 此服务器稍后将集成：
  - 核心循环 (Core Loop) ReAct 状态机 (Story 1a.2)
  - 记忆系统 (Story 1a.3-1a.7)
  - Web3 身份 (Epic 1b)
  - 经济引擎 (Epic 1b-1c)

### **项目上下文参考**

- 模块系统：ESM (NodeNext) - "模块系统" 章节
- TypeScript 规则：严格模式，.js 扩展名 - "导入/导出模式" 章节
- 包管理器命令：pnpm - "包管理器命令" 章节
- Node.js 版本：>= 20.0.0 - "关键版本约束" 章节

---

## ✅ 完成定义 (DoD)

- [ ] `pnpm install` 无错误完成
- [ ] `pnpm dev` 在 3000 端口启动服务器
- [ ] GET / 返回带有 "Conway Automaton Running" 的 JSON
- [ ] TypeScript 严格模式已启用 (无 `any`，所有类型显式定义)
- [ ] 所有导入均使用 `.js` 扩展名 (符合 ESM 规范)
- [ ] `.gitignore` 排除 node_modules, dist, .env
- [ ] 通过 `pnpm test` 运行测试
- [ ] 已创建包含设置说明的 README.md
- [ ] .env.example 包含所有配置变量
- [ ] 无 TypeScript 编译错误

---

## 🚀 完成后后续步骤

1. 在 sprint-status.yaml 中将 Story 状态标记为 `done`
2. Epic 1a 的状态将根据 Story 的完成情况自动更新
3. 继续进行 Story 1a.2: 智能体循环基础 - ReAct 模式实现
4. 后续所有 Story 都将基于此基础构建

---

**创建此 Story 时参考了以下综合上下文：**
- Epic 1a 需求 (epics.md)
- 项目上下文规则 (project-context.md)
- UpworkAutoPilot 设计模式 (upwork_autopilot_detailed_design.md)
- TypeScript ESM 最佳实践

**此 Story 为整个 Conway Automaton 运行时奠定了关键基础。**
