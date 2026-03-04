# Story 审核自动化工具

## 审核标准清单

### 1. 项目上下文一致性检查
- [ ] TypeScript 版本 (5.9.3)
- [ ] Node.js 版本 (>= 20.0.0)
- [ ] 模块系统 (ESM NodeNext vs CommonJS)
- [ ] 包管理器 (pnpm vs npm)
- [ ] 依赖版本匹配

### 2. 技术栈符合性
- [ ] Automaton: ESM + pnpm + Express 5.2.1
- [ ] TinyClaw: CommonJS + npm + Hono 4.12.1
- [ ] TinyOffice: Next.js 16 + React 19

### 3. ESM 导入规则检查 (Automaton)
- [ ] 本地导入使用 `.js` 扩展名
- [ ] 外部包导入不使用扩展名
- [ ] package.json 设置 `"type": "module"`
- [ ] tsconfig.json 配置 `"module": "NodeNext"`

### 4. CommonJS 导入规则检查 (TinyClaw)
- [ ] 导入不使用文件扩展名
- [ ] package.json 不设置 `"type": "module"`

### 5. 验收标准完整性
- [ ] 所有验收标准清晰可测试
- [ ] 验收标准覆盖用户价值
- [ ] 有明确的成功标准

### 6. 代码质量要求
- [ ] TypeScript 严格模式启用
- [ ] 无 `any` 类型
- [ ] 所有类型显式定义
- [ ] 错误处理完善
- [ ] 日志记录符合标准

### 7. 安全要求
- [ ] 敏感信息使用环境变量
- [ ] .env 从 git 排除
- [ ] 输入验证/消毒
- [ ] 无硬编码密钥

### 8. 测试要求
- [ ] 测试文件结构正确
- [ ] 使用 Vitest
- [ ] 覆盖率阈值符合标准
- [ ] 使用内存数据库测试

### 9. 文档要求
- [ ] 包含 README
- [ ] API 文档完整
- [ ] 配置说明清晰

### 10. 与 Epic 目标一致性
- [ ] 符合所属 Epic 的目标
- [ ] 不依赖未来的 Story
- [ ] 提供独立的用户价值
