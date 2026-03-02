# Automaton - Conway AI Agent Runtime

自主 AI Agent 运行时，支持自我复制和 Web4 功能。

## 项目结构

```
automaton/
├── src/
│   ├── index.ts           # 入口点
│   ├── config.ts          # 配置管理
│   ├── state/             # 状态管理
│   │   └── database.ts    # SQLite 数据库
│   └── ...
├── packages/              # 子包
├── scripts/               # 工具脚本
├── dist/                  # 编译输出
└── tests/                 # 测试文件
```

## 技术栈

- **运行时**: Node.js 20+
- **语言**: TypeScript 5.9
- **包管理**: pnpm
- **测试**: Vitest
- **数据库**: better-sqlite3
- **Web 框架**: Express 5
- **AI**: OpenAI API
- **区块链**: viem (Ethereum)

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm build            # 编译项目
pnpm dev              # 开发模式 (热重载)
pnpm test             # 运行测试
pnpm test:coverage    # 测试覆盖率
pnpm test:security    # 安全相关测试
pnpm typecheck        # 类型检查
pnpm clean            # 清理编译产物
```

## 架构要点

- **入口点**: `src/index.ts` - CLI 入口
- **配置**: 通过 `config.ts` 管理
- **状态持久化**: 使用 SQLite (better-sqlite3)
- **API 服务**: Express 5 提供 REST API

## 开发规范

1. 使用 ES Modules (`"type": "module"`)
2. 编译输出到 `dist/` 目录
3. 保持测试覆盖率
4. 遵循 TypeScript 严格模式

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 详细架构文档
- [DOCUMENTATION.md](./DOCUMENTATION.md) - 使用文档
