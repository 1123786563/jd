# JD - AI Agent Monorepo

多项目 Monorepo，包含自主 AI Agent 运行时和多团队个人助手系统。

## 项目结构

```
jd/
├── automaton/          # Conway Automaton - 自主 AI Agent 运行时
│   ├── src/            # TypeScript 源码
│   ├── packages/       # 子包
│   └── dist/           # 编译输出
│
├── tinyclaw/           # TinyClaw - 多团队个人助手
│   ├── src/            # TypeScript 后端源码
│   ├── tinyoffice/     # Next.js 前端控制面板
│   └── lib/            # 共享库
│
└── docs/             # 项目文档
```

## 技术栈

| 子项目     | 技术                                                 |
| ---------- | ---------------------------------------------------- |
| automaton  | TypeScript, Express, OpenAI, viem, better-sqlite3    |
| tinyclaw   | TypeScript, Hono, Discord.js, Telegram API, WhatsApp |
| tinyoffice | Next.js 16, React 19, Tailwind CSS 4, Radix UI       |

## 常用命令

### Automaton

```bash
cd automaton
pnpm install          # 安装依赖
pnpm build            # 编译
pnpm dev              # 开发模式
pnpm test             # 运行测试
```

### TinyClaw

```bash
cd tinyclaw
npm install           # 安装依赖
npm run build         # 编译
npm run whatsapp      # 启动 WhatsApp 客户端
npm run discord       # 启动 Discord 客户端
npm run telegram      # 启动 Telegram 客户端
```

### TinyOffice

```bash
cd tinyclaw/tinyoffice
npm install           # 安装依赖
npm run dev           # 开发模式
npm run build         # 构建
npm run start         # 生产模式运行
```

## 开发原则

- **TypeScript 优先**: 所有项目使用 TypeScript
- **模块化设计**: 保持模块独立，低耦合
- **文档驱动**: 重要架构决策需记录在文档中
- **测试覆盖**: 使用 Vitest 进行单元测试

## 子项目文档

- [automaton/CLAUDE.md](./automaton/CLAUDE.md) - Automaton 项目指南
- [tinyclaw/AGENTS.md](./tinyclaw/AGENTS.md) - TinyClaw Agent 配置
- [automaton/ARCHITECTURE.md](./automaton/ARCHITECTURE.md) - Automaton 架构文档

## 注意事项

- Node.js 版本要求: >= 20.0.0
- automaton 使用 pnpm 作为包管理器
- tinyclaw 使用 npm 作为包管理器
- 文档必须写到docs/目录下  需要按照软件开发标准文档分类

  方案先行：写代码前必须先出方案，等我点头再动手！拒绝无效代码。
  任务拆解：超过3个文件的改动必须分段，防止 AI “脑载荷”过大。
  防御性编程：写完代码带上可能出的 Bug 清单和测试用例。
  TDD模式：先写报错脚本，复现了 Bug 再去修它。
  自我进化：每次我纠正你，请自动更新规矩。
